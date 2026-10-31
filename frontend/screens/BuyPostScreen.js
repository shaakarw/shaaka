
// screens/BuyPostScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  Dimensions, Share, Alert, Animated,
  TextInput, RefreshControl, ScrollView, TouchableWithoutFeedback,
  Linking, Platform, LogBox, PanResponder, Modal, useWindowDimensions,
  AppState,
} from 'react-native';
import BlurView from '../components/BlurViewWrapper';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useFocusEffect, useIsFocused, useRoute } from '@react-navigation/native';
import axios from 'axios';
import BuyLoginSheet from '../components/BuyLoginSheet';
import { useBottomSheet } from '../context/BottomSheetContext';
import { BASE_URL } from '../constants';
import { io } from 'socket.io-client';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import VideoBackground from '../components/VideoBackground';
import { getUserDisplayName } from '../utils/userIdentity';
import { getImageUri, normalizeImageSource } from '../utils/imageUrl';
import { getPostCoverUri, getPostImages } from '../utils/postMedia';
import { videoPreloader } from '../components/VideoPreloader';
import { POST_SECTIONS, POST_SECTION_KEYS, getPostsForSection } from './postSectionConfig';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';
import { networkStatus } from '../services/networkStatus';
import { setReelsActive } from '../services/reelActivity';
import { reelVideoCache } from '../services/reelVideoCache';
import { requestVideoBackground } from '../services/videoBackgroundService';
import { useContactInfo, useContactLinks } from '../services/contactInfo';

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

// Silent poll intervals (Videos + Saved tabs)
const SILENT_REFRESH_MS = 2000;

const EYE_BUTTON_SIZE = 52;
const EYE_BACKGROUND_SIZE = (EYE_BUTTON_SIZE + 10) / 1.1;
const EYE_BUTTON_MARGIN = 8;
const EYE_BUTTON_MIN_TOP = 80;
const EYE_BUTTON_BOTTOM_PADDING = 100;

const POST_MEDIA_MIN_RATIO = 0.30;
const POST_MEDIA_MAX_RATIO = 0.75;

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
    noMyPosts: '',
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
    userInfoMissing: 'Your account information is unavailable. Please try again.',
    cannotMessageYourself: 'You cannot start a conversation with yourself.',
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
    availableSuggestion: 'Is this %s available?',
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
    userInfoMissing: 'Amakuru ya konti yawe ntabonetse. Ongera ugerageze.',
    cannotMessageYourself: 'Ntushobora gutangiza ikiganiro nawe ubwawe.',
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
    availableSuggestion: 'Iyi %s iracyahari ?',
  },
};

const getImageSource = (img) => {
  if (!img) return DEFAULT_AVATAR;
  if (typeof img === 'number') return img;
  const uri = getImageUri(img);
  if (uri) return typeof img === 'object' ? { ...img, uri } : { uri };
  return DEFAULT_AVATAR;
};

