import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ------------------------------------------------------------------ *
 *  Safe player helpers
 * ------------------------------------------------------------------ */

const safePlayerAction = (player, methodName, ...args) => {
  if (!player || typeof player[methodName] !== 'function') return false;

  try {
    return player[methodName](...args);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `Video player ${methodName} skipped because the native player was already released.`
      );
    }
    return false;
  }
};

/**
 * Safely set a *property* (not a method) on the native player object,
 * e.g. `player.currentTime = 12` or `player.playbackRate = 1.5`.
 */
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

/* ------------------------------------------------------------------ *
 *  Horizontal swipe configuration
 * ------------------------------------------------------------------ */

/** Minimum horizontal travel (px) before a swipe is recognised. */
const SWIPE_ACTIVATION_DISTANCE = 14;

/** |dx| has to beat |dy| by this factor for the gesture to be "horizontal". */
const HORIZONTAL_DOMINANCE = 1.4;

/** Swipe LEFT → faster playback (checked from largest distance down). */
const SPEED_STEPS = [
  { distance: 150, speed: 2 },
  { distance: 95, speed: 1.5 },
  { distance: 45, speed: 1.25 },
];

const getSpeedForDistance = (distance) => {
  for (let i = 0; i < SPEED_STEPS.length; i += 1) {
    if (distance >= SPEED_STEPS[i].distance) return SPEED_STEPS[i].speed;
  }
  return 1;
};

const isHorizontalSwipe = (gestureState) => {
  const { dx, dy } = gestureState;
  if (Math.abs(dx) < SWIPE_ACTIVATION_DISTANCE) return false;
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE;
};

/** Swipe RIGHT → rewind. */
const PIXELS_PER_REWIND_SECOND = 10;
const MAX_REWIND_SECONDS = 45;

const getRewindSeconds = (distance) => {
  const seconds = Math.round(distance / PIXELS_PER_REWIND_SECOND);
  return Math.max(0, Math.min(MAX_REWIND_SECONDS, seconds));
};

const formatSpeed = (speed) => `${speed}x`;

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */

