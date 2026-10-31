import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../context/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(error => {
  console.error('Unable to hold the native launch screen:', error);
});

const logo = require('../assets/logos.png');

/* -------------------------------------------------------------------------- */
/*  Copy                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND = 'SHAAKA';

// What SHAAKA does — typed out one character at a time.
const TAGLINE = 'Buy and sell pre-loved fashion';

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                */
/* -------------------------------------------------------------------------- */

// The screen that opens automatically when the startup sequence completes.
// Must match a route name registered in your navigator.
const DEFAULT_NEXT_ROUTE = 'Main';

/* -------------------------------------------------------------------------- */
/*  Theme                                                                     */
/* -------------------------------------------------------------------------- */

const DARK_THEME = {
  background: '#111',
  brand: '#f5f5f5',
  logo: '#f5f5f5',
  halo: '#a6a6a6',
  tagline: '#b8b8b8',
  caret: '#f5f5f5',
};

const LIGHT_THEME = {
  background: '#dddddd',
  brand: '#0d0d0d',
  logo: '#0d0d0d',
  halo: '#8a8a8a',
  tagline: '#5c5c5c',
  caret: '#0d0d0d',
};

/* -------------------------------------------------------------------------- */
/*  Timeline (ms)                                                             */
/* -------------------------------------------------------------------------- */

const LETTER_STAGGER_MS = 70; // delay between each brand letter
const LETTER_FADE_MS = 260; // per-letter fade / rise / scale

const TAGLINE_FADE_MS = 260;
const TYPE_START_DELAY_MS = 200;
const TYPE_INTERVAL_MS = 30; // speed of the typewriter

const POST_READY_TRANSITION_MS = 1000;
const EXIT_FADE_MS = 420;

export default function StartupScreen({
  // React Navigation passes `navigation` automatically when this component is
  // registered via <Stack.Screen component={StartupScreen} />. We use it as a
  // prop (instead of `useNavigation()`) so the screen is safe to render even
  // when it's mounted OUTSIDE a NavigationContainer (e.g. before the navigator).
  navigation,
  onFinish,
  isPageReady = true,
  nextRoute = DEFAULT_NEXT_ROUTE,
}) {
  /* -------------------------------- theme ---------------------------------- */
  const { isDarkMode: isDark } = useTheme();
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  /* ----------------------------- animated values ---------------------------- */
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(0.72)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const caretOpacity = useRef(new Animated.Value(1)).current;

  // One animated value + derived transforms per letter of "SHAAKA".
  const letterAnimations = useRef(null);
  if (letterAnimations.current === null) {
    letterAnimations.current = BRAND.split('').map(() => {
      const value = new Animated.Value(0);
      return {
        value,
        translateY: value.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }),
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
      };
    });
  }

  /* -------------------------------- state ---------------------------------- */
  const [typedCount, setTypedCount] = useState(0);

  /* -------------------------------- refs ----------------------------------- */
  const hasStarted = useRef(false);
  const hasCompleted = useRef(false);
  const cancelled = useRef(false);
  const timeouts = useRef([]);
  const currentAnimation = useRef(null);
  const caretLoop = useRef(null);
  const pageReadyRef = useRef({ ready: isPageReady, completedAt: null });
  const pageReadyResolver = useRef(null);

  useEffect(() => {
    if (!isPageReady || pageReadyRef.current.ready) return;
    pageReadyRef.current = { ready: true, completedAt: Date.now() };
    pageReadyResolver.current?.();
    pageReadyResolver.current = null;
  }, [isPageReady]);

  /* ------------------------- leave the startup screen ---------------------- */
  /**
   * Called once after the welcome page is ready and the transition finishes.
   * Priority order:
   *
   *   1. `onFinish` prop — parent fully controls what happens next.
   *   2. `navigation` prop — the screen is a registered route; replace with
   *      `nextRoute` so the back button can't return to the splash.
   *   3. Warn — nothing was wired up.
   *
   * Guarded by `hasCompleted` so the animation can never trigger navigation
   * more than once.
   */
  const complete = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;

    if (typeof onFinish === 'function') {
      try {
        onFinish();
      } catch (error) {
        console.error('onFinish callback threw:', error);
      }
      return;
    }

    if (navigation && typeof navigation.replace === 'function') {
      navigation.replace(nextRoute);
      return;
    }

    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(nextRoute);
      return;
    }

    // eslint-disable-next-line no-console
    console.warn(
      `StartupScreen: animation complete, but no way to open "${nextRoute}". ` +
        `Either pass an \`onFinish\` prop or register this component as a ` +
        `screen inside your navigator so React Navigation supplies \`navigation\`.`
    );
  }, [navigation, nextRoute, onFinish]);

  /* ------------------------- blinking typewriter caret --------------------- */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    caretLoop.current = loop;
    loop.start();
    return () => loop.stop();
  }, [caretOpacity]);

  /* ------------------------------ main timeline ---------------------------- */
  const startAnimation = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    try {
      await SplashScreen.hideAsync();
    } catch (error) {
      console.error('Unable to hide the native launch screen:', error);
    }
    if (cancelled.current) return;

    const wait = ms =>
      new Promise(resolve => {
        const id = setTimeout(resolve, ms);
        timeouts.current.push(id);
      });

    const run = animation =>
      new Promise(resolve => {
        currentAnimation.current = animation;
        animation.start(({ finished }) => {
          if (currentAnimation.current === animation) currentAnimation.current = null;
          resolve(finished);
        });
      });

    /* 1 — logo + halo ------------------------------------------------------ */
    const logoFinished = await run(
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.08,
            duration: 680,
            easing: Easing.out(Easing.back(1.15)),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(haloOpacity, {
          toValue: isDark ? 0.32 : 0.45,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1.35,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    if (!logoFinished || cancelled.current) return;

    /* 2 — S → H → A → A → K → A, one letter at a time ---------------------- */
    const brandFinished = await run(
      Animated.stagger(
        LETTER_STAGGER_MS,
        letterAnimations.current.map(letter =>
          Animated.timing(letter.value, {
            toValue: 1,
            duration: LETTER_FADE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      )
    );
    if (!brandFinished || cancelled.current) return;

    /* 3 — tagline types itself out ---------------------------------------- */
    Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: TAGLINE_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    await wait(TYPE_START_DELAY_MS);
    if (cancelled.current) return;

    for (let index = 1; index <= TAGLINE.length; index += 1) {
      if (cancelled.current) return;
      setTypedCount(index);
      if (index < TAGLINE.length) {
        await wait(TYPE_INTERVAL_MS);
      }
    }

    // Typing done — let the caret fade away instead of blinking forever.
    caretLoop.current?.stop();
    Animated.timing(caretOpacity, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();

    /* 4 — wait for the welcome page, then transition to it ----------------- */
    if (!pageReadyRef.current.ready) {
      await new Promise(resolve => {
        pageReadyResolver.current = resolve;
      });
    }
    if (cancelled.current) return;

    const readyAt = pageReadyRef.current.completedAt ?? Date.now();
    const holdDuration = Math.max(
      0,
      readyAt + POST_READY_TRANSITION_MS - Date.now() - EXIT_FADE_MS
    );
    await wait(holdDuration);
    if (cancelled.current) return;

    const exitFinished = await run(
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: EXIT_FADE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    if (!exitFinished || cancelled.current) return;

    complete();
  }, [
    caretOpacity,
    haloOpacity,
    haloScale,
    isDark,
    logoOpacity,
    logoScale,
    overlayOpacity,
    taglineOpacity,
    complete,
    isPageReady,
  ]);

  /* --------------------------------- cleanup -------------------------------- */
  useEffect(
    () => () => {
      cancelled.current = true;
      pageReadyResolver.current?.();
      pageReadyResolver.current = null;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      currentAnimation.current?.stop();
      caretLoop.current?.stop();
    },
    []
  );

  /* ---------------------------- themed styles ------------------------------ */
  const themed = useMemo(
    () => ({
      screen: { backgroundColor: theme.background },
      halo: { borderColor: theme.halo },
      logo: { tintColor: theme.logo },
      brandLetter: { color: theme.brand },
      tagline: { color: theme.tagline },
      caret: { backgroundColor: theme.caret },
    }),
    [theme]
  );

  /* ---------------------------------- render -------------------------------- */
  return (
    <Animated.View
      onLayout={startAnimation}
      style={[styles.screen, themed.screen, { opacity: overlayOpacity }]}
      accessibilityLabel="SHAAKA startup screen"
      accessibilityRole="progressbar"
    >
      <View style={styles.logoStage}>
        <Animated.View
          style={[
            styles.halo,
            themed.halo,
            {
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <Animated.Image
          source={logo}
          resizeMode="contain"
          style={[
            styles.logo,
            themed.logo,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        />
      </View>

      {/* Brand — each letter animates in on its own */}
      <View style={styles.brandRow} accessible accessibilityLabel={BRAND}>
        {BRAND.split('').map((character, index) => {
          const letter = letterAnimations.current[index];
          const isLast = index === BRAND.length - 1;

          return (
            <Animated.Text
              key={`${character}-${index}`}
              style={[
                styles.brandLetter,
                themed.brandLetter,
                isLast && styles.brandLetterLast,
                {
                  opacity: letter.value,
                  transform: [{ translateY: letter.translateY }, { scale: letter.scale }],
                },
              ]}
            >
              {character}
            </Animated.Text>
          );
        })}
      </View>

      {/* Tagline — types itself out under the brand */}
      <Animated.View style={[styles.taglineRow, { opacity: taglineOpacity }]}>
        <Text style={[styles.tagline, themed.tagline]} numberOfLines={1}>
          {TAGLINE.slice(0, typedCount)}
        </Text>
        <Animated.View style={[styles.caret, themed.caret, { opacity: caretOpacity }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 10000,
    elevation: 10000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  halo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
  },
  logo: {
    width: 116,
    height: 116,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  brandLetter: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8, // replaces letterSpacing so each glyph can animate alone
  },
  brandLetterLast: {
    marginRight: 0,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    marginTop: 6,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  caret: {
    width: 2,
    height: 14,
    marginLeft: 3,
    borderRadius: 1,
  },
});