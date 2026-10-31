import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTutorialPreferences } from './tutorialPreferences';

const DISPLAY_LIMIT = 2;
const COUNT_KEY_PREFIX = 'shaaka_tutorial_display_counts_v1:';
let current = null;
const queue = [];

const getUserScope = async () => {
  try {
    const storedUser = await AsyncStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    return String(user?._id || user?.id || 'guest');
  } catch (error) {
    console.error('Could not identify the tutorial counter owner:', error);
    throw error;
  }
};

const readCounts = async (scope) => {
  try {
    const storedCounts = await AsyncStorage.getItem(`${COUNT_KEY_PREFIX}${scope}`);
    return storedCounts ? JSON.parse(storedCounts) : {};
  } catch (error) {
    console.error('Could not load tutorial display counts:', error);
    throw error;
  }
};

const grantTutorial = async (id, countDisplay) => {
  const { enabled } = await getTutorialPreferences();
  if (!enabled) return false;
  if (!countDisplay) return true;

  const scope = await getUserScope();
  const counts = await readCounts(scope);
  const displayCount = Number(counts[id]) || 0;
  if (displayCount >= DISPLAY_LIMIT) return false;

  try {
    await AsyncStorage.setItem(
      `${COUNT_KEY_PREFIX}${scope}`,
      JSON.stringify({ ...counts, [id]: displayCount + 1 })
    );
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
      const granted = await grantTutorial(next.id, next.countDisplay);
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

export async function requestTutorial(id, { countDisplay = true } = {}) {
  const { enabled } = await getTutorialPreferences();
  if (!enabled) return false;

  if (current) {
    return new Promise((resolve) => queue.push({ id, countDisplay, resolve }));
  }

  current = id;
  try {
    const granted = await grantTutorial(id, countDisplay);
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

export async function getTutorialDisplayCounts(userId) {
  const scope = userId || await getUserScope();
  return readCounts(scope);
}
