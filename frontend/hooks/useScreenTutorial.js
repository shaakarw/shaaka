import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  areTutorialsReady,
  cancelTutorial,
  releaseTutorial,
  requestTutorial,
  subscribeTutorialReadiness,
} from '../services/tutorialCoordinator';

export default function useScreenTutorial(id, focused, delayMs = 700, triggerKey = null) {
  const [visible, setVisible] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [tutorialsReady, setTutorialsReady] = useState(areTutorialsReady());
  const visibleRef = useRef(false);
  const appActiveRef = useRef(appActive);
  const generationRef = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      appActiveRef.current = active;
      setAppActive(active);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => subscribeTutorialReadiness(() => setTutorialsReady(true)), []);

  useEffect(() => {
    if (!focused) {
      if (visibleRef.current) {
        visibleRef.current = false;
        setVisible(false);
        releaseTutorial(id);
      }
      return undefined;
    }
    if (!tutorialsReady || !appActive || visibleRef.current) return undefined;

    let active = true;
    const timer = setTimeout(async () => {
      const requestGeneration = generationRef.current;
      try {
        const granted = await requestTutorial(id);
        if (!active || requestGeneration !== generationRef.current || !granted) {
          if (granted) releaseTutorial(id);
          return;
        }
        setVisible(true);
      } catch (error) {
        console.error(`Could not start the ${id} tutorial:`, error);
      }
    }, delayMs);

    return () => {
      active = false;
      generationRef.current += 1;
      clearTimeout(timer);
      cancelTutorial(id);
      if (visibleRef.current && (!focused || (triggerKey !== null && appActiveRef.current))) {
        visibleRef.current = false;
        setVisible(false);
        releaseTutorial(id);
      }
    };
  }, [appActive, delayMs, focused, id, triggerKey, tutorialsReady]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const finish = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    releaseTutorial(id);
  }, [id]);

  return [focused && visible, finish];
}
