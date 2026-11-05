// context/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiUrl } from '../config';
import { isReelsActive } from '../services/reelActivity';
import { logPerformance } from '../utils/performanceLogger';
import { networkStatus } from '../services/networkStatus';
import { getAuthToken, removeAuthToken, setAuthToken } from '../utils/authStorage';

const AuthContext = createContext();
const SESSION_CHECK_INTERVAL_MS = 15000;

const isInvalidatedSession = error =>
  ['session_invalidated', 'session_ended'].includes(error?.response?.data?.reason)
  || error?.response?.data?.message === 'signed_in_elsewhere';

const getAuthHeaders = token => ({ Authorization: `Bearer ${token}` });

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminSessionInvalidated, setAdminSessionInvalidated] = useState(false);
  const invalidationHandled = useRef(false);
  const manualLogoutInProgress = useRef(false);
  const adminLogoutInProgress = useRef(false);

  const clearLocalUserSession = async () => {
    await removeAuthToken('userToken');
    await removeAuthToken('adminToken');
    await AsyncStorage.multiRemove(['user', 'isLoggedIn', 'sessionUser', 'sessionId', 'socketId']);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsAdminAuthenticated(false);
  };

  const handleInvalidatedUserSession = async (message) => {
    if (manualLogoutInProgress.current) return;
    if (invalidationHandled.current) return;
    invalidationHandled.current = true;
    await clearLocalUserSession();
    Alert.alert('Session ended', message || 'Your account has been signed in on another device.');
  };

  const retryPendingLogout = async () => {
    const pendingToken = await getAuthToken('pendingLogoutToken');
    if (!pendingToken || !(await networkStatus.start()).isOnline) return;
    try {
      await axios.post(`${getApiUrl()}/api/auth/logout`, {}, getAuthHeaders(pendingToken));
      await removeAuthToken('pendingLogoutToken');
    } catch (error) {
      if (isInvalidatedSession(error) || error?.response?.status === 401) {
        await removeAuthToken('pendingLogoutToken');
      } else if (error?.response?.status >= 500 || !error.response) {
        console.warn('Pending server logout will retry when a connection is available:', error?.message || error);
      } else {
        console.error('Could not complete the pending server logout:', error?.response?.data?.message || error.message);
      }
    }
  };

  useEffect(() => {
    const restoreStartedAt = Date.now();
    const restoreSession = async () => {
      try {
        const [storedToken, storedUserData] = await Promise.all([
          getAuthToken('userToken'),
          AsyncStorage.getItem('user'),
        ]);
        if (!storedToken) return;

        const storedUser = storedUserData ? JSON.parse(storedUserData) : null;
        if (storedUser) setUser(storedUser);
        setToken(storedToken);
        setIsAuthenticated(true);
        if (storedUser?.role === 'admin') {
          await setAuthToken('adminToken', storedToken);
          setIsAdminAuthenticated(true);
        } else if (storedUser) {
          await removeAuthToken('adminToken');
          setIsAdminAuthenticated(false);
        }
        invalidationHandled.current = false;

        if ((await networkStatus.start()).isOnline) {
          try {
            const response = await axios.get(`${getApiUrl()}/api/auth/session`, getAuthHeaders(storedToken));
            const sessionId = response.data?.session?.sessionId;
            if (sessionId) await AsyncStorage.setItem('sessionId', sessionId);
            if (!storedUser) {
              const userResponse = await axios.get(`${getApiUrl()}/api/auth/me`, getAuthHeaders(storedToken));
              if (userResponse.data?.success) {
                const restoredUser = userResponse.data.user;
                setUser(restoredUser);
                await AsyncStorage.setItem('user', JSON.stringify(restoredUser));
                if (restoredUser.role === 'admin') {
                  await setAuthToken('adminToken', storedToken);
                  setIsAdminAuthenticated(true);
                } else {
                  await removeAuthToken('adminToken');
                  setIsAdminAuthenticated(false);
                }
              }
            }
          } catch (error) {
            if (isInvalidatedSession(error)) {
              await handleInvalidatedUserSession();
              return;
            }
            console.warn('Could not verify the restored session; keeping it for retry:', error?.response?.data?.message || error?.message || error);
          }
        }
        await syncFavorites(storedToken);
      } catch (error) {
        console.error('Failed to restore auth data:', error);
      } finally {
        setLoading(false);
        logPerformance(`[Perf] auth-session-restored ${Date.now() - restoreStartedAt}ms`);
      }
    };
    restoreSession().catch(error => console.error('Auth restoration failed:', error));
    retryPendingLogout().catch(error => console.error('Could not retry pending logout:', error));
  }, []);

  useEffect(() => {
    const unsubscribe = networkStatus.subscribe(status => {
      if (status.isOnline) retryPendingLogout().catch(error => console.error('Could not retry pending logout:', error));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;
    let active = true;
    let socket;
    const checkSession = async () => {
      if (!active || isReelsActive() || !(await networkStatus.start()).isOnline) return;
      try {
        const response = await axios.get(`${getApiUrl()}/api/auth/session`, getAuthHeaders(token));
        const sessionId = response.data?.session?.sessionId;
        if (sessionId) await AsyncStorage.setItem('sessionId', sessionId);
      } catch (error) {
        if (isInvalidatedSession(error)) {
          await handleInvalidatedUserSession();
        } else if (error?.response?.status >= 500) {
          console.warn('Session verification temporarily unavailable:', error?.response?.data?.message || error.message);
        }
      }
    };

    try {
      const socketModule = require('socket.io-client');
      const ioClient = socketModule.io || socketModule;
      socket = ioClient(getApiUrl(), { auth: { token } });
      socket.on('connect', async () => {
        await AsyncStorage.setItem('socketId', socket.id);
        try {
          await axios.post(
            `${getApiUrl()}/api/user/register-socket`,
            { socketId: socket.id },
            getAuthHeaders(token)
          );
        } catch (error) {
          if (isInvalidatedSession(error)) await handleInvalidatedUserSession();
        }
      });
      socket.on('force-logout', data => {
        if (!active) return;
        if (manualLogoutInProgress.current) {
          socket.disconnect();
          return;
        }
        handleInvalidatedUserSession(data?.message).catch(error => console.error('Could not end invalidated session:', error));
      });
    } catch (error) {
      console.error('Could not initialize the session socket:', error);
    }

    const pollId = setInterval(() => {
      checkSession().catch(error => console.error('Session verification failed:', error));
    }, SESSION_CHECK_INTERVAL_MS);
    const unsubscribeNetwork = networkStatus.subscribe(status => {
      if (status.isOnline) checkSession().catch(error => console.error('Session verification failed:', error));
    });
    checkSession().catch(error => console.error('Initial session verification failed:', error));

    return () => {
      active = false;
      socket?.disconnect();
      clearInterval(pollId);
      unsubscribeNetwork();
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    let active = true;
    const checkAdminSession = async () => {
      const adminToken = await getAuthToken('adminToken');
      if (!active || adminLogoutInProgress.current) return;
      if (!adminToken) {
        setIsAdminAuthenticated(false);
        return;
      }
      if (!(await networkStatus.start()).isOnline) {
        setIsAdminAuthenticated(true);
        return;
      }
      try {
        await axios.get(`${getApiUrl()}/api/admin/session`, getAuthHeaders(adminToken));
        if (active && !adminLogoutInProgress.current && (await getAuthToken('adminToken')) === adminToken) {
          setIsAdminAuthenticated(true);
        }
      } catch (error) {
        if (!active || adminLogoutInProgress.current || (await getAuthToken('adminToken')) !== adminToken) return;
        if (isInvalidatedSession(error)) {
          await removeAuthToken('adminToken');
          setIsAdminAuthenticated(false);
          setAdminSessionInvalidated(true);
          Alert.alert('Session ended', 'Your admin account has been signed in on another device.');
        } else if (error?.response?.status >= 500) {
          setIsAdminAuthenticated(true);
          console.warn('Admin session verification temporarily unavailable:', error?.response?.data?.message || error.message);
        } else if (!error.response) {
          setIsAdminAuthenticated(true);
          console.warn('Could not verify the admin session; keeping it for retry:', error.message);
        }
      }
    };
    const pollId = setInterval(() => {
      checkAdminSession().catch(error => console.error('Admin session verification failed:', error));
    }, SESSION_CHECK_INTERVAL_MS);
    const unsubscribeNetwork = networkStatus.subscribe(status => {
      if (status.isOnline) checkAdminSession().catch(error => console.error('Admin session verification failed:', error));
    });
    checkAdminSession().catch(error => console.error('Initial admin session verification failed:', error));
    return () => {
      active = false;
      clearInterval(pollId);
      unsubscribeNetwork();
    };
  }, []);

  const syncFavorites = async (authToken = null) => {
    try {
      const currentToken = authToken || token || await getAuthToken('userToken');
      if (!currentToken || !(await networkStatus.start()).isOnline) return false;
      const response = await axios.get(`${getApiUrl()}/api/favorites`, getAuthHeaders(currentToken));
      if (!response.data?.success) return false;
      const placeIds = (response.data.favorites || []).map(place => place._id || place.id).filter(Boolean);
      const shopIds = (response.data.favoriteShops || []).map(shop => shop._id || shop.id).filter(Boolean);
      await AsyncStorage.setItem('favorites', JSON.stringify(placeIds));
      await AsyncStorage.setItem('favoriteShops', JSON.stringify(shopIds));
      return true;
    } catch (error) {
      if (!isInvalidatedSession(error) && error?.response?.status < 500 && error?.response) {
        console.error('Sync favorites error:', error?.response?.data?.message || error.message);
      }
      return false;
    }
  };

  const login = async (identifier, password) => {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      const response = await axios.post(`${getApiUrl()}/api/auth/login`, { identifier, password, deviceId });
      if (!response.data?.success || !response.data.token || !response.data.user) {
        return { success: false, message: response.data?.message || 'Login failed' };
      }
      const { token: authToken, user: authenticatedUser } = response.data;
      await setAuthToken('userToken', authToken);
      if (authenticatedUser.role === 'admin') {
        await setAuthToken('adminToken', authToken);
        setIsAdminAuthenticated(true);
      } else {
        await removeAuthToken('adminToken');
        setIsAdminAuthenticated(false);
      }
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(authenticatedUser)],
        ['isLoggedIn', 'true'],
        ['sessionUser', JSON.stringify(authenticatedUser)],
      ]);
      if (response.data.session?.sessionId) {
        await AsyncStorage.setItem('sessionId', response.data.session.sessionId);
      }
      invalidationHandled.current = false;
      setToken(authToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      await syncFavorites(authToken);
      return { success: true, user: authenticatedUser, token: authToken };
    } catch (error) {
      console.error('Login API error:', error);
      const message = error.response
        ? error.response.data?.message || 'Invalid credentials'
        : error.request
          ? 'Cannot connect to server. Check if backend is running.'
          : error.message;
      return { success: false, message };
    }
  };

  const logout = async () => {
    manualLogoutInProgress.current = true;
    try {
      const authToken = token || await getAuthToken('userToken');
      const deviceId = await AsyncStorage.getItem('deviceId');
      let serverRevoked = !authToken;

      if (authToken && deviceId) {
        try {
          await axios.delete(`${getApiUrl()}/api/notifications/devices`, {
            data: { deviceId },
            headers: getAuthHeaders(authToken),
          });
        } catch (error) {
          console.error('[Push] Could not unregister device during logout:', error?.response?.data?.message || error?.message || error);
        }
      }

      if (authToken) {
        try {
          await axios.post(`${getApiUrl()}/api/auth/logout`, {}, getAuthHeaders(authToken));
          serverRevoked = true;
        } catch (error) {
          if (isInvalidatedSession(error) || error?.response?.status === 401) {
            serverRevoked = true;
          } else {
            console.error('Could not revoke the server session during logout:', error?.response?.data?.message || error?.message || error);
            await setAuthToken('pendingLogoutToken', authToken);
          }
        }
      }

      await clearLocalUserSession();
      invalidationHandled.current = false;
      if (serverRevoked) {
        await removeAuthToken('pendingLogoutToken');
      } else {
        Alert.alert('Logged out', 'You are logged out on this device. Server sign-out will finish when your connection is restored.');
      }
    } finally {
      manualLogoutInProgress.current = false;
    }
  };

  const logoutAdmin = async () => {
    adminLogoutInProgress.current = true;
    let adminToken = null;
    try {
      adminToken = await getAuthToken('adminToken');
      const userToken = token || await getAuthToken('userToken');
      const sharesUserSession = user?.role === 'admin' && userToken && (!adminToken || userToken === adminToken);
      await removeAuthToken('adminToken');
      setIsAdminAuthenticated(false);

      if (sharesUserSession) {
        await logout();
        return { success: true, userSession: true };
      }

      if (adminToken) {
        try {
          await axios.post(`${getApiUrl()}/api/admin/logout`, {}, getAuthHeaders(adminToken));
        } catch (error) {
          if (!isInvalidatedSession(error) && error?.response?.status !== 401) throw error;
        }
      }

      setAdminSessionInvalidated(false);
      return { success: true, userSession: false };
    } catch (error) {
      if (adminToken) {
        await setAuthToken('adminToken', adminToken);
        setIsAdminAuthenticated(true);
      }
      throw error;
    } finally {
      adminLogoutInProgress.current = false;
    }
  };

  const refreshUser = async () => {
    try {
      const currentToken = token || await getAuthToken('userToken');
      if (!currentToken) return null;
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
      const response = await axios.get(`${getApiUrl()}/api/auth/me`, getAuthHeaders(currentToken));
      if (!response.data?.success) return null;
      const updatedUser = response.data.user;
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      if (isInvalidatedSession(error)) await handleInvalidatedUserSession();
      else if (error?.response?.status >= 500 || !error.response) {
        console.warn('Could not refresh user data; keeping the current session:', error?.response?.data?.message || error.message);
      }
      return null;
    }
  };

  const updateUser = async (updatedData) => {
    try {
      const currentToken = token || await getAuthToken('userToken');
      if (!currentToken) return { success: false, message: 'Not authenticated' };
      const response = await axios.put(`${getApiUrl()}/api/user/profile`, updatedData, {
        headers: getAuthHeaders(currentToken),
      });
      if (!response.data?.success) return { success: false, message: response.data?.message };
      const newUser = { ...(user || {}), ...(response.data.user || {}), ...(updatedData || {}) };
      setUser(newUser);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('sessionUser', JSON.stringify(newUser));
      return { success: true, user: newUser };
    } catch (error) {
      if (isInvalidatedSession(error)) await handleInvalidatedUserSession();
      console.error('Update user error:', error);
      return { success: false, message: error.response?.data?.message || 'Update failed' };
    }
  };

  const syncStoredUser = async (storedUser) => {
    const nextUser = storedUser || user;
    if (!nextUser) return;
    setUser(nextUser);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    await AsyncStorage.setItem('sessionUser', JSON.stringify(nextUser));
  };

  const getToken = async () => token || getAuthToken('userToken');
  const clearAdminSessionInvalidated = useCallback(() => setAdminSessionInvalidated(false), []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        user,
        token,
        login,
        logout,
        logoutAdmin,
        loading,
        isAdminAuthenticated,
        setIsAdminAuthenticated,
        refreshUser,
        updateUser,
        syncStoredUser,
        getToken,
        syncFavorites,
        adminSessionInvalidated,
        clearAdminSessionInvalidated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export const useUserLimits = () => ({});
