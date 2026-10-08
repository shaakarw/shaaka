import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Video } from '../utils/expoAvCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

/* -------------------------------------------------------------------------- */
/*                                   CONFIG                                   */
/* -------------------------------------------------------------------------- */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT_FALLBACK = '#47ae87';

const LABELS = {
  English: {
    video: 'Video',
    photo: 'Photo',
    videoError: 'Unable to play this video',
    imageUnavailable: 'Image unavailable',
  },
  Kinyarwanda: {
    video: 'Video',
    photo: 'Ifoto',
    videoError: 'Video ntishobora gucuranga',
    imageUnavailable: 'Ifoto ntiboneka',
  },
};

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const getImageSource = image => {
  if (!image) return null;
  if (typeof image === 'string') return { uri: image };
  if (typeof image === 'object' && image.uri) return { uri: image.uri };
  if (typeof image === 'object' && image.url) return { uri: image.url };
  return image;
};

const getMediaUri = media => {
  if (!media) return null;
  if (typeof media === 'string') return media;
  return media.uri || media.url || null;
};

const isVideoMedia = media => {
  if (!media) return false;
  if (typeof media === 'object' && media.type) {
    return String(media.type).toLowerCase() === 'video';
  }
  const uri = getMediaUri(media) || '';
  if (!uri) return false;
  if (/\.(mp4|mov|webm|m4v|3gp|mkv|m3u8)(\?.*)?$/i.test(uri)) return true;
  return /video\//i.test(uri) || /\/video\//i.test(uri);
};

