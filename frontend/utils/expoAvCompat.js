const React = require('react');
const { forwardRef, useEffect, useImperativeHandle, useRef } = React;
const { Image, View } = require('react-native');

const loadExpoAv = () => {
  try {
    return require('expo-av');
  } catch (error) {
    return null;
  }
};

const expoAv = loadExpoAv();

const fallbackResizeMode = {
  COVER: 'cover',
  CONTAIN: 'contain',
  STRETCH: 'stretch',
};

const createFallbackSound = () => {
  let status = {
    isLoaded: true,
    isPlaying: false,
    isBuffering: false,
    didJustFinish: false,
    isMuted: false,
    positionMillis: 0,
    durationMillis: 0,
    error: null,
  };
  let playbackCallback = null;

  const notify = (nextStatus) => {
    status = { ...status, ...nextStatus };
    if (typeof playbackCallback === 'function') {
      playbackCallback(status);
    }
  };

  return {
    playAsync: async () => {
      notify({ isPlaying: true, isBuffering: false });
      return { status: { ...status } };
    },
    pauseAsync: async () => {
      notify({ isPlaying: false, isBuffering: false });
      return { status: { ...status } };
    },
    stopAsync: async () => {
      notify({ isPlaying: false, isBuffering: false, didJustFinish: true });
      return { status: { ...status } };
    },
    unloadAsync: async () => {
      notify({ isLoaded: false, isPlaying: false, isBuffering: false });
      return { status: { ...status } };
    },
    setOnPlaybackStatusUpdate: (callback) => {
      playbackCallback = callback;
    },
    setIsMutedAsync: async (nextMuted) => {
      notify({ isMuted: Boolean(nextMuted) });
      return { status: { ...status } };
    },
    setPositionAsync: async (positionMillis) => {
      notify({ positionMillis });
      return { status: { ...status } };
    },
    getStatusAsync: async () => ({ ...status }),
  };
};

const Audio = expoAv?.Audio || {
  Sound: {
    createAsync: async () => ({
      sound: createFallbackSound(),
    }),
  },
};

const FallbackVideo = forwardRef((props, ref) => {
  const {
    source,
    style,
    resizeMode = 'contain',
    shouldPlay = false,
    isLooping = false,
    isMuted = false,
    progressUpdateIntervalMillis = 250,
    onPlaybackStatusUpdate,
    ...rest
  } = props;

  const statusRef = useRef({
    isLoaded: true,
    isPlaying: Boolean(shouldPlay),
    isBuffering: false,
    didJustFinish: false,
    isMuted: Boolean(isMuted),
    positionMillis: 0,
    durationMillis: 0,
    error: null,
  });

  const notify = (nextStatus) => {
    statusRef.current = { ...statusRef.current, ...nextStatus };
    if (typeof onPlaybackStatusUpdate === 'function') {
      onPlaybackStatusUpdate(statusRef.current);
    }
  };

  useEffect(() => {
    notify({ isPlaying: Boolean(shouldPlay), isMuted: Boolean(isMuted), isLooping: Boolean(isLooping) });
  }, [shouldPlay, isMuted, isLooping]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => notify({ isPlaying: true, isBuffering: false }),
    pauseAsync: async () => notify({ isPlaying: false, isBuffering: false }),
    stopAsync: async () => notify({ isPlaying: false, didJustFinish: true }),
    setIsMutedAsync: async (nextMuted) => notify({ isMuted: Boolean(nextMuted) }),
    setPositionAsync: async (nextPosition) => notify({ positionMillis: Number(nextPosition) || 0 }),
    unloadAsync: async () => notify({ isLoaded: false, isPlaying: false, isBuffering: false }),
    getStatusAsync: async () => ({ ...statusRef.current }),
  }));

  const resolvedSource = typeof source === 'object' ? source?.uri : source;

  if (!resolvedSource) {
    return React.createElement(View, { style, ...rest });
  }

  return React.createElement(Image, {
    source: { uri: resolvedSource },
    style,
    resizeMode,
    ...rest,
  });
});

const Video = forwardRef((props, ref) => {
  if (expoAv?.Video) {
    return React.createElement(expoAv.Video, { ...props, ref });
  }

  return React.createElement(FallbackVideo, { ...props, ref });
});

const ResizeMode = expoAv?.ResizeMode || fallbackResizeMode;

module.exports = {
  Audio,
  Video,
  ResizeMode,
};
