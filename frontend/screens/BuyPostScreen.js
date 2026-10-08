// screens/BuyPostScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Share, Alert, Animated,
  TextInput, RefreshControl, ScrollView, TouchableWithoutFeedback,
  Linking, Platform, LogBox, PanResponder, Modal,
} from 'react-native';
import BlurView from '../components/BlurViewWrapper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useRoute } from '@react-navigation/native';
import axios from 'axios';
import BuyLoginSheet from '../components/BuyLoginSheet';
import { useBottomSheet } from '../context/BottomSheetContext';
import { BASE_URL } from '../constants';
import VideoPost from '../components/VideoPost';
import { getUserDisplayName } from '../utils/userIdentity';
import { videoPreloader } from '../components/VideoPreloader';
import { POST_SECTIONS, POST_SECTION_KEYS, getPostsForSection } from './postSectionConfig';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';

LogBox.ignoreLogs([
  'The native view manager for module(ExpoBlur)',
  'expo-av',
  'Due to changes in Androids permission requirements',
]);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;
const DETAIL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.60;
const HEADER_HEIGHT = 90;
const SCROLL_THRESHOLD = 20;
const MIN_IMAGE_HEIGHT = 300;
const MAX_IMAGE_HEIGHT = 700;
const CARD_BORDER_RADIUS = 0;

let restoredReelIndex = 0;

const DEFAULT_AVATAR = require('../assets/profile1.png');
const LOADING_LOGO = require('../assets/logos.png');

const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const socialLinks = [
  { name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', url: 'instagram://user?username=shaaka_rw', fallbackUrl: 'https://www.instagram.com/shaaka_rw/' },
  { name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', url: 'youtube://www.youtube.com/@shaaka-rw', fallbackUrl: 'https://www.youtube.com/@shaaka-rw' },
  { name: 'X', icon: 'logo-x', color: '#000000', url: 'https://x.com/shaaka_rw', fallbackUrl: 'https://x.com/shaaka_rw' },
  { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', url: 'fb://profile/61592686307072', fallbackUrl: 'https://www.facebook.com/profile.php?id=61592686307072' },
  { name: 'Email', icon: 'mail-outline', color: '#D44638', url: 'mailto:shaakarw@gmail.com', fallbackUrl: null },
  { name: 'WhatsApp', icon: 'logo-whatsapp', color: '#58bc76', url: 'whatsapp://send?phone=+250799882580', fallbackUrl: 'https://wa.me/250799882580' },
];

const translations = {
  English: {
    loading: 'Making things ready...',
    feed: 'Feed',
    trending: 'Trending',
    newPosts: 'New Posts',
    myPosts: 'My Posts',
    saved: 'Saved',
    videos: 'Videos',
    pleaseLogin: 'Please login to see posts',
    noPosts: 'Wait a moment...',
    noMyPosts: "",
    noSavedPosts: '',
    noVideos: 'Loading...',
    addNewUpdate: 'New Update',
    titlePlaceholder: 'Title',
    messagePlaceholder: 'Message (optional)',
    postUpdate: 'Post Update',
    reportPost: 'Report Post',
    whyReport: 'Why are you reporting this post?',
    spam: 'Sexual',
    inappropriate: 'Inappropriate',
    scam: 'Scam',
    cancel: 'Cancel',
    loginRequired: 'Login Required',
    pleaseLoginToSave: 'Please login to save posts',
    pleaseLoginToView: 'Please login to view post details',
    pleaseLoginToProfile: 'Please login to view profile',
    pleaseLoginToMessage: 'Please login to message the seller',
    sellerInfoMissing: 'Seller information not available',
    titleRequired: 'Title required',
    enterTitle: 'Please enter a title for your update.',
    noDescription: 'No description provided.',
    reported: 'Reported',
    thanksForReport: 'Thank you for reporting this post as %s.',
    share: 'Share',
    save: 'Save',
    message: 'Message',
    price: 'Price',
    description: 'Description',
    report: 'Report',
    viewMore: 'View more',
    viewLess: 'View less',
    stopped: 'Stopped',
    error: 'Error',
    reportFailed: 'Failed to submit report.',
    feedLoadError: 'Failed to load posts. Please check your connection.',
    retry: 'Retry',
    followUs: 'Follow us on social media',
    deletePost: 'Delete Post',
    deleteConfirm: 'Are you sure you want to delete this post?',
    delete: 'Delete',
    sending: 'Sending...',
    messageSent: 'Message sent!',
    messageSentFailed: 'Failed to send message',
  },
  Kinyarwanda: {
    loading: 'Turigutunganya page neza...',
    feed: 'Ibicuruzwa',
    trending: 'Ibikunzwe',
    newPosts: 'Ibicuruzwa bishya',
    myPosts: 'Ibicuruzwa byanjye',
    saved: 'Ibyabitswe',
    videos: 'Video',
    pleaseLogin: 'Nyamuneka Injira kugira ngo ubone Ibicuruzwa',
    noPosts: 'Tegerezaho akanyagato...',
    noMyPosts: '',
    noSavedPosts: '',
    noVideos: 'Tegerezaho gato...',
    addNewUpdate: 'Ongeraho igicuruzwa',
    titlePlaceholder: 'Umutwe',
    messagePlaceholder: 'Ubutumwa (bishakiwe)',
    postUpdate: 'Shyiraho ikinyabupfura',
    reportPost: 'Menyesha ikitagenda neza',
    whyReport: 'Kuki umenyesha iki gicuruzwa?',
    spam: 'Biteye isoni',
    inappropriate: 'Ntibikwiriye',
    scam: 'Uburiganya',
    cancel: 'Reka',
    loginRequired: 'Ugomba kwinjira',
    pleaseLoginToSave: 'Nyamuneka injira kugira ngo ubike Ibicuruzwa',
    pleaseLoginToView: 'Nyamuneka Injira kugira ngo urebe ibi byose',
    pleaseLoginToProfile: 'Nyamuneka Injira kugira ngo urebe porofile',
    pleaseLoginToMessage: 'Nyamuneka Injira kugira ngo wandike ubutumwa',
    sellerInfoMissing: 'Amakuru y\'umugurisha ntiboneka',
    titleRequired: 'Umutwe urakenewe',
    enterTitle: 'Nyamuneka andika umutwe w\'ikinyabupfura.',
    noDescription: 'Nta bisobanuro byatanzwe.',
    reported: 'Byamenyeshejwe',
    thanksForReport: 'Urakoze kumenyesha iyi nyandiko nka %s.',
    share: 'Sangiza',
    save: 'Bika',
    message: 'Ubutumwa',
    price: 'Igiciro',
    description: 'Ibisobanuro',
    report: 'Menyesha',
    viewMore: 'Reba byinshi',
    viewLess: 'Gabanya',
    stopped: 'Yahagaritswe',
    error: 'Ikibazo',
    reportFailed: 'Ntabwo byashobotse kumenyesha ikibazo.',
    feedLoadError: 'Ntabwo byashobotse gukurura Ibicuruzwa. Nyamuneka genzura interineti yawe.',
    retry: 'Ongera ugerageze',
    followUs: 'Dukurikire ku mbuga nkoranyambaga',
    deletePost: 'Siba Ibicuruzwa',
    deleteConfirm: 'Ese ukenye gusiban icyi Gicuruzwa?',
    delete: 'Siba',
    sending: 'Kohereza...',
    messageSent: 'Ubutumwa bwoherejwe!',
    messageSentFailed: 'Kohereza ubutumwa byanze',
  },
};

const getImageSource = (img) => {
  if (!img) return DEFAULT_AVATAR;
  if (typeof img === 'string') return { uri: img };
  if (typeof img === 'object' && img.uri) return img;
  return DEFAULT_AVATAR;
};

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

const getImageSize = (source) => {
  if (typeof source === 'number') {
    const resolved = Image.resolveAssetSource(source);
    if (resolved) return Promise.resolve({ width: resolved.width, height: resolved.height });
  }
  const src = getImageSource(source);
  if (src.uri) {
    return new Promise((resolve, reject) => {
      Image.getSize(
        src.uri,
        (width, height) => resolve({ width, height }),
        reject
      );
    });
  }
  return Promise.resolve({ width: CARD_WIDTH, height: MIN_IMAGE_HEIGHT });
};

const computeScaledMediaLayout = (naturalWidth, naturalHeight) => {
  if (!naturalWidth || !naturalHeight) {
    return { height: MAX_IMAGE_HEIGHT, resizeMode: 'cover' };
  }
  const scaled = (naturalHeight / naturalWidth) * CARD_WIDTH;
  if (Number.isNaN(scaled) || !Number.isFinite(scaled)) {
    return { height: MAX_IMAGE_HEIGHT, resizeMode: 'cover' };
  }
  const isClamped = scaled < MIN_IMAGE_HEIGHT || scaled > MAX_IMAGE_HEIGHT;
  return {
    height: Math.min(Math.max(scaled, MIN_IMAGE_HEIGHT), MAX_IMAGE_HEIGHT),
    resizeMode: isClamped ? 'cover' : 'contain',
  };
};

const mapPost = (post) => ({
  ...post,
  _id: post._id, id: post._id,
  username: getUserDisplayName(post.user || post, 'User'),
  userAvatar: post.userAvatar || post.user?.avatar,
  amount: post.amount || `RWF ${post.price?.toLocaleString()}`,
  price: post.price,
  location: post.location,
  description: post.description,
  productName: post.productName || 'Product',
  houseImages: post.houseImages || [],
  contactNumber1: post.contactNumbers?.[0] || '',
  contactNumber2: post.contactNumbers?.[1] || '',
  priceNegotiable: post.priceNegotiable || false,
  videoUrl: post.videoUrl || '',
  videoDuration: post.videoDuration || 0,
  videoThumbnail: post.videoThumbnail || '',
  videoLink: post.videoLink || '',
  videoHlsUrl: post.videoHlsUrl || '',
  videoId: post.videoId || '',
  userId: post.user?._id || post.user,
  status: post.status || 'active',
  featured: post.featured || false,
});

const getPostOwnerId = (post) => {
  const owner = post?.userId || post?.user;
  return owner?._id || owner?.id || owner;
};

const ImageWithPlaceholder = React.memo(({ source, style, resizeMode, transparentBackground }) => {
  const { theme } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!loaded) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: -1, duration: 500, useNativeDriver: true }),
          ]),
          Animated.timing(rotateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
      loopRef.current = anim;
      anim.start();
      return () => anim.stop();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      scaleAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [loaded, scaleAnim, rotateAnim]);

  const onLoad = useCallback(() => setLoaded(true), []);

  return (
    <Animated.View style={[style, { overflow: 'hidden', backgroundColor: transparentBackground ? 'transparent' : theme.mediaLoadingBackground }]}>
      {!loaded && (
        <Animated.View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            transform: [
              { translateX: -36 },
              { translateY: -36 },
              { scale: scaleAnim },
              { rotate: rotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '6deg'] }) },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <Animated.Image
            source={LOADING_LOGO}
            style={{
              width: 46,
              height: 46,
              resizeMode: 'contain',
            }}
          />
        </Animated.View>
      )}
      <Animated.Image
        source={getImageSource(source)}
        style={[style, { opacity: loaded ? 1 : 0 }]}
        resizeMode={resizeMode || 'cover'}
        onLoad={onLoad}
      />
    </Animated.View>
  );
});

