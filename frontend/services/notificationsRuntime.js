import Constants from 'expo-constants';

export const isExpoGo = Constants.appOwnership === 'expo';

export function getNotifications() {
  if (isExpoGo) return null;
  return require('expo-notifications');
}
