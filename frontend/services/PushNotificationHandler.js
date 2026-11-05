import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config';
import { networkStatus } from './networkStatus';
import { getNotifications, isExpoGo } from './notificationsRuntime';

let notificationHandlerConfigured = false;

const categories = [
  { id: 'messages', title: 'Messages' },
  { id: 'social', title: 'Social activities' },
  { id: 'marketplace', title: 'Marketplace' },
  { id: 'orders', title: 'Orders' },
  { id: 'account', title: 'Account and security' },
];

const preferenceVariants = [
  { sound: true, vibration: true },
  { sound: false, vibration: true },
  { sound: true, vibration: false },
  { sound: false, vibration: false },
];

const getDeviceId = async () => {
  let deviceId = await AsyncStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

const getHeaders = token => ({ Authorization: `Bearer ${token}` });

export default function PushNotificationHandler({ onNotificationTap }) {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (isExpoGo) return undefined;
    const Notifications = getNotifications();
    if (!Notifications || notificationHandlerConfigured) return undefined;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    notificationHandlerConfigured = true;
    return undefined;
  }, []);

  useEffect(() => {
    if (isExpoGo || Platform.OS !== 'android') return undefined;
    const Notifications = getNotifications();
    if (!Notifications) return undefined;
    const createChannels = async () => {
      for (const category of categories) {
        for (const variant of preferenceVariants) {
          const suffix = `${variant.sound ? '' : '-no-sound'}${variant.vibration ? '' : '-no-vibration'}`;
          await Notifications.setNotificationChannelAsync(
            `${category.id}${suffix}`,
            {
              name: suffix
                ? `${category.title} (${variant.sound
                  ? (variant.vibration ? 'sound and vibration' : 'sound only')
                  : (variant.vibration ? 'vibration only' : 'silent')})`
                : category.title,
              importance: Notifications.AndroidImportance.MAX,
              sound: variant.sound ? 'default' : null,
              enableVibrate: variant.vibration,
              vibrationPattern: variant.vibration ? [0, 250, 250, 250] : [],
              enableLights: true,
              lightColor: '#47ae87',
            }
          );
        }
      }
    };
    createChannels().catch(error => {
      console.error('[Push] Could not configure Android notification channels:', error?.message || error);
    });
    return undefined;
  }, []);

  useEffect(() => {
    if (isExpoGo) return undefined;
    const Notifications = getNotifications();
    if (!Notifications) return undefined;
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      onNotificationTap(response.notification.request.content.data || {});
    });

    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) onNotificationTap(response.notification.request.content.data || {});
      })
      .catch(error => {
        console.error('[Push] Could not read the initial notification response:', error?.message || error);
      });

    return () => responseSubscription.remove();
  }, [onNotificationTap]);

  useEffect(() => {
    if (isExpoGo || !isAuthenticated || !token || !['android', 'ios'].includes(Platform.OS)) return undefined;
    const Notifications = getNotifications();
    if (!Notifications) return undefined;

    let active = true;
    let tokenSubscription;
    let registrationInFlight = false;
    let registeredToken = '';
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    const register = async () => {
      if (!active || registrationInFlight || !networkStatus.get().isOnline) return;
      registrationInFlight = true;
      try {
        const permission = await Notifications.getPermissionsAsync();
        const granted = permission.granted
          ? permission
          : await Notifications.requestPermissionsAsync();
        if (!active || !granted.granted) return;
        if (!projectId) throw new Error('Expo EAS projectId is missing from app configuration');

        const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!active || expoToken.data === registeredToken) return;
        const deviceId = await getDeviceId();
        await axios.post(`${getApiUrl()}/api/notifications/devices`, {
          token: expoToken.data,
          platform: Platform.OS,
          deviceId,
        }, { headers: getHeaders(token) });
        registeredToken = expoToken.data;

        if (!tokenSubscription) {
          tokenSubscription = Notifications.addPushTokenListener(() => {
            register().catch(error => {
              console.error('[Push] Could not update the push token:', error?.response?.data?.message || error?.message || error);
            });
          });
        }
      } finally {
        registrationInFlight = false;
      }
    };
    const unsubscribeNetwork = networkStatus.subscribe(status => {
      if (status.isOnline) {
        register().catch(error => {
          console.error('[Push] Device registration failed:', error?.response?.data?.message || error?.message || error);
        });
      }
    });
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        register().catch(error => {
          console.error('[Push] Device registration failed:', error?.response?.data?.message || error?.message || error);
        });
      }
    });

    return () => {
      active = false;
      unsubscribeNetwork();
      appStateSubscription.remove();
      tokenSubscription?.remove();
    };
  }, [isAuthenticated, token]);

  return null;
}
