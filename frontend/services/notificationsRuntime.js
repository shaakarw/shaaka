import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const isExpoGo = Constants.appOwnership === 'expo';

export function getNotifications() {
  if (isExpoGo || Platform.OS === 'web') return null;
  return require('expo-notifications');
}
