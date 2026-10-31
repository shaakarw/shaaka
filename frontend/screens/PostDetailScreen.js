
import { getImageUri, normalizeImageSource } from '../utils/imageUrl';
import { getPostImages } from '../utils/postMedia';
// screens/PostDetailScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
  FlatList,
  Modal,
  StatusBar,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { offlineDatabase } from '../services/offlineDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import SharedBottomNav from '../components/SharedBottomNav';
import VideoPost from '../components/VideoPost';
import VideoBackground from '../components/VideoBackground';
import { requestVideoBackground } from '../services/videoBackgroundService';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import OnlineStatusDot from '../components/OnlineStatusDot';
import useOnlineUsers from '../hooks/useOnlineUsers';
import { Video, ResizeMode } from '../utils/expoAvCompat';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ScreenOrientation from 'expo-screen-orientation';

const { width, height } = Dimensions.get('window');

// Image container heights:
//   NORMAL   – default size (same as original layout)
//   EXPANDED – only when the user taps the image
const NORMAL_IMAGE_HEIGHT = 320;
const EXPANDED_IMAGE_HEIGHT = Math.min(Math.round(height * 0.55), 500);

let loadingLogo;
try {
  loadingLogo = require('../assets/logos.png');
} catch {
  loadingLogo = null;
}

const PROFILE_IMAGE = require('../assets/profile1.png');
const getImageSource = (img) => {
  if (!img) return PROFILE_IMAGE;
  if (typeof img === 'number') return img;
  const uri = getImageUri(img);
  if (uri) return typeof img === 'object' ? { ...img, uri } : { uri };
  return PROFILE_IMAGE;
};
const normalizePost = (post) => ({
  ...post,
  reelId: String(post._id || post.id || post.reelId || post.videoId || post.videoUrl || post.video?.url || ''),
  amount: post.amount || `RWF ${post.price?.toLocaleString()}`,
  productName: post.productName || post.category || 'Product',
  username: post.username || post.user?.username || 'User',
  userAvatar: post.userAvatar || post.user?.avatar,
  userAvatarVariants: post.userAvatarVariants || post.user?.avatarVariants || [],
  houseImages: getPostImages(post),
  contactNumber1: post.contactNumber1 || post.contactNumbers?.[0] || '',
  contactNumber2: post.contactNumber2 || post.contactNumbers?.[1] || '',
  priceNegotiable: post.priceNegotiable || false,
});

