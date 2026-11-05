import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const getAuthToken = async (key) => {
  if (isWeb) return AsyncStorage.getItem(key);

  const secureToken = await SecureStore.getItemAsync(key);
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem(key);
  if (!legacyToken) return null;

  await SecureStore.setItemAsync(key, legacyToken);
  await AsyncStorage.removeItem(key);
  return legacyToken;
};

export const setAuthToken = async (key, value) => {
  if (isWeb) return AsyncStorage.setItem(key, value);

  await SecureStore.setItemAsync(key, value);
  await AsyncStorage.removeItem(key);
};

export const removeAuthToken = async (key) => {
  if (!isWeb) await SecureStore.deleteItemAsync(key);
  await AsyncStorage.removeItem(key);
};
