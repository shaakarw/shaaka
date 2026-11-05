import AsyncStorage from '@react-native-async-storage/async-storage';

const DISPLAY_LIMIT = 2;
const DISPLAY_COUNT_KEY = 'shaaka_tutorial_display_count_install_v1';
let current = null;
let tutorialsReady = false;
const queue = [];
const readinessListeners = new Set();

export function areTutorialsReady() {
  return tutorialsReady;
}

export function setTutorialsReady() {
  if (tutorialsReady) return;
  tutorialsReady = true;
  readinessListeners.forEach((listener) => listener());
}

export function subscribeTutorialReadiness(listener) {
  readinessListeners.add(listener);
  return () => readinessListeners.delete(listener);
}

const readDisplayCount = async () => {
  try {
    const storedCount = await AsyncStorage.getItem(DISPLAY_COUNT_KEY);
    return Math.max(0, Number(storedCount) || 0);
  } catch (error) {
    console.error('Could not load tutorial display counts:', error);
    throw error;
  }
};

const grantTutorial = async () => {
  const displayCount = await readDisplayCount();
  if (displayCount >= DISPLAY_LIMIT) return false;

  try {
    await AsyncStorage.setItem(DISPLAY_COUNT_KEY, String(displayCount + 1));
    return true;
  } catch (error) {
    console.error('Could not save tutorial display count:', error);
    throw error;
  }
};

const grantNextQueued = async () => {
  while (!current && queue.length) {
    const next = queue.shift();
    current = next.id;
    try {
      const granted = await grantTutorial();
      if (!granted) {
        current = null;
        next.resolve(false);
        continue;
      }
      next.resolve(true);
    } catch (error) {
      console.error(`Could not start the ${next.id} tutorial:`, error);
      current = null;
      next.resolve(false);
    }
  }
};

export async function requestTutorial(id) {
  if (!tutorialsReady) return false;

  if (current) {
    return new Promise((resolve) => queue.push({ id, resolve }));
  }

  current = id;
  try {
    const granted = await grantTutorial();
    if (!granted) {
      current = null;
      await grantNextQueued();
    }
    return granted;
  } catch (error) {
    console.error(`Could not start the ${id} tutorial:`, error);
    current = null;
    await grantNextQueued();
    return false;
  }
}

export function releaseTutorial(id) {
  if (current !== id) return;
  current = null;
  grantNextQueued();
}

export function cancelTutorial(id) {
  const index = queue.findIndex((item) => item.id === id);
  if (index >= 0) queue.splice(index, 1)[0].resolve(false);
}

export function getActiveTutorial() {
  return current;
}
