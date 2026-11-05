import { getAuthToken } from '../utils/authStorage';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import { BASE_URL } from '../constants';

const getUserId = (user) => {
  if (user == null) return null;
  if (typeof user === 'string' || typeof user === 'number') return String(user);
  return String(user._id || user.id || user.userId || '');
};

export default function useOnlineUsers(userIds = []) {
  const userIdsKey = [...new Set(userIds.map(getUserId).filter(Boolean))].sort().join(',');
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    const ids = userIdsKey ? userIdsKey.split(',') : [];
    if (ids.length === 0) {
      setOnlineUsers({});
      return undefined;
    }

    let active = true;
    let socket;
    let refreshInterval;
    const trackedIds = new Set(ids);

    const fetchStatuses = async (token) => {
      try {
        const response = await axios.post(
          `${BASE_URL}/api/user/batch-online`,
          { userIds: ids },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!active || !response.data?.success) return;
        const statuses = response.data.statuses || {};
        setOnlineUsers(previous => ({
          ...previous,
          ...Object.fromEntries(ids.map(id => {
            const value = statuses[id];
            return [id, value === true || value?.isOnline === true];
          })),
        }));
      } catch (error) {
        if (error?.response?.status !== 404) {
          console.warn('Could not fetch user online statuses:', error?.message || error);
        }
      }
    };

    const startPresence = async () => {
      try {
        const token = await getAuthToken('userToken')
          || await getAuthToken('adminToken');
        if (!active || !token) return;

        fetchStatuses(token);
        refreshInterval = setInterval(() => fetchStatuses(token), 30000);

        socket = io(BASE_URL.replace('/api', ''), {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        socket.on('connect', () => fetchStatuses(token));
        socket.on('user-online', payload => {
          const id = getUserId(payload?.userId);
          if (active && trackedIds.has(id)) {
            setOnlineUsers(previous => ({ ...previous, [id]: true }));
          }
        });
        socket.on('user-offline', payload => {
          const id = getUserId(payload?.userId);
          if (active && trackedIds.has(id)) {
            setOnlineUsers(previous => ({ ...previous, [id]: false }));
          }
        });
      } catch (error) {
        console.warn('Could not initialize user presence:', error?.message || error);
      }
    };

    startPresence();

    return () => {
      active = false;
      if (refreshInterval) clearInterval(refreshInterval);
      if (socket) socket.disconnect();
    };
  }, [userIdsKey]);

  return onlineUsers;
}
