import { getImageUri, normalizeImageSource } from '../utils/imageUrl';
import { getPostCoverUri, getPostVideoUrl } from '../utils/postMedia';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View, Image, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext'; // 👈 adjust path if needed
import { logPerformance } from '../utils/performanceLogger';
import OnlineStatusDot from './OnlineStatusDot';
import useOnlineUsers from '../hooks/useOnlineUsers';

// ⏱️ Auto-slide interval (milliseconds) — each product shows for 8s
const SLIDE_DURATION = 8000;
const BRAND_GREEN = '#47ae8600';
const DEFAULT_AVATAR = require('../assets/avator.png');

/* ---------- Card ---------- */
const ProductDeckCard = ({
  product,
  index,
  position,
  deckWidth,
  colors,
  onActivate,
  onPressProduct,
  onPressVideo,
  onPressUserProfile,
  onlineUsers,
}) => {
  const positionValue = useRef(new Animated.Value(position)).current;
  const imageLoadStartedAt = useRef(null);

  useEffect(() => {
    Animated.spring(positionValue, {
      toValue: position,
      speed: 16,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [position, positionValue]);

  const cardWidth = Math.min(deckWidth * 0.68, 360);
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

  const brandGreen = colors.login || colors.brand || BRAND_GREEN;
  const cardBackground =
    colors.cardBackground || colors.action || colors.background || '#222222';
  const overlayColor = colors.overlay || '#000000';

  const locationText = product.location || '';
  const productOwnerId =
    product.userId?._id ||
    product.userId?.id ||
    product.userId ||
    product.user?._id ||
    product.user?.id ||
    product.user;

  // ---- Media resolution (video-aware) -----------------------------------
  const videoUrl = getPostVideoUrl(product);
  const hasVideo = Boolean(videoUrl);
  const cardImageUri = getImageUri(product._homeImageUri) || getPostCoverUri(product);
  const userAvatarUri = getImageUri(product.userAvatar || product.user?.avatar);

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
        onPress={position === 0
          ? (hasVideo ? (onPressVideo || onPressProduct) : onPressProduct)
          : () => onActivate(index)}
        style={[styles.cardTouchTarget, { backgroundColor: cardBackground }]}
      >
        <ImageBackground
          source={normalizeImageSource({ uri: cardImageUri })}
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
          resizeMode="cover"
          onLoadStart={() => {
            imageLoadStartedAt.current = Date.now();
          }}
          onLoad={() => {
            if (imageLoadStartedAt.current == null) return;
            logPerformance(
              `[Perf] home-product-image ${Date.now() - imageLoadStartedAt.current}ms`
            );
            imageLoadStartedAt.current = null;
          }}
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
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPressProduct}
            style={styles.topOverlay}
          >
            <Text numberOfLines={1} style={styles.productName}>
              {product.productName || 'Product'}
            </Text>
            {!!locationText && (
              <Text numberOfLines={1} style={styles.productLocation}>
                {locationText}
              </Text>
            )}
          </TouchableOpacity>

          {/* TOP-RIGHT: video badge (only when the post is a video) */}
          {hasVideo && (
            <View style={styles.videoBadge} pointerEvents="none">
              <Ionicons name="videocam" size={12} color="#fff" />
            </View>
          )}

          {/* BOTTOM: user (left) + amount (right) */}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPressUserProfile?.(product)}
              style={styles.userRow}
            >
              <View style={styles.userAvatarWrap}>
                <Image
                  source={normalizeImageSource(userAvatarUri ? { uri: userAvatarUri } : DEFAULT_AVATAR)}
                  style={[styles.userAvatar, { marginRight: 0 }]}
                />
                <OnlineStatusDot
                  visible={Boolean(productOwnerId && onlineUsers[String(productOwnerId)])}
                  size={10}
                />
              </View>
              <Text numberOfLines={1} style={styles.username}>
                {product.username || 'User'}
              </Text>
            </TouchableOpacity>

            {!!product.amount && (
              <TouchableOpacity activeOpacity={0.85} onPress={onPressProduct}>
                <Text numberOfLines={1} style={styles.amount}>
                  {product.amount}
                </Text>
              </TouchableOpacity>
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
  onPressVideo,
  onPressUserProfile,
}) => {
  const themeContext = useTheme();
  const colors = colorsProp || themeContext?.theme || {};

  const [deckWidth, setDeckWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const onlineUsers = useOnlineUsers(products.map(product =>
    product.userId?._id || product.userId?.id || product.userId || product.user?._id || product.user?.id || product.user
  ));

  const brandGreen = colors.login || colors.brand || BRAND_GREEN;
  const glowColor = colors.glow || 'rgba(71, 174, 134, 0)';
  const glowShadowColor = colors.glowShadow || brandGreen;

  useEffect(() => {
    setActiveIndex(index => (products.length ? index % products.length : 0));
  }, [products.length]);

  const currentIndex = products.length ? activeIndex % products.length : 0;

  // ─────────────────────────────────────────────────────────────
  // AUTO-SLIDE: every SLIDE_DURATION ms the active card advances.
  // We use a plain setTimeout because the visual progress bar
  // (which previously drove this) has been removed.
  // `restartKey` lets `selectProduct` re-arm the timer even when
  // the user taps the currently active card.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!products.length || products.length < 2 || !deckWidth) return undefined;

    const timer = setTimeout(() => {
      setActiveIndex(index => (index + 1) % products.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [currentIndex, deckWidth, products.length, restartKey]);

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
              onPressProduct={() => onPressProduct(products[card.index])}
              onPressVideo={() => onPressVideo?.(products[card.index])}
              onPressUserProfile={onPressUserProfile}
              onlineUsers={onlineUsers}
            />
          ))}
        </View>
      )}
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
    right: 42, // 👈 leaves space for the video badge on the right
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
  userAvatarWrap: { position: 'relative', marginRight: 8 },
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
});

export default ProductHeroDeck;