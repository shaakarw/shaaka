// screens/MessageScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_AVATAR = require('../assets/profile1.png');
const loadingLogo = require('../assets/logos.png');
const MessageBackground = require('../assets/message.png');

// Height of the top sections combined (header + search + updates)
const HEADER_SECTION_HEIGHT = 60;
const SEARCH_SECTION_HEIGHT = 56;
const UPDATES_SECTION_HEIGHT = 110;
const TOTAL_TOP_HEIGHT = HEADER_SECTION_HEIGHT + SEARCH_SECTION_HEIGHT + UPDATES_SECTION_HEIGHT;
const SCROLL_THRESHOLD = 20;

// ---------- Social Media Data ----------
const socialLinks = [
  {
    name: 'Instagram',
    icon: 'logo-instagram',
    color: '#E4405F',
    url: 'instagram://user?username=shaaka_rw',
    fallbackUrl: 'https://www.instagram.com/shaaka_rw/',
  },
  {
    name: 'YouTube',
    icon: 'logo-youtube',
    color: '#FF0000',
    url: 'youtube://www.youtube.com/@shaaka-rw',
    fallbackUrl: 'https://www.youtube.com/@shaaka-rw',
  },
  {
    name: 'X',
    icon: 'logo-x',
    color: '#000000',
    url: 'https://x.com/shaaka_rw',
    fallbackUrl: 'https://x.com/shaaka_rw',
  },
  {
    name: 'Facebook',
    icon: 'logo-facebook',
    color: '#1877F2',
    url: 'fb://profile/61592686307072',
    fallbackUrl: 'https://www.facebook.com/profile.php?id=61592686307072',
  },
  {
    name: 'Email',
    icon: 'mail-outline',
    color: '#D44638',
    url: 'mailto:shaakarw@gmail.com',
    fallbackUrl: null,
  },
  {
    name: 'WhatsApp',
    icon: 'logo-whatsapp',
    color: '#47ae87',
    url: 'whatsapp://send?phone=+250799882580',
    fallbackUrl: 'https://wa.me/250799882580',
  },
];

// ---------- Translations ----------
const translations = {
  English: {
    messages: 'Messages',
    search: 'Search',
    noMessages: 'No messages yet',
    startConversation: 'Start a conversation from a listing',
    loginPromptTitle: 'Messages',
    loginPromptText: 'Log in to see your messages',
    login: 'Log In',
    cancel: 'Cancel',
    loading: 'Getting things ready...',
    ok: 'OK',
    success: 'Success',
    updates: 'Updates',
    noUpdates: 'No updates available',
    followUs: 'Follow us on social media',
  },
  Kinyarwanda: {
    messages: 'Ubutumwa',
    search: 'Shakisha',
    noMessages: 'Nta butumwa',
    startConversation: 'Tangira ikiganiro uhereye ku gicuruzwa',
    loginPromptTitle: 'Ubutumwa',
    loginPromptText: 'Injira kugira ngo ubone ubutumwa',
    login: 'Kwinjira',
    cancel: 'Reka',
    loading: 'Turigutunganya page neza...',
    ok: 'Sawa',
    success: 'Byakunze',
    updates: 'Amakuru mashya',
    noUpdates: 'Nta makuru mashya ahari',
    followUs: 'Twandikire ku mbuga nkoranyambaga',
  },
};

