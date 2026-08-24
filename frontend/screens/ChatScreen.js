
// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { useFocusEffect } from '@react-navigation/native';
import { io } from 'socket.io-client';
import { getRemainingUsage } from '../utils/subscriptionHelpers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_POLICY = {
  imagesPerMessage: 10,
  imagesRetentionDays: 5,
  messagesRetentionDays: 15,
};
const MESSAGES_KEY = '@user_messages';
const PENDING_KEY = '@pending_messages';
const DEFAULT_AVATAR = require('../assets/profile1.png');
const chatBackground = require('../assets/chartbackground.png');
const loadingLogo = require('../assets/logos.png');

// ---------- Translations ----------
const translations = {
  English: {
    loading: 'Please wait while loading the chat',
    online: 'Online',
    offline: 'Offline',
    typing: 'Typing...',
    
    reply: 'Reply',
    copy: 'Copy',
    edit: 'Edit',
    unsend: 'Unsend',
    cancel: 'Cancel',
    updated: 'Updated',
    copied: 'Copied',
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
    noMessagesYet: 'No messages yet',
    you: 'You',
    success: 'Success',
    ok: 'OK',
    successButton: 'Continue',
    yes: 'Yes',
    no: 'No',
    download: 'Download',
    imageCooldown: 'Image Cooldown',
    imageCooldownMessage: 'You can send only one image every 5 minutes. Please wait.',
    imageSaved: 'Image saved to gallery',
    imageSaveFailed: 'Failed to save image',
    close: 'Close',
    replyingToPost: 'Product',
    postNotAvailable: 'This post is no longer available.',
    // --- DAILY LIMIT ---
    imageLimitReachedTitle: 'Image limit reached',
    imageLimitReachedMessage: 'You have used all your image uploads for today.',
    upgrade: 'OK',
    upgradePrompt: 'You have reached your image limit. Please try again later.',
  },
  Kinyarwanda: {
    loading: 'Nyamuneka tegereza ubutumwa buze',
    online: 'Ari kumurongo',
    offline: 'Ntari kumurongo',
    typing: 'Arikwa wandika...',
    
    reply: 'Subiza',
    copy: 'Koracopi',
    edit: 'Hindura',
    unsend: 'Reka kohereza',
    cancel: 'Reka',
    updated: 'Byahinduwe',
    copied: 'Byakozwecopi',
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
    noMessagesYet: 'Nta butumwa',
    you: 'Wowe',
    success: 'Byakunze',
    ok: 'Sawa',
    successButton: 'Komeza',
    yes: 'Yego',
    no: 'Oya',
    download: 'Koporora',
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

// ---------- TypingIndicator ----------
const TypingIndicator = ({ theme, avatar }) => {
  const [dot1] = useState(new Animated.Value(0));
  const [dot2] = useState(new Animated.Value(0));
  const [dot3] = useState(new Animated.Value(0));

  const animateDot = (dot, delay) => {
    Animated.loop(
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
    ).start();
  };

  useEffect(() => {
    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  return (
    <View style={[styles.typingBubble, { backgroundColor: theme.cardBackground || '#e0e0e0' }]}>
      <Image source={avatar || DEFAULT_AVATAR} style={styles.typingAvatar} />
      <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

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
      if (original && original.imageUrl) {
        return { ...m, repliedTo: { ...m.repliedTo, imageUrl: original.imageUrl } };
      }
    }
    return m;
  });
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
  onImagePress,
  navigation,
  sellerId,
  sellerName,
  messageIndex,
  onReplyPostPress,
}) => {
  const isMe = isOwnMessage(item);
  const isReplied = item.repliedTo;
  const hasReplyPost = item.replyPost;
  const url = extractFirstURL(item.text);

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

  const handlePress = () => {
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
      singleTapTimerRef.current = setTimeout(() => {
        if (item.imageUrl) {
          onImagePress && onImagePress(item.imageUrl, messageIndex);
        } else if (url) {
          Linking.openURL(url);
        }
        singleTapTimerRef.current = null;
      }, 300);
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
              <Image source={avatarSource} style={styles.messageAvatar} />
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
                  backgroundColor: '#35353557',
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
                  <Image source={{ uri: item.repliedTo.imageUrl }} style={styles.replyImageThumbnail} />
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

          {/* ----- Reply to Post preview ----- */}
          {hasReplyPost && (
            <TouchableOpacity
              style={[
                styles.replyPreviewOutside,
                {
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  backgroundColor: theme.cardBackground,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 6,
                  borderRadius: 8,
                  marginBottom: 4,
                }
              ]}
              onPress={() => onReplyPostPress && onReplyPostPress(item.replyPost.postId)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.replyPost.image && (
                  <Image source={{ uri: item.replyPost.image }} style={{ width: 40, height: 40, borderRadius: 4, marginRight: 8 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyName, { color: theme.accent }]} numberOfLines={1}>
                    {t.replyingToPost}: {item.replyPost.title}
                  </Text>
                  {item.replyPost.location && (
                    <Text style={[styles.replyText, { color: theme.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                       {item.replyPost.location}
                    </Text>
                  )}
                  {item.replyPost.price && (
                    <Text style={[styles.replyText, { color: theme.accent, fontSize: 11, fontWeight: 'bold' }]}>
                      {item.replyPost.price} RWF
                    </Text>
                  )}
                  {item.replyPost.available === false && (
                    <Text style={[styles.replyText, { color: '#d87428', fontSize: 11 }]}>
                      {t.postNotAvailable}
                    </Text>
                  )}
                </View>
                <Ionicons name="arrow-forward-circle" size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            onLongPress={handleLongPress}
            style={[
              styles.messageBubble,
              {
                backgroundColor: bubbleBackground,
                borderBottomWidth: 2,
                borderBottomColor: borderBottomColor,
              },
            ]}
          >
            {item.imageUrl ? (
              <View>
                <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
                {item.text ? (
                  <Text style={[styles.messageText, styles.imageCaption, { color: textColor }]}>
                    {item.text}
                  </Text>
                ) : null}
              </View>
            ) : item.videoUrl ? (
              <View>
                <Text style={[styles.messageText, { color: textColor }]}>
                  {t.videoCall || 'Video'}
                </Text>
                <Text style={[styles.messageText, { color: '#007AFF', textDecorationLine: 'underline' }]}>
                  {item.videoUrl}
                </Text>
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
                {item.read ? (
                  <Ionicons name="checkmark-done" size={14} color={'gray'} />
                ) : (
                  <Ionicons name="checkmark-outline" size={14} color={'gray'} />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {isMe && (
          <View style={styles.avatarWrapper}>
            <Image source={avatarSource} style={styles.messageAvatar} />
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
    replyPost: initialReplyPost
  } = route.params;

  const effectivePostId = String(routePostId ?? route.params?.post ?? route.params?.listingId ?? '').trim();
  const postId = effectivePostId;
  const { theme } = useTheme();
  const t = translations[language] || translations.English;

  // ---------- State ----------
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadStatus, setImageUploadStatus] = useState('idle');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const soundRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [sellerAvatarUrl, setSellerAvatarUrl] = useState(sellerAvatar || null);
  const [replyPost, setReplyPost] = useState(null);

  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOnYes, setConfirmOnYes] = useState(null);

  const [isNearBottom, setIsNearBottom] = useState(true);

  // Daily limit state – remainingImages
  const [remainingImages, setRemainingImages] = useState(1);
  const [userImagesPerMessage, setUserImagesPerMessage] = useState(CHAT_POLICY.imagesPerMessage);

  // Upgrade modal state
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  const [typingPostId, setTypingPostId] = useState('');

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
  }, [postId, currentUser?.phone, sellerPhone]);

  useEffect(() => {
    if (initialReplyPost) {
      setReplyPost(initialReplyPost);
    }
  }, [initialReplyPost]);

  // ---------- Animations ----------
  useEffect(() => {
    if (loading) {
      Animated.loop(
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
      ).start();
    }
  }, [loading]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 50) {
          closeCarousel();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 50) {
          closeCarousel();
        }
      },
    })
  ).current;

  const setOnlineStatus = useCallback(async (online) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await axios.post(
        `${BASE_URL}/api/user/online`,
        { isOnline: online },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {}
  }, []);

  // ---------- Lifecycle ----------
  useEffect(() => {
    loadCurrentUser();
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, []);

  // ---------- Fetch user limits and usage ----------
  const fetchUserLimitsAndUsage = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
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

  // ---------- Helper: show upgrade modal ----------
  const showUpgradeModal = useCallback(() => {
    setUpgradeModalVisible(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalVisible(false);
  }, []);

  const handleUpgradePress = useCallback(() => {
    setUpgradeModalVisible(false);
  }, []);

  // ---------- Online status & avatar ----------
  const fetchSellerOnlineStatus = useCallback(async () => {
    if (isDemoChat || !sellerId) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
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
      const token = await AsyncStorage.getItem('userToken');
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
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const baseUrl = BASE_URL.replace('/api', '');
      const socket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token },
        autoConnect: true,
      });

      socketRef.current = socket;

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
      });

      socket.on('disconnect', () => {});
      socket.on('connect_error', () => {});
    } catch (e) {}
  }, [currentUser?._id, sellerId, isDemoChat]);

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
    if (!currentUser || isDemoChat || !sellerPhone || !typingPostId) {
      setOtherTyping(false);
      return;
    }

    let typingInterval, cancelled = false;
    const pollTyping = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;

        const currentUserPhone = String(currentUser.phone || '');
        const sellerPhoneNumber = String(sellerPhone || '');
        if (!currentUserPhone || !sellerPhoneNumber) {
          if (!cancelled) setOtherTyping(false);
          return;
        }

        const url = `${BASE_URL}/api/messages/typing/${encodeURIComponent(typingPostId)}/${encodeURIComponent(currentUserPhone)}/${encodeURIComponent(sellerPhoneNumber)}`;
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        const typing = !!res.data?.typing;
        const by = res.data?.by ?? null;
        const otherIsTyping = typing && String(by) !== String(currentUserPhone);

        if (!cancelled) setOtherTyping(otherIsTyping);
      } catch (e) {
        if (!cancelled) setOtherTyping(false);
      }
    };

    pollTyping();
    typingInterval = setInterval(pollTyping, 3000);
    return () => { cancelled = true; clearInterval(typingInterval); };
  }, [currentUser, sellerPhone, typingPostId, isDemoChat]);

  useEffect(() => {
    if (!currentUser) return;
    loadMessages();
    if (!isDemoChat) {
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser, isDemoChat]);

  // ---------- Load current user ----------
  const loadCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.warn('No token found; falling back to local user');
        throw new Error('No token');
      }
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Error loading user:', error);
      const sessionUser = await AsyncStorage.getItem('sessionUser');
      if (sessionUser) {
        const parsedUser = JSON.parse(sessionUser);
        setCurrentUser({
          ...parsedUser,
          _id: parsedUser._id || parsedUser.phone,
        });
      } else {
        const phone = await AsyncStorage.getItem('currentUser');
        setCurrentUser({
          _id: phone || '+250788123456',
          phone: phone || '+250788123456',
          username: 'You',
        });
      }
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

    if (showLoading) setRefreshing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
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
      }));

      const localMessages = await loadLocalMessages();
      const allMessages = [...messagesFromApi, ...localMessages];
      const sorted = allMessages
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .filter((msg, index, self) => self.findIndex(m => (m._id || m.id) === (msg._id || msg.id)) === index);

      const enhancedMessages = enhanceReplies(sorted);

      setMessages(enhancedMessages);
      setLoading(false);

      messagesFromApi.forEach((msg) => {
        if (msg.senderId === sellerId && !msg.read) {
          markAsRead(msg._id);
        }
      });

      processPendingMessages();
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert(t.networkError, `${t.couldNotLoad}\n${error.message}`);
      const localMessages = await loadLocalMessages();
      const enhancedLocal = enhanceReplies(localMessages);
      setMessages(enhancedLocal);
      setLoading(false);
    } finally {
      if (showLoading) setRefreshing(false);
    }
  };

  const loadLocalMessages = async () => {
    const stored = await AsyncStorage.getItem(MESSAGES_KEY);
    const allMessages = stored ? JSON.parse(stored) : [];
    const currentUserId = currentUser._id || currentUser.phone;
    const filtered = allMessages
      .filter(
        (msg) =>
          String(msg.postId) === String(postId) &&
          msg.postUser === sellerName &&
          (msg.senderId === sellerId ||
            msg.senderId === currentUserId ||
            msg.receiverId === sellerId ||
            msg.receiverId === currentUserId)
      )
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
          audioUrl: msg.audioUrl,
          audioDuration: msg.audioDuration,
          repliedTo: msg.repliedTo,
          createdAt: msg.timestamp,
          read: msg.read,
        }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const enhanced = enhanceReplies(demoMessages);
      setMessages(enhanced);
    } catch (error) {
      console.error('Error loading demo messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await axios.put(`${BASE_URL}/api/messages/read/${messageId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      console.error('Error marking as read:', error.response?.status, error.response?.data || error.message);
    }
  };

  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef({ isTyping: false, ts: 0 });

  const sendTyping = useCallback(async (isTyping) => {
    const fromPhone = currentUser?.phone;
    const toPhone = sellerPhone;
    if (!typingPostId || !fromPhone || !toPhone) {
      console.warn('sendTyping: missing typingPostId, fromPhone, or toPhone, skipping');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const now = Date.now();
      const last = lastTypingSentRef.current;
      if (last.isTyping === isTyping && now - last.ts < 1200) return;
      lastTypingSentRef.current = { isTyping, ts: now };

      await axios.post(
        `${BASE_URL}/api/messages/typing`,
        { postId: typingPostId, toUserId: toPhone, isTyping },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      if (e?.response?.status === 401) {
        console.warn('sendTyping: unauthorized (401)');
      } else {
        console.warn('sendTyping error:', e?.message || e);
      }
    }
  }, [typingPostId, sellerPhone, currentUser]);

  const onInputChange = useCallback((text) => {
    setInputText(text);
    if (typingPostId) {
      sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 1500);
    }
  }, [typingPostId, sendTyping]);

  const processPendingMessages = async () => {
    try {
      const pendingJson = await AsyncStorage.getItem(PENDING_KEY);
      if (!pendingJson) return;
      const pending = JSON.parse(pendingJson);
      if (pending.length === 0) return;

      const token = await AsyncStorage.getItem('userToken');
      const successful = [];
      for (const msg of pending) {
        try {
          const response = await axios.post(
            `${BASE_URL}/api/messages/send`,
            msg,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setMessages(prev => [...prev, response.data.message]);
          successful.push(msg.id);
        } catch (e) {
          console.warn('Pending message still failing', e);
        }
      }
      const remaining = pending.filter(msg => !successful.includes(msg.id));
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    } catch (error) {
      console.error('Error processing pending messages:', error);
    }
  };

  // ---------- Send message ----------
  const handleSendPress = async () => {
    if (editingMessageId) {
      await sendMessage(inputText, null, replyTo);
      return;
    }

    const hasUploadedImages = selectedImages.some((img) => img.status === 'done' && img.uploadedUrl);
    if (hasUploadedImages) {
      const caption = inputText.trim();
      const uploadedImages = selectedImages.filter((img) => img.status === 'done' && img.uploadedUrl);
      if (uploadedImages.length > userImagesPerMessage) {
        Alert.alert('Image limit', `You can attach up to ${userImagesPerMessage} images per message.`);
        return;
      }
      for (const image of uploadedImages) {
        await sendMessage(caption, image.uploadedUrl, replyTo);
      }
      return;
    }

    await sendMessage(inputText, null, replyTo);
  };

  const sendMessage = async (text, imageUrl = null, repliedTo = null) => {
    const cleanText = text?.trim() || '';
    if (!cleanText && !imageUrl) return;
    if (!currentUser) {
      Alert.alert(t.error, t.userNotLoaded);
      return;
    }

    if (editingMessageId) {
      await editMessage(editingMessageId, cleanText);
      setEditingMessageId(null);
      setInputText('');
      return;
    }

    if (isDemoChat) {
      await sendDemoMessage(cleanText, imageUrl, repliedTo);
      return;
    }

    const currentUserId = currentUser._id;
    if (!currentUserId || !sellerId) {
      Alert.alert(t.error, t.missingInfo);
      return;
    }

    const messageData = {
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
      imageUrl,
      repliedTo: repliedTo
        ? {
            messageId: repliedTo._id,
            text: repliedTo.text || '',
            imageUrl: repliedTo.imageUrl || null,
            senderName: repliedTo.senderName,
          }
        : null,
      replyPost: replyPost,
    };

    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      ...messageData,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, tempMessage]);
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${BASE_URL}/api/messages/send`,
        messageData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev =>
        prev.map(msg => (msg._id === tempId ? response.data.message : msg))
      );
      setInputText('');
      setSelectedImages([]);
      setReplyTo(null);
      setEditingMessageId(null);
      setReplyPost(null);
      if (imageUrl) {
        fetchUserLimitsAndUsage();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(t.sendFailed, `${t.couldNotSend}\n${error.message}`);
      const pending = await AsyncStorage.getItem(PENDING_KEY);
      const pendingList = pending ? JSON.parse(pending) : [];
      pendingList.push({ ...messageData, id: tempId });
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pendingList));
    }
  };

  const sendDemoMessage = async (text, imageUrl = null, repliedTo = null) => {
    try {
      const currentUserId = currentUser._id || currentUser.phone;
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
        repliedTo: repliedTo
          ? {
              messageId: repliedTo._id,
              text: repliedTo.text || '',
              imageUrl: repliedTo.imageUrl || null,
              senderName: repliedTo.senderName,
            }
          : null,
        replyPost: replyPost,
        timestamp: new Date().toISOString(),
        read: true,
      };
      await saveLocalMessage(message);
      setMessages(prev => [...prev, toChatMessage(message)]);
      setInputText('');
      setSelectedImages([]);
      setReplyTo(null);
      setEditingMessageId(null);
      setReplyPost(null);
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error('Error sending demo message:', error);
      Alert.alert(t.error, 'Failed to send message');
    }
  };

  // ---------- Edit & Unsend ----------
  const editMessage = async (messageId, newText) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.put(
        `${BASE_URL}/api/messages/edit/${messageId}`,
        { text: newText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages(prev =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...response.data.message, repliedTo: msg.repliedTo }
            : msg
        )
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

      setStatusModalTitle(t.updated);
      setStatusModalMessage(t.messageEdited);
      setStatusModalVisible(true);
    } catch (error) {
      console.error('Error editing message:', error);
      setStatusModalTitle(t.error);
      setStatusModalMessage(t.editFailed);
      setStatusModalVisible(true);
    }
  };

  const unsendMessage = async (messageId) => {
    setConfirmTitle(t.unsendTitle);
    setConfirmMessage(t.unsendMessage);
    setConfirmOnYes(() => async () => {
      setConfirmModalVisible(false);
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.delete(
          `${BASE_URL}/api/messages/${messageId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMessages(prev => prev.filter((msg) => msg._id !== messageId));
        setStatusModalTitle(t.success);
        setStatusModalMessage(t.unsendSuccess);
        setStatusModalVisible(true);
      } catch (error) {
        console.error('Error unsending message:', error);
        let message = t.unsendFailed;
        if (error.response?.status === 400) {
          message = t.unsendTooOld;
        }
        setStatusModalTitle(t.error);
        setStatusModalMessage(message);
        setStatusModalVisible(true);
      }
    });
    setConfirmModalVisible(true);
  };

  // ---------- Image picker (with daily limit check & upgrade modal) ----------
  const uploadImages = async (assets) => {
    if (!assets || assets.length === 0) return;

    // Cooldown logic
    try {
      const lastImageSendKey = `lastImageSend_${currentUser?._id || 'default'}`;
      const lastSend = await AsyncStorage.getItem(lastImageSendKey);
      const now = Date.now();
      if (lastSend) {
        const elapsed = (now - parseInt(lastSend)) / 6;
        if (elapsed < 5) {
          Alert.alert(t.imageCooldown, t.imageCooldownMessage);
          return;
        }
      }
    } catch (e) {
      console.warn('Cooldown check failed:', e);
    }

    if (assets.length > userImagesPerMessage) {
      Alert.alert('Image limit', `You can attach up to ${userImagesPerMessage} images per message.`);
      return;
    }

    // Daily limit check removed - images are allowed without daily limit restriction

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert(t.authRequired, t.pleaseLogin);
        return;
      }

      // Prepare files
      const files = assets.map((asset) => {
        const filename = asset.fileName || asset.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        return {
          uri: asset.uri,
          name: filename,
          type,
        };
      });

      if (files.length > userImagesPerMessage) {
        throw new Error(`You can upload up to ${userImagesPerMessage} images per message.`);
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

      const urls = response.data.urls || [];
      if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error('Upload did not return image URLs');
      }

      // Success – update selected images with uploaded URLs
      setSelectedImages(files.map((file, index) => ({
        ...file,
        status: 'done',
        uploadedUrl: urls[index],
      })));
      setImageUploadProgress(100);
      setImageUploadStatus('done');

      // Refresh limits after a successful upload in case active image counts changed.
      fetchUserLimitsAndUsage();

      // Update last send time (cooldown)
      const lastImageSendKey = `lastImageSend_${currentUser?._id || 'default'}`;
      await AsyncStorage.setItem(lastImageSendKey, String(Date.now()));

    } catch (error) {
      console.error('Image upload error:', error);

      // Extract server error message if available
      let errorMessage = t.unableToUpload;
      if (error.response) {
        const status = error.response.status;
        const serverMsg = error.response.data?.message || error.response.data?.error || '';
        if (status === 500) {
          errorMessage = 'Internal server error. Please try again later.';
        } else if (status === 400) {
          errorMessage = serverMsg || 'Invalid request. Please check your image.';
        } else if (status === 403 || status === 401) {
          errorMessage = 'Authentication error. Please log in again.';
        } else if (status === 413) {
          errorMessage = 'Image too large. Please choose a smaller image.';
        } else {
          errorMessage = serverMsg || t.unableToUpload;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Check your network.';
      }

      Alert.alert(t.uploadFailed, errorMessage);
      setImageUploadStatus('failed');
      // Optionally, you can reset the selected images so the user can try again
      // setSelectedImages([]);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: userImagesPerMessage,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        uploadImages(result.assets);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to choose image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access.');
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
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  // ---------- Audio player ----------
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
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Failed to play audio', error);
    }
  }, [playingAudioId]);

  // ---------- Helper functions ----------
  const isOwnMessage = useCallback((message) => {
    const userId = currentUser?._id || currentUser?.phone;
    return message.senderId === userId;
  }, [currentUser]);

  const formatDuration = useCallback((seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  }, []);

  const toChatMessage = (msg) => ({
    _id: msg.id || msg._id,
    senderId: msg.senderId || msg.senderPhone,
    senderName: msg.senderName,
    senderAvatar: msg.senderAvatar,
    text: msg.text,
    imageUrl: msg.imageUrl,
    audioUrl: msg.audioUrl,
    audioDuration: msg.audioDuration,
    repliedTo: msg.repliedTo,
    replyPost: msg.replyPost,
    createdAt: msg.timestamp || msg.createdAt,
    read: msg.read,
  });

  const saveLocalMessage = async (message) => {
    const stored = await AsyncStorage.getItem(MESSAGES_KEY);
    const allMessages = stored ? JSON.parse(stored) : [];
    await AsyncStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify([...allMessages, message])
    );
  };

  const shouldShowTimestamp = useCallback((currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentTime = new Date(currentMsg.createdAt).getTime();
    const prevTime = new Date(prevMsg.createdAt).getTime();
    return (currentTime - prevTime) / (1000 * 60) > 30;
  }, []);

  // ---------- Action sheet ----------
  const handleDoubleTap = useCallback((message) => {
    setActionMessage(message);
    setActionModalVisible(true);
  }, []);

  const downloadImage = async (imageUrl) => {
    try {
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('No image URL available');
      }

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to save images.');
        return;
      }

      const url = new URL(imageUrl);
      const filenameFromUrl = url.pathname.split('/').pop() || 'shaaka-chat-image.jpg';
      const extension = filenameFromUrl.includes('.') ? filenameFromUrl.split('.').pop() : 'jpg';
      const filename = `${Date.now()}_${filenameFromUrl.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'chat_image'}.${extension}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (downloadResult.status !== 200 || !downloadResult.uri) {
        throw new Error('Download failed');
      }

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      const albumName = 'Chat Images';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album.id, false);
      }

      setStatusModalTitle(t.success);
      setStatusModalMessage(t.imageSaved);
      setStatusModalVisible(true);
    } catch (error) {
      console.error('Download error:', error);
      setStatusModalTitle(t.error);
      setStatusModalMessage(t.imageSaveFailed);
      setStatusModalVisible(true);
    }
  };

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
        setStatusModalTitle(t.copied);
        setStatusModalMessage(t.copied);
        setStatusModalVisible(true);
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
      case 'download':
        if (msg.imageUrl) {
          downloadImage(msg.imageUrl);
          setActionModalVisible(false);
        }
        break;
      default:
        break;
    }
  }, [actionMessage, t]);

  // ---------- Image carousel ----------
  const handleImagePress = useCallback((url, index) => {
    const images = messages.filter(m => m.imageUrl).map(m => m.imageUrl);
    const idx = images.indexOf(url);
    if (idx !== -1) {
      setCarouselImages(images);
      setCarouselIndex(idx);
      setCarouselVisible(true);
    }
  }, [messages]);

  const closeCarousel = () => {
    setCarouselVisible(false);
    setCarouselImages([]);
    setCarouselIndex(0);
  };

  const renderCarouselItem = ({ item }) => (
    <View style={{ width: SCREEN_WIDTH * 0.9, height: SCREEN_HEIGHT * 0.7, justifyContent: 'center', alignItems: 'center' }}>
      <Image source={{ uri: item }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
    </View>
  );

  // ---------- Modals ----------
  const renderConfirmModal = () => {
    return (
      <Modal
        transparent
        visible={confirmModalVisible}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.action }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{confirmTitle}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{confirmMessage}</Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={[styles.confirmButtonText, { color: theme.textSecondary }]}>{t.no}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmYesButton, { backgroundColor: theme.accent }]}
                onPress={confirmOnYes}
              >
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>{t.yes}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderActionModal = () => {
    if (!actionMessage) return null;
    const isOwn = isOwnMessage(actionMessage);
    const now = new Date();
    const msgTime = new Date(actionMessage.createdAt);
    const ageSeconds = (now - msgTime) / 1000;
    const hasReplies = messages.some(m => m.repliedTo && m.repliedTo.messageId === actionMessage._id);
    const canEdit = isOwn && !actionMessage.audioUrl && !actionMessage.imageUrl && ageSeconds < 50 && !hasReplies;
    const canUnsend = isOwn && ageSeconds < 360;
    const canDownload = !!actionMessage.imageUrl;

    return (
      <Modal transparent visible={actionModalVisible} animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <TouchableOpacity
          style={[
            styles.actionModalOverlay,
            { backgroundColor: theme.call }
          ]}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <View style={[styles.actionModalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('reply')}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
              <Text style={[styles.actionOptionText, { color: theme.text }]}>{t.reply}</Text>
            </TouchableOpacity>
            {!canDownload && (
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
            {canDownload && (
              <TouchableOpacity style={styles.actionOption} onPress={() => handleAction('download')}>
                <Ionicons name="download-outline" size={20} color={theme.text} />
                <Text style={[styles.actionOptionText, { color: theme.text }]}>{t.download}</Text>
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

  const renderStatusModal = () => {
    return (
      <Modal
        transparent
        visible={statusModalVisible}
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{statusModalTitle}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{statusModalMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.accent }]}
              onPress={() => setStatusModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>{t.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ---------- Render upgrade modal ----------
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

  // ---------- Navigate to PostDetail ----------
  const navigateToPostDetail = (postId) => {
    if (!postId) return;
    navigation.navigate('PostDetail', { postId });
  };

  // ---------- RenderItem ----------
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
          onImagePress={handleImagePress}
          navigation={navigation}
          sellerId={sellerId}
          sellerName={sellerName}
          messageIndex={index}
          onReplyPostPress={navigateToPostDetail}
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
    handleImagePress,
    navigation,
    sellerId,
    sellerName,
    navigateToPostDetail
  ]);

  // ---------- Auto‑scroll ----------
  useEffect(() => {
    if (!loading && messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [loading]);

  const handleContentSizeChange = () => {
    scrollToBottom(true);
  };

  const handleScroll = (event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const bottomOffset = contentSize.height - layoutMeasurement.height;
    const threshold = 50;
    const isNear = bottomOffset - contentOffset.y < threshold;
    setIsNearBottom(isNear);
  };

  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && isNearBottom) {
      flatListRef.current.scrollToEnd({ animated });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top','left','right']}>
        <View style={styles.center}>
          <Animated.Image
            source={loadingLogo}
            style={[styles.loadingImage, { transform: [{ scale: scaleAnim }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
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
              <Image source={sellerAvatarSource} style={styles.headerAvatarImage} />
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
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                  {isOnline ? t.online : t.offline}
                </Text>
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
          source={chatBackground}
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
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={20}
            updateCellsBatchingPeriod={50}
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
                  <Image source={{ uri: replyTo.imageUrl }} style={styles.replyBarImage} />
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
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Reply to Post bar */}
        {replyPost && (
          <View style={[styles.replyBar, { backgroundColor: theme.cardBackground, borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <View style={styles.replyBarContent}>
              <Text style={[styles.replyBarText, { color: theme.textSecondary }]}>
                {t.replyingToPost}
              </Text>
              <TouchableOpacity
                onPress={() => navigateToPostDetail(replyPost.postId)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
              >
                {replyPost.image && (
                  <Image source={{ uri: replyPost.image }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 8 }} />
                )}
                <Text style={[styles.replyBarMessage, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                  {replyPost.title}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              {replyPost.description && (
                <Text style={[styles.replyBarMessage, { color: theme.textSecondary, fontSize: 12 }]} numberOfLines={1}>
                  {replyPost.description}
                </Text>
              )}
              {replyPost.price && (
                <Text style={[styles.replyBarMessage, { color: theme.accent, fontSize: 12, fontWeight: 'bold' }]}>
                  {replyPost.price} RWF
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setReplyPost(null)}>
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
                  <Image source={{ uri: img.uri }} style={styles.selectedImagePreview} />
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
            {/* Image buttons – disabled when limit reached */}
            <TouchableOpacity
              onPress={pickImage}
              style={[styles.attachButton, remainingImages <= 0 && { opacity: 0.4 }]}
            >
              <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              style={[styles.attachButton, remainingImages <= 0 && { opacity: 0.4 }]}
            >
              <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={editingMessageId ? t.editMessage : selectedImages.length > 0 ? t.imageCaption : t.message}
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={onInputChange}
              onSubmitEditing={handleSendPress}
              multiline
            />

            {editingMessageId ? (
              <TouchableOpacity onPress={() => sendMessage(inputText, null, replyTo)} style={[styles.sendBtn, { backgroundColor: '#ff9500' }]}>
                <Ionicons name="pencil" size={20} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSendPress}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: (inputText.trim() || selectedImages.some((img) => img.status === 'done' && img.uploadedUrl))
                      ? '#00bc38'
                      : theme.textSecondary,
                  },
                ]}
                disabled={imageUploadStatus === 'uploading' || (!inputText.trim() && !selectedImages.some((img) => img.status === 'done' && img.uploadedUrl))}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {renderActionModal()}
      {renderStatusModal()}
      {renderConfirmModal()}
      {renderUpgradeModal()}

      <Modal
        visible={carouselVisible}
        transparent
        onRequestClose={closeCarousel}
        animationType="fade"
      >
        <View style={[styles.carouselOverlay, { backgroundColor: theme.image }]}>
          <TouchableOpacity
            style={styles.carouselBackground}
            activeOpacity={1}
            onPress={closeCarousel}
            {...imagePanResponder.panHandlers}
          />
          <View style={styles.carouselImageContainer}>
            <FlatList
              data={carouselImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={renderCarouselItem}
              initialScrollIndex={carouselIndex}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH * 0.9,
                offset: SCREEN_WIDTH * 0.9 * index,
                index,
              })}
              onScrollToIndexFailed={() => {}}
              style={{ width: SCREEN_WIDTH * 0.9, height: SCREEN_HEIGHT * 0.7 }}
              contentContainerStyle={{ alignItems: 'center', justifyContent: 'center' }}
              onScroll={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const page = Math.round(offsetX / (SCREEN_WIDTH * 0.9));
                setCarouselIndex(page);
              }}
              scrollEventThrottle={200}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.carouselClose,
              {
                color: theme.more,
                padding: 8,
                borderRadius: 20,
                position: 'absolute',
                top: 40,
                right: 20,
              },
            ]}
            onPress={closeCarousel}
          >
            <Ionicons name="close" size={32} color={theme.more} />
          </TouchableOpacity>
          <Text style={[styles.carouselCounter, { color: theme.more }]}>
            {carouselIndex + 1} / {carouselImages.length}
          </Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingImage: { width: 150, height: 150 },
  loadingText: { marginTop: 12, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  chatListContent: { padding: 16, paddingBottom: 20 },
  timestampContainer: { alignItems: 'center', marginVertical: 16 },
  timestampText: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  messageRowWrapper: { flexDirection: 'row', marginBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarWrapper: { marginHorizontal: 4 },
  messageAvatar: { width: 30, height: 30, borderRadius: 15 },
  messageContentColumn: { flexDirection: 'column', maxWidth: '85%' },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  messageText: { fontSize: 18, lineHeight: 20 },
  messageImage: { width: 220, height: 180, borderRadius: 14, marginBottom: 4 },
  imageCaption: { marginTop: 6 },
  editedBadge: { fontSize: 10, marginTop: 2, fontStyle: 'italic' },
  replyPreviewOutside: { padding: 6, paddingLeft: 10, marginBottom: 4, borderRadius: 8 },
  replyName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  replyText: { fontSize: 12, fontStyle: 'italic' },
  replyImageContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  replyImageThumbnail: { width: 40, height: 40, borderRadius: 4 },
  audioButton: { flexDirection: 'row', alignItems: 'center' },
  audioDuration: { marginLeft: 8, fontSize: 14 },
  readReceiptContainer: { alignSelf: 'flex-end', marginTop: 0, position: 'absolute', bottom: -15, right: 0 },
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
  composerContainer: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  selectedImageRow: { alignSelf: 'flex-start', marginBottom: 8 },
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
  attachButton: { marginRight: 8, padding: 6 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16, maxHeight: 100 },
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
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#727272', marginHorizontal: 3 },
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
  carouselOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  carouselBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  carouselImageContainer: { width: SCREEN_WIDTH * 0.9, height: SCREEN_HEIGHT * 0.7, justifyContent: 'center', alignItems: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: 'transparent' },
  carouselClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  carouselCounter: { position: 'absolute', bottom: 20, alignSelf: 'center', fontSize: 16, fontWeight: '600' },
  imagePreviewOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  imagePreviewImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
  upgradeModalIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  upgradeModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  upgradeModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  upgradeModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeModalCancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  upgradeModalUpgradeButton: {
    borderWidth: 0,
  },
  upgradeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatScreen;