// screens/BuyPostScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Share, Alert, ActivityIndicator, Animated,
  TextInput, RefreshControl, ScrollView, TouchableWithoutFeedback,
  Linking, Platform, LogBox, PanResponder,
} from 'react-native';
import BlurView from '../components/BlurViewWrapper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import axios from 'axios';
import BuyLoginSheet from '../components/BuyLoginSheet';
import { useBottomSheet } from '../context/BottomSheetContext';
import { BASE_URL } from '../constants';

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
const MAX_IMAGE_HEIGHT = 500;

const LOOP_MULTIPLIER = 30;

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
    myPosts: 'My Posts',
    saved: 'Saved',
    pleaseLogin: 'Please login to see posts',
    noPosts: 'Wait a moment...',
    noMyPosts: "You haven't posted anything yet.",
    noSavedPosts: 'No saved posts yet.',
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
    viewMore: 'more',
    viewLess: 'less',
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
    myPosts: 'Ibicuruzwa byanjye',
    saved: 'Ibyabitswe',
    pleaseLogin: 'Nyamuneka Injira kugira ngo ubone Ibicuruzwa',
    noPosts: 'Tegerezaho akanyagato...',
    noMyPosts: 'Nta gicuruzwa wigeze ushyira.',
    noSavedPosts: 'Nta gicuruzwa wabitse.',
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
    viewMore: 'soma byinshi',
    viewLess: 'gabanya',
    stopped: 'Yahagaritswe',
    error: 'Ikibazo',
    reportFailed: 'Ntabwo byashobotse kumenyesha ikibazo.',
    feedLoadError: 'Ntabwo byashobotse gukura Ibicuruzwa. Nyamuneka genzura interineti yawe.',
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

const mapPost = (post) => ({
  ...post,
  _id: post._id, id: post._id,
  username: post.username || post.user?.username || 'User',
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
  userId: post.user?._id || post.user,
  status: post.status || 'active',
  featured: post.featured || false,
});

const ImageWithPlaceholder = React.memo(({ source, style, resizeMode, transparentBackground }) => {
  const [loaded, setLoaded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!loaded) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
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
    }
  }, [loaded, scaleAnim]);

  const onLoad = useCallback(() => setLoaded(true), []);

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: transparentBackground ? 'transparent' : '#262626' }]}>
      {!loaded && (
        <Animated.Image
          source={LOADING_LOGO}
          style={{
            width: '100%',
            height: 100,
            alignSelf: 'center',
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: [{ translateY: -50 }, { scale: scaleAnim }],
            resizeMode: 'contain',
          }}
        />
      )}
      <Image
        source={getImageSource(source)}
        style={[style, { opacity: loaded ? 1 : 0 }]}
        resizeMode={resizeMode || 'cover'}
        onLoad={onLoad}
      />
    </View>
  );
});

