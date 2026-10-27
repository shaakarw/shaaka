// context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiUrl } from '../config';
import { Alert } from 'react-native';
import { isReelsActive } from '../services/reelActivity';
import { logPerformance } from '../utils/performanceLogger';
import { networkStatus } from '../services/networkStatus';

const AuthContext = createContext();

const isAuthFailure = (error) => {
  const status = error?.response?.status;
  const message = `${error?.response?.data?.message || ''} ${error?.message || ''}`.toLowerCase();
  return status === 401 || message.includes('401') || message.includes('unauthorized') || message.includes('signed_in_elsewhere');
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ----- Load stored session on app start -----
  useEffect(() => {
    const restoreStartedAt = Date.now();
    const loadStorageData = async () => {
      try {
        const storedValues = await AsyncStorage.multiGet(['userToken', 'user']);
        const token = storedValues[0]?.[1];
        const userData = storedValues[1]?.[1];
        if (token && userData) {
          setToken(token);
          setIsAuthenticated(true);
          setUser(JSON.parse(userData));
          syncFavorites(token);
        }
      } catch (error) {
        console.error('Failed to load auth data', error);
      } finally {
        setLoading(false);
        logPerformance(`[Perf] auth-session-restored ${Date.now() - restoreStartedAt}ms`);
      }
    };
    loadStorageData();
  }, []);

  // ----- Socket & polling for force-logout (unchanged) -----
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let socket;
    let pollId;
    const initSocket = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      let ioClient = null;
      try {
        const mod = require('socket.io-client');
        ioClient = mod.io || mod;
      } catch (e) {
        ioClient = null;
      }
      if (!ioClient) return;

      socket = ioClient(getApiUrl(), { auth: { token } });
      socket.on('connect', async () => {
        await AsyncStorage.setItem('socketId', socket.id);
        try {
          await axios.post(`${getApiUrl()}/api/user/register-socket`, { socketId: socket.id }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {}
      });
      socket.on('force-logout', async (data) => {
        await logout();
        Alert.alert('Logged out', data?.message || 'Your account has been signed in on another device.');
      });
    };
    initSocket();

    const startPolling = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      pollId = setInterval(async () => {
        if (isReelsActive() || !networkStatus.get().isOnline) return;
        try {
          const resp = await axios.get(`${getApiUrl()}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
          const serverSessionId = resp.data?.session?.sessionId;
          const localSessionId = await AsyncStorage.getItem('sessionId');
          if (localSessionId && serverSessionId && localSessionId !== serverSessionId) {
            await logout();
            Alert.alert('Logged out', 'Your account has been signed in on another device.');
          }
        } catch (err) {
          if (err?.response?.status === 401 && err.response.data?.message === 'signed_in_elsewhere') {
            await logout();
            Alert.alert('Logged out', 'Your account has been signed in on another device.');
          }
        }
      }, 2500);
    };
    startPolling();

    return () => {
      if (socket) socket.disconnect();
      if (pollId) clearInterval(pollId);
    };
  }, [isAuthenticated]);

  // ----- Axios interceptor (unchanged) -----
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const resp = error?.response;
        if (resp?.status === 401 && resp?.data?.message === 'signed_in_elsewhere') {
          await logout();
          Alert.alert('Logged out', 'Your account has been signed in on another device.');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // ============================================================
  // 🆕 SYNC FAVORITES – fetches from backend and updates AsyncStorage
  // ============================================================
  const syncFavorites = async (authToken = null) => {
    try {
      const currentToken = authToken || token || await AsyncStorage.getItem('userToken');
      if (!currentToken) return false;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

      const response = await axios.get(`${getApiUrl()}/api/favorites`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (response.data.success) {
        const placeIds = response.data.favorites.map(p => p._id || p.id).filter(Boolean);
        const shopIds = response.data.favoriteShops.map(s => s._id || s.id).filter(Boolean);

        await AsyncStorage.setItem('favorites', JSON.stringify(placeIds));
        await AsyncStorage.setItem('favoriteShops', JSON.stringify(shopIds));
        return true;
      }
      return false;
    } catch (error) {
      if (!isAuthFailure(error) && !(error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')) {
        console.error('Sync favorites error:', error);
      }
      return false;
    }
  };

  // ============================================================
  // LOGIN – now calls syncFavorites on success
  // ============================================================
  const login = async (identifier, password) => {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `dev-${Math.random().toString(36).substring(2, 10)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }

      const response = await axios.post(`${getApiUrl()}/api/auth/login`, {
        identifier,
        password,
        deviceId,
      });
      if (response.data.success) {
        const { token, user } = response.data;
        setToken(token);
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('sessionUser', JSON.stringify(user));

        // fetch server session
        try {
          const sessionResp = await axios.get(`${getApiUrl()}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
          if (sessionResp.data && sessionResp.data.session && sessionResp.data.session.sessionId) {
            await AsyncStorage.setItem('sessionId', sessionResp.data.session.sessionId);
          }
        } catch (e) {}

        setIsAuthenticated(true);
        setUser(user);

        // 🆕 Sync favorites from backend
        await syncFavorites(token);

        return { success: true, user };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Login API error:', error);
      let message = 'Login failed';
      if (error.response) {
        message = error.response.data?.message || 'Invalid credentials';
      } else if (error.request) {
        message = 'Cannot connect to server. Check if backend is running.';
      } else {
        message = error.message;
      }
      return { success: false, message };
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================
  const logout = async () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await AsyncStorage.multiRemove(['userToken', 'user', 'isLoggedIn', 'sessionUser', 'sessionId', 'socketId']);
  };

  // ============================================================
  // REFRESH USER
  // ============================================================
  const refreshUser = async () => {
    try {
      const currentToken = token || await AsyncStorage.getItem('userToken');
      if (!currentToken) {
        console.warn('No token available to refresh user');
        return null;
      }

      if (!(await networkStatus.start()).isOnline) {
        const storedUserData = await AsyncStorage.getItem('user');
        const storedUser = storedUserData ? JSON.parse(storedUserData) : user;
        if (storedUser) {
          setToken(currentToken);
          setUser(storedUser);
          setIsAuthenticated(true);
        }
        return storedUser || null;
      }

      const response = await axios.get(`${getApiUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      } else {
        console.warn('Refresh user failed:', response.data.message);
        return null;
      }
    } catch (error) {
      if (!isAuthFailure(error) && !(error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')) {
        console.error('Refresh user error:', error);
      }
      if (error.response?.status === 401 || isAuthFailure(error)) {
        await logout();
      }
      return null;
    }
  };

  // ============================================================
  // UPDATE USER PROFILE
  // ============================================================
  const updateUser = async (updatedData) => {
    try {
      const currentToken = token || await AsyncStorage.getItem('userToken');
      if (!currentToken) {
        return { success: false, message: 'Not authenticated' };
      }

      const response = await axios.put(`${getApiUrl()}/api/user/profile`, updatedData, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (response.data.success) {
        const newUser = {
          ...(user || {}),
          ...(response.data.user || {}),
          ...(updatedData || {}),
        };
        setUser(newUser);
        await AsyncStorage.setItem('user', JSON.stringify(newUser));
        await AsyncStorage.setItem('sessionUser', JSON.stringify(newUser));
        return { success: true, user: newUser };
      }
      return { success: false, message: response.data.message };
    } catch (err) {
      console.error('Update user error:', err);
      return { success: false, message: err.response?.data?.message || 'Update failed' };
    }
  };

  const syncStoredUser = async (storedUser) => {
    const nextUser = storedUser || user;
    if (!nextUser) return;
    setUser(nextUser);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    await AsyncStorage.setItem('sessionUser', JSON.stringify(nextUser));
  };

  // ============================================================
  // GET TOKEN helper
  // ============================================================
  const getToken = async () => {
    return token || await AsyncStorage.getItem('userToken');
  };

  // ============================================================
  // PROVIDER
  // ============================================================
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        user,
        token,
        login,
        logout,
        loading,
        refreshUser,
        updateUser,
        syncStoredUser,
        getToken,
        syncFavorites,   // 🆕 exposed so you can call it from anywhere
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const useUserLimits = () => {
  // Placeholder hook for user limits
  // Returns empty object - can be extended with actual limits logic
  return {};
};