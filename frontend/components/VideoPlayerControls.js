/* ========================================================================== */
/*  components/VideoPlayerControls.js                                         */
/* ========================================================================== */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACCENT_FALLBACK = '#47ae87';
const CHROME_HIDE_DELAY = 3000;
const DOUBLE_TAP_DELAY = 240;
const DOUBLE_TAP_SEEK_SECONDS = 10;

const safePlayerAction = (player, methodName, ...args) => {
  if (!player || typeof player[methodName] !== 'function') return false;
  try {
    return player[methodName](...args);
  } catch {
    return false;
  }
};

const safePlayerSet = (player, propertyName, value) => {
  if (!player) return false;
  try {
    player[propertyName] = value;
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `Video player "${propertyName}" could not be updated because the native player was already released.`
      );
    }
    return false;
  }
};

const SWIPE_ACTIVATION_DISTANCE = 14;
const HORIZONTAL_DOMINANCE = 1.4;
const SPEED_STEPS = [
  { distance: 150, speed: 2 },
  { distance: 95, speed: 1.5 },
  { distance: 45, speed: 1.25 },
];
const PIXELS_PER_REWIND_SECOND = 10;
const MAX_REWIND_SECONDS = 45;

const getSpeedForDistance = distance => {
  for (let i = 0; i < SPEED_STEPS.length; i += 1) {
    if (distance >= SPEED_STEPS[i].distance) return SPEED_STEPS[i].speed;
  }
  return 1;
};

const isHorizontalSwipe = gestureState => {
  const { dx, dy } = gestureState;
  if (Math.abs(dx) < SWIPE_ACTIVATION_DISTANCE) return false;
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE;
};

const getRewindSeconds = distance => {
  const seconds = Math.round(distance / PIXELS_PER_REWIND_SECOND);
  return Math.max(0, Math.min(MAX_REWIND_SECONDS, seconds));
};