const VideoPlayerControls = ({
  player,
  duration,
  theme,
  playbackNotice,
  onManualPlayback,
  muted,
  onMuteChange,
  progressColor = '#fff',
  centerControlSize = 48,
  showPlaybackControls = true,
  onVideoPress,
}) => {
  const [isPlaying, setIsPlaying] = useState(true); // Default to playing
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  /* --- new state for the swipe gestures --------------------------- */
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [gestureIndicator, setGestureIndicator] = useState(null);

  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressBarWidth = useRef(SCREEN_WIDTH * 0.7);
  const wasPlayingBeforeSeek = useRef(false);
  const seekTimeRef = useRef(0);

  /* -----------------------------------------------------------------
   * Latest-value ref.
   * The PanResponder is created exactly once (useRef below), so it can
   * only read props/state through refs.
   * ----------------------------------------------------------------- */
  const latestRef = useRef({
    player,
    duration,
    currentTime,
    isPlaying,
    playbackSpeed,
  });

  useEffect(() => {
    latestRef.current = { player, duration, currentTime, isPlaying, playbackSpeed };
  });

  /* Mutable bookkeeping for the currently active swipe gesture. */
  const gestureRef = useRef({
    mode: null, // 'speed' | 'seek' | null
    baseTime: 0, // playback position when the gesture started
    targetTime: 0, // position we will jump to for a rewind
    baseSpeed: 1, // speed when the gesture started
    appliedSpeed: 1, // last speed pushed to the player
    lastRewindSeconds: -1, // last value rendered in the badge
  }).current;

  const hideIndicatorTimeout = useRef(null);

  /* Clean the pending timeout on unmount. */
  useEffect(
    () => () => {
      if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
    },
    []
  );

  /* -----------------------------------------------------------------
   * Gesture badge helpers
   * ----------------------------------------------------------------- */
  const clearGestureIndicatorTimeout = () => {
    if (hideIndicatorTimeout.current) {
      clearTimeout(hideIndicatorTimeout.current);
      hideIndicatorTimeout.current = null;
    }
  };

  const hideGestureIndicatorSoon = (delay = 650) => {
    clearGestureIndicatorTimeout();
    hideIndicatorTimeout.current = setTimeout(() => {
      hideIndicatorTimeout.current = null;
      setGestureIndicator(null);
    }, delay);
  };

  /**
   * Applies whatever the active swipe gesture produced.
   * Runs on both `release` and `terminate` so a cancelled gesture never
   * leaves the player in a weird state.
   */
  const finishSwipeGesture = () => {
    const mode = gestureRef.mode;
    gestureRef.mode = null;

    if (!mode) return;

    const { player: activePlayer, duration: totalDuration } = latestRef.current;

    if (mode === 'seek' && activePlayer && totalDuration > 0) {
      const target = Math.max(0, Math.min(totalDuration, gestureRef.targetTime));
      safePlayerSet(activePlayer, 'currentTime', target);
      setCurrentTime(target);
      progressAnim.setValue(target / totalDuration);
    }

    // Keep the badge visible for a beat so the user can read the value.
    hideGestureIndicatorSoon(mode === 'seek' ? 500 : 800);
  };

  /* -----------------------------------------------------------------
   * Horizontal swipe responder (swipe left = speed, swipe right = rewind)
   * ----------------------------------------------------------------- */
  const swipePanResponder = useRef(
    PanResponder.create({
      /* Never claim the touch on press → taps keep working. */
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      /* Only claim once the movement is clearly horizontal. */
      onMoveShouldSetPanResponder: (evt, gestureState) => isHorizontalSwipe(gestureState),
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => isHorizontalSwipe(gestureState),

      onPanResponderGrant: (evt, gestureState) => {
        clearGestureIndicatorTimeout();

        const { currentTime: timeAtStart, playbackSpeed: speedAtStart } = latestRef.current;

        gestureRef.mode = gestureState.dx < 0 ? 'speed' : 'seek';
        gestureRef.baseTime = Number.isFinite(timeAtStart) ? timeAtStart : 0;
        gestureRef.targetTime = gestureRef.baseTime;
        gestureRef.baseSpeed = speedAtStart || 1;
        gestureRef.appliedSpeed = speedAtStart || 1;
        gestureRef.lastRewindSeconds = -1;
      },

      onPanResponderMove: (evt, gestureState) => {
        const mode = gestureRef.mode;
        if (!mode) return;

        const distance = Math.abs(gestureState.dx);

        /* ---------------- swipe LEFT → playback speed ---------------- */
        if (mode === 'speed') {
          const nextSpeed = getSpeedForDistance(distance);
          if (nextSpeed === gestureRef.appliedSpeed) return;

          gestureRef.appliedSpeed = nextSpeed;
          latestRef.current.playbackSpeed = nextSpeed;

          setPlaybackSpeed(nextSpeed);
          safePlayerSet(latestRef.current.player, 'playbackRate', nextSpeed);
          setGestureIndicator({ type: 'speed', speed: nextSpeed });
          return;
        }

        /* ---------------- swipe RIGHT → rewind ----------------------- */
        const totalDuration = latestRef.current.duration || 0;
        const rewindSeconds = getRewindSeconds(distance);
        if (rewindSeconds === gestureRef.lastRewindSeconds) return;

        gestureRef.lastRewindSeconds = rewindSeconds;

        const target = Math.max(0, Math.min(totalDuration, gestureRef.baseTime - rewindSeconds));
        gestureRef.targetTime = target;

        setGestureIndicator({
          type: 'seek',
          seconds: Math.max(0, Math.round(gestureRef.baseTime - target)),
          targetTime: target,
        });
      },

      onPanResponderRelease: () => {
        finishSwipeGesture();
      },

      onPanResponderTerminate: () => {
        finishSwipeGesture();
      },
    })
  ).current;

  /* -----------------------------------------------------------------
   * Existing behaviour (unchanged)
   * ----------------------------------------------------------------- */

  // Sync isPlaying with player state
  useEffect(() => {
    if (!player) return;
    const subscription = player.addListener('playingChange', ({ isPlaying }) => {
      setIsPlaying(isPlaying);
    });
    return () => subscription.remove();
  }, [player]);

  // Listen to time updates
  useEffect(() => {
    if (!player) return;
    const timeSubscription = player.addListener(
      'timeUpdate',
      ({ currentTime: time, duration: currentDuration }) => {
        if (!isSeeking) {
          setCurrentTime(time);

          // Update progress bar
          if (currentDuration > 0) {
            const progress = time / currentDuration;
            progressAnim.setValue(progress);
          }
        }
      }
    );
    return () => timeSubscription.remove();
  }, [player, progressAnim, isSeeking]);

  // Sync muted state with prop
  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  // Reset playback speed whenever a new player (new post/video) arrives.
  useEffect(() => {
    setPlaybackSpeed(1);
    gestureRef.appliedSpeed = 1;
    safePlayerSet(player, 'playbackRate', 1);
  }, [player]);

  // Show playback indicator when playbackNotice changes
  useEffect(() => {
    if (playbackNotice > 0) {
      setShowIndicator(true);
      indicatorOpacity.setValue(1);
      Animated.timing(indicatorOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
        delay: 400,
      }).start(() => setShowIndicator(false));
    }
  }, [playbackNotice, indicatorOpacity]);

  const togglePlayPause = () => {
    if (!player) return;

    const willPlay = !isPlaying;
    if (willPlay) {
      safePlayerAction(player, 'play');
    } else {
      safePlayerAction(player, 'pause');
    }
    setIsPlaying(willPlay);
    onManualPlayback(willPlay);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onMuteChange(newMuted);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const remainingTime =
    duration > 0 ? Math.max(0, duration - (isSeeking ? seekTime : currentTime)) : 0;

  // Progress bar width interpolation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Pan responder for seeking (progress bar) — unchanged
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Remember if video was playing before seeking
        wasPlayingBeforeSeek.current = isPlaying;
        // Pause video while seeking
        if (isPlaying && player) {
          safePlayerAction(player, 'pause');
        }
        setIsSeeking(true);
        const touchX = evt.nativeEvent.locationX;
        const newTime = (touchX / progressBarWidth.current) * duration;
        const nextTime = Math.max(0, Math.min(duration, newTime));
        seekTimeRef.current = nextTime;
        setSeekTime(nextTime);
      },
      onPanResponderMove: (evt) => {
        if (isSeeking) {
          const touchX = evt.nativeEvent.locationX;
          const newTime = (touchX / progressBarWidth.current) * duration;
          const nextTime = Math.max(0, Math.min(duration, newTime));
          seekTimeRef.current = nextTime;
          setSeekTime(nextTime);
        }
      },
      onPanResponderRelease: () => {
        if (player && duration > 0) {
          // Set video to seeked position
          const nextTime = seekTimeRef.current;
          try {
            player.currentTime = nextTime;
          } catch (error) {
            // Native player may already be released during teardown.
          }
          setCurrentTime(nextTime);
          progressAnim.setValue(nextTime / duration);

          // Resume playback if it was playing before
          if (wasPlayingBeforeSeek.current) {
            safePlayerAction(player, 'play');
          }
        }
        setIsSeeking(false);
      },
      onPanResponderTerminate: () => {
        if (player && duration > 0) {
          // Set video to seeked position
          const nextTime = seekTimeRef.current;
          try {
            player.currentTime = nextTime;
          } catch (error) {
            // Native player may already be released during teardown.
          }
          setCurrentTime(nextTime);
          progressAnim.setValue(nextTime / duration);

          // Resume playback if it was playing before
          if (wasPlayingBeforeSeek.current) {
            safePlayerAction(player, 'play');
          }
        }
        setIsSeeking(false);
      },
    })
  ).current;

  // Calculate current progress (0-1)
  const currentProgress =
    duration > 0 ? (isSeeking ? seekTime : currentTime) / duration : 0;

  const muteControl = (
    <View style={styles.topRightContainer} pointerEvents="box-none">
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.muteButton}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
      >
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (!showPlaybackControls) {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={onVideoPress}>
          <View style={styles.tapArea} />
        </TouchableWithoutFeedback>
        {muteControl}
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/*
        Swipe layer.
        Wrapping the tap area in its own View keeps the PanResponder
        handlers separate from the TouchableWithoutFeedback handlers
        (TouchableWithoutFeedback clones its child and would otherwise
        overwrite the pan handlers).
      */}
      <View style={styles.gestureLayer} {...swipePanResponder.panHandlers}>
        {/* Full screen tap area for play/pause */}
        <TouchableWithoutFeedback onPress={onVideoPress || togglePlayPause}>
          <View style={styles.tapArea} />
        </TouchableWithoutFeedback>
      </View>

      {/* ---------------- Swipe gesture badge (centre) ---------------- */}
      {gestureIndicator && (
        <View style={styles.gestureIndicatorContainer} pointerEvents="none">
          <View style={styles.gestureIndicatorBubble}>
            <Ionicons
              name={gestureIndicator.type === 'speed' ? 'play-forward' : 'play-back'}
              size={20}
              color="#fff"
            />
            <Text style={styles.gestureIndicatorText}>
              {gestureIndicator.type === 'speed'
                ? formatSpeed(gestureIndicator.speed)
                : `-${gestureIndicator.seconds}s`}
            </Text>
          </View>
          {gestureIndicator.type === 'seek' && (
            <Text style={styles.gestureIndicatorSubText}>
              {formatTime(gestureIndicator.targetTime)}
            </Text>
          )}
        </View>
      )}

      {/* ---------------- Mute / Unmute — top right ---------------- */}
      {muteControl}

      {/* Playback Indicator Overlay */}
      {showIndicator && (
        <Animated.View
          style={[styles.indicatorOverlay, { opacity: indicatorOpacity }]}
          pointerEvents="none"
        >
          <Ionicons name={isPlaying ? 'play' : 'pause'} size={48} color="#fff" />
        </Animated.View>
      )}

      {/* Center Play Button when paused */}
      {!isSeeking && (
        <TouchableOpacity
          style={[
            styles.centerControlButton,
            {
              width: centerControlSize,
              height: centerControlSize,
              borderRadius: centerControlSize / 2,
              marginLeft: -centerControlSize / 2,
              marginTop: -centerControlSize / 2,
            },
          ]}
          onPress={togglePlayPause}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={centerControlSize * 0.48} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Seek time indicator */}
      {isSeeking && (
        <View style={styles.seekTimeContainer} pointerEvents="none">
          <Text style={styles.seekTimeText}>
            {formatTime(seekTime)} / {formatTime(duration)}
          </Text>
        </View>
      )}

      {/* Bottom Controls Container - No background */}
      <View style={styles.bottomContainer} pointerEvents="box-none">
        {/* Bottom Row: Progress Bar - Time */}
        <View style={styles.controlsRow} pointerEvents="box-none">
          {/* Spacer keeps the progress bar exactly where it was before
              the mute button moved to the top-right corner. */}
          <View style={styles.muteButtonSpacer} pointerEvents="none" />

          {/* Progress Bar (70% width) */}
          <View
            style={styles.progressBarWrapper}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              progressBarWidth.current = width;
            }}
          >
            <View style={styles.progressBarBackground} {...panResponder.panHandlers}>
              {/* Progress bar track */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: isSeeking
                        ? `${(seekTime / duration) * 100}%`
                        : progressWidth,
                      backgroundColor: progressColor,
                    },
                  ]}
                />
              </View>

              {/* Slider thumb - White color */}
              <View
                style={[
                  styles.sliderThumb,
                  {
                    left: isSeeking
                      ? `${(seekTime / duration) * 100}%`
                      : `${currentProgress * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Remaining Time */}
          <Text style={styles.remainingTimeText}>-{formatTime(remainingTime)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 12,
    elevation: 12,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  /* ---------------- top-right mute button ---------------- */
  topRightContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    elevation: 20,
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },

  /* ---------------- swipe gesture badge ---------------- */
  gestureIndicatorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 18,
    elevation: 18,
  },
  gestureIndicatorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  gestureIndicatorText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
  gestureIndicatorSubText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.9,
  },

  /* ---------------- existing overlays ---------------- */
  indicatorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  centerControlButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 14,
    elevation: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  muteButtonSpacer: {
    width: 34,
    height: 34,
    marginRight: 8,
  },
  progressBarWrapper: {
    flex: 1,
    maxWidth: '80%',
    marginHorizontal: -35,
  },
  progressBarBackground: {
    height: 3, // Larger touch area
    justifyContent: 'center',
    position: 'relative',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgb(255, 255, 255)', // Semi-transparent white track
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    // backgroundColor set inline to #fff (white)
  },
  sliderThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff', // White thumb
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    top: '50%',
    marginTop: -7,
  },
  seekTimeContainer: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 20,
  },
  seekTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  remainingTimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 90,
    minWidth: 50,
    
  },
});

export default VideoPlayerControls;