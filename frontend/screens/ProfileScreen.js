import { getAuthToken } from '../utils/authStorage';
// screens/ProfileScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
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
import OnlineStatusDot from '../components/OnlineStatusDot';
import useOnlineUsers from '../hooks/useOnlineUsers';
import ScreenTutorialOverlay from '../components/ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';
import { getImageUri, normalizeImageUrl } from '../utils/imageUrl';
import { getPostCoverUri } from '../utils/postMedia';

const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.5;

const BOTTOM_SHEET_HEIGHT = height * 0.7;
const LOGOUT_SHEET_HEIGHT = height * 0.3;

// ---------- Field length limits ----------
const MAX_NAME_LENGTH = 15;
const MAX_USERNAME_LENGTH = 15;
const MAX_LOCATION_LENGTH = 20;
const MAX_LINK_LENGTH = 100;

const SHEET_ANIMATION_MS = 220;
const FOCUS_ACCENT = '#47ae87';  // light blue accent for focused field

// ---- Tutorial config ---------------------------------------------------------
const PROFILE_TUTORIAL_DELAY_MS = 700;
const PROFILE_TUTORIAL_ID = 'profile';

// -----------------------------------------------------------------------------

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
    changePassword: 'Password',
    logout: 'Logout',
    post: 'Post',
    editProfile: 'Edit Profile',
    username: 'Username',
    location: 'Location',
    cancel: 'Cancel',
    save: 'Save',
    logoutConfirmTitle: 'Are you sure you want to log out?',
    logoutConfirmMessage: 'You are about to log out of your Shaaka account. You will need to sign in again to continue.',
    logoutConfirmButton: 'Confirm Logout',
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
    name: 'Name',
    socialLinks: 'Social Links',
    socialLink: 'Social link',
    charsRemaining: 'characters remaining',
    charsRemainingOne: 'character remaining',
    // Tutorial
    tAvatarTitle: 'Your profile photo',
    tAvatarBody: 'Tap your avatar to change it. A good photo helps buyers trust you.',
    tNameTitle: 'Your name',
    tNameBody: 'This is how other users see you across Shaaka.',
    tStatsTitle: 'Your activity',
    tStatsBody: 'See how many posts, videos, and saved items you have.',
    tEditTitle: 'Change profile',
    tEditBody: 'Tap "Edit Profile" to update your name, username, location, and social links.',
    tMenuTitle: 'Menu',
    tMenuBody: 'Tap these three lines to open the menu — quick access to Add Post, Map, Search, Settings, and Logout.',
    tDeleteTitle: 'Delete or unsave',
    tDeleteBody: 'Tap these 3 lines on any post to delete it. On saved posts, tap the bookmark icon at the bottom-right to unsave.',
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
    changePassword: 'Ijambo banga',
    logout: 'Sohoka',
    post: 'Igicuruzwa',
    editProfile: 'Hindura Ibikuranga',
    username: 'Izina',
    location: 'Aho uherereye',
    cancel: 'Reka',
    save: 'Bika',
    logoutConfirmTitle: 'Ese usha gusohoka?',
    logoutConfirmMessage: 'Ugiye gusohoka muri konti yawe ya Shaaka. Uzasabwa kongera kwinjira kugira ngo ukomeze.',
    logoutConfirmButton: 'Emeza gusohoka',
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
    name: 'Amazina',
    socialLinks: 'Imiyoboro rusange',
    socialLink: 'Umuyoboro rusange',
    charsRemaining: 'inyuguti zisigaye',
    charsRemainingOne: 'inyuguti isigaye',
    // Tutorial
    tAvatarTitle: "Ifoto yawe",
    tAvatarBody: "Kanda ku ifoto yawe kugira ngo uyihindure. Ifoto nziza ifasha abagura kukwizera.",
    tNameTitle: 'Izina ryawe',
    tNameBody: "Aya ni amazina abandi bakoresha babona kuri Shaaka.",
    tStatsTitle: 'Ibyakorwa',
    tStatsBody: "Reba umubare w'ibicuruzwa, videwo, n'ibyabitswe ufite.",
    tEditTitle: 'Hindura Ibikuranga',
    tEditBody: "Kanda 'Hindura Ibikuranga' kugira ngo uhindure amazina, izina rikoreshwa, aho uherereye, n'imiyoboro rusange.",
    tMenuTitle: 'Menyu',
    tMenuBody: "Kanda kuri iyi mirongo itatu kugira ngo ufungure menyu — Ongeraho Igicuruzwa, Ikarita, Shakisha, Igenamiterere, no Gusohoka.",
    tDeleteTitle: 'Siba cyangwa ukure ku byabitswe',
    tDeleteBody: "Kanda kuri iyi mirongo itatu ku gicuruzwa cyose kugira ngo ugisibe. Ku bicuruzwa byabitswe, kanda ku kamenyetso k'igitabo kuri iburyo hasi kugira ngo ugikureho.",
  },
};

