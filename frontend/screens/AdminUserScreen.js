import { getAuthToken } from '../utils/authStorage';

// screens/AdminUserScreen.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import AdminScreenHeader from '../components/AdminScreenHeader';
import { showAdminFeedback } from '../utils/adminFeedback';
import { normalizeImageSource } from '../utils/imageUrl';


const { width, height } = Dimensions.get('window');
const CARD_MARGIN = 6;
const ITEMS_PER_ROW = 2;
const CARD_WIDTH = (width - CARD_MARGIN * (ITEMS_PER_ROW + 1)) / ITEMS_PER_ROW;
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.85;
const CLOSE_THRESHOLD = 120;
const DEFAULT_USER_LIMITS = {
  postUploadLimitPerDay: 4,
  shopUploadLimitLifetime: 1,
  placeProductUploadLimitPerDay: 4,
  mallShopUploadLimitLifetime: 1,
  mallProductUploadLimitPerDay: 4,
  imagesPerMessage: 18,
  imagesRetentionDays: 15,
  messagesRetentionDays: 30,
  videoUploadLimitPerDay: 1,
};

// ---------- Translations ----------
const translations = {
  English: {
    users: 'Users',
    totalUsers: 'Total Users',
    searchPlaceholder: 'Search by name, phone, or ID...',
    noUsers: 'No users found.',
    block: 'Block',
    unblock: 'Unblock',
    blockConfirm: 'Are you sure you want to block this user? They will not be able to log in or perform any actions.',
    unblockConfirm: 'Are you sure you want to unblock this user?',
    userBlocked: 'User has been blocked successfully.',
    userUnblocked: 'User has been unblocked successfully.',
    blocked: 'Blocked',
    active: 'Active',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this?',
    viewDetails: 'View Details',
    id: 'ID:',
    name: 'Name',
    phone: 'Phone',
    idNumber: 'ID Number',
    role: 'Role',
    status: 'Status',
    notProvided: 'N/A',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    cancel: 'Cancel',
    back: 'Back',

    userInfo: 'User Information',
    verified: 'Verified',
    yes: 'Yes',
    no: 'No',

    subscriptionInfo: 'Subscription Information',
    subscriptionPlan: 'Plan',
    subscriptionStatus: 'Status',
    amountPaid: 'Amount Paid',
    paymentMethod: 'Payment Method',
    transactionId: 'Transaction ID',
    paymentDate: 'Payment Date',
    startDate: 'Start Date',
    expiryDate: 'Expiry Date',
    daysRemaining: 'Days Remaining',
    lastPayment: 'Last Payment',
    nextRenewal: 'Next Renewal',
    numberOfPayments: 'Number of Payments',
    totalPaid: 'Total Paid',
    subscriptionBenefits: 'Subscription Benefits',
    editLimits: 'Edit Limits',
    messages: 'Messages',
    map: 'Map',
    maxImages: 'Max images',
    currentUploaded: 'Current uploaded',
    remaining: 'Remaining',
    imageExpiration: 'Image expiration',
    maxPostsPerDay: 'Max posts/day',
    postsToday: 'Posts today',
    remainingPosts: 'Remaining posts',
    maxShops: 'Max shops',
    shopImages: 'Shop images',
    paymentHistory: 'Payment History',
    noPayments: 'No payments recorded.',
    accountStats: 'Account Statistics',
    created: 'Created',
    lastSeen: 'Last seen',
    activePosts: 'Active Posts',
    stoppedPosts: 'Stopped Posts',
    totalPosts: 'Total Posts',
    totalShops: 'Total Shops',
    shopViews: 'Shop Views',
    postViews: 'Post Views',
    reportsReceived: 'Reports Received',
    timesBlocked: 'Times Blocked',
    planFree: 'Free',
    planStandard: 'Standard (200 FRW)',
    planPremium: 'Premium (500 FRW)',
    planBusiness: 'Business (5,000 FRW)',
    planEnterprise: 'Enterprise (20,000 FRW)',
    statusActive: 'Active',
    statusExpired: 'Expired',
    statusPending: 'Pending',
    statusCancelled: 'Cancelled',
  },
  Kinyarwanda: {
    users: 'Abakoresha',
    totalUsers: 'Abakoresha bose',
    searchPlaceholder: 'Shakisha izina, telefone, cyangwa ID...',
    noUsers: 'Nta bakoresha baboneka.',
    block: 'Hagarika',
    unblock: 'Kuraho guhagarika',
    blockConfirm: 'Uri kwizera ko ushaka guhagarika uyu mukoresha? Ntabwo azashobora kwinjira cyangwa gukora ikintu.',
    unblockConfirm: 'Uri kwizera ko ushaka kuraho guhagarika uyu mukoresha?',
    userBlocked: 'Umukoresha yahagaritswe neza!',
    userUnblocked: 'Guhagarika kwakuvanyweho neza!',
    blocked: 'Yahagaritswe',
    active: 'Ikora',
    delete: 'Siba',
    deleteConfirm: 'Uri kwizera ko ushaka gusiba ibi?',
    viewDetails: 'Reba ibisobanuro',
    id: 'ID:',
    name: 'Izina',
    phone: 'Telefone',
    idNumber: 'Nomero y’indangamuntu',
    role: 'Uruhare',
    status: 'Imyanya',
    notProvided: 'Ntaboneka',
    ok: 'Sawa',
    success: 'Byakunze',
    error: 'Ikibazo',
    cancel: 'Reka',
    back: 'Subira',

    userInfo: 'Amakuru y’umukoresha',
    verified: 'Yemejwe',
    yes: 'Yego',
    no: 'Oya',

    subscriptionInfo: 'Amakuru y’ishyura',
    subscriptionPlan: 'Gahunda',
    subscriptionStatus: 'Imyanya',
    amountPaid: 'Amafaranga yishyuwe',
    paymentMethod: 'Uburyo bwishyura',
    transactionId: 'ID y’ishyura',
    paymentDate: 'Itariki yishyura',
    startDate: 'Itariki yatangiye',
    expiryDate: 'Itariki irangiramo',
    daysRemaining: 'Imisi isigaye',
    lastPayment: 'Ishyura riheruka',
    nextRenewal: 'Ugushya',
    numberOfPayments: 'Inshuro zishyuwe',
    totalPaid: 'Amafaranga yose yishyuwe',
    subscriptionBenefits: 'Ibyo ubona',
    editLimits: 'Hindura Imipaka',
    messages: 'Ubutumwa',
    posts: 'Inyandiko',
    map: 'Ikarita',
    maxImages: 'Amashusho yemewe',
    currentUploaded: 'Yashyizwe',
    remaining: 'Asigaye',
    imageExpiration: 'Igihe amashusho arangira',
    maxPostsPerDay: 'Inyandiko ku munsi',
    postsToday: 'Inyandiko uyu munsi',
    remainingPosts: 'Zisigaye',
    maxShops: 'Amaduka yemewe',
    shopImages: 'Amashusho y’amaduka',
    paymentHistory: 'Amateka y’ishyura',
    noPayments: 'Nta mafaranga yishyuwe.',
    accountStats: 'Imibare ya konti',
    created: 'Yashyizweho',
    lastSeen: 'Yagaragaye',
    activePosts: 'Inyandiko zikora',
    stoppedPosts: 'Zahagaritswe',
    totalPosts: 'Inyandiko zose',
    totalShops: 'Amaduka yose',
    shopViews: 'Ababirebye',
    postViews: 'Ababirebye',
    reportsReceived: 'Imenyesha',
    timesBlocked: 'Inshuro zahagaritswe',
    verified: 'Yemejwe',
    yes: 'Yego',
    no: 'Oya',
    never: 'Ntirangira',
    planFree: 'Ubuntu',
    planStandard: 'Gahunda isanzwe (200 FRW)',
    planPremium: 'Premium (500 FRW)',
    planBusiness: 'Business (5,000 FRW)',
    planEnterprise: 'Enterprise (20,000 FRW)',
    statusActive: 'Ikora',
    statusExpired: 'Yashize',
    statusPending: 'Iratereganywa',
    statusCancelled: 'Yahagaritswe',
  },
};

