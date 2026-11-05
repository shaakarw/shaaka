

// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Modal,
  ActivityIndicator,
  PanResponder,
  Clipboard,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useBottomSheet } from '../context/BottomSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from '../utils/expoAvCompat';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { getRemainingUsage } from '../utils/subscriptionHelpers';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { getPostCoverUri } from '../components/PostCoverImage';
import { offlineDatabase } from '../services/offlineDatabase';
import { networkStatus } from '../services/networkStatus';
import { syncManager } from '../services/syncManager';
import { logDebug } from '../utils/debugLogger';
import { normalizeImageSource } from '../utils/imageUrl';
import { getAuthToken } from '../utils/authStorage';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_POLICY = {
  imagesPerMessage: 10,
  imagesRetentionDays: 5,
  messagesRetentionDays: 15,
};
const MESSAGES_KEY = '@user_messages';
const PENDING_KEY = '@pending_messages';
const INPUT_LINE_HEIGHT = 20;
const INPUT_MIN_HEIGHT = 40;
const INPUT_MAX_VISIBLE_HEIGHT = 76;
const MAX_MESSAGE_CHARACTERS = 100;
const MAX_IMAGES_PER_MESSAGE = 3;
const DEFAULT_AVATAR = require('../assets/profile1.png');
const chatBackground = require('../assets/chartbackground.png');
const loadingLogo = require('../assets/logos.png');
const chatThreadMemoryCache = new Map();
const MAX_CACHED_CHAT_THREADS = 20;
const getChatAuthToken = async (adminMode = false) => {
  const preferredKey = adminMode ? 'adminToken' : 'userToken';
  const fallbackKey = adminMode ? 'userToken' : 'adminToken';
  return (await getAuthToken(preferredKey)) || getAuthToken(fallbackKey);
};
const getChatThreadCacheKey = (user, sellerId, postId, adminMode) => {
  const userId = user?._id || user?.id || user?.phone;
  if (!userId || !sellerId) return null;
  return `${adminMode ? 'admin' : 'user'}:${userId}:${sellerId}:${postId || 'direct'}`;
};

// ---------- Chat image deck sizing constants (ProductHeroDeck style) ----------
const CHAT_DECK_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 340);
const CHAT_DECK_CARD_WIDTH = CHAT_DECK_WIDTH * 0.56;
const CHAT_DECK_CARD_HEIGHT = CHAT_DECK_CARD_WIDTH * 1.15;
const CHAT_DECK_SIDE_OFFSET = CHAT_DECK_CARD_WIDTH * 0.44;
const CHAT_DECK_SIDE_SCALE = 0.86;
const CHAT_DECK_SIDE_ROTATION = 10;
const CHAT_DECK_SLIDE_DURATION = 5000; // auto-slide duration per image (ms)

// ---------- Translations ----------
const translations = {
  English: {
    loading: 'Please wait while loading the chat',
    typing: 'Typing...',
    reply: 'Reply',
    copy: 'Copy',
    edit: 'Edit',
    unsend: 'Unsend',
    cancel: 'Cancel',
    updated: 'Updated',
    copied: 'Copied',
    sending: 'Sending…',
    retry: 'Retry',
    videoRetry: 'Video was not sent. Check your connection and retry.',
    messageEdited: 'Message edited successfully',
    editFailed: 'Failed to edit message',
    unsendTitle: 'Unsend Message',
    unsendMessage: 'This will remove the message for you. The recipient may still see it.',
    unsendFailed: 'Failed to unsend message',
    unsendTooOld: 'Message can no longer be unsent (only within 5 minutes)',
    unsendSuccess: 'Message unsent successfully',
    networkError: 'Network Error',
    couldNotLoad: 'Could not load messages.',
    sendFailed: 'Send Failed',
    couldNotSend: 'Could not send message. It will be retried later.',
    error: 'Error',
    messageSent: 'Message sent successfully',
    imageSent: 'Image sent successfully',
    imageUploadSuccess: 'Image uploaded successfully',
    imageUploadFailed: 'Failed to upload image',
    imageSendFailed: 'Failed to send image',
    permissionNeeded: 'Permission needed',
    photoAccessNeeded: 'Please allow photo access to send images.',
    cameraAccessNeeded: 'Please allow camera access.',
    imageLimit: 'Image limit',
    imageLimitMessage: 'You can attach up to {count} images per message.',
    failedToChooseImage: 'Failed to choose image',
    failedToCapturePhoto: 'Failed to capture photo',
    imageCaption: 'Add a caption...',
    userNotLoaded: 'User not loaded. Please try again.',
    missingInfo: 'Missing user or seller information.',
    authRequired: 'Authentication required',
    pleaseLogin: 'Please log in to send images.',
    uploadFailed: 'Upload failed',
    unableToUpload: 'Unable to upload image(s). Please try again.',
    message: 'Message...',
    editMessage: 'Edit message...',
    replyingTo: 'Replying to',
    youReplied: 'You replied to',
    replied: 'replied',
    edited: 'Edited',
    you: 'You',
    success: 'Success',
    ok: 'OK',
    successButton: 'Continue',
    yes: 'Yes',
    no: 'No',
    imageCooldown: 'Image Cooldown',
    imageCooldownMessage: 'You can send only one image every 5 minutes. Please wait.',
    imageSaved: 'Image saved to gallery',
    imageSaveFailed: 'Failed to save image',
    close: 'Close',
    replyingToPost: 'Product',
    postNotAvailable: 'This post is no longer available.',
    imageLimitReachedTitle: 'Image limit reached',
    imageLimitReachedMessage: 'You have used all your image uploads for today.',
    upgrade: 'OK',
    upgradePrompt: 'You have reached your image limit. Please try again later.',
  },
  Kinyarwanda: {
    loading: 'Nyamuneka tegereza ubutumwa buze',
    typing: 'Arikwa wandika...',
    reply: 'Subiza',
    copy: 'Koracopi',
    edit: 'Hindura',
    unsend: 'Reka kohereza',
    cancel: 'Reka',
    updated: 'Byahinduwe',
    copied: 'Byakozwecopi',
    sending: 'Birimo koherezwa…',
    retry: 'Ongera ugerageze',
    videoRetry: 'Video ntiyohererejwe. Reba interineti wongere ugerageze.',
    messageEdited: 'Ubutumwa bwahinduwe neza',
    editFailed: 'Guhindura byanze',
    unsendTitle: 'Reka kohereza ubutumwa',
    unsendMessage: 'Ibi bizikuraho ubutumwa kuri wowe nuwo wandikiye.',
    unsendFailed: 'Kureka kohereza byanze',
    unsendTooOld: 'Ubutumwa bushobora  gusibwa (mu minota 5 gusa)',
    unsendSuccess: 'Ubutumwa bwaretse koherezwa',
    networkError: 'Ikibazo cy\'interinete',
    couldNotLoad: 'Ntibyashobotse kubona ubutumwa.',
    sendFailed: 'Kohereza byanze',
    couldNotSend: 'Ntibyashobotse kohereza ubutumwa. Bizongera kugeragezwa.',
    error: 'Ikibazo',
    messageSent: 'Ubutumwa bwoherejwe neza',
    imageSent: 'Ishusho yoherejwe neza',
    imageUploadSuccess: 'Ishusho yoherejwe neza',
    imageUploadFailed: 'Kohereza ishusho byanze',
    imageSendFailed: 'Kohereza ishusho byanze',
    permissionNeeded: 'Uruhushya rukeneye',
    photoAccessNeeded: 'Nyamuneka wemere amasura yo gutumiza amashusho.',
    cameraAccessNeeded: 'Nyamuneka wemere uburenganzira bwo gukoresha kamera.',
    imageLimit: 'Imipaka y’amashusho',
    imageLimitMessage: 'Urashobora gushyiraho amashusho agera {count} ku butumwa.',
    failedToChooseImage: 'Guhitamo ishusho byanze',
    failedToCapturePhoto: 'Gufata ifoto byanze',
    imageCaption: 'Shyiramo ibisobanuro...',
    userNotLoaded: 'Umukoresha ntaboneka. Ongera ugerageze.',
    missingInfo: 'Amakuru y\'umugurisha cyangwa umukoresha ntiboneka.',
    authRequired: 'Ugomba kwinjira',
    pleaseLogin: 'Nyamuneka winjire kugira ngo wohereze amashusho.',
    uploadFailed: 'Kohereza byanze',
    unableToUpload: 'Ntibyashobotse kohereza amashusho. Ongera ugerageze.',
    message: 'Ubutumwa...',
    editMessage: 'Hindura ubutumwa...',
    replyingTo: 'Usubiza',
    youReplied: 'Wasubije',
    replied: 'yasubije',
    edited: 'Byahinduwe',
    you: 'Wowe',
    success: 'Byakunze',
    ok: 'Sawa',
    successButton: 'Komeza',
    yes: 'Yego',
    no: 'Oya',
    imageCooldown: 'Kureka kohereza amashusho',
    imageCooldownMessage: 'Urashobora kohereza ishusho imwe gusa mu minota 5. Tegereza.',
    imageSaved: 'Ishusho yabitswe mu bubiko',
    imageSaveFailed: 'Kubika ishusho byanze',
    close: 'Funga',
    replyingToPost: 'Igicuruzwa',
    postNotAvailable: 'Iki kinyabupfura ntagihari.',
    imageLimitReachedTitle: 'Imipaka y’amashusho yagezeho',
    imageLimitReachedMessage: 'Wakoresheje amashusho yawe yose uyu munsi.',
    upgrade: 'Yego',
    upgradePrompt: 'Wageze ku rugero rw\'amashusho. Ongera ugerageze nyuma.',
  },
};

// ---------- Helper: extract URL from text ----------
const extractFirstURL = (text) => {
  if (!text) return null;
  const trimmed = text.trim();
  const urlRegex = /^(https?:\/\/[^\s]+)$/i;
  if (urlRegex.test(trimmed)) {
    return trimmed;
  }
  return null;
};

// ---------- Helper: validate an image URI ----------
const isValidImageUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|file:\/\/|data:image\/|content:\/\/|blob:|ph:\/\/|assets-library:\/\/)/i.test(trimmed);
};

// ---------- Helper: resolve images list from message ----------
const resolveMessageImages = (item) => {
  if (!item) return [];
  if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
    return item.imageUrls.filter(Boolean);
  }
  if (item.imageUrl) return [item.imageUrl];
  return [];
};

// ---------- Helper: prefetch reply-post cover images ----------
const prefetchReplyPostCovers = async (messagesToCheck = []) => {
  const coverUris = Array.from(new Set(
    messagesToCheck
      .map(message => resolveReplyCoverUri(message?.replyPost || message?.replyPostContext))
      .filter(uri => isValidImageUri(uri) && /^https?:\/\//i.test(uri))
  ));

  await Promise.all(coverUris.map(async uri => {
    try {
      await Image.prefetch(uri);
    } catch (error) {
      console.warn('Could not prefetch chat reply cover:', error.message);
    }
  }));
};

// ---------- Helper: pick a URI out of string / {uri|url|src} / array ----------
const pickImageUri = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const u = pickImageUri(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const c of [value.uri, value.url, value.src, value.path]) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
  }
  return null;
};

// ---------- Helper: Cloudinary video poster cover ----------
const getCloudinaryVideoCover = (videoUrl) => {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  if (!videoUrl.includes('res.cloudinary.com')) return null;
  const [base] = videoUrl.split('?');
  const marker = '/video/upload/';
  if (!base.includes(marker)) return null;
  return base.replace(marker, `${marker}so_1/`).replace(/\.[^/.]+$/, '.jpg');
};

// ---------- Helper: extract a video URL from a post ----------
const getReplyVideoUrl = (post) => {
  if (!post) return '';
  const candidates = [post.videoUrl, post.video, post.mediaUrl];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object') {
      for (const k of [c.url, c.src, c.uri]) {
        if (typeof k === 'string' && k.trim()) return k.trim();
      }
    }
  }
  return '';
};

// ---------- Helper: resolve the cover URI for a replied post ----------
const resolveReplyCoverUri = (post) => {
  if (!post) return null;

  try {
    const shared = getPostCoverUri(post);
    if (isValidImageUri(shared)) return shared.trim();
  } catch (e) {
    // ignore — fall through to the manual candidate scan
  }

  const candidates = [
    post.image,
    post.imageUrl,
    post.postImage,
    post.postImageUrl,
    post.cover,
    post.coverImage,
    post.coverImageUrl,
    post.thumbnail,
    post.thumbnailUrl,
    post.images,
    post.imageUrls,
    post.photos,
    post.houseImages,
    post.videoThumbnail,
    post.video?.thumbnail,
    post.video?.poster,
    post.streetImage,
    post.street,
    post.photo,
    post.picture,
    post.pic,
    post.mainImage,
    post.featuredImage,
    post.primaryImage,
  ];
  for (const c of candidates) {
    const u = pickImageUri(c);
    if (isValidImageUri(u)) return u;
  }

  const videoCover = getCloudinaryVideoCover(getReplyVideoUrl(post));
  return isValidImageUri(videoCover) ? videoCover : null;
};