const ImageSlider = React.memo(({ images, productName, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(MIN_IMAGE_HEIGHT);
  const [rawMaxHeight, setRawMaxHeight] = useState(MIN_IMAGE_HEIGHT);
  const flatListRef = useRef(null);

  // Dynamic height based on image aspect ratio (capped at MAX_IMAGE_HEIGHT)
  useEffect(() => {
    let isMounted = true;
    const computeHeight = async () => {
      if (!images || images.length === 0) {
        setContainerHeight(MIN_IMAGE_HEIGHT);
        setRawMaxHeight(MIN_IMAGE_HEIGHT);
        return;
      }
      try {
        const sizePromises = images.map(img => getImageSize(img));
        const sizes = await Promise.all(sizePromises);
        let maxHeight = MIN_IMAGE_HEIGHT;
        sizes.forEach(({ width, height }) => {
          if (width > 0 && height > 0) {
            const aspect = height / width;
            const calculatedHeight = CARD_WIDTH * aspect;
            if (calculatedHeight > maxHeight) {
              maxHeight = calculatedHeight;
            }
          }
        });
        if (isMounted) {
          setRawMaxHeight(maxHeight);
          setContainerHeight(Math.min(maxHeight, MAX_IMAGE_HEIGHT));
        }
      } catch (error) {
        console.warn('Failed to compute image heights:', error);
        if (isMounted) {
          setRawMaxHeight(MIN_IMAGE_HEIGHT);
          setContainerHeight(MIN_IMAGE_HEIGHT);
        }
      }
    };
    computeHeight();
    return () => { isMounted = false; };
  }, [images]);

  const onScroll = useCallback((event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(offset / slideSize));
  }, []);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    const nextIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  }, [currentIndex, images.length]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(prevIndex);
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
  }, [currentIndex, images.length]);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];
  const useCover = rawMaxHeight > MAX_IMAGE_HEIGHT;
  const foregroundResizeMode = useCover ? 'cover' : 'contain';

  return (
    <View style={[styles.sliderContainer, { height: containerHeight }]}>
      {/* Background image with blur */}
      <Image
        source={getImageSource(currentImage)}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={10}
      />
      <BlurView
        tint={isDarkMode ? 'dark' : 'light'}
        intensity={10}
        style={StyleSheet.absoluteFill}
      />

      {/* Foreground image list */}
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
            resizeMode={foregroundResizeMode}
            transparentBackground
          />
        )}
      />

      {productName && (
        <View style={styles.productBadge}>
          <Text style={styles.productBadgeText}>{productName}</Text>
        </View>
      )}
      {images.length > 1 && (
        <>
          <TouchableOpacity style={[styles.sliderArrow, styles.arrowLeft]} onPress={goPrev}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sliderArrow, styles.arrowRight]} onPress={goNext}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.dotsContainer}>
            {images.map((_, idx) => (
              <View key={idx} style={[styles.dot, idx === currentIndex && styles.activeDot]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
});

const SuggestionOverlayContent = React.memo(({
  isDarkMode,
  theme,
  house,
  onQuickSuggestion,
  isSendingSuggestion,
  suggestionState,
  t,
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

  if (suggestionState.status === 'sending') {
    return (
      <View style={styles.suggestionOverlay}>
        <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={StyleSheet.absoluteFill} />
        <View style={styles.suggestionLoadingContainer}>
          <Animated.Image
            source={LOADING_LOGO}
            style={[styles.suggestionLoadingLogo, { transform: [{ scale: logoScaleAnim }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.suggestionLoadingText, { color: theme.text }]}>{t.sending}</Text>
        </View>
      </View>
    );
  }

  if (suggestionState.status === 'success' || suggestionState.status === 'error') {
    const isSuccess = suggestionState.status === 'success';
    return (
      <View style={styles.suggestionOverlay}>
        <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.suggestionStatusContainer, { opacity: successOpacity }]}>
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
            size={28}
            color={isSuccess ? '#28a745' : '#ff4d4f'}
          />
          <Text style={[styles.suggestionStatusText, { color: isSuccess ? '#28a745' : '#ff4d4f' }]}>
            {suggestionState.message}
          </Text>
          {suggestionState.sentText && (
            <Text style={[styles.suggestionSentText, { color: theme.textSecondary }]} numberOfLines={2}>
              "{suggestionState.sentText}"
            </Text>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.suggestionOverlay, { transform: [{ translateX: shakeAnim }] }]}>
      <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={StyleSheet.absoluteFill} />
      <View style={styles.suggestionRow}>
        <TouchableOpacity
          style={[
            styles.suggestionSection,
            styles.suggestionSectionLeft,
            {
              borderRightWidth: 1.5,
              borderRightColor: isDarkMode ? 'rgba(255,255,255,0.99)' : 'rgb(253,253,253)',
            }
          ]}
          activeOpacity={0.7}
          onPress={() => handleQuickSuggestion(`Is that ${suggestionText} available?`)}
          disabled={isSendingSuggestion}
        >
          <Text style={[styles.suggestionTitle]}>Is that {suggestionText} available?</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.suggestionSection, styles.suggestionSectionRight]}
          activeOpacity={0.7}
          onPress={() => handleQuickSuggestion(`Where can I find this ${suggestionText}?`)}
          disabled={isSendingSuggestion}
        >
          <Text style={[styles.suggestionTitle]}>Where can I find this {suggestionText}?</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const HouseCard = React.memo(({
  house, theme, isDarkMode, onPress, onShare, isSaved, onToggleSave,
  isLoggedIn, showLoginModal, isMyPost, onUserPress, onReport,
  onMessagePress, t, onQuickSuggestion, isSendingSuggestion,
  suggestionState,
}) => {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const description = house.description || '';
  const shortDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;

  const handleToggleSave = useCallback(() => {
    if (!isLoggedIn) { showLoginModal(t.pleaseLoginToSave); return; }
    onToggleSave(house);
  }, [isLoggedIn, showLoginModal, t.pleaseLoginToSave, onToggleSave, house]);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.profileRow}>
        <TouchableOpacity style={styles.profileLeft} onPress={onUserPress} activeOpacity={0.7}>
          <Image source={getImageSource(house.userAvatar)} style={styles.avatar} />
          <View style={styles.userText}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{house.username || 'User'}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.userLocation, { color: theme.textSecondary, marginLeft: 4 }]} numberOfLines={1}>{house.location}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {!isMyPost && (
          <TouchableOpacity style={styles.reportButton} onPress={() => onReport(house)}>
            <View style={styles.reportMenuIcon}>
              <View style={[styles.reportMenuLine, { backgroundColor: '#47ae87', width: 24 }]} />
              <View style={[styles.reportMenuLine, { backgroundColor: '#47ae87', width: 18 }]} />
              <View style={[styles.reportMenuLine, { backgroundColor: '#47ae87', width: 12 }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.imageWrapper}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(house)}>
          <ImageSlider images={house.houseImages} productName={house.productName || house.category} isDarkMode={isDarkMode} />
        </TouchableOpacity>
        <SuggestionOverlayContent
          isDarkMode={isDarkMode}
          theme={theme}
          house={house}
          onQuickSuggestion={onQuickSuggestion}
          isSendingSuggestion={isSendingSuggestion}
          suggestionState={suggestionState}
          t={t}
        />
      </View>

      <View style={styles.postDetails}>
        <Text style={[styles.price, { color: theme.more }]}>{house.amount || `${house.price?.toLocaleString()} RWF`}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {showFullDesc ? description : shortDesc}
          {description.length > 100 && (
            <Text style={[styles.readMore, { color: theme.more }]} onPress={() => setShowFullDesc(!showFullDesc)}>
              {showFullDesc ? ` ${t.viewLess}` : ` ${t.viewMore}`}
            </Text>
          )}
        </Text>
      </View>

      {isMyPost ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(house)}>
            <Ionicons name="paper-plane-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>{t.share}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleToggleSave}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? theme.accent : theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>{t.save}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(house)}>
            <Ionicons name="paper-plane-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>{t.share}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onMessagePress(house)}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>{t.message}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const BuyPostScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const { showBottomSheet } = useBottomSheet();
  const route = useRoute();
  const t = translations[language] || translations.English;

  const [activeTab, setActiveTab] = useState('ushaka');
  const [currentUser, setCurrentUser] = useState(null);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedPage, setFeedPage] = useState(1);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isAppendingFeed, setIsAppendingFeed] = useState(false);
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

  const [headerVisible, setHeaderVisible] = useState(true);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const listMarginTop = useRef(new Animated.Value(HEADER_HEIGHT)).current;

  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);
  const isAnimatingHeader = useRef(false);

  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const addSheetAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
  const [newUpdateTitle, setNewUpdateTitle] = useState('');
  const [newUpdateMessage, setNewUpdateMessage] = useState('');

  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const reportSheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [reportingPost, setReportingPost] = useState(null);

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const detailSheetAnim = useRef(new Animated.Value(DETAIL_SHEET_HEIGHT)).current;
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (loading) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 1000, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [loading, scaleAnim]);

  // ---------- Load viewed timestamps from AsyncStorage ----------
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

  // ---------- Save viewed timestamp to AsyncStorage ----------
  const saveViewedTimestamp = useCallback(async (updateId) => {
    try {
      const timestamps = await loadViewedTimestamps();
      timestamps[updateId] = new Date().toISOString();
      await AsyncStorage.setItem('buyPostUpdateViewedTimestamps', JSON.stringify(timestamps));
    } catch (error) {
      console.error('Error saving viewed timestamp:', error);
    }
  }, [loadViewedTimestamps]);

  // ---------- Mark update as read and save timestamp ----------
  const markUpdateAsRead = useCallback(async (updateId) => {
    await saveViewedTimestamp(updateId);
    setUpdates(prev => prev.map(u =>
      u.id === updateId 
        ? { ...u, lastViewedAt: new Date().toISOString() } 
        : u
    ));
  }, [saveViewedTimestamp]);

  // ---------- Header animation helpers ----------
  const animateHeaderHide = useCallback(() => {
    if (isAnimatingHeader.current || !headerVisible) return;
    isAnimatingHeader.current = true;
    setHeaderVisible(false);
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: -HEADER_HEIGHT,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(listMarginTop, {
        toValue: 0,
        tension: 120,
        friction: 14,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimatingHeader.current = false;
    });
  }, [headerVisible, headerTranslateY, headerOpacity, listMarginTop]);

  const animateHeaderShow = useCallback(() => {
    if (isAnimatingHeader.current || headerVisible) return;
    isAnimatingHeader.current = true;
    setHeaderVisible(true);
    Animated.parallel([
      Animated.spring(headerTranslateY, {
        toValue: 0,
        tension: 120,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(listMarginTop, {
        toValue: HEADER_HEIGHT,
        tension: 120,
        friction: 14,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimatingHeader.current = false;
    });
  }, [headerVisible, headerTranslateY, headerOpacity, listMarginTop]);

  // ---------- Scroll handler ----------
  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    if (currentScrollY <= 0) {
      if (!headerVisible) animateHeaderShow();
      lastScrollY.current = 0;
      scrollAccumulator.current = 0;
      return;
    }
    const scrollDiff = currentScrollY - lastScrollY.current;
    if ((scrollDiff > 0 && scrollAccumulator.current < 0) || 
        (scrollDiff < 0 && scrollAccumulator.current > 0)) {
      scrollAccumulator.current = 0;
    }
    scrollAccumulator.current += scrollDiff;
    if (scrollAccumulator.current > SCROLL_THRESHOLD && headerVisible) {
      animateHeaderHide();
      scrollAccumulator.current = 0;
    }
    if (scrollAccumulator.current < -SCROLL_THRESHOLD && !headerVisible) {
      animateHeaderShow();
      scrollAccumulator.current = 0;
    }
    lastScrollY.current = currentScrollY;
  }, [headerVisible, animateHeaderHide, animateHeaderShow]);

  useEffect(() => {
    if (!headerVisible) animateHeaderShow();
    lastScrollY.current = 0;
    scrollAccumulator.current = 0;
  }, [activeTab, headerVisible, animateHeaderShow]);

  // ---------- Other hooks ----------
  useEffect(() => {
    const paramTab = route.params?.activeTab;
    if (paramTab && ['ushaka', 'utanga', 'saved'].includes(paramTab)) {
      if (activeTab !== paramTab) setActiveTab(paramTab);
    }
  }, [route.params, activeTab]);

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
    if (!isRefresh) setLoading(true);
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
      if (!isRefresh) setLoading(false);
    }
  }, [isLoggedIn, currentUser, fetchFeed, fetchNotes, fetchMyPosts, fetchSavedPosts, sortFeedPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const anim = Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 1000, useNativeDriver: true })
    );
    anim.start();
    if (!headerVisible) animateHeaderShow();
    await loadData(true);
    setRefreshing(false);
    anim.stop();
    spinValue.setValue(0);
  }, [headerVisible, animateHeaderShow, loadData, spinValue]);

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
      const replyPost = {
        postId: house._id,
        title: house.productName || house.title || 'Product',
        description: house.description || '',
        image: (house.houseImages && house.houseImages.length > 0)
          ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0])
          : null,
        price: house.price || null,
        location: house.location || '',
        ownerId: sellerId,
        timestamp: house.createdAt || new Date().toISOString(),
      };
      const messageData = {
        postId: house._id,
        postTitle: house.productName || house.title || '',
        postUser: house.username || '',
        senderId: currentUser?._id,
        senderName: currentUser?.username || '',
        senderPhone: currentUser?.phone || '',
        senderAvatar: currentUser?.avatar || '',
        receiverId: sellerId,
        receiverName: house.username || '',
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
          data: { postId: house._id, senderId: currentUser?._id, senderName: currentUser?.username || 'User', hasPostReply: true },
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

  const handleShare = useCallback(async (post) => {
    try {
      await Share.share({
        message: `${post.productName || 'Product'} - ${post.location}\n${post.description}\n\nDownload Shaaka app: https://play.google.com/store/apps/details?id=com.facebook.katana`,
        title: post.productName || 'Product'
      });
    } catch (error) { console.log(error); }
  }, []);

  const handlePostPress = useCallback((post) => {
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
  }, [isLoggedIn, t, navigation, language, showBottomSheet]);

  const handleUserPress = useCallback((userId, username) => {
    if (!isLoggedIn) {
      setLoginSheetMessage(t.pleaseLoginToProfile);
      setLoginSheetVisible(true);
      return;
    }
    navigation.navigate('Profile', { userId, username });
  }, [isLoggedIn, t.pleaseLoginToProfile, navigation]);

  const handleMessagePress = useCallback((house) => {
    if (!isLoggedIn) {
      setLoginSheetMessage(t.pleaseLoginToMessage);
      setLoginSheetVisible(true);
      return;
    }
    const sellerId = house.userId;
    if (!sellerId) {
      Alert.alert('Error', t.sellerInfoMissing);
      return;
    }
    const replyPost = {
      postId: house._id,
      title: house.productName || house.title || 'Product',
      description: house.description || '',
      image: (house.houseImages && house.houseImages.length > 0)
        ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0])
        : null,
      price: house.price || null,
      location: house.location || '',
      ownerId: sellerId,
      timestamp: house.createdAt || new Date().toISOString(),
    };
    navigation.navigate('Chat', {
      sellerId: sellerId,
      sellerName: house.username || 'Seller',
      sellerAvatar: house.userAvatar || '',
      sellerPhone: house.contactNumber1 || house.contactNumber2 || '',
      postId: house._id,
      postTitle: house.productName || 'Product',
      replyPost: replyPost,
    });
  }, [isLoggedIn, t, navigation]);

  // ---------- Bottom sheet handlers ----------
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

  // ---------- Report sheet ----------
  useEffect(() => {
    Animated.timing(reportSheetAnim, {
      toValue: reportSheetVisible ? 0 : SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [reportSheetVisible, reportSheetAnim]);

  const closeReportSheet = useCallback(() => setReportSheetVisible(false), []);
  const reportPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) reportSheetAnim.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          closeReportSheet();
        } else {
          Animated.spring(reportSheetAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const handleReportOption = useCallback(async (reason) => {
    try {
      const token = await getToken();
      await axios.post(
        `${BASE_URL}/api/reports`,
        { postId: reportingPost._id, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t.reported, t.thanksForReport.replace('%s', reason));
      closeReportSheet();
    } catch (error) {
      const msg = error.response?.data?.message || t.reportFailed;
      Alert.alert(t.error, msg);
    }
  }, [getToken, reportingPost, t, closeReportSheet]);

  // ---------- Detail sheet ----------
  useEffect(() => {
    Animated.timing(detailSheetAnim, {
      toValue: detailSheetVisible ? 0 : DETAIL_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [detailSheetVisible, detailSheetAnim]);

  const closeDetailSheet = useCallback(() => setDetailSheetVisible(false), []);

  // ---------- Social helpers ----------
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

  const getDisplayedPosts = useCallback(() => {
    if (activeTab === 'ushaka') return feedPosts;
    if (activeTab === 'utanga') return isLoggedIn ? myPosts : [];
    if (activeTab === 'saved') return isLoggedIn ? savedPosts : [];
    return [];
  }, [activeTab, feedPosts, isLoggedIn, myPosts, savedPosts]);

  const loopedFeedData = useMemo(() => {
    if (activeTab !== 'ushaka' || !feedPosts || feedPosts.length === 0) return [];
    let arr = [];
    for (let i = 0; i < LOOP_MULTIPLIER; i++) {
      arr = arr.concat(feedPosts);
    }
    return arr;
  }, [activeTab, feedPosts]);

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

  useEffect(() => { checkLoginStatus(); }, [checkLoginStatus]);
  useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

  const renderGridPostItem = useCallback(({ item }) => {
    const isSavedTab = activeTab === 'saved';
    const showDelete = isLoggedIn && !isSavedTab;
    return (
      <View style={styles.gridPostItem}>
        <TouchableOpacity style={styles.gridPostImageContainer} onPress={() => handlePostPress(item)}>
          <Image source={{ uri: item.houseImages?.[0] || 'https://via.placeholder.com/150' }} style={styles.gridPostImage} />
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
            <Ionicons name="ellipsis-horizontal" size={18} color={isDarkMode ? '#000' : '#fff'} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [activeTab, isLoggedIn, isDarkMode, handlePostPress, toggleSave, confirmDeletePost]);

  const renderEmpty = useCallback(() => {
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
  }, [feedError, activeTab, isLoggedIn, theme, t, loadData, navigation]);

  const renderHouseCard = useCallback(({ item }) => (
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
        setLoginSheetMessage(msg);
        setLoginSheetVisible(true);
      }}
      isMyPost={false}
      onUserPress={() => handleUserPress(item.userId, item.username)}
      onReport={(post) => {
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
        setReportingPost(post);
        setReportSheetVisible(true);
      }}
      onMessagePress={handleMessagePress}
      t={t}
      onQuickSuggestion={sendQuickSuggestion}
      isSendingSuggestion={isSendingSuggestion}
      suggestionState={getSuggestionState(item._id)}
    />
  ), [theme, isDarkMode, handlePostPress, handleShare, savedPostIds, toggleSave, isLoggedIn, handleUserPress, handleMessagePress, t, sendQuickSuggestion, isSendingSuggestion, getSuggestionState, showBottomSheet, navigation]);

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
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HEIGHT,
            zIndex: 10,
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
              { key: 'ushaka', label: t.feed, icon: 'grid-outline' },
              { key: 'utanga', label: t.myPosts, icon: 'person-outline' },
              { key: 'saved', label: t.saved, icon: 'bookmark-outline' },
            ].map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={styles.tabCircleItem} onPress={() => setActiveTab(tab.key)}>
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
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="refresh-outline" size={24} color={theme.text} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {activeTab === 'ushaka' ? (
        <Animated.View style={{ flex: 1, marginTop: listMarginTop }}>
          <FlatList
            data={loopedFeedData}
            keyExtractor={(item, index) => `${item._id}_${index}`}
            renderItem={renderHouseCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
            ListEmptyComponent={renderEmpty}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        </Animated.View>
      ) : (
        <Animated.View style={{ flex: 1, marginTop: listMarginTop }}>
          <FlatList
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
        <View style={[styles.sheetHeaderWrapper, { backgroundColor: isDarkMode ? '#2c2c2c' : '#f0f0f0', borderColor: theme.border }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.addNewUpdate}</Text>
            <TouchableOpacity onPress={closeAddSheet}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          placeholder={t.titlePlaceholder}
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

      {reportSheetVisible && (
        <TouchableWithoutFeedback onPress={closeReportSheet}>
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View
        style={[
          styles.reportBottomSheet,
          {
            backgroundColor: isDarkMode ? '#111' : '#ddddddf9',
            transform: [{ translateY: reportSheetAnim }],
          }
        ]}
        {...reportPanResponder.panHandlers}
      >
        <View style={styles.sheetHandle} />
        <View style={[styles.sheetHeaderWrapper, { backgroundColor: 'transparent', borderColor: theme.border, marginTop: 0 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, ]}>{t.reportPost}</Text>
            <TouchableOpacity onPress={closeReportSheet}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.reportPrompt, { color: theme.textSecondary }]}>{t.whyReport}</Text>
        {[t.spam, t.inappropriate, t.scam].map(reason => (
          <TouchableOpacity
            key={reason}
            style={[styles.reportOption, { borderBottomColor: theme.border }]}
            onPress={() => handleReportOption(reason)}
          >
            <Text style={[styles.reportOptionText, { color: theme.text }]}>{reason}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.cancelReportBtn} onPress={closeReportSheet}>
          <Text style={[styles.cancelReportText, { color: theme.textSecondary }]}>{t.cancel}</Text>
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
  topBar: {
    paddingTop: 4,
    paddingBottom: 5,
    borderBottomWidth: 0,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  tabScroll: { flex: 1 },
  tabRowScroll: { paddingHorizontal: 12, alignItems: 'center' },
  refreshButton: { paddingHorizontal: 0, marginBottom: 12, alignItems: 'center' },
  tabCircleItem: { alignItems: 'center', marginRight: 14, width: 64 },
  tabCircleRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 0, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  tabCircleAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  tabCircleLabel: { fontSize: 11, textAlign: 'center' },
  tabSeparator: { width: 1, height: 30, marginHorizontal: 8, alignSelf: 'center' },
  updateUnreadBadgeNumber: {
    position: 'absolute',
    top: 4,
    right: -5,
    backgroundColor: '#d87428',
    borderRadius: 10,
    minWidth: 20,
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
  listContent: { paddingHorizontal: 0, paddingBottom: 0 },
  card: { width: CARD_WIDTH, alignSelf: 'stretch', marginVertical: 4, borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0, overflow: 'hidden' },
  imageWrapper: { position: 'relative' },
  suggestionOverlay: {
    position: 'absolute',
    bottom: 15,
    left: 4,
    right: 4,
    borderWidth: 0,
    borderRadius: 12,
    padding: 0,
    zIndex: 10,
    overflow: 'hidden',
    shadowColor: '#00000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    minHeight: 50,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  suggestionSection: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  suggestionSectionLeft: { borderRightWidth: 1.5 },
  suggestionSectionRight: { borderRightWidth: 0 },
  suggestionTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    paddingVertical: 4,
    letterSpacing: 0.3,
    color: 'white',
  },
  suggestionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  suggestionLoadingLogo: { width: 30, height: 30, marginRight: 10, borderRadius: 8 },
  suggestionLoadingText: { fontSize: 13, fontWeight: '600' },
  suggestionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 50,
    flexWrap: 'wrap',
  },
  suggestionStatusText: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  suggestionSentText: { fontSize: 11, marginLeft: 8, fontStyle: 'italic', maxWidth: '60%' },
  profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  profileLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  userText: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: 'bold' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  userLocation: { fontSize: 12 },
  reportButton: { paddingHorizontal: 8, paddingVertical: 6 },
  reportMenuIcon: { alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  reportMenuLine: { height: 3, borderRadius: 2 },
  sliderContainer: { position: 'relative', width: '100%', height: MIN_IMAGE_HEIGHT, backgroundColor: '#000' },
  houseImage: { width: CARD_WIDTH, height: MIN_IMAGE_HEIGHT },
  productBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderBottomRightRadius: 12, zIndex: 5 },
  productBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sliderArrow: { position: 'absolute', top: '50%', marginTop: -15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 6, zIndex: 5 },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  dotsContainer: { position: 'absolute', bottom: 3, alignSelf: 'center', flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  activeDot: { backgroundColor: '#ffffff', width: 12, height: 8 },
  postDetails: { paddingHorizontal: 12, paddingVertical: 10 },
  price: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  description: { fontSize: 14, lineHeight: 20 },
  readMore: { fontWeight: '600', marginLeft: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 6 },
  actionText: { fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { textAlign: 'center', fontSize: 16, marginBottom: 12 },
  loginEmptyButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8, marginTop: 8 },
  loginEmptyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  postsGrid: { paddingHorizontal: 8, paddingBottom: 20 },
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
  gridPostItem: { width: (SCREEN_WIDTH - 32) / 2, aspectRatio: 1, marginBottom: 8, position: 'relative' },
  gridPostImageContainer: { width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' },
  gridPostImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteButton: { position: 'absolute', top: 4, right: 4, borderRadius: 12, padding: 2 },
  unsaveButton: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
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
  reportBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 101,
    minHeight: SCREEN_HEIGHT * 0.42,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
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
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color:'#47ae87' },
  postButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  postButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  reportPrompt: { fontSize: 15, marginBottom: 16, marginTop: 8 },
  reportOption: { paddingVertical: 14, borderBottomWidth: 0 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalMessage: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 0 },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 0, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  inputMultiline: { borderWidth: 0, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, height: 80, textAlignVertical: 'top' },
});

export default BuyPostScreen;