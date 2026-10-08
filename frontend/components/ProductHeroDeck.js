import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext'; // 👈 adjust path if needed

// ⏱️ Auto-slide interval (milliseconds) — each product shows for 8s
const SLIDE_DURATION = 8000;
const BRAND_GREEN = '#47ae8600';

/* ---------- Helper: derive a video cover URL from a Cloudinary video ---------- */
const getVideoCover = (videoUrl, videoThumbnail) => {
  if (videoThumbnail) return videoThumbnail;
  if (!videoUrl || !videoUrl.includes('res.cloudinary.com')) return null;
  const [urlWithoutQuery] = videoUrl.split('?');
  const uploadMarker = '/video/upload/';
  if (!urlWithoutQuery.includes(uploadMarker)) return null;
  return urlWithoutQuery
    .replace(uploadMarker, '/video/upload/so_5/')
    .replace(/\.[^/.]+$/, '.jpg');
};

/* ---------- Card ---------- */
const ProductDeckCard = ({
  product,
  index,
  position,
  deckWidth,
  colors,
  onActivate,
  onPressProduct,
  onPressUserProfile,
}) => {
  const positionValue = useRef(new Animated.Value(position)).current;

  useEffect(() => {
    Animated.spring(positionValue, {
      toValue: position,
      speed: 16,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [position, positionValue]);

  const cardWidth = Math.min(deckWidth * 0.75, 360);
  const cardHeight = Math.min(cardWidth * 1.3, 420);

  const transforms = [
    {
      translateX: positionValue.interpolate({
        inputRange: [-3, 0, 3],
        outputRange: [-cardWidth * 0.7, 0, cardWidth * 0.7],
      }),
    },
    {
      rotate: positionValue.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-9deg', '0deg', '9deg'],
      }),
    },
    {
      scale: positionValue.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0.86, 1, 0.86],
      }),
    },
  ];

  const sideOverlayOpacity = positionValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.55, 0, 0.55],
  });

  const playOpacity = positionValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 1, 0],
  });

  const brandGreen = colors.login || colors.brand || BRAND_GREEN;
  const cardBackground =
    colors.cardBackground || colors.action || colors.background || '#222222';
  const overlayColor = colors.overlay || '#000000';
  const playIconColor = colors.playIcon || colors.title || '#ffffff';

  const locationText = product.location || '';

  // ---- Media resolution (video-aware) -----------------------------------
  const hasVideo = Boolean(product.videoUrl);
  const videoCover = hasVideo
    ? getVideoCover(product.videoUrl, product.videoThumbnail)
    : null;
  const cardImageUri =
    videoCover ||
    (Array.isArray(product.houseImages) && product.houseImages.find(Boolean)) ||
    null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.cardPosition,
        {
          zIndex: position === 0 ? 3 : 1,
          left: (deckWidth - cardWidth) / 2,
          width: cardWidth,
          height: cardHeight,
          transform: transforms,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={position === 0 ? onPressProduct : () => onActivate(index)}
        style={[styles.cardTouchTarget, { backgroundColor: cardBackground }]}
      >
        <ImageBackground
          source={{ uri: cardImageUri }}
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
          resizeMode="cover"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sideOverlay,
              { backgroundColor: overlayColor, opacity: sideOverlayOpacity },
            ]}
          />

          <View pointerEvents="none" style={styles.topShade} />
          <View pointerEvents="none" style={styles.bottomShade} />

          {/* TOP-LEFT: product name + location */}
          <View style={styles.topOverlay} pointerEvents="box-none">
            <Text numberOfLines={1} style={styles.productName}>
              {product.productName || 'Product'}
            </Text>
            {!!locationText && (
              <Text numberOfLines={1} style={styles.productLocation}>
                {locationText}
              </Text>
            )}
          </View>

          {/* TOP-RIGHT: video badge (only when the post is a video) */}
          {hasVideo && (
            <View style={styles.videoBadge} pointerEvents="none">
              <Ionicons name="videocam" size={12} color="#fff" />
            </View>
          )}

          {/* Center play button */}
          <Animated.View
          >
           
          </Animated.View>

          {/* BOTTOM: user (left) + amount (right) */}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPressUserProfile?.(product)}
              style={styles.userRow}
            >
              {!!product.userAvatar && (
                <Image
                  source={{ uri: product.userAvatar }}
                  style={styles.userAvatar}
                />
              )}
              <Text numberOfLines={1} style={styles.username}>
                {product.username || 'User'}
              </Text>
            </TouchableOpacity>

            {!!product.amount && (
              <Text numberOfLines={1} style={styles.amount}>
                {product.amount}
              </Text>
            )}
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ---------- Deck ---------- */
const ProductHeroDeck = ({
  products = [],
  colors: colorsProp,
  onPressProduct,
  onPressUserProfile,
}) => {
  const themeContext = useTheme();
  const colors = colorsProp || themeContext?.theme || {};

  const [deckWidth, setDeckWidth] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

  const brandGreen = colors.login || colors.brand || BRAND_GREEN;
  const glowColor = colors.glow || 'rgba(71, 174, 134, 0)';
  const glowShadowColor = colors.glowShadow || brandGreen;
  const trackColor = colors.border || '#88888803';

  useEffect(() => {
    setActiveIndex(index => (products.length ? index % products.length : 0));
  }, [products.length]);

  const currentIndex = products.length ? activeIndex % products.length : 0;
  const segmentWidth = products.length
    ? Math.max(0, (progressWidth - (products.length - 1) * 5) / products.length)
    : 0;
  const progressFillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segmentWidth],
    extrapolate: 'clamp',
  });

  // ─────────────────────────────────────────────────────────────
  // AUTO-SLIDE: every SLIDE_DURATION ms this fires, animates the
  // progress bar from 0 → 1, then advances `activeIndex` by one.
  // Because `currentIndex` is in the deps, the effect restarts and
  // the next product auto-slides in. Runs forever until unmount.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!products.length || !deckWidth || !segmentWidth) return undefined;

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    });
    progressAnimation.current = animation;
    animation.start(({ finished }) => {
      if (finished && products.length > 1) {
        setActiveIndex(index => (index + 1) % products.length);
      }
    });

    return () => {
      animation.stop();
    };
  }, [
    currentIndex,
    deckWidth,
    progress,
    products.length,
    restartKey,
    segmentWidth,
  ]);

  if (!products.length) return null;

  const previousIndex = (currentIndex - 1 + products.length) % products.length;
  const nextIndex = (currentIndex + 1) % products.length;
  const visibleCards = [
    { index: previousIndex, position: -1 },
    { index: currentIndex, position: 0 },
    { index: nextIndex, position: 1 },
  ].filter(
    (card, cardPosition, cards) =>
      cards.findIndex(candidate => candidate.index === card.index) ===
      cardPosition
  );

  const cardWidth = Math.min(deckWidth * 0.78, 360);
  const cardHeight = Math.min(cardWidth * 1.1, 420);

  const selectProduct = index => {
    progressAnimation.current?.stop();
    setActiveIndex(index);
    setRestartKey(key => key + 1);
  };

  return (
    <View
      style={styles.container}
      onLayout={event => setDeckWidth(event.nativeEvent.layout.width)}
    >
      {deckWidth > 0 && (
        <View style={[styles.deck, { height: cardHeight + 32 }]}>
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                backgroundColor: glowColor,
                shadowColor: glowShadowColor,
                width: cardWidth * 0.62,
                height: cardHeight * 0.78,
                left: (deckWidth - cardWidth * 0.62) / 2,
                top: cardHeight * 0.2,
              },
            ]}
          />
          {visibleCards.map(card => (
            <ProductDeckCard
              key={card.index}
              product={products[card.index]}
              index={card.index}
              position={card.position}
              deckWidth={deckWidth}
              colors={colors}
              onActivate={selectProduct}
              onPressProduct={() => onPressProduct(products[currentIndex])}
              onPressUserProfile={onPressUserProfile}
            />
          ))}
        </View>
      )}

      <View
        style={styles.progressRow}
        onLayout={event => setProgressWidth(event.nativeEvent.layout.width)}
      >
        {products.map((product, index) => (
          <TouchableOpacity
            key={product._id || index}
            accessibilityRole="button"
            accessibilityLabel={`Show product ${index + 1}`}
            activeOpacity={0.8}
            onPress={() => selectProduct(index)}
            style={[styles.progressTrack, { backgroundColor: trackColor }]}
          >
            {index < currentIndex ? (
              <View
                style={[
                  styles.progressFill,
                  styles.completedProgress,
                  { backgroundColor: brandGreen },
                ]}
              />
            ) : index === currentIndex ? (
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: brandGreen, width: progressFillWidth },
                ]}
              />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    
    alignItems: 'center',
  },
  deck: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    
    borderRadius: 999,
    shadowOpacity: 0.85,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  cardPosition: {
    position: 'absolute',
    top: 0,
  },
  cardTouchTarget: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'center',
  },
  cardImageStyle: {
    borderRadius: 18,
  },
  sideOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '32%',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  topOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 42,          // 👈 leaves space for the video badge on the right
    zIndex: 5,
  },
  productName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  productLocation: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ---------- Video badge (top-right corner) ---------- */
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
  },

  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 10,
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    backgroundColor: '#333',
    marginRight: 8,
  },
  username: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  amount: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    top:155 ,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  completedProgress: {
    width: '100%',
  },
});

export default ProductHeroDeck;