// ---------- Helpers ----------
const resolvePostImageUri = (post) => {
  return getPostCoverUri(post)
    || getImageUri(post?.thumbnail)
    || getImageUri(post?.coverPhoto)
    || getImageUri(post?.bannerImage)
    || getImageUri(post?.mediaUrl)
    || getImageUri(Array.isArray(post?.images) ? post.images.find(Boolean) : null)
    || getImageUri(Array.isArray(post?.imageUrls) ? post.imageUrls.find(Boolean) : null);
};

const resolvePostVideoCover = (post) => {
  const videoUrl = getImageUri(post?.videoUrl || post?.video?.url || post?.video);
  if (!videoUrl) return null;
  const videoThumbnail = getImageUri(post.videoThumbnail);
  if (videoThumbnail) return videoThumbnail;
  if (!videoUrl.includes('res.cloudinary.com')) return null;
  const [urlWithoutQuery] = videoUrl.split('?');
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

const sanitizeNameField = (text) =>
  String(text || '')
    .replace(/[^a-zA-ZÀ-ÿ\s'\-\.]/g, '')
    .slice(0, MAX_NAME_LENGTH);

const sanitizeUsernameField = (text) =>
  String(text || '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, MAX_USERNAME_LENGTH);

const sanitizeLocationField = (text) =>
  String(text || '')
    .replace(/[^a-zA-ZÀ-ÿ0-9\s'\-\.\,]/g, '')
    .slice(0, MAX_LOCATION_LENGTH);

const cacheProfileUserImages = async (user) => {
  if (!user) return user;
  const imageFields = ['avatar', 'coverImage', 'coverPhoto', 'bannerImage'];
  const cachedImages = await Promise.all(imageFields.map(async key => {
    const imageUri = getImageUri(user[key]);
    return imageUri ? mediaCache.cacheImage(imageUri) : user[key];
  }));
  return imageFields.reduce((cachedUser, key, index) => {
    cachedUser[key] = cachedImages[index];
    return cachedUser;
  }, { ...user });
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

// ============================================================
// FloatingLabelInput — Material 3 outlined field
// ============================================================
const FloatingLabelInput = ({
  label,
  value,
  onChangeText,
  theme,
  maxLength,
  helperText,
  suffix,
  helperWarning = false,
  style,
  ...textInputProps
}) => {
  const [focused, setFocused] = useState(false);

  const idleBorderColor = theme.border || '#8e8e93';
  const borderColor = focused ? FOCUS_ACCENT : idleBorderColor;
  const labelColor = focused ? FOCUS_ACCENT : theme.textSecondary;
  const helperColor = helperWarning ? '#d87428' : theme.textSecondary;

  return (
    <View style={[styles.floatingFieldWrapper, style]}>
      <View style={[styles.floatingFieldBox, { borderColor }]}>
        <TextInput
          style={[styles.floatingInput, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.textSecondary}
          {...textInputProps}
        />

        {suffix ? (
          <Text style={[styles.floatingSuffix, { color: theme.textSecondary }]}>
            {suffix}
          </Text>
        ) : null}

        <View
          style={[styles.floatingLabelMask, { backgroundColor: theme.background }]}
          pointerEvents="none"
        >
          <Text style={[styles.floatingLabelText, { color: labelColor }]}>
            {label}
          </Text>
        </View>
      </View>

      {helperText ? (
        <Text style={[styles.floatingHelper, { color: helperColor }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

// ---------- PostCoverTile ----------
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
          source={{ uri: normalizeImageUrl(imageUri) }}
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

      <View style={styles.coverTileShade} pointerEvents="none" />

      {!!label && (
        <Text style={styles.coverTileLabel} numberOfLines={2}>
          {label}
        </Text>
      )}

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
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const profileTargetIdRef = useRef(null);
  const profileUserVersionRef = useRef(0);
  const profilePostsVersionRef = useRef(0);

  // Edit Profile Bottom Sheet
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editSheetMounted, setEditSheetMounted] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSocialLinks, setEditSocialLinks] = useState(['', '', '']);
  const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
  const editSheetUnmountTimer = useRef(null);

  // Logout Bottom Sheet
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const [logoutSheetMounted, setLogoutSheetMounted] = useState(false);
  const logoutSlideAnim = useRef(new Animated.Value(LOGOUT_SHEET_HEIGHT)).current;
  const logoutSheetUnmountTimer = useRef(null);

  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const sidebarSlideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const sidebarUnmountTimer = useRef(null);

  // ---- Tutorial refs ----
  const profileAvatarRef = useRef(null);
  const profileNameRef = useRef(null);
  const profileStatsRef = useRef(null);
  const profileEditBtnRef = useRef(null);
  const profileMenuBtnRef = useRef(null);
  const firstDeleteBtnRef = useRef(null);   // first post's "3-lines" delete button
  const firstUnsaveBtnRef = useRef(null);   // first saved post's bookmark button

  // ---- Tutorial state ----
  const [showTutorial, finishTutorial] = useScreenTutorial(
    PROFILE_TUTORIAL_ID,
    isFocused && isOwnProfile && !loading && !loadError,
    PROFILE_TUTORIAL_DELAY_MS
  );

  const profileUser = viewedUser || currentUser;
  const profileAvatarUri = avatarUri ? normalizeImageUrl(avatarUri) : null;
  const profileAvatarSource = profileAvatarUri ? { uri: profileAvatarUri } : null;
  const profileUserId = normaliseUserId(profileUser?._id || profileUser?.id || profileUser?.userId);
  const onlineUsers = useOnlineUsers(profileUserId ? [profileUserId] : []);
  const isViewedUserOnline = Boolean(
    !isOwnProfile && profileUserId && onlineUsers[profileUserId]
  );

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

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarUri]);

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

  // ---- Reset post-card refs when tab or posts change ----
  useEffect(() => {
    firstDeleteBtnRef.current = null;
    firstUnsaveBtnRef.current = null;
  }, [activeTab, userPosts.length, savedPosts.length]);

  useEffect(() => {
    if (!isOwnProfile && activeTab === 'saved') {
      setActiveTab('posts');
    }
  }, [isOwnProfile, activeTab]);

  useEffect(() => {
    if (sidebarVisible) {
      Animated.timing(sidebarSlideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(sidebarSlideAnim, { toValue: SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }).start();
    }
  }, [sidebarVisible]);

  useEffect(() => {
    if (editSheetVisible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: BOTTOM_SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start();
    }
  }, [editSheetVisible]);

  useEffect(() => {
    if (logoutSheetVisible) {
      Animated.spring(logoutSlideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
    } else {
      Animated.timing(logoutSlideAnim, { toValue: LOGOUT_SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start();
    }
  }, [logoutSheetVisible]);

  useEffect(() => () => {
    if (sidebarUnmountTimer.current) clearTimeout(sidebarUnmountTimer.current);
    if (editSheetUnmountTimer.current) clearTimeout(editSheetUnmountTimer.current);
    if (logoutSheetUnmountTimer.current) clearTimeout(logoutSheetUnmountTimer.current);
  }, []);

  const getToken = useCallback(async () => getAuthToken('userToken'), []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const applyProfilePosts = (posts, targetUserId) => {
      const version = ++profilePostsVersionRef.current;
      setUserPosts(posts);
      cacheProfilePostImages(posts).then(cachedImages => {
        if (
          profileTargetIdRef.current === String(targetUserId) &&
          profilePostsVersionRef.current === version
        ) {
          setUserPosts(cachedImages);
        }
      }).catch(error => {
        console.warn('Profile post image caching failed:', error.message);
      });
    };

    const applyProfileUser = (user, targetUserId, isOwn) => {
      profileTargetIdRef.current = String(targetUserId);
      const version = ++profileUserVersionRef.current;
      setViewedUser(user);
      setAvatarUri(getImageUri(user.avatar));
      setUsername(user.username || user.phone || (isOwn ? '' : 'User'));
      setName(user.name || user.username || (isOwn ? '' : 'User'));
      setSocialLinks(Array.isArray(user.socialLinks)
        ? user.socialLinks.filter(link => typeof link === 'string')
        : []);
      setIsOwnProfile(isOwn);

      cacheProfileUserImages(user).then(cachedUser => {
        if (
          profileTargetIdRef.current === String(targetUserId) &&
          profileUserVersionRef.current === version
        ) {
          setViewedUser(cachedUser);
          setAvatarUri(getImageUri(cachedUser.avatar));
        }
      }).catch(error => {
        console.warn('Profile image caching failed:', error.message);
      });
    };

    const token = await getToken();
    if (!token) {
      navigation.replace('Login');
      return;
    }

    let me = null;
    try {
      const cached = await AsyncStorage.getItem('user');
      if (cached) me = JSON.parse(cached);
    } catch (error) {
      console.warn('Could not read cached profile user:', error.message);
    }

    if (me) setCurrentUser(me);
    const cachedMyId = normaliseUserId(me?._id) || normaliseUserId(me?.phone);
    const normalisedParamUserId = normaliseUserId(paramUserId);
    const cachedTargetUserId = normalisedParamUserId || cachedMyId;
    const cachedOwnProfile = Boolean(
      cachedMyId && (!normalisedParamUserId || String(normalisedParamUserId) === String(cachedMyId))
    );
    if (cachedTargetUserId) profileTargetIdRef.current = String(cachedTargetUserId);

    if (cachedOwnProfile) {
      applyProfileUser(me, cachedMyId, true);
    } else if (cachedTargetUserId) {
      try {
        const cachedProfile = await offlineDatabase.getRecord('profiles', cachedTargetUserId);
        if (cachedProfile) applyProfileUser(cachedProfile, cachedTargetUserId, false);
      } catch (error) {
        console.warn('Could not read cached profile:', error.message);
      }
    }

    if (cachedTargetUserId) {
      offlineDatabase.getRecord('profile-posts', cachedTargetUserId).then(cachedPosts => {
        if (!Array.isArray(cachedPosts) || profileTargetIdRef.current !== String(cachedTargetUserId)) return;
        applyProfilePosts(cachedPosts, cachedTargetUserId);
      }).catch(error => {
        console.warn('Could not read cached profile posts:', error.message);
      });
    }

    await networkStatus.start();
    const isOnline = networkStatus.get().isOnline;

    if (isOnline) {
      try {
        const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meResponse.data.success) {
          me = meResponse.data.user;
          setCurrentUser(me);
          AsyncStorage.setItem('user', JSON.stringify(me)).catch(error => {
            console.warn('Could not cache current profile user:', error.message);
          });
        }
      } catch (e) {
        console.warn('loadData -> /auth/me failed:', e.message);
      }
    }

    if (!me) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const myId = normaliseUserId(me._id) || normaliseUserId(me.phone);
    const isOwn = !normalisedParamUserId || String(normalisedParamUserId) === String(myId);

    let targetUserId = isOwn ? myId : normalisedParamUserId;

    if (!targetUserId) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    if (isOwn) {
      applyProfileUser(me, targetUserId, true);
    } else {
      let cachedOtherUser = null;
      try {
        cachedOtherUser = await offlineDatabase.getRecord('profiles', targetUserId);
      } catch {}

      let otherUser = { _id: targetUserId, username: paramUsername || 'User' };
      if (cachedOtherUser) {
        otherUser = cachedOtherUser;
      }
      if (isOnline) {
        try {
          const userResponse = await axios.get(
            `${BASE_URL}/api/user/${encodeURIComponent(targetUserId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (userResponse.data.success) {
            const fetchedUser = userResponse.data.user;
            offlineDatabase.putRecord('profiles', targetUserId, fetchedUser, { priority: 'medium' }).catch(error => {
              console.warn('Could not cache profile data:', error.message);
            });
            otherUser = fetchedUser;
          }
        } catch (e) {
          console.warn('loadData -> /api/user/:id failed:', e.message);
        }
      }
      applyProfileUser(otherUser, targetUserId, false);
    }

    let cachedPosts = null;
    try {
      cachedPosts = await offlineDatabase.getRecord('profile-posts', targetUserId);
      if (Array.isArray(cachedPosts)) {
        applyProfilePosts(cachedPosts, targetUserId);
      }
    } catch {}

    if (isOnline) {
      try {
        const postsResponse = await axios.get(
          `${BASE_URL}/api/posts/user/${encodeURIComponent(targetUserId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const posts = postsResponse.data.posts || [];
        applyProfilePosts(posts, targetUserId);
        offlineDatabase.putRecord('profile-posts', targetUserId, posts, { priority: 'medium' }).catch(error => {
          console.warn('Could not cache profile posts:', error.message);
        });
      } catch (e) {
        console.warn('loadData -> /api/posts/user/:id failed:', e.message);
        if (!Array.isArray(cachedPosts)) setUserPosts([]);
      }
    } else if (!Array.isArray(cachedPosts)) {
      setUserPosts([]);
    }

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
  }, [navigation, paramUserId, paramUsername]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ---------- Avatar upload ----------
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
      setAvatarUri(compressedUri);
      await uploadImage(compressedUri);
    }
  };

  const updateProfile = async () => {
    if (!isOwnProfile) return;

    const user = viewedUser || currentUser;
    if (!user) return;

    const originalName = String(user.name || user.username || '');
    const originalUsername = String(user.username || '');
    const originalLocation = String(user.location || '');
    const originalSocialLinks = (Array.isArray(user.socialLinks) ? user.socialLinks : [])
      .filter(l => typeof l === 'string' && l.trim());

    const newName = String(editName || '').trim().slice(0, MAX_NAME_LENGTH);
    const newUsername = String(editUsername || '').trim().slice(0, MAX_USERNAME_LENGTH);
    const newLocation = String(editLocation || '').trim().slice(0, MAX_LOCATION_LENGTH);
    const newSocialLinks = (Array.isArray(editSocialLinks) ? editSocialLinks : [])
      .map(link => (typeof link === 'string' ? link.trim() : ''))
      .filter(Boolean);

    if (
      newName.length > MAX_NAME_LENGTH ||
      newUsername.length > MAX_USERNAME_LENGTH ||
      newLocation.length > MAX_LOCATION_LENGTH ||
      newSocialLinks.some(link => link.length > MAX_LINK_LENGTH)
    ) {
      Alert.alert(
        'Error',
        `Name and username must be ${MAX_NAME_LENGTH} characters or less. Location must be ${MAX_LOCATION_LENGTH} characters or less.`
      );
      return;
    }

    const nameChanged = newName !== originalName;
    const usernameChanged = newUsername !== originalUsername;
    const locationChanged = newLocation !== originalLocation;
    const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(originalSocialLinks);

    if (!nameChanged && !usernameChanged && !locationChanged && !socialLinksChanged) {
      closeEditSheet();
      return;
    }

    const payload = {
      name: newName,
      username: newUsername,
      location: newLocation,
      socialLinks: newSocialLinks,
    };

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
        setAvatarUri(getImageUri(updatedUser.avatar));
        setName(updatedUser.name || updatedUser.username || '');
        setSocialLinks(Array.isArray(updatedUser.socialLinks) ? updatedUser.socialLinks.filter(l => typeof l === 'string') : newSocialLinks);
        setUsername(updatedUser.username || updatedUser.phone || '');
        await syncStoredUser(updatedUser);
        Alert.alert('Success', t.profileUpdated);
        closeEditSheet();
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

  const openSidebar = () => {
    if (!isOwnProfile) return;
    if (sidebarUnmountTimer.current) {
      clearTimeout(sidebarUnmountTimer.current);
      sidebarUnmountTimer.current = null;
    }
    setSidebarMounted(true);
    setSidebarVisible(true);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
    if (sidebarUnmountTimer.current) clearTimeout(sidebarUnmountTimer.current);
    sidebarUnmountTimer.current = setTimeout(() => {
      setSidebarMounted(false);
      sidebarUnmountTimer.current = null;
    }, SHEET_ANIMATION_MS);
  };

  const openEditSheet = () => {
    const user = viewedUser || currentUser;
    setEditName(String(user?.name || user?.username || '').slice(0, MAX_NAME_LENGTH));
    setEditUsername(String(user?.username || '').slice(0, MAX_USERNAME_LENGTH));
    setEditLocation(String(user?.location || '').slice(0, MAX_LOCATION_LENGTH));
    const sanitized = (Array.isArray(user?.socialLinks) ? user.socialLinks : [])
      .filter(l => typeof l === 'string')
      .slice(0, 3);
    while (sanitized.length < 3) sanitized.push('');
    setEditSocialLinks(sanitized);

    if (editSheetUnmountTimer.current) {
      clearTimeout(editSheetUnmountTimer.current);
      editSheetUnmountTimer.current = null;
    }
    setEditSheetMounted(true);
    setEditSheetVisible(true);
  };

  const closeEditSheet = () => {
    setEditSheetVisible(false);
    if (editSheetUnmountTimer.current) clearTimeout(editSheetUnmountTimer.current);
    editSheetUnmountTimer.current = setTimeout(() => {
      setEditSheetMounted(false);
      editSheetUnmountTimer.current = null;
    }, SHEET_ANIMATION_MS);
  };

  const openLogoutSheet = () => {
    closeSidebar();
    if (logoutSheetUnmountTimer.current) {
      clearTimeout(logoutSheetUnmountTimer.current);
      logoutSheetUnmountTimer.current = null;
    }
    setLogoutSheetMounted(true);
    setLogoutSheetVisible(true);
  };

  const closeLogoutSheet = () => {
    setLogoutSheetVisible(false);
    if (logoutSheetUnmountTimer.current) clearTimeout(logoutSheetUnmountTimer.current);
    logoutSheetUnmountTimer.current = setTimeout(() => {
      setLogoutSheetMounted(false);
      logoutSheetUnmountTimer.current = null;
    }, SHEET_ANIMATION_MS);
  };

  const handleLogout = () => openLogoutSheet();

  const confirmLogout = async () => {
    closeLogoutSheet();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

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
    } else if (option === 'notifications') {
      try { navigation.navigate('Notifications'); } catch (e) { Alert.alert('Error', 'Notifications screen not found.'); }
    } else if (option === 'settings') {
      try { navigation.navigate('Main', { screen: 'Settings' }); } catch (e) { Alert.alert('Error', 'Settings screen not found.'); }
    } else if (option === 'changePassword') {
      try { navigation.navigate('ChangePassword', { adminMode: false }); } catch (e) { Alert.alert('Error', 'Change Password screen not found.'); }
    } else if (option === 'logout') {
      handleLogout();
    }
  };

  // ---------- Tutorial steps (own profile only) ----------
  const tutorialSteps = useMemo(() => {
    if (!isOwnProfile) return [];

    const steps = [
      {
        getTarget: () => profileAvatarRef.current,
        title: t.tAvatarTitle,
        body: t.tAvatarBody,
      },
      {
        getTarget: () => profileNameRef.current,
        title: t.tNameTitle,
        body: t.tNameBody,
      },
      {
        getTarget: () => profileStatsRef.current,
        title: t.tStatsTitle,
        body: t.tStatsBody,
      },
      {
        getTarget: () => profileEditBtnRef.current,
        title: t.tEditTitle,
        body: t.tEditBody,
      },
      {
        getTarget: () => profileMenuBtnRef.current,
        title: t.tMenuTitle,
        body: t.tMenuBody,
      },
    ];

    // Replace tabs step with delete/unsave step on the first post card
    if (userPosts.length > 0) {
      steps.push({
        getTarget: () => firstDeleteBtnRef.current,
        title: t.tDeleteTitle,
        body: t.tDeleteBody,
      });
    }

    // Fallback: if user has NO regular posts but HAS saved posts,
    // teach the unsave (bookmark) button instead.
    if (userPosts.length === 0 && savedPosts.length > 0) {
      steps.push({
        getTarget: () => firstUnsaveBtnRef.current,
        title: t.tDeleteTitle,
        body: t.tDeleteBody,
      });
    }

    return steps;
    // No .filter() — refs are null during useMemo; overlay handles null targets.
  }, [isOwnProfile, t, userPosts.length, savedPosts.length]);

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
              ref={(el) => {
                if (el && !firstUnsaveBtnRef.current) firstUnsaveBtnRef.current = el;
              }}
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
              ref={(el) => {
                if (el && !firstDeleteBtnRef.current) firstDeleteBtnRef.current = el;
              }}
              style={[
                styles.deleteButton,
                { backgroundColor: isDarkMode ? '#111' : '#dddd' },
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

    const coverImage = getImageUri(user.coverImage || user.coverPhoto || user.bannerImage);
    const coverUri = coverImage ? normalizeImageUrl(coverImage) : null;
    const coverSource = coverUri
      ? { uri: coverUri }
      : require('../assets/house.png');

    return (
      <View style={styles.referenceProfileHeader}>
        <View style={styles.coverImageWrap}>
          <Image source={coverSource} style={styles.coverImage} resizeMode="cover" />
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
            ref={profileAvatarRef}
            onPress={isOwnProfile ? pickImage : undefined}
            style={styles.referenceAvatarWrap}
            disabled={!isOwnProfile || uploading}
          >
            {uploading ? (
              <View style={[styles.referenceAvatar, { backgroundColor: isDarkMode ? '#333' : '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.accent || '#47ae87'} />
              </View>
            ) : profileAvatarSource && !avatarLoadError ? (
              <Image
                source={profileAvatarSource}
                style={styles.referenceAvatar}
                resizeMode="cover"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <View style={[styles.referenceAvatar, styles.referenceAvatarPlaceholder, { backgroundColor: theme.accent }]}>
                <Text style={styles.avatarInitialsRow}>{String(username || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <OnlineStatusDot visible={isViewedUserOnline} size={16} />
            {isOwnProfile && !uploading && (
              <View style={styles.referenceAvatarEdit}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text
            ref={profileNameRef}
            style={[styles.referenceUsername, { color: theme.text }]}
            numberOfLines={1}
          >
            {name || username || 'User'}
          </Text>
          <Text style={[styles.referenceHandle, { color: theme.textSecondary }]}>@{(username || 'user').toLowerCase().replace(/\s+/g, '')}</Text>

          <View ref={profileStatsRef} style={styles.referenceStatsRow}>
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

          {isOwnProfile && (
            <View style={styles.referenceActionRow}>
              <TouchableOpacity
                ref={profileEditBtnRef}
                style={[styles.referenceActionButton, { backgroundColor: theme.accent }]}
                onPress={openEditSheet}
              >
                <Text style={styles.referencePrimaryActionText}>{t.editProfile}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                ref={profileMenuBtnRef}
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
            </View>
          )}

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

  const buildCounter = (value, max) => {
    const remaining = Math.max(0, max - value.length);
    const word = remaining === 1 ? t.charsRemainingOne : t.charsRemaining;
    return `${remaining} ${word}`;
  };

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

      {isOwnProfile && sidebarMounted && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.transparentOverlay}
          onPress={closeSidebar}
        />
      )}

      {isOwnProfile && sidebarMounted && (
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
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('notifications')}>
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('settings')}>
              <Ionicons name="settings-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>{t.settings}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]} onPress={() => handleMenuOption('changePassword')}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>{t.changePassword}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarOption} onPress={() => handleMenuOption('logout')}>
              <Ionicons name="log-out-outline" size={20} color="#d87428" />
              <Text style={[styles.sidebarOptionText, { color: '#d87428' }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {logoutSheetMounted && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.sheetOverlay}
            onPress={closeLogoutSheet}
          />
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
                <Text style={styles.logoutBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: '#d87428' }]} onPress={confirmLogout}>
                <Text style={styles.logoutBtnText}>{t.logoutConfirmButton}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}

      {isOwnProfile && editSheetMounted && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.sheetOverlay}
            onPress={closeEditSheet}
          />
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

            <ScrollView
              style={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <FloatingLabelInput
                label={t.name}
                value={editName}
                onChangeText={(text) => setEditName(sanitizeNameField(text))}
                maxLength={MAX_NAME_LENGTH}
                theme={theme}
                helperText={buildCounter(editName, MAX_NAME_LENGTH)}
                helperWarning={MAX_NAME_LENGTH - editName.length <= 3}
                autoCorrect={false}
              />

              <FloatingLabelInput
                label={t.username}
                value={editUsername}
                onChangeText={(text) => setEditUsername(sanitizeUsernameField(text))}
                maxLength={MAX_USERNAME_LENGTH}
                theme={theme}
                helperText={buildCounter(editUsername, MAX_USERNAME_LENGTH)}
                helperWarning={MAX_USERNAME_LENGTH - editUsername.length <= 3}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <FloatingLabelInput
                label={t.location}
                value={editLocation}
                onChangeText={(text) => setEditLocation(sanitizeLocationField(text))}
                maxLength={MAX_LOCATION_LENGTH}
                theme={theme}
                helperText={buildCounter(editLocation, MAX_LOCATION_LENGTH)}
                helperWarning={MAX_LOCATION_LENGTH - editLocation.length <= 3}
              />

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.socialLinks}
              </Text>

              {[0, 1, 2].map((index) => {
                const value = String(editSocialLinks[index] || '');
                return (
                  <FloatingLabelInput
                    key={`social-link-${index}`}
                    label={`${t.socialLink} ${index + 1}`}
                    value={value}
                    onChangeText={(text) => {
                      const updated = [...editSocialLinks];
                      updated[index] = text.slice(0, MAX_LINK_LENGTH);
                      setEditSocialLinks(updated);
                    }}
                    maxLength={MAX_LINK_LENGTH}
                    theme={theme}
                    helperText={buildCounter(value, MAX_LINK_LENGTH)}
                    helperWarning={MAX_LINK_LENGTH - value.length <= 5}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                );
              })}

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

      {/* ============ PROFILE TUTORIAL ============ */}
      <ScreenTutorialOverlay
        visible={showTutorial}
        steps={tutorialSteps}
        isDarkMode={isDarkMode}
        language={language}
        onFinish={finishTutorial}
        padding={5}
        dimOpacity={0}
      />
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
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 43,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 5,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 12,
    zIndex: 5,
  },
  gridMenuIconWrapper: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  gridMenuIconLine: { borderRadius: 999, height: 2, marginVertical: 1.5 },
  gridMenuIconLineShort: { width: '42%' },
  gridMenuIconLineMid: { width: '72%' },
  gridMenuIconLineLong: { width: '100%' },
  unsaveButton: { position: 'absolute', bottom: 0, right: 0, borderTopLeftRadius: 12, padding: 5, zIndex: 5 },

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

  transparentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.001)',
    zIndex: 10,
  },
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

  floatingFieldWrapper: { marginBottom: 22 },
  floatingFieldBox: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  floatingInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    paddingRight: 8,
    minHeight: 22,
  },
  floatingSuffix: { fontSize: 14, marginLeft: 8 },
  floatingLabelMask: {
    position: 'absolute',
    top: -8,
    left: 10,
    paddingHorizontal: 4,
  },
  floatingLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  floatingHelper: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
    marginLeft: 2,
  },

  sheetButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20, gap: 12 },
  sheetCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  sheetSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  logoutConfirmMsg: { fontSize: 15, textAlign: 'center', marginBottom: 24, marginTop: 8, lineHeight: 22 },
  logoutButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  logoutBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});

export default ProfileScreen;