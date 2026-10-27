// screens/ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  FlatList,
  Animated,
  TouchableWithoutFeedback,
  Linking,
  PanResponder,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { networkStatus } from '../services/networkStatus';
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';
import SharedBottomNav from '../components/SharedBottomNav';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import PostCoverImage from '../components/PostCoverImage';

const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.5;

const BOTTOM_SHEET_HEIGHT = height * 0.7;
const LOGOUT_SHEET_HEIGHT = height * 0.3;

const DEFAULT_AVATAR = require('../assets/profile1.png');

// ---------- Translations ----------
const translations = {
  English: {
    loading: 'Getting things ready…',
    posts: 'Posts',
    videos: 'Videos',
    saved: 'Saved',
    noPosts: 'No posts yet',
    noVideos: 'No videos yet',
    noSavedPosts: 'No saved posts yet',     
    createFirstVideo: 'Create your first video',
    addFirstPost: 'Add your first post/product here',
    saveFirstPost: 'Save your first post/product',
    explorePosts: 'Explore Posts',
    settings: 'Settings',
    logout: 'Logout',
    post: 'Post',
    editProfile: 'Edit Profile',
    username: 'Username',
    location: 'Location',
    cancel: 'Cancel',
    save: 'Save',
    logoutConfirmTitle: 'Are you sure you want to log out?',
    logoutConfirmMessage: 'You can sign in again anytime.',
    yes: 'Yes',
    no: 'No',
    profileUpdated: 'Profile updated successfully',
    updateFailed: 'Failed to update profile',
    deletePost: 'Delete Post',
    deleteConfirm: 'Are you sure you want to delete this post?',
    delete: 'Delete',
    unsaved: 'Unsaved',
    loginRequired: 'Login Required',
    loginMessage: 'Please login to continue',
    login: 'Login',
    profileLoadFailed: 'Could not load this profile',
    retry: 'Retry',
  },
  Kinyarwanda: {
    loading: 'Turigutunganya page neza…',
    posts: 'Ibicuruzwa',
    videos: 'Videwo',
    saved: 'Ibyabitswe',
    noPosts: 'Nta gicuruzwa',
    noVideos: 'Nta videwo',
    noSavedPosts: 'Nta gicuruzwa cyabitswe',
    createFirstVideo: 'Kora videwo yawe ya mbere',
    addFirstPost: 'Ongeraho igicuruzwa cyawe cya mbere hano',
    saveFirstPost: 'Bika igicuruzwa cyawe cya mbere',
    explorePosts: 'Shakisha igicuruzwa',
    settings: 'Igenamiterere',
    logout: 'Sohoka',
    post: 'Igicuruzwa',
    editProfile: 'Hindura Ibikuranga',
    username: 'Izina',
    location: 'Aho uherereye',
    cancel: 'Reka',
    save: 'Bika',
    logoutConfirmTitle: 'Ese usha gusohoka?',
    logoutConfirmMessage: 'Ushobora kwinjira igihe icyo aricyo cyose.',
    yes: 'Yego',
    no: 'Oya',
    profileUpdated: 'Porofile yahinduwe neza',
    updateFailed: 'Kuvuga porofile byanze',
    deletePost: 'Siba inyandiko',
    deleteConfirm: 'Ese ukenye gusiban icyi Gicuruzwa?',
    delete: 'Siba',
    unsaved: 'Ibitigenzwe bibikwa',
    loginRequired: 'Ugomba kwinjira',
    loginMessage: 'Nyamuneka winjire kugira ngo ukomeze',
    login: 'Kwinjira',
    profileLoadFailed: 'Ntibyashobotse kubona iyi porofile',
    retry: 'Ongera ugerageze',
  },
};

// ---------- Helpers ----------
const resolvePostImageUri = (post) => {
  if (!post) return null;
  return (
    post.imageUrl ||
    post.image ||
    post.thumbnail ||
    post.thumbnailUrl ||
    post.coverImage ||
    post.coverPhoto ||
    post.bannerImage ||
    post.mediaUrl ||
    (Array.isArray(post.houseImages) && post.houseImages.find(Boolean)) ||
    (Array.isArray(post.images) && post.images.find(Boolean)) ||
    (Array.isArray(post.imageUrls) && post.imageUrls.find(Boolean)) ||
    null
  );
};

const resolvePostVideoCover = (post) => {
  if (!post?.videoUrl) return null;
  if (post.videoThumbnail) return post.videoThumbnail;
  if (!post.videoUrl.includes('res.cloudinary.com')) return null;
  const [urlWithoutQuery] = post.videoUrl.split('?');
  const uploadMarker = '/video/upload/';
  if (!urlWithoutQuery.includes(uploadMarker)) return null;
  return urlWithoutQuery
    .replace(uploadMarker, '/video/upload/so_5/')
    .replace(/\.[^/.]+$/, '.jpg');
};

const isVideoPostItem = (post) =>
  Boolean(post && (post.videoUrl || post.video || post.mediaUrl || post.videoUri));

const getPostLabel = (post) =>
  post?.productName || post?.title || post?.category || 'Product';

const getPostImageSource = (img) => {
  if (!img) return DEFAULT_AVATAR;
  if (typeof img === 'string') return { uri: img };
  if (typeof img === 'object' && img.uri) return img;
  return DEFAULT_AVATAR;
};

const cacheProfileUserImages = async (user) => {
  if (!user) return user;
  const cachedUser = { ...user };
  for (const key of ['avatar', 'coverImage', 'coverPhoto', 'bannerImage']) {
    if (typeof cachedUser[key] === 'string') {
      cachedUser[key] = await mediaCache.cacheImage(cachedUser[key]);
    }
  }
  return cachedUser;
};