// ---------- ReplyCoverImage ----------
const ReplyPostImage = ({ uri, videoUrl, style, iconName = 'image-outline', iconSize = 20 }) => {
  const [generatedCover, setGeneratedCover] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    setGeneratedCover(null);
    if (!videoUrl || uri) return undefined;

    let active = true;
    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000, quality: 0.7 })
      .then(({ uri: thumbUri }) => {
        if (active && thumbUri) setGeneratedCover(thumbUri);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [uri, videoUrl]);

  const cover = uri || generatedCover;

  useEffect(() => {
    setHasError(false);
    setAttempt(0);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [cover]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleError = () => {
    if (retryTimerRef.current) return;
    setHasError(true);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setHasError(false);
      setAttempt(a => a + 1);
    }, 1500);
  };

  const showFallback = !isValidImageUri(cover) || hasError;

  return (
    <View style={style}>
      {isValidImageUri(cover) && (
        <Image
          key={`${cover}_${attempt}`}
          source={normalizeImageSource({ uri: cover })}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={handleError}
        />
      )}
      {showFallback && (
        <View style={[StyleSheet.absoluteFillObject, styles.chatImageFallback]}>
          <Ionicons name={iconName} size={iconSize} color="#9aa0a6" />
        </View>
      )}
    </View>
  );
};

const ChatImage = ({ uri, style }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => setHasError(false), [uri]);

  if (hasError) {
    return (
      <View style={[style, styles.chatImageFallback]}>
        <Ionicons name="image-outline" size={28} color="#a8a8a8" />
      </View>
    );
  }

  return (
    <Image
      source={normalizeImageSource({ uri })}
      style={style}
      resizeMode="cover"
      onError={(event) => {
        console.log('IMAGE LOAD ERROR:', event.nativeEvent);
        console.log('IMAGE URL:', uri);
        setHasError(true);
      }}
    />
  );
};

// ---------- Helper: is dark color ----------
const isDarkColor = (color) => {
  if (!color || typeof color !== 'string') return false;
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
};

// ---------- TypingIndicator ----------
const TypingIndicator = ({ theme, avatar }) => {
  const [dot1] = useState(new Animated.Value(0));
  const [dot2] = useState(new Animated.Value(0));
  const [dot3] = useState(new Animated.Value(0));

  const animateDot = (dot, delay) => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: -8,
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
  };

  useEffect(() => {
    const animations = [
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ];
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.typingBubble, { backgroundColor: theme.cardBackground || '#e0e0e000' }]}>
      <Image source={normalizeImageSource(avatar || DEFAULT_AVATAR)} style={styles.typingAvatar} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

// ============================================================
// Stacked card deck gallery (ProductHeroDeck style)
// ============================================================
const ChatDeckCard = memo(({ uri, index, position, theme, onActivate, onLongPressImage }) => {
  const positionValue = useRef(new Animated.Value(position)).current;

  useEffect(() => {
    Animated.spring(positionValue, {
      toValue: position,
      speed: 16,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [position, positionValue]);

  const isDark = isDarkColor(theme.background) || isDarkColor(theme.cardBackground);

  const transforms = [
    {
      translateX: positionValue.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [-CHAT_DECK_SIDE_OFFSET, 0, CHAT_DECK_SIDE_OFFSET],
      }),
    },
    {
      rotate: positionValue.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [
          `-${CHAT_DECK_SIDE_ROTATION}deg`,
          '0deg',
          `${CHAT_DECK_SIDE_ROTATION}deg`,
        ],
      }),
    },
    {
      scale: positionValue.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [CHAT_DECK_SIDE_SCALE, 1, CHAT_DECK_SIDE_SCALE],
      }),
    },
  ];

  const sideOverlayOpacity = positionValue.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.5, 0, 0.5],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.chatDeckCardPosition,
        {
          zIndex: position === 0 ? 3 : 1,
          left: (CHAT_DECK_WIDTH - CHAT_DECK_CARD_WIDTH) / 2,
          width: CHAT_DECK_CARD_WIDTH,
          height: CHAT_DECK_CARD_HEIGHT,
          transform: transforms,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={position === 0 ? undefined : () => onActivate(index)}
        onLongPress={onLongPressImage}
        style={[
          styles.chatDeckCardTouch,
          {
            backgroundColor: theme.cardBackground,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <ChatImage uri={uri} style={styles.chatDeckCardImage} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chatDeckSideOverlay,
            { backgroundColor: '#000', opacity: sideOverlayOpacity },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

const ChatImageDeck = memo(({ images, theme, messageId, onLongPressImage }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

  const currentIndex = images.length ? activeIndex % images.length : 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [messageId]);

  useEffect(() => {
    if (!images.length || images.length < 2) return undefined;

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: CHAT_DECK_SLIDE_DURATION,
      useNativeDriver: false,
    });
    progressAnimation.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        setActiveIndex(i => (i + 1) % images.length);
      }
    });

    return () => animation.stop();
  }, [currentIndex, progress, images.length, restartKey]);

  const selectImage = useCallback((index) => {
    progressAnimation.current?.stop();
    setActiveIndex(index);
    setRestartKey(k => k + 1);
  }, []);

  if (!images.length) return null;

  const previousIndex = (currentIndex - 1 + images.length) % images.length;
  const nextIndex = (currentIndex + 1) % images.length;
  const visibleCards = [
    { index: previousIndex, position: -1 },
    { index: currentIndex, position: 0 },
    { index: nextIndex, position: 1 },
  ].filter(
    (card, pos, arr) => arr.findIndex(c => c.index === card.index) === pos
  );

  return (
    <View style={styles.chatDeckContainer}>
      <View style={styles.chatDeck}>
        <View
          pointerEvents="none"
          style={[
            styles.chatDeckGlow,
            {
              backgroundColor: 'rgba(71,174,135,0.22)',
              shadowColor: '#47ae87',
              width: CHAT_DECK_CARD_WIDTH * 0.62,
              height: CHAT_DECK_CARD_HEIGHT * 0.58,
              left: (CHAT_DECK_WIDTH - CHAT_DECK_CARD_WIDTH * 0.62) / 2,
              top: CHAT_DECK_CARD_HEIGHT * 0.2,
            },
          ]}
        />

        {visibleCards.map(card => (
          <ChatDeckCard
            key={`${messageId}_deck_${card.index}`}
            uri={images[card.index]}
            index={card.index}
            position={card.position}
            theme={theme}
            onActivate={selectImage}
            onLongPressImage={onLongPressImage}
          />
        ))}
      </View>
    </View>
  );
});

// ---------- Demo chat helpers ----------
const createDefaultDemoChatMessages = ({ postId, postTitle, sellerName, sellerPhone, currentUser }) => {
  const currentUserPhone = currentUser?.phone || currentUser?._id || '+250788123456';
  const currentUserName = currentUser?.username || 'Me';
  const now = Date.now();

  return [
    {
      id: `demo_chat_${postId}_${sellerPhone}_1`,
      postId,
      postTitle,
      postUser: sellerName,
      senderPhone: sellerPhone,
      senderName: sellerName,
      receiverPhone: currentUserPhone,
      receiverName: currentUserName,
      text: `Hi, thanks for checking ${postTitle || 'this listing'}.`,
      timestamp: new Date(now - 1800000).toISOString(),
      read: true,
    },
    {
      id: `demo_chat_${postId}_${sellerPhone}_2`,
      postId,
      postTitle,
      postUser: sellerName,
      senderPhone: currentUserPhone,
      senderName: currentUserName,
      receiverPhone: sellerPhone,
      receiverName: sellerName,
      text: 'Hello, I would like to know more about it.',
      timestamp: new Date(now - 1200000).toISOString(),
      read: true,
    },
    {
      id: `demo_chat_${postId}_${sellerPhone}_3`,
      postId,
      postTitle,
      postUser: sellerName,
      senderPhone: sellerPhone,
      senderName: sellerName,
      receiverPhone: currentUserPhone,
      receiverName: currentUserName,
      text: 'Sure, it is available. You can ask anything or schedule a visit.',
      timestamp: new Date(now - 600000).toISOString(),
      read: false,
    },
  ];
};

// ---------- Helper: Enhance reply previews with imageUrl ----------
const enhanceReplies = (messages) => {
  if (!messages || messages.length === 0) return messages;
  const msgMap = new Map();
  messages.forEach(m => msgMap.set(m._id, m));
  return messages.map(m => {
    if (m.repliedTo && m.repliedTo.messageId && !m.repliedTo.imageUrl) {
      const original = msgMap.get(m.repliedTo.messageId);
      if (original) {
        const firstImage =
          (Array.isArray(original.imageUrls) && original.imageUrls[0]) ||
          original.imageUrl ||
          null;
        if (firstImage) {
          return { ...m, repliedTo: { ...m.repliedTo, imageUrl: firstImage } };
        }
      }
    }
    return m;
  });
};

const mergeMessages = (currentMessages, incomingMessages) => {
  const merged = new Map();
  (currentMessages || []).forEach(message => {
    const id = message?._id || message?.id;
    if (id) merged.set(String(id), message);
  });

  (incomingMessages || []).forEach(message => {
    const id = message?._id || message?.id;
    if (!id) return;

    const clientMessageId = String(message.clientMessageId || '');
    if (clientMessageId && merged.has(clientMessageId)) {
      merged.delete(clientMessageId);
    }
    merged.set(String(id), message);
  });

  const nextMessages = enhanceReplies(Array.from(merged.values()).sort(
    (a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
  ));
  const previousSignature = JSON.stringify(currentMessages || []);
  return previousSignature === JSON.stringify(nextMessages) ? currentMessages : nextMessages;
};

const removeCachedMessage = async messageId => {
  const id = String(messageId);
  await offlineDatabase.deleteRecord('messages', id);
  try {
    const stored = await AsyncStorage.getItem(MESSAGES_KEY);
    if (!stored) return;
    const messages = JSON.parse(stored);
    const remaining = messages.filter(message => String(message._id || message.id) !== id);
    if (remaining.length !== messages.length) {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(remaining));
    }
  } catch (error) {
    console.warn('Could not remove cached chat message:', error.message);
  }
};