const translations = {
  English: {
    loading: 'Getting things ready…',
    contactSeller: 'Contact Seller',
    productOwner: 'Product Owner',
    contactTab: 'Contact',
    descriptionTab: 'Description',
    callLabel: 'Call:',
    seller: 'Seller',
    message: 'Message',
    save: 'Save',
    saved: 'Saved',
    share: 'Share',
    pricePrefix: ' ',
    call: 'Call',
    whatsapp: 'WhatsApp',
    sellerPhone: 'Seller Phone',
    notProvided: 'Not provided',
    noPhone: 'No phone number',
    couldNotOpenDialer: 'Could not open phone dialer',
    loginRequired: 'Please login to view post details',
    product: 'Product',
    location: 'Location',
    priceNegotiable: 'Negotiable',
    priceFixed: 'Fixed price',
    loginTitle: 'Login Required',
    login: 'Login',
    postNotAvailable: 'This post is no longer available.',
    error: 'Error',
    couldNotSave: 'Could not save/unsave post',
    removed: 'Removed',
    postRemoved: 'Post removed from saved',
    savedTitle: 'Saved',
    postSaved: 'Post saved',
    whatsappNotInstalled: 'WhatsApp is not installed',
    close: 'Close',
    imageSaved: 'Image saved to gallery',
    saveFailed: 'Could not save image. Please try again.',
    permissionRequired: 'Permission Required',
    allowPhotos: 'Please allow access to photos to save images.',
    video: 'Video',
    buffering: 'Buffering...',
    previewVideo: 'Preview video',
    shakarole:'Shaaka only connect buyer and seller',
  },
  Kinyarwanda: {
    loading: 'Turigutunganya page neza...',
    contactSeller: 'Vugana n\'umugurisha',
    productOwner: 'Nyir\'igicuruzwa',
    contactTab: 'Vugana',
    descriptionTab: 'Ibisobanuro',
    callLabel: 'Hamagara:',
    seller: 'Umugurisha',
    message: 'Ubutumwa',
    save: 'Bika',
    saved: 'IByabitswe',
    share: 'Sangiza',
    pricePrefix: ' ',
    call: 'Vugisha',
    whatsapp: 'WhatsApp',
    sellerPhone: 'Numero y\'umugurisha',
    notProvided: 'Ntabwoyatanzwe',
    noPhone: 'Nta numero ya telefone',
    couldNotOpenDialer: 'Ntibyashobotse gufungura telefone',
    loginRequired: 'Nyamuneka banzawinjire kugira ngo urebe ibyo ushaka',
    product: 'Igicuruzwa',
    location: 'Aho kiri',
    priceNegotiable: 'Igiciro kiraganirwaho',
    priceFixed: 'Igiciro ntahinduka',
    loginTitle: 'Ugomba kwinjira',
    login: 'Injira',
    postNotAvailable: 'Iki gicuruzwa ntagihari.',
    error: 'Harikibazo vugisha nyiri APP (SHAAKA)',
    couldNotSave: 'Ntibyashobotse kubika',
    removed: 'Byakukuweho',
    postRemoved: 'Igicuruzwa cyakukuweho mu byabitswe',
    savedTitle: 'Byabitswe',
    postSaved: 'Igicuruzwa cyabitswe',
    whatsappNotInstalled: 'nyabuneka shyiramo WhatsApp muri telephone yawe',
    close: 'Funga',
    imageSaved: 'Amashusho yabitswe muri galerie',
    saveFailed: 'Ntibyashobotse kubika amashusho. Ongera ugerageze.',
    permissionRequired: 'Uruhusha rurakenewe',
    allowPhotos: 'Nyamuneka emera uburenganzira bwo kubika amashusho.',
    video: 'Video',
    buffering: 'Video iri gufunguka...',
    previewVideo: 'Reba video',
    shakarole:'Shaaka ihuza ugura nu gurisha gusa',
  },
};