// ---------- UpdateItem with numeric badge and re-appearing logic ----------
const UpdateItem = React.memo(({ update, onPress, theme }) => {
  const title = update.title || update.text?.split('\n')[0] || 'Note';
  const iconName = update.link ? 'link-outline' : 'notifications-outline';
  
  // Check if update should show as unread
  const shouldShowUnread = useCallback(() => {
    if (!update.lastViewedAt) {
      // Never viewed - show as unread
      return true;
    }
    
    const lastViewedDate = new Date(update.lastViewedAt);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - lastViewedDate.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Show unread badge if more than 24 hours have passed
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
        keyExtractor={(item) => String(item._id || item.id || Math.random())}
        renderItem={({ item }) => (
          <UpdateItem update={item} onPress={onUpdatePress} theme={theme} />
        )}
        contentContainerStyle={styles.updatesScroll}
      />
    </View>
  );
});

// ---------- Conversation Row ----------
const ConversationRow = ({ conversation, onPress, theme, currentUserId, isOnline }) => {
  const lastMsg = conversation.lastMessage;
  const isSentByMe = lastMsg?.senderId === currentUserId;

  return (
    <TouchableOpacity
      style={[styles.conversationRow, { backgroundColor: theme.buttons }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={
            conversation.otherUserAvatar
              ? { uri: conversation.otherUserAvatar }
              : DEFAULT_AVATAR
          }
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
            {lastMsg?.createdAt
              ? new Date(lastMsg.createdAt).toLocaleTimeString([], {
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
              { color: isSentByMe ? theme.textSecondary : theme.text },
            ]}
            numberOfLines={1}
          >
            {isSentByMe ? 'You: ' : ''}
            {lastMsg?.text || 'No messages yet'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ---------- Main Screen ----------
const MessageScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const t = translations[language] || translations.English;

  const DETAIL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

  const [conversations, setConversations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const socketRef = useRef(null);

  const [notes, setNotes] = useState([]);

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const detailSheetAnim = useRef(new Animated.Value(DETAIL_SHEET_HEIGHT)).current;
  const [selectedNote, setSelectedNote] = useState(null);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  // Header animation state and refs
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHeightAnim = useRef(new Animated.Value(TOTAL_TOP_HEIGHT)).current;
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);
  const isAnimatingHeader = useRef(false);

  // ---------- Auto‑refresh interval ----------
  const autoRefreshInterval = useRef(null);
  const isFetchingRef = useRef(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading]);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [refreshing]);

  // ---------- Header animation helpers (whole container) ----------
  const animateHeaderHide = () => {
    if (isAnimatingHeader.current) return;
    isAnimatingHeader.current = true;
    setHeaderVisible(false);
    Animated.parallel([
      Animated.timing(headerHeightAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimatingHeader.current = false;
    });
  };

  const animateHeaderShow = () => {
    if (isAnimatingHeader.current) return;
    isAnimatingHeader.current = true;
    setHeaderVisible(true);
    Animated.parallel([
      Animated.spring(headerHeightAnim, {
        toValue: TOTAL_TOP_HEIGHT,
        tension: 100,
        friction: 10,
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimatingHeader.current = false;
    });
  };

  const getToken = async () => AsyncStorage.getItem('userToken');

  // ---------- Fetch online statuses ----------
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
        const newOnline = { ...onlineUsers };
        Object.keys(statuses).forEach((uid) => {
          newOnline[uid] = statuses[uid] === true;
        });
        setOnlineUsers(newOnline);
      }
    } catch (error) {
      console.warn('Failed to fetch online statuses:', error.message);
    }
  }, [onlineUsers]);

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
    });

    socketRef.current = socket;

    socket.on('user-online', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers((prev) => ({ ...prev, [String(uid)]: true }));
    });

    socket.on('user-offline', (payload) => {
      const uid = payload?.userId;
      if (uid) setOnlineUsers((prev) => ({ ...prev, [String(uid)]: false }));
    });
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    connectPresenceSocket();
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [connectPresenceSocket]);

  // ---------- Load viewed timestamps from AsyncStorage ----------
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

  // ---------- Save viewed timestamp to AsyncStorage ----------
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
          // Add last viewed timestamp from storage
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
        setLoading(false);
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const convs = Array.isArray(response.data.conversations)
          ? response.data.conversations
          : [];
        const map = new Map();
        convs.forEach((c) => {
          const id = c.otherUserId;
          if (!id) return;
          if (!map.has(id)) {
            map.set(id, c);
          } else {
            const existing = map.get(id);
            const existingTime = new Date(existing.lastMessage?.createdAt || 0);
            const newTime = new Date(c.lastMessage?.createdAt || 0);
            if (newTime > existingTime) {
              map.set(id, c);
            }
          }
        });
        const unique = Array.from(map.values());
        setConversations(unique);
        setFiltered(unique);

        const userIds = unique.map(c => c.otherUserId).filter(Boolean);
        if (userIds.length > 0) {
          await fetchOnlineStatuses(userIds);
        }
      } else {
        setConversations([]);
        setFiltered([]);
      }
    } catch (error) {
      setConversations([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, [fetchOnlineStatuses]);

  // ---------- Refresh all ----------
  const refreshAll = useCallback(async () => {
    if (!isLoggedIn || !currentUser) return;
    await fetchConversations();
    const notesData = await fetchNotes();
    setNotes(notesData);
  }, [isLoggedIn, currentUser, fetchConversations, fetchNotes]);

  // ---------- Auto‑refresh ----------
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }

      autoRefreshInterval.current = setInterval(() => {
        if (!isFetchingRef.current) {
          isFetchingRef.current = true;
          refreshAll().finally(() => {
            isFetchingRef.current = false;
          });
        }
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
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
      if (loggedIn === 'true') {
        await loadCurrentUser();
        await refreshAll();
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) setCurrentUser(response.data.user);
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) refreshAll();
    }, [isLoggedIn, refreshAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (!headerVisible) animateHeaderShow();
    await refreshAll();
    setRefreshing(false);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFiltered(conversations);
      return;
    }
    const lower = text.toLowerCase();
    const f = conversations.filter((conv) => {
      return (
        conv.otherUserName?.toLowerCase().includes(lower) ||
        conv.postTitle?.toLowerCase().includes(lower) ||
        conv.lastMessage?.text?.toLowerCase().includes(lower)
      );
    });
    setFiltered(f);
  };

  // ---------- Navigate to Chat ----------
  const openChat = (userId, userName, userAvatar, userPhone) => {
    if (!userId) {
      Alert.alert('Error', 'User information is missing.');
      return;
    }
    const sellerPhone = userPhone || userId;
    navigation.navigate('Chat', {
      sellerId: userId,
      sellerName: userName || 'User',
      sellerAvatar: userAvatar || '',
      sellerPhone: sellerPhone,
    });
  };

  // ---------- Mark update as read and save timestamp ----------
  const markUpdateAsRead = useCallback(async (updateId) => {
    // Save the current timestamp as last viewed
    await saveViewedTimestamp(updateId);
    
    // Update local state
    setNotes(prev => prev.map(n =>
      n.id === updateId || n._id === updateId 
        ? { ...n, lastViewedAt: new Date().toISOString() } 
        : n
    ));
  }, [saveViewedTimestamp]);

  // ---------- Detail Sheet (marks as read before opening) ----------
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
        Alert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        Alert.alert('Error', 'Unable to open link');
      }
    }
  };

  // ---------- Render Social Icons ----------
  const renderSocialIcons = () => (
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

  // ---------- Scroll handler (whole container) ----------
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
  }, [headerVisible]);

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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Animated.Image
            source={loadingLogo}
            style={[styles.loadingImage, { transform: [{ scale: scaleAnim }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.text }]}>{t.loading}</Text>
        </View>
      </View>
    );
  }

  // ---------- Main render ----------
  return (
    <ImageBackground
      source={MessageBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: theme.background, opacity: 0.92 }]} />

      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Animated top section – whole container animates together */}
        <Animated.View
          style={{
            height: headerHeightAnim,
            opacity: headerOpacityAnim,
            overflow: 'hidden',
          }}
        >
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

          <View style={styles.updatesSectionWrapper}>
            <Text style={[styles.updatesSectionTitle, { color: theme.textSecondary }]}>
              {t.updates}
            </Text>
            <UpdatesRow updates={notes} onUpdatePress={openDetailSheet} theme={theme} />
          </View>
        </Animated.View>

        {/* Conversations FlatList */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.otherUserId || item._id || Math.random())}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => openChat(
                item.otherUserId,
                item.otherUserName,
                item.otherUserAvatar,
                item.otherUserPhone
              )}
              theme={theme}
              currentUserId={currentUser?._id}
              isOnline={onlineUsers[String(item.otherUserId)] || false}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={60} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noMessages}</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {t.startConversation}
              </Text>
            </View>
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />

        {!headerVisible && (
          <TouchableOpacity
            style={[
              styles.showHeaderButton,
              { bottom: 20, backgroundColor: theme.accent }
            ]}
            onPress={animateHeaderShow}
            activeOpacity={0.1}
          >
            <Ionicons name="chevron-up-circle" size={30} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Detail Sheet */}
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
                source={require('../assets/logos.png')}
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
  loadingImage: { width: 150, height: 150 },
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

  // UPDATED: orange badge with custom position
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, fontSize: 18, fontWeight: '500' },
  emptySubtext: { marginTop: 4, fontSize: 14 },

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
    justifyContent: 'center',
    gap: 16,
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

  showHeaderButton: {
    position: 'absolute',
    right: 10,
    zIndex: 200,
    padding: 8,
    borderRadius: 30,
    elevation: 1,
    shadowColor: '#0000002b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MessageScreen;