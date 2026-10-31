import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIALS_ENABLED_KEY = 'shaaka_tutorials_enabled_v1';

let preferences = { enabled: true };
let loaded = false;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(preferences));

export async function getTutorialPreferences() {
  if (loaded) return preferences;

  try {
    const enabledValue = await AsyncStorage.getItem(TUTORIALS_ENABLED_KEY);
    preferences = {
      enabled: enabledValue === null ? true : enabledValue === 'true',
    };
    loaded = true;
    notify();
    return preferences;
  } catch (error) {
    console.error('Could not load tutorial preferences:', error);
    throw error;
  }
}

export async function setTutorialPreference(key, value) {
  if (key !== 'enabled') {
    throw new Error(`Unsupported tutorial preference: ${key}`);
  }
  const previous = preferences;
  preferences = { ...preferences, [key]: value };
  notify();

  try {
    await AsyncStorage.setItem(TUTORIALS_ENABLED_KEY, JSON.stringify(value));
    loaded = true;
  } catch (error) {
    preferences = previous;
    notify();
    console.error('Could not save tutorial preference:', error);
    throw error;
  }
}

export function subscribeTutorialPreferences(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