const cacheProfilePostImages = async (posts) => Promise.all(posts.map(async (post) => {
  const isVideo = isVideoPostItem(post);
  const imageUri = isVideo
    ? resolvePostVideoCover(post) || resolvePostImageUri(post)
    : resolvePostImageUri(post);
  if (typeof imageUri !== 'string') return post;

  const localUri = await mediaCache.cacheImage(imageUri);
  if (localUri === imageUri) return post;
  if (isVideo) return { ...post, videoThumbnail: localUri };

  for (const key of ['imageUrl', 'image', 'thumbnail', 'thumbnailUrl', 'coverImage', 'coverPhoto', 'bannerImage', 'mediaUrl']) {
    if (post[key]) return { ...post, [key]: localUri };
  }
  for (const key of ['houseImages', 'images', 'imageUrls']) {
    if (Array.isArray(post[key])) {
      const firstImageIndex = post[key].findIndex(Boolean);
      if (firstImageIndex !== -1) {
        const images = [...post[key]];
        images[firstImageIndex] = localUri;
        return { ...post, [key]: images };
      }
    }
  }
  return { ...post, imageUrl: localUri };
}));

// Normalise any "user id" shape (string, {_id}, {id}, {userId}, nested objects, etc.) into a string.
const normaliseUserId = (raw) => {
  if (raw == null) return null;

  if (typeof raw === 'string' || typeof raw === 'number') {
    const value = String(raw).trim();
    return value ? value : null;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const value = normaliseUserId(item);
      if (value) return value;
    }
    return null;
  }

  if (typeof raw === 'object') {
    for (const key of ['_id', 'id', 'userId', 'user', 'value']) {
      const value = normaliseUserId(raw[key]);
      if (value) return value;
    }
  }

  return null;
};

// ---------- PostCoverTile ----------
// Full-bleed cover tile. Shows the product name (and video badge).
// The user avatar and the amount are intentionally omitted.
const PostCoverTile = ({ post, style, onPress, children }) => {
  const [hasError, setHasError] = useState(false);

  const video = isVideoPostItem(post);
  const imageUri = video
    ? resolvePostVideoCover(post) || resolvePostImageUri(post)
    : resolvePostImageUri(post);

  const label = getPostLabel(post);

  useEffect(() => {
    setHasError(false);
  }, [imageUri]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[style, styles.coverTile]}
    >
      {imageUri && !hasError ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.coverTileImage}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <View style={styles.coverTileFallback}>
          <Ionicons
            name={video ? 'videocam-outline' : 'image-outline'}
            size={32}
            color="#a8a8a8"
          />
        </View>
      )}

      {/* Dark shade for readability */}
      <View style={styles.coverTileShade} pointerEvents="none" />

      {/* Product name */}
      {!!label && (
        <Text style={styles.coverTileLabel} numberOfLines={2}>
          {label}
        </Text>
      )}

      {/* Video badge */}
      {video && (
        <View style={styles.coverTileVideoBadge}>
          <Ionicons name="videocam" size={11} color="#fff" />
        </View>
      )}

      {children}
    </TouchableOpacity>
  );
};