/* ---------- Slider: no arrows, only dots ---------- */
const ImageSlider = React.memo(({ images, isDarkMode, height, resizeMode = 'contain', loadingBackground }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const containerHeight = height || MAX_IMAGE_HEIGHT;

  const onScroll = useCallback((event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(offset / slideSize));
  }, []);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return (
    <View style={[styles.sliderContainer, { height: containerHeight, backgroundColor: loadingBackground }]}>
      <Image
        source={getImageSource(currentImage)}
        style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />
      <BlurView
        tint={isDarkMode ? 'dark' : 'light'}
        intensity={90}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }) => (
          <ImageWithPlaceholder
            source={item}
            style={[styles.houseImage, { height: containerHeight }]}
            resizeMode={resizeMode}
            transparentBackground
          />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === currentIndex && styles.activeDot]} />
          ))}
        </View>
      )}
    </View>
  );
});

/* ---------- Horizontal trending strip (product tiles) ---------- */
const FeedProductStrip = React.memo(({ products, onPress, onUserPress, title, isDarkMode }) => {
  const visibleProducts = products
    .filter(product => product.houseImages?.length || product.videoUrl)
    .slice(0, 10);

  if (visibleProducts.length === 0) return null;

  return (
    <View style={[styles.productStrip, title && styles.productStripWithTitle]}>
      {!!title && (
        <Text style={[styles.productStripTitle, { color: isDarkMode ? '#dddddd' : '#111111' }]}>{title}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productStripContent}
      >
        {visibleProducts.map(product => {
          const videoCover = product.videoUrl
            ? getVideoCover(product.videoUrl, product.videoThumbnail)
            : null;
          const image = product.houseImages?.[0] || videoCover;
          const label = product.productName || product.category || 'Product';
          const amountText = product.amount
            || (product.price != null ? `RWF ${product.price.toLocaleString()}` : '');

          return (
            <TouchableOpacity
              key={product._id}
              style={styles.productTile}
              onPress={() => onPress(product)}
              activeOpacity={0.9}
            >
              <Image source={getImageSource(image)} style={styles.productTileImage} />
              <View style={styles.productTileShade} />

              {/* Top-left: product name */}
              <Text style={styles.productTileLabel} numberOfLines={2}>
                {label}
              </Text>

              {/* Top-right: video indicator */}
              {product.videoUrl && (
                <View style={styles.productTileVideoBadge}>
                  <Ionicons name="videocam" size={11} color="#fff" />
                </View>
              )}

              {/* Bottom-left: user profile */}
              <View style={styles.productTileUserRow}>
                <TouchableOpacity
                  onPress={event => {
                    event.stopPropagation();
                    onUserPress(product.userId, product.username);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${product.username || 'user'} profile`}
                >
                  <Image
                    source={getImageSource(product.userAvatar)}
                    style={styles.productTileOwnerAvatar}
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom-right: price */}
              {!!amountText && (
                <Text style={styles.productTilePrice} numberOfLines={1}>
                  {amountText}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

/* ---------- Suggestion overlay (inline mode supported) ---------- */
const SuggestionOverlayContent = React.memo(({
  isDarkMode,
  theme,
  house,
  onQuickSuggestion,
  isSendingSuggestion,
  suggestionState,
  t,
  isVideo = false,
  inline = false,
}) => {
  const productLabel = (house.productName || house.category || house.title || 'item').trim();
  const suggestionText = productLabel ? productLabel.toLowerCase() : 'item';
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const shakeLoopRef = useRef(null);
  const logoLoopRef = useRef(null);

  useEffect(() => {
    if (suggestionState.status === 'idle') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: -5, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 5, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -5, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.delay(1200),
        ])
      );
      shakeLoopRef.current = animation;
      animation.start();
    } else {
      if (shakeLoopRef.current) {
        shakeLoopRef.current.stop();
        shakeLoopRef.current = null;
      }
      shakeAnim.setValue(0);
    }
    return () => {
      if (shakeLoopRef.current) {
        shakeLoopRef.current.stop();
        shakeLoopRef.current = null;
      }
    };
  }, [suggestionState.status, shakeAnim]);

  useEffect(() => {
    if (suggestionState.status === 'sending') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(logoScaleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(logoScaleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      logoLoopRef.current = animation;
      animation.start();
    } else {
      if (logoLoopRef.current) {
        logoLoopRef.current.stop();
        logoLoopRef.current = null;
      }
      logoScaleAnim.setValue(1);
    }
    return () => {
      if (logoLoopRef.current) {
        logoLoopRef.current.stop();
        logoLoopRef.current = null;
      }
    };
  }, [suggestionState.status, logoScaleAnim]);

  useEffect(() => {
    if (suggestionState.status === 'success' || suggestionState.status === 'error') {
      successOpacity.setValue(0);
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      successOpacity.setValue(0);
    }
  }, [suggestionState.status, successOpacity]);

  const handleQuickSuggestion = useCallback((text) => {
    if (isSendingSuggestion || suggestionState.status === 'sending') return;
    onQuickSuggestion(house, text);
  }, [isSendingSuggestion, suggestionState.status, onQuickSuggestion, house]);

  const containerBase = inline
    ? styles.suggestionOverlayInline
    : [styles.suggestionOverlay, isVideo && styles.suggestionOverlayVideo];
  if (suggestionState.status === 'sending') {
    return (
      <View style={[containerBase, !inline && styles.suggestionOverlaySending]}>
        <View style={styles.suggestionLoadingContainer}>
          <View style={styles.suggestionLogoBadge}>
            <Animated.Image
              source={LOADING_LOGO}
              style={[styles.suggestionLoadingLogo, { transform: [{ scale: logoScaleAnim }] }]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.suggestionLoadingText, { color: theme.title }]}>{t.sending}</Text>
        </View>
      </View>
    );
  }

  if (suggestionState.status === 'success' || suggestionState.status === 'error') {
    const isSuccess = suggestionState.status === 'success';
    return (
      <View style={[containerBase, !inline && styles.suggestionOverlaySending]}>
        <Animated.View style={[styles.suggestionStatusContainer, { opacity: successOpacity }]}>
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
            size={28}
            color={isSuccess ? '#47ae87' : '#d87428'}
          />
          <Text style={[styles.suggestionStatusText, { color: isSuccess ? '#47ae87' : '#d87428' }]}>
            {suggestionState.message}
          </Text>
          {suggestionState.sentText && (
            <Text style={[styles.suggestionSentText, { color: '#fff' }]} numberOfLines={2}>
              "{suggestionState.sentText}"
            </Text>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View style={[containerBase, { transform: [{ translateX: shakeAnim }] }]}>
      <View style={styles.suggestionRow}>
        <TouchableOpacity
          style={[
            styles.suggestionSection,
            styles.suggestionSectionLeft,
            {
              borderRightWidth: 1.5,
              borderRightColor: 'rgba(255,255,255,0.7)',
            }
          ]}
          activeOpacity={0.7}
          onPress={() => handleQuickSuggestion(`Is that ${suggestionText} available?`)}
          disabled={isSendingSuggestion}
        >
          <Text style={styles.suggestionTitle}>Is that {suggestionText} available?</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.suggestionSection, styles.suggestionSectionRight]}
          activeOpacity={0.7}
          onPress={() => handleQuickSuggestion(`Where can I find this ${suggestionText}?`)}
          disabled={isSendingSuggestion}
        >
          <Text style={styles.suggestionTitle}>Where can I find this {suggestionText}?</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const ReportReasonSheet = ({ visible, onClose, onSelect, t, theme }) => (
  <Modal transparent visible={visible} onRequestClose={onClose} animationType="slide">
    <View style={styles.reportModalRoot}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.reportModalBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.reportSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.textSecondary }]} />
        <View style={styles.reportSheetHeader}>
          <Text style={[styles.reportSheetTitle, { color: theme.text }]}>{t.reportPost}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t.cancel}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.reportSheetPrompt, { color: theme.textSecondary }]}>{t.whyReport}</Text>
        {[t.spam, t.inappropriate, t.scam].map(reason => (
          <TouchableOpacity
            key={reason}
            style={[styles.reportReasonButton, { backgroundColor: theme.cardBackground || theme.background, borderColor: theme.border }]}
            onPress={() => onSelect(reason)}
            activeOpacity={0.75}
          >
            <Text style={[styles.reportReasonText, { color: theme.text }]}>{reason}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.reportCancelButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.reportCancelText, { color: theme.textSecondary }]}>{t.cancel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

/* ============================================================
   HouseCard — TikTok-style layout
   Top-left: product name  |  Top-right: video indicator
   Bottom-left: user profile  |  Bottom-right: price
   ============================================================ */
const HouseCard = React.memo(({
  house, theme, isDarkMode, onPress, onShare, isSaved, onToggleSave,
  isLoggedIn, showLoginModal, isMyPost, onUserPress, onReport,
  onMessagePress, t, onQuickSuggestion, isSendingSuggestion,
  suggestionState, videoKey, isVideoVisible, isMuted, onMuteChange,
}) => {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isDescTruncated, setIsDescTruncated] = useState(false);
  const [displayDesc, setDisplayDesc] = useState(house.description || '');
  const [mediaHeight, setMediaHeight] = useState(MAX_IMAGE_HEIGHT);
  const [mediaResizeMode, setMediaResizeMode] = useState('cover');
  const description = house.description || '';

  useEffect(() => {
    setShowFullDesc(false);
    setIsDescTruncated(false);
    setDisplayDesc(description);
  }, [house._id, description]);

  useEffect(() => {
    let cancelled = false;

    const computeHeight = async () => {
      let source = null;
      if (house.videoUrl) {
        const cover = getVideoCover(house.videoUrl, house.videoThumbnail);
        if (cover) source = cover;
      } else if (house.houseImages && house.houseImages.length > 0) {
        source = house.houseImages[0];
      }

      if (!source) {
        if (!cancelled) {
          setMediaHeight(MAX_IMAGE_HEIGHT);
          setMediaResizeMode('cover');
        }
        return;
      }

      try {
        const { width, height } = await getImageSize(source);
        if (cancelled) return;
        const mediaLayout = computeScaledMediaLayout(width, height);
        setMediaHeight(mediaLayout.height);
        setMediaResizeMode(mediaLayout.resizeMode);
      } catch (e) {
        if (!cancelled) {
          setMediaHeight(MAX_IMAGE_HEIGHT);
          setMediaResizeMode('cover');
        }
      }
    };

    computeHeight();
    return () => { cancelled = true; };
  }, [house._id, house.videoUrl, house.videoThumbnail, house.houseImages]);

  const handleDescLayout = useCallback((event) => {
    const lines = event.nativeEvent.lines || [];
    if (!description || lines.length === 0) {
      setIsDescTruncated(false);
      setDisplayDesc(description);
      return;
    }
    if (lines.length === 1) {
      setIsDescTruncated(false);
      setDisplayDesc(description);
      return;
    }
    const containerWidth = CARD_WIDTH - 24;
    const secondLine = lines[1];
    const secondWidth = secondLine?.width || 0;
    const secondRatio = containerWidth > 0 ? secondWidth / containerWidth : 0;

    if (lines.length === 2 && secondRatio <= 0.7) {
      setIsDescTruncated(false);
      setDisplayDesc(description);
      return;
    }

    setIsDescTruncated(true);
    const firstText = lines[0]?.text || '';
    const secondText = lines[1]?.text || '';
    const cutLen = Math.ceil(secondText.length * 0.7);
    const truncated = `${firstText} ${secondText.substring(0, cutLen).trimEnd()}`;
    setDisplayDesc(truncated);
  }, [description]);

  const handleToggleSave = useCallback(() => {
    if (!isLoggedIn) { showLoginModal(t.pleaseLoginToSave); return; }
    onToggleSave(house);
  }, [isLoggedIn, showLoginModal, t.pleaseLoginToSave, onToggleSave, house]);

  const handleMessage = useCallback(() => {
    onMessagePress(house);
  }, [onMessagePress, house]);

  const handleShare = useCallback(() => {
    onShare(house);
  }, [onShare, house]);

  const hasVideo = !!house.videoUrl;

  const handleReportPress = useCallback(() => {
    if (!isLoggedIn) {
      showLoginModal(t.pleaseLoginToView);
      return;
    }
    setReportSheetVisible(true);
  }, [isLoggedIn, showLoginModal, t.pleaseLoginToView]);

  const productName = house.productName || house.category || '';
  const amountText = house.amount || (house.price != null ? `RWF ${house.price.toLocaleString()}` : '');
  const hasAmount = !!amountText;

  return (
    <View style={[styles.card, { backgroundColor: theme.background }]}>
      {/* ---------- Full-bleed media with overlays ---------- */}
      <View style={[styles.cardMediaWrap, { height: mediaHeight }]}>
        {/* ---- TOP overlay: product name ---- */}
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.topMetaRow}>
            <View style={styles.topProductRow}>
              {!!productName && (
                <Text style={styles.topProductName} numberOfLines={1}>
                  {productName}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ---- Media ---- */}
        {hasVideo ? (
          <VideoPost
            videoUrl={house.videoUrl}
            videoThumbnail={house.videoThumbnail}
            videoLink={house.videoLink}
            videoDuration={house.videoDuration}
            theme={theme}
            isVisible={isVideoVisible}
            muted={isMuted}
            onMuteChange={onMuteChange}
            showPlaybackControls={false}
            onVideoPress={() => onPress(house)}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPress(house)}
            style={{ flex: 1 }}
          >
            <ImageSlider
              images={house.houseImages}
              isDarkMode={isDarkMode}
              height={mediaHeight}
              resizeMode={mediaResizeMode}
              loadingBackground={theme.mediaLoadingBackground}
            />
          </TouchableOpacity>
        )}

        {/* ---------- Right side vertical actions ---------- */}
        <View style={styles.rightActions}>
          {!isMyPost && (
            <TouchableOpacity style={styles.rightActionBtn} onPress={handleToggleSave} activeOpacity={0.8}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={32}
                color={isSaved ? '#47ae87' : '#ffffff'}
                style={styles.rightActionIcon}
              />
            </TouchableOpacity>
          )}

          {!isMyPost && (
            <TouchableOpacity style={styles.rightActionBtn} onPress={handleMessage} activeOpacity={0.8}>
              <Ionicons
                name="chatbubble-ellipses"
                size={30}
                color="#ffffff"
                style={styles.rightActionIcon}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.rightActionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons
              name="arrow-redo"
              size={30}
              color="#ffffff"
              style={styles.rightActionIcon}
            />
          </TouchableOpacity>

          {!isMyPost && (
            <TouchableOpacity
              style={styles.rightActionBtn}
              onPress={handleReportPress}
              activeOpacity={0.8}
            >
              <View style={styles.reportIconWrap}>
                <View style={[styles.menuIconLine, styles.menuIconLineFirst]} />
                <View style={[styles.menuIconLine, styles.menuIconLineFull]} />
                <View style={[styles.menuIconLine, styles.menuIconLineLast]} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ---------- Bottom overlay: user (left) + price (right), suggestion below ---------- */}
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          <View style={styles.bottomMetaRow}>
            <TouchableOpacity
              onPress={onUserPress}
              activeOpacity={0.85}
              style={styles.bottomUserRow}
            >
              <Image
                source={getImageSource(house.userAvatar)}
                style={styles.bottomUserAvatar}
              />
              <Text style={styles.bottomUserName} numberOfLines={1}>
                {getUserDisplayName(house.user || house, 'User')}
              </Text>
            </TouchableOpacity>

          </View>

          <View style={styles.suggestionInlineWrap}>
            <SuggestionOverlayContent
              isDarkMode={isDarkMode}
              theme={theme}
              house={house}
              onQuickSuggestion={onQuickSuggestion}
              isSendingSuggestion={isSendingSuggestion}
              suggestionState={suggestionState}
              t={t}
              isVideo={hasVideo}
              inline={true}
            />
          </View>
        </View>
      </View>

      {/* ---------- Description BELOW the image ---------- */}
      {(hasAmount || !!description) && (
        <View style={styles.descriptionSection}>
          {hasAmount && (
            <Text style={[styles.amountText, { color: theme.text }]} numberOfLines={1}>
              {amountText}
            </Text>
          )}

          {!!description && (hasVideo ? (
            <TouchableOpacity onPress={() => onPress(house)} activeOpacity={0.85}>
              <Text
                style={[styles.descText, { color: theme.text }]}
                numberOfLines={showFullDesc ? undefined : 2}
                ellipsizeMode="tail"
              >
                {showFullDesc ? description : displayDesc}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={[styles.descText, { color: theme.text }]}
              numberOfLines={showFullDesc ? undefined : 2}
              ellipsizeMode="tail"
            >
              {showFullDesc ? description : displayDesc}
            </Text>
          ))}

          {!!description && isDescTruncated && !showFullDesc && (
            <TouchableOpacity
              onPress={() => setShowFullDesc(true)}
              activeOpacity={0.7}
              style={styles.viewMoreBtn}
            >
              <Text style={[styles.viewMoreBtnText, { color: theme.login }]}>
                {t.viewMore}
              </Text>
              <Ionicons name="chevron-down" size={12} color={theme.login} />
            </TouchableOpacity>
          )}

          {!!description && showFullDesc && (
            <TouchableOpacity
              onPress={() => setShowFullDesc(false)}
              activeOpacity={0.7}
              style={styles.viewMoreBtn}
            >
              <Text style={[styles.viewMoreBtnText, { color: theme.login }]}>
                {t.viewLess}
              </Text>
              <Ionicons name="chevron-up" size={12} color={theme.login} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Hidden measure for truncation math */}
      {!!description && (
        <View style={styles.hiddenMeasure} pointerEvents="none" accessible={false}>
          <Text
            style={styles.cardDescription}
            onTextLayout={handleDescLayout}
          >
            {description}
          </Text>
        </View>
      )}

      <ReportReasonSheet
        visible={reportSheetVisible}
        onClose={() => setReportSheetVisible(false)}
        onSelect={reason => {
          setReportSheetVisible(false);
          onReport(house, reason);
        }}
        t={t}
        theme={theme}
      />
    </View>
  );
});

const ReelsFeed = React.memo(({
  reels,
  loading,
  navigation,
  onCloseVideos,
  theme,
  isDarkMode,
  onPostPress,
  isLoggedIn,
  savedPostIds,
  isMuted,
  onMuteChange,
  onToggleSave,
  onShare,
  onMessagePress,
  onReport,
  onUserPress,
  showLoginModal,
  t,
}) => {
  const isFocused = useIsFocused();
  const listRef = useRef(null);
  const swipeStartX = useRef(0);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState({});
  const [descriptionLineCounts, setDescriptionLineCounts] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [reportTarget, setReportTarget] = useState(null);
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const handleLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  const visibleItemsChanged = useRef(({ viewableItems }) => {
    const visibleItem = viewableItems.find(item => item.isViewable);
    if (visibleItem?.index == null) return;
    restoredReelIndex = visibleItem.index;
    setActiveIndex(visibleItem.index);
  }).current;

  useEffect(() => {
    if (!isFocused) videoPreloader.pauseAll();
  }, [isFocused]);

  useEffect(() => {
    if (!reels.length || containerHeight <= 0) return;
    const nextIndex = Math.min(restoredReelIndex, reels.length - 1);
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
    });
  }, [reels.length, containerHeight]);

  const handleMore = useCallback((reel) => {
    if (!isLoggedIn) {
      showLoginModal(t.pleaseLoginToView);
      return;
    }
    setReportTarget(reel);
  }, [isLoggedIn, showLoginModal, t]);

  const renderReel = useCallback(({ item, index }) => {
    const isSaved = savedPostIds.includes(item._id);
    const isDescriptionExpanded = !!expandedDescriptionIds[item._id];
    const hasLongDescription = (descriptionLineCounts[item._id] || 0) > 2;
    return (
      <View
        style={[styles.reelPage, { height: containerHeight, width: SCREEN_WIDTH }]}
        onTouchStart={event => { swipeStartX.current = event.nativeEvent.pageX; }}
        onTouchEnd={event => {
          const deltaX = event.nativeEvent.pageX - swipeStartX.current;
          if (Math.abs(deltaX) >= 70) {
            onCloseVideos();
          }
        }}
      >
        <TouchableOpacity
          style={styles.reelCloseButton}
          onPress={onCloseVideos}
          accessibilityRole="button"
          accessibilityLabel="Close video section"
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <VideoPost
          videoUrl={item.videoUrl}
          videoThumbnail={item.videoThumbnail}
          videoLink={item.videoLink}
          videoDuration={item.videoDuration}
          theme={theme}
          containerHeight={containerHeight}
          isVisible={isFocused && activeIndex === index}
          muted={isMuted}
          onMuteChange={onMuteChange}
          onVideoPress={() => onPostPress(item)}
        />

        <View style={styles.reelBottomShade} pointerEvents="none" />

        <View style={styles.reelInfo} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.reelUserRow}
            onPress={() => onUserPress(item.userId, item.username)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.username || 'user'} profile`}
          >
            <Image
              source={getImageSource(item.userAvatar)}
              style={styles.reelAvatarSmall}
            />
            <Text style={styles.reelUsername} numberOfLines={1}>
              {item.username || 'User'}
            </Text>
          </TouchableOpacity>

          {!!item.amount && (
            <Text style={styles.reelAmount} numberOfLines={1}>
              {item.amount}
            </Text>
          )}
        </View>

        {(!!item.productName || !!item.description) && (
          <View style={styles.reelDetails}>
            {!!item.productName && (
              <TouchableOpacity onPress={() => onPostPress(item)} activeOpacity={0.85}>
                <Text style={styles.reelProductName} numberOfLines={1}>
                  {item.productName}
                </Text>
              </TouchableOpacity>
            )}
            {!!item.description && (
              <>
                <TouchableOpacity onPress={() => onPostPress(item)} activeOpacity={0.85}>
                  <Text style={styles.reelCaption} numberOfLines={isDescriptionExpanded ? undefined : 2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={styles.reelDescriptionMeasure}
                  onTextLayout={event => {
                    const lineCount = event.nativeEvent.lines?.length || 0;
                    setDescriptionLineCounts(previous => (
                      previous[item._id] === lineCount
                        ? previous
                        : { ...previous, [item._id]: lineCount }
                    ));
                  }}
                >
                  {item.description}
                </Text>
                {hasLongDescription && (
                  <TouchableOpacity
                    onPress={() => setExpandedDescriptionIds(previous => ({
                      ...previous,
                      [item._id]: !isDescriptionExpanded,
                    }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reelReadMore}>
                      {isDescriptionExpanded ? t.viewLess : t.viewMore}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        <View style={styles.reelActions}>
          <TouchableOpacity
            style={styles.reelActionButton}
            onPress={() => onMessagePress(item)}
            accessibilityRole="button"
            accessibilityLabel="Reply"
          >
            <Ionicons name="chatbubble-ellipses" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reelActionButton}
            onPress={() => onShare(item)}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <Ionicons name="paper-plane-outline" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reelActionButton}
            onPress={() => {
              if (!isLoggedIn) return showLoginModal(t.pleaseLoginToSave);
              onToggleSave(item);
            }}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={28}
              color={isSaved ? '#47ae87' : '#fff'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reelActionButton}
            onPress={() => handleMore(item)}
            accessibilityRole="button"
            accessibilityLabel="More"
          >
            <View style={styles.reelMenuIconWrap}>
              <View style={[styles.reelMenuIconLine, styles.reelMenuIconLineShort]} />
              <View style={[styles.reelMenuIconLine, styles.reelMenuIconLineLong]} />
              <View style={[styles.reelMenuIconLine, styles.reelMenuIconLineMid]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    activeIndex, containerHeight, handleMore, isFocused, isLoggedIn, onCloseVideos, onPostPress,
    isMuted, onMessagePress, onMuteChange, onShare, onToggleSave,
    descriptionLineCounts, expandedDescriptionIds, navigation, onUserPress,
    savedPostIds, setDescriptionLineCounts, setExpandedDescriptionIds, showLoginModal, t,
  ]);

  if (loading && reels.length === 0) {
    return <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />;
  }

  return (
    <View style={styles.reelsContainer} onLayout={handleLayout}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(item, index) => `${item._id}_${index}`}
        renderItem={renderReel}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.min(restoredReelIndex, Math.max(0, reels.length - 1))}
        getItemLayout={(_, index) => ({
          length: containerHeight,
          offset: containerHeight * index,
          index,
        })}
        onViewableItemsChanged={visibleItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({
            offset: containerHeight * index,
            animated: false,
          });
        }}
      />
      <ReportReasonSheet
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onSelect={reason => {
          onReport(reportTarget, reason);
          setReportTarget(null);
        }}
        t={t}
        theme={theme}
      />
    </View>
  );
});

const BuyPostScreen = ({ navigation, language, initialTab = 'ushaka' }) => {
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const { showBottomSheet } = useBottomSheet();
  const route = useRoute();
  const t = translations[language] || translations.English;

  const [activeTab, setActiveTab] = useState(initialTab);
  const initialLoadStartedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState(null);
  const viewerId = currentUser?._id || authUser?._id || authUser?.id;
  const isOwnPost = useCallback((post) => {
    const ownerId = getPostOwnerId(post);
    return Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));
  }, [viewerId]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isAppendingFeed, setIsAppendingFeed] = useState(false);
  const [feedLoopCount, setFeedLoopCount] = useState(3);
  const isExtendingFeedLoop = useRef(false);
  const [myPosts, setMyPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [loginSheetVisible, setLoginSheetVisible] = useState(false);
  const [loginSheetMessage, setLoginSheetMessage] = useState('');
  const [activeVideoKey, setActiveVideoKey] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoDataRef = useRef([]);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30,
    minimumViewTime: 150,
  }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visibleVideos = viewableItems
      .filter(({ isViewable, item }) => isViewable && item?.videoUrl)
      .sort((first, second) => (second?.percentVisible || 0) - (first?.percentVisible || 0));
    const visibleVideo = visibleVideos[0];
    const activeKey = visibleVideo ? `${visibleVideo.item._id}_${visibleVideo.index}` : null;
    videoPreloader.activeVideoKey = activeKey;
    setActiveVideoKey(activeKey);

    if (activeKey) {
      const data = videoDataRef.current;
      const activeIndex = visibleVideo.index;
      data.slice(activeIndex + 1, activeIndex + 3).forEach((item, offset) => {
        if (item?.videoUrl) {
          videoPreloader.preloadVideo(item.videoUrl, `${item._id}_${activeIndex + offset + 1}`);
        }
      });
      videoPreloader.cleanupOldVideos();
    }
  }).current;

  const [suggestionStates, setSuggestionStates] = useState({});
  const [isSendingSuggestion, setIsSendingSuggestion] = useState(false);
  const quickStatusTimerRef = useRef(null);

  const getSuggestionState = useCallback((postId) => {
    return suggestionStates[postId] || { status: 'idle', message: '', sentText: '' };
  }, [suggestionStates]);

  const updateSuggestionState = useCallback((postId, state) => {
    setSuggestionStates(prev => ({ ...prev, [postId]: state }));
    if (state.status === 'success' || state.status === 'error') {
      if (quickStatusTimerRef.current) clearTimeout(quickStatusTimerRef.current);
      quickStatusTimerRef.current = setTimeout(() => {
        setSuggestionStates(prev => ({ ...prev, [postId]: { status: 'idle', message: '', sentText: '' } }));
      }, 2500);
    }
  }, []);

  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerHeightAnim = useRef(new Animated.Value(HEADER_HEIGHT)).current;
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;
  const feedListRef = useRef(null);
  const gridListRef = useRef(null);

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const addSheetAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
  const [newUpdateTitle, setNewUpdateTitle] = useState('');
  const [newUpdateMessage, setNewUpdateMessage] = useState('');

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const detailSheetAnim = useRef(new Animated.Value(DETAIL_SHEET_HEIGHT)).current;
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  useEffect(() => {
    const loadMutePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem('videoMuted');
        if (saved !== null) {
          setIsMuted(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('Failed to load mute preference:', error);
      }
    };
    loadMutePreference();
  }, []);

  const handleMuteChange = useCallback((newMuted) => {
    setIsMuted(newMuted);
    AsyncStorage.setItem('videoMuted', JSON.stringify(newMuted)).catch(console.warn);
  }, []);

  const loadViewedTimestamps = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('buyPostUpdateViewedTimestamps');
      if (stored) {
        return JSON.parse(stored);
      }
      return {};
    } catch (error) {
      console.error('Error loading viewed timestamps:', error);
      return {};
    }
  }, []);

  const saveViewedTimestamp = useCallback(async (updateId) => {
    try {
      const timestamps = await loadViewedTimestamps();
      timestamps[updateId] = new Date().toISOString();
      await AsyncStorage.setItem('buyPostUpdateViewedTimestamps', JSON.stringify(timestamps));
    } catch (error) {
      console.error('Error saving viewed timestamp:', error);
    }
  }, [loadViewedTimestamps]);

  const markUpdateAsRead = useCallback(async (updateId) => {
    await saveViewedTimestamp(updateId);
    setUpdates(prev => prev.map(u =>
      u.id === updateId
        ? { ...u, lastViewedAt: new Date().toISOString() }
        : u
    ));
  }, [saveViewedTimestamp]);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    setShowBackToTop(currentScrollY > 200);

    const headerCollapse = Math.min(currentScrollY, HEADER_HEIGHT);
    headerHeightAnim.setValue(Math.max(HEADER_HEIGHT - headerCollapse, 0));
    headerOpacityAnim.setValue(Math.max(1 - currentScrollY / (HEADER_HEIGHT + 20), 0));
  }, [headerHeightAnim, headerOpacityAnim]);

  const scrollToTop = useCallback(() => {
    if (activeTab === 'ushaka' || activeTab === 'videos') {
      feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      gridListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    headerHeightAnim.setValue(HEADER_HEIGHT);
    headerOpacityAnim.setValue(1);
    setShowBackToTop(false);
  }, [activeTab, headerHeightAnim, headerOpacityAnim]);

  const closeVideos = useCallback(() => {
    const feedTabKey = POST_SECTIONS.feed.key;
    const feedRoute = POST_SECTIONS.feed.route;

    if (route.name === 'BuyPost') {
      setActiveTab(feedTabKey);
      return;
    }

    if (route.name === 'Main') {
      navigation.navigate('Main', { screen: 'BuyPost', params: { activeTab: feedTabKey } });
      return;
    }

    if (route.name === 'Videos') {
      navigation.navigate(feedRoute, { activeTab: feedTabKey });
      return;
    }

    navigation.navigate('Main', { screen: 'BuyPost', params: { activeTab: feedTabKey } });
  }, [navigation, route.name]);

  useEffect(() => {
    setShowBackToTop(false);
    headerHeightAnim.setValue(HEADER_HEIGHT);
    headerOpacityAnim.setValue(1);
  }, [activeTab, headerHeightAnim, headerOpacityAnim]);

  // ---------------------------------------------------------------
  // Tab synchronization with navigation params.
  //
  // IMPORTANT: this effect must ONLY depend on `route.params?.activeTab`
  // (NOT on `activeTab`). If it depended on `activeTab`, manually
  // switching to Videos / My Posts / Saved would re-trigger the effect
  // and bounce the user back to the initial tab.
  // ---------------------------------------------------------------
  useEffect(() => {
    const paramTab = route.params?.activeTab;
    if (paramTab && POST_SECTION_KEYS.includes(paramTab)) {
      setActiveTab(paramTab);
    }
  }, [route.params?.activeTab]);

  useEffect(() => {
    setActiveVideoKey(null);
    videoPreloader.clearAll();
  }, [activeTab]);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    }
  }, [authUser]);

  const getToken = useCallback(async () => await AsyncStorage.getItem('userToken'), []);

  const checkLoginStatus = useCallback(async () => {
    const loggedIn = await AsyncStorage.getItem('isLoggedIn');
    setIsLoggedIn(loggedIn === 'true');
    if (loggedIn === 'true') await loadCurrentUser();
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCurrentUser(response.data.user);
      } else if (authUser) {
        setCurrentUser(authUser);
      }
    } catch (error) {
      console.error('Load current user error:', error);
      if (authUser) setCurrentUser(authUser);
    }
  }, [getToken, authUser]);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/notes`);
      const viewedTimestamps = await loadViewedTimestamps();
      const notes = (response.data.notes || []).map(note => ({
        id: note._id,
        title: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
        message: note.text,
        fullDetails: note.text,
        link: note.link || '',
        timestamp: note.createdAt,
        type: 'admin_note',
        isRead: note.isRead || false,
        lastViewedAt: viewedTimestamps[note._id] || null,
      }));
      return notes;
    } catch (error) {
      console.error('Notes fetch failed:', error.message);
      return [];
    }
  }, [loadViewedTimestamps]);

  const fetchFeed = useCallback(async (page = 1, limit = 20) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/posts`, {
        params: { page, limit },
      });
      const activePosts = (response.data.posts || []).map(mapPost).filter(p => p.status !== 'stopped');
      return { posts: activePosts, hasMore: response.data.hasMore !== false };
    } catch (error) {
      console.error('Public feed fetch failed:', error.message);
      if (page === 1) {
        const cachedFeed = await offlineDatabase.getRecord('feed', 'page-1');
        if (cachedFeed) {
          const hydratedFeed = await mediaCache.hydrate(cachedFeed);
          return {
            posts: hydratedFeed.map(mapPost).filter(post => post.status !== 'stopped'),
            hasMore: false,
          };
        }
      }
      throw error;
    }
  }, []);

  const fetchMyPosts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.get(`${BASE_URL}/api/posts/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return (response.data.posts || []).map(mapPost).filter(p => p.status !== 'stopped');
    } catch (error) {
      console.error('Fetch my posts error:', error);
      return [];
    }
  }, [getToken]);

  const fetchSavedPosts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.get(`${BASE_URL}/api/posts/saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const posts = (response.data.posts || []).map(mapPost).filter(p => p.status !== 'stopped');
      setSavedPostIds(posts.map(p => p._id));
      return posts;
    } catch (error) {
      console.error('Fetch saved posts error:', error);
      return [];
    }
  }, [getToken]);

  // Silent refresh for a single tab (My Posts / Saved).
  // Does NOT flip `loading` → no spinner, no blank screen.
  const refreshTabData = useCallback(async (tabKey) => {
    if (!isLoggedIn) return;
    try {
      if (tabKey === 'utanga') {
        const my = await fetchMyPosts();
        setMyPosts(my);
      } else if (tabKey === 'saved') {
        const saved = await fetchSavedPosts();
        setSavedPosts(saved);
      }
    } catch (error) {
      console.error('Silent tab refresh error:', error);
    }
  }, [isLoggedIn, fetchMyPosts, fetchSavedPosts]);

  // When the user opens My Posts or Saved, silently re-fetch that
  // list in the background so content is always fresh — without
  // showing any loading indicator.
  useEffect(() => {
    if (activeTab === 'utanga' || activeTab === 'saved') {
      refreshTabData(activeTab);
    }
  }, [activeTab, refreshTabData]);

  const sortFeedPosts = useCallback((posts, shuffleNonFeatured = false) => {
    const featured = posts.filter(p => p.featured);
    const nonFeatured = posts.filter(p => !p.featured);
    featured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (shuffleNonFeatured) {
      const shuffled = shuffleArray(nonFeatured);
      return [...featured, ...shuffled];
    } else {
      nonFeatured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return [...featured, ...nonFeatured];
    }
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    setLoading(true);
    setFeedError(false);

    try {
      const [feed, notes] = await Promise.all([fetchFeed(), fetchNotes()]);
      let filteredFeed = feed.posts;
      if (isLoggedIn && currentUser) {
        filteredFeed = feed.posts.filter(post => post.userId !== currentUser._id);
      }
      const sortedFeed = sortFeedPosts(filteredFeed, isRefresh);
      setFeedPosts(sortedFeed);
      setFeedPage(1);
      setHasMoreFeed(feed.hasMore);
      setUpdates(notes);
      if (isLoggedIn) {
        const [my, saved] = await Promise.all([fetchMyPosts(), fetchSavedPosts()]);
        setMyPosts(my);
        setSavedPosts(saved);
      } else {
        setMyPosts([]);
        setSavedPosts([]);
        setSavedPostIds([]);
      }
    } catch (error) {
      console.error('Load data error:', error);
      setFeedError(true);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, currentUser, fetchFeed, fetchNotes, fetchMyPosts, fetchSavedPosts, sortFeedPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    headerHeightAnim.setValue(HEADER_HEIGHT);
    headerOpacityAnim.setValue(1);
    setShowBackToTop(false);
    await loadData(true);
    setRefreshing(false);
  }, [headerHeightAnim, headerOpacityAnim, loadData]);

  const toggleSave = useCallback(async (post) => {
    if (!isLoggedIn) {
        setLoginSheetMessage(t.pleaseLoginToSave);
        setLoginSheetVisible(true);
        return;
    }
    try {
      const token = await getToken();
      const response = await axios.post(
        `${BASE_URL}/api/posts/save/${post._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        if (response.data.saved) {
          setSavedPostIds(prev => [...prev, post._id]);
          setSavedPosts(prev => [mapPost(post), ...prev]);
        } else {
          setSavedPostIds(prev => prev.filter(id => id !== post._id));
          setSavedPosts(prev => prev.filter(p => p._id !== post._id));
        }
      }
    } catch (error) {
      console.error('Toggle save error:', error);
      Alert.alert('Error', 'Failed to save/unsave post');
    }
  }, [isLoggedIn, t.pleaseLoginToSave, getToken]);

  const sendQuickSuggestion = useCallback(async (house, text) => {
    if (!isLoggedIn) {
      setLoginSheetMessage(t.pleaseLoginToMessage);
      setLoginSheetVisible(true);
      return;
    }
    try {
      const sellerId = house.userId;
      if (!sellerId) {
        Alert.alert('Error', t.sellerInfoMissing);
        return;
      }
      const token = await getToken();
      if (!token) {
        setLoginSheetMessage(t.pleaseLoginToMessage);
        setLoginSheetVisible(true);
        return;
      }
      setIsSendingSuggestion(true);
      updateSuggestionState(house._id, { status: 'sending', message: t.sending, sentText: text });
      const sellerDisplayName = getUserDisplayName(house.user || house, 'User');
      const replyPost = {
        postId: house._id,
        title: house.productName || house.title || 'Product',
        description: house.description || '',
        image: (house.houseImages && house.houseImages.length > 0)
          ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0])
          : null,
        price: house.price ?? null,
        amount: house.amount || '',
        location: house.location || '',
        category: house.category || '',
        bedrooms: house.bedrooms ?? null,
        bathrooms: house.bathrooms ?? null,
        size: house.size ?? null,
        priceNegotiable: !!house.priceNegotiable,
        contactNumbers: house.contactNumbers || [],
        houseImages: house.houseImages || [],
        videoUrl: house.videoUrl || '',
        username: sellerDisplayName,
        userAvatar: house.userAvatar || house.user?.avatar || '',
        ownerId: sellerId,
        timestamp: house.createdAt || new Date().toISOString(),
      };
      const messageData = {
        postId: house._id,
        postTitle: house.productName || house.title || '',
        postUser: sellerDisplayName,
        senderId: currentUser?._id,
        senderName: currentUser?.name || currentUser?.username || 'Me',
        senderPhone: currentUser?.phone || '',
        senderAvatar: currentUser?.avatar || '',
        receiverId: sellerId,
        receiverName: sellerDisplayName,
        receiverPhone: house.contactNumber1 || house.contactNumber2 || '',
        text,
        imageUrl: null,
        repliedTo: null,
        replyPost: replyPost,
      };
      await axios.post(
        `${BASE_URL}/api/messages/send`,
        messageData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      try {
        await axios.post(`${BASE_URL}/api/notifications`, {
          userId: sellerId,
          type: 'message',
          message: text,
          data: { postId: house._id, senderId: currentUser?._id, senderName: currentUser?.name || currentUser?.username || 'User', hasPostReply: true },
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal)');
      }
      updateSuggestionState(house._id, { status: 'success', message: t.messageSent, sentText: text });
    } catch (error) {
      console.error('Quick send failed', error);
      if (error.response?.status === 401) {
        setLoginSheetMessage(t.pleaseLoginToMessage);
        setLoginSheetVisible(true);
        updateSuggestionState(house._id, { status: 'idle', message: '', sentText: '' });
      } else {
        updateSuggestionState(house._id, { status: 'error', message: t.messageSentFailed, sentText: text });
      }
    } finally {
      setIsSendingSuggestion(false);
    }
  }, [isLoggedIn, t, getToken, currentUser, updateSuggestionState]);

  const handleDeletePost = useCallback(async (postId) => {
    try {
      const token = await getToken();
      await axios.delete(`${BASE_URL}/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyPosts(prev => prev.filter(p => p._id !== postId));
      setSavedPosts(prev => prev.filter(p => p._id !== postId));
      setSavedPostIds(prev => prev.filter(id => id !== postId));
    } catch (error) {
      console.error('Delete post error:', error);
      Alert.alert('Error', 'Failed to delete post');
    }
  }, [getToken]);

  const confirmDeletePost = useCallback((postId) => {
    Alert.alert(
      t.deletePost,
      t.deleteConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: () => handleDeletePost(postId) },
      ]
    );
  }, [t, handleDeletePost]);

  const [appShareLink, setAppShareLink] = useState('');

  useEffect(() => {
    const loadShareLink = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/settings/share-link`);
        if (response.data.success) {
          setAppShareLink(response.data.shareLink || '');
        }
      } catch (error) {
        console.error('Load share link error:', error.message);
      }
    };
    loadShareLink();
  }, []);

  const handleShare = useCallback(async (post) => {
    try {
      const link = appShareLink || 'https://shaaka.app';
      await Share.share({
        message: `${post.productName || 'Product'} - ${post.location}\n${post.description}\n\n${link}`,
        title: post.productName || 'Product'
      });
    } catch (error) { console.log(error); }
  }, [appShareLink]);

  const handlePostPress = useCallback((post) => {
    if (activeTab !== 'utanga' && isOwnPost(post)) return;
    if (!isLoggedIn) {
        showBottomSheet({
          type: 'login',
          title: t.loginRequired,
          message: t.pleaseLoginToView,
          buttonText: 'Login',
          secondaryButtonText: t.cancel,
          buttonAction: () => navigation.navigate('Login'),
        });
        return;
    }
    navigation.navigate('PostDetail', { house: post, language });
  }, [activeTab, isOwnPost, isLoggedIn, t, navigation, language, showBottomSheet]);

  const handleUserPress = useCallback((userId, username) => {
    if (!isLoggedIn) {
      showBottomSheet({
        type: 'login',
        title: t.loginRequired,
        message: t.pleaseLoginToProfile,
        buttonText: 'Login',
        secondaryButtonText: t.cancel,
        buttonAction: () => navigation.navigate('Login'),
      });
      return;
    }
    navigation.navigate('Profile', { userId, username });
  }, [isLoggedIn, t, navigation, showBottomSheet]);

  const handleMessagePress = useCallback((house) => {
    if (!isLoggedIn) {
      showBottomSheet({
        type: 'login',
        title: t.loginRequired,
        message: t.pleaseLoginToMessage,
        buttonText: 'Login',
        secondaryButtonText: t.cancel,
        buttonAction: () => navigation.navigate('Login'),
      });
      return;
    }
    const sellerId = house.userId;
    if (!sellerId) {
      Alert.alert('Error', t.sellerInfoMissing);
      return;
    }
    const sellerDisplayName = getUserDisplayName(house.user || house, 'Seller');
    const replyPost = {
      postId: house._id,
      contextType: 'post',
      title: house.productName || house.title || 'Product',
      description: house.description || '',
      image: (house.houseImages && house.houseImages.length > 0)
        ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0])
        : null,
      price: house.price ?? null,
      amount: house.amount || '',
      location: house.location || '',
      category: house.category || '',
      bedrooms: house.bedrooms ?? null,
      bathrooms: house.bathrooms ?? null,
      size: house.size ?? null,
      priceNegotiable: !!house.priceNegotiable,
      contactNumbers: house.contactNumbers || [],
      houseImages: house.houseImages || [],
      videoUrl: house.videoUrl || '',
      username: sellerDisplayName,
      userAvatar: house.userAvatar || house.user?.avatar || '',
      ownerId: sellerId,
      timestamp: house.createdAt || new Date().toISOString(),
    };
    navigation.navigate('Chat', {
      sellerId: sellerId,
      sellerName: sellerDisplayName,
      sellerAvatar: house.userAvatar || '',
      sellerPhone: house.contactNumber1 || house.contactNumber2 || '',
      postId: house._id,
      postTitle: house.productName || 'Product',
      replyPost: replyPost,
    });
  }, [isLoggedIn, t, navigation]);

  const handleReport = useCallback(async (post, reason) => {
    try {
      const token = await getToken();
      await axios.post(
        `${BASE_URL}/api/reports`,
        { postId: post._id, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t.reported, t.thanksForReport.replace('%s', reason));
    } catch (error) {
      const msg = error.response?.data?.message || t.reportFailed;
      Alert.alert(t.error, msg);
    }
  }, [getToken, t]);

  useEffect(() => {
    Animated.timing(addSheetAnim, {
      toValue: addSheetVisible ? 0 : BOTTOM_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [addSheetVisible, addSheetAnim]);

  const closeAddSheet = useCallback(() => setAddSheetVisible(false), []);
  const addNewUpdate = useCallback(() => {
    if (!newUpdateTitle.trim()) {
      Alert.alert(t.titleRequired, t.enterTitle);
      return;
    }
    const newUpdate = {
      id: 'user_' + Date.now(),
      type: 'user',
      title: newUpdateTitle,
      message: newUpdateMessage || t.noDescription,
      timestamp: new Date().toISOString(),
      fullDetails: newUpdateMessage || t.noDescription,
      isRead: false,
      lastViewedAt: null,
    };
    setUpdates(prev => [newUpdate, ...prev]);
    closeAddSheet();
  }, [newUpdateTitle, newUpdateMessage, t, closeAddSheet]);

  useEffect(() => {
    Animated.timing(detailSheetAnim, {
      toValue: detailSheetVisible ? 0 : DETAIL_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [detailSheetVisible, detailSheetAnim]);

  const closeDetailSheet = useCallback(() => setDetailSheetVisible(false), []);

  const openSocialLink = useCallback(async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    } catch (error) {
      if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    }
  }, []);

  const renderSocialIcons = useCallback(() => (
    <View style={styles.socialIconsFooter}>
      <Text style={[styles.followText, { color: theme.textSecondary }]}>{t.followUs}</Text>
      <View style={styles.socialIconsRow}>
        {socialLinks.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.socialIconSmall}
            onPress={() => openSocialLink(item.url, item.fallbackUrl)}
            activeOpacity={0.7}
          >
            <View style={[styles.socialIconCircleSmall, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [theme.textSecondary, t.followUs, openSocialLink]);

  const browseFeedPosts = useMemo(
    () => feedPosts.filter(post => !isOwnPost(post)),
    [feedPosts, isOwnPost]
  );

  const getDisplayedPosts = useCallback(() => {
    const posts = getPostsForSection({
      sectionKey: activeTab,
      feedPosts: browseFeedPosts,
      myPosts: isLoggedIn ? myPosts : [],
      savedPosts: isLoggedIn ? savedPosts : [],
    });
    return activeTab === 'utanga' ? posts : posts.filter(post => !isOwnPost(post));
  }, [activeTab, browseFeedPosts, isLoggedIn, isOwnPost, myPosts, savedPosts]);

  const loopedFeedData = useMemo(() => {
    if (activeTab !== 'ushaka' || !browseFeedPosts || browseFeedPosts.length === 0) return [];
    return Array.from({ length: feedLoopCount }, () => browseFeedPosts).flat();
  }, [activeTab, browseFeedPosts, feedLoopCount]);

  const stripProducts = useMemo(() => {
    if (browseFeedPosts.length <= 10) return shuffleArray(browseFeedPosts);
    const rotatedPosts = [...browseFeedPosts.slice(10), ...browseFeedPosts.slice(0, 10)];
    return shuffleArray(rotatedPosts).slice(0, 10);
  }, [browseFeedPosts]);

  const trendingPosts = useMemo(
    () => browseFeedPosts.filter(post => post.trending && post.status !== 'stopped'),
    [browseFeedPosts]
  );

  const feedStreamData = useMemo(() => {
    if (loopedFeedData.length === 0) return [];
    const stream = [];
    const columnBatchSizes = [6, 7];
    let postIndex = 0;
    let rowIndex = 0;

    while (postIndex < loopedFeedData.length) {
      const batchSize = columnBatchSizes[rowIndex % columnBatchSizes.length];
      stream.push(...loopedFeedData.slice(postIndex, postIndex + batchSize));

      const rowSource = trendingPosts.length > 0 ? trendingPosts : stripProducts;
      const rowOffset = rowSource.length > 0
        ? (rowIndex === 0 ? 0 : (rowIndex * 2) % rowSource.length)
        : 0;
      const rowProducts = rowSource.length > 0
        ? [...rowSource.slice(rowOffset), ...rowSource.slice(0, rowOffset)]
        : [];
      stream.push({
        isFeedProductStrip: true,
        stripId: `feed-strip-${rowIndex}`,
        products: rowProducts,
      });

      postIndex += batchSize;
      rowIndex += 1;
    }

    return stream;
  }, [loopedFeedData, stripProducts, trendingPosts]);

  useEffect(() => {
    videoDataRef.current = activeTab === 'ushaka' ? feedStreamData : getDisplayedPosts();
  }, [activeTab, feedStreamData, getDisplayedPosts]);

  const handleFeedEndReached = useCallback(async () => {
    if (activeTab !== 'ushaka' || refreshing || feedError || isAppendingFeed) return;
    if (!hasMoreFeed) return;
    if (!feedPosts || feedPosts.length === 0) return;
    setIsAppendingFeed(true);
    try {
      const nextPage = feedPage + 1;
      const result = await fetchFeed(nextPage, 20);
      const combined = [...feedPosts, ...result.posts];
      const sortedCombined = sortFeedPosts(combined, false);
      setFeedPosts(sortedCombined);
      setFeedPage(nextPage);
      setHasMoreFeed(result.hasMore);
    } catch (error) {
      Alert.alert('Error', 'Failed to load more posts.');
      setFeedError(true);
    } finally {
      setIsAppendingFeed(false);
    }
  }, [activeTab, refreshing, feedError, isAppendingFeed, hasMoreFeed, feedPosts, feedPage, fetchFeed, sortFeedPosts]);

  const handleFeedLoopEndReached = useCallback(() => {
    if (activeTab !== 'ushaka' || isExtendingFeedLoop.current || feedPosts.length === 0) return;
    isExtendingFeedLoop.current = true;
    setFeedLoopCount(previous => previous + 3);
    handleFeedEndReached();
    requestAnimationFrame(() => {
      isExtendingFeedLoop.current = false;
    });
  }, [activeTab, feedPosts.length, handleFeedEndReached]);

  useEffect(() => { checkLoginStatus(); }, [checkLoginStatus]);
  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    loadData(initialTab === 'ushaka');
  }, [initialTab, loadData]);

  useFocusEffect(useCallback(() => () => {
    setActiveVideoKey(null);
    videoPreloader.pauseAll();
    videoPreloader.clearAll();
  }, []));

  const renderGridPostItem = useCallback(({ item }) => {
    const isSavedTab = activeTab === 'saved';
    const showDelete = isLoggedIn && !isSavedTab;
    const imageUri = item.videoUrl
      ? getVideoCover(item.videoUrl, item.videoThumbnail)
      : item.houseImages?.[0];
    return (
      <View style={styles.gridPostItem}>
        <TouchableOpacity style={styles.gridPostImageContainer} onPress={() => handlePostPress(item)}>
          <Image source={{ uri: imageUri || item.houseImages?.[0] || 'https://via.placeholder.com/150' }} style={styles.gridPostImage} />
          {item.videoUrl && (
            <View style={styles.videoCoverBadge}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          )}
          {isSavedTab && (
            <TouchableOpacity style={styles.unsaveButton} onPress={() => toggleSave(item)}>
              <Ionicons name="bookmark" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {showDelete && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)' }]}
            onPress={() => confirmDeletePost(item._id)}
          >
            <View style={styles.gridMenuIconWrapper}>
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineShort, { backgroundColor: '#47ae87' }]} />
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineLong, { backgroundColor: '#47ae87' }]} />
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineMid, { backgroundColor: '#47ae87' }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [activeTab, isLoggedIn, isDarkMode, handlePostPress, toggleSave, confirmDeletePost]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.textSecondary} compact />
        </View>
      );
    }

    if (feedError && activeTab === 'ushaka') {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={50} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary, marginTop: 12 }]}>{t.feedLoadError}</Text>
          <TouchableOpacity style={[styles.loginEmptyButton, { backgroundColor: theme.accent }]} onPress={() => loadData(true)}>
            <Text style={styles.loginEmptyButtonText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    let message = t.noPosts;
    let showLogin = false;
    if (!isLoggedIn) {
      message = t.pleaseLogin;
      showLogin = true;
    } else if (activeTab === 'utanga') {
      message = t.noMyPosts;
    } else if (activeTab === 'saved') {
      message = t.noSavedPosts;
    } else if (activeTab === 'videos') {
      message = t.noVideos;
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{message}</Text>
        {showLogin && (
          <TouchableOpacity style={[styles.loginEmptyButton, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginEmptyButtonText}>Login</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loading, feedError, activeTab, isLoggedIn, theme, t, loadData, navigation]);

  const renderHouseCard = useCallback(({ item, index }) => {
    const videoKey = `${item._id}_${index}`;
    return (
    <HouseCard
      house={item}
      theme={theme}
      isDarkMode={isDarkMode}
      onPress={handlePostPress}
      onShare={handleShare}
      isSaved={savedPostIds.includes(item._id)}
      onToggleSave={toggleSave}
      isLoggedIn={isLoggedIn}
      showLoginModal={(msg) => {
        showBottomSheet({
          type: 'login',
          title: t.loginRequired,
          message: msg,
          buttonText: 'Login',
          secondaryButtonText: t.cancel,
          buttonAction: () => navigation.navigate('Login'),
        });
      }}
      isMyPost={false}
      onUserPress={() => handleUserPress(item.userId, item.username)}
      onReport={handleReport}
      onMessagePress={handleMessagePress}
      t={t}
      onQuickSuggestion={sendQuickSuggestion}
      isSendingSuggestion={isSendingSuggestion}
      suggestionState={getSuggestionState(item._id)}
      videoKey={videoKey}
      isVideoVisible={activeVideoKey === videoKey}
      isMuted={isMuted}
      onMuteChange={handleMuteChange}
    />
    );
  }, [theme, isDarkMode, handlePostPress, handleShare, savedPostIds, toggleSave, isLoggedIn, handleUserPress, handleReport, handleMessagePress, t, sendQuickSuggestion, isSendingSuggestion, getSuggestionState, activeVideoKey, isMuted, handleMuteChange, showBottomSheet, navigation]);

  const renderFeedItem = useCallback(({ item, index }) => {
    if (item.isFeedProductStrip) {
      return (
        <FeedProductStrip
          title={t.trending}
          products={item.products}
          onPress={handlePostPress}
          onUserPress={handleUserPress}
          isDarkMode={isDarkMode}
        />
      );
    }
    return renderHouseCard({ item, index });
  }, [handlePostPress, renderHouseCard, t.trending, trendingPosts, isDarkMode]);

  const shouldShowUnread = useCallback((update) => {
    if (!update.lastViewedAt) return true;
    const lastViewedDate = new Date(update.lastViewedAt);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - lastViewedDate.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return hoursDiff >= 24;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[
          styles.topBar,
          activeTab === 'videos' && styles.reelsHidden,
          {
            height: headerHeightAnim,
            opacity: headerOpacityAnim,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            overflow: 'hidden',
          }
        ]}
      >
        <View style={styles.headerRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRowScroll}
            style={styles.tabScroll}
          >
            {[
              { ...POST_SECTIONS.feed, label: t.feed, icon: 'grid-outline' },
              { ...POST_SECTIONS.videos, label: t.videos, icon: 'videocam-outline' },
              { ...POST_SECTIONS.myPosts, label: t.myPosts, icon: 'person-outline' },
              { ...POST_SECTIONS.saved, label: t.saved, icon: 'bookmark-outline' },
            ].map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tabCircleItem}
                  onPress={() => {
                    if (route.name === 'BuyPost') {
                      // In-place tab switch on the main BuyPost screen.
                      if (activeTab !== tab.key) setActiveTab(tab.key);
                    } else if (route.name !== tab.route) {
                      // Cross-route navigation to a sibling section screen.
                      // Pass activeTab so the mounted screen aligns immediately.
                      navigation.navigate(tab.route, { activeTab: tab.key });
                    }
                  }}
                >
                  <View style={[styles.tabCircleRing, { borderColor: isActive ? '#489860' : '#8e8e93' }]}>
                    <View style={[styles.tabCircleAvatar, { backgroundColor: isActive ? '#4a865c' : theme.accent }]}>
                      <Ionicons name={tab.icon} size={20} color="#fff" />
                    </View>
                  </View>
                  <Text style={[styles.tabCircleLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={[styles.tabSeparator, { backgroundColor: theme.border || '#ccc' }]} />
            {updates.slice(0, 10).map(update => {
              const isUnread = shouldShowUnread(update);
              const unreadCount = isUnread ? 1 : 0;
              return (
                <TouchableOpacity
                  key={update.id}
                  style={styles.tabCircleItem}
                  onPress={() => {
                    markUpdateAsRead(update.id);
                    setSelectedUpdate(update);
                    setDetailSheetVisible(true);
                  }}
                >
                  <View style={[styles.tabCircleRing, { borderColor: '#8e8e93' }]}>
                    <View style={[styles.tabCircleAvatar, { backgroundColor: theme.accent }]}>
                      <Ionicons
                        name={update.link ? 'link-outline' : 'notifications-outline'}
                        size={24}
                        color="#fff"
                      />
                    </View>
                    {unreadCount > 0 && (
                      <View style={styles.updateUnreadBadgeNumber}>
                        <Text style={styles.updateUnreadBadgeText}>{unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.tabCircleLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                    {update.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {activeTab === 'videos' ? (
        <ReelsFeed
          reels={getDisplayedPosts()}
          loading={loading}
          navigation={navigation}
          onCloseVideos={closeVideos}
          theme={theme}
          isDarkMode={isDarkMode}
          onPostPress={handlePostPress}
          isLoggedIn={isLoggedIn}
          savedPostIds={savedPostIds}
          isMuted={isMuted}
          onMuteChange={handleMuteChange}
          onToggleSave={toggleSave}
          onShare={handleShare}
          onMessagePress={handleMessagePress}
          onReport={handleReport}
          onUserPress={handleUserPress}
          showLoginModal={(message) => showBottomSheet({
            type: 'login',
            title: t.loginRequired,
            message,
            buttonText: 'Login',
            secondaryButtonText: t.cancel,
            buttonAction: () => navigation.navigate('Login'),
          })}
          t={t}
        />
      ) : activeTab === 'ushaka' ? (
        <Animated.View style={[styles.contentArea, { marginTop: headerHeightAnim }]}>
          <FlatList
            ref={feedListRef}
            data={feedStreamData}
            keyExtractor={(item, index) => item.isFeedProductStrip ? item.stripId : `${item._id}_${index}`}
            renderItem={renderFeedItem}
            ListHeaderComponent={
              <View>
                <FeedProductStrip
                  title={t.trending}
                  products={trendingPosts}
                  onPress={handlePostPress}
                  onUserPress={handleUserPress}
                  isDarkMode={isDarkMode}
                />
                <Text style={[styles.newPostsTitle, { color: isDarkMode ? '#dddddd' : '#111111' }]}>
                  {t.newPosts}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
            ListEmptyComponent={renderEmpty}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            onEndReached={handleFeedLoopEndReached}
            onEndReachedThreshold={0.5}
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.contentArea, { marginTop: headerHeightAnim }]}>
          <FlatList
            ref={gridListRef}
            key={activeTab}
            data={getDisplayedPosts()}
            keyExtractor={(item, index) => `${item._id}_${index}`}
            renderItem={renderGridPostItem}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.postsGrid}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
            ListEmptyComponent={renderEmpty}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        </Animated.View>
      )}

      {showBackToTop && (
        <TouchableOpacity
          style={[styles.showHeaderButton, { backgroundColor: theme.login }]}
          onPress={scrollToTop}
          activeOpacity={0.9}
        >
          <Ionicons name="chevron-up-circle" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {activeTab === 'utanga' && isLoggedIn && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('AddPost')}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <BuyLoginSheet
        visible={loginSheetVisible}
        message={loginSheetMessage}
        onClose={() => setLoginSheetVisible(false)}
        onLogin={() => { setLoginSheetVisible(false); navigation.navigate('Login'); }}
      />
      {addSheetVisible && <TouchableWithoutFeedback onPress={closeAddSheet}><View style={styles.sheetOverlay} /></TouchableWithoutFeedback>}
      <Animated.View style={[styles.bottomSheet, { backgroundColor: theme.cardBackground, transform: [{ translateY: addSheetAnim }] }]}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          placeholderTextColor={theme.textSecondary}
          value={newUpdateTitle}
          onChangeText={setNewUpdateTitle}
        />
        <TextInput
          style={[styles.inputMultiline, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          placeholder={t.messagePlaceholder}
          placeholderTextColor={theme.textSecondary}
          value={newUpdateMessage}
          onChangeText={setNewUpdateMessage}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity style={[styles.postButton, { backgroundColor: theme.accent }]} onPress={addNewUpdate}>
          <Text style={styles.postButtonText}>{t.postUpdate}</Text>
        </TouchableOpacity>
      </Animated.View>

      {detailSheetVisible && <TouchableWithoutFeedback onPress={closeDetailSheet}><View style={styles.sheetOverlay} /></TouchableWithoutFeedback>}
      {selectedUpdate && (
        <Animated.View style={[styles.detailSheet, { backgroundColor: theme.background, borderTopColor: theme.border, transform: [{ translateY: detailSheetAnim }] }]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.detailTitleContainer, { borderBottomColor: theme.border }]}>
            <Image source={require('../assets/logos.png')} style={{ width: 70, height: 70, marginRight: 10, borderRadius: 15 }} resizeMode="contain" />
            <Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={1}>{selectedUpdate.title}</Text>
            <TouchableOpacity onPress={closeDetailSheet}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.detailDescription, { color: theme.textSecondary }]}>{selectedUpdate.fullDetails}</Text>
            {selectedUpdate.link && (
              <TouchableOpacity style={[styles.detailLinkRow, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f0f0f0' }]} onPress={() => openSocialLink(selectedUpdate.link, selectedUpdate.link)} activeOpacity={0.8}>
                <Ionicons name="link-outline" size={18} color={theme.accent} />
                <Text style={[styles.detailLinkText, { color: theme.accent }]} numberOfLines={1}>{selectedUpdate.link}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {renderSocialIcons()}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1 },
  topBar: {
    paddingTop: 4,
    paddingBottom: 5,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  tabScroll: { flex: 1 },
  tabRowScroll: { paddingHorizontal: 12, alignItems: 'center' },
  tabCircleItem: { alignItems: 'center', marginRight: 14, width: 64 },
  tabCircleRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 0, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  tabCircleAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  tabCircleLabel: { fontSize: 11, textAlign: 'center' },
  tabSeparator: { width: 1, height: 30, marginHorizontal: 8, alignSelf: 'center' },

  /* ---------- Horizontal trending strip ---------- */
  productStrip: {
    height: 194,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  productStripWithTitle: {
    height: 224,
  },
  productStripTitle: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    fontSize: 18,
    fontWeight: '900',
  },
  newPostsTitle: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    fontSize: 18,
    fontWeight: '800',
  },
  productStripContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  productTile: {
    width: 132,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#262626',
    position: 'relative',
  },
  productTileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productTileShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  /* Tile — top-left: product name */
  productTileLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 36,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* Tile — top-right: video indicator */
  productTileVideoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Tile — bottom-left: user profile */
  productTileUserRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productTileOwnerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#333',
  },

  /* Tile — bottom-right: price */
  productTilePrice: {
    position: 'absolute',
    right: 10,
    bottom: 16,
    maxWidth: 80,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  updateUnreadBadgeNumber: {
    position: 'absolute',
    top: 4,
    right: -5,
    backgroundColor: '#d87428',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 5,
  },
  updateUnreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ---------- Reels (Instagram-style) ---------- */
  reelsContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsHidden: {
    display: 'none',
  },
  reelPage: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  reelBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: 'rgba(1, 34, 37, 0)',
  },

  reelInfo: {
    position: 'absolute',
    left: 14,
    right: 88,
    top: 14,
    zIndex: 20,
  },
  reelCloseButton: {
    position: 'absolute',
    top: 80,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  reelDetails: {
    position: 'absolute',
    left: 14,
    right: 88,
    bottom: 80,
    zIndex: 20,
  },
  reelUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reelAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    marginRight: 8,
    backgroundColor: '#333',
  },
  reelUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelCaption: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelProductName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelDescriptionMeasure: {
    position: 'absolute',
    width: '100%',
    opacity: 0,
    pointerEvents: 'none',
  },
  reelReadMore: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelAmount: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelMenuIconWrap: { width: 30, height: 24, justifyContent: 'space-between', alignItems: 'flex-start' },
  reelMenuIconLine: { height: 2, backgroundColor: '#fff', borderRadius: 2 },
  reelMenuIconLineShort: { width: 14 },
  reelMenuIconLineLong: { width: 26 },
  reelMenuIconLineMid: { width: 20, alignSelf: 'flex-end' },

  reelActions: {
    position: 'absolute',
    right: 10,
    bottom: 100,
    alignItems: 'center',
    zIndex: 21,
    gap: 22,
  },
  reelActionButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelActionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  listContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  postsGrid: { paddingHorizontal: 8, paddingTop: 0, paddingBottom: 0 },

  /* ---------- Card (TikTok style) ---------- */
  card: {
    width: CARD_WIDTH,
    alignSelf: 'stretch',
    marginVertical: 0,
    borderTopLeftRadius: CARD_BORDER_RADIUS,
    borderTopRightRadius: CARD_BORDER_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  cardMediaWrap: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: CARD_BORDER_RADIUS,
    borderTopRightRadius: CARD_BORDER_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  /* ---------- Top overlay (product name left, video indicator right) ---------- */
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9,
    paddingTop: 10,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  topProductRow: {
    flexShrink: 1,
    marginRight: 12,
  },
  topProductName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* Video indicator badge (top-right corner) */
  /* ---------- Right side vertical actions ---------- */
  rightActions: {
    position: 'absolute',
    right: 8,
    bottom: 5,
    alignItems: 'center',
    zIndex: 8,
    gap: 18,
  },
  rightActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  rightActionIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  reportIconWrap: {
    width: 30,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 5,
    paddingVertical: 6,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuIconWrapper: {
    width: 20,
    height: 15,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  menuIconLine: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    height: 2,
  },
  menuIconLineFirst: {
    width: '50%',
    alignSelf: 'flex-start',
  },
  menuIconLineFull: {
    width: '100%',
  },
  menuIconLineLast: {
    width: '50%',
    alignSelf: 'flex-end',
  },

  /* ---------- Bottom overlay (user left, price right) ---------- */
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 74,
    bottom: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    zIndex: 7,
  },
  bottomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bottomUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 8,
  },
  bottomUserAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    marginRight: 8,
    backgroundColor: '#333',
  },
  bottomUserName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomAmount: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  videoProductName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: 12,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ---------- Description (below image) ---------- */
  descriptionSection: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
  },
  viewMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 3,
  },
  cardDescription: {
    color: 'transparent',
    fontSize: 13,
    lineHeight: 18,
  },
  hiddenMeasure: {
    height: 0,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },

  /* ---------- Suggestion overlay ---------- */
  suggestionOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 4,
    right: 4,
    borderWidth: 0,
    borderRadius: 12,
    padding: 0,
    zIndex: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    minHeight: 50,
  },
  suggestionOverlaySending: {
    backgroundColor: 'transparent',
  },
  suggestionOverlayVideo: {
    bottom: 60,
  },
  suggestionOverlayInline: {
    position: 'relative',
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  suggestionInlineWrap: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 5,
    paddingRight: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    backgroundColor: 'transparent',
  },
  suggestionSection: {
    flex: 1,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 34,
  },
  suggestionSectionLeft: { borderRightWidth: 1.5 },
  suggestionSectionRight: { borderRightWidth: 0 },
  suggestionTitle: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    letterSpacing: 0.3,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  suggestionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    minHeight: 34,
  },
  suggestionLogoBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  suggestionLoadingLogo: { width: 28, height: 28, borderRadius: 8 },
  suggestionLoadingText: { fontSize: 10, fontWeight: '600' },
  suggestionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 50,
    flexWrap: 'wrap',
  },
  suggestionStatusText: { fontSize: 10, fontWeight: '700', marginLeft: 8 },
  suggestionSentText: { fontSize: 10, marginLeft: 8, fontStyle: 'italic', maxWidth: '60%' },

  /* ---------- Slider ---------- */
  sliderContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
    borderTopLeftRadius: CARD_BORDER_RADIUS,
    borderTopRightRadius: CARD_BORDER_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  houseImage: { width: CARD_WIDTH },
  dotsContainer: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 8, zIndex: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  activeDot: { backgroundColor: '#ffffff', width: 12, height: 8 },

  /* ---------- Legacy ---------- */
  postDetails: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  price: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  description: { fontSize: 14, lineHeight: 20 },
  readMore: { fontWeight: '600', marginLeft: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 6 },
  actionText: { fontSize: 14 },

  /* ---------- Empty / loading / fab ---------- */
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { textAlign: 'center', fontSize: 16, marginBottom: 12 },
  loadingLogo: { width: 64, height: 64, borderRadius: 16 },
  loginEmptyButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8, marginTop: 8 },
  loginEmptyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },

  showHeaderButton: {
    position: 'absolute',
    right: 18,
    bottom: 40,
    zIndex: 200,
    padding: 8,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ---------- Grid ---------- */
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
  gridPostItem: { width: (SCREEN_WIDTH - 32) / 2, aspectRatio: 1, marginBottom: 8, position: 'relative' },
  gridPostImageContainer: { width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' },
  gridPostImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteButton: { position: 'absolute', top: 4, right: 4, borderRadius: 12, padding: 2 },
  gridMenuIconWrapper: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  gridMenuIconLine: { borderRadius: 999, height: 2, marginVertical: 1.5 },
  gridMenuIconLineShort: { width: '42%' },
  gridMenuIconLineMid: { width: '72%' },
  gridMenuIconLineLong: { width: '100%' },
  unsaveButton: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
  videoCoverBadge: { position: 'absolute', top: 8, left: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },

  /* ---------- Sheets ---------- */
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: BOTTOM_SHEET_HEIGHT, zIndex: 101, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  topSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 0,
  },
  sheetHeaderWrapper: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 0,
    borderRadius: 12,
    marginHorizontal: 14,
    marginTop: 0,
    shadowColor: '#00000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center ' },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color:'#47ae87' },
  postButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  postButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  reportPrompt: { fontSize: 15, marginBottom: 16, marginTop: 8 },
  reportOption: { paddingVertical: 4, borderBottomWidth: 0 },
  reportOptionText: { fontSize: 16 },
  cancelReportBtn: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  cancelReportText: { fontSize: 16, fontWeight: '600' },
  detailSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: DETAIL_SHEET_HEIGHT, zIndex: 101, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 12 },
  detailTitleContainer: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 0, justifyContent: 'space-between' },
  detailTitle: { fontSize: 20, fontWeight: 'bold', flex: 1, marginRight: 8 },
  detailScroll: { flex: 1, marginTop: 8 },
  detailDescription: { fontSize: 16, lineHeight: 22, paddingBottom: 12 },
  detailLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  detailLinkText: { marginLeft: 8, fontSize: 14, flex: 1 },
  socialIconsFooter: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccc', paddingTop: 12 },
  followText: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 12 },
  socialIconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  socialIconSmall: { alignItems: 'center' },
  socialIconCircleSmall: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  /* ---------- Modals ---------- */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.03)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalMessage: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 0 },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 0, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  inputMultiline: { borderWidth: 0, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, height: 80, textAlignVertical: 'top' },

  reportModalRoot: { flex: 1, justifyContent: 'flex-end' },
  reportModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.8,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  reportSheet: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 12,
  },
  reportSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  reportSheetTitle: { fontSize: 18, fontWeight: '700' },
  reportSheetPrompt: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  reportReasonButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  reportReasonText: { fontSize: 15, fontWeight: '600' },
  reportCancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  reportCancelText: { fontSize: 15, fontWeight: '600' },
});

export default BuyPostScreen;