// ---------- Main Component ----------
const AdminUserScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUser } = useAuth();
  const t = translations[language] || translations.English;

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);

  const [limits, setLimits] = useState({
    ...DEFAULT_USER_LIMITS,
    allowVideoUpload: true,
  });
  const [savingLimits, setSavingLimits] = useState(false);

  const translateY = useRef(new Animated.Value(BOTTOM_SHEET_MAX_HEIGHT)).current;
  const scrollY = useRef(0);
  const scrollViewRef = useRef(null);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // ---------- PanResponder (improved) ----------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isHeaderTouch = evt.nativeEvent.locationY < headerHeight;
        const atTopAndDown = scrollY.current <= 0 && gestureState.dy > 0;
        return isHeaderTouch || atTopAndDown;
      },
      onPanResponderMove: (evt, gestureState) => {
        const newValue = Math.max(0, Math.min(gestureState.dy, BOTTOM_SHEET_MAX_HEIGHT));
        translateY.setValue(newValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > CLOSE_THRESHOLD) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  // ---------- API helpers ----------
  const getToken = async () => getAuthToken('adminToken');

  const showStatus = (title, message) => {
    showAdminFeedback(title, message, title === t.error ? 'error' : 'success', { buttonText: t.ok });
  };

  // ---------- Fetch users ----------
  const fetchUsers = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin');
        return;
      }
      const res = await axios.get(`${BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const userList = res.data.users || [];
        setUsers(userList);
        setFilteredUsers(userList);
      } else {
        showAdminFeedback(t.error, 'Failed to fetch users.', 'error');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      if (['session_invalidated', 'session_ended'].includes(error.response?.data?.reason)) {
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(t.error, 'An error occurred while fetching users.', 'error');
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  // ---------- Fetch user details ----------
  const fetchUserDetails = async (userId) => {
    setDetailsLoading(true);
    setDetailsError(false);
    try {
      const token = await getToken();
      const res = await axios.get(`${BASE_URL}/api/admin/users/${userId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setUserDetails(res.data.user);
        setDetailsError(false);
      } else {
        setDetailsError(true);
        showAdminFeedback(t.error, res.data.message || 'Failed to fetch user details.', 'error');
      }
    } catch (err) {
      console.error('Fetch user details error:', err);
      setDetailsError(true);
      if (err.response?.status === 404) {
        setUserDetails(selectedUser);
        showAdminFeedback('Info', 'Could not load full details. Showing basic info.');
      } else {
        showAdminFeedback(t.error, 'Could not load user details.', 'error');
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  // ---------- Search filtering ----------
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = users.filter(
      (user) =>
        (user.username && user.username.toLowerCase().includes(q)) ||
        (user.phone && user.phone.includes(q)) ||
        (user.name && user.name.toLowerCase().includes(q)) ||
        (user.idNumber && user.idNumber.includes(q))
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  // ---------- Handlers ----------
  const handleBlockUser = (userId, username) => {
    Alert.alert(t.block, `${t.blockConfirm} (${username})`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.block,
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.put(
              `${BASE_URL}/api/admin/users/${userId}/block`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, blocked: true } : u)));
            setFilteredUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, blocked: true } : u)));
            showStatus(t.success, t.userBlocked);
            if (userDetails) setUserDetails({ ...userDetails, blocked: true });
          } catch (e) {
            showAdminFeedback(t.error, 'Failed to block user.', 'error');
          }
        },
      },
    ]);
  };

  const handleUnblockUser = (userId, username) => {
    Alert.alert(t.unblock, `${t.unblockConfirm} (${username})`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.unblock,
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.put(
              `${BASE_URL}/api/admin/users/${userId}/unblock`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, blocked: false } : u)));
            setFilteredUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, blocked: false } : u)));
            showStatus(t.success, t.userUnblocked);
            if (userDetails) setUserDetails({ ...userDetails, blocked: false });
          } catch (e) {
            showAdminFeedback(t.error, 'Failed to unblock user.', 'error');
          }
        },
      },
    ]);
  };

  const handleDeleteUser = (userId) => {
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.delete(`${BASE_URL}/api/admin/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'User deleted successfully.');
            closeSheet();
            fetchUsers();
          } catch (e) {
            showAdminFeedback(t.error, 'Failed to delete user.', 'error');
          }
        },
      },
    ]);
  };

  // ---------- Bottom sheet controls ----------
  const openSheet = (user) => {
    setSelectedUser(user);
    setSheetVisible(true);
    setUserDetails(null);
    setDetailsError(false);
    translateY.setValue(0);
    fetchUserDetails(user._id);
  };

  const closeSheet = () => {
    Animated.spring(translateY, {
      toValue: BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => {
      setSheetVisible(false);
      setSelectedUser(null);
      setUserDetails(null);
    });
  };

  const onScroll = (event) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  const onHeaderLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setHeaderHeight(height);
  };

  const handleUserLimitsSave = (updatedUser) => {
    if (!updatedUser) return;
    setUserDetails(updatedUser);
    setUsers((prev) => prev.map((u) => (u._id === updatedUser._id ? updatedUser : u)));
    setFilteredUsers((prev) => prev.map((u) => (u._id === updatedUser._id ? updatedUser : u)));
    showStatus(t.success, 'User limits updated successfully.');
  };

  const syncLimitsFromDetails = useCallback(() => {
    const data = userDetails || selectedUser;
    if (!data) return;
    setLimits({
      ...Object.fromEntries(Object.entries(DEFAULT_USER_LIMITS).map(([key, defaultValue]) => [
        key,
        Number.isSafeInteger(data[key]) ? Math.min(100, Math.max(0, data[key])) : defaultValue,
      ])),
      allowVideoUpload: data.allowVideoUpload !== false,
    });
  }, [userDetails, selectedUser]);

  useEffect(() => {
    syncLimitsFromDetails();
  }, [syncLimitsFromDetails]);

  const saveLimits = async () => {
    if (!selectedUser?._id) return;
    try {
      setSavingLimits(true);
      const currentDetails = userDetails || selectedUser;
      const updates = {};
      for (const [key, defaultValue] of Object.entries(DEFAULT_USER_LIMITS)) {
        const savedValue = Number.isSafeInteger(currentDetails[key])
          ? currentDetails[key]
          : defaultValue;
        if (limits[key] !== savedValue) updates[key] = limits[key];
      }
      if (limits.allowVideoUpload !== (currentDetails.allowVideoUpload !== false)) {
        updates.allowVideoUpload = limits.allowVideoUpload;
      }
      if (Object.keys(updates).length === 0) {
        showStatus(t.success, 'There are no permission changes to save.');
        return;
      }
      const token = await getToken();
      const res = await axios.put(
        `${BASE_URL}/api/admin/users/${selectedUser._id}/limits`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const updated = res.data.user;
        setUserDetails(updated);
        setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
        setFilteredUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
        showStatus(t.success, 'User limits updated successfully.');
        
        // If admin edited their own limits, refresh the global user state so all screens get the new limits
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            if (parsed._id === updated._id) {
              await refreshUser();
            }
          } catch (e) {}
        }
      } else {
        showStatus(t.error, res.data.message || 'Failed to update limits');
      }
    } catch (err) {
      console.error('Save limits error:', err);
      showStatus(t.error, err.response?.data?.message || 'Failed to update limits');
    } finally {
      setSavingLimits(false);
    }
  };

  // ---------- Render helpers ----------
  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free': return '#9CA3AF';
      case 'standard': return '#3B82F6';
      case 'premium': return '#22C55E';
      case 'business': return '#F59E0B';
      case 'enterprise': return '#8B5CF6';
      default: return '#9CA3AF';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#22C55E';
      case 'expired': return '#EF4444';
      case 'pending': return '#F59E0B';
      case 'cancelled': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getPlanLabel = (plan) => {
    switch (plan) {
      case 'free': return t.planFree;
      case 'standard': return t.planStandard;
      case 'premium': return t.planPremium;
      case 'business': return t.planBusiness;
      case 'enterprise': return t.planEnterprise;
      default: return plan || t.planFree;
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return t.statusActive;
      case 'expired': return t.statusExpired;
      case 'pending': return t.statusPending;
      case 'cancelled': return t.statusCancelled;
      default: return status || t.statusActive;
    }
  };

  // ---------- Fixed header ----------
  const renderBottomSheetHeader = () => {
    if (!selectedUser) return null;
    const data = userDetails || selectedUser;
    const isBlocked = data.blocked || false;
    const initials = data.username?.charAt(0).toUpperCase() || '?';
    const plan = data.plan || 'free';
    const planLabel = getPlanLabel(plan);
    const planColor = getPlanColor(plan);

    return (
      <View ref={headerRef} onLayout={onHeaderLayout} style={styles.fixedHeader}>
        <View style={styles.sheetAvatarSection}>
          {data.avatar ? (
            <Image source={normalizeImageSource({ uri: data.avatar })} style={styles.sheetAvatar} />
          ) : (
            <View style={[styles.sheetAvatarPlaceholder, { backgroundColor: theme.border }]}>
              <Text style={[styles.sheetAvatarInitials, { color: theme.text }]}>{initials}</Text>
            </View>
          )}
          <Text style={[styles.sheetName, { color: theme.text }]}>
            {data.name || data.username}
          </Text>
          <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
            {data.phone}
          </Text>
          <View style={styles.headerBadgesRow}>
            <View style={[styles.sheetStatusBadge, { backgroundColor: isBlocked ? theme.textSecondary : theme.accent }]}>
              <Text style={styles.sheetStatusText}>{isBlocked ? t.blocked : t.active}</Text>
            </View>
            <View style={[styles.planBadge, { backgroundColor: planColor }]}>
              <Text style={styles.planBadgeText}>{planLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ---------- Scrollable content ----------
  const renderBottomSheetScrollContent = () => {
    if (!selectedUser) return null;
    if (detailsError) {
      return (
        <ScrollView contentContainerStyle={styles.sheetErrorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.sheetErrorText, { color: theme.textSecondary }]}>
            Could not load full user details. Showing basic info.
          </Text>
          <TouchableOpacity style={[styles.sheetErrorBtn, { backgroundColor: theme.accent }]} onPress={() => fetchUserDetails(selectedUser._id)}>
            <Text style={styles.sheetErrorBtnText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (detailsLoading) {
      return (
        <View style={styles.sheetLoadingContainer}>
          <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText compact />
        </View>
      );
    }

    const data = userDetails || selectedUser;

    const displayUsername = data.username || data.name || t.notProvided;
    const displayPhone = data.phone || t.notProvided;
    const displayIdNumber = data.idNumber || t.notProvided;

    const LIMIT_ITEMS = [
      { key: 'postUploadLimitPerDay', label: 'Posts / Products Per Day' },
      { key: 'shopUploadLimitLifetime', label: 'Shops / Places (Lifetime)' },
      { key: 'placeProductUploadLimitPerDay', label: 'Place Products Per Day' },
      { key: 'mallShopUploadLimitLifetime', label: 'Shopping Mall Shops (Lifetime)' },
      { key: 'mallProductUploadLimitPerDay', label: 'Shopping Mall Products Per Day' },
      { key: 'imagesPerMessage', label: 'Images Per Message' },
      { key: 'imagesRetentionDays', label: 'Image Retention (Days)' },
      { key: 'messagesRetentionDays', label: 'Message Retention (Days)' },
      { key: 'videoUploadLimitPerDay', label: 'Video Uploads / Day' },
    ];

    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollableContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {/* User Information */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.userInfo}</Text>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Username</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{displayUsername}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Phone Number</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{displayPhone}</Text>
          </View>
          <View style={[styles.sectionRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ID / Recovery Number</Text>
            <Text style={[styles.sectionValue, { color: theme.text }]}>{displayIdNumber}</Text>
          </View>
        </View>

        {/* User Permissions & Limits */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>User Permissions & Limits</Text>

          <View style={[styles.limitRow, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.limitLabel, { color: theme.text }]}>Allow Video Uploads</Text>
            </View>
            <TouchableOpacity
              style={[styles.allowToggle, { backgroundColor: limits.allowVideoUpload ? '#6B7280' : theme.border }]}
              onPress={() => setLimits((prev) => ({ ...prev, allowVideoUpload: !prev.allowVideoUpload }))}
              disabled={savingLimits}
            >
              <View style={[styles.allowToggleThumb, { transform: [{ translateX: limits.allowVideoUpload ? 18 : 0 }] }]} />
            </TouchableOpacity>
          </View>

          {LIMIT_ITEMS.map((item) => (
            <View key={item.key} style={[styles.limitRow, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.limitLabel, { color: theme.text }]}>{item.label}</Text>
              </View>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: theme.border }]}
                  onPress={() => setLimits((prev) => ({ ...prev, [item.key]: Math.max(0, Math.min(100, prev[item.key] - 1)) }))}
                  disabled={limits[item.key] <= 0 || savingLimits}
                >
                  <Text style={[styles.stepperBtnText, { color: theme.text }]}>−</Text>
                </TouchableOpacity>
                <View style={[styles.stepperValue, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.stepperValueText, { color: theme.text }]}>{limits[item.key]}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: '#6B7280' }]}
                  onPress={() => setLimits((prev) => ({ ...prev, [item.key]: Math.min(100, Math.max(0, prev[item.key] + 1)) }))}
                  disabled={savingLimits || limits[item.key] >= 100}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={[styles.sheetActionBtn, { backgroundColor: (data.blocked ? theme.textSecondary : theme.accent) }]}
            onPress={() => {
              if (data.blocked) {
                handleUnblockUser(selectedUser._id, selectedUser.username);
              } else {
                handleBlockUser(selectedUser._id, selectedUser.username);
              }
            }}
          >
            <Ionicons name={data.blocked ? 'lock-open-outline' : 'lock-closed-outline'} size={22} color="#fff" />
            <Text style={styles.sheetActionText}>{data.blocked ? t.unblock : t.block}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetActionBtn, { backgroundColor: '#dc3545' }]}
            onPress={() => handleDeleteUser(selectedUser._id)}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.sheetActionText}>{t.delete}</Text>
          </TouchableOpacity>
        </View>

        {/* Save Changes */}
        <TouchableOpacity
          style={[styles.saveChangesBtn, { backgroundColor: savingLimits ? theme.textSecondary : '#6B7280' }]}
          onPress={saveLimits}
          disabled={savingLimits}
        >
          {savingLimits ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveChangesText}>Save Changes</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    );
  };

  // ---------- Render item ----------
  const renderUserItem = ({ item }) => {
    const initials = item.username?.charAt(0).toUpperCase() || '?';
    const isBlocked = item.blocked || false;
    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            opacity: isBlocked ? 0.6 : 1,
          },
        ]}
        onPress={() => openSheet(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={normalizeImageSource({ uri: item.avatar })} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
              <Text style={[styles.avatarInitials, { color: theme.text }]}>{initials}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
          {item.username || 'User'}
        </Text>
        <Text style={[styles.gridSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.phone}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isBlocked ? theme.textSecondary : theme.accent, marginVertical: 4 },
          ]}
        >
          <Text style={styles.statusBadgeText}>{isBlocked ? t.blocked : t.active}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- Render list ----------
  const renderUsersList = () => (
    <FlatList
      key="users"
      data={filteredUsers}
      keyExtractor={(item) => item._id}
      renderItem={renderUserItem}
      numColumns={ITEMS_PER_ROW}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchUsers} tintColor={theme.accent} />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noUsers}</Text>
        </View>
      }
    />
  );

  // ---------- Render search ----------
  const renderSearch = () => (
    <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
      <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={[
          styles.searchInput,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
        placeholder={t.searchPlaceholder}
        placeholderTextColor={theme.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
          <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ---------- Main render ----------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <AdminScreenHeader
        title={t.users}
        theme={theme}
        onBack={() => navigation.goBack()}
        actionIcon="refresh-outline"
        actionLabel="Refresh users"
        onAction={fetchUsers}
      />

      {/* Search */}
      {renderSearch()}

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />
        </View>
      ) : (
        renderUsersList()
      )}

      {/* Bottom Sheet (overlay now transparent) */}
      <Modal transparent visible={sheetVisible} animationType="none" onRequestClose={closeSheet}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={closeSheet} activeOpacity={1} />
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                transform: [{ translateY }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: theme.textSecondary }]} />
            </View>
            {renderBottomSheetHeader()}
            {renderBottomSheetScrollContent()}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ---------- Styles (overlay now transparent) ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchIcon: { position: 'absolute', left: 28, zIndex: 1 },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 15,
  },
  clearSearch: { position: 'absolute', right: 28 },

  gridContainer: { paddingHorizontal: 8, paddingBottom: 20 },
  gridRow: { justifyContent: 'space-between', marginBottom: 10 },
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  avatarContainer: { marginBottom: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '700' },
  gridTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  gridSubtitle: { fontSize: 11, textAlign: 'center', opacity: 0.7, marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, textAlign: 'center' },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },  // ✅ transparent overlay
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    minHeight: 300,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  sheetHandle: { alignItems: 'center', paddingVertical: 12 },
  sheetHandleBar: { width: 40, height: 5, borderRadius: 3 },

  fixedHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    backgroundColor: 'transparent',
  },
  scrollableContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  sheetLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  sheetErrorContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  sheetErrorText: { fontSize: 16, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  sheetErrorBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  sheetErrorBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  sheetAvatarSection: { alignItems: 'center' },
  sheetAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#fff' },
  sheetAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  sheetAvatarInitials: { fontSize: 32, fontWeight: '700' },
  sheetName: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  sheetSub: { fontSize: 14, marginTop: 2 },
  headerBadgesRow: { flexDirection: 'row', marginTop: 6, gap: 8 },
  sheetStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14 },
  sheetStatusText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  sectionLabel: { fontSize: 13 },
  sectionValue: { fontSize: 13, fontWeight: '500' },

  planBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, alignSelf: 'center' },
  planBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, alignSelf: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  benefitGroup: { marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingBottom: 6 },
  benefitGroupTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  benefitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  benefitLabel: { fontSize: 12 },
  benefitValue: { fontSize: 12, fontWeight: '500' },

  historyItem: { borderBottomWidth: 0.5, paddingVertical: 6, marginBottom: 4 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  historyLabel: { fontSize: 12 },
  historyValue: { fontSize: 12, fontWeight: '500' },
  historyStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  historyStatusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  viewMoreBtn: { marginTop: 8, alignItems: 'center' },
  viewMoreText: { fontSize: 14, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statItem: { width: '48%', marginBottom: 8 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 14, fontWeight: '600' },

  sheetActions: { flexDirection: 'row', justifyContent: 'space-around', gap: 12, marginTop: 8 },
  sheetActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  sheetActionText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  limitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  limitLabel: { fontSize: 13, fontWeight: '600', flex: 1, marginRight: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  allowToggle: { width: 48, height: 28, borderRadius: 14, padding: 4, justifyContent: 'center', alignItems: 'flex-start' },
  allowToggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  stepperBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stepperValue: { minWidth: 56, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stepperValueText: { fontSize: 16, fontWeight: '700' },
  saveChangesBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  saveChangesText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '85%', borderRadius: 20, padding: 24, borderWidth: 0.5 },
  modalTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default AdminUserScreen;