const ProfileScreen = ({ navigation, route, language }) => {
  const isFocused = useIsFocused();
  const { theme, isDarkMode } = useTheme();
  const { logout, updateUser: updateAuthUser, syncStoredUser } = useAuth();
  const t = translations[language] || translations.English;

  const params = route?.params || {};
  const { userId: paramUserId, username: paramUsername } = params;

  const [currentUser, setCurrentUser] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const postsRequestInFlight = useRef(false);
  const lastPostsSnapshot = useRef(null);

  // Edit Profile Bottom Sheet
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSocialLinks, setEditSocialLinks] = useState(['', '', '']);
  const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;

  // Logout Bottom Sheet
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const logoutSlideAnim = useRef(new Animated.Value(LOGOUT_SHEET_HEIGHT)).current;

  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarSlideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  const sidebarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        sidebarSlideAnim.setValue(Math.max(0, gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50 || gestureState.vx > 0.5) {
          closeSidebar();
        } else {
          Animated.spring(sidebarSlideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sidebarSlideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
      },
    })
  ).current;

  // PanResponder for edit bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.8) closeEditSheet();
        else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
      },
    })
  ).current;

  // PanResponder for logout bottom sheet
  const logoutPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) logoutSlideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.8) closeLogoutSheet();
        else Animated.spring(logoutSlideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
      },
    })
  ).current;

  useEffect(() => {
    loadData();
  }, [paramUserId]);

  useEffect(() => {
    if (!isFocused || loading) return undefined;

    const refreshPosts = async () => {
      if (postsRequestInFlight.current || !networkStatus.get().isOnline) return;

      const targetUserId = normaliseUserId(paramUserId)
        || normaliseUserId(viewedUser?._id || currentUser?._id || currentUser?.id);
      if (!targetUserId) return;

      postsRequestInFlight.current = true;
      try {
        const token = await getToken();
        if (!token) return;

        const response = await axios.get(
          `${BASE_URL}/api/posts/user/${encodeURIComponent(targetUserId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const posts = response.data.posts || [];
        const snapshot = JSON.stringify(posts);
        if (snapshot === lastPostsSnapshot.current) return;

        lastPostsSnapshot.current = snapshot;
        await offlineDatabase.putRecord('profile-posts', targetUserId, posts, { priority: 'medium' });
        setUserPosts(await cacheProfilePostImages(posts));
      } catch {
        // Keep the current profile visible when a background refresh fails.
      } finally {
        postsRequestInFlight.current = false;
      }
    };

    const intervalId = setInterval(refreshPosts, 1000);
    return () => clearInterval(intervalId);
  }, [isFocused, loading, paramUserId, viewedUser, currentUser]);

  // Never allow the 'saved' tab on other people's profiles
  useEffect(() => {
    if (!isOwnProfile && activeTab === 'saved') {
      setActiveTab('posts');
    }
  }, [isOwnProfile, activeTab]);

  // Sidebar animation
  useEffect(() => {
    if (sidebarVisible) {
      Animated.timing(sidebarSlideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(sidebarSlideAnim, { toValue: SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }).start();
    }
  }, [sidebarVisible]);

  // Edit sheet animation
  useEffect(() => {
    if (editSheetVisible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: BOTTOM_SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start();
    }
  }, [editSheetVisible]);

  // Logout sheet animation
  useEffect(() => {
    if (logoutSheetVisible) {
      Animated.spring(logoutSlideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
    } else {
      Animated.timing(logoutSlideAnim, { toValue: LOGOUT_SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start();
    }
  }, [logoutSheetVisible]);

  const getToken = async () => await AsyncStorage.getItem('userToken');

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  // ---------------------------------------------------------------
  // loadData — normalises the incoming userId, and each sub-request
  // is isolated so a single failure doesn't blank the entire screen.
  // ---------------------------------------------------------------
  const loadData = async () => {
    setLoading(true);
    setLoadError(false);

    const token = await getToken();
    if (!token) {
      navigation.replace('Login');
      return;
    }

    await networkStatus.start();
    const isOnline = networkStatus.get().isOnline;

    // 1. Get current user (required)
    let me = null;
    if (isOnline) {
      try {
        const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meResponse.data.success) {
          me = meResponse.data.user;
          setCurrentUser(me);
          await AsyncStorage.setItem('user', JSON.stringify(me));
        }
      } catch (e) {
        console.warn('loadData -> /auth/me failed:', e.message);
      }
    }

    // Fallback to cached user
    if (!me) {
      try {
        const cached = await AsyncStorage.getItem('user');
        if (cached) me = JSON.parse(cached);
      } catch {}
    }

    if (!me) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    // 2. Normalise the target user id (fixes [object Object] → Network Error)
    const normalisedParamUserId = normaliseUserId(paramUserId);
    const myId = normaliseUserId(me._id) || normaliseUserId(me.phone);
    const isOwn = !normalisedParamUserId || String(normalisedParamUserId) === String(myId);

    let targetUserId = isOwn ? myId : normalisedParamUserId;

    if (!targetUserId) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    if (isOwn) {
      const ownUser = await cacheProfileUserImages(me);
      setAvatarUri(ownUser.avatar || null);
      setUsername(ownUser.username || ownUser.phone || '');
      setName(ownUser.name || ownUser.username || '');
      setViewedUser(ownUser);
      setSocialLinks(Array.isArray(ownUser.socialLinks) ? ownUser.socialLinks.filter(l => typeof l === 'string') : []);
    } else {
      let cachedOtherUser = null;
      try {
        cachedOtherUser = await offlineDatabase.getRecord('profiles', targetUserId);
      } catch {}

      let otherUser = { _id: targetUserId, username: paramUsername || 'User' };
      if (cachedOtherUser) {
        otherUser = await cacheProfileUserImages(cachedOtherUser);
      }
      if (isOnline) {
        try {
          const userResponse = await axios.get(
            `${BASE_URL}/api/user/${encodeURIComponent(targetUserId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (userResponse.data.success) {
            const fetchedUser = userResponse.data.user;
            await offlineDatabase.putRecord('profiles', targetUserId, fetchedUser, { priority: 'medium' });
            otherUser = await cacheProfileUserImages(fetchedUser);
          }
        } catch (e) {
          console.warn('loadData -> /api/user/:id failed:', e.message);
        }
      }
      setViewedUser(otherUser);
      setAvatarUri(otherUser.avatar || null);
      setUsername(otherUser.username || otherUser.phone || 'User');
      setName(otherUser.name || otherUser.username || 'User');
      setSocialLinks(Array.isArray(otherUser.socialLinks) ? otherUser.socialLinks.filter(l => typeof l === 'string') : []);
    }

    setIsOwnProfile(isOwn);

    // 4. Posts (non-fatal)
    let cachedPosts = null;
    try {
      cachedPosts = await offlineDatabase.getRecord('profile-posts', targetUserId);
      if (Array.isArray(cachedPosts)) {
        setUserPosts(await cacheProfilePostImages(cachedPosts));
      }
    } catch {}

    if (isOnline) {
      try {
        const postsResponse = await axios.get(
          `${BASE_URL}/api/posts/user/${encodeURIComponent(targetUserId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const posts = postsResponse.data.posts || [];
        lastPostsSnapshot.current = JSON.stringify(posts);
        await offlineDatabase.putRecord('profile-posts', targetUserId, posts, { priority: 'medium' });
        setUserPosts(await cacheProfilePostImages(posts));
      } catch (e) {
        console.warn('loadData -> /api/posts/user/:id failed:', e.message);
        if (!Array.isArray(cachedPosts)) setUserPosts([]);
      }
    } else if (!Array.isArray(cachedPosts)) {
      setUserPosts([]);
    }

    // 5. Saved (own only, non-fatal)
    if (isOwn) {
      try {
        const savedResponse = await axios.get(`${BASE_URL}/api/user/all-saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const posts = savedResponse.data.posts || [];
        setSavedPosts(posts);
        setSavedPostIds(posts.map(p => p._id));
      } catch (e) {
        console.warn('loadData -> /api/user/all-saved failed:', e.message);
      }
    } else {
      setSavedPosts([]);
      setSavedPostIds([]);
    }

    setLoading(false);
  };

  // ---------- Avatar upload (own profile only) ----------
  const uploadImage = async (uri) => {
    if (!isOwnProfile) return;
    setUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('avatar', {
        uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      const response = await axios.post(
        `${BASE_URL}/api/user/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { avatarUrl, user: updatedUser } = response.data;
      setAvatarUri(avatarUrl);
      setCurrentUser(updatedUser);
      setViewedUser(updatedUser);
      await syncStoredUser(updatedUser);
      Alert.alert('Success', 'Profile picture updated');
    } catch (error) {
      console.error('Upload error:', error?.message || error);
      Alert.alert('Error', 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const compressImage = async (uri) => {
    try {
      let result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const response = await fetch(result.uri);
      const blob = await response.blob();
      if (blob.size > 300 * 1024) {
        result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 600 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );
      }
      return result.uri;
    } catch (error) {
      console.error('Compression error:', error);
      return uri;
    }
  };

  const pickImage = async () => {
    if (!isOwnProfile) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const compressedUri = await compressImage(result.assets[0].uri);
      await uploadImage(compressedUri);
    }
  };

  // ---------------------------------------------------------------
  // updateProfile — sanitises the payload before handing it to the
  // AuthContext so axios never tries to serialise an object where a
  // string is expected (which was the previous "Network Error").
  // ---------------------------------------------------------------
  const updateProfile = async () => {
    if (!isOwnProfile) return;

    const user = viewedUser || currentUser;
    if (!user) return;

    const originalName = String(user.name || user.username || '');
    const originalUsername = String(user.username || '');
    const originalLocation = String(user.location || '');
    const originalSocialLinks = (Array.isArray(user.socialLinks) ? user.socialLinks : [])
      .filter(l => typeof l === 'string' && l.trim());

    // Sanitised new values
    const newName = String(editName || '').trim();
    const newUsername = String(editUsername || '').trim();
    const newLocation = String(editLocation || '').trim();
    const newSocialLinks = (Array.isArray(editSocialLinks) ? editSocialLinks : [])
      .map(link => (typeof link === 'string' ? link.trim() : ''))
      .filter(Boolean);

    const nameChanged = newName !== originalName;
    const usernameChanged = newUsername !== originalUsername;
    const locationChanged = newLocation !== originalLocation;
    const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(originalSocialLinks);

    if (!nameChanged && !usernameChanged && !locationChanged && !socialLinksChanged) {
      setEditSheetVisible(false);
      return;
    }

    const payload = {
      name: newName,
      username: newUsername,
      location: newLocation,
      socialLinks: newSocialLinks,
    };

    // Safety check — never send an object where a string is expected
    if (typeof payload.username !== 'string' || typeof payload.location !== 'string') {
      Alert.alert('Error', 'Invalid profile data. Please check your inputs.');
      return;
    }

    try {
      console.log('updateProfile payload =', JSON.stringify(payload));
      const authUpdate = await updateAuthUser(payload);

      if (authUpdate?.success) {
        const updatedUser = authUpdate.user || { ...user, ...payload };
        setCurrentUser(updatedUser);
        setViewedUser(updatedUser);
        setAvatarUri(updatedUser.avatar || null);
        setName(updatedUser.name || updatedUser.username || '');
        setSocialLinks(Array.isArray(updatedUser.socialLinks) ? updatedUser.socialLinks.filter(l => typeof l === 'string') : newSocialLinks);
        setUsername(updatedUser.username || updatedUser.phone || '');
        await syncStoredUser(updatedUser);
        Alert.alert('Success', t.profileUpdated);
        setEditSheetVisible(false);
      } else {
        Alert.alert('Error', authUpdate?.message || t.updateFailed);
      }
    } catch (error) {
      console.error('Update profile error:', error?.response?.data || error?.message || error);
      Alert.alert('Error', t.updateFailed);
    }
  };

  const deletePost = async (postId) => {
    if (!isOwnProfile) return;
    try {
      const token = await getToken();
      await axios.delete(`${BASE_URL}/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Could not delete post.');
    }
  };

  const confirmDeletePost = (postId) => {
    if (!isOwnProfile) return;
    Alert.alert(
      t.deletePost,
      t.deleteConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: () => deletePost(postId) },
      ]
    );
  };

  // ---------- Toggle save (unsave) ----------
  const toggleSavePost = async (post) => {
    if (!isOwnProfile) return;
    try {
      const token = await getToken();
      const response = await axios.post(
        `${BASE_URL}/api/posts/save/${post._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success && !response.data.saved) {
        setSavedPosts(prev => prev.filter(p => p._id !== post._id));
        setSavedPostIds(prev => prev.filter(id => id !== post._id));
      }
    } catch (error) {
      console.error('Toggle save error:', error);
      Alert.alert('Error', 'Failed to unsave post');
    }
  };

  // ---------- Logout Bottom Sheet ----------
  const openLogoutSheet = () => {
    closeSidebar();
    setLogoutSheetVisible(true);
  };
  const closeLogoutSheet = () => setLogoutSheetVisible(false);
  const handleLogout = () => openLogoutSheet();

  const confirmLogout = async () => {
    closeLogoutSheet();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleOpenUserChat = () => {
    const user = viewedUser || currentUser;
    const targetUserId = normaliseUserId(user?._id || user?.id || user?.userId);
    const targetUserName = user?.username || user?.name || 'User';
    const targetUserPhone = user?.phone || '';
    const currentUserId = normaliseUserId(currentUser?._id || currentUser?.id || currentUser?.userId);

    if (!targetUserId) {
      Alert.alert('Error', 'User information is unavailable.');
      return;
    }

    if (currentUserId && String(currentUserId) === String(targetUserId)) {
      Alert.alert('Info', 'You cannot message yourself.');
      return;
    }

    navigation.navigate('Chat', {
      sellerId: targetUserId,
      sellerName: targetUserName,
      sellerPhone: targetUserPhone,
      postId: '',
      postTitle: '',
      replyPost: null,
    });
  };

  // ---------- Sidebar ----------
  const handleMenuOption = (option) => {
    closeSidebar();
    if (option === 'addPost') {
      try { navigation.navigate('AddPost'); } catch (e) { Alert.alert('Error', 'AddPost screen not found.'); }
    } else if (option === 'home') {
      try { navigation.navigate('Main', { screen: 'WelcomeHome' }); } catch (e) { Alert.alert('Error', 'Home screen not found.'); }
    } else if (option === 'map') {
      try { navigation.navigate('Map'); } catch (e) { Alert.alert('Error', 'Map screen not found.'); }
    } else if (option === 'search') {
      try { navigation.navigate('Search'); } catch (e) { Alert.alert('Error', 'Search screen not found.'); }
    } else if (option === 'messages') {
      try { navigation.navigate('Message'); } catch (e) { Alert.alert('Error', 'Messages screen not found.'); }
    } else if (option === 'notifications') {
      try { navigation.navigate('Notifications'); } catch (e) { Alert.alert('Error', 'Notifications screen not found.'); }
    } else if (option === 'settings') {
      try { navigation.navigate('Main', { screen: 'Settings' }); } catch (e) { Alert.alert('Error', 'Settings screen not found.'); }
    } else if (option === 'logout') {
      handleLogout();
    }
  };

  const openSidebar = () => {
    if (!isOwnProfile) return;
    setSidebarVisible(true);
  };
  const closeSidebar = () => setSidebarVisible(false);

  // ---------- Edit Sheet ----------
  const openEditSheet = () => {
    const user = viewedUser || currentUser;
    setEditName(String(user?.name || user?.username || ''));
    setEditUsername(String(user?.username || ''));
    setEditLocation(String(user?.location || ''));
    const sanitized = (Array.isArray(user?.socialLinks) ? user.socialLinks : [])
      .filter(l => typeof l === 'string')
      .slice(0, 3);
    while (sanitized.length < 3) sanitized.push('');
    setEditSocialLinks(sanitized);
    setEditSheetVisible(true);
  };
  const closeEditSheet = () => setEditSheetVisible(false);

  // ---------- Render helpers ----------
  const isVideoPost = (post) => Boolean(post.videoUrl || post.video || post.mediaUrl);

  const renderGridPostItem = ({ item }) => {
    const isSavedTab = activeTab === 'saved';
    const showDelete = isOwnProfile && !isSavedTab;

    return (
      <View style={styles.gridPostItem}>
        <PostCoverTile
          post={item}
          style={styles.gridPostCover}
          onPress={() => {
            navigation.navigate('PostDetail', { house: item, language });
          }}
        >
          {isSavedTab && isOwnProfile && (
            <TouchableOpacity
              style={[styles.unsaveButton,{backgroundColor: isDarkMode ? '#111' : '#dddd'}]}
              onPress={(e) => {
                e?.stopPropagation?.();
                toggleSavePost(item);
              }}
            >
              <Ionicons name="bookmark" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {showDelete && (
            <TouchableOpacity
              style={[
                styles.deleteButton,
                {
                  backgroundColor: isDarkMode ? '#111' : '#dddd',
                },
              ]}
              onPress={(e) => {
                e?.stopPropagation?.();
                confirmDeletePost(item._id);
              }}
            >
              <View style={styles.gridMenuIconWrapper}>
                <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineShort, { backgroundColor: '#47ae87' }]} />
                <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineLong, { backgroundColor: '#47ae87' }]} />
                <View style={[styles.gridMenuIconLine, styles.gridMenuIconLineMid, { backgroundColor: '#47ae87' }]} />
              </View>
            </TouchableOpacity>
          )}
        </PostCoverTile>
      </View>
    );
  };

  const renderProfileHeader = () => {
    const user = viewedUser || currentUser;
    if (!user) return null;

    const videoCount = userPosts.filter(isVideoPost).length;
    const savedCount = savedPosts.length;

    const coverImage = user.coverImage || user.coverPhoto || user.bannerImage;
    const coverSource = coverImage
      ? { uri: coverImage }
      : require('../assets/house.png');

    return (
      <View style={styles.referenceProfileHeader}>
        <View style={styles.coverImageWrap}>
          <Image source={coverSource} style={styles.coverImage} />
          <View style={styles.coverShade} />
          <TouchableOpacity
            style={styles.profileBackButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={styles.referenceProfileBody}>
          <TouchableOpacity
            onPress={isOwnProfile ? pickImage : undefined}
            style={styles.referenceAvatarWrap}
            disabled={!isOwnProfile || uploading}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.referenceAvatar} />
            ) : (
              <View style={[styles.referenceAvatar, styles.referenceAvatarPlaceholder, { backgroundColor: theme.accent }]}>
                <Text style={styles.avatarInitialsRow}>{String(username || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {isOwnProfile && <View style={styles.referenceAvatarEdit}><Ionicons name="camera" size={16} color="#fff" /></View>}
          </TouchableOpacity>

          <Text style={[styles.referenceUsername, { color: theme.text }]} numberOfLines={1}>{name || username || 'User'}</Text>
          <Text style={[styles.referenceHandle, { color: theme.textSecondary }]}>@{(username || 'user').toLowerCase().replace(/\s+/g, '')}</Text>

          <View style={styles.referenceStatsRow}>
            <View style={styles.referenceStat}>
              <Text style={[styles.referenceStatNumber, { color: theme.text }]}>{userPosts.length}</Text>
              <Text style={[styles.referenceStatLabel, { color: theme.textSecondary }]}>{t.posts}</Text>
            </View>
            <View style={styles.referenceStatDivider} />
            <View style={styles.referenceStat}>
              <Text style={[styles.referenceStatNumber, { color: theme.text }]}>{videoCount}</Text>
              <Text style={[styles.referenceStatLabel, { color: theme.textSecondary }]}>{t.videos}</Text>
            </View>
            {isOwnProfile && (
              <>
                <View style={styles.referenceStatDivider} />
                <View style={styles.referenceStat}>
                  <Text style={[styles.referenceStatNumber, { color: theme.text }]}>{savedCount}</Text>
                  <Text style={[styles.referenceStatLabel, { color: theme.textSecondary }]}>{t.saved}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.referenceActionRow}>
            {isOwnProfile ? (
              <TouchableOpacity style={[styles.referenceActionButton, { backgroundColor: theme.accent }]} onPress={openEditSheet}>
                <Text style={styles.referencePrimaryActionText}>{t.editProfile}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.referenceActionButton, { backgroundColor: theme.accent }]} onPress={handleOpenUserChat}>
                <Text style={styles.referencePrimaryActionText}>Message</Text>
              </TouchableOpacity>
            )}

            {isOwnProfile && (
              <TouchableOpacity
                style={[styles.referenceActionButton, styles.referenceMenuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={openSidebar}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
              >
                <View style={styles.referenceMenuIconWrap}>
                  <View style={[styles.referenceMenuLine, styles.referenceMenuLineTop]} />
                  <View style={[styles.referenceMenuLine, styles.referenceMenuLineMiddle]} />
                  <View style={[styles.referenceMenuLine, styles.referenceMenuLineBottom]} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {(user.bio || user.location || (socialLinks && socialLinks.length > 0)) && (
            <View style={styles.profileBioSection}>
              {user.bio ? (
                <Text style={[styles.profileBio, { color: theme.text }]}>{user.bio}</Text>
              ) : null}
              {user.location ? (
                <Text style={[styles.profileLocation, { color: theme.textSecondary }]}>
                  {user.location}
                </Text>
              ) : null}
              {(socialLinks && socialLinks.length > 0) ? (
                <View style={styles.socialLinksRow}>
                  {socialLinks.map((link, index) => (
                    <TouchableOpacity
                      key={`${link}-${index}`}
                      onPress={() => {
                        if (typeof link !== 'string') return;
                        Linking.openURL(link).catch(() => Alert.alert('Invalid link', 'Unable to open this link.'));
                      }}
                      style={[styles.socialLinkItem, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                    >
                      <Ionicons name="link-outline" size={14} color={theme.text} />
                      <Text style={[styles.socialLinkText, { color: theme.text }]} numberOfLines={1}>
                        {String(link).replace(/^https?:\/\//, '')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTabBar = () => {
    const tabs = [
      { key: 'posts', label: t.posts },
      { key: 'videos', label: t.videos },
      ...(isOwnProfile ? [{ key: 'saved', label: t.saved }] : []),
    ];
    return (
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? theme.text : theme.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {renderProfileHeader()}
      {renderTabBar()}
    </>
  );

  // ---------- Empty-state navigation ----------
  const handleCreateFirstVideo = () => {
    if (!isOwnProfile) return;
    try {
      navigation.navigate('AddPost', { mediaType: 'video' });
    } catch (e) {
      Alert.alert('Error', 'AddPost screen not found.');
    }
  };

  const handleAddFirstPost = () => {
    if (!isOwnProfile) return;
    try {
      navigation.navigate('AddPost');
    } catch (e) {
      Alert.alert('Error', 'AddPost screen not found.');
    }
  };

  const handleSaveFirstPost = () => {
    try {
      navigation.navigate('Main', { screen: 'BuyPost', params: { activeTab: 'ushaka' } });
    } catch (e) {
      Alert.alert('Error', 'BuyPost screen not found.');
    }
  };

  const ListEmpty = () => {
    // Load error → show retry
    if (loadError && !loading) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            {t.profileLoadFailed}
          </Text>
          <TouchableOpacity
            style={[styles.emptyPrimaryButton, { backgroundColor: theme.accent }]}
            onPress={handleRefresh}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.emptyPrimaryButtonText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ShaakaLoadingScreen
            message={t.loading}
            backgroundColor={theme.background}
            textColor={theme.textSecondary}
            compact
          />
        </View>
      );
    }

    // SAVED
    if (activeTab === 'saved') {
      return (
        <View style={styles.emptyState}>
          {isOwnProfile ? (
            <TouchableOpacity onPress={handleSaveFirstPost} accessibilityRole="button" accessibilityLabel={t.explorePosts}>
              <Ionicons name="bookmark-outline" size={64} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="bookmark-outline" size={64} color={theme.textSecondary} />
          )}
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t.noSavedPosts}</Text>
        </View>
      );
    }

    // VIDEOS
    if (activeTab === 'videos') {
      if (isOwnProfile) {
        return (
          <TouchableOpacity
            style={styles.emptyState}
            activeOpacity={0.75}
            onPress={handleCreateFirstVideo}
          >
            <Ionicons name="videocam-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t.noVideos}</Text>
           
          </TouchableOpacity>
        );
      }
      return (
        <View style={styles.emptyState}>
          <Ionicons name="videocam-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t.noVideos}</Text>
        </View>
      );
    }

    // POSTS
    return (
      <View style={styles.emptyState}>
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleAddFirstPost} accessibilityRole="button" accessibilityLabel={t.addFirstPost}>
            <Ionicons name="images-outline" size={64} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="images-outline" size={64} color={theme.textSecondary} />
        )}
        <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t.noPosts}</Text>
      </View>
    );
  };

  const sidebarBorderColor = isDarkMode ? '#3a3a3c' : '#d0d0d0';

  const effectiveTab = activeTab === 'saved' && !isOwnProfile ? 'posts' : activeTab;

  const currentData =
    effectiveTab === 'saved'
      ? savedPosts
      : effectiveTab === 'videos'
        ? userPosts.filter(isVideoPost)
        : userPosts;

  if (loading && !viewedUser && !currentUser) {
    return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.text} />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <FlatList
        key={effectiveTab}
        ListHeaderComponent={ListHeader}
        data={currentData}
        keyExtractor={(item) => item._id}
        renderItem={renderGridPostItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.postsGrid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmpty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {isOwnProfile && sidebarVisible && (
        <TouchableWithoutFeedback onPress={closeSidebar}>
          <View style={styles.transparentOverlay} />
        </TouchableWithoutFeedback>
      )}

      {isOwnProfile && sidebarVisible && (
        <Animated.View
          style={[
            styles.sidebar,
            {
              backgroundColor: theme.background,
              borderLeftColor: sidebarBorderColor,
              transform: [{ translateX: sidebarSlideAnim }],
            },
          ]}
          {...sidebarPanResponder.panHandlers}
        >
          <View style={styles.sidebarContent}>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('addPost')}>
              <Ionicons name="add-circle-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Add Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('home')}>
              <Ionicons name="home-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('map')}>
              <Ionicons name="map-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('search')}>
              <Ionicons name="search-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('messages')}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('notifications')}>
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('settings')}>
              <Ionicons name="settings-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>{t.settings}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarOption} onPress={() => handleMenuOption('logout')}>
              <Ionicons name="log-out-outline" size={20} color="#d87428" />
              <Text style={[styles.sidebarOptionText, { color: '#d87428' }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* LOGOUT BOTTOM SHEET */}
      {logoutSheetVisible && (
        <>
          <TouchableWithoutFeedback onPress={closeLogoutSheet}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.logoutBottomSheet,
              {
                backgroundColor: theme.background,
                borderTopColor: theme.border,
                transform: [{ translateY: logoutSlideAnim }],
              },
            ]}
            {...logoutPanResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.logoutConfirmTitle}</Text>
              <TouchableOpacity onPress={closeLogoutSheet} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.logoutConfirmMsg, { color: theme.textSecondary }]}>
              {t.logoutConfirmMessage}
            </Text>
            <View style={styles.logoutButtons}>
              <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: '#47ae87' }]} onPress={closeLogoutSheet}>
                <Text style={styles.logoutBtnText}>{t.no}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: '#d87428' }]} onPress={confirmLogout}>
                <Text style={styles.logoutBtnText}>{t.yes}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}

      {/* EDIT PROFILE SHEET */}
      {isOwnProfile && editSheetVisible && (
        <>
          <TouchableWithoutFeedback onPress={closeEditSheet}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.editBottomSheet,
              {
                backgroundColor: theme.background,
                borderTopColor: theme.border,
                transform: [{ translateY: slideAnim }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.editProfile}</Text>
              <TouchableOpacity onPress={closeEditSheet} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <TextInput
                style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                placeholder="Name"
                placeholderTextColor={theme.textSecondary}
                value={editName}
                onChangeText={setEditName}
              />
              <TextInput
                style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                placeholder={t.username}
                placeholderTextColor={theme.textSecondary}
                value={editUsername}
                onChangeText={setEditUsername}
              />
              <TextInput
                style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                placeholder={t.location}
                placeholderTextColor={theme.textSecondary}
                value={editLocation}
                onChangeText={setEditLocation}
              />

              <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>Social Links</Text>
              {[0, 1, 2].map((index) => (
                <TextInput
                  key={`social-link-${index}`}
                  style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                  placeholder={`Social link ${index + 1}`}
                  placeholderTextColor={theme.textSecondary}
                  value={String(editSocialLinks[index] || '')}
                  onChangeText={(value) => {
                    const updated = [...editSocialLinks];
                    updated[index] = value;
                    setEditSocialLinks(updated);
                  }}
                />
              ))}

              <View style={styles.sheetButtons}>
                <TouchableOpacity onPress={closeEditSheet} style={[styles.sheetCancelBtn, { borderColor: theme.border }]}>
                  <Text style={{ color: theme.textSecondary }}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={updateProfile} style={[styles.sheetSaveBtn, { backgroundColor: theme.accent }]}>
                  <Text style={{ color: 'white', fontWeight: '600' }}>{t.save}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  referenceProfileHeader: { backgroundColor: 'transparent' },
  coverImageWrap: { height: 178, width: '100%', position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
  profileBackButton: { position: 'absolute', top: 14, right: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  referenceProfileBody: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  referenceAvatarWrap: { width: 86, height: 86, marginTop: -43, borderRadius: 43, padding: 4, backgroundColor: '#fff', zIndex: 2 },
  referenceAvatar: { width: 78, height: 78, borderRadius: 39 },
  referenceAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  referenceAvatarEdit: { position: 'absolute', right: -2, bottom: 2, width: 25, height: 25, borderRadius: 13, backgroundColor: '#666', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  referenceUsername: { marginTop: 8, fontSize: 22, fontWeight: '700' },
  referenceHandle: { marginTop: 2, fontSize: 12 },
  referenceStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 16 },
  referenceStat: { alignItems: 'center', minWidth: 82 },
  referenceStatNumber: { fontSize: 16, fontWeight: '500' },
  referenceStatLabel: { fontSize: 11, marginTop: 4 },
  referenceStatDivider: { width: 1, height: 28, backgroundColor: '#d8d8d8' },
  referenceActionRow: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  referenceActionButton: { minWidth: 108, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, alignItems: 'center' },
  referenceMenuButton: { minWidth: 52, width: 52, paddingHorizontal: 0, paddingVertical: 10, borderWidth: 1 },
  referenceMenuIconWrap: { width: 22, height: 16, justifyContent: 'space-between' },
  referenceMenuLine: { height: 2, borderRadius: 2, backgroundColor: '#47ae87' },
  referenceMenuLineTop: { width: '60%', alignSelf: 'flex-start' },
  referenceMenuLineMiddle: { width: '100%' },
  referenceMenuLineBottom: { width: '70%', alignSelf: 'flex-end' },
  referencePrimaryActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    borderBottomWidth: 0,
    borderBottomColor: '#e0e0e0',
  },
  avatarColumn: { alignItems: 'center', position: 'relative', marginRight: 16 },
  avatarRow: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholderRow: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarInitialsRow: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  editIconRow: { position: 'absolute', bottom: 30, right: 0, backgroundColor: '#7a7a7a', borderRadius: 14, padding: 4 },
  usernameUnderAvatar: { marginTop: 8, fontSize: 16, fontWeight: '600', textAlign: 'center', maxWidth: 80 },
  profileStatsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginLeft: 16, alignSelf: 'center' },
  statItemCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 2 },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  menuIconWrapper: { width: 20, height: 15, flexDirection: 'column', justifyContent: 'space-between', marginBottom: 4 },
  menuIconLine: { backgroundColor: '#47ae87', borderRadius: 2, height: 2 },
  menuIconLineFirst: { width: '50%', alignSelf: 'flex-start' },
  menuIconLineFull: { width: '100%' },
  menuIconLineLast: { width: '50%', alignSelf: 'flex-end' },
  profileBioSection: { marginHorizontal: 20, marginTop: 12, alignItems: 'center' },
  profileBio: { fontSize: 14, marginTop: 0, lineHeight: 20, textAlign: 'center' },
  profileLocation: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  socialLinksRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, justifyContent: 'space-between', width: '100%' },
  socialLinkItem: { flexDirection: 'row', alignItems: 'center', width: '48%', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 0, marginBottom: 8 },
  socialLinkText: { marginLeft: 6, fontSize: 12, flex: 1 },
  editProfileButton: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  editProfileButtonText: { color: '#fff', fontWeight: '700' },
  postsGrid: { paddingHorizontal: 8, paddingBottom: 80 },
  gridRow: { justifyContent: 'space-between', marginBottom: 8 },
  gridPostItem: { width: (width - 32) / 2, aspectRatio: 1, marginBottom: 8, position: 'relative' },

  /* ---------- Full-bleed cover tile ---------- */
  gridPostCover: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#262626',
  },
  coverTile: { position: 'relative', overflow: 'hidden' },
  coverTileImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverTileFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a2a' },
  coverTileShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  coverTileLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 32,
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  coverTileVideoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Overlay action buttons */
 deleteButton: {
  position: 'absolute',
  top: 0,
  right: 0,
  padding: 5,                 // ← no padding
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomRightRadius: 0,
  borderBottomLeftRadius: 12, // ← only bottom-left rounded
  zIndex: 5,
},
 gridMenuIconWrapper: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  gridMenuIconLine: { borderRadius: 999, height: 2, marginVertical: 1.5 },
  gridMenuIconLineShort: { width: '42%' },
  gridMenuIconLineMid: { width: '72%' },
  gridMenuIconLineLong: { width: '100%' },
  unsaveButton: { position: 'absolute', bottom: 0, right: 0,  borderTopLeftRadius: 12, padding: 5, zIndex: 5 },

  tabBar: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, paddingTop: 4, paddingBottom: 0, marginTop: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: '500' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#47ae87' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyStateText: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center' },
  emptyPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    marginTop: 20,
    minWidth: 220,
  },
  emptyPrimaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  transparentOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', zIndex: 10 },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 25,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    paddingHorizontal: 16,
    paddingVertical: 50,
    justifyContent: 'flex-start',
  },
  sidebarContent: { flex: 1, justifyContent: 'flex-start' },
  sidebarOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0 },
  sidebarOptionText: { fontSize: 16, marginLeft: 12, fontWeight: '500' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
  editBottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    zIndex: 101,
  },
  logoutBottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: LOGOUT_SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    zIndex: 101,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold' },
  sheetCloseBtn: { padding: 4 },
  sheetContent: { flex: 1 },
  sheetInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  sheetLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20, gap: 12 },
  sheetCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  sheetSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  logoutConfirmMsg: { fontSize: 15, textAlign: 'center', marginBottom: 24, marginTop: 8, lineHeight: 22 },
  logoutButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  logoutBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});

export default ProfileScreen;