// ============================================================
// ReplyPostCard — pending reply bar (composer)
// Shows ONLY the media-type icon — no image thumbnail.
// ============================================================
const ReplyPostCard = ({ post, color, theme, imageRadiusStyle, onPress }) => {
  if (!post) return null;

  const title =
    post.title ||
    post.productName ||
    post.postTitle ||
    post.name ||
    post.shopName ||
    post.placeName ||
    'Product';
  const priceText = post.amount || (post.price != null ? `${post.price} RWF` : '');
  const isShop = post.contextType === 'shop' || !!post.shopId || !!post.mallShopId;
  const isPlace = post.contextType === 'place' || !!post.placeId;
  const isVideo = !!getReplyVideoUrl(post) || post.type === 'video';

  const iconName = isShop
    ? 'storefront-outline'
    : isPlace
    ? 'location-outline'
    : isVideo
    ? 'videocam-outline'
    : 'image-outline';

  const resolvedColor = color || '#a9a9a9';
  const isDark = isDarkColor(theme?.background || '#ffffff') || isDarkColor(theme?.cardBackground || '#ffffff');
  const iconTileBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  return (
    <TouchableOpacity
      style={styles.replyPostCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.replyPostThumb,
          styles.replyPostThumbIcon,
          { backgroundColor: iconTileBg },
          imageRadiusStyle,
        ]}
      >
        <Ionicons name={iconName} size={22} color={resolvedColor} />
      </View>
      <View style={styles.replyPostInfo}>
        <Text style={[styles.replyPostTitle, { color: resolvedColor }]} numberOfLines={1}>
          {title}
        </Text>
        {priceText ? (
          <Text style={[styles.replyPostPrice, { color: resolvedColor }]} numberOfLines={1}>
            {priceText}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={resolvedColor} />
    </TouchableOpacity>
  );
};

// ============================================================
// ReplyPostImageCard — Reels-style Overlay Quote for sent messages
// ============================================================
const ReplyPostImageCard = ({ post, theme, isMe, onPress }) => {
  if (!post) return null;

  const postOwnerName = post.username || post.userName || post.shopName || post.placeName || 'Product';
  const postOwnerAvatarUri = pickImageUri(post.userAvatar) || pickImageUri(post.user?.avatar);
  const coverUri = resolveReplyCoverUri(post);

  const title = post.title || post.productName || post.postTitle || post.name || 'Product';
  const amountText = post.amount || (post.price != null ? `RWF ${post.price.toLocaleString()}` : '');
  const locationText = post.location || '';
  const descriptionText = post.description || '';

  const isDark = isDarkColor(theme.background);
  const cardBg = isDark ? '#1c1c1e' : '#f2f2f7';

  const cardRadiusStyle = {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: isMe ? 16 : 0,
    borderBottomRightRadius: isMe ? 0 : 16,
  };

  return (
    <TouchableOpacity
      style={[styles.instaPostCard, cardRadiusStyle, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.instaPostImageWrapper}>
        {coverUri ? (
          <Image source={normalizeImageSource({ uri: coverUri })} style={styles.instaPostImage} />
        ) : (
          <View style={[styles.instaPostImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={32} color="#888" />
          </View>
        )}

        <View style={styles.instaPostTopOverlay}>
          {postOwnerAvatarUri ? (
            <Image source={normalizeImageSource({ uri: postOwnerAvatarUri })} style={styles.instaPostAvatar} />
          ) : (
            <View style={[styles.instaPostAvatar, { backgroundColor: '#888', justifyContent: 'center', alignItems: 'center' }]}>
               <Ionicons name="person" size={14} color="#fff" />
            </View>
          )}
          <Text style={styles.instaPostUsername} numberOfLines={1}>
            {postOwnerName}
          </Text>
        </View>

        <View style={styles.reelsOverlay}>
          <Text style={styles.reelsOverlayTitle} numberOfLines={1}>{title}</Text>
          {!!amountText && (
            <Text style={styles.reelsOverlayAmount} numberOfLines={1}>{amountText}</Text>
          )}
          {!!locationText && (
            <View style={styles.reelsOverlayLocationRow}>
              <Ionicons name="location-outline" size={10} color="#e0e0e0" />
              <Text style={styles.reelsOverlayLocation} numberOfLines={1}>{locationText}</Text>
            </View>
          )}
          {!!descriptionText && (
            <Text style={styles.reelsOverlayDescription} numberOfLines={2}>{descriptionText}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ---------- MessageItem ----------
const MessageItem = memo(({
  item,
  isOwnMessage,
  currentUser,
  sellerAvatar,
  theme,
  onDoubleTap,
  onSwipeReply,
  playingAudioId,
  playAudio,
  formatDuration,
  t,
  navigation,
  sellerId,
  sellerName,
  onReplyPostPress,
  onRetryMessage,
}) => {
  const isMe = isOwnMessage(item);
  const isReplied = item.repliedTo;
  const replyPostContext = item.replyPost || item.replyPostContext;
  const hasReplyPost = !!replyPostContext;
  const url = extractFirstURL(item.text);

  const messageImages = useMemo(() => resolveMessageImages(item), [item]);
  const hasMultipleImages = messageImages.length > 1;
  const hasImageContent = messageImages.length > 0;

  const bubbleBackground = 'transparent';
  const borderBottomColor = isMe ? '#47ae87' : '#a9a9a9';

  const textColor = theme.text || '#000000';
  const subTextColor = 'rgba(0,0,0,0.5)';

  const avatarSource = isMe
    ? currentUser?.avatar
      ? { uri: currentUser.avatar }
      : DEFAULT_AVATAR
    : item.senderAvatar
    ? { uri: item.senderAvatar }
    : sellerAvatar
    ? { uri: sellerAvatar }
    : DEFAULT_AVATAR;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (hasMultipleImages) return false;
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isMe) {
          if (gestureState.dx < -50) {
            onSwipeReply(item);
          }
        } else {
          if (gestureState.dx > 50) {
            onSwipeReply(item);
          }
        }
      },
    })
  ).current;

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef(null);
  useEffect(() => () => {
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  }, []);

  const handlePress = () => {
    if (hasMultipleImages) return;

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      onDoubleTap(item);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (url) {
        singleTapTimerRef.current = setTimeout(() => {
          Linking.openURL(url).catch(error => {
            console.warn('Could not open message link:', error.message);
          });
          singleTapTimerRef.current = null;
        }, 300);
      }
    }
  };

  const handleLongPress = () => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    onDoubleTap(item);
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.messageRowWrapper,
        { justifyContent: isMe ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMe && (
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.headerAvatarContainer}
              onPress={() => navigation.navigate('Profile', { userId: sellerId, username: sellerName })}
            >
              <Image source={normalizeImageSource(avatarSource)} style={styles.messageAvatar} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.messageContentColumn}>
          {isReplied && (
            <View
              style={[
                styles.replyPreviewOutside,
                {
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  backgroundColor: isDarkColor(theme.background) ? '#434343af' : '#ffffff95',
                  borderBottomLeftRadius: isMe ? 18 : 0,
                  borderBottomRightRadius: isMe ? 0 : 18,
                },
              ]}
            >
              <Text style={[styles.replyName, { color: borderBottomColor }]}>
                {isMe
                  ? `${t.youReplied} ${item.repliedTo.senderName}`
                  : `${item.repliedTo.senderName} ${t.replied}`}
              </Text>
              {item.repliedTo.imageUrl ? (
                <View style={styles.replyImageContainer}>
                  <ChatImage uri={item.repliedTo.imageUrl} style={styles.replyImageThumbnail} />
                  {item.repliedTo.text ? (
                    <Text style={[styles.replyText, { color: theme.reply || '#ffffff' }]} numberOfLines={2}>
                      {item.repliedTo.text}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.replyText, { color: theme.reply || '#ffffff' }]} numberOfLines={2}>
                  {item.repliedTo.text}
                </Text>
              )}
            </View>
          )}

          {hasReplyPost && (
            <ReplyPostImageCard
              post={replyPostContext}
              theme={theme}
              isMe={isMe}
              onPress={() => onReplyPostPress && onReplyPostPress(replyPostContext)}
            />
          )}

          {(!!item.text || hasImageContent || !!item.videoUrl || !!item.audioUrl) && (
            <TouchableOpacity
              activeOpacity={hasMultipleImages ? 1 : 0.7}
              onPress={handlePress}
              onLongPress={handleLongPress}
              style={[
                styles.messageBubble,
                {
                  backgroundColor: bubbleBackground,
                  borderBottomWidth: 1,
                  borderLeftWidth: hasImageContent ? 0 : 0.5,
                  borderRightWidth: hasImageContent ? 0 : 0.5,
                  borderRightColor: borderBottomColor,
                  borderLeftColor: borderBottomColor,
                  borderBottomColor: borderBottomColor,
                  borderBottomLeftRadius: isMe ? 18 : 0,
                  borderBottomRightRadius: isMe ? 0 : 18,
                  borderTopLeftRadius: (isReplied || hasReplyPost) && !isMe ? 0 : 18,
                  borderTopRightRadius: (isReplied || hasReplyPost) && isMe ? 0 : 18,
                },
              ]}
            >
              {hasMultipleImages ? (
                <View style={styles.multiImageWrapper}>
                  <ChatImageDeck
                    images={messageImages}
                    theme={theme}
                    messageId={item._id}
                    onLongPressImage={() => onDoubleTap(item)}
                  />
                  {item.text ? (
                    <Text style={[styles.messageText, styles.imageCaption, { color: textColor }]}>
                      {item.text}
                    </Text>
                  ) : null}
                </View>
              ) : item.imageUrl ? (
                <View>
                  <ChatImage uri={item.imageUrl} style={styles.messageImage} />
                  {item.text ? (
                    <Text style={[styles.messageText, styles.imageCaption, { color: textColor }]}>
                      {item.text}
                    </Text>
                  ) : null}
                </View>
              ) : item.videoUrl ? (
                <View>
                  <TouchableOpacity
                    style={styles.videoMessageLink}
                    onPress={() => Linking.openURL(item.videoUrl).catch(error => {
                      console.warn('Could not open chat video:', error.message);
                    })}
                  >
                    <Ionicons name="play-circle-outline" size={28} color={textColor} />
                    <Text style={[styles.messageText, { color: textColor }]}>{t.videoCall || 'Video'}</Text>
                  </TouchableOpacity>
                  {item.text ? (
                    <Text style={[styles.messageText, styles.imageCaption, { color: textColor }]}>
                      {item.text}
                    </Text>
                  ) : null}
                </View>
              ) : item.audioUrl ? (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => playAudio(item.audioUrl, item._id)}
                >
                  <Ionicons
                    name={playingAudioId === item._id ? 'pause-circle' : 'play-circle'}
                    size={32}
                    color={textColor}
                  />
                  <Text style={[styles.audioDuration, { color: textColor }]}>
                    {formatDuration(item.audioDuration)}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View>
                  {url ? (
                    <Text style={[styles.messageText, { color: '#007AFF', textDecorationLine: 'underline' }]}>
                      {item.text}
                    </Text>
                  ) : (
                    <Text style={[styles.messageText, { color: textColor }]}>
                      {item.text}
                    </Text>
                  )}
                  {item.isEdited && (
                    <Text style={[styles.editedBadge, { color: subTextColor }]}>
                      {t.edited}
                    </Text>
                  )}
                </View>
              )}

              {isMe && (
                <View style={styles.readReceiptContainer}>
                  {item.syncStatus === 'failed' ? (
                    <TouchableOpacity onPress={() => onRetryMessage?.(item)} style={styles.failedMessageAction}>
                      <Ionicons name="refresh-circle-outline" size={14} color="#d87428" />
                      <Text style={styles.failedMessageText}>{t.retry}</Text>
                    </TouchableOpacity>
                  ) : item.syncStatus === 'pending' ? (
                    <Text style={[styles.pendingMessageText, { color: subTextColor }]}>{t.sending}</Text>
                  ) : item.read ? (
                    <Ionicons name="checkmark-done" size={14} color={'gray'} />
                  ) : (
                    <Ionicons name="checkmark-outline" size={14} color={'gray'} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {isMe && (
          <View style={styles.avatarWrapper}>
            <Image source={normalizeImageSource(avatarSource)} style={styles.messageAvatar} />
          </View>
        )}
      </View>
    </View>
  );
});

// ---------- SoundWaves ----------
const SoundWaves = ({ isActive }) => {
  const waves = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (isActive) {
      const animations = waves.map((wave, i) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(wave, {
              toValue: 1,
              duration: 300 + i * 100,
              useNativeDriver: true,
            }),
            Animated.timing(wave, {
              toValue: 0,
              duration: 300 + i * 100,
              useNativeDriver: true,
            }),
          ])
        );
      });
      Animated.parallel(animations).start();
      return () => {
        animations.forEach(anim => anim.stop());
      };
    } else {
      waves.forEach(wave => wave.setValue(0));
    }
  }, [isActive]);

  const waveStyles = waves.map((wave, i) => ({
    width: 6 + i * 4,
    height: wave.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 40 + i * 15],
    }),
    backgroundColor: '#47ae87',
    borderRadius: 3,
    marginHorizontal: 2,
    opacity: 0.6,
    transform: [{ scaleY: wave }],
  }));

  return (
    <View style={styles.waveContainer}>
      {waveStyles.map((style, i) => (
        <Animated.View key={i} style={[styles.waveBar, style]} />
      ))}
    </View>
  );
};

