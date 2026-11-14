import { getAuthToken } from '../utils/authStorage';


// screens/MessageScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
  RefreshControl,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Linking,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { io } from 'socket.io-client';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { isReelsActive } from '../services/reelActivity';
import { logDebug, warnDebug } from '../utils/debugLogger';
import { showAdminFeedback } from '../utils/adminFeedback';
import { useContactInfo, useContactLinks } from '../services/contactInfo';
import ContactInfoIcon from '../components/ContactInfoIcon';
import { normalizeImageSource } from '../utils/imageUrl';
import { networkStatus } from '../services/networkStatus';
import { offlineDatabase } from '../services/offlineDatabase';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_AVATAR = require('../assets/profile1.png');
const loadingLogo = require('../assets/logos.png');
const MessageBackground = require('../assets/message.png');

const getConversationTimestamp = (conversation) => {
  const timestamp = new Date(conversation?.lastMessage?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const deduplicateConversationsByUser = (conversations) => {
  const groups = new Set();
  const groupByIdentifier = new Map();

  conversations.forEach((conversation) => {
    if (!conversation?.lastMessage) return;
    const identifiers = [conversation.otherUserId, conversation.otherUserPhone]
      .filter(Boolean)
      .map(identifier => String(identifier).trim().toLowerCase())
      .filter(Boolean);
    if (identifiers.length === 0) return;

    const matchingGroups = new Set(
      identifiers.map(identifier => groupByIdentifier.get(identifier)).filter(Boolean)
    );
    let group = matchingGroups.values().next().value;
    if (!group) {
      group = { conversation, identifiers: new Set() };
      groups.add(group);
    } else {
      if (getConversationTimestamp(conversation) > getConversationTimestamp(group.conversation)) {
        group.conversation = conversation;
      }
      matchingGroups.forEach((matchingGroup) => {
        if (matchingGroup === group) return;
        if (getConversationTimestamp(matchingGroup.conversation) > getConversationTimestamp(group.conversation)) {
          group.conversation = matchingGroup.conversation;
        }
        matchingGroup.identifiers.forEach(identifier => group.identifiers.add(identifier));
        groups.delete(matchingGroup);
      });
    }

    identifiers.forEach(identifier => group.identifiers.add(identifier));
    group.identifiers.forEach(identifier => groupByIdentifier.set(identifier, group));
  });

  return Array.from(groups, group => group.conversation)
    .sort((a, b) => (
      getConversationTimestamp(b) - getConversationTimestamp(a)
      || String(a.conversationId || '').localeCompare(String(b.conversationId || ''))
    ));
};

// ---------- Translations ----------
const translations = {
  English: {
    messages: 'Messages',
    search: 'Search',
    loginPromptTitle: 'Messages',
    loginPromptText: 'Log in to see your messages',
    login: 'Log In',
    cancel: 'Cancel',
    loading: 'Getting things ready...',
    ok: 'OK',
    success: 'Success',
    updates: 'Updates',
    noUpdates: 'No updates available',
    conversationsUnavailable: 'Could not load conversations. Pull to refresh when you are back online.',
    noConversations: 'No conversations yet',
    followUs: 'Follow us on social media',
    typing: 'Typing...',
    youPrefix: 'You: ',
    photo: 'Photo',
    video: 'Video',
    voiceMessage: 'Voice message',
  },
  Kinyarwanda: {
    messages: 'Ubutumwa',
    search: 'Shakisha',
    loginPromptTitle: 'Ubutumwa',
    loginPromptText: 'Injira kugira ngo ubone ubutumwa',
    login: 'Kwinjira',
    cancel: 'Reka',
    loading: 'Turigutunganya page neza...',
    ok: 'Sawa',
    success: 'Byakunze',
    updates: 'Amakuru mashya',
    noUpdates: 'Nta makuru mashya ahari',
    conversationsUnavailable: 'Ntibyashobotse kubona ibiganiro. Ongera ugerageze umaze kongera kubona interineti.',
    noConversations: 'Nta biganiro birahari',
    followUs: 'Twandikire ku mbuga nkoranyambaga',
    typing: 'Arikwandika...',
    youPrefix: 'Wowe: ',
    photo: 'Ifoto',
    video: 'Videwo',
    voiceMessage: "Ubutumwa bw'amajwi",
  },
};

// ---------- UpdateItem with numeric badge and re-appearing logic ----------
const UpdateItem = React.memo(({ update, onPress, theme }) => {
  const title = update.title || update.text?.split('\n')[0] || 'Note';
  const iconName = update.link ? 'link-outline' : 'notifications-outline';

  const shouldShowUnread = useCallback(() => {
    if (!update.lastViewedAt) {
      return true;
    }

    const lastViewedDate = new Date(update.lastViewedAt);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - lastViewedDate.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    return hoursDiff >= 24;
  }, [update.lastViewedAt]);

  const isUnread = shouldShowUnread();
  const unreadCount = isUnread ? 1 : 0;

  return (
    <TouchableOpacity
      style={styles.updateItem}
      onPress={() => onPress(update)}
      activeOpacity={0.9}
    >
      <View style={[styles.updateCircleRing, { borderColor: '#8e8e93' }]}>
        <View style={[styles.updateCircleAvatar, { backgroundColor: theme.accent }]}>
          <Ionicons name={iconName} size={24} color="#fff" />
        </View>
        {unreadCount > 0 && (
          <View style={styles.updateUnreadBadgeNumber}>
            <Text style={styles.updateUnreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.updateLabel, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
});

// ---------- Updates Row ----------
const UpdatesRow = React.memo(({ updates, onUpdatePress, theme }) => {
  if (!updates || updates.length === 0) {
    return (
      <View style={styles.noUpdatesContainer}>
        <Text style={[styles.noUpdatesText, { color: theme.textSecondary }]}>
          {translations[theme.language]?.noUpdates || 'No updates available'}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.updatesSection}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={updates}
        keyExtractor={(item, index) => String(item._id || item.id || `update-${index}`)}
        renderItem={({ item }) => (
          <UpdateItem update={item} onPress={onUpdatePress} theme={theme} />
        )}
        contentContainerStyle={styles.updatesScroll}
      />
    </View>
  );
});

// ---------- Conversation Row ----------
const ConversationRow = React.forwardRef(({ conversation, onPress, theme, currentUserId, isOnline, isTyping, t }, ref) => {
  const lastMsg = conversation.lastMessage;
  const isSentByMe = String(lastMsg?.senderId || '') === String(currentUserId || '');
  const messageDate = lastMsg?.createdAt ? new Date(lastMsg.createdAt) : null;

  const typingLabel = t?.typing || 'Typing...';
  const youPrefix = t?.youPrefix || 'You: ';

  let displayMessage;
  if (isTyping) {
    displayMessage = typingLabel;
  } else {
    displayMessage = lastMsg?.text
      || (lastMsg?.imageUrl || lastMsg?.imageUrls?.length ? t?.photo : '')
      || (lastMsg?.videoUrl ? t?.video : '')
      || (lastMsg?.audioUrl ? t?.voiceMessage : '');
  }

  return (
    <TouchableOpacity
      ref={ref}
      style={[styles.conversationRow, { backgroundColor: theme.buttons }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={normalizeImageSource(conversation.otherUserAvatar
              ? { uri: conversation.otherUserAvatar }
              : DEFAULT_AVATAR)}
          style={styles.avatarImage}
        />
        {isOnline && <View style={styles.onlineDot} />}
        {(conversation.unreadCount || 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.messageContent}>
        <View style={styles.topRow}>
          <Text style={[styles.username, { color: theme.text }]}>
            {conversation.otherUserName || 'User'}
          </Text>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {messageDate && !Number.isNaN(messageDate.getTime())
              ? messageDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.lastMessage,
              {
                color: isTyping ? theme.accent : (isSentByMe ? theme.textSecondary : theme.text),
                fontStyle: isTyping ? 'italic' : 'normal',
                fontWeight: isTyping ? '600' : 'normal',
              },
            ]}
            numberOfLines={1}
          >
            {isTyping
              ? displayMessage
              : `${isSentByMe ? youPrefix : ''}${displayMessage}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ---------- Main Screen ----------
const MessageScreen = ({ navigation, language, adminMode = false }) => {
  const { theme, isDarkMode } = useTheme();
  const contactInfo = useContactInfo();
  const socialLinks = useContactLinks(contactInfo);
  const t = translations[language] || translations.English;

  const DETAIL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => (
      [
        conversation.otherUserName,
        conversation.postTitle,
        conversation.lastMessage?.text,
      ].some(value => String(value || '').toLocaleLowerCase().includes(query))
    ));
  }, [conversations, searchQuery]);

  // Auto-clear timers for typing indicators (per user)
  const typingClearTimersRef = useRef({});

  const [notes, setNotes] = useState([]);

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const detailSheetAnim = useRef(new Animated.Value(DETAIL_SHEET_HEIGHT)).current;
  const [selectedNote, setSelectedNote] = useState(null);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  // ---------- Auto‑refresh interval ----------
  const autoRefreshInterval = useRef(null);
  const isFetchingRef = useRef(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let animation;
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      animation.start();
    }
    return () => animation?.stop();
  }, [loading, scaleAnim]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    let animation;
    if (refreshing) {
      animation = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      );
      animation.start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
    return () => animation?.stop();
  }, [refreshing, spinAnim]);

  const getToken = useCallback(async () => adminMode
    ? getAuthToken('adminToken')
    : getAuthToken('userToken'), [adminMode]);

  const getConversationCacheKey = useCallback(async () => {
    let user = currentUser;
    if (!user) {
      try {
        const storedUser = await AsyncStorage.getItem('sessionUser') || await AsyncStorage.getItem('user');
        user = storedUser ? JSON.parse(storedUser) : null;
      } catch (error) {
        console.warn('Could not read the cached message account:', error.message);
      }
    }
    const userId = user?._id || user?.id || user?.userId || user?.phone;
    return userId ? `${adminMode ? 'admin' : 'user'}:${String(userId)}` : null;
  }, [adminMode, currentUser]);

  // ---------- Fetch online statuses ----------
  const fetchOnlineStatuses = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return;
    try {
      if (!(await networkStatus.start()).isOnline) return;
      const token = await getToken();
      if (!token) return;
      const response = await axios.post(
        `${BASE_URL}/api/user/batch-online`,
        { userIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        const statuses = response.data.statuses || {};
        setOnlineUsers(previous => {
          const next = { ...previous };
          Object.entries(statuses).forEach(([uid, status]) => {
            next[uid] = status === true;
          });
          return next;
        });
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        warnDebug('Failed to fetch online statuses:', error.message);
      }
    }
  }, [getToken]);

  // ---------- Socket presence ----------
  const connectPresenceSocket = useCallback(async () => {
    if (!isLoggedIn || !currentUser?._id) return;
    if (socketRef.current) return;

    const token = await getToken();
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
      logDebug('[MsgScreen Socket] connected', socket.id);
    });

    socket.on('reconnect', () => {
      logDebug('[MsgScreen Socket] reconnected');
    });

    socket.on('user-online', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers((prev) => ({ ...prev, [String(uid)]: true }));
    });

    socket.on('user-offline', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers((prev) => ({ ...prev, [String(uid)]: false }));
    });

    const handleTyping = (payload, eventName) => {
      logDebug('[MsgScreen Socket] typing event:', eventName, payload);

      const uid = String(
        payload?.senderId ?? payload?.userId ?? payload?.from ?? payload?.sender ?? ''
      );
      if (!uid) return;

      if (String(currentUser?._id) === uid) return;

      let isTyping;
      if (typeof payload?.typing === 'boolean') isTyping = payload.typing;
      else if (typeof payload?.isTyping === 'boolean') isTyping = payload.isTyping;
      else if (eventName === 'user-stop-typing') isTyping = false;
      else if (eventName === 'user-typing') isTyping = true;
      else return;

      if (typingClearTimersRef.current[uid]) {
        clearTimeout(typingClearTimersRef.current[uid]);
        typingClearTimersRef.current[uid] = null;
      }

      if (isTyping) {
        setTypingUsers((prev) => ({ ...prev, [uid]: true }));
        typingClearTimersRef.current[uid] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
          typingClearTimersRef.current[uid] = null;
        }, 4000);
      } else {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      }
    };

    socket.on('user-typing', (payload) => handleTyping(payload, 'user-typing'));
    socket.on('user-stop-typing', (payload) => handleTyping(payload, 'user-stop-typing'));

    socket.on('disconnect', (reason) => {
      logDebug('[MsgScreen Socket] disconnected:', reason);
      setTypingUsers({});
    });

    socket.on('connect_error', (err) => {
      logDebug('[MsgScreen Socket] connect_error:', err?.message);
    });
  }, [getToken, isLoggedIn, currentUser]);

  useEffect(() => {
    connectPresenceSocket();
    return () => {
      Object.values(typingClearTimersRef.current || {}).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      typingClearTimersRef.current = {};

      if (socketRef.current) {
        try {
          socketRef.current.off('user-typing');
          socketRef.current.off('user-stop-typing');
          socketRef.current.disconnect();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [connectPresenceSocket]);

  // ---------- Load viewed timestamps ----------
  const loadViewedTimestamps = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('updateViewedTimestamps');
      if (stored) {
        return JSON.parse(stored);
      }
      return {};
    } catch (error) {
      console.error('Error loading viewed timestamps:', error);
      return {};
    }
  }, []);

  // ---------- Save viewed timestamp ----------
  const saveViewedTimestamp = useCallback(async (updateId) => {
    try {
      const timestamps = await loadViewedTimestamps();
      timestamps[updateId] = new Date().toISOString();
      await AsyncStorage.setItem('updateViewedTimestamps', JSON.stringify(timestamps));
    } catch (error) {
      console.error('Error saving viewed timestamp:', error);
    }
  }, [loadViewedTimestamps]);

  // ---------- Fetch notes ----------
  const fetchNotes = useCallback(async () => {
    try {
      if (!(await networkStatus.start()).isOnline) return [];
      const response = await axios.get(`${BASE_URL}/api/notes`);
      if (response.data.success) {
        const viewedTimestamps = await loadViewedTimestamps();
        const formatted = (response.data.notes || []).map(note => ({
          _id: note._id,
          id: note._id,
          text: note.text,
          title: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
          fullDetails: note.text,
          link: note.link || '',
          createdAt: note.createdAt,
          type: 'admin_note',
          isRead: note.isRead || false,
          lastViewedAt: viewedTimestamps[note._id] || null,
        }));
        return formatted;
      }
      return [];
    } catch (error) {
      console.error('❌ Notes fetch failed:', error.message);
      return [];
    }
  }, [loadViewedTimestamps]);

  // ---------- Fetch conversations ----------
  const fetchConversations = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setFetchError(t.conversationsUnavailable);
        setLoading(false);
        return;
      }
      const cacheKey = await getConversationCacheKey();
      if (!(await networkStatus.start()).isOnline) {
        const cached = cacheKey ? await offlineDatabase.getRecord('conversations', cacheKey) : null;
        if (Array.isArray(cached)) {
          const unique = deduplicateConversationsByUser(cached);
          setConversations(unique);
          setFetchError(unique.length ? null : t.conversationsUnavailable);
        } else {
          setFetchError(t.conversationsUnavailable);
        }
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.data?.success || !Array.isArray(response.data.conversations)) {
        throw new Error('The conversations response was not successful or had an invalid format');
      }

      const unique = deduplicateConversationsByUser(response.data.conversations);
      setConversations(unique);
      setFetchError(null);
      if (cacheKey) {
        try {
          await offlineDatabase.putRecord('conversations', cacheKey, unique, { priority: 'high' });
        } catch (cacheError) {
          console.warn('Could not cache message conversations:', cacheError.message);
        }
      }

      const userIds = [...new Set(unique.map(c => c.otherUserId).filter(Boolean))];
      if (userIds.length > 0) {
        await fetchOnlineStatuses(userIds);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      try {
        const cacheKey = await getConversationCacheKey();
        const cached = cacheKey ? await offlineDatabase.getRecord('conversations', cacheKey) : null;
        if (Array.isArray(cached)) {
          setConversations(deduplicateConversationsByUser(cached));
        }
      } catch (cacheError) {
        console.warn('Could not read cached message conversations:', cacheError.message);
      }
      setFetchError(t.conversationsUnavailable);
    } finally {
      setLoading(false);
    }
  }, [fetchOnlineStatuses, getConversationCacheKey, getToken, t.conversationsUnavailable]);

  // ---------- Refresh all ----------
  const refreshAll = useCallback(async () => {
    if (!isLoggedIn || isReelsActive() || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [notesData] = await Promise.all([
        fetchNotes(),
        fetchConversations(),
      ]);
      setNotes(notesData);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isLoggedIn, fetchConversations, fetchNotes]);

  // ---------- Auto‑refresh ----------
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }

      autoRefreshInterval.current = setInterval(() => {
        if (isReelsActive()) return;
        refreshAll();
      }, 5000);
    } else {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
    };
  }, [isLoggedIn, currentUser, refreshAll]);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const isAuthenticated = Boolean(await getToken());
      setIsLoggedIn(isAuthenticated);
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      const [notesData] = await Promise.all([
        fetchNotes(),
        fetchConversations(),
        loadCurrentUser(),
      ]);
      setNotes(notesData);
    } catch (error) {
      console.error('Could not check message screen authentication:', error);
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      if (!(await networkStatus.start()).isOnline) {
        const storedUser = await AsyncStorage.getItem('sessionUser') || await AsyncStorage.getItem('user');
        if (storedUser) setCurrentUser(JSON.parse(storedUser));
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) setCurrentUser(response.data.user);
    } catch (error) {
      console.warn('Could not load the current message account:', error.message);
      try {
        const storedUser = await AsyncStorage.getItem('sessionUser') || await AsyncStorage.getItem('user');
        if (storedUser) setCurrentUser(JSON.parse(storedUser));
      } catch (storageError) {
        console.warn('Could not restore the cached message account:', storageError.message);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) refreshAll();
    }, [isLoggedIn, refreshAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  // ---------- Navigate to Chat ----------
  const openChat = (userId, userName, userAvatar, userPhone, conversation) => {
    if (!userId) {
      if (adminMode) showAdminFeedback('Error', 'User information is missing.', 'error');
      else Alert.alert('Error', 'User information is missing.');
      return;
    }
    const sellerPhone = userPhone || userId;
    navigation.navigate('Chat', {
      sellerId: userId,
      sellerName: userName || 'User',
      sellerAvatar: userAvatar || '',
      sellerPhone: sellerPhone,
      postId: conversation?.postId || '',
      postTitle: conversation?.postTitle || '',
      conversationId: conversation?.conversationId || '',
      contextType: conversation?.contextType || conversation?.replyPost?.contextType || 'direct',
      replyPost: conversation?.replyPost || null,
      adminMode,
    });
  };

  // ---------- Mark update as read ----------
  const markUpdateAsRead = useCallback(async (updateId) => {
    await saveViewedTimestamp(updateId);

    setNotes(prev => prev.map(n =>
      n.id === updateId || n._id === updateId
        ? { ...n, lastViewedAt: new Date().toISOString() }
        : n
    ));
  }, [saveViewedTimestamp]);

  // ---------- Detail Sheet ----------
  const openDetailSheet = (note) => {
    const updateId = note._id || note.id;
    markUpdateAsRead(updateId);
    setSelectedNote(note);
    setDetailSheetVisible(true);
  };

  const closeDetailSheet = () => {
    setDetailSheetVisible(false);
    setSelectedNote(null);
  };

  useEffect(() => {
    Animated.timing(detailSheetAnim, {
      toValue: detailSheetVisible ? 0 : DETAIL_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [detailSheetVisible]);

  // ---------- Social Link ----------
  const openSocialLink = async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        if (adminMode) showAdminFeedback('Error', 'Unable to open link', 'error');
        else Alert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        if (adminMode) showAdminFeedback('Error', 'Unable to open link', 'error');
        else Alert.alert('Error', 'Unable to open link');
      }
    }
  };

  // ---------- Render Social Icons ----------
  const renderSocialIcons = () => (
    <View style={styles.socialIconsFooter}>
      <Text style={[styles.followText, { color: theme.textSecondary }]}>{t.followUs}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialIconsRow}>
        {socialLinks.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.socialIconSmall}
            onPress={() => openSocialLink(item.url, item.fallbackUrl)}
            activeOpacity={0.7}
          >
            <View style={[styles.socialIconCircleSmall, { backgroundColor: item.color }]}>
              <ContactInfoIcon item={item} size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ---------- Status Modal ----------
  const renderStatusModal = () => (
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

  if (loading) {
    return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.text} />;
  }

  // ---------- Login required ----------
  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loginPromptContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={80} color={theme.accent} />
          <Text style={[styles.loginPromptTitle, { color: theme.text }]}>{t.loginPromptTitle}</Text>
          <Text style={[styles.loginPromptText, { color: theme.textSecondary }]}>{t.loginPromptText}</Text>
          <TouchableOpacity
            style={[styles.loginButton, { borderColor: theme.accent }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginButtonText, { color: theme.accent }]}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Main render ----------
  return (
    <ImageBackground
      source={normalizeImageSource(MessageBackground)}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: theme.background, opacity: 0.92 }]} />

      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={styles.headerContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t.messages}</Text>
        </View>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchWrapper,
              { backgroundColor: isDarkMode ? '#171717' : '#cfcfcf' },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={theme.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t.search}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons name="sync" size={24} color={theme.text} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.postId || 'direct'}:${item.otherUserId || item._id || item.lastMessage?._id || 'conversation'}`}
          ListHeaderComponent={
            <View style={styles.updatesSectionWrapper}>
              {fetchError ? (
                <Text style={[styles.noUpdatesText, { color: theme.textSecondary }]}>
                  {fetchError}
                </Text>
              ) : null}
              <Text style={[styles.updatesSectionTitle, { color: theme.textSecondary }]}>
                {t.updates}
              </Text>
              <UpdatesRow updates={notes} onUpdatePress={openDetailSheet} theme={theme} />
            </View>
          }
          ListEmptyComponent={!loading && !fetchError ? (
            <Text style={[styles.noUpdatesText, { color: theme.textSecondary }]}>
              {t.noConversations}
            </Text>
          ) : null}
          renderItem={({ item, index }) => (
            <ConversationRow
              conversation={item}
              onPress={() => openChat(
                item.otherUserId,
                item.otherUserName,
                item.otherUserAvatar,
                item.otherUserPhone,
                item
              )}
              theme={theme}
              currentUserId={String(currentUser?._id || currentUser?.id || currentUser?.userId || '')}
              isOnline={onlineUsers[String(item.otherUserId)] || false}
              isTyping={!!typingUsers[String(item.otherUserId)]}
              t={t}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
        />

        {detailSheetVisible && (
          <TouchableWithoutFeedback onPress={closeDetailSheet}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>
        )}
        {selectedNote && (
          <Animated.View
            style={[
              styles.detailSheet,
              {
                backgroundColor: theme.curve,
                borderTopColor: theme.border,
                transform: [{ translateY: detailSheetAnim }],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={[styles.detailTitleContainer, { borderBottomColor: theme.border }]}>
              <Image
                source={normalizeImageSource(require('../assets/logos.png'))}
                style={{ width: 70, height: 70, marginRight: 10, borderRadius: 15 }}
                resizeMode="contain"
              />
              <Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={1}>
                {selectedNote.title || selectedNote.text?.split('\n')[0] || 'Note'}
              </Text>
              <TouchableOpacity onPress={closeDetailSheet}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailDescription, { color: theme.textSecondary }]}>
                {selectedNote.text || 'No details'}
              </Text>
              {selectedNote.link ? (
                <TouchableOpacity
                  style={[styles.detailLinkRow, { backgroundColor: isDarkMode ? '#1c1c1e' : '#f0f0f0' }]}
                  onPress={() => openSocialLink(selectedNote.link, selectedNote.link)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="link-outline" size={18} color={theme.accent} />
                  <Text style={[styles.detailLinkText, { color: theme.accent }]} numberOfLines={1}>
                    {selectedNote.link}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
            {renderSocialIcons()}
          </Animated.View>
        )}

        {renderStatusModal()}

      </View>
    </ImageBackground>
  );
};

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
  loadingText: { marginTop: 22, fontSize: 16 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 10,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  refreshButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },

  updatesSectionWrapper: { marginBottom: 12, paddingHorizontal: 12 },
  updatesSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  updatesScroll: { paddingLeft: 4, paddingRight: 12 },

  updateItem: { alignItems: 'center', marginRight: 16, width: 72 },
  updateCircleRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#8e8e93',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  updateCircleAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateLabel: { fontSize: 11, textAlign: 'center' },

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

  noUpdatesContainer: { paddingVertical: 8, alignItems: 'center' },
  noUpdatesText: { fontSize: 14, fontStyle: 'italic' },

  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatarImage: { width: 50, height: 50, borderRadius: 25 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#47ae87',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#47ae87',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  messageContent: { flex: 1, justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  username: { fontSize: 15, fontWeight: '600' },
  timestamp: { fontSize: 12 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  lastMessage: { fontSize: 14, flex: 1 },

  list: { paddingBottom: 20 },
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loginPromptTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  loginPromptText: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
  loginButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30, borderWidth: 1 },
  loginButtonText: { fontSize: 16, fontWeight: '600' },

  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },

  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    zIndex: 101,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'column',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 12,
  },
  detailTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  detailScroll: {
    flex: 1,
    marginTop: 8,
  },
  detailDescription: {
    fontSize: 16,
    lineHeight: 22,
    paddingBottom: 12,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  detailLinkText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },

  socialIconsFooter: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingTop: 12,
  },
  followText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  socialIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  socialIconSmall: {
    alignItems: 'center',
  },
  socialIconCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: { flex: 1, marginTop: 42, justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
    borderWidth: 0.5,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

});

export default MessageScreen;