const formatTime = seconds => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const VideoPlayerControls = ({
  player,
  duration,
  theme,
  playbackNotice, // kept for compatibility (unused)
  onManualPlayback,
  muted,
  onMuteChange,
  progressColor,
  centerControlSize = 64,
  showPlaybackControls = true,
  showTopMute: showTopMuteProp,
  showBottomMute = true,
  controlsAlwaysVisible = false,
  centerControlOnPauseOnly = false,
  onVideoPress,
  controlsHidden = false,
  bottomInset = 0,
  enableDoubleTapSeek = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(Boolean(player?.playing));
  const [isMuted, setIsMuted] = useState(Boolean(muted));
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [isGesturing, setIsGesturing] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [gestureIndicator, setGestureIndicator] = useState(null);

  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const centerScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressBarWidth = useRef(SCREEN_WIDTH * 0.7);
  const wasPlayingBeforeSeek = useRef(false);
  const seekTimeRef = useRef(0);
  const hideChromeTimeout = useRef(null);
  const gestureIndicatorTimeout = useRef(null);
  const mounted = useRef(true);

  // ---- Double-tap tracking ----
  const lastTapRef = useRef(0);
  const singleTapTimeout = useRef(null);

  const latestRef = useRef({
    player,
    duration,
    currentTime,
    isPlaying,
    playbackSpeed,
    controlsHidden,
  });

  useEffect(() => {
    latestRef.current = {
      player,
      duration,
      currentTime,
      isPlaying,
      playbackSpeed,
      controlsHidden,
    };
  });

  const gestureRef = useRef({
    mode: null,
    baseTime: 0,
    targetTime: 0,
    baseSpeed: 1,
    appliedSpeed: 1,
    lastRewindSeconds: -1,
    lastShownSpeed: null,
  }).current;

  const clearHideChromeTimeout = () => {
    if (hideChromeTimeout.current) {
      clearTimeout(hideChromeTimeout.current);
      hideChromeTimeout.current = null;
    }
  };

  const animateChrome = toValue => {
    Animated.timing(chromeOpacity, {
      toValue,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const scheduleChromeHide = () => {
    clearHideChromeTimeout();
    if (
      controlsHidden ||
      controlsAlwaysVisible ||
      !latestRef.current.isPlaying ||
      isSeeking ||
      isGesturing
    )
      return;
    hideChromeTimeout.current = setTimeout(() => {
      hideChromeTimeout.current = null;
      if (
        !mounted.current ||
        controlsHidden ||
        controlsAlwaysVisible ||
        isSeeking ||
        isGesturing ||
        !latestRef.current.isPlaying
      )
        return;
      setChromeVisible(false);
      animateChrome(0);
    }, CHROME_HIDE_DELAY);
  };

  const revealChrome = () => {
    clearHideChromeTimeout();
    if (controlsHidden) return;
    setChromeVisible(true);
    animateChrome(1);
    if (
      !controlsAlwaysVisible &&
      latestRef.current.isPlaying &&
      !isSeeking &&
      !isGesturing
    )
      scheduleChromeHide();
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearHideChromeTimeout();
      if (gestureIndicatorTimeout.current)
        clearTimeout(gestureIndicatorTimeout.current);
      if (singleTapTimeout.current) {
        clearTimeout(singleTapTimeout.current);
        singleTapTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    clearHideChromeTimeout();
    if (controlsAlwaysVisible) {
      setChromeVisible(true);
      animateChrome(1);
      return clearHideChromeTimeout;
    }
    if (controlsHidden) {
      setChromeVisible(false);
      animateChrome(0);
      return undefined;
    }
    if (!isPlaying || isSeeking || isGesturing) {
      setChromeVisible(true);
      animateChrome(1);
      return undefined;
    }
    scheduleChromeHide();
    return clearHideChromeTimeout;
  }, [controlsAlwaysVisible, controlsHidden, isPlaying, isSeeking, isGesturing]);

  const clearGestureIndicatorTimeout = () => {
    if (gestureIndicatorTimeout.current) {
      clearTimeout(gestureIndicatorTimeout.current);
      gestureIndicatorTimeout.current = null;
    }
  };

  const hideGestureIndicatorSoon = (delay = 650) => {
    clearGestureIndicatorTimeout();
    gestureIndicatorTimeout.current = setTimeout(() => {
      gestureIndicatorTimeout.current = null;
      if (mounted.current) setGestureIndicator(null);
    }, delay);
  };

  const finishSwipeGesture = () => {
    const mode = gestureRef.mode;
    gestureRef.mode = null;
    setIsGesturing(false);
    if (!mode) return;
    const { player: activePlayer, duration: totalDuration } = latestRef.current;
    if (mode === 'seek' && activePlayer && totalDuration > 0) {
      const target = Math.max(
        0,
        Math.min(totalDuration, gestureRef.targetTime)
      );
      safePlayerSet(activePlayer, 'currentTime', target);
      setCurrentTime(target);
      progressAnim.setValue(target / totalDuration);
    }
    revealChrome();
    hideGestureIndicatorSoon(mode === 'seek' ? 500 : 800);
  };

  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (e, gs) => isHorizontalSwipe(gs),
      onMoveShouldSetPanResponderCapture: (e, gs) => isHorizontalSwipe(gs),
      onPanResponderGrant: () => {
        clearGestureIndicatorTimeout();
        clearHideChromeTimeout();
        revealChrome();
        setIsGesturing(true);
        const { currentTime: timeAtStart, playbackSpeed: speedAtStart } =
          latestRef.current;
        gestureRef.mode = null;
        gestureRef.baseTime = Number.isFinite(timeAtStart) ? timeAtStart : 0;
        gestureRef.targetTime = gestureRef.baseTime;
        gestureRef.baseSpeed = speedAtStart || 1;
        gestureRef.appliedSpeed = speedAtStart || 1;
        gestureRef.lastRewindSeconds = -1;
        gestureRef.lastShownSpeed = null;
      },
      onPanResponderMove: (e, gs) => {
        const mode = gs.dx < 0 ? 'speed' : 'seek';
        gestureRef.mode = mode;
        const distance = Math.abs(gs.dx);
        if (mode === 'speed') {
          const nextSpeed = getSpeedForDistance(distance);
          if (nextSpeed !== gestureRef.appliedSpeed) {
            gestureRef.appliedSpeed = nextSpeed;
            latestRef.current.playbackSpeed = nextSpeed;
            setPlaybackSpeed(nextSpeed);
            safePlayerSet(latestRef.current.player, 'playbackRate', nextSpeed);
          }
          if (nextSpeed !== gestureRef.lastShownSpeed) {
            gestureRef.lastShownSpeed = nextSpeed;
            setGestureIndicator({ type: 'speed', speed: nextSpeed });
          }
          return;
        }
        const totalDuration = latestRef.current.duration || 0;
        const rewindSeconds = getRewindSeconds(distance);
        if (rewindSeconds === gestureRef.lastRewindSeconds) return;
        gestureRef.lastRewindSeconds = rewindSeconds;
        const target = Math.max(
          0,
          Math.min(totalDuration, gestureRef.baseTime - rewindSeconds)
        );
        gestureRef.targetTime = target;
        setGestureIndicator({
          type: 'seek',
          direction: 'back',
          seconds: Math.max(0, Math.round(gestureRef.baseTime - target)),
          targetTime: target,
        });
      },
      onPanResponderRelease: finishSwipeGesture,
      onPanResponderTerminate: finishSwipeGesture,
    })
  ).current;

  useEffect(() => {
    if (!player) return undefined;
    const sub = player.addListener('playingChange', ({ isPlaying: next }) => {
      setIsPlaying(next);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!player) return undefined;
    const sub = player.addListener(
      'timeUpdate',
      ({ currentTime: t, duration: d }) => {
        if (!isSeeking) {
          setCurrentTime(t);
          const total = d || duration;
          if (total > 0) progressAnim.setValue(t / total);
        }
      }
    );
    return () => sub.remove();
  }, [player, duration, isSeeking, progressAnim]);

  useEffect(() => {
    setIsMuted(Boolean(muted));
  }, [muted]);

  useEffect(() => {
    setPlaybackSpeed(1);
    gestureRef.appliedSpeed = 1;
    safePlayerSet(player, 'playbackRate', 1);
    setCurrentTime(0);
    progressAnim.setValue(0);
  }, [player, progressAnim]);

  const togglePlayPause = () => {
    if (!player) return;
    const willPlay = !isPlaying;
    if (willPlay) safePlayerAction(player, 'play');
    else safePlayerAction(player, 'pause');
    setIsPlaying(willPlay);
    onManualPlayback?.(willPlay);
    revealChrome();
    Animated.sequence([
      Animated.spring(centerScale, {
        toValue: 0.92,
        speed: 26,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.spring(centerScale, {
        toValue: 1,
        speed: 20,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleMute = () => {
    const next = !isMuted;
    safePlayerSet(player, 'muted', next);
    setIsMuted(next);
    onMuteChange?.(next);
    revealChrome();
  };

  const handleVideoPress = () => {
    revealChrome();
    if (onVideoPress) onVideoPress();
    else togglePlayPause();
  };

  // ---- Double-tap seek (left = -10s, right = +10s) ----
  const handleDoubleTapSeek = tapX => {
    const activePlayer = latestRef.current.player;
    const totalDuration = latestRef.current.duration || 0;
    if (!activePlayer || totalDuration <= 0) {
      handleVideoPress();
      return;
    }
    const isLeft = tapX < SCREEN_WIDTH / 2;
    const delta = isLeft ? -DOUBLE_TAP_SEEK_SECONDS : DOUBLE_TAP_SEEK_SECONDS;
    const current = Number.isFinite(latestRef.current.currentTime)
      ? latestRef.current.currentTime
      : 0;
    const target = Math.max(0, Math.min(totalDuration, current + delta));
    safePlayerSet(activePlayer, 'currentTime', target);
    setCurrentTime(target);
    progressAnim.setValue(target / totalDuration);
    revealChrome();
    setGestureIndicator({
      type: 'seek',
      direction: isLeft ? 'back' : 'forward',
      seconds: Math.abs(delta),
      targetTime: target,
    });
    hideGestureIndicatorSoon(600);
  };

  // ---- Tap dispatcher (single = play/pause + reveal chrome, double = seek) ----
  const handleGestureTap = event => {
    if (!enableDoubleTapSeek) {
      handleVideoPress();
      return;
    }
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    const nativeEvent = event?.nativeEvent || {};
    const tapX =
      nativeEvent.locationX ?? nativeEvent.pageX ?? SCREEN_WIDTH / 2;

    if (delta < DOUBLE_TAP_DELAY) {
      if (singleTapTimeout.current) {
        clearTimeout(singleTapTimeout.current);
        singleTapTimeout.current = null;
      }
      handleDoubleTapSeek(tapX);
      return;
    }

    if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);
    singleTapTimeout.current = setTimeout(() => {
      singleTapTimeout.current = null;
      if (!mounted.current) return;
      handleVideoPress();
    }, DOUBLE_TAP_DELAY);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const currentProgress =
    duration > 0 ? (isSeeking ? seekTime : currentTime) / duration : 0;
  const displayedTime = isSeeking ? seekTime : currentTime;
  const accent = theme?.primary || theme?.accent || theme?.tint || ACCENT_FALLBACK;
  const seekFill = progressColor || accent;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        revealChrome();
        wasPlayingBeforeSeek.current = isPlaying;
        if (isPlaying && player) safePlayerAction(player, 'pause');
        setIsSeeking(true);
        const touchX = e.nativeEvent.locationX;
        const nextTime = Math.max(
          0,
          Math.min(duration, (touchX / progressBarWidth.current) * duration)
        );
        seekTimeRef.current = nextTime;
        setSeekTime(nextTime);
      },
      onPanResponderMove: e => {
        const touchX = e.nativeEvent.locationX;
        const nextTime = Math.max(
          0,
          Math.min(duration, (touchX / progressBarWidth.current) * duration)
        );
        seekTimeRef.current = nextTime;
        setSeekTime(nextTime);
      },
      onPanResponderRelease: () => {
      if (player && duration > 0) {
        const nextTime = seekTimeRef.current;
        safePlayerSet(player, 'currentTime', nextTime);
          setCurrentTime(nextTime);
          progressAnim.setValue(nextTime / duration);
          if (wasPlayingBeforeSeek.current) safePlayerAction(player, 'play');
        }
        setIsSeeking(false);
        revealChrome();
      },
      onPanResponderTerminate: () => {
        if (player && duration > 0) {
          const nextTime = seekTimeRef.current;
          safePlayerSet(player, 'currentTime', nextTime);
          setCurrentTime(nextTime);
          progressAnim.setValue(nextTime / duration);
          if (wasPlayingBeforeSeek.current) safePlayerAction(player, 'play');
        }
        setIsSeeking(false);
        revealChrome();
      },
    })
  ).current;

  const centerControl =
    !isSeeking &&
    (!centerControlOnPauseOnly || !isPlaying) && (
      <Animated.View
        style={[
          styles.centerControlPosition,
          {
            width: centerControlSize,
            height: centerControlSize,
            borderRadius: centerControlSize / 2,
            marginLeft: -centerControlSize / 2,
            marginTop: -centerControlSize / 2,
            transform: [{ scale: centerScale }],
          },
        ]}
        pointerEvents={chromeVisible && !controlsHidden ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.centerControlButton}
          onPress={togglePlayPause}
          onPressIn={() =>
            Animated.spring(centerScale, {
              toValue: 0.92,
              speed: 26,
              bounciness: 4,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(centerScale, {
              toValue: 1,
              speed: 20,
              bounciness: 5,
              useNativeDriver: true,
            }).start()
          }
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={centerControlSize * 0.42}
            color="#ffffff"
            style={isPlaying ? undefined : { marginLeft: 3 }}
          />
        </TouchableOpacity>
      </Animated.View>
    );

  const muteButton = (style, iconSize = 18) => (
    <TouchableOpacity
      onPress={toggleMute}
      style={[styles.muteButton, style]}
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
    >
      <Ionicons
        name={isMuted ? 'volume-mute' : 'volume-high'}
        size={iconSize}
        color="#ffffff"
      />
    </TouchableOpacity>
  );

  const showTopMute = showTopMuteProp ?? !showPlaybackControls;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={styles.gestureLayer}
        pointerEvents={controlsHidden ? 'none' : 'auto'}
        {...swipePanResponder.panHandlers}
      >
        <TouchableWithoutFeedback onPress={handleGestureTap}>
          <View style={styles.tapArea} />
        </TouchableWithoutFeedback>
      </View>

      {gestureIndicator && (
        <View style={styles.gestureIndicatorContainer} pointerEvents="none">
          <View style={styles.gestureIndicatorBubble}>
            <Ionicons
              name={
                gestureIndicator.type === 'speed'
                  ? 'play-forward'
                  : gestureIndicator.direction === 'forward'
                    ? 'play-forward'
                    : 'play-back'
              }
              size={20}
              color="#ffffff"
            />
            <Text style={styles.gestureIndicatorText}>
              {gestureIndicator.type === 'speed'
                ? `${gestureIndicator.speed}x`
                : `${gestureIndicator.direction === 'forward' ? '+' : '-'}${gestureIndicator.seconds}s`}
            </Text>
          </View>
          {gestureIndicator.type === 'seek' && (
            <Text style={styles.gestureIndicatorSubText}>
              {formatTime(gestureIndicator.targetTime)}
            </Text>
          )}
        </View>
      )}

      <Animated.View
        pointerEvents={chromeVisible ? 'box-none' : 'none'}
        style={[styles.chromeLayer, { opacity: chromeOpacity }]}
      >
        {showTopMute && (
          <View style={styles.topMuteContainer}>{muteButton()}</View>
        )}

        {centerControl}

        {showPlaybackControls && (
          <View
            style={[
              styles.bottomBarPosition,
              { bottom: 12 + (bottomInset || 0) },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.bottomPill}>
              {showBottomMute && muteButton(styles.bottomMuteButton, 17)}
              <View
                style={styles.progressBarWrapper}
                onLayout={e => {
                  progressBarWidth.current = e.nativeEvent.layout.width;
                }}
                {...panResponder.panHandlers}
              >
                <View style={styles.progressBarBackground}>
                  <View style={styles.progressTrack}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: isSeeking
                            ? `${
                                duration > 0
                                  ? (seekTime / duration) * 100
                                  : 0
                              }%`
                            : progressWidth,
                          backgroundColor: seekFill,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.sliderThumb,
                      {
                        left: `${Math.max(
                          0,
                          Math.min(1, currentProgress)
                        ) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text
                style={styles.timeText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatTime(displayedTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 12, elevation: 12 },
  gestureLayer: { ...StyleSheet.absoluteFillObject },
  tapArea: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  chromeLayer: { ...StyleSheet.absoluteFillObject, zIndex: 14, elevation: 14 },

  topMuteContainer: { position: 'absolute', top: 12, right: 14 },

  muteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 12, 14, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 4,
  },

  centerControlPosition: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 18,
  },
  centerControlButton: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,18,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  bottomBarPosition: { position: 'absolute', left: 12, right: 12 },
  bottomPill: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 30,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 28,
    backgroundColor: 'rgba(12, 14, 18, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 6,
  },
  bottomMuteButton: {
    width: 40,
    height: 40,
    borderWidth: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    flexShrink: 0,
  },
  progressBarWrapper: { flex: 1, minWidth: 50, height: 32, justifyContent: 'center' },
  progressBarBackground: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12,
  },
  progressTrack: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  progressBarFill: { height: '100%', borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: '100%',
    marginTop: -20,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  timeText: {
    minWidth: 92,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    textAlign: 'right',
    flexShrink: 0,
  },

  gestureIndicatorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  gestureIndicatorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  gestureIndicatorText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  gestureIndicatorSubText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.9,
  },
});

export default VideoPlayerControls;