// ---------- Main ChatScreen ----------
const ChatScreen = ({ route, navigation, language }) => {
  const {
    sellerId, sellerName, sellerPhone, postId: routePostId, postTitle, isDemoChat, sellerAvatar,
    replyPost: initialReplyPost, adminMode = false,
  } = route.params || {};
  const adminModeRef = useRef(adminMode);

  const effectivePostId = String(routePostId ?? route.params?.post ?? route.params?.listingId ?? '').trim();
  const postId = effectivePostId;
  const { theme } = useTheme();
  const { user: authUser } = useAuth();
  const { showBottomSheet } = useBottomSheet();
  const t = translations[language] || translations.English;
  const initialThreadCacheKey = getChatThreadCacheKey(authUser, sellerId, postId, adminMode);
  const initialCachedMessages = initialThreadCacheKey
    ? chatThreadMemoryCache.get(initialThreadCacheKey)
    : null;
  const showChatNotice = useCallback((type, title, message) => {
    showBottomSheet({
      type,
      title,
      message,
      icon: type === 'success' ? 'checkmark-circle-outline' : type === 'error' ? 'alert-circle-outline' : 'information-circle-outline',
      buttonText: t.ok,
    });
  }, [showBottomSheet, t.ok]);

  // ---------- State ----------
  const [messages, setMessages] = useState(() => initialCachedMessages || []);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const [inputScrollable, setInputScrollable] = useState(false);
  const [attachmentsStacked, setAttachmentsStacked] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadStatus, setImageUploadStatus] = useState('idle');
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [loading, setLoading] = useState(!Array.isArray(initialCachedMessages));
  const [refreshing, setRefreshing] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const soundRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [sellerAvatarUrl, setSellerAvatarUrl] = useState(sellerAvatar || null);
  const [replyPost, setReplyPost] = useState(null);
  const threadCacheKey = getChatThreadCacheKey(currentUser, sellerId, postId, adminMode);
  const [readyThreadCacheKey, setReadyThreadCacheKey] = useState(
    initialCachedMessages ? initialThreadCacheKey : null
  );
  const clearReplyPost = useCallback(() => {
    setReplyPost(null);
    if (route.params?.replyPost) {
      navigation.setParams({ replyPost: undefined });
    }
  }, [navigation, route.params?.replyPost]);

  const socketRef = useRef(null);
  const reloadThreadRef = useRef(null);
  const messagesFetchRef = useRef(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);

  const [remainingImages, setRemainingImages] = useState(1);
  const [userImagesPerMessage, setUserImagesPerMessage] = useState(CHAT_POLICY.imagesPerMessage);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  const [typingPostId, setTypingPostId] = useState('');
  const typingPostIdRef = useRef('');
  const currentUserIdRef = useRef(null);

  const markedAsReadRef = useRef(new Set());
  const typingClearTimerRef = useRef(null);

  useEffect(() => syncManager.subscribe(event => {
    if (event.status === 'message-sent' && event.message?._id) {
      setMessages(previous => mergeMessages(
        previous.filter(message => String(message._id || message.id) !== event.clientMessageId),
        [event.message]
      ));
    } else if (event.status === 'message-failed' && event.clientMessageId) {
      setMessages(previous => previous.map(message => (
        String(message._id || message.id) === event.clientMessageId
          ? { ...message, syncStatus: 'failed', syncError: event.message }
          : message
      )));
    }
  }), []);

  // ---------- useEffect hooks ----------
  useEffect(() => {
    const from = currentUser?.phone || '';
    const to = sellerPhone || '';
    if (postId && postId !== 'undefined' && postId !== 'null') {
      setTypingPostId(postId);
    } else if (from && to) {
      setTypingPostId(`direct_${[from, to].sort().join('_')}`);
    } else {
      setTypingPostId('');
    }
    typingPostIdRef.current = postId || (from && to ? `direct_${[from, to].sort().join('_')}` : '');
    currentUserIdRef.current = currentUser?._id || null;
  }, [postId, currentUser?._id, currentUser?.phone, sellerPhone]);

  useEffect(() => {
    if (!initialReplyPost) return;
    if (loading) return;

    const rp = initialReplyPost;
    const rpId = rp._id || rp.postId || rp.contextId || rp.shopId || rp.mallShopId;
    const me = currentUser?._id || currentUser?.phone;

    if (rpId && me) {
      const alreadySent = messages.some((m) => {
        if (!m.replyPost) return false;
        if (String(m.senderId) !== String(me)) return false;
        const mId =
          m.replyPost._id ||
          m.replyPost.postId ||
          m.replyPost.contextId ||
          m.replyPost.shopId ||
          m.replyPost.mallShopId;
        return mId && String(mId) === String(rpId);
      });

      if (alreadySent) {
        if (route.params?.replyPost) {
          navigation.setParams({ replyPost: undefined });
        }
        setReplyPost(null);
        return;
      }
    }

    setReplyPost(rp);
  }, [initialReplyPost, loading, messages, currentUser, navigation, route.params?.replyPost]);

  // ---------- Animations ----------
  useEffect(() => {
    let animation;
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    return () => animation?.stop();
  }, [loading, scaleAnim]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const setOnlineStatus = useCallback(async (online) => {
    try {
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;
      await axios.post(
        `${BASE_URL}/api/user/online`,
        { isOnline: online },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadCurrentUser();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(error => {
          console.warn('Could not unload chat audio:', error.message);
        });
      }
      if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.off('user-typing');
          socketRef.current.off('user-stop-typing');
          socketRef.current.disconnect();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, []);

  const fetchUserLimitsAndUsage = useCallback(async () => {
    try {
      if (!(await networkStatus.start()).isOnline) return;
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;
      const res = await axios.get(`${BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const user = res.data.user;
        setRemainingImages(user.remainingImages ?? 1);
        setUserImagesPerMessage(typeof user.imagesPerMessage === 'number' ? Math.max(1, user.imagesPerMessage) : CHAT_POLICY.imagesPerMessage);
      }
    } catch (error) {
      console.warn('Failed to fetch user limits/usage:', error.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserLimitsAndUsage();
    }, [fetchUserLimitsAndUsage])
  );

  useEffect(() => {
    if (currentUser) {
      fetchUserLimitsAndUsage();
    }
  }, [currentUser, fetchUserLimitsAndUsage]);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalVisible(false);
  }, []);

  const fetchSellerOnlineStatus = useCallback(async () => {
    if (isDemoChat || !sellerId) return;
    try {
      if (!(await networkStatus.start()).isOnline) return;
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;
      const res = await axios.get(`${BASE_URL}/api/user/${sellerId}/online`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setIsOnline(res.data.isOnline);
      }
    } catch (e) {
      setIsOnline(false);
    }
  }, [sellerId, isDemoChat]);

  const fetchSellerAvatar = useCallback(async () => {
    if (!sellerId || isDemoChat) return;
    try {
      if (!(await networkStatus.start()).isOnline) return;
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;
      const res = await axios.get(`${BASE_URL}/api/user/${sellerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success && res.data.user.avatar) {
        setSellerAvatarUrl(res.data.user.avatar);
      }
    } catch (error) {
      console.warn('Failed to fetch seller avatar:', error.message);
    }
  }, [sellerId, isDemoChat]);

  useEffect(() => {
    fetchSellerOnlineStatus();
    fetchSellerAvatar();
  }, [fetchSellerOnlineStatus, fetchSellerAvatar]);

  const connectPresenceSocket = useCallback(async () => {
    if (isDemoChat) return;
    if (!sellerId) return;
    if (!currentUser?._id) return;
    if (socketRef.current) return;

    try {
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;

      const baseUrl = BASE_URL.replace('/api', '');
      const socket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        logDebug('[Socket] connected', socket.id);
        if (sellerId && !isDemoChat) {
          socket.emit('join-chat', { sellerId });
        }
        reloadThreadRef.current?.();
      });

      socket.on('reconnect', () => {
        if (sellerId && !isDemoChat) {
          socket.emit('join-chat', { sellerId });
        }
      });

      socket.on('user-online', (payload) => {
        const uid = payload?.userId;
        if (!uid) return;
        if (String(uid) === String(sellerId)) {
          setIsOnline(true);
        }
      });

      socket.on('user-offline', (payload) => {
        const uid = payload?.userId;
        if (!uid) return;
        if (String(uid) === String(sellerId)) {
          setIsOnline(false);
        }
      });

      socket.on('message-deleted', (payload) => {
        const targetId = payload?.messageId;
        if (!targetId) return;
        setMessages(prev => prev.filter(msg => String(msg._id || msg.id) !== String(targetId)));
        removeCachedMessage(targetId).catch(error => console.warn('Could not remove cached chat message:', error.message));
      });

      socket.on('message-updated', (payload) => {
        const updatedMessage = payload?.message;
        if (!updatedMessage?._id) return;
        const sameChat = (
          String(updatedMessage.senderId) === String(currentUserIdRef.current || '') &&
          String(updatedMessage.receiverId) === String(sellerId)
        ) || (
          String(updatedMessage.senderId) === String(sellerId) &&
          String(updatedMessage.receiverId) === String(currentUserIdRef.current || '')
        );
        if (!sameChat) return;
        setMessages(previous => mergeMessages(previous, [updatedMessage]));
        offlineDatabase.putRecord('messages', updatedMessage._id, updatedMessage, { priority: 'high', protected: true })
          .catch(error => console.warn('Could not update cached chat message:', error.message));
      });

      socket.on('message-read', (payload) => {
        const messageId = String(payload?.messageId || '');
        if (
          !messageId
          || String(payload?.senderId || '') !== String(currentUserIdRef.current || '')
          || String(payload?.receiverId || '') !== String(sellerId)
        ) return;

        setMessages(previous => previous.map(message => (
          String(message._id || message.id) === messageId
            ? { ...message, read: true }
            : message
        )));
        offlineDatabase.getRecord('messages', messageId).then(cachedMessage => {
          if (!cachedMessage) return undefined;
          return offlineDatabase.putRecord(
            'messages',
            messageId,
            { ...cachedMessage, read: true },
            { priority: 'high', protected: true }
          );
        }).catch(error => console.warn('Could not cache message read receipt:', error.message));
      });

      socket.on('new-message', (payload) => {
        const incoming = payload?.message || payload;
        if (!incoming?._id || isDemoChat) return;
        const sameChat = (
          String(incoming.senderId) === String(sellerId) &&
          String(incoming.receiverId) === String(currentUserIdRef.current || '')
        ) || (
          String(incoming.senderId) === String(currentUserIdRef.current || '') &&
          String(incoming.receiverId) === String(sellerId)
        );
        if (!sameChat) return;
        setMessages(previous => mergeMessages(previous, [incoming]));
        if (String(incoming.senderId) === String(sellerId)) {
          const messageId = String(incoming._id);
          if (!markedAsReadRef.current.has(messageId)) {
            markedAsReadRef.current.add(messageId);
            markAsRead(incoming._id);
          }
          if (isNearBottomRef.current) flatListRef.current?.scrollToEnd({ animated: true });
        }
      });

      const handleTyping = (payload, eventName) => {
        logDebug('[Socket] typing event:', eventName, payload);
        if (isDemoChat) return;

        const senderId = String(
          payload?.senderId ?? payload?.userId ?? payload?.from ?? payload?.sender ?? ''
        );
        const me = String(currentUserIdRef.current || '');
        const other = String(sellerId || '');

        if (senderId && me && senderId === me) return;

        if (senderId && other && senderId !== other) {
          const payloadChatId = String(payload?.chatId ?? payload?.chat_id ?? '');
          const ourChatId = String(typingPostIdRef.current || '');
          if (!payloadChatId || !ourChatId || payloadChatId !== ourChatId) {
            return;
          }
        }

        let isTyping;
        if (typeof payload?.typing === 'boolean') isTyping = payload.typing;
        else if (typeof payload?.isTyping === 'boolean') isTyping = payload.isTyping;
        else if (eventName === 'user-stop-typing') isTyping = false;
        else if (eventName === 'user-typing') isTyping = true;
        else return;

        setOtherTyping(isTyping);

        if (typingClearTimerRef.current) {
          clearTimeout(typingClearTimerRef.current);
          typingClearTimerRef.current = null;
        }
        if (isTyping) {
          typingClearTimerRef.current = setTimeout(() => {
            setOtherTyping(false);
            typingClearTimerRef.current = null;
          }, 4000);
        }
      };

      socket.on('user-typing', (payload) => handleTyping(payload, 'user-typing'));
      socket.on('user-stop-typing', (payload) => handleTyping(payload, 'user-stop-typing'));

      socket.on('disconnect', (reason) => {
        logDebug('[Socket] disconnected:', reason);
      });
      socket.on('connect_error', (err) => {
        logDebug('[Socket] connect_error:', err?.message);
      });
    } catch (e) {
      console.warn('[Socket] setup failed:', e?.message);
    }
  }, [currentUser?._id, sellerId, isDemoChat, typingPostId]);

  useEffect(() => {
    connectPresenceSocket();
  }, [connectPresenceSocket]);

  useEffect(() => {
    if (socketRef.current && sellerId && currentUser?._id && !isDemoChat) {
      socketRef.current.emit('join-chat', { sellerId });
    }
    return () => {
      if (socketRef.current && sellerId && !isDemoChat) {
        socketRef.current.emit('leave-chat', { sellerId });
      }
    };
  }, [socketRef.current, sellerId, currentUser, isDemoChat]);

  useFocusEffect(
    useCallback(() => {
      if (socketRef.current && sellerId && currentUser?._id && !isDemoChat) {
        socketRef.current.emit('join-chat', { sellerId });
      }
      return () => {
        if (socketRef.current && sellerId && !isDemoChat) {
          socketRef.current.emit('leave-chat', { sellerId });
        }
      };
    }, [socketRef.current, sellerId, currentUser, isDemoChat])
  );

  useEffect(() => {
    if (!currentUser) return;
    const cacheKey = getChatThreadCacheKey(currentUser, sellerId, postId, adminMode);
    const cachedMessages = cacheKey ? chatThreadMemoryCache.get(cacheKey) : null;
    if (Array.isArray(cachedMessages)) {
      setMessages(cachedMessages);
      setReadyThreadCacheKey(cacheKey);
      setLoading(false);
    } else {
      setMessages([]);
      setReadyThreadCacheKey(null);
      setLoading(true);
    }
    loadMessages();
  }, [currentUser?._id, currentUser?.phone, sellerId, postId, isDemoChat, adminMode]);

  useEffect(() => {
    if (!threadCacheKey || readyThreadCacheKey !== threadCacheKey) return;
    chatThreadMemoryCache.delete(threadCacheKey);
    chatThreadMemoryCache.set(threadCacheKey, messages);
    if (chatThreadMemoryCache.size > MAX_CACHED_CHAT_THREADS) {
      const oldestThreadKey = chatThreadMemoryCache.keys().next().value;
      chatThreadMemoryCache.delete(oldestThreadKey);
    }
    offlineDatabase.putRecord('chat-threads', threadCacheKey, messages, {
      priority: 'high',
      protected: true,
    }).catch(error => {
      console.warn('Could not cache chat thread:', error.message);
    });
  }, [messages, readyThreadCacheKey, threadCacheKey]);

  const loadCurrentUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('sessionUser') || await AsyncStorage.getItem('user');
      let restoredUser = null;
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        restoredUser = { ...parsedUser, _id: parsedUser._id || parsedUser.id || parsedUser.phone };
        setCurrentUser(restoredUser);
      }

      const token = await getChatAuthToken(adminModeRef.current);
      if (!token || !(await networkStatus.start()).isOnline) {
        if (!restoredUser) {
          setCurrentUser(authUser || null);
          setLoading(false);
        }
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUser(response.data.user);
    } catch (error) {
      console.warn('Could not load the current user from the server:', error.message);
      try {
        const storedUser = await AsyncStorage.getItem('sessionUser') || await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser({ ...parsedUser, _id: parsedUser._id || parsedUser.id || parsedUser.phone });
        } else {
          setCurrentUser(authUser || null);
        }
      } catch (storageError) {
        console.error('Could not restore the cached chat user:', storageError.message);
        setCurrentUser(authUser || null);
      }
      if (!restoredUser && !authUser) setLoading(false);
    }
  };

  const loadMessages = async (showLoading = false) => {
    if (!currentUser) return;
    if (isDemoChat) {
      await loadDemoMessages();
      return;
    }
    if (!sellerId || !currentUser._id) {
      setLoading(false);
      return;
    }

    if (messagesFetchRef.current) return;
    messagesFetchRef.current = true;
    if (showLoading) setRefreshing(true);
    const cacheKey = getChatThreadCacheKey(currentUser, sellerId, postId, adminMode);
    let cachedThreadMessages = cacheKey ? chatThreadMemoryCache.get(cacheKey) : null;
    try {
      if (!Array.isArray(cachedThreadMessages) && cacheKey) {
        try {
          cachedThreadMessages = await offlineDatabase.getRecord('chat-threads', cacheKey);
        } catch (cacheError) {
          console.warn('Could not read cached chat thread:', cacheError.message);
        }
      }
      if (Array.isArray(cachedThreadMessages)) {
        const enhancedCachedMessages = enhanceReplies(cachedThreadMessages);
        setMessages(previous => mergeMessages(previous, enhancedCachedMessages));
        setReadyThreadCacheKey(cacheKey);
        setLoading(false);
        prefetchReplyPostCovers(enhancedCachedMessages).catch(error => {
          console.warn('Could not prefetch cached chat media:', error.message);
        });
      }

      if (!(await networkStatus.start()).isOnline) {
        if (!Array.isArray(cachedThreadMessages)) {
          const localMessages = await loadLocalMessages();
          setMessages(previous => mergeMessages(previous, enhanceReplies(localMessages)));
          setReadyThreadCacheKey(cacheKey);
          prefetchReplyPostCovers(localMessages).catch(error => {
            console.warn('Could not prefetch offline chat media:', error.message);
          });
        }
        setLoading(false);
        return;
      }
      const token = await getChatAuthToken(adminModeRef.current);
      const currentUserId = currentUser._id || currentUser.phone || '';
      const effectivePostId = postId || '';
      const query = effectivePostId ? `?postId=${encodeURIComponent(effectivePostId)}` : '';
      const url = `${BASE_URL}/api/messages/thread/${encodeURIComponent(currentUserId)}/${encodeURIComponent(sellerId)}${query}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let messagesFromApi = response.data.messages || [];
      messagesFromApi = messagesFromApi.map((m) => ({
        ...m,
        _id: m._id || m.id,
        createdAt: m.createdAt || m.timestamp || m.createdAt,
        senderId: m.senderId || m.senderPhone || m.senderId,
        replyPost: m.replyPost || m.replyPostContext || null,
      }));
      Promise.all(messagesFromApi.map(message => (
        offlineDatabase.putRecord('messages', message._id, message, { priority: 'high', protected: true })
      ))).catch(cacheError => {
        console.warn('Could not cache loaded chat messages:', cacheError.message);
      });

      const localMessages = Array.isArray(cachedThreadMessages) ? [] : await loadLocalMessages();
      const allMessages = [...messagesFromApi, ...localMessages];
      const sorted = allMessages
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .filter((msg, index, self) => self.findIndex(m => String(m._id || m.id) === String(msg._id || msg.id)) === index);

      const enhancedMessages = enhanceReplies(sorted);

      setMessages(previous => mergeMessages(previous, enhancedMessages));
      setReadyThreadCacheKey(cacheKey);
      setLoading(false);
      prefetchReplyPostCovers(enhancedMessages).catch(error => {
        console.warn('Could not prefetch chat media:', error.message);
      });

      messagesFromApi.forEach((msg) => {
        if (String(msg.senderId) === String(sellerId) && !msg.read) {
          markAsRead(msg._id);
        }
      });

      syncManager.run('chat-open');
    } catch (error) {
      console.warn('Using cached messages:', error.message);
      try {
        if (!Array.isArray(cachedThreadMessages)) {
          const localMessages = await loadLocalMessages();
          const enhancedLocal = enhanceReplies(localMessages);
          setMessages(previous => mergeMessages(previous, enhancedLocal));
          setReadyThreadCacheKey(cacheKey);
          prefetchReplyPostCovers(enhancedLocal).catch(cacheError => {
            console.warn('Could not prefetch cached chat media:', cacheError.message);
          });
        }
      } catch (cacheError) {
        console.error('Could not load cached chat messages:', cacheError);
        showChatNotice('error', t.networkError, t.couldNotLoad);
      } finally {
        setLoading(false);
      }
    } finally {
      messagesFetchRef.current = false;
      if (showLoading) setRefreshing(false);
    }
  };

  reloadThreadRef.current = () => loadMessages();

  const loadLocalMessages = async () => {
    const records = await offlineDatabase.getCollection('messages');
    const allMessages = records.map(record => record.value);
    const currentUserId = currentUser._id || currentUser.phone;
    const filtered = allMessages
      .filter((msg) => {
        const senderId = String(msg.senderId || msg.senderPhone || '');
        const receiverId = String(msg.receiverId || msg.receiverPhone || '');
        const me = String(currentUserId || '');
        const seller = String(sellerId || '');
        const belongsToThread =
          (senderId === me && receiverId === seller) ||
          (senderId === seller && receiverId === me);

        return belongsToThread && (!postId || String(msg.postId || '') === String(postId));
      })
      .map(toChatMessage)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return enhanceReplies(filtered);
  };

  const loadDemoMessages = async () => {
    try {
      const stored = await AsyncStorage.getItem(MESSAGES_KEY);
      let allMessages = stored ? JSON.parse(stored) : [];
      const currentUserId = currentUser._id || currentUser.phone;
      const existingIds = new Set(allMessages.map((msg) => msg.id));
      const defaultMessages = createDefaultDemoChatMessages({
        postId,
        postTitle,
        sellerName,
        sellerPhone,
        currentUser,
      });
      const missingDefaultMessages = defaultMessages.filter(
        (msg) => !existingIds.has(msg.id)
      );

      if (missingDefaultMessages.length > 0) {
        allMessages = [...allMessages, ...missingDefaultMessages];
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));
      }

      const demoMessages = allMessages
        .filter(
          (msg) =>
            String(msg.postId) === String(postId) &&
            msg.postUser === sellerName &&
            (msg.senderId === sellerId || msg.senderId === currentUserId)
        )
        .map((msg) => ({
          _id: msg.id,
          senderId: msg.senderId,
          senderName:
            msg.senderId === currentUserId
              ? currentUser.username
              : msg.senderName,
          senderAvatar: msg.senderAvatar,
          text: msg.text,
          imageUrl: msg.imageUrl,
          imageUrls: msg.imageUrls,
          audioUrl: msg.audioUrl,
          audioDuration: msg.audioDuration,
          repliedTo: msg.repliedTo,
          replyPost: msg.replyPost,
          createdAt: msg.timestamp,
          read: msg.read,
        }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const enhanced = enhanceReplies(demoMessages);
      await prefetchReplyPostCovers(enhanced);
      setMessages(enhanced);
    } catch (error) {
      console.error('Error loading demo messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;
      await axios.put(`${BASE_URL}/api/messages/read/${messageId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      console.error('Error marking as read:', error.response?.status, error.response?.data || error.message);
    }
  };

  const pollNewMessages = useCallback(async () => {
    if (isDemoChat) return;
    if (!currentUser?._id || !sellerId) return;
    if (!networkStatus.get().isOnline) return;
    if (socketRef.current?.connected) return;
    if (messagesFetchRef.current) return;

    messagesFetchRef.current = true;
    try {
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) return;

      const currentUserId = currentUser._id || currentUser.phone || '';
      const effectivePostId = postId || '';
      const query = effectivePostId
        ? `?postId=${encodeURIComponent(effectivePostId)}`
        : '';
      const url = `${BASE_URL}/api/messages/thread/${encodeURIComponent(
        currentUserId
      )}/${encodeURIComponent(sellerId)}${query}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let messagesFromApi = response.data.messages || [];
      messagesFromApi = messagesFromApi.map((m) => ({
        ...m,
        _id: m._id || m.id,
        createdAt: m.createdAt || m.timestamp,
        senderId: m.senderId || m.senderPhone,
        replyPost: m.replyPost || m.replyPostContext || null,
      }));
      try {
        await Promise.all(messagesFromApi.map(message => (
          offlineDatabase.putRecord('messages', message._id, message, { priority: 'high', protected: true })
        )));
      } catch (cacheError) {
        console.warn('Could not cache refreshed chat messages:', cacheError.message);
      }

      const enhanced = enhanceReplies(messagesFromApi);

      setMessages((previous) => mergeMessages(previous, enhanced));

      messagesFromApi.forEach((msg) => {
        const id = String(msg._id);
        if (
          String(msg.senderId) === String(sellerId) &&
          !msg.read &&
          !markedAsReadRef.current.has(id)
        ) {
          markedAsReadRef.current.add(id);
          markAsRead(msg._id);
        }
      });
    } catch (error) {
      console.warn('Could not refresh chat messages; the next retry will run when available:', error.message);
    } finally {
      messagesFetchRef.current = false;
    }
  }, [
    currentUser?._id,
    currentUser?.phone,
    isDemoChat,
    sellerId,
    postId,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (isDemoChat) return undefined;
      if (!currentUser?._id || !sellerId) return undefined;

      const intervalId = setInterval(() => {
        pollNewMessages();
      }, 5000);

      return () => clearInterval(intervalId);
    }, [pollNewMessages, isDemoChat, currentUser?._id, sellerId])
  );

  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef({ isTyping: false, ts: 0 });
  const sendInFlightRef = useRef(false);

  const sendTyping = useCallback((isTyping) => {
    const senderId = currentUser?._id;
    if (!socketRef.current || isDemoChat || !typingPostId || !senderId || !sellerId) {
      return;
    }

    const now = Date.now();
    const last = lastTypingSentRef.current;
    if (last.isTyping === isTyping && now - last.ts < 1200) return;
    lastTypingSentRef.current = { isTyping, ts: now };
    socketRef.current.emit(isTyping ? 'typing' : 'stop_typing', {
      chatId: typingPostId,
      senderId,
      receiverId: sellerId,
    });
  }, [currentUser?._id, isDemoChat, sellerId, typingPostId]);

  const onInputChange = useCallback((text) => {
    if (text.length > MAX_MESSAGE_CHARACTERS || text.split('\n').length > 5) return;
    setInputText(text);
    if (!text) setAttachmentsStacked(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!text.trim()) {
      sendTyping(false);
      return;
    }
    sendTyping(true);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1500);
  }, [sendTyping]);

  const handleInputContentSizeChange = useCallback(({ nativeEvent }) => {
    const contentHeight = nativeEvent.contentSize.height;
    setInputHeight(Math.min(INPUT_MAX_VISIBLE_HEIGHT, Math.max(INPUT_MIN_HEIGHT, contentHeight)));
    setInputScrollable(contentHeight > INPUT_MAX_VISIBLE_HEIGHT);
    if (contentHeight > INPUT_MAX_VISIBLE_HEIGHT) setAttachmentsStacked(true);
  }, []);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);
  }, [sendTyping]);

  const handleSendPress = async () => {
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    try {
      if (editingMessageId) {
        await sendMessage(inputText, null, replyTo);
        return;
      }

      const hasUploadedImages = selectedImages.some((img) => img.status === 'done' && img.uploadedUrl);
      if (hasUploadedImages) {
        const caption = inputText.trim();
        const uploadedImages = selectedImages.filter((img) => img.status === 'done' && img.uploadedUrl);
        if (uploadedImages.length > MAX_IMAGES_PER_MESSAGE) {
          showChatNotice('error', t.imageLimit, t.imageLimitMessage.replace('{count}', String(MAX_IMAGES_PER_MESSAGE)));
          return;
        }

        const urls = uploadedImages.map((img) => img.uploadedUrl);

        if (urls.length > 1) {
          await sendMessage(caption, null, replyTo, urls);
        } else {
          await sendMessage(caption, urls[0], replyTo);
        }
        return;
      }

      await sendMessage(inputText, null, replyTo);
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const sendMessage = async (text, imageUrl = null, repliedTo = null, imageUrls = null, videoAsset = null) => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);
    const cleanText = text?.trim() || '';
    if (!cleanText && !imageUrl && (!imageUrls || imageUrls.length === 0) && !videoAsset) return;
    if (!currentUser) {
      showChatNotice('error', t.error, t.userNotLoaded);
      return;
    }

    if (editingMessageId) {
      await editMessage(editingMessageId, cleanText);
      setEditingMessageId(null);
      setInputText('');
      return;
    }

    const hasMultiple = Array.isArray(imageUrls) && imageUrls.length > 1;
    const primaryImage = hasMultiple ? imageUrls[0] : imageUrl;

    if (isDemoChat) {
      await sendDemoMessage(cleanText, primaryImage, repliedTo, hasMultiple ? imageUrls : null);
      return;
    }

    const currentUserId = currentUser._id;
    if (!currentUserId || !sellerId) {
      showChatNotice('error', t.error, t.missingInfo);
      return;
    }

    const currentReplyPost = videoAsset?.replyPost || replyPost || null;

    const messageData = {
      clientMessageId: videoAsset?.clientMessageId || `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      postId,
      postTitle,
      postUser: sellerName,
      senderId: currentUserId,
      senderName: currentUser.username,
      senderPhone: currentUser.phone,
      senderAvatar: currentUser.avatar,
      receiverId: sellerId,
      receiverName: sellerName,
      receiverPhone: sellerPhone,
      text: cleanText,
      imageUrl: primaryImage,
      videoUrl: '',
      ...(hasMultiple ? { imageUrls } : {}),
      repliedTo: repliedTo
        ? {
            messageId: repliedTo._id,
            text: repliedTo.text || '',
            imageUrl:
              repliedTo.imageUrl ||
              (Array.isArray(repliedTo.imageUrls) && repliedTo.imageUrls[0]) ||
              null,
            senderName: repliedTo.senderName,
          }
        : null,
      replyPost: currentReplyPost,
    };

    const tempId = messageData.clientMessageId;
    const tempMessage = {
      _id: tempId,
      ...messageData,
      ...(videoAsset ? { videoUrl: videoAsset.uri, videoAsset: { ...videoAsset, replyPost: currentReplyPost } } : {}),
      clientMessageId: tempId,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
      read: false,
    };

    setMessages(prev => {
      const alreadyExists = prev.some((msg) => {
        return String(msg._id || msg.id) === tempId;
      });
      return alreadyExists ? prev : [...prev, tempMessage];
    });

    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }

    try {
      if (videoAsset && !networkStatus.get().isOnline) {
        setMessages(prev => prev.filter(msg => String(msg._id || msg.id) !== tempId));
        showChatNotice('info', t.networkError, t.videoRetry);
        return;
      }
      if (!networkStatus.get().isOnline) {
        await offlineDatabase.putRecord('messages', tempId, { ...tempMessage, id: tempId }, { priority: 'high', protected: true });
        await syncManager.enqueue({ actionType: 'SEND_MESSAGE', entityType: 'message', entityId: tempId, payload: { ...messageData, clientMessageId: tempId } });
        setInputText('');
        setSelectedImages([]);
        setReplyTo(null);
        clearReplyPost();
        return;
      }
      const token = await getChatAuthToken(adminModeRef.current);
      let requestBody = messageData;
      if (videoAsset) {
        const form = new FormData();
        Object.entries(messageData).forEach(([key, value]) => {
          if (value === undefined || value === null || key === 'videoUrl') return;
          form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        });
        const filename = videoAsset.fileName || videoAsset.uri.split('/').pop() || `chat-${tempId}.mp4`;
        form.append('video', {
          uri: videoAsset.uri,
          name: filename,
          type: videoAsset.mimeType || 'video/mp4',
        });
        requestBody = form;
      }
      const response = await axios.post(
        `${BASE_URL}/api/messages/send`,
        requestBody,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const serverMessage = {
        ...response.data.message,
        replyPost:
          response.data.message?.replyPost ||
          response.data.message?.replyPostContext ||
          currentReplyPost ||
          null,
      };
      await offlineDatabase.putRecord('messages', serverMessage._id, serverMessage, { priority: 'high', protected: true });
      setMessages(prev => mergeMessages(
        prev.filter(msg => String(msg._id || msg.id) !== tempId),
        [serverMessage]
      ));
      setInputText('');
      setSelectedImages([]);
      setReplyTo(null);
      setEditingMessageId(null);
      clearReplyPost();
      if (primaryImage) {
        fetchUserLimitsAndUsage();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.response && error.response.status < 500) {
        setMessages(prev => prev.filter(msg => String(msg._id || msg.id) !== tempId));
        showChatNotice(
          'error',
          t.sendFailed,
          error.response.data?.message || (primaryImage ? t.imageSendFailed : t.couldNotSend)
        );
        return;
      }
      if (videoAsset) {
        const failedMessage = { ...tempMessage, syncStatus: 'failed', syncError: error.message };
        await offlineDatabase.putRecord('messages', tempId, failedMessage, { priority: 'high', protected: true });
        setMessages(prev => prev.map(msg => (
          String(msg._id || msg.id) === tempId ? failedMessage : msg
        )));
        showChatNotice('error', t.sendFailed, t.videoRetry);
        return;
      }
      await offlineDatabase.putRecord('messages', tempId, { ...tempMessage, id: tempId }, { priority: 'high', protected: true });
      await syncManager.enqueue({ actionType: 'SEND_MESSAGE', entityType: 'message', entityId: tempId, payload: { ...messageData, clientMessageId: tempId } });
      setInputText('');
      setSelectedImages([]);
      setReplyTo(null);
      clearReplyPost();
      showChatNotice('error', t.error, primaryImage ? t.imageSendFailed : t.couldNotSend);
    }
  };

  const retryPendingMessage = async (message) => {
    if (sendInFlightRef.current) return;
    const clientMessageId = String(message.clientMessageId || message._id || message.id || '');
    if (!clientMessageId || !currentUser || !sellerId) return;

    sendInFlightRef.current = true;
    if (message.videoAsset) {
      try {
        await sendMessage(message.text, null, message.repliedTo || null, null, {
          ...message.videoAsset,
          clientMessageId,
          replyPost: message.replyPost || message.videoAsset.replyPost || null,
        });
      } finally {
        sendInFlightRef.current = false;
      }
      return;
    }

    const payload = { ...message, clientMessageId };
    delete payload._id;
    delete payload.id;
    delete payload.syncStatus;
    delete payload.syncError;
    delete payload.createdAt;
    delete payload.read;

    try {
      const pendingMessage = { ...message, clientMessageId, syncStatus: 'pending', syncError: null };
      setMessages(previous => previous.map(entry => (
        String(entry._id || entry.id) === clientMessageId ? pendingMessage : entry
      )));
      await offlineDatabase.putRecord('messages', clientMessageId, pendingMessage, { priority: 'high', protected: true });
      await syncManager.enqueue({
        actionType: 'SEND_MESSAGE',
        entityType: 'message',
        entityId: clientMessageId,
        payload,
      });
    } catch (error) {
      console.error('Could not retry the pending message:', error);
      setMessages(previous => previous.map(entry => (
        String(entry._id || entry.id) === clientMessageId
          ? { ...entry, syncStatus: 'failed', syncError: error.message }
          : entry
      )));
      showChatNotice('error', t.sendFailed, t.couldNotSend);
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const sendDemoMessage = async (text, imageUrl = null, repliedTo = null, imageUrls = null) => {
    try {
      const currentUserId = currentUser._id || currentUser.phone;
      const currentReplyPost = replyPost || null;
      const message = {
        id: `demo_sent_${Date.now()}`,
        postId,
        postTitle,
        postUser: sellerName,
        senderId: currentUserId,
        senderName: currentUser.username || 'Me',
        senderPhone: currentUser.phone,
        receiverId: sellerId,
        receiverName: sellerName,
        receiverPhone: sellerPhone,
        text,
        imageUrl,
        ...(imageUrls ? { imageUrls } : {}),
        repliedTo: repliedTo
          ? {
              messageId: repliedTo._id,
              text: repliedTo.text || '',
              imageUrl:
                repliedTo.imageUrl ||
                (Array.isArray(repliedTo.imageUrls) && repliedTo.imageUrls[0]) ||
                null,
              senderName: repliedTo.senderName,
            }
          : null,
        replyPost: currentReplyPost,
        timestamp: new Date().toISOString(),
        read: true,
      };
      await saveLocalMessage(message);
      setMessages(prev => [...prev, toChatMessage(message)]);
      setInputText('');
      setSelectedImages([]);
      setReplyTo(null);
      setEditingMessageId(null);
      clearReplyPost();
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error('Error sending demo message:', error);
      showChatNotice('error', t.error, t.couldNotSend);
    }
  };

  const editMessage = async (messageId, newText) => {
    try {
      const token = await getChatAuthToken(adminModeRef.current);
      const response = await axios.put(
        `${BASE_URL}/api/messages/edit/${messageId}`,
        { text: newText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedMessage = response.data.message;
      await offlineDatabase.putRecord('messages', updatedMessage._id || messageId, updatedMessage, {
        priority: 'high',
        protected: true,
      });

      setMessages(prev =>
        mergeMessages(prev.map(msg =>
          String(msg._id || msg.id) === String(messageId)
            ? { ...updatedMessage, repliedTo: msg.repliedTo, replyPost: msg.replyPost }
            : msg
        ), [])
      );

      setMessages(prev =>
        prev.map((msg) => {
          if (msg.repliedTo && msg.repliedTo.messageId === messageId) {
            return {
              ...msg,
              repliedTo: {
                ...msg.repliedTo,
                text: newText,
              },
            };
          }
          return msg;
        })
      );

      const stored = await AsyncStorage.getItem(MESSAGES_KEY);
      if (stored) {
        const allMessages = JSON.parse(stored);
        const updated = allMessages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, text: newText, isEdited: true };
          }
          if (msg.repliedTo && msg.repliedTo.messageId === messageId) {
            return {
              ...msg,
              repliedTo: { ...msg.repliedTo, text: newText },
            };
          }
          return msg;
        });
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
      }

      showChatNotice('success', t.updated, t.messageEdited);
    } catch (error) {
      console.error('Error editing message:', error);
      showChatNotice('error', t.error, t.editFailed);
    }
  };

  const unsendMessage = messageId => {
    showBottomSheet({
      type: 'error',
      title: t.unsendTitle,
      message: t.unsendMessage,
      icon: 'alert-circle-outline',
      buttonText: t.yes,
      buttonAction: async () => {
      try {
        const token = await getChatAuthToken(adminModeRef.current);
        await axios.delete(
          `${BASE_URL}/api/messages/${messageId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await removeCachedMessage(messageId);
        setMessages(prev => prev.filter(msg => String(msg._id || msg.id) !== String(messageId)));
      } catch (error) {
        console.error('Error unsending message:', error);
        let message = t.unsendFailed;
        if (error.response?.status === 400) {
          message = t.unsendTooOld;
        }
        showChatNotice('error', t.error, message);
      }
      },
      secondaryButtonText: t.no,
    });
  };

  const uploadImages = async (assets) => {
    if (!assets || assets.length === 0) return;
    console.log('SELECTED IMAGE:', assets);

    try {
      if (!(await networkStatus.start()).isOnline) {
        showChatNotice('info', t.networkError, t.unableToUpload);
        return;
      }
    } catch (error) {
      console.warn('Could not check the network before uploading chat images:', error.message);
      showChatNotice('error', t.networkError, t.unableToUpload);
      return;
    }

    try {
      const lastImageSendKey = `lastImageSend_${currentUser?._id || 'default'}`;
      const lastSend = await AsyncStorage.getItem(lastImageSendKey);
      const now = Date.now();
      if (lastSend) {
        const elapsedMinutes = (now - parseInt(lastSend, 10)) / (1000 * 60);
        if (elapsedMinutes < 5) {
          showChatNotice('info', t.imageCooldown, t.imageCooldownMessage);
          return;
        }
      }
    } catch (e) {
      console.warn('Cooldown check failed:', e);
    }

    if (assets.length > MAX_IMAGES_PER_MESSAGE) {
      showChatNotice('error', t.imageLimit, t.imageLimitMessage.replace('{count}', String(MAX_IMAGES_PER_MESSAGE)));
      return;
    }

    try {
      const token = await getChatAuthToken(adminModeRef.current);
      if (!token) {
        showChatNotice('error', t.authRequired, t.pleaseLogin);
        return;
      }

      const files = assets.map((asset) => {
        const filename = asset.fileName || asset.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const extension = match ? match[1].toLowerCase() : '';
        const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };
        const type = mimeTypes[extension] || asset.mimeType || 'image/jpeg';
        return {
          uri: asset.uri,
          name: filename,
          type,
        };
      });

      if (files.length > MAX_IMAGES_PER_MESSAGE) {
        throw new Error(`You can upload up to ${MAX_IMAGES_PER_MESSAGE} images per message.`);
      }

      setSelectedImages(files.map(file => ({ ...file, status: 'uploading' })));
      setImageUploadStatus('uploading');
      setImageUploadProgress(0);

      const form = new FormData();
      files.forEach((file) => {
        form.append('images', file);
      });

      const response = await axios.post(`${BASE_URL}/api/messages/upload-image`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setImageUploadProgress(percent);
        },
      });

      console.log('B2 UPLOAD RESPONSE:', response.data);
      const urls = response.data.urls || [];
      if (!Array.isArray(urls) || urls.length !== files.length || urls.some((url) => {
        if (typeof url !== 'string') return true;
        try {
          const parsed = new URL(url);
          return parsed.protocol !== 'https:' ||
            !/^f\d{3}\.backblazeb2\.com$/i.test(parsed.hostname) ||
            !/^\/file\/[^/]+\/shaaka\/chats\//i.test(parsed.pathname);
        } catch {
          return true;
        }
      })) {
        throw new Error('Upload did not return image URLs');
      }
      urls.forEach((imageUrl) => console.log('FINAL IMAGE URL:', imageUrl));

      setSelectedImages(files.map((file, index) => ({
        ...file,
        status: 'done',
        uploadedUrl: urls[index],
      })));
      setImageUploadProgress(100);
      setImageUploadStatus('done');

      fetchUserLimitsAndUsage();

      const lastImageSendKey = `lastImageSend_${currentUser?._id || 'default'}`;
      await AsyncStorage.setItem(lastImageSendKey, String(Date.now()));

    } catch (error) {
      console.error(
        'Image upload error:',
        error.response?.status,
        error.response?.data || error.message
      );

      let errorMessage = t.unableToUpload;
      if (error.response) {
        const status = error.response.status;
        const serverMsg = error.response.data?.message || error.response.data?.error || '';
        if (status === 500) {
          errorMessage = 'Internal server error. Please try again later.';
        } else if (status === 400) {
          errorMessage = serverMsg || 'Invalid request. Please check your image.';
        } else if (status === 403) {
          errorMessage = serverMsg || 'Image uploads are not allowed for this account.';
        } else if (status === 401) {
          errorMessage = serverMsg || 'Authentication error. Please log in again.';
        } else if (status === 413) {
          errorMessage = 'Image too large. Please choose a smaller image.';
        } else {
          errorMessage = serverMsg || t.unableToUpload;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Check your network.';
      }

      showChatNotice('error', t.error, errorMessage);
      setImageUploadStatus('failed');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showChatNotice('info', t.permissionNeeded, t.photoAccessNeeded);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES_PER_MESSAGE,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        uploadImages(result.assets);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showChatNotice('error', t.error, t.failedToChooseImage);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showChatNotice('info', t.permissionNeeded, t.cameraAccessNeeded);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        uploadImages(result.assets);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showChatNotice('error', t.error, t.failedToCapturePhoto);
    }
  };

  const playAudio = useCallback(async (audioUrl, messageId) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        setPlayingAudioId(null);
      }
      if (playingAudioId === messageId) {
        setPlayingAudioId(null);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      soundRef.current = sound;
      setPlayingAudioId(messageId);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
          sound.unloadAsync().catch(error => {
            console.warn('Could not unload finished chat audio:', error.message);
          });
        }
      });
    } catch (error) {
      console.error('Failed to play audio', error);
    }
  }, [playingAudioId]);

  const isOwnMessage = useCallback((message) => {
    const userId = currentUser?._id || currentUser?.phone;
    return String(message.senderId || '') === String(userId || '');
  }, [currentUser]);

  const formatDuration = useCallback((seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  }, []);

  const toChatMessage = (msg) => ({
    ...msg,
    _id: msg.id || msg._id,
    senderId: msg.senderId || msg.senderPhone,
    senderName: msg.senderName,
    senderAvatar: msg.senderAvatar,
    text: msg.text,
    imageUrl: msg.imageUrl,
    imageUrls: msg.imageUrls,
    audioUrl: msg.audioUrl,
    audioDuration: msg.audioDuration,
    repliedTo: msg.repliedTo,
    replyPost: msg.replyPost || msg.replyPostContext || null,
    createdAt: msg.timestamp || msg.createdAt,
    read: msg.read,
  });

  const saveLocalMessage = async (message) => {
    const id = message.id || message._id || `local_${Date.now()}`;
    await offlineDatabase.putRecord('messages', id, { ...message, id }, { priority: 'high', protected: !!message.syncStatus });
  };

  const shouldShowTimestamp = useCallback((currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentTime = new Date(currentMsg.createdAt).getTime();
    const prevTime = new Date(prevMsg.createdAt).getTime();
    return (currentTime - prevTime) / (1000 * 60) > 30;
  }, []);

  const handleDoubleTap = useCallback((message) => {
    setActionMessage(message);
    setActionModalVisible(true);
  }, []);

  const handleAction = useCallback((action) => {
    if (!actionMessage) return;
    const msg = actionMessage;

    switch (action) {
      case 'reply':
        setReplyTo(msg);
        setActionModalVisible(false);
        break;
      case 'copy':
        Clipboard.setString(msg.text || '');
        showChatNotice('success', t.copied, t.copied);
        setActionModalVisible(false);
        break;
      case 'edit':
        setEditingMessageId(msg._id);
        setInputText(msg.text);
        setActionModalVisible(false);
        setTimeout(() => inputRef.current?.focus(), 100);
        break;
      case 'unsend':
        unsendMessage(msg._id);
        setActionModalVisible(false);
        break;
      default:
        break;
    }
  }, [actionMessage, showChatNotice, t]);

  const renderActionModal = () => {
    if (!actionMessage) return null;
    const isOwn = isOwnMessage(actionMessage);
    const now = new Date();
    const msgTime = new Date(actionMessage.createdAt);
    const ageSeconds = (now - msgTime) / 1000;
    const hasReplies = messages.some(m => m.repliedTo && m.repliedTo.messageId === actionMessage._id);
    const hasImage = !!actionMessage.imageUrl || (Array.isArray(actionMessage.imageUrls) && actionMessage.imageUrls.length > 0);
    const canEdit = isOwn && !actionMessage.audioUrl && !hasImage && ageSeconds < 50 && !hasReplies;
    const canUnsend = isOwn && ageSeconds < 360;

    return (
      <Modal transparent visible={actionModalVisible} animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <TouchableOpacity
          style={[styles.actionModalOverlay, { backgroundColor: theme.call }]}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <View style={[styles.actionModalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('reply')}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
              <Text style={[styles.actionOptionText, { color: theme.text }]}>{t.reply}</Text>
            </TouchableOpacity>
            {!hasImage && (
              <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('copy')}>
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text style={[styles.actionOptionText, { color: theme.text }]}>{t.copy}</Text>
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('edit')}>
                <Ionicons name="pencil-outline" size={20} color={theme.text} />
                <Text style={[styles.actionOptionText, { color: theme.text }]}>{t.edit}</Text>
              </TouchableOpacity>
            )}
            {canUnsend && (
              <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('unsend')}>
                <Ionicons name="trash-outline" size={20} color="#d87428" />
                <Text style={[styles.actionOptionText, { color: '#d87428' }]}>{t.unsend}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderUpgradeModal = () => {
    return (
      <Modal
        transparent
        visible={upgradeModalVisible}
        animationType="fade"
        onRequestClose={closeUpgradeModal}
      >
        <TouchableOpacity
          style={[styles.actionModalOverlay, { backgroundColor: theme.action }]}
          activeOpacity={1}
          onPress={closeUpgradeModal}
        >
          <View style={[styles.actionModalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.upgradeModalIconContainer}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.accent} />
            </View>
            <Text style={[styles.upgradeModalTitle, { color: theme.text }]}>
              {t.imageLimitReachedTitle}
            </Text>
            <Text style={[styles.upgradeModalMessage, { color: theme.textSecondary }]}>
              {t.imageLimitReachedMessage}
            </Text>
            <Text style={[styles.upgradeModalMessage, { color: theme.textSecondary, marginBottom: 16 }]}>
              {t.upgradePrompt}
            </Text>
            <View style={styles.upgradeModalButtons}>
              <TouchableOpacity
                style={[styles.upgradeModalButton, styles.upgradeModalCancelButton, { borderColor: theme.border }, { flex: 1 }]}
                onPress={closeUpgradeModal}
              >
                <Text style={[styles.upgradeModalButtonText, { color: theme.textSecondary }]}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const navigateToPostDetail = useCallback((postContext) => {
    if (!postContext) return;
    if (postContext.contextType === 'shop') {
      const shopId = postContext.shopId || postContext.contextId || postContext.postId || postContext._id;
      if (!shopId) return;
      navigation.navigate('Main', {
        screen: 'Locate',
        params: {
          focusMallShopId: String(shopId),
          focusMallShop: postContext,
          openMallShopDetails: true,
        },
      });
      return;
    }
    if (postContext.contextType === 'place') {
      const placeId = postContext.contextId || postContext.postId || postContext._id;
      if (!placeId) return;
      navigation.navigate('Main', {
        screen: 'Locate',
        params: {
          openPlaceContext: { ...postContext, contextId: String(placeId) },
        },
      });
      return;
    }
    const postIdToOpen = postContext.postId || postContext._id;
    if (postIdToOpen) {
      const postData = postContext.productName || postContext.houseImages ? postContext : undefined;
      navigation.navigate('PostDetail', { postId: String(postIdToOpen), house: postData });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => {
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showTimestamp = shouldShowTimestamp(item, prevMsg);

    return (
      <>
        {showTimestamp && (
          <View style={styles.timestampContainer}>
            <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        <MessageItem
          item={item}
          isOwnMessage={isOwnMessage}
          currentUser={currentUser}
          sellerAvatar={sellerAvatarUrl || sellerAvatar}
          theme={theme}
          onDoubleTap={handleDoubleTap}
          onSwipeReply={setReplyTo}
          playingAudioId={playingAudioId}
          playAudio={playAudio}
          formatDuration={formatDuration}
          t={t}
          navigation={navigation}
          sellerId={sellerId}
          sellerName={sellerName}
          onReplyPostPress={navigateToPostDetail}
          onRetryMessage={retryPendingMessage}
        />
      </>
    );
  }, [
    messages,
    shouldShowTimestamp,
    theme,
    sellerAvatarUrl,
    sellerAvatar,
    isOwnMessage,
    currentUser,
    handleDoubleTap,
    playingAudioId,
    playAudio,
    formatDuration,
    t,
    navigation,
    sellerId,
    sellerName,
    navigateToPostDetail
  ]);

  useEffect(() => {
    let scrollTimeout;
    if (!loading && messages.length > 0 && flatListRef.current) {
      scrollTimeout = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [loading]);

  const handleContentSizeChange = () => {
    scrollToBottom(true);
  };

  const handleScroll = (event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const bottomOffset = contentSize.height - layoutMeasurement.height;
    const threshold = 50;
    const isNear = bottomOffset - contentOffset.y < threshold;
    isNearBottomRef.current = isNear;
    setIsNearBottom(isNear);
  };

  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && isNearBottom) {
      flatListRef.current.scrollToEnd({ animated });
    }
  };

  if (loading) {
    return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.textSecondary} />;
  }

  const sellerAvatarSource = sellerAvatarUrl ? { uri: sellerAvatarUrl } : DEFAULT_AVATAR;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <TouchableOpacity
              style={styles.headerAvatarContainer}
              onPress={() => navigation.navigate('Profile', { userId: sellerId, username: sellerName })}
            >
              <Image source={normalizeImageSource(sellerAvatarSource)} style={styles.headerAvatarImage} />
              {isOnline && (
                <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }] }]} />
              )}
            </TouchableOpacity>

            <View style={styles.headerText}>
              <TouchableOpacity
                style={styles.headerAvatarContainer}
                onPress={() => navigation.navigate('Profile', { userId: sellerId, username: sellerName })}
              >
                <Text style={[styles.headerTitle, { color: theme.text }]}>{sellerName}</Text>
                {otherTyping && (
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    {t.typing}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => loadMessages(true)} style={styles.refreshButton}>
              <Ionicons name="refresh" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ImageBackground
          source={normalizeImageSource(chatBackground)}
          style={styles.chatBackground}
          resizeMode="cover"
        >
          <View style={[styles.overlay, { backgroundColor: theme.background, opacity: 0.92 }]} />
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onContentSizeChange={handleContentSizeChange}
            refreshing={refreshing}
            onRefresh={() => loadMessages(true)}
            onScroll={handleScroll}
            scrollEventThrottle={200}
            removeClippedSubviews={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={21}
            updateCellsBatchingPeriod={50}
            onEndReachedThreshold={0.5}
          />
        </ImageBackground>

        {otherTyping && <TypingIndicator theme={theme} avatar={sellerAvatarSource} />}

        {/* Reply to Message bar */}
        {replyTo && (
          <View style={[styles.replyBar, { backgroundColor: theme.cardBackground, borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <View style={styles.replyBarContent}>
              <Text style={[styles.replyBarText, { color: theme.textSecondary }]}>
                {t.replyingTo} {replyTo.senderName}
              </Text>
              {replyTo.imageUrl ? (
                <View style={styles.replyBarImageContainer}>
                  <ChatImage uri={replyTo.imageUrl} style={styles.replyBarImage} />
                  {replyTo.text ? (
                    <Text style={[styles.replyBarMessage, { color: theme.text }]} numberOfLines={1}>
                      {replyTo.text}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.replyBarMessage, { color: theme.text }]} numberOfLines={1}>
                  {replyTo.text}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyBarCloseButton}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Reply to Post bar (composer) — icon only, no image */}
        {replyPost && (
          <View style={[styles.replyBar, { backgroundColor: theme.cardBackground, borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <ReplyPostCard
              post={replyPost}
              color={theme.text}
              theme={theme}
              onPress={() => navigateToPostDetail(replyPost)}
            />
            <TouchableOpacity onPress={clearReplyPost} style={styles.replyBarCloseButton}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Composer */}
        <View style={[styles.composerContainer, { borderTopColor: theme.border, backgroundColor: theme.cardBackground }]}>
          {selectedImages.length > 0 && (
            <View style={styles.selectedImageRow}>
              {selectedImages.map((img) => (
                <View key={img.uri} style={styles.selectedImagePreviewContainer}>
                  <Image source={normalizeImageSource({ uri: img.uri })} style={styles.selectedImagePreview} />
                  <TouchableOpacity onPress={() => setSelectedImages(prev => prev.filter(i => i.uri !== img.uri))} style={styles.removeImageButton}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUploadStatus === 'uploading' && (
                <View style={styles.uploadStatusRow}>
                  <ActivityIndicator size="small" color={theme.accent} />
                  <Text style={[styles.uploadStatusText, { color: theme.textSecondary }]}>Uploading {imageUploadProgress}%</Text>
                </View>
              )}
              {imageUploadStatus === 'failed' && (
                <Text style={[styles.uploadErrorText, { color: '#d87428' }]}>Upload failed. Try again.</Text>
              )}
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={[styles.attachmentActions, attachmentsStacked && styles.attachmentActionsStack]}>
              <TouchableOpacity
                onPress={pickImage}
                style={[styles.attachButton, attachmentsStacked && styles.attachButtonStack, remainingImages <= 0 && { opacity: 0.4 }]}
              >
                <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={takePhoto}
                style={[styles.attachButton, attachmentsStacked && styles.attachButtonStack, remainingImages <= 0 && { opacity: 0.4 }]}
              >
                <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, height: inputHeight }]}
              placeholder={editingMessageId ? t.editMessage : selectedImages.length > 0 ? t.imageCaption : t.message}
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={onInputChange}
              maxLength={MAX_MESSAGE_CHARACTERS}
              onContentSizeChange={handleInputContentSizeChange}
              onSubmitEditing={handleSendPress}
              scrollEnabled={inputScrollable}
              multiline
            />

            {editingMessageId ? (
              <TouchableOpacity onPress={handleSendPress} style={[styles.sendBtn, { backgroundColor: '#ff9500' }]}>
                <Ionicons name="pencil" size={20} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSendPress}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: (inputText.trim() || selectedImages.some((img) => img.status === 'done' && img.uploadedUrl))
                      ? '#47ae87'
                      : theme.textSecondary,
                  },
                ]}
                disabled={imageUploadStatus === 'uploading' || (!inputText.trim() && !selectedImages.some((img) => img.status === 'done' && img.uploadedUrl))}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>
          {!!inputText.length && (
            <Text style={[styles.characterCounter, { color: theme.textSecondary }]}>
              {inputText.length}/{MAX_MESSAGE_CHARACTERS}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {renderActionModal()}
      {renderUpgradeModal()}

    </SafeAreaView>
  );
};

// ---------- Styles ----------
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loadingImage: { width: 110, height: 110 },
  loadingText: { marginTop: 12, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderBottomWidth: 0,
  },
  backBtn: { marginRight: 16 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  callBtn: { marginLeft: 12 },
  headerAvatarContainer: { position: 'relative', marginRight: 12 },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#47ae87',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  refreshButton: { padding: 8 },
  chatBackground: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  chatList: { flex: 1, backgroundColor: 'transparent' },
  chatListContent: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  timestampContainer: { alignItems: 'center', marginVertical: 16 },
  timestampText: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  messageRowWrapper: { flexDirection: 'row', marginBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarWrapper: { marginHorizontal: 4 },
  messageAvatar: { width: 30, height: 30, borderRadius: 15 },
  messageContentColumn: { flexDirection: 'column', maxWidth: '85%' },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  messageText: { fontSize: 13, lineHeight: 13 },
  messageImage: { width: 220, height: 180, borderRadius: 14, marginBottom: 4 },
  chatImageFallback: { backgroundColor: '#292929', alignItems: 'center', justifyContent: 'center' },
  imageCaption: { marginTop: 6 },

  multiImageWrapper: {
    width: CHAT_DECK_WIDTH,
    marginVertical: 4,
    alignItems: 'center',
  },
  chatDeckContainer: {
    width: CHAT_DECK_WIDTH,
    alignItems: 'center',
  },
  chatDeck: {
    width: CHAT_DECK_WIDTH,
    height: CHAT_DECK_CARD_HEIGHT + 22,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chatDeckGlow: {
    position: 'absolute',
    borderRadius: 999,
    shadowOpacity: 0.85,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  chatDeckCardPosition: {
    position: 'absolute',
    top: 0,
  },
  chatDeckCardTouch: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  chatDeckCardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  chatDeckSideOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  chatDeckProgressRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  chatDeckProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  chatDeckProgressFill: {
    height: '100%',
  },
  chatDeckCompletedProgress: {
    width: '100%',
  },

  editedBadge: { fontSize: 10, marginTop: 2, fontStyle: 'italic' },
  replyPreviewOutside: {
    padding: 6,
    paddingLeft: 10,
    marginBottom: 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  replyPostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 0,
    marginBottom: 4,
    minHeight: 60,
    backgroundColor: 'transparent',
    flex: 1,
  },
  replyPostThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  replyPostThumbIcon: {
    // background provided inline (theme-adaptive)
  },
  replyPostThumbFallback: {},
  replyPostInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  replyPostTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPostPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  replyPostRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 44 },
  replyPostCover: { width: 48, height: 48, borderRadius: 5, marginRight: 8 },
  replyPostDetails: { flex: 1, justifyContent: 'center', minWidth: 0 },
  replyName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  replyText: { fontSize: 12, fontStyle: 'italic' },
  replyImageContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  replyImageThumbnail: { width: 40, height: 40, borderRadius: 4 },
  audioButton: { flexDirection: 'row', alignItems: 'center' },
  videoMessageLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioDuration: { marginLeft: 8, fontSize: 14 },
  readReceiptContainer: { alignSelf: 'flex-end', marginTop: 0, position: 'absolute', bottom: -15, right: 0 },
  failedMessageAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  failedMessageText: { color: '#d87428', fontSize: 11 },
  pendingMessageText: { fontSize: 10 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  replyBarContent: { flex: 1 },
  replyBarText: { fontSize: 12 },
  replyBarMessage: { fontSize: 14, marginTop: 2 },
  replyBarImageContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  replyBarImage: { width: 30, height: 30, borderRadius: 4 },
  replyBarCloseButton: {
    paddingLeft: 12,
    paddingVertical: 4,
    paddingRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerContainer: { flexShrink: 0, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  characterCounter: { alignSelf: 'flex-end', marginTop: 4, fontSize: 11 },
  selectedImageRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  selectedImagePreviewContainer: { marginRight: 8 },
  selectedImagePreview: { width: 72, height: 72, borderRadius: 10 },
  uploadStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  uploadStatusText: { marginLeft: 8, fontSize: 12 },
  uploadErrorText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#d87428' },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8e8e93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  attachmentActionsStack: { flexDirection: 'column', justifyContent: 'center', marginRight: 8 },
  attachButton: { marginRight: 8, padding: 6, flexShrink: 0 },
  attachButtonStack: { marginRight: 0, marginBottom: 4 },
  input: { flex: 1, minWidth: 0, minHeight: INPUT_MIN_HEIGHT, maxHeight: INPUT_MAX_VISIBLE_HEIGHT, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16, lineHeight: INPUT_LINE_HEIGHT },
  sendBtn: { marginLeft: 8, borderRadius: 25, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  actionModalOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  actionModalContainer: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    minWidth: 120,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  actionOptionText: { fontSize: 16, marginLeft: 12 },
  typingBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  typingDot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 3 },
  modalOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_WIDTH * 0.85, borderRadius: 16, padding: 20, maxHeight: '70%', borderWidth: 0.5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  confirmButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  cancelButton: { borderWidth: 1, backgroundColor: 'transparent' },
  confirmYesButton: { borderWidth: 0 },
  confirmButtonText: { fontSize: 16, fontWeight: '600' },
  callBackground: { flex: 1 },
  callContainer: { flex: 1 },
  callHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  callHeaderBtn: { padding: 8 },
  callTitle: { fontSize: 18, fontWeight: '600' },
  callContent: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  callAvatar: { width: 200, height: 200, borderRadius: 100, marginBottom: 0 },
  callName: { fontSize: 38, fontWeight: '600', position: 'absolute', top: 0, zIndex: 2 },
  callStatus: { fontSize: 16, zIndex: 2, position: 'absolute', top: 50 },
  callControls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40, paddingBottom: 40 },
  callControlBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },
  endCallBtn: { backgroundColor: '#d87428' },
  waveContainer: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(76, 175, 80, 0.1)', zIndex: 2 },
  waveBar: { width: 6, backgroundColor: '#47ae87', borderRadius: 3, marginHorizontal: 2, opacity: 0.6 },
  callBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  callBarAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  callBarInfo: { flex: 1 },
  callBarName: { fontSize: 16, fontWeight: '600' },
  callBarStatus: { fontSize: 12 },
  callBarActions: { flexDirection: 'row', alignItems: 'center' },
  callBarEndBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d87428', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  callBarExpandBtn: { padding: 6 },
  imagePreviewOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  imagePreviewImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
  upgradeModalIconContainer: { alignItems: 'center', marginBottom: 12 },
  upgradeModalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  upgradeModalMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  upgradeModalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  upgradeModalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  upgradeModalCancelButton: { borderWidth: 1, backgroundColor: 'transparent' },
  upgradeModalUpgradeButton: { borderWidth: 0 },
  upgradeModalButtonText: { fontSize: 16, fontWeight: '600' },

  instaPostCard: {
    width: 250,
    overflow: 'hidden',
    marginBottom: 6,
  },
  instaPostImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  instaPostImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  instaPostTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
  },
  instaPostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  instaPostUsername: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reelsOverlayTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelsOverlayAmount: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelsOverlayLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  reelsOverlayLocation: {
    color: '#e0e0e0',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  reelsOverlayDescription: {
    color: '#e0e0e0',
    fontSize: 11,
    lineHeight: 15,
  },
});

export default ChatScreen;