const getVideoCover = (videoUrl, videoThumbnail) => {
  return getPostCoverUri({ videoUrl, videoThumbnail });
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

const computeScaledMediaLayout = (naturalWidth, naturalHeight, cardWidth, maxHeight, minHeight = 0) => {
  if (!naturalWidth || !naturalHeight) {
    return { height: Math.max(minHeight, maxHeight), resizeMode: 'contain' };
  }
  const scaled = (naturalHeight / naturalWidth) * cardWidth;
  if (Number.isNaN(scaled) || !Number.isFinite(scaled)) {
    return { height: Math.max(minHeight, maxHeight), resizeMode: 'contain' };
  }
  if (scaled > maxHeight) {
    return { height: maxHeight, resizeMode: 'cover' };
  }
  if (scaled < minHeight) {
    return { height: minHeight, resizeMode: 'cover' };
  }
  return { height: scaled, resizeMode: 'contain' };
};

const mapPost = (post) => ({
  ...post,
  _id: post._id, id: post._id,
  username: getUserDisplayName(post.user || post, 'User'),
  userAvatar: post.userAvatar || post.user?.avatar,
  userAvatarVariants: post.userAvatarVariants || post.user?.avatarVariants || [],
  amount: post.amount || `RWF ${post.price?.toLocaleString()}`,
  price: post.price,
  location: post.location,
  description: post.description,
  productName: post.productName || 'Product',
  houseImages: getPostImages(post),
  contactNumber1: post.contactNumbers?.[0] || '',
  contactNumber2: post.contactNumbers?.[1] || '',
  priceNegotiable: post.priceNegotiable || false,
  videoUrl: post.videoUrl || post.videoHlsUrl || post.video?.url || post.video?.mp4 || post.mediaUrl || post.media?.url || post.fileUrl || '',
  videoDuration: post.videoDuration || post.duration || 0,
  videoThumbnail: post.videoThumbnail || post.thumbnail || post.poster || '',
  videoLink: post.videoLink || post.link || '',
  videoHlsUrl: post.videoHlsUrl || post.hlsUrl || '',
  videoId: post.videoId || post.id || '',
  reelId: String(post._id || post.id || post.reelId || post.videoId || post.videoUrl || post.video?.url || ''),
  userId: post.userId || post.user?._id || post.user,
  status: post.status || 'active',
  featured: post.featured || false,
});

const getPostOwnerId = (post) => {
  const owner = post?.userId || post?.user;
  return owner?._id || owner?.id || owner;
};

const buildChatReplyPost = (house) => {
  const sellerId = getPostOwnerId(house) || house?.user?._id || house?.user;
  const imageList = Array.isArray(house?.houseImages) ? house.houseImages : [];
  const firstImage = imageList.length
    ? (typeof imageList[0] === 'string' ? imageList[0] : imageList[0]?.uri || imageList[0]?.url || imageList[0]?.src || '')
    : (typeof house?.image === 'string' ? house.image : house?.image?.uri || house?.image?.url || house?.image?.src || '');
  const contactNumbers = [
    house?.contactNumber1,
    house?.contactNumber2,
    ...(Array.isArray(house?.contactNumbers) ? house.contactNumbers : []),
  ].filter(Boolean);

  return {
    postId: String(house?._id || house?.id || ''),
    contextType: 'post',
    title: house?.productName || house?.title || 'Product',
    description: house?.description || '',
    image: firstImage,
    price: house?.price ?? null,
    amount: house?.amount || '',
    location: house?.location || '',
    category: house?.category || '',
    bedrooms: house?.bedrooms ?? null,
    bathrooms: house?.bathrooms ?? null,
    size: house?.size ?? null,
    priceNegotiable: !!house?.priceNegotiable,
    contactNumbers,
    houseImages: imageList.length ? imageList : (Array.isArray(house?.images) ? house.images : []),
    videoUrl: house?.videoUrl || '',
    videoThumbnail: house?.videoThumbnail || house?.thumbnail || '',
    username: house?.username || house?.user?.username || '',
    userAvatar: house?.userAvatar || house?.user?.avatar || '',
    ownerId: sellerId,
    timestamp: house?.createdAt || new Date().toISOString(),
  };
};

/* ============================================================
   Video helpers
   ============================================================ */
const safePlayerAction = (player, methodName, ...args) => {
  if (!player || typeof player[methodName] !== 'function') return false;
  try { return player[methodName](...args); }
  catch (_) { return false; }
};

const safePlayerSet = (player, propertyName, value) => {
  if (!player) return false;
  try { player[propertyName] = value; return true; }
  catch (_) { return false; }
};

const GESTURE_SWIPE_ACTIVATION = 14;
const GESTURE_HORIZONTAL_DOMINANCE = 1.4;
const SPEED_STEPS = [
  { distance: 150, speed: 2 },
  { distance: 95, speed: 1.5 },
  { distance: 45, speed: 1.25 },
];
const PIXELS_PER_REWIND_SECOND = 10;
const MAX_REWIND_SECONDS = 45;
const DOUBLE_TAP_DELAY = 240;
const DOUBLE_TAP_SEEK_SECONDS = 10;

const _getSpeedForDistance = d => {
  for (let i = 0; i < SPEED_STEPS.length; i++) {
    if (d >= SPEED_STEPS[i].distance) return SPEED_STEPS[i].speed;
  }
  return 1;
};
const _isHorizontalSwipe = gs => {
  if (Math.abs(gs.dx) < GESTURE_SWIPE_ACTIVATION) return false;
  return Math.abs(gs.dx) > Math.abs(gs.dy) * GESTURE_HORIZONTAL_DOMINANCE;
};
const _getRewindSeconds = d =>
  Math.max(0, Math.min(MAX_REWIND_SECONDS, Math.round(d / PIXELS_PER_REWIND_SECOND)));
const _formatTime = s => {
  const safe = Number.isFinite(s) && s > 0 ? s : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

/* ============================================================
   ShaakaVideoPlayer — inline player + controls
   ============================================================ */
const ShaakaVideoPlayer = ({
  videoUrl,
  videoId,
  videoThumbnail,
  videoLink,
  videoDuration = 0,
  videoSizeBytes = 0,
  theme,
  containerHeight = null,
  isVisible = false,
  muted = true,
  onMuteChange,
  progressColor = '#fff',
  contentFit = 'cover',
  showPlaybackControls = true,
  showTopMute,
  showBottomMute = true,
  onVideoPress,
  logReadyPerformance,
}) => {
  const [duration, setDuration] = useState(Number(videoDuration) || 0);
  const [ready, setReady] = useState(false);
  const [coverImage, setCoverImage] = useState(videoThumbnail || null);
  const [videoSize, setVideoSize] = useState({ width: 9, height: 16 });
  const [background, setBackground] = useState(null);
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [isMutedState, setIsMutedState] = useState(Boolean(muted));
  const [currentTime, setCurrentTime] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [gestureIndicator, setGestureIndicator] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  const player = useVideoPlayer(videoUrl, instance => {
    instance.loop = true;
    instance.muted = muted;
    instance.timeUpdateEventInterval = 0.25;
  });

  const manualOverride = useRef(null);
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressBarWidth = useRef(SCREEN_WIDTH * 0.7);
  const wasPlayingBeforeSeek = useRef(false);
  const seekTimeRef = useRef(0);
  const gestureIndicatorTimeout = useRef(null);
  const mounted = useRef(true);
  const lastTapRef = useRef(0);
  const singleTapRef = useRef(null);
  const gestureRef = useRef({
    mode: null, baseTime: 0, targetTime: 0,
    baseSpeed: 1, appliedSpeed: 1,
    lastRewindSeconds: -1, lastShownSpeed: null,
  }).current;

  const initialHeight = containerHeight
    || Math.min(MAX_IMAGE_HEIGHT, Math.max(MIN_IMAGE_HEIGHT, SCREEN_WIDTH * (16 / 9)));
  const videoHeightAnimation = useRef(new Animated.Value(initialHeight)).current;
  const latestRef = useRef({ player, duration, currentTime, isPlayingState });

  useEffect(() => {
    latestRef.current = { player, duration, currentTime, isPlayingState };
  });

  useEffect(() => {
    let alive = true;
    if (!videoUrl) return;
    if (videoThumbnail) { setCoverImage(videoThumbnail); return; }
    (async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, { time: 3000, quality: 0.8 });
        if (alive) setCoverImage(uri);
      } catch (_) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000, quality: 0.5 });
          if (alive) setCoverImage(uri);
        } catch (_) { /* ignore */ }
      }
    })();
    return () => { alive = false; };
  }, [videoUrl, videoThumbnail, retryTick]);

  useEffect(() => {
    let active = true;
    setBackground(null);
    if (!videoUrl || !isVisible || duration <= 0) return () => { active = false; };

    requestVideoBackground({
      uri: videoUrl,
      cacheKey: videoId,
      duration,
      width: videoSize.width,
      height: videoSize.height,
      size: videoSizeBytes,
      thumbnailUri: videoThumbnail,
    }).then(result => {
      if (active) setBackground(result);
    }).catch(error => {
      console.warn('Could not prepare the video background:', error.name || 'Unknown error');
    });

    return () => { active = false; };
  }, [videoUrl, videoId, videoThumbnail, duration, videoSize, videoSizeBytes, isVisible]);

  useEffect(() => {
    if (player) {
      safePlayerSet(player, 'muted', muted);
      setIsMutedState(Boolean(muted));
    }
  }, [player, muted]);

  useEffect(() => {
    videoPreloader.registerPlayer(player);
    return () => videoPreloader.unregisterPlayer(player);
  }, [player]);

  useEffect(() => {
    if (!player || !ready) return;
    if (isVisible && manualOverride.current !== false) safePlayerAction(player, 'play');
    else if (!isVisible) safePlayerAction(player, 'pause');
  }, [player, ready, isVisible]);

  useEffect(() => {
    if (!player) return;
    const s1 = player.addListener('statusChange', ({ status }) => {
      setReady(status === 'readyToPlay');
      setIsBuffering(status === 'loading');
      if (status === 'error') setHasError(true);
      if (status === 'readyToPlay') setHasError(false);
    });
    const s2 = player.addListener('playingChange', ({ isPlaying }) => {
      setIsPlayingState(isPlaying);
      if (isPlaying) videoPreloader.pauseOtherPlayers(player);
    });
    const s3 = player.addListener('videoTrackChange', ({ videoTrack }) => {
      const w = videoTrack?.size?.width, h = videoTrack?.size?.height;
      if (w > 0 && h > 0) setVideoSize({ width: w, height: h });
    });
    const s4 = player.addListener('timeUpdate', ({ currentTime: t, duration: d }) => {
      if (d > 0 && d !== duration) setDuration(d);
      if (!isSeeking) {
        setCurrentTime(t);
        const total = d || duration;
        if (total > 0) progressAnim.setValue(t / total);
      }
    });
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [player, duration, isSeeking, progressAnim]);

  useEffect(() => {
    if (containerHeight) {
      Animated.timing(videoHeightAnimation, {
        toValue: containerHeight, duration: 220, useNativeDriver: false,
      }).start();
      return;
    }
    const next = Math.min(
      MAX_IMAGE_HEIGHT,
      Math.max(MIN_IMAGE_HEIGHT, SCREEN_WIDTH * (videoSize.height / videoSize.width)),
    );
    Animated.timing(videoHeightAnimation, {
      toValue: next, duration: 220, useNativeDriver: false,
    }).start();
  }, [videoSize, containerHeight, videoHeightAnimation]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (gestureIndicatorTimeout.current) clearTimeout(gestureIndicatorTimeout.current);
      if (singleTapRef.current) clearTimeout(singleTapRef.current);
      if (player) {
        safePlayerAction(player, 'pause');
        videoPreloader.unregisterPlayer(player);
      }
    };
  }, [player]);

  const animateChrome = to => {
    Animated.timing(chromeOpacity, { toValue: to, duration: 220, useNativeDriver: true }).start();
  };
  const revealChrome = () => {
    setChromeVisible(true);
    animateChrome(1);
  };

  useEffect(() => {
    if (isVisible) revealChrome();
  }, [isVisible]);

  const showGestureIndicator = (payload, hideAfter = 700) => {
    setGestureIndicator(payload);
    if (gestureIndicatorTimeout.current) clearTimeout(gestureIndicatorTimeout.current);
    gestureIndicatorTimeout.current = setTimeout(() => {
      gestureIndicatorTimeout.current = null;
      if (mounted.current) setGestureIndicator(null);
    }, hideAfter);
  };

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    const willPlay = !isPlayingState;
    safePlayerAction(player, willPlay ? 'play' : 'pause');
    setIsPlayingState(willPlay);
    manualOverride.current = willPlay;
    revealChrome();
  }, [player, isPlayingState]);

  const toggleMute = useCallback(() => {
    const next = !isMutedState;
    safePlayerSet(player, 'muted', next);
    setIsMutedState(next);
    onMuteChange?.(next);
    revealChrome();
  }, [player, isMutedState, onMuteChange]);

  const handleRetry = useCallback(() => {
    if (!player) return;
    setHasError(false);
    setReady(false);
    setIsBuffering(true);
    try {
      if (typeof player.replaceAsync === 'function') {
        player.replaceAsync(videoUrl).catch(() => {});
      } else if (typeof player.replace === 'function') {
        player.replace(videoUrl);
      }
    } catch (_) { /* ignore */ }
    setRetryTick(v => v + 1);
  }, [player, videoUrl]);

  const handleDoubleTapSeek = useCallback((tapX) => {
    if (!player || duration <= 0) { togglePlayPause(); return; }
    const isLeft = tapX < SCREEN_WIDTH / 2;
    const delta = isLeft ? -DOUBLE_TAP_SEEK_SECONDS : DOUBLE_TAP_SEEK_SECONDS;
    const cur = Number.isFinite(currentTime) ? currentTime : 0;
    const target = Math.max(0, Math.min(duration, cur + delta));
    safePlayerSet(player, 'currentTime', target);
    setCurrentTime(target);
    progressAnim.setValue(target / duration);
    revealChrome();
    showGestureIndicator(
      { type: 'seek', direction: isLeft ? 'back' : 'forward', seconds: Math.abs(delta), targetTime: target },
      600,
    );
  }, [player, duration, currentTime, progressAnim, togglePlayPause]);

  const handleTap = useCallback((event) => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    const native = event?.nativeEvent || {};
    const tapX = native.locationX ?? native.pageX ?? SCREEN_WIDTH / 2;
    if (delta < DOUBLE_TAP_DELAY) {
      if (singleTapRef.current) { clearTimeout(singleTapRef.current); singleTapRef.current = null; }
      handleDoubleTapSeek(tapX);
      return;
    }
    if (singleTapRef.current) clearTimeout(singleTapRef.current);
    singleTapRef.current = setTimeout(() => {
      singleTapRef.current = null;
      if (!mounted.current) return;
      revealChrome();
      if (onVideoPress) onVideoPress();
      else togglePlayPause();
    }, DOUBLE_TAP_DELAY);
  }, [handleDoubleTapSeek, onVideoPress, togglePlayPause]);

  const swipePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (e, gs) => _isHorizontalSwipe(gs),
    onMoveShouldSetPanResponderCapture: (e, gs) => _isHorizontalSwipe(gs),
    onPanResponderGrant: () => {
      if (gestureIndicatorTimeout.current) { clearTimeout(gestureIndicatorTimeout.current); gestureIndicatorTimeout.current = null; }
      revealChrome();
      const { currentTime: t } = latestRef.current;
      gestureRef.mode = null;
      gestureRef.baseTime = Number.isFinite(t) ? t : 0;
      gestureRef.targetTime = gestureRef.baseTime;
      gestureRef.baseSpeed = 1;
      gestureRef.appliedSpeed = 1;
      gestureRef.lastRewindSeconds = -1;
      gestureRef.lastShownSpeed = null;
    },
    onPanResponderMove: (e, gs) => {
      const mode = gs.dx < 0 ? 'speed' : 'seek';
      gestureRef.mode = mode;
      const dist = Math.abs(gs.dx);
      if (mode === 'speed') {
        const next = _getSpeedForDistance(dist);
        if (next !== gestureRef.appliedSpeed) {
          gestureRef.appliedSpeed = next;
          safePlayerSet(latestRef.current.player, 'playbackRate', next);
        }
        if (next !== gestureRef.lastShownSpeed) {
          gestureRef.lastShownSpeed = next;
          setGestureIndicator({ type: 'speed', speed: next });
        }
        return;
      }
      const total = latestRef.current.duration || 0;
      const rewind = _getRewindSeconds(dist);
      if (rewind === gestureRef.lastRewindSeconds) return;
      gestureRef.lastRewindSeconds = rewind;
      const target = Math.max(0, Math.min(total, gestureRef.baseTime - rewind));
      gestureRef.targetTime = target;
      setGestureIndicator({
        type: 'seek', direction: 'back',
        seconds: Math.max(0, Math.round(gestureRef.baseTime - target)),
        targetTime: target,
      });
    },
    onPanResponderRelease: () => {
      const mode = gestureRef.mode;
      gestureRef.mode = null;
      if (mode === 'seek' && latestRef.current.player && latestRef.current.duration > 0) {
        const target = Math.max(0, Math.min(latestRef.current.duration, gestureRef.targetTime));
        safePlayerSet(latestRef.current.player, 'currentTime', target);
        setCurrentTime(target);
        progressAnim.setValue(target / latestRef.current.duration);
      }
      if (mode === 'speed') {
        safePlayerSet(latestRef.current.player, 'playbackRate', 1);
      }
      revealChrome();
      if (gestureIndicatorTimeout.current) clearTimeout(gestureIndicatorTimeout.current);
      gestureIndicatorTimeout.current = setTimeout(() => {
        gestureIndicatorTimeout.current = null;
        if (mounted.current) setGestureIndicator(null);
      }, mode === 'seek' ? 500 : 800);
    },
    onPanResponderTerminate: () => {
      gestureRef.mode = null;
      if (gestureIndicatorTimeout.current) clearTimeout(gestureIndicatorTimeout.current);
      gestureIndicatorTimeout.current = setTimeout(() => {
        gestureIndicatorTimeout.current = null;
        if (mounted.current) setGestureIndicator(null);
      }, 400);
    },
  })).current;

  const progressPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => {
      revealChrome();
      wasPlayingBeforeSeek.current = isPlayingState;
      if (isPlayingState && player) safePlayerAction(player, 'pause');
      setIsSeeking(true);
      const x = e.nativeEvent.locationX;
      const t = Math.max(0, Math.min(duration, (x / progressBarWidth.current) * duration));
      seekTimeRef.current = t;
      setSeekTime(t);
    },
    onPanResponderMove: e => {
      const x = e.nativeEvent.locationX;
      const t = Math.max(0, Math.min(duration, (x / progressBarWidth.current) * duration));
      seekTimeRef.current = t;
      setSeekTime(t);
    },
    onPanResponderRelease: () => {
      if (player && duration > 0) {
        safePlayerSet(player, 'currentTime', seekTimeRef.current);
        setCurrentTime(seekTimeRef.current);
        progressAnim.setValue(seekTimeRef.current / duration);
        if (wasPlayingBeforeSeek.current) safePlayerAction(player, 'play');
      }
      setIsSeeking(false);
      revealChrome();
    },
    onPanResponderTerminate: () => {
      if (player && duration > 0) {
        safePlayerSet(player, 'currentTime', seekTimeRef.current);
        setCurrentTime(seekTimeRef.current);
        progressAnim.setValue(seekTimeRef.current / duration);
        if (wasPlayingBeforeSeek.current) safePlayerAction(player, 'play');
      }
      setIsSeeking(false);
      revealChrome();
    },
  })).current;

  if (!videoUrl) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });
  const displayProgress = duration > 0 ? (isSeeking ? seekTime : currentTime) / duration : 0;
  const displayTime = isSeeking ? seekTime : currentTime;
  const accent = progressColor || '#fff';
  const showTopMuteResolved = showTopMute ?? !showPlaybackControls;

  const muteButton = (size = 18) => (
    <TouchableOpacity
      onPress={toggleMute}
      style={styles.videoMuteBtn}
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={isMutedState ? 'Unmute video' : 'Mute video'}
    >
      <Ionicons name={isMutedState ? 'volume-mute' : 'volume-high'} size={size} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.videoContainer, { height: videoHeightAnimation }]}>
      {videoLink ? (
        <Text
          style={[styles.videoLinkBadge, { color: theme?.accent || '#fff' }]}
          numberOfLines={1}
          onPress={() => Linking.openURL(videoLink)}
        >
          <Ionicons name="link-outline" size={12} /> {videoLink}
        </Text>
      ) : null}

      <View style={[styles.videoPlayerFrame, { backgroundColor: theme?.mediaLoadingBackground }]}>
        <VideoBackground
          frameUri={background?.frameUri || coverImage}
          duration={background?.duration}
          active={isVisible && isPlayingState}
        />

        {!ready && coverImage ? (
          <Image source={normalizeImageSource({ uri: coverImage })} style={styles.videoCover} resizeMode="cover" />
        ) : null}

        <VideoView
          player={player}
          style={[styles.videoView, background?.frameUri ? { opacity: 0.96 } : null]}
          contentFit={contentFit}
          nativeControls={false}
        />

        <View style={StyleSheet.absoluteFill} {...swipePanResponder.panHandlers}>
          <TouchableWithoutFeedback onPress={handleTap}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </View>

        {(isBuffering || !ready) && !hasError && (
          <View style={styles.videoOverlayCenter} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {ready && !hasError && !isSeeking && (
          <Animated.View
            style={[
              styles.videoOverlayCenter,
              { opacity: isPlayingState ? chromeOpacity : 1 },
            ]}
            pointerEvents="box-none"
          >
            {chromeVisible && (
              <TouchableOpacity
                onPress={togglePlayPause}
                style={styles.videoPauseCircle}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isPlayingState ? 'Pause video' : 'Play video'}
              >
                <Ionicons
                  name={isPlayingState ? 'pause' : 'play'}
                  size={32}
                  color="#fff"
                  style={!isPlayingState ? { marginLeft: 3 } : null}
                />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {hasError && (
          <View style={styles.videoOverlayCenter}>
            <View style={styles.videoErrorBox}>
              <Ionicons name="alert-circle-outline" size={28} color="#fff" />
              <Text style={styles.videoErrorText}>Video failed to load</Text>
              <TouchableOpacity style={styles.videoRetryBtn} onPress={handleRetry}>
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={styles.videoRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showTopMuteResolved && !hasError && (
          <Animated.View
            style={[styles.videoTopMute, { opacity: chromeOpacity }]}
            pointerEvents={chromeVisible ? 'box-none' : 'none'}
          >
            {muteButton(20)}
          </Animated.View>
        )}

        {showPlaybackControls && ready && !hasError && (
          <Animated.View
            style={[styles.videoBottomBar, { opacity: chromeOpacity }]}
            pointerEvents={chromeVisible ? 'box-none' : 'none'}
          >
            {showBottomMute && muteButton(17)}
            <TouchableOpacity
              style={styles.videoBarPlayButton}
              onPress={togglePlayPause}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isPlayingState ? 'Pause video' : 'Resume video'}
            >
              <Ionicons
                name={isPlayingState ? 'pause' : 'play'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            <View
              style={styles.videoProgressWrap}
              onLayout={e => { progressBarWidth.current = e.nativeEvent.layout.width; }}
              {...progressPanResponder.panHandlers}
            >
              <View style={styles.videoProgressTrack}>
                <Animated.View
                  style={[styles.videoProgressFill, { width: progressWidth, backgroundColor: accent }]}
                />
                <View
                  style={[
                    styles.videoProgressThumb,
                    { left: `${Math.max(0, Math.min(1, displayProgress)) * 100}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.videoTimeText}>
              {_formatTime(displayTime)} / {_formatTime(duration)}
            </Text>
          </Animated.View>
        )}

        {!showPlaybackControls && ready && !hasError && (
          <View style={styles.videoProgressLineWrap} pointerEvents="none">
            <Animated.View
              style={[styles.videoProgressLine, { width: progressWidth, backgroundColor: accent }]}
            />
          </View>
        )}

        {gestureIndicator && (
          <View style={styles.videoOverlayCenter} pointerEvents="none">
            <View style={styles.videoGestureBubble}>
              <Ionicons
                name={
                  gestureIndicator.type === 'speed'
                    ? 'play-forward'
                    : gestureIndicator.direction === 'forward'
                      ? 'play-forward'
                      : 'play-back'
                }
                size={20}
                color="#fff"
              />
              <Text style={styles.videoGestureText}>
                {gestureIndicator.type === 'speed'
                  ? `${gestureIndicator.speed}x`
                  : `${gestureIndicator.direction === 'forward' ? '+' : '-'}${gestureIndicator.seconds}s`}
              </Text>
            </View>
            {gestureIndicator.type === 'seek' && (
              <Text style={styles.videoGestureSub}>{_formatTime(gestureIndicator.targetTime)}</Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

/* ============================================================
   Shared UI helpers
   ============================================================ */
const ImageWithPlaceholder = React.memo(({ source, style, resizeMode, transparentBackground, variants }) => {
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
            style={{ width: 46, height: 46, resizeMode: 'contain' }}
          />
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: loaded ? 1 : 0 }]}>
        <Image
          source={normalizeImageSource(getImageSource(source))}

          style={[StyleSheet.absoluteFillObject, style]}

          onLoad={onLoad}
          onError={() => setLoaded(false)}
          resizeMode={resizeMode || 'cover'}
        />
      </Animated.View>
    </Animated.View>
  );
});

const ImageSlider = React.memo(({
  images,
  isDarkMode,
  height,
  width = CARD_WIDTH,
  resizeMode = 'contain',
  loadingBackground,
}) => {
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
        source={normalizeImageSource(getImageSource(currentImage))}

        style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
        resizeMode={resizeMode}
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
            style={[styles.houseImage, { width, height: containerHeight }]}
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

const FeedProductStrip = React.memo(({
  products,
  onPress,
  onVideoPress,
  onUserPress,
  title,
  isDarkMode,
  tileHeight = 180,
  tileWidth = 132,
  onlineUsers = {},
}) => {
  const visibleProducts = products
    .filter(product => getPostCoverUri(product))
    .slice(0, 10);

  if (visibleProducts.length === 0) return null;

  return (
    <View style={[styles.productStrip, { height: tileHeight + (title ? 44 : 14) }]}>
      {!!title && (
        <Text style={[styles.productStripTitle, { color: isDarkMode ? '#dddddd' : '#111111' }]}>{title}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productStripContent}
      >
        {visibleProducts.map(product => {
          const image = getPostCoverUri(product);
          const label = product.productName || product.category || 'Product';
          const amountText = product.amount
            || (product.price != null ? `RWF ${product.price.toLocaleString()}` : '');

          return (
            <View
              key={product._id}
              style={[styles.productTile, { width: tileWidth, height: tileHeight }]}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => product.videoUrl ? onVideoPress?.(product) : onPress(product)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={product.videoUrl ? 'Open video Reel' : `Open ${label} details`}
              >
                <Image
                  source={normalizeImageSource(getImageSource(image))}
                  style={styles.productTileImage}
                />
                <View style={styles.productTileShade} pointerEvents="none" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.productTileLabelButton}
                onPress={() => onPress(product)}
                activeOpacity={0.85}
              >
                <Text style={styles.productTileLabel} numberOfLines={2}>{label}</Text>
              </TouchableOpacity>

              {product.videoUrl && (
                <View style={styles.productTileVideoBadge}>
                  <Ionicons name="videocam" size={11} color="#fff" />
                </View>
              )}

              <View style={styles.productTileUserRow}>
                <View style={styles.avatarContainerRelative}>
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
                      source={normalizeImageSource(getImageSource(product.userAvatar))}

                      style={styles.productTileOwnerAvatar}
                    />
                  </TouchableOpacity>
                  {Boolean(product.userId && onlineUsers[String(product.userId)]) && (
                    <View style={styles.onlineDotSmall} />
                  )}
                </View>
              </View>

              {!!amountText && (
                <TouchableOpacity
                  style={styles.productTilePriceButton}
                  onPress={() => onPress(product)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.productTilePrice} numberOfLines={1}>{amountText}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  isVideo = false,
  inline = false,
}) => {
  const productLabel = (house.productName || house.category || house.title || 'item').trim();
  const availableSuggestion = (t.availableSuggestion || 'Is this %s available?')
    .replace('%s', productLabel || 'item');
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
          style={styles.suggestionSection}
          activeOpacity={0.7}
          onPress={() => handleQuickSuggestion(availableSuggestion)}
        >
          <Text style={styles.suggestionTitle}>{availableSuggestion}</Text>
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
   ReelVideo
   ============================================================ */
const ReelVideo = React.memo(({
  reel,
  isVisible,
  muted,
  onMuteChange,
  theme,
  height,
}) => {
  const [sourceUri, setSourceUri] = useState(null);
  const [sourceChecked, setSourceChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => networkStatus.subscribe(status => {
    if (status.isOnline) setAttempt(value => value + 1);
  }), []);

  useEffect(() => {
    let cancelled = false;
    setSourceChecked(false);
    setSourceUri(null);
    reelVideoCache.getPlayableUri(reel._id, reel.videoUrl)
      .then(uri => {
        if (cancelled) return;
        setSourceUri(uri);
        setSourceChecked(true);
      })
      .catch(error => {
        console.error('Could not resolve Reel video source:', error);
        if (!cancelled) setSourceChecked(true);
      });
    return () => { cancelled = true; };
  }, [reel._id, reel.videoUrl, attempt]);

  if (sourceUri) {
    return (
      <ShaakaVideoPlayer
        videoUrl={sourceUri}
        videoId={reel._id}
        videoThumbnail={reel.videoThumbnail}
        videoLink={reel.videoLink}
        videoDuration={reel.videoDuration}
        theme={theme}
        containerHeight={height}
        isVisible={isVisible}
        muted={muted}
        onMuteChange={onMuteChange}
        showPlaybackControls={true}
        showTopMute={true}
        showBottomMute={false}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.reelSourcePlaceholder, { height, backgroundColor: theme.reel }]}>
      {!!reel.videoThumbnail && (
        <Image
          source={normalizeImageSource({ uri: reel.videoThumbnail })}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      )}
      {sourceChecked ? (
        <View style={styles.reelOfflineMessage}>
          <Ionicons name="cloud-offline-outline" size={28} color="#fff" />
          <Text style={styles.reelOfflineText}>This Reel is not saved for offline playback.</Text>
          <TouchableOpacity
            style={styles.reelRetryButton}
            onPress={() => {
              setSourceChecked(false);
              setAttempt(value => value + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading Reel"
          >
            <Text style={styles.reelRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator color="#fff" size="large" />
      )}
    </View>
  );
});

/* ============================================================
   HouseCard
   ============================================================ */
const HouseCard = React.memo(({
  house, theme, isDarkMode, onPress, onVideoPress, onShare, isSaved, onToggleSave,
  isLoggedIn, showLoginModal, isMyPost, onUserPress, onReport,
  onMessagePress, t, onQuickSuggestion, isSendingSuggestion,
  suggestionState, videoKey, isVideoVisible, isMuted, onMuteChange,
  maxMediaHeight, minMediaHeight, screenWidth, onlineUsers = {},
}) => {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isDescTruncated, setIsDescTruncated] = useState(false);
  const [displayDesc, setDisplayDesc] = useState(house.description || '');
  const [mediaHeight, setMediaHeight] = useState(
    Math.max(minMediaHeight || 0, maxMediaHeight)
  );
  const [mediaResizeMode, setMediaResizeMode] = useState('contain');
  const description = house.description || '';
  const boundedMediaHeight = Math.max(
    minMediaHeight || 0,
    Math.min(mediaHeight, maxMediaHeight)
  );

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
          setMediaHeight(maxMediaHeight);
          setMediaResizeMode('contain');
        }
        return;
      }

      try {
        const { width, height } = await getImageSize(source);
        if (cancelled) return;
        const mediaLayout = computeScaledMediaLayout(
          width,
          height,
          screenWidth,
          maxMediaHeight,
          minMediaHeight || 0,
        );
        setMediaHeight(mediaLayout.height);
        setMediaResizeMode(mediaLayout.resizeMode);
      } catch (e) {
        if (!cancelled) {
          setMediaHeight(maxMediaHeight);
          setMediaResizeMode('contain');
        }
      }
    };

    computeHeight();
    return () => { cancelled = true; };
  }, [house._id, house.videoUrl, house.videoThumbnail, house.houseImages, maxMediaHeight, minMediaHeight, screenWidth]);

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
    const containerWidth = screenWidth - 24;
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
  }, [description, screenWidth]);

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

  const openDetail = useCallback(() => onPress(house), [onPress, house]);

  const productName = house.productName || house.category || '';
  const amountText = house.amount || (house.price != null ? `RWF ${house.price.toLocaleString()}` : '');
  const hasAmount = !!amountText;
  const ownerId = getPostOwnerId(house);

  return (
    <View style={[styles.card, { width: screenWidth, backgroundColor: theme.background }]}>
      <View style={[styles.cardMediaWrap, { height: boundedMediaHeight }]}>
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.topMetaRow}>
            <TouchableOpacity
              style={styles.topProductRow}
              onPress={openDetail}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Open ${productName || 'post'} details`}
            >
              {!!productName && (
                <Text style={styles.topProductName} numberOfLines={1}>
                  {productName}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {hasVideo ? (
          <ShaakaVideoPlayer
            videoUrl={house.videoUrl}
            videoId={house._id}
            videoThumbnail={house.videoThumbnail}
            videoLink={house.videoLink}
            videoDuration={house.videoDuration}
            theme={theme}
            containerHeight={boundedMediaHeight}
            contentFit={mediaResizeMode}
            isVisible={isVideoVisible}
            muted={isMuted}
            onMuteChange={onMuteChange}
            showPlaybackControls={false}
            showTopMute={true}
            onVideoPress={() => onVideoPress?.(house)}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openDetail}
            style={{ flex: 1 }}
          >
            <ImageSlider
              images={house.houseImages}
              isDarkMode={isDarkMode}
              height={boundedMediaHeight}
              width={screenWidth}
              resizeMode={mediaResizeMode}
              loadingBackground={theme.mediaLoadingBackground}
            />
          </TouchableOpacity>
        )}

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

        <View style={styles.bottomOverlay} pointerEvents="box-none">
          <View style={styles.bottomMetaRow}>
            <TouchableOpacity
              onPress={onUserPress}
              activeOpacity={0.85}
              style={styles.bottomUserRow}
            >
              <View style={styles.avatarContainerRelative}>
                <Image
                  source={normalizeImageSource(getImageSource(house.userAvatar))}

                  style={styles.bottomUserAvatar}
                />
                {Boolean(ownerId && onlineUsers[String(ownerId)]) && (
                  <View style={styles.onlineDotSmall} />
                )}
              </View>
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

      {(hasAmount || !!description) && (
        <View style={styles.descriptionSection}>
          {hasAmount && (
            <TouchableOpacity onPress={openDetail} activeOpacity={0.85}>
              <Text style={[styles.amountText, { color: theme.text }]} numberOfLines={1}>
                {amountText}
              </Text>
            </TouchableOpacity>
          )}

          {!!description && (
            <TouchableOpacity onPress={openDetail} activeOpacity={0.85}>
              <Text
                style={[styles.descText, { color: theme.text }]}
                numberOfLines={showFullDesc ? undefined : 2}
                ellipsizeMode="tail"
              >
                {showFullDesc ? description : displayDesc}
              </Text>
            </TouchableOpacity>
          )}

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

/* ============================================================
   ReelsFeed  (silent-refresh compatible)
   ============================================================ */
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
  onLoadMore,
  showLoginModal,
  t,
  targetReelId,
}) => {
  const isFocused = useIsFocused();
  const listRef = useRef(null);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState({});
  const [descriptionLineCounts, setDescriptionLineCounts] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [reportTarget, setReportTarget] = useState(null);
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const latestReelsRef = useRef(reels);
  const onLoadMoreRef = useRef(onLoadMore);
  latestReelsRef.current = reels;
  onLoadMoreRef.current = onLoadMore;

  const hasInitialScrolledRef = useRef(false);
  const lastScrolledReelIdRef = useRef(null);

  const handleLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  const visibleItemsChanged = useRef(({ viewableItems }) => {
    const visibleItem = viewableItems.find(item => item.isViewable);
    if (visibleItem?.index == null) return;
    const index = visibleItem.index;
    restoredReelIndex = index;
    setActiveIndex(index);

    const currentReels = latestReelsRef.current;
    [index - 1, index + 1].forEach(reelIndex => {
      const reel = currentReels[reelIndex];
      if (reel?.videoThumbnail) {
        videoPreloader.preloadThumbnail(reel.videoThumbnail, String(reel._id));
      }
    });
    if (index >= currentReels.length - 2) onLoadMoreRef.current?.();
  }).current;

  useEffect(() => {
    setReelsActive(isFocused);
    if (!isFocused) {
      videoPreloader.pauseAll();
      reelVideoCache.cancelPreload();
    }
    return () => {
      setReelsActive(false);
      reelVideoCache.cancelPreload();
    };
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    const nextReel = reels[activeIndex + 1];
    if (!nextReel) {
      reelVideoCache.cancelPreload();
      return;
    }
    reelVideoCache.preloadNext(nextReel, activeIndex).catch(error => {
      console.warn('Next Reel preload could not start:', error.message);
    });
  }, [activeIndex, isFocused, reels.length]);

  useEffect(() => {
    if (!reels.length || containerHeight <= 0) return;
    if (targetReelId && lastScrolledReelIdRef.current === targetReelId) return;

    const targetIndex = targetReelId
      ? reels.findIndex(reel => String(reel.reelId || reel._id) === targetReelId)
      : -1;
    if (targetReelId && targetIndex < 0 && loading) return;
    if (!targetReelId && hasInitialScrolledRef.current) return;

    hasInitialScrolledRef.current = true;
    const nextIndex = targetIndex >= 0
      ? targetIndex
      : Math.min(restoredReelIndex, reels.length - 1);
    if (targetReelId && targetIndex >= 0) {
      lastScrolledReelIdRef.current = targetReelId;
    }
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
    });
  }, [reels, containerHeight, targetReelId, loading]);

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

        <ReelVideo
          key={item._id}
          reel={item}
          height={containerHeight}
          theme={theme}
          isVisible={isFocused && activeIndex === index}
          muted={isMuted}
          onMuteChange={onMuteChange}
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
              source={normalizeImageSource(getImageSource(item.userAvatar))}

              style={styles.reelAvatarSmall}
            />
            <Text style={styles.reelUsername} numberOfLines={1}>
              {item.username || 'User'}
            </Text>
          </TouchableOpacity>

          {!!item.amount && (
            <TouchableOpacity
              onPress={() => onPostPress(item)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`View details for ${item.productName || 'post'}`}
            >
              <Text style={styles.reelAmount} numberOfLines={1}>
                {item.amount}
              </Text>
            </TouchableOpacity>
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
            accessibilityLabel="Message seller"
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
    <View style={styles.reelsContainer} onLayout={handleLayout} backgroundColor={theme.background}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={item => String(item.reelId || item._id)}
        renderItem={renderReel}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.max(0, targetReelId
          ? reels.findIndex(reel => String(reel.reelId || reel._id) === targetReelId)
          : Math.min(restoredReelIndex, Math.max(0, reels.length - 1)))}
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
        removeClippedSubviews={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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

/* ============================================================
   Main screen
   ============================================================ */
const BuyPostScreen = ({ navigation, language, initialTab = 'ushaka' }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { theme, isDarkMode } = useTheme();
  const contactInfo = useContactInfo();
  const socialLinks = useContactLinks(contactInfo);
  const { user: authUser } = useAuth();
  const { showBottomSheet } = useBottomSheet();
  const route = useRoute();
  const t = translations[language] || translations.English;

  const [onlineUsers, setOnlineUsers] = useState({});
  const presenceSocketRef = useRef(null);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [screenAreaHeight, setScreenAreaHeight] = useState(windowHeight);

  const maxPostMediaHeight = Math.max(
    1,
    Math.min(windowHeight * POST_MEDIA_MAX_RATIO, screenAreaHeight - HEADER_HEIGHT)
  );
  const minPostMediaHeight = Math.min(
    windowHeight * POST_MEDIA_MIN_RATIO,
    maxPostMediaHeight
  );

  const productTileHeight = Math.max(100, Math.min(180, Math.round(screenAreaHeight * 0.22)));
  const productTileWidth = Math.min(132, Math.max(104, Math.round(windowWidth * 0.34)));
  const handleScreenLayout = useCallback((event) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) setScreenAreaHeight(height);
  }, []);
  const initialLoadStartedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState(null);
  const viewerId = currentUser?._id || authUser?._id || authUser?.id;
  const isOwnPost = useCallback((post) => {
    const ownerId = getPostOwnerId(post);
    return Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));
  }, [viewerId]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedCursor, setFeedCursor] = useState(null);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [isAppendingFeed, setIsAppendingFeed] = useState(false);
  const feedAppendLock = useRef(false);
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
        const thumbnail = item?.videoThumbnail || (item?.videoUrl
          ? getVideoCover(item.videoUrl, item.videoThumbnail)
          : null);
        if (thumbnail) {
          videoPreloader.preloadThumbnail(thumbnail, `${item._id}_${activeIndex + offset + 1}`);
        }
      });
      videoPreloader.cleanupOldThumbnails();
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

  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHeightAnim = useRef(new Animated.Value(HEADER_HEIGHT)).current;
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;
  const feedListRef = useRef(null);
  const gridListRef = useRef(null);
  const lastScrollY = useRef(0);

  const eyePosRef = useRef({
    x: SCREEN_WIDTH - EYE_BUTTON_SIZE - EYE_BUTTON_MARGIN,
    y: SCREEN_HEIGHT - EYE_BUTTON_SIZE - EYE_BUTTON_BOTTOM_PADDING,
  });
  const eyeDragStartRef = useRef({ x: 0, y: 0 });
  const eyePos = useRef(new Animated.ValueXY(eyePosRef.current)).current;
  const eyePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        eyeDragStartRef.current = { ...eyePosRef.current };
      },
      onPanResponderMove: (_, gs) => {
        const nx = Math.max(
          0,
          Math.min(SCREEN_WIDTH - EYE_BUTTON_SIZE, eyeDragStartRef.current.x + gs.dx)
        );
        const ny = Math.max(
          EYE_BUTTON_MIN_TOP,
          Math.min(
            SCREEN_HEIGHT - EYE_BUTTON_SIZE - 20,
            eyeDragStartRef.current.y + gs.dy
          )
        );
        eyePos.setValue({ x: nx, y: ny });
      },
      onPanResponderRelease: (_, gs) => {
        const draggedX = Math.max(
          0,
          Math.min(SCREEN_WIDTH - EYE_BUTTON_SIZE, eyeDragStartRef.current.x + gs.dx)
        );
        const leftX = EYE_BUTTON_MARGIN;
        const rightX = Math.max(
          0,
          SCREEN_WIDTH - EYE_BUTTON_SIZE - EYE_BUTTON_MARGIN
        );
        const nx = draggedX + EYE_BUTTON_SIZE / 2 < SCREEN_WIDTH / 2
          ? leftX
          : rightX;
        const ny = Math.max(
          EYE_BUTTON_MIN_TOP,
          Math.min(
            SCREEN_HEIGHT - EYE_BUTTON_SIZE - 20,
            eyeDragStartRef.current.y + gs.dy
          )
        );
        eyePosRef.current = { x: nx, y: ny };
        eyePos.setValue({ x: nx, y: ny });
      },
      onPanResponderTerminate: () => {
        // Keep last pos
      },
    })
  ).current;

  const handleEyePress = useCallback(() => {
    if (headerVisible) {
      Animated.parallel([
        Animated.timing(headerHeightAnim, {
          toValue: 0, duration: 220, useNativeDriver: false,
        }),
        Animated.timing(headerOpacityAnim, {
          toValue: 0, duration: 220, useNativeDriver: false,
        }),
      ]).start();
      setHeaderVisible(false);
    } else {
      Animated.parallel([
        Animated.timing(headerHeightAnim, {
          toValue: HEADER_HEIGHT, duration: 220, useNativeDriver: false,
        }),
        Animated.timing(headerOpacityAnim, {
          toValue: 1, duration: 220, useNativeDriver: false,
        }),
      ]).start();
      setHeaderVisible(true);
    }
  }, [headerVisible, headerHeightAnim, headerOpacityAnim]);

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

    const headerCollapse = Math.min(currentScrollY, HEADER_HEIGHT);
    const newHeight = Math.max(HEADER_HEIGHT - headerCollapse, 0);
    const newOpacity = Math.max(1 - currentScrollY / (HEADER_HEIGHT + 20), 0);

    headerHeightAnim.setValue(newHeight);
    headerOpacityAnim.setValue(newOpacity);
    setHeaderVisible(newHeight > 10);

    lastScrollY.current = currentScrollY;
  }, [headerHeightAnim, headerOpacityAnim]);

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
    setHeaderVisible(true);
    headerHeightAnim.setValue(HEADER_HEIGHT);
    headerOpacityAnim.setValue(1);
  }, [activeTab, headerHeightAnim, headerOpacityAnim]);

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

  const fetchOnlineStatuses = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return;
    try {
      const token = await getToken();
      if (!token) return;
      const response = await axios.post(
        `${BASE_URL}/api/user/batch-online`,
        { userIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        const statuses = response.data.statuses || {};
        setOnlineUsers(prev => ({ ...prev, ...Object.fromEntries(Object.entries(statuses).map(([id, value]) => [String(id), Boolean(value)])) }));
      }
    } catch (error) {
      if (error?.response?.status !== 404) {
        console.warn('Failed to fetch buy-post online statuses:', error?.message || error);
      }
    }
  }, [getToken]);

  const connectPresenceSocket = useCallback(async () => {
    if (!isLoggedIn || !currentUser?._id) return;
    if (presenceSocketRef.current) return;

    const token = await getToken();
    if (!token) return;

    const socket = io(BASE_URL.replace('/api', ''), {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    presenceSocketRef.current = socket;

    socket.on('user-online', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers(prev => ({ ...prev, [String(uid)]: true }));
    });

    socket.on('user-offline', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers(prev => ({ ...prev, [String(uid)]: false }));
    });

    socket.on('connect', () => {
      if (currentUser?._id) {
        socket.emit('join-chat', { sellerId: currentUser._id });
      }
    });

    socket.on('disconnect', () => {
      // presence state is refreshed on next fetch
    });
  }, [currentUser, getToken, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser?._id) return;
    connectPresenceSocket();
  }, [isLoggedIn, currentUser?._id, connectPresenceSocket]);

  useEffect(() => {
    const ids = Array.from(new Set(
      [...feedPosts, ...myPosts, ...savedPosts]
        .map(post => getPostOwnerId(post))
        .filter(Boolean)
    ));
    if (ids.length) fetchOnlineStatuses(ids);
  }, [feedPosts, myPosts, savedPosts, fetchOnlineStatuses]);

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
      if (error?.response?.status !== 401 && error?.code !== 'ERR_NETWORK' && error?.message !== 'Network Error') {
        console.error('Notes fetch failed:', error.message);
      }
      return [];
    }
  }, [loadViewedTimestamps]);

  const fetchFeed = useCallback(async (cursor = null, limit = 20, onCachedFeed) => {
    const cachedPostsPromise = cursor
      ? Promise.resolve(null)
      : (async () => {
        try {
          const cachedPages = await offlineDatabase.getCollection('buy-post-feed-pages');
          if (cachedPages.length) {
            const uniquePosts = new Map();
            cachedPages
              .sort((first, second) => first.value.pageNumber - second.value.pageNumber)
              .forEach(({ value }) => {
                (value.posts || []).forEach(post => uniquePosts.set(String(post._id), post));
              });
            return [...uniquePosts.values()];
          }
          const cachedFeed = await offlineDatabase.getRecord('buy-post-feed', 'page-1');
          if (Array.isArray(cachedFeed)) return cachedFeed;
          const legacyFeed = await offlineDatabase.getRecord('feed', 'page-1');
          return Array.isArray(legacyFeed) ? legacyFeed : null;
        } catch (error) {
          console.warn('Could not read cached BuyPost feed:', error.message);
          return null;
        }
      })();
    let networkFeedReceived = false;
    if (onCachedFeed) {
      cachedPostsPromise.then(cachedPosts => {
        if (Array.isArray(cachedPosts) && !networkFeedReceived) {
          onCachedFeed({
            posts: cachedPosts.map(mapPost).filter(post => post.status !== 'stopped'),
            hasMore: false,
            nextCursor: null,
          });
        }
      }).catch(error => {
        console.warn('Could not read cached BuyPost feed:', error.message);
      });
    }

    try {
      const networkPromise = networkStatus.start().then(status => {
        if (!status.isOnline) throw new Error('No network connection');
        return axios.get(`${BASE_URL}/api/posts`, {
          params: { pagination: 'cursor', cursor: cursor || undefined, limit },
        });
      });
      const response = await networkPromise;
      networkFeedReceived = true;
      const activePosts = (response.data.posts || []).map(mapPost).filter(post => post.status !== 'stopped');
      (async () => {
        try {
          const pages = await offlineDatabase.getCollection('buy-post-feed-pages');
          const previousPage = cursor
            ? pages.find(page => page.value.nextCursor === cursor)
            : null;
          const pageNumber = previousPage
            ? previousPage.value.pageNumber + 1
            : cursor ? pages.length + 1 : 1;
          const cachedFeed = await mediaCache.hydrate(response.data.posts || []);
          const pageRecord = {
            cursor,
            pageNumber,
            posts: cachedFeed,
            hasMore: response.data.hasMore !== false,
            nextCursor: response.data.nextCursor || null,
          };
          await offlineDatabase.putRecord(
            'buy-post-feed-pages',
            cursor || 'first',
            pageRecord,
            { priority: 'medium' }
          );
          if (!cursor) {
            await offlineDatabase.putRecord('buy-post-feed', 'page-1', cachedFeed, { priority: 'medium' });
          }
        } catch (cacheError) {
          console.warn('Could not cache BuyPost feed page:', cacheError.message);
        }
      })();
      return {
        posts: activePosts,
        hasMore: response.data.hasMore !== false,
        nextCursor: response.data.nextCursor || null,
      };
    } catch (error) {
      if (error?.response?.status !== 401 && error?.code !== 'ERR_NETWORK' && error?.message !== 'Network Error') {
        console.error('Public feed fetch failed:', error.message);
      }
      const cachedPosts = await cachedPostsPromise;
      if (Array.isArray(cachedPosts)) {
        return {
          posts: cachedPosts.map(mapPost).filter(post => post.status !== 'stopped'),
          hasMore: false,
          nextCursor: null,
        };
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

    const applyFeed = feed => {
      let filteredFeed = feed.posts;
      if (isLoggedIn && currentUser) {
        filteredFeed = feed.posts.filter(post => post.userId !== currentUser._id);
      }
      setFeedPosts(sortFeedPosts(filteredFeed, isRefresh));
      setFeedCursor(feed.nextCursor);
      setHasMoreFeed(feed.hasMore);
      setLoading(false);
    };

    try {
      const feedPromise = fetchFeed(null, 20, applyFeed);
      const feed = await feedPromise;
      applyFeed(feed);
      const notesPromise = fetchNotes();
      const userPostsPromise = isLoggedIn
        ? Promise.all([fetchMyPosts(), fetchSavedPosts()])
        : Promise.resolve(null);
      const [notes, userPosts] = await Promise.all([notesPromise, userPostsPromise]);
      setUpdates(notes);
      if (isLoggedIn) {
        const [my, saved] = userPosts;
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
    setHeaderVisible(true);
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
      const replyPost = buildChatReplyPost(house);
      replyPost.username = sellerDisplayName;
      replyPost.videoThumbnail = getVideoCover(house.videoUrl, house.videoThumbnail) || replyPost.videoThumbnail || '';
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

  const handleReelPress = useCallback((post) => {
    const videoUrl = post?.videoUrl || post?.videoHlsUrl || post?.video?.url || '';
    if (!videoUrl) return;
    navigation.navigate('BuyPost', {
      activeTab: 'videos',
      reelId: String(post.reelId || post._id || post.id || post.videoId || videoUrl),
      reelPost: { ...post, videoUrl },
    });
  }, [navigation]);

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
    const sellerId = getPostOwnerId(house);
    if (!sellerId) {
      Alert.alert('Error', t.sellerInfoMissing);
      return;
    }
    if (!viewerId) {
      Alert.alert(t.error, t.userInfoMissing);
      return;
    }
    if (String(viewerId) === String(sellerId)) {
      Alert.alert(t.error, t.cannotMessageYourself);
      return;
    }

    const postId = house._id || house.id;
    if (!postId) {
      Alert.alert('Error', t.sellerInfoMissing);
      return;
    }

    const sellerDisplayName = getUserDisplayName(house.user || house, 'Seller');
    const productName = house.productName || house.title || 'Product';
    navigation.navigate('Chat', {
      sellerId: String(sellerId),
      sellerName: sellerDisplayName,
      sellerAvatar: house.userAvatar || house.user?.avatar || '',
      sellerPhone: house.contactNumber1 || house.contactNumber2 || '',
      postId: String(postId),
      postTitle: productName,
      replyPost: buildChatReplyPost(house),
    });
  }, [isLoggedIn, t, navigation, viewerId, showBottomSheet]);

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
  ), [theme.textSecondary, t.followUs, openSocialLink, socialLinks]);

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
    if (activeTab === 'videos') {
      posts.sort((a, b) => {
        const dateDifference = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return dateDifference || String(b._id).localeCompare(String(a._id));
      });
    }
    return activeTab === 'utanga' ? posts : posts.filter(post => !isOwnPost(post));
  }, [activeTab, browseFeedPosts, isLoggedIn, isOwnPost, myPosts, savedPosts]);

  const targetReelId = String(route.params?.reelId || '');
  const targetReelPost = route.params?.reelPost;
  const displayedReels = useMemo(() => {
    const reels = getDisplayedPosts();
    if (!targetReelId || reels.some(reel => String(reel.reelId || reel._id) === targetReelId)) {
      return reels;
    }

    if (!targetReelPost || typeof targetReelPost !== 'object') return reels;
    const targetReel = mapPost(targetReelPost);
    if (!targetReel.videoUrl) return reels;

    return [{
      ...targetReel,
      _id: String(targetReel._id || targetReel.id || targetReelId),
      reelId: targetReelId,
    }, ...reels];
  }, [getDisplayedPosts, targetReelId, targetReelPost]);

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
    if ((activeTab !== 'ushaka' && activeTab !== 'videos') ||
      refreshing || feedError || isAppendingFeed || feedAppendLock.current) return;
    if (!hasMoreFeed) return;
    if (!feedPosts || feedPosts.length === 0) return;
    feedAppendLock.current = true;
    setIsAppendingFeed(true);
    try {
      const result = await fetchFeed(feedCursor, 20);
      setFeedPosts(currentPosts => {
        const existingIds = new Set(currentPosts.map(post => String(post._id)));
        const additions = result.posts.filter(post => !existingIds.has(String(post._id)));
        return sortFeedPosts([...currentPosts, ...additions], false);
      });
      setFeedCursor(result.nextCursor);
      setHasMoreFeed(result.hasMore && Boolean(result.nextCursor));
    } catch (error) {
      Alert.alert('Error', 'Failed to load more posts.');
      setFeedError(true);
    } finally {
      feedAppendLock.current = false;
      setIsAppendingFeed(false);
    }
  }, [activeTab, refreshing, feedError, isAppendingFeed, hasMoreFeed, feedPosts.length, feedCursor, fetchFeed, sortFeedPosts]);

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

  /* ============================================================
     SILENT AUTO-REFRESH
     - Only runs on the Videos tab and the Saved tab
     - Never touches `loading` / `refreshing` / `isAppendingFeed`
     - Never shows a spinner, alert, or console log
     - Skips the poll while the app is in the background
     - Only writes state when the data actually changed
     ============================================================ */
  const silentRefreshInFlightRef = useRef(false);
  const feedPostsRef = useRef(feedPosts);
  const savedPostsRef = useRef(savedPosts);
  const activeTabRef = useRef(activeTab);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => { feedPostsRef.current = feedPosts; }, [feedPosts]);
  useEffect(() => { savedPostsRef.current = savedPosts; }, [savedPosts]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      appStateRef.current = state;
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (activeTab !== 'videos' && activeTab !== 'saved') return undefined;
    if (activeTab === 'saved' && !isLoggedIn) return undefined;

    let cancelled = false;
    let intervalId = null;

    const runSilentRefresh = async () => {
      if (cancelled) return;
      if (silentRefreshInFlightRef.current) return;
      if (appStateRef.current !== 'active') return;
      silentRefreshInFlightRef.current = true;
      try {
        if (activeTabRef.current === 'videos') {
          const response = await axios.get(`${BASE_URL}/api/posts`, {
            params: { pagination: 'cursor', limit: 20 },
          });
          if (cancelled) return;
          const fresh = (response.data.posts || [])
            .map(mapPost)
            .filter(post => post.status !== 'stopped' && post.videoUrl);
          if (fresh.length === 0) return;

          const currentPosts = feedPostsRef.current || [];
          const currentIds = new Set(currentPosts.map(p => String(p._id)));

          const additions = fresh.filter(p => !currentIds.has(String(p._id)));
          if (additions.length === 0) return;

          setFeedPosts(prev => {
            const prevIds = new Set(prev.map(p => String(p._id)));
            const newOnes = additions.filter(p => !prevIds.has(String(p._id)));
            if (newOnes.length === 0) return prev;
            return sortFeedPosts([...newOnes, ...prev], false);
          });
        } else if (activeTabRef.current === 'saved') {
          const token = await getToken();
          if (!token || cancelled) return;
          const response = await axios.get(`${BASE_URL}/api/posts/saved`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          const fresh = (response.data.posts || [])
            .map(mapPost)
            .filter(post => post.status !== 'stopped');

          const currentPosts = savedPostsRef.current || [];
          const freshIds = fresh.map(p => String(p._id));
          const currentIds = currentPosts.map(p => String(p._id));
          const freshSet = new Set(freshIds);
          const currentSet = new Set(currentIds);
          const same = freshSet.size === currentSet.size &&
            [...freshSet].every(id => currentSet.has(id));
          if (same) return;

          setSavedPosts(fresh);
          setSavedPostIds(freshIds);
        }
      } catch (_) {
        // Deliberately silent – no console log, no Alert, no tracking.
      } finally {
        silentRefreshInFlightRef.current = false;
      }
    };

    intervalId = setInterval(runSilentRefresh, SILENT_REFRESH_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, isLoggedIn, getToken, sortFeedPosts]);

  const renderGridPostItem = useCallback(({ item }) => {
    const isSavedTab = activeTab === 'saved';
    const showDelete = isLoggedIn && !isSavedTab;
    const imageUri = item.videoUrl
      ? getVideoCover(item.videoUrl, item.videoThumbnail)
      : item.houseImages?.[0];
    return (
      <View style={[styles.gridPostItem, { width: (windowWidth - 32) / 2 }]}>
        <TouchableOpacity style={styles.gridPostImageContainer} onPress={() => handlePostPress(item)}>
          <Image
            source={normalizeImageSource({ uri: imageUri || item.houseImages?.[0] || 'https://via.placeholder.com/150' })}

            style={styles.gridPostImage}
          />
          {item.videoUrl && (
            <View style={styles.videoCoverBadge}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          )}
          {isSavedTab && (
            <TouchableOpacity
              style={[styles.unsaveButton, { backgroundColor: isDarkMode ? '#111' : '#dddddd' }]}
              onPress={event => {
                event?.stopPropagation?.();
                toggleSave(item);
              }}
            >
              <Ionicons name="bookmark" size={22} color={isDarkMode ? '#cecdcd' : '#888888'} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {showDelete && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: isDarkMode ? '#111' : '#dddddd' }]}
            onPress={() => confirmDeletePost(item._id)}
          >
            <View style={styles.gridMenuIconWrapper}>
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineTop, { backgroundColor: '#47ae87' }]} />
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineMiddle, { backgroundColor: '#47ae87' }]} />
              <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineBottom, { backgroundColor: '#47ae87' }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [activeTab, isLoggedIn, isDarkMode, handlePostPress, toggleSave, confirmDeletePost, windowWidth]);

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
        onVideoPress={handleReelPress}
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
        maxMediaHeight={maxPostMediaHeight}
        minMediaHeight={minPostMediaHeight}
        screenWidth={windowWidth}
        onlineUsers={onlineUsers}
      />
    );
  }, [theme, isDarkMode, handlePostPress, handleReelPress, handleShare, savedPostIds, toggleSave, isLoggedIn, handleUserPress, handleReport, handleMessagePress, t, sendQuickSuggestion, isSendingSuggestion, getSuggestionState, activeVideoKey, isMuted, handleMuteChange, showBottomSheet, navigation, maxPostMediaHeight, minPostMediaHeight, windowWidth]);

  const renderFeedItem = useCallback(({ item, index }) => {
    if (item.isFeedProductStrip) {
      return (
        <FeedProductStrip
          title={t.trending}
          products={item.products}
          onPress={handlePostPress}
          onVideoPress={handleReelPress}
          onUserPress={handleUserPress}
          isDarkMode={isDarkMode}
          tileHeight={productTileHeight}
          tileWidth={productTileWidth}
          onlineUsers={onlineUsers}
        />
      );
    }
    return renderHouseCard({ item, index });
  }, [handlePostPress, handleReelPress, handleUserPress, renderHouseCard, t.trending, isDarkMode, productTileHeight, productTileWidth]);

  const shouldShowUnread = useCallback((update) => {
    if (!update.lastViewedAt) return true;
    const lastViewedDate = new Date(update.lastViewedAt);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - lastViewedDate.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return hoursDiff >= 24;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} onLayout={handleScreenLayout}>
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
                      if (activeTab !== tab.key) setActiveTab(tab.key);
                    } else if (route.name !== tab.route) {
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
          reels={displayedReels}
          loading={loading}
          navigation={navigation}
          targetReelId={targetReelId}
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
          onLoadMore={handleFeedEndReached}
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
                <View>
                  <FeedProductStrip
                    title={t.trending}
                    products={trendingPosts}
                    onPress={handlePostPress}
                    onVideoPress={handleReelPress}
                    onUserPress={handleUserPress}
                    isDarkMode={isDarkMode}
                    tileHeight={productTileHeight}
                    tileWidth={productTileWidth}
                    onlineUsers={onlineUsers}
                  />
                </View>
                <View>
                  <Text style={[styles.newPostsTitle, { color: isDarkMode ? '#dddddd' : '#111111' }]}>
                    {t.newPosts}
                  </Text>
                </View>
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

      {/* Header visibility toggle:
            – hidden on the Videos (Reels) tab
            – hidden while the update detail sheet is open
            – hidden while the "add update" sheet is open */}
      {activeTab !== 'videos' && !detailSheetVisible && !addSheetVisible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.floatingEyeButton,
            {
              transform: eyePos.getTranslateTransform(),
            },
          ]}
          {...eyePanResponder.panHandlers}
        >
          <Svg
            width={EYE_BACKGROUND_SIZE}
            height={EYE_BACKGROUND_SIZE}
            viewBox="0 0 64 64"
            style={styles.floatingEyeButtonBackground}
            pointerEvents="none"
          >
            <Polygon
              points="32,2 55.5,13.3 61.2,38.7 45,59 19,59 2.8,38.7 8.5,13.3"
              fill={isDarkMode ? '#47ae87' : '#47ae87'}
              opacity={0.16}
            />
            <Polygon
              points="32,4 53.9,14.5 59.3,38.2 44.2,57.2 19.8,57.2 4.7,38.2 10.1,14.5"
              fill={isDarkMode ? '#47ae87' : '#47ae87'}
              opacity={0.22}
            />
            <Polygon
              points="32,6 52.3,15.8 57.4,37.8 43.3,55.4 20.7,55.4 6.6,37.8 11.7,15.8"
              fill={isDarkMode ? '#47ae87' : '#47ae87'}
              opacity={0.28}
            />
            <Polygon
              points="32,8 50.8,17 55.4,37.3 42.4,53.6 21.6,53.6 8.6,37.3 13.2,17"
              fill={isDarkMode ? '#111' : '#dddddd'}
            />
          </Svg>
          <TouchableOpacity
            onPress={handleEyePress}
            activeOpacity={0.85}
            style={styles.floatingEyeButtonInner}
            accessibilityRole="button"
            accessibilityLabel={headerVisible ? 'Hide top bar (Unsee)' : 'Show top bar (See)'}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
            >
              <Path
                d={headerVisible ? 'M4 3l8 7 8-7M4 13l8 7 8-7' : 'M4 11l8-7 8 7M4 21l8-7 8 7'}
                fill="none"
                stroke={theme.textSecondary}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </Animated.View>
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
            <Image source={normalizeImageSource(require('../assets/logos.png'))} style={{ width: 70, height: 70, marginRight: 10, borderRadius: 15 }} resizeMode="contain" />
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