// --- VIDEO PREVIEW MODAL (Different from Image Preview) ---
const VideoPreviewModal = ({ visible, videoUrl, videoId, onClose, theme, productName, t = translations.English }) => {
  const videoRef = useRef(null);
  const controlsTimeout = useRef(null);
  const seekTrackWidth = useRef(0);
  const [status, setStatus] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Reactive screen size (updates on rotation)
  const { height: windowHeight } = useWindowDimensions();

  // 80% of device height normally, full height only when user taps fullscreen
  const videoAreaHeight = isFullscreen ? windowHeight : windowHeight * 0.9;

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setIsMuted(false);
      setControlsVisible(true);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      showControlsTemporarily();
    } else {
      setIsPlaying(false);
      setControlsVisible(false);
      setIsFullscreen(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }
    }

    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [visible, showControlsTemporarily]);

  const handlePlaybackStatusUpdate = useCallback((nextStatus) => {
    setStatus(nextStatus);
    if (!nextStatus?.isLoaded) {
      setIsBuffering(Boolean(nextStatus?.isBuffering));
      return;
    }

    setIsPlaying(Boolean(nextStatus.isPlaying));
    setIsBuffering(Boolean(nextStatus.isBuffering));
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
      showControlsTemporarily();
    } catch (error) {
      console.log('Video toggle error:', error);
    }
  }, [isPlaying, showControlsTemporarily]);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const nextMuted = !isMuted;
      await videoRef.current.setIsMutedAsync(nextMuted);
      setIsMuted(nextMuted);
      showControlsTemporarily();
    } catch (error) {
      console.log('Mute toggle error:', error);
    }
  }, [isMuted, showControlsTemporarily]);

  const handleFullscreenToggle = useCallback(async () => {
    const next = !isFullscreen;
    try {
      await ScreenOrientation.lockAsync(
        next ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
      setIsFullscreen(next);
      showControlsTemporarily();
    } catch (error) {
      console.log('Orientation toggle error:', error);
    }
  }, [isFullscreen, showControlsTemporarily]);

  const handleSeekBarPress = useCallback(async (event) => {
    if (!videoRef.current || !status?.durationMillis || !seekTrackWidth.current) return;

    try {
      const ratio = Math.min(Math.max(event.nativeEvent.locationX / seekTrackWidth.current, 0), 1);
      const nextPosition = ratio * status.durationMillis;
      await videoRef.current.setPositionAsync(nextPosition);
      showControlsTemporarily();
    } catch (error) {
      console.log('Seek error:', error);
    }
  }, [status?.durationMillis, showControlsTemporarily]);

  const handleClose = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.pauseAsync();
      }
    } catch (error) {
      console.log('Pause on close error:', error);
    }

    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (error) {
      console.log('Orientation reset error:', error);
    }

    setIsPlaying(false);
    setControlsVisible(false);
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

  const handleVideoPress = useCallback(() => {
    if (controlsVisible) {
      setControlsVisible(false);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      showControlsTemporarily();
    }
  }, [controlsVisible, showControlsTemporarily]);

  const duration = status?.durationMillis || 0;
  const position = status?.positionMillis || 0;
  const progressWidth = duration > 0 ? `${(position / duration) * 100}%` : '0%';
  const [background, setBackground] = useState(null);

  useEffect(() => {
    let active = true;
    setBackground(null);
    if (!visible || !videoUrl || duration <= 0) return () => { active = false; };

    requestVideoBackground({
      uri: videoUrl,
      cacheKey: videoId,
      duration: duration / 1000,
    }).then(result => {
      if (active) setBackground(result);
    }).catch(error => {
      console.warn('Could not prepare the video background:', error.name || 'Unknown error');
    });

    return () => { active = false; };
  }, [visible, videoUrl, videoId, duration]);

  if (!videoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden={isFullscreen} />

      {/* Root: video is anchored to the BOTTOM, top 20% stays free so the
          app's top bar / status bar area remains visible. */}
      <View style={styles.videoModalRoot}>
        {!isFullscreen && (
          <TouchableOpacity
            style={styles.videoModalBackdrop}
            activeOpacity={1}
            onPress={handleClose}
          >
            <View style={styles.videoBackdropCloseRow}>
              <TouchableOpacity onPress={handleClose} style={styles.videoControlButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.videoPreviewContainer,
            {
              height: videoAreaHeight,
              borderTopLeftRadius: isFullscreen ? 0 : 20,
              borderTopRightRadius: isFullscreen ? 0 : 20,
            },
          ]}
        >
           <VideoBackground
             frameUri={background?.frameUri}
             duration={background?.duration}
             active={visible && isPlaying}
           />

           <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={[styles.videoPlayer, background?.frameUri ? { opacity: 0.96 } : null]}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isMuted={isMuted}
            isLooping={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            useNativeControls={false}
          />

          <TouchableOpacity
            style={styles.videoTapArea}
            onPress={handleVideoPress}
            activeOpacity={1}
          />

          {controlsVisible && (
            <View style={styles.videoControlsOverlay}>
              <View style={styles.videoTopBar}>
                <TouchableOpacity onPress={handleClose} style={styles.videoControlButton}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {productName && (
                  <View style={styles.videoTitleContainer}>
                    <Text style={styles.videoTitle} numberOfLines={1}>{productName}</Text>
                  </View>
                )}

                <View style={styles.videoTopActions}>
                  <TouchableOpacity onPress={toggleMute} style={styles.videoControlButton}>
                    <Ionicons name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'} size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleFullscreenToggle} style={styles.videoControlButton}>
                    <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.videoCenterControls}>
                <TouchableOpacity onPress={togglePlayPause} style={styles.videoPlayButton}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={46}
                    color="#FFFFFF"
                    style={styles.videoPlayIcon}
                  />
                </TouchableOpacity>
                {isBuffering && <Text style={styles.bufferingText}>{t.buffering}</Text>}
              </View>

              <View style={styles.videoBottomBar}>
                <TouchableOpacity
                  activeOpacity={1}
                  onLayout={(event) => {
                    seekTrackWidth.current = event.nativeEvent.layout.width;
                  }}
                  onPress={handleSeekBarPress}
                  style={styles.videoProgressTrack}
                >
                  <View style={[styles.videoProgressFill, { width: progressWidth, backgroundColor: theme?.accent || '#4CAF50' }]} />
                </TouchableOpacity>

                <View style={styles.videoTimeContainer}>
                  <Text style={styles.videoTimeText}>{formatTime(position)}</Text>
                  <Text style={styles.videoTimeText}>{formatTime(duration)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const formatTime = (milliseconds) => {
  if (!milliseconds) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// --- AUTO-SLIDING IMAGE SLIDER ---
// Default height stays NORMAL (320). When the user taps the image,
// it animates up to EXPANDED_IMAGE_HEIGHT. Tap again to collapse.
const AutoSlidingImageSlider = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(NORMAL_IMAGE_HEIGHT)).current;
  const flatListRef = useRef(null);
  const scrollTimer = useRef(null);
  const isDragging = useRef(false);

  const onScroll = useCallback((event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideSize);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  const startAutoScroll = useCallback(() => {
    if (!images || images.length <= 1 || isDragging.current) return;
    if (scrollTimer.current) clearInterval(scrollTimer.current);

    scrollTimer.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        let nextIndex = prevIndex + 1;
        if (nextIndex >= images.length) nextIndex = 0;

        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 3500);
  }, [images]);

  const stopAutoScroll = useCallback(() => {
    if (scrollTimer.current) {
      clearInterval(scrollTimer.current);
      scrollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  const onTouchStart = () => {
    isDragging.current = true;
    stopAutoScroll();
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    startAutoScroll();
  };

  const toggleExpanded = useCallback(() => {
    const nextExpanded = !isExpanded;
    const toValue = nextExpanded ? EXPANDED_IMAGE_HEIGHT : NORMAL_IMAGE_HEIGHT;
    setIsExpanded(nextExpanded);
    Animated.timing(animatedHeight, {
      toValue,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, animatedHeight]);

  if (!images || images.length === 0) return null;

  return (
    <Animated.View style={[styles.sliderContainer, { height: animatedHeight }]}>
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, idx) => idx.toString()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={1}
            onPress={toggleExpanded}
            style={{ width, height: '100%' }}
          >
            <Image
              source={normalizeImageSource(getImageSource(item))}


              style={{ width, height: '100%' }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />

      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === currentIndex && styles.activeDot]} />
          ))}
        </View>
      )}

      {/* Expand / collapse hint button */}
      <TouchableOpacity
        style={styles.expandHintBtn}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isExpanded ? 'contract-outline' : 'expand-outline'}
          size={18}
          color="#FFFFFF"
        />
      </TouchableOpacity>s
    </Animated.View>
  );
};

// --- VIDEO PREVIEW THUMBNAIL (for inline display) ---
const VideoPreviewThumbnail = ({ videoUrl, videoId, videoThumbnail, onPress, t }) => {
  const savedThumbnailUri = getImageUri(videoThumbnail);
  const [thumbnailUri, setThumbnailUri] = useState(savedThumbnailUri);
  const [backgroundFrameUri, setBackgroundFrameUri] = useState(savedThumbnailUri);

  useEffect(() => {
    let active = true;
    setThumbnailUri(savedThumbnailUri);
    setBackgroundFrameUri(savedThumbnailUri);
    if (!videoUrl) return () => { active = false; };

    const prepareVideoCover = async () => {
      let frameUri = savedThumbnailUri;
      try {
        if (!frameUri) {
          const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUrl, {
            time: 3000,
            quality: 0.8,
          });
          frameUri = thumbnail.uri;
        }
      } catch (error) {
        try {
          const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUrl, {
            time: 1000,
            quality: 0.5,
          });
          frameUri = thumbnail.uri;
        } catch (fallbackError) {
          console.warn('Could not generate the post video cover:', fallbackError.name || error.name || 'Unknown error');
        }
      }

      if (!active || !frameUri) return;
      setThumbnailUri(frameUri);
      setBackgroundFrameUri(frameUri);

      try {
        const background = await requestVideoBackground({
          uri: videoUrl,
          cacheKey: videoId,
          thumbnailUri: frameUri,
        });
        if (active) setBackgroundFrameUri(background.frameUri || frameUri);
      } catch (error) {
        console.warn('Could not prepare the post video background:', error.name || 'Unknown error');
      }
    };

    prepareVideoCover();
    return () => { active = false; };
  }, [videoUrl, videoId, savedThumbnailUri]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(thumbnailUri)}
      accessibilityRole="button"
      accessibilityLabel={t.previewVideo}
      style={styles.videoThumbnailContainer}
    >
      <VideoBackground
        frameUri={backgroundFrameUri}
        duration={3}
        active={Boolean(backgroundFrameUri)}
      />
      {thumbnailUri ? (
        <Image
          source={normalizeImageSource({ uri: thumbnailUri })}
          style={styles.videoThumbnail}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.videoThumbnailPlaceholder, { backgroundColor: '#000000' }]}>
          <Ionicons name="videocam" size={40} color="#FFFFFF" />
        </View>
      )}
      
      {/* Video duration badge */}
      <View style={styles.videoDurationBadge}>
        <Ionicons name="time-outline" size={12} color="#FFFFFF" />
        <Text style={styles.videoDurationText}>{t.video}</Text>
      </View>
    </TouchableOpacity>
  );
};

