import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelTutorial, releaseTutorial, requestTutorial } from '../services/tutorialCoordinator';
import { getTutorialPreferences, subscribeTutorialPreferences } from '../services/tutorialPreferences';

export default function useScreenTutorial(id, focused, delayMs = 700, triggerKey = null) {
  const [visible, setVisible] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const visibleRef = useRef(false);
  const appActiveRef = useRef(appActive);
  const generationRef = useRef(0);
  const visitStartedRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      appActiveRef.current = active;
      setAppActive(active);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused) {
      visitStartedRef.current = false;
      if (visibleRef.current) {
        visibleRef.current = false;
        setVisible(false);
        releaseTutorial(id);
      }
      return undefined;
    }
    if (!appActive || visibleRef.current) return undefined;

    let active = true;
    const countDisplay = !visitStartedRef.current;
    const timer = setTimeout(async () => {
      const requestGeneration = generationRef.current;
      try {
        const granted = await requestTutorial(id, { countDisplay });
        if (!active || requestGeneration !== generationRef.current || !granted) {
          if (granted) releaseTutorial(id);
          return;
        }
        visitStartedRef.current = true;
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
      if (!focused || (triggerKey !== null && appActiveRef.current)) {
        visitStartedRef.current = false;
      }
      if (visibleRef.current && (!focused || (triggerKey !== null && appActiveRef.current))) {
        visibleRef.current = false;
        setVisible(false);
        releaseTutorial(id);
      }
    };
  }, [appActive, delayMs, focused, id, triggerKey]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    let active = true;
    const applyPreference = (preferences) => {
      if (!preferences.enabled && visibleRef.current) {
        visibleRef.current = false;
        setVisible(false);
        releaseTutorial(id);
      }
    };

    getTutorialPreferences()
      .then((preferences) => {
        if (active) applyPreference(preferences);
      })
      .catch((error) => console.error('Could not read tutorial preferences:', error));

    const unsubscribe = subscribeTutorialPreferences(applyPreference);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  const finish = useCallback(() => {
    visibleRef.current = false;
    setVisible(false);
    releaseTutorial(id);
  }, [id]);

  return [focused && visible, finish];
}