/* ============================================================
   Styles
   ============================================================ */
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
  productTileLabelButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 36,
  },
  productTileLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
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
  productTileUserRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainerRelative: {
    position: 'relative',
  },
  onlineDotSmall: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#47ae87',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  productTileOwnerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#333',
  },
  productTilePriceButton: {
    position: 'absolute',
    right: 10,
    bottom: 16,
    maxWidth: 80,
  },
  productTilePrice: {
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

  reelsContainer: {
    flex: 1,
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
  reelSourcePlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reelOfflineMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderRadius: 96,
  },
  reelOfflineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  reelRetryButton: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.67)',
    borderRadius: 20,
    fontWeight: '900',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  reelRetryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
    textShadowColor: '#111111',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },

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
    textShadowColor: '#111111',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: 12,
    marginBottom: 6,
    textShadowColor: '#111111',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },

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
    backgroundColor: '#11111100',
    minHeight: 50,
  },
  suggestionOverlaySending: {
    backgroundColor: '#11111100',
  },
  suggestionOverlayVideo: {
    bottom: 0,
  },
  suggestionOverlayInline: {
    position: 'relative',
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    marginLeft: 20,
    marginBottom: -20,
    overflow: 'hidden',
    backgroundColor: '#11111100',
  },
  suggestionInlineWrap: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    backgroundColor: '#111111c1',
  },
  suggestionSection: {
    flex: 1,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 34,
  },
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
    marginLeft: 50,
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

  postDetails: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  price: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  description: { fontSize: 14, lineHeight: 20 },
  readMore: { fontWeight: '600', marginLeft: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 6 },
  actionText: { fontSize: 14 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { textAlign: 'center', fontSize: 16, marginBottom: 12 },
  loadingLogo: { width: 64, height: 64, borderRadius: 16 },
  loginEmptyButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8, marginTop: 8 },
  loginEmptyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  floatingEyeButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: EYE_BUTTON_SIZE,
    height: EYE_BUTTON_SIZE,
    zIndex: 200,
  },
  floatingEyeButtonBackground: {
    position: 'absolute',
    top: (EYE_BUTTON_SIZE - EYE_BACKGROUND_SIZE) / 2,
    left: (EYE_BUTTON_SIZE - EYE_BACKGROUND_SIZE) / 2,
  },
  floatingEyeButtonInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
  gridPostItem: { width: (SCREEN_WIDTH - 32) / 2, aspectRatio: 1, marginBottom: 8, position: 'relative' },
  gridPostImageContainer: { width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' },
  gridPostImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteButton: { position: 'absolute', top: 0, right: 0, borderBottomLeftRadius: 12, padding: 6 },
  gridMenuIconWrapper: { width: 20, height: 16, justifyContent: 'space-between', alignItems: 'stretch' },
  gridMenuIconLine: { height: 2, borderRadius: 999, backgroundColor: '#47ae87' },
  gridMenuIconLineTop: { width: '60%', alignSelf: 'flex-start' },
  gridMenuIconLineMiddle: { width: '100%' },
  gridMenuIconLineBottom: { width: '70%', alignSelf: 'flex-end' },
  unsaveButton: { position: 'absolute', bottom: 0, right: 0, borderTopLeftRadius: 12, padding: 5, zIndex: 5 },
  videoCoverBadge: { position: 'absolute', top: 8, left: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },

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
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#47ae87' },
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
  socialIconsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  socialIconSmall: { alignItems: 'center' },
  socialIconCircleSmall: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

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

  videoContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  videoPlayerFrame: {
    width: '100%',
    maxWidth: SCREEN_WIDTH,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  videoCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  videoView: {
    width: '100%',
    height: '100%',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  videoLinkBadge: {
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    maxWidth: '80%',
  },

  videoOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  videoPauseCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(12,14,18,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  videoErrorBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(12,14,18,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    gap: 6,
  },
  videoErrorText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  videoRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  videoRetryText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  videoTopMute: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 8,
  },
  videoMuteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,12,14,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  videoBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(12, 14, 18, 0)',
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0)',
    zIndex: 8,
  },
  videoBarPlayButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoProgressWrap: {
    flex: 1,
    minWidth: 50,
    height: 30,
    justifyContent: 'center',
  },
  videoProgressTrack: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.34)',
    overflow: 'visible',
    justifyContent: 'center',
  },
  videoProgressFill: { height: '100%', borderRadius: 2 },
  videoProgressThumb: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    marginLeft: -5,
    backgroundColor: '#fff',
  },
  videoTimeText: {
    width: 88,
    flexShrink: 0,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  videoProgressLineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 20,
  },
  videoProgressLine: { height: '100%' },

  videoGestureBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12,14,18,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  videoGestureText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
  videoGestureSub: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.9,
  },
});

export default BuyPostScreen;