// --- MAIN COMPONENT ---
const PostDetailScreen = ({ route, navigation, language: appLanguage }) => {
  const params = route.params || {};
  const { house: initialHouse, postId: paramPostId } = params;
  const language = appLanguage || params.language || 'English';
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const t = translations[language] || translations.English;

  const [currentUser, setCurrentUser] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [house, setHouse] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('Contact');
  const sellerPresenceId = house?.user?._id || house?.user?.id || house?.userId || house?.user;
  const sellerPresenceKey = typeof sellerPresenceId === 'object'
    ? sellerPresenceId?._id || sellerPresenceId?.id || sellerPresenceId?.userId
    : sellerPresenceId;
  const onlineUsers = useOnlineUsers(sellerPresenceId ? [sellerPresenceId] : []);
  const isSellerOnline = Boolean(sellerPresenceKey && onlineUsers[String(sellerPresenceKey)]);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    }
  }, [authUser]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    checkLoginStatus();
    const unsubscribe = navigation.addListener('focus', checkLoginStatus);
    return unsubscribe;
  }, [navigation]);

  const checkLoginStatus = async () => {
    try {
      const storedValues = await AsyncStorage.multiGet(['isLoggedIn', 'userToken']);
      const isAuthenticated = storedValues[0]?.[1] === 'true' && Boolean(storedValues[1]?.[1]);
      const token = storedValues[1]?.[1];
      setIsLoggedIn(isAuthenticated);
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      const postId = paramPostId || initialHouse?._id;
      const matchesInitialHouse = initialHouse && (!paramPostId || String(initialHouse._id) === String(paramPostId));
      let visiblePost = matchesInitialHouse ? normalizePost(initialHouse) : null;
      if (!visiblePost && postId) {
        const [cachedPost, cachedFeed] = await Promise.all([
          offlineDatabase.getRecord('posts', postId),
          offlineDatabase.getRecord('feed', 'page-1'),
        ]);
        const feedPost = cachedFeed?.find(post => String(post._id) === String(postId));
        visiblePost = cachedPost || (feedPost ? normalizePost(feedPost) : null);
      }
      if (visiblePost) {
        setHouse(visiblePost);
        setLoading(false);
      }
      await loadPostAndUser(token, visiblePost);
    } catch (error) {
      console.error('checkLoginStatus error:', error);
      setLoading(false);
    }
  };

  const loadPostAndUser = async (token, visiblePost) => {
    const postId = paramPostId || visiblePost?._id || initialHouse?._id;
    const headers = { Authorization: `Bearer ${token}` };
    const postRequest = postId ? fetchPostById(postId, token) : Promise.resolve(visiblePost);
    const userRequest = axios.get(`${BASE_URL}/api/auth/me`, { headers })
      .then(response => response.data.success ? response.data.user : null)
      .catch(error => {
        console.warn('Could not refresh user while loading post:', error.message);
        return null;
      });
    const savedRequest = axios.get(`${BASE_URL}/api/posts/saved`, { headers })
      .then(response => (response.data.posts || []).map(post => post._id))
      .catch(error => {
        console.warn('Could not refresh saved posts:', error.message);
        return null;
      });

    try {
      const postData = await postRequest || visiblePost;
      if (postData) {
        const normalizedPost = normalizePost(postData);
        setHouse(normalizedPost);
        setLoading(false);
        if (normalizedPost._id) {
          offlineDatabase.putRecord('posts', normalizedPost._id, normalizedPost, { priority: 'medium' })
            .catch(error => console.warn('Could not cache post details:', error.message));
        }
      } else if (!visiblePost) {
        setPostNotFound(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading post details:', error);
      if (!visiblePost) setPostNotFound(true);
      setLoading(false);
    }

    const [user, savedIds] = await Promise.all([userRequest, savedRequest]);
    if (user) setCurrentUser(user);
    if (savedIds && postId) setIsSaved(savedIds.includes(postId));
  };

  const fetchPostById = async (postId, token = null) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${BASE_URL}/api/posts/${postId}`, { headers });
      if (response.data.success && response.data.post) {
        const normalizedPost = normalizePost(response.data.post);
        offlineDatabase.putRecord('posts', postId, normalizedPost, { priority: 'medium' })
          .catch(error => console.warn('Could not cache fetched post:', error.message));
        return normalizedPost;
      }
    } catch (error) {
      console.error('fetchPostById error:', error);
    }

    try {
      const cachedPost = await offlineDatabase.getRecord('posts', postId);
      if (cachedPost) return normalizePost(cachedPost);

      const cachedFeed = await offlineDatabase.getRecord('feed', 'page-1');
      const feedPost = cachedFeed?.find(post => String(post._id) === String(postId));
      return feedPost ? normalizePost(feedPost) : null;
    } catch (error) {
      console.error('Could not load cached post:', error);
      return null;
    }
  };

  const toggleSave = async () => {
    if (!isLoggedIn || !house) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${BASE_URL}/api/posts/save/${house._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setIsSaved(response.data.saved);
        Alert.alert(
          response.data.saved ? t.savedTitle : t.removed,
          response.data.saved ? t.postSaved : t.postRemoved
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t.error, t.couldNotSave);
    }
  };

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

  const handleShare = async () => {
    if (!house) return;
    try {
      const link = appShareLink || 'https://shaaka.app';
      await Share.share({
        message: `${house.productName || 'Product'} - ${house.location}\n${house.description}\n\n${link}`,
        title: house.productName || 'Product',
      });
    } catch (error) { console.log(error); }
  };

  const handleCall = () => {
    const phoneNumber = house?.contactNumber1;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => Alert.alert(t.error, t.couldNotOpenDialer));
    } else Alert.alert(t.noPhone, t.notProvided);
  };

  const handleWhatsApp = () => {
    const whatsappNumber = house?.contactNumber2;
    if (whatsappNumber) {
      Linking.openURL(`whatsapp://send?phone=${whatsappNumber}`).catch(() =>
        Alert.alert(t.error, t.whatsappNotInstalled)
      );
    } else Alert.alert(t.noPhone, t.notProvided);
  };

  const renderLoading = () => {
    return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.text} />;
  };

  useEffect(() => {
    if (postNotFound) {
      Alert.alert(t.error, t.postNotAvailable);
      navigation.goBack();
    }
  }, [postNotFound]);

  if (loading) return renderLoading();

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loginPromptContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={theme.accent} />
          <Text style={[styles.loginPromptTitle, { color: theme.text }]}>{t.loginTitle}</Text>
          <Text style={[styles.loginPromptText, { color: theme.textSecondary }]}>{t.loginRequired}</Text>
          <TouchableOpacity
            style={[styles.loginButton, { borderColor: theme.accent, borderWidth: 0 }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginButtonText, { color: theme.accent }]}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!house) return null;

  const price = house.amount || `${house.price?.toLocaleString()} RWF`;
  const productName = house.productName || 'Product';
  const sellerName = house.username || t.seller;
  const sellerAvatar = house.userAvatar;
  const location = house.location;
  const description = house.description;
  const priceNegotiable = house.priceNegotiable;
  const callNumber = house.contactNumber1;
  const whatsappNumber = house.contactNumber2;
  const sellerId = house.user?._id || house.user?.id || house.userId || house.user;
  const viewerId = currentUser?._id || authUser?._id || authUser?.id;
  const isOwnPost = Boolean(viewerId && sellerId && String(viewerId) === String(sellerId));
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        {/* Open the matching item in the reels feed. */}
        {house.videoUrl && (
          <VideoPreviewThumbnail
            videoUrl={house.videoUrl}
            videoId={house.videoId || house._id || house.id}
            videoThumbnail={house.videoThumbnail || house.thumbnail}
            t={t}
            onPress={() => navigation.navigate('BuyPost', {
              activeTab: 'videos',
              reelId: house.reelId || String(house._id || house.id || house.videoId || house.videoUrl),
              reelPost: house,
            })}
          />
        )}

        {/* Inline image slider – normal by default, expands on tap. */}
        {!house.videoUrl && (
          <AutoSlidingImageSlider
            images={house.houseImages}
          />
        )}

        {/* Fixed Header Area */}
        <View style={[styles.fixedHeaderArea, { backgroundColor: theme.background }]}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.subProductName, { color: theme.textSecondary }]}>{productName}</Text>
              <View style={styles.tagsRow}>
               <Text style={[styles.tagText, { color: theme.textSecondary }]}>{location}</Text>
              </View>
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingText, { color: theme.login}]}>{t.shakarole}</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: theme.text }]}>
                {t.pricePrefix}{price}
              </Text>
              {priceNegotiable && (
                <Text style={[styles.negotiable, { color: theme.accent }]}>{t.priceNegotiable}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollableContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Owner Pill */}
          <View style={[styles.ownerPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.ownerAvatarWrap}>
              <Image
                source={normalizeImageSource(getImageSource(sellerAvatar))}

                style={styles.ownerAvatarImage}
              />
              <OnlineStatusDot visible={isSellerOnline} />
            </View>
            <View>
              <Text style={[styles.ownerName, { color: theme.text }]}>{sellerName}</Text>
              <Text style={[styles.ownerLabel, { color: theme.textSecondary }]}>{t.productOwner}</Text>
            </View>
          </View>

          {/* Tab Bar */}
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'Contact' && styles.activeTabItem, { borderBottomColor: theme.text }]}
              onPress={() => setActiveTab('Contact')}
            >
              <Text style={[styles.tabText, activeTab === 'Contact' ? styles.activeTabText : {}, { color: activeTab === 'Contact' ? theme.text : theme.textSecondary }]}>{t.contactTab}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'Description' && styles.activeTabItem, { borderBottomColor: theme.text }]}
              onPress={() => setActiveTab('Description')}
            >
              <Text style={[styles.tabText, activeTab === 'Description' ? styles.activeTabText : {}, { color: activeTab === 'Description' ? theme.text : theme.textSecondary }]}>{t.descriptionTab}</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'Contact' ? (
            <View style={styles.contactTabSection}>
              <View style={[styles.contactBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.contactLinkRow}>
                  <Ionicons name="call-outline" size={18} color={theme.accent} />
                  <Text style={[styles.contactText, { color: theme.text }]}>{t.callLabel}</Text>
                  <TouchableOpacity onPress={handleCall}>
                    <Text style={[styles.contactLinkText, { color: theme.accent, fontWeight: '600' }]}>{callNumber || t.notProvided}</Text>
                  </TouchableOpacity>
                </View>
                {whatsappNumber && (
                  <View style={[styles.contactLinkRow, { marginTop: 8 }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#47ae87" />
                    <Text style={[styles.contactText, { color: theme.text }]}>WhatsApp:</Text>
                    <TouchableOpacity onPress={handleWhatsApp}>
                      <Text style={[styles.contactLinkText, { color: theme.more, fontWeight: '600' }]}>{whatsappNumber}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.descriptionSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{productName}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky Bottom Bar – Message + Save + Share */}
        <View style={[styles.stickyBottomContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          {!isOwnPost && (
            <TouchableOpacity
              style={[styles.messageBtn, { backgroundColor: theme.accent }]}
              onPress={() => {
              // Build replyPost object just like in BuyPostScreen
              const sellerId = house.user?._id || house.user;
              const replyPost = {
                postId: String(house._id || house.id || ''),
                contextType: 'post',
                title: house.productName || house.title || 'Product',
                description: house.description || '',
                image: (house.houseImages && house.houseImages.length > 0)
                  ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0]?.url || house.houseImages[0]?.src || '')
                  : (typeof house.image === 'string' ? house.image : house.image?.uri || house.image?.url || house.image?.src || ''),
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
                videoThumbnail: house.videoThumbnail || house.thumbnail || '',
                username: house.username || sellerName || '',
                userAvatar: house.userAvatar || house.user?.avatar || '',
                ownerId: sellerId,
                timestamp: house.createdAt || new Date().toISOString(),
              };
              navigation.navigate('Chat', {
                sellerId: sellerId,
                sellerName: sellerName,
                sellerPhone: callNumber,
                postId: String(house._id || house.id || ''),
                postTitle: productName,
                sellerAvatar: sellerAvatar,
                language: language,
                replyPost: replyPost,
              });
              }}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
              <Text style={styles.messageBtnText}>{t.message}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.iconBtnGroup}>
  <TouchableOpacity
    style={[styles.iconBtn, { borderColor: theme.border }]}
    onPress={toggleSave}
  >
    <Ionicons
      name={isSaved ? 'bookmark' : 'bookmark-outline'}
      size={22}
      color={theme.text}
    />
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.iconBtn, { borderColor: theme.border }]}
    onPress={handleShare}
  >
    <Ionicons
      name="share-social-outline"
      size={22}
      color={theme.text}
    />
  </TouchableOpacity>
</View>

        </View>
      </View>

    </SafeAreaView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingBadge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loadingImage: { width: 110, height: 110 },
  loadingText: { marginTop: 22, fontSize: 16 },

  // Slider – height is animated (NORMAL_IMAGE_HEIGHT ↔ EXPANDED_IMAGE_HEIGHT)
  sliderContainer: { width: '100%', overflow: 'hidden' },
  dotsContainer: {
    position: 'absolute',
    Top:0,
    left:20,
    paddingTop:7,
    flexDirection: 'column',
    alignSelf: 'center',
    gap: 8,
  },
  dot: { width: 10, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', },
  activeDot: { backgroundColor: '#ffffff', width: 20, height: 8 },
  expandHintBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Video Thumbnail (Inline)
  videoThumbnailContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoPlayButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: '#FFFFFF',
    marginBottom: 8,
  },
  videoThumbnailText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  videoDurationBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  videoDurationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },

  // Video Preview Modal
  videoModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',      // pin the player to the bottom
    backgroundColor: 'transparent',
  },
  videoModalBackdrop: {
    flex: 1,                          // this is the top 20% (free) area
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  videoBackdropCloseRow: {
    paddingTop: 44,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  videoPreviewContainer: {
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoPlayer: {
    flex: 1,
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  videoTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  videoTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoCenterControls: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: '#FFFFFF',
  },
  videoPlayIcon: {
    marginLeft: 2,
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
  },
  videoBottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  videoProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  videoTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoTimeText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  videoTapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },

  // Fixed header area
  fixedHeaderArea: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 30,
   
    paddingTop: 0,
    paddingHorizontal: 20,
    zIndex: 2,
    elevation: 10,
    shadowColor: '#00000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleContainer: { flex: 1, paddingRight: 12 },
  subProductName: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 },
  tagText: { fontSize: 13 },
  bullet: { marginHorizontal: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 12, marginLeft: 1, fontWeight:500,},
  priceContainer: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },
  price: { fontSize: 20, fontWeight: '700' },
  negotiable: { fontSize: 12, marginTop: 2 },

  // Scrollable area
  scrollableContent: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: 20, paddingHorizontal: 0 },

  // Owner Pill
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 0,
    paddingRight: 16,
    borderRadius: 50,
    borderWidth: 0,
    marginBottom: 20,
    marginTop: 8,
  },
  ownerAvatarWrap: { width: 40, height: 40, marginRight: 12 },
  ownerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  ownerName: { fontSize: 14, fontWeight: '600' },
  ownerLabel: { fontSize: 11 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0,
    marginHorizontal: 5,
    marginBottom: 16,
  },
  tabItem: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 8 },
  activeTabItem: { borderBottomWidth: 0 },
  tabText: { fontSize: 15, fontWeight: '500' },
  activeTabText: { fontWeight: '700' },

  // Description
  descriptionSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '500', marginBottom: 8 },
  description: { fontSize: 15, lineHeight: 22 },

  // Contact
  contactTabSection: { paddingHorizontal: 15, marginBottom: 24 },
  contactBox: { borderRadius: 16, borderWidth: 0, padding: 5 },
  contactLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontSize: 14 },
  contactLinkText: { fontSize: 14 },

  // Sticky bottom
  stickyBottomContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 0,
  },
  messageBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 14,
    gap: 8,
  },
  messageBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  iconBtnGroup: { flex: 1.5, flexDirection: 'row', gap: 8 },
  iconBtn: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Login prompt
  loginPromptContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loginPromptTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  loginPromptText: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
  loginButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30, borderWidth: 0 },
  loginButtonText: { fontSize: 16, fontWeight: '600' },
});

export default PostDetailScreen;