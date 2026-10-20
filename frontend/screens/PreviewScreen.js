/* ========================================================================== */
/*  screens/PreviewScreen.js                                                  */
/* ========================================================================== */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VideoPost from '../components/VideoPost';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const ACCENT_FALLBACK = '#47ae87';
const CHROME_FADE_MS = 220;

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

/* -------------------------------- helpers -------------------------------- */

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
    return String(media.type).toLowerCase().startsWith('video');
  }
  const uri = getMediaUri(media) || '';
  if (!uri) return false;
  if (/\.(mp4|mov|webm|m4v|3gp|mkv|m3u8)(\?.*)?$/i.test(uri)) return true;
  return /video\//i.test(uri) || /\/video\//i.test(uri);
};

/* --------------------------------- Scrim --------------------------------- */

const Scrim = React.memo(
  ({ position, height, maxOpacity = 0.6, steps = 14 }) => {
    const bands = useMemo(() => {
      const arr = [];
      for (let i = 0; i < steps; i++) {
        const t = position === 'top' ? 1 - i / (steps - 1) : i / (steps - 1);
        arr.push(maxOpacity * t * t);
      }
      return arr;
    }, [position, maxOpacity, steps]);

    if (!height) return null;

    return (
      <View
        pointerEvents="none"
        style={[
          styles.scrim,
          position === 'top' ? styles.scrimTop : styles.scrimBottom,
          { height },
        ]}
      >
        {bands.map((opacity, i) => (
          <View
            key={`${position}-band-${i}`}
            style={{
              flex: 1,
              backgroundColor: `rgba(0,0,0,${opacity.toFixed(4)})`,
            }}
          />
        ))}
      </View>
    );
  }
);

/* ------------------------------ PreviewScreen ---------------------------- */