const formatTime = millis => {
  const total = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const clamp01 = value => Math.max(0, Math.min(1, value));

/* -------------------------------------------------------------------------- */
/*                              VIDEO PLAYER ITEM                             */
/* -------------------------------------------------------------------------- */

const VideoPreview = ({
  uri,
  posterSource,
  isActive,
  isMuted,
  accent,
  bottomInset = 0,
  chromeVisible = true,
  onToggleChrome,
  onToggleMute,
  labels,
}) => {
  const videoRef = useRef(null);
  const hasFrameRef = useRef(false);

  const [status, setStatus] = useState(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  const duration = status?.durationMillis || 0;
  const position = scrubbing ? scrubPosition : status?.positionMillis || 0;
  const progress = duration > 0 ? clamp01(position / duration) : 0;
  const isPlaying = Boolean(status?.isPlaying);
  const isLoading =
    isActive && !failed && (!status?.isLoaded || Boolean(status?.isBuffering));

  /* --------------------------- playback status --------------------------- */
  const handleStatus = useCallback(next => {
    setStatus(next);
    if (next?.error) {
      setFailed(true);
      return;
    }
    if (
      next?.isLoaded &&
      !hasFrameRef.current &&
      (next.isPlaying || (next.positionMillis || 0) > 80)
    ) {
      hasFrameRef.current = true;
      setHasFrame(true);
    }
  }, []);

  /* --------------------- reset when it goes off-screen -------------------- */
  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    if (!isActive) {
      player.pauseAsync().catch(() => {});
      player.setPositionAsync(0).catch(() => {});
      hasFrameRef.current = false;
      setHasFrame(false);
      setScrubbing(false);
      setScrubPosition(0);
    }
  }, [isActive]);

  /* ------------------------------- actions ------------------------------- */
  const togglePlay = useCallback(async () => {
    const player = videoRef.current;
    if (!player) return;
    try {
      if (isPlaying) {
        await player.pauseAsync();
      } else {
        await player.playAsync();
      }
    } catch (e) {
      /* ignore */
    }
  }, [isPlaying]);

  const seekTo = useCallback(
    async ratio => {
      const player = videoRef.current;
      if (!player || !duration) return;
      try {
        await player.setPositionAsync(clamp01(ratio) * duration);
      } catch (e) {
        /* ignore */
      }
    },
    [duration],
  );

  /* ------------------------------ scrub bar ------------------------------ */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          if (!duration || !barWidth) return;
          setScrubbing(true);
          setScrubPosition(
            clamp01(event.nativeEvent.locationX / barWidth) * duration,
          );
        },
        onPanResponderMove: event => {
          if (!duration || !barWidth) return;
          setScrubPosition(
            clamp01(event.nativeEvent.locationX / barWidth) * duration,
          );
        },
        onPanResponderRelease: event => {
          if (!duration || !barWidth) {
            setScrubbing(false);
            return;
          }
          const ratio = clamp01(event.nativeEvent.locationX / barWidth);
          setScrubPosition(ratio * duration);
          setScrubbing(false);
          seekTo(ratio);
        },
        onPanResponderTerminate: () => setScrubbing(false),
      }),
    [barWidth, duration, seekTo],
  );

  /* -------------------------------- render ------------------------------- */
  return (
    <View style={styles.videoContainer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onToggleChrome}>
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri }}
          resizeMode="contain"
          shouldPlay={isActive}
          isLooping
          isMuted={isMuted}
          progressUpdateIntervalMillis={200}
          onPlaybackStatusUpdate={handleStatus}
          useNativeControls={false}
        />
      </Pressable>

      {/* Poster / thumbnail until the first frame is rendered */}
      {posterSource && !hasFrame && (
        <Image
          source={posterSource}
          style={styles.videoPoster}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}

      {/* Loader */}
      {isLoading && !hasFrame && (
        <View style={styles.videoCenter} pointerEvents="none">
          <ActivityIndicator color="#ffffff" size="large" />
        </View>
      )}

      {/* Error */}
      {failed && (
        <View style={styles.videoCenter} pointerEvents="none">
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.videoErrorText}>{labels.videoError}</Text>
        </View>
      )}

      {/* Big play button when paused */}
      {!isPlaying && !isLoading && !failed && (
        <Pressable style={styles.centerPlayButton} onPress={togglePlay}>
          <Ionicons
            name="play"
            size={36}
            color="#ffffff"
            style={styles.centerPlayIcon}
          />
        </Pressable>
      )}

      {/* Control bar */}
      {chromeVisible && !failed && (
        <View
          style={[styles.videoControls, { bottom: bottomInset + 14 }]}
          pointerEvents="box-none"
        >
          <View style={styles.videoControlsRow}>
            <TouchableOpacity
              onPress={togglePlay}
              hitSlop={10}
              style={styles.videoControlButton}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={16}
                color="#ffffff"
              />
            </TouchableOpacity>

            <Text style={styles.videoTime}>{formatTime(position)}</Text>

            <View
              style={styles.progressTrackWrap}
              onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
              {...panResponder.panHandlers}
            >
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%`, backgroundColor: accent },
                  ]}
                />
              </View>
              {barWidth > 0 && (
                <View
                  style={[
                    styles.progressKnob,
                    { left: progress * barWidth - 6 },
                  ]}
                />
              )}
            </View>

            <Text style={styles.videoTime}>{formatTime(duration)}</Text>

            <TouchableOpacity
              onPress={onToggleMute}
              hitSlop={10}
              style={styles.videoControlButton}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={16}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                               PREVIEW SCREEN                               */
/* -------------------------------------------------------------------------- */

const PreviewScreen = ({ route, navigation, language = 'English' }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const accent =
    theme?.primary || theme?.accent || theme?.tint || ACCENT_FALLBACK;
  const labels = LABELS[language] || LABELS.English;

  const {
    imageUri,
    images: routeImages,
    videoThumbnail,
    listing,
    initialIndex = 0,
  } = route.params || {};

  /* ------------------------------ normalise ------------------------------ */
  const media = useMemo(() => {
    const raw =
      Array.isArray(routeImages) && routeImages.length
        ? routeImages
        : [imageUri];

    return raw
      .map(item => {
        if (!item) return null;
        const uri = getMediaUri(item);
        if (!uri) return null;

        const type = isVideoMedia(item) ? 'video' : 'image';
        const thumbnail =
          (typeof item === 'object' &&
            (item.thumbnail || item.poster || item.thumb)) ||
          videoThumbnail ||
          listing?.thumbnail ||
          null;

        return { uri, type, thumbnail };
      })
      .filter(Boolean);
  }, [imageUri, routeImages, videoThumbnail, listing]);

  const safeInitialIndex = Math.min(
    Math.max(0, Number(initialIndex) || 0),
    Math.max(0, media.length - 1),
  );

  /* -------------------------------- state -------------------------------- */
  const [index, setIndex] = useState(safeInitialIndex);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mediaHeight, setMediaHeight] = useState(0);

  const listRef = useRef(null);

  const current = media[index];
  const showChrome = chromeVisible && !immersive;

  /* ------------------------------ navigation ----------------------------- */
  const goTo = useCallback(
    nextIndex => {
      if (nextIndex < 0 || nextIndex >= media.length) return;
      setIndex(nextIndex);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    },
    [media.length],
  );

  const onMomentumScrollEnd = useCallback(event => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(prev => (prev === next ? prev : next));
  }, []);

  const onScrollToIndexFailed = useCallback(info => {
    listRef.current?.scrollToOffset({
      offset: info.index * SCREEN_WIDTH,
      animated: false,
    });
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 80);
  }, []);

  /* -------------------------------- render ------------------------------- */
  const renderItem = useCallback(
    ({ item, index: itemIndex }) => {
      const isActive = itemIndex === index;
      const posterSource = getImageSource(item.thumbnail);
      const backdropSource =
        item.type === 'video' ? posterSource : getImageSource(item.uri);

      return (
        <View
          style={[
            styles.page,
            {
              width: SCREEN_WIDTH,
              height: mediaHeight || SCREEN_HEIGHT,
            },
          ]}
        >
          {backdropSource && (
            <Image
              source={backdropSource}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}
          {backdropSource && (
            <BlurView
              pointerEvents="none"
              intensity={70}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={styles.backdropShade} pointerEvents="none" />

          {item.type === 'video' ? (
            <VideoPreview
              uri={item.uri}
              posterSource={posterSource}
              isActive={isActive}
              isMuted={muted}
              accent={accent}
              labels={labels}
              bottomInset={insets.bottom}
              chromeVisible={showChrome}
              onToggleChrome={() => setChromeVisible(v => !v)}
              onToggleMute={() => setMuted(v => !v)}
            />
          ) : (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setChromeVisible(v => !v)}
            >
              <Image
                source={getImageSource(item.uri)}
                style={styles.image}
                resizeMode="contain"
              />
            </Pressable>
          )}
        </View>
      );
    },
    [
      accent,
      index,
      labels,
      mediaHeight,
      muted,
      insets.bottom,
      showChrome,
    ],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* ------------------------------ MEDIA ------------------------------ */}
      <View
        style={styles.mediaSection}
        onLayout={event => setMediaHeight(event.nativeEvent.layout.height)}
      >
        {media.length ? (
          <FlatList
            ref={listRef}
            style={styles.mediaList}
            data={media}
            horizontal
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={safeInitialIndex}
            keyExtractor={(item, i) => `${item.uri}-${i}`}
            getItemLayout={(_, i) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * i,
              index: i,
            })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollToIndexFailed={onScrollToIndexFailed}
            renderItem={renderItem}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="image-outline"
              size={44}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.emptyText}>{labels.imageUnavailable}</Text>
          </View>
        )}
      </View>

      {/* ------------------------------ HEADER ----------------------------- */}
      {showChrome && (
        <View
          style={[styles.header, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
         

          <View style={styles.headerCenter} pointerEvents="none">
            <View style={styles.badge}>
              {current?.type === 'video' ? (
                <>
                  <Ionicons name="videocam" size={11} color="#ffffff" />
                  <Text style={styles.badgeText}>{labels.video}</Text>
                </>
              ) : (
                <Text style={styles.badgeText}>
                  {media.length > 1
                    ? `${index + 1} / ${media.length}`
                    : labels.photo}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.headerActions}>
            {current?.type === 'video' && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                style={styles.glassButton}
                onPress={() => setMuted(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={muted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color="#ffffff"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={immersive ? 'Exit full screen' : 'Full screen'}
              style={styles.glassButton}
              onPress={() => setImmersive(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={immersive ? 'contract' : 'expand'}
                size={18}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --------------------- FLOATING EXIT (IMMERSIVE) -------------------- */}
      {immersive && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Exit full screen"
          style={[styles.glassButton, { top: insets.top + 8, right: 16 }]}
          onPress={() => setImmersive(false)}
          activeOpacity={0.8}
        >
          <Ionicons name="contract" size={18} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* ------------------------------ ARROWS ----------------------------- */}
      {showChrome && media.length > 1 && (
        <>
          {index > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous media"
              style={[
                styles.navButton,
                {
                  left: 12,
                  top: (mediaHeight || SCREEN_HEIGHT) / 2 - 22,
                },
              ]}
              onPress={() => goTo(index - 1)}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          {index < media.length - 1 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next media"
              style={[
                styles.navButton,
                {
                  right: 12,
                  top: (mediaHeight || SCREEN_HEIGHT) / 2 - 22,
                },
              ]}
              onPress={() => goTo(index + 1)}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-forward" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ------------------------------- DOTS ------------------------------ */}
      {showChrome && media.length > 1 && (
        <View
          style={[styles.dotsRow, { bottom: insets.bottom + 20 }]}
          pointerEvents="none"
        >
          {media.map((item, i) => (
            <View
              key={`dot-${item.uri}-${i}`}
              style={[
                styles.dot,
                i === index && [styles.dotActive, { backgroundColor: accent }],
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* ------------------------------- media ------------------------------- */
  mediaSection: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#000000',
  },
  mediaList: {
    flex: 1,
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginTop: 10,
  },

  /* ------------------------------- video ------------------------------- */
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPoster: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  videoCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoErrorText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  centerPlayButton: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  centerPlayIcon: {
    marginLeft: 5,
  },
  videoControls: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  videoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(10,12,15,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  videoControlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  videoTime: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'center',
  },
  progressTrackWrap: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    top: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 3 },
    }),
  },

  /* ------------------------------ chrome ------------------------------- */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glassButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    right: 20,
    top: -20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,12,15,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(10,12,15,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  navButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,12,15,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 25,
  },

  dotsRow: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 25,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 18,
  },
});

export default PreviewScreen;