const PreviewScreen = ({ route, navigation, language = 'English' }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const accent =
    theme?.primary || theme?.accent || theme?.tint || ACCENT_FALLBACK;
  const labels = LABELS[language] || LABELS.English;

  const {
    imageUri,
    images: routeImages,
    videoUrl,
    videoHlsUrl,
    videoThumbnail,
    listing,
    initialIndex = 0,
  } = route.params || {};

  const media = useMemo(() => {
    const raw =
      Array.isArray(routeImages) && routeImages.length
        ? [...routeImages]
        : [imageUri];
    const resolvedVideoUrl =
      videoHlsUrl || videoUrl || listing?.videoHlsUrl || listing?.videoUrl;

    if (
      resolvedVideoUrl &&
      !raw.some(item => getMediaUri(item) === resolvedVideoUrl)
    ) {
      raw.push({ uri: resolvedVideoUrl, type: 'video' });
    }

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
          listing?.videoThumbnail ||
          listing?.thumbnail ||
          null;

        return { uri, type, thumbnail };
      })
      .filter(Boolean);
  }, [imageUri, routeImages, videoUrl, videoHlsUrl, videoThumbnail, listing]);

  const safeInitialIndex = Math.min(
    Math.max(0, Number(initialIndex) || 0),
    Math.max(0, media.length - 1)
  );

  const [index, setIndex] = useState(safeInitialIndex);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mediaHeight, setMediaHeight] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [appActive, setAppActive] = useState(
    AppState.currentState !== 'background'
  );

  const listRef = useRef(null);
  const chromeAnim = useRef(new Animated.Value(1)).current;

  const current = media[index];
  const isVideo = current?.type === 'video';
  const showChrome = chromeVisible && !immersive;
  const playbackAllowed = screenFocused && appActive && !scrolling;

  /* fade whole PreviewScreen chrome */
  useEffect(() => {
    Animated.timing(chromeAnim, {
      toValue: showChrome ? 1 : 0,
      duration: CHROME_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [showChrome, chromeAnim]);

  /* focus / app state / back handler */
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const unsubFocus = navigation.addListener('focus', () =>
      setScreenFocused(true)
    );
    const unsubBlur = navigation.addListener('blur', () =>
      setScreenFocused(false)
    );
    return () => {
      unsubFocus?.();
      unsubBlur?.();
    };
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (!immersive) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setImmersive(false);
      return true;
    });
    return () => sub?.remove?.();
  }, [immersive]);

  /* paging */
  const goTo = useCallback(
    nextIndex => {
      if (nextIndex < 0 || nextIndex >= media.length) return;
      setIndex(nextIndex);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    },
    [media.length]
  );

  const onMomentumScrollEnd = useCallback(
    event => {
      const next = Math.round(event.nativeEvent.contentOffset.x / winWidth);
      setScrolling(false);
      setIndex(prev => (prev === next ? prev : next));
    },
    [winWidth]
  );

  const onScrollBeginDrag = useCallback(() => setScrolling(true), []);

  const onScrollToIndexFailed = useCallback(
    info => {
      listRef.current?.scrollToOffset({
        offset: info.index * winWidth,
        animated: false,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, animated: false });
      }, 80);
    },
    [winWidth]
  );

  const toggleChrome = useCallback(() => {
    if (immersive) return;
    setChromeVisible(v => !v);
  }, [immersive]);

  /* render one media page */
  const renderItem = useCallback(
    ({ item, index: itemIndex }) => {
      const isActive = itemIndex === index && playbackAllowed;
      const backdropSource =
        item.type === 'image' ? getImageSource(item.uri) : null;

      return (
        <View
          style={[
            styles.page,
            {
              width: winWidth,
              height: mediaHeight || winHeight,
              backgroundColor: '#000000',
            },
          ]}
        >
          {item.type === 'image' && backdropSource && (
            <Image
              source={backdropSource}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              blurRadius={18}
            />
          )}
          {item.type === 'image' && backdropSource && isDarkMode && (
            <View style={styles.backdropShade} pointerEvents="none" />
          )}

          {item.type === 'video' ? (
            <VideoPost
              videoUrl={item.uri}
              videoThumbnail={getMediaUri(item.thumbnail)}
              theme={theme}
              containerHeight={mediaHeight || winHeight}
              isVisible={isActive}
              muted={muted}
              onMuteChange={setMuted}
              contentFit="contain"
              onVideoPress={toggleChrome}
              progressColor={accent}
              centerControlSize={64}
              showPlaybackControls
              bottomInset={insets.bottom}
            />
          ) : (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={toggleChrome}
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
      index,
      muted,
      playbackAllowed,
      theme,
      isDarkMode,
      winWidth,
      winHeight,
      mediaHeight,
      toggleChrome,
      accent,
      insets.bottom,
    ]
  );

  const dotsBottom = insets.bottom + (isVideo ? 84 : 22);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

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
              length: winWidth,
              offset: winWidth * i,
              index: i,
            })}
            onScrollBeginDrag={onScrollBeginDrag}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollToIndexFailed={onScrollToIndexFailed}
            renderItem={renderItem}
            extraData={`${index}-${muted}-${playbackAllowed}`}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            removeClippedSubviews={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="image-outline"
                size={40}
                color="rgba(255,255,255,0.85)"
              />
            </View>
            <Text style={styles.emptyText}>{labels.imageUnavailable}</Text>
          </View>
        )}
      </View>

      {/* Chrome (scrims + header + nav + dots) */}
      {!immersive && (
        <Animated.View
          pointerEvents={showChrome ? 'box-none' : 'none'}
          style={[StyleSheet.absoluteFill, { opacity: chromeAnim }]}
        >
          <Scrim position="top" height={140} maxOpacity={0.55} />
          {isVideo && (
            <Scrim position="bottom" height={200} maxOpacity={0.6} />
          )}

          {/* Header */}
          <View
            style={[styles.header, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.headerSide}>
              {navigation?.canGoBack?.() ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close preview"
                  style={styles.glassButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.glassButtonSpacer} />
              )}
            </View>

            <View style={styles.headerCenter} pointerEvents="none">
              <View style={styles.badge}>
                {isVideo ? (
                  <>
                    <View
                      style={[styles.badgeDot, { backgroundColor: accent }]}
                    />
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

            <View style={[styles.headerSide, styles.headerSideRight]}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={immersive ? 'Exit full screen' : 'Full screen'}
                style={styles.glassButton}
                onPress={() => setImmersive(v => !v)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={immersive ? 'contract' : 'expand'}
                  size={18}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Prev / Next nav */}
          {media.length > 1 && (
            <>
              {index > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Previous media"
                  style={[
                    styles.navButton,
                    { left: 12, top: (mediaHeight || winHeight) / 2 - 23 },
                  ]}
                  onPress={() => goTo(index - 1)}
                  activeOpacity={0.85}
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
                    { right: 12, top: (mediaHeight || winHeight) / 2 - 23 },
                  ]}
                  onPress={() => goTo(index + 1)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chevron-forward" size={22} color="#ffffff" />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Dots */}
          {media.length > 1 && (
            <View
              style={[styles.dotsRow, { bottom: dotsBottom }]}
              pointerEvents="none"
            >
              {media.map((item, i) => (
                <View
                  key={`dot-${item.uri}-${i}`}
                  style={[
                    styles.dot,
                    i === index && [
                      styles.dotActive,
                      { backgroundColor: accent },
                    ],
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {/* Immersive floating exit */}
      {immersive && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Exit full screen"
          style={[styles.floatingGlassButton, { top: insets.top + 8, right: 16 }]}
          onPress={() => setImmersive(false)}
          activeOpacity={0.85}
        >
          <Ionicons name="contract" size={18} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

/* -------------------------------- styles -------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  mediaSection: { flex: 1, minHeight: 0, backgroundColor: '#000000' },
  mediaList: { flex: 1 },
  page: { justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  scrim: { position: 'absolute', left: 0, right: 0 },
  scrimTop: { top: 0 },
  scrimBottom: { bottom: 0 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    letterSpacing: 0.2,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerSide: { width: 46, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },

  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  glassButtonSpacer: { width: 42, height: 42 },
  floatingGlassButton: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(12,14,18,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  navButton: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,18,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },

  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: { width: 20, height: 6, borderRadius: 3 },
});

export default PreviewScreen;