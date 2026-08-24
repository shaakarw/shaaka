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
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import SharedBottomNav from '../components/SharedBottomNav';
import FullScreenImageViewer from '../components/FullScreenImageViewer';

const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.5;

const BOTTOM_SHEET_HEIGHT = height * 0.7;
const LOGOUT_SHEET_HEIGHT = height * 0.3;

const loadingLogo = require('../assets/logos.png');

// ---------- Translations ----------
const translations = {
  English: {
    loading: 'Getting things ready…',
    posts: 'Posts',
    saved: 'Saved',
    noPosts: 'No posts yet',
    noSavedPosts: 'No saved posts yet',
    savePostsHint: 'Save posts you like to see them here',
    createFirstPost: 'Create Your First Post',
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
  },
  Kinyarwanda: {
    loading: 'Turigutunganya page neza…',
    posts: 'Ibicuruzwa',
    saved: 'Ibyabitswe',
    noPosts: 'Nta gicuruzwa',
    noSavedPosts: 'Nta gicuruzwa cyabitswe',
    savePostsHint: 'Bika ibicuruzwa ukunda kugira ngo ubibone hano',
    createFirstPost: 'Shyiraho igicuruzwa bwambere',
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
  },
};

const ProfileScreen = ({ navigation, route, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { logout, updateUser: updateAuthUser, syncStoredUser } = useAuth();
  const t = translations[language] || translations.English;

  const { userId: paramUserId, username: paramUsername } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState(null);
  const [username, setUsername] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Edit Profile Bottom Sheet
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSocialLinks, setEditSocialLinks] = useState(['', '', '']);
  const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;

  // Logout Bottom Sheet
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);
  const logoutSlideAnim = useRef(new Animated.Value(LOGOUT_SHEET_HEIGHT)).current;

  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Full-screen image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarSlideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current; // off-screen to the right

  // Loading animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    loadData();
  }, [paramUserId]);

  // Sidebar animation
  useEffect(() => {
    if (sidebarVisible) {
      Animated.timing(sidebarSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sidebarSlideAnim, {
        toValue: SIDEBAR_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [sidebarVisible]);

  // Edit bottom sheet animation
  useEffect(() => {
    if (editSheetVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: BOTTOM_SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [editSheetVisible]);

  // Logout bottom sheet animation
  useEffect(() => {
    if (logoutSheetVisible) {
      Animated.spring(logoutSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
      }).start();
    } else {
      Animated.timing(logoutSlideAnim, {
        toValue: LOGOUT_SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [logoutSheetVisible]);

  const getToken = async () => await AsyncStorage.getItem('userToken');

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('Login');
        return;
      }
      const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meResponse.data.success) throw new Error('Failed to get current user');
      const me = meResponse.data.user;
      setCurrentUser(me);

      let targetUserId = paramUserId;
      let isOwn = false;

      if (!targetUserId || targetUserId === me._id) {
        targetUserId = me._id;
        isOwn = true;
        setAvatarUri(me.avatar || null);
        setUsername(me.username || me.phone || '');
        setViewedUser(me);
        setSocialLinks(me.socialLinks || []);
      } else {
        isOwn = false;
        const userResponse = await axios.get(`${BASE_URL}/api/user/${targetUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userResponse.data.success) throw new Error('User not found');
        const otherUser = userResponse.data.user;
        setViewedUser(otherUser);
        setAvatarUri(otherUser.avatar || null);
        setUsername(otherUser.username || 'User');
        setSocialLinks(otherUser.socialLinks || []);
      }

      setIsOwnProfile(isOwn);

      const postsResponse = await axios.get(`${BASE_URL}/api/posts/user/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserPosts(postsResponse.data.posts || []);

      if (isOwn) {
        const savedResponse = await axios.get(`${BASE_URL}/api/posts/saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const posts = savedResponse.data.posts || [];
        setSavedPosts(posts);
        setSavedPostIds(posts.map(p => p._id));
      } else {
        setSavedPosts([]);
        setSavedPostIds([]);
      }

      await AsyncStorage.setItem('user', JSON.stringify(me));
    } catch (error) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Could not load profile. Please try again.');
      if (error.response?.status === 404) {
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------- Actions (own profile only) ----------
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
      console.error('Upload error:', error);
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

  const updateProfile = async () => {
    if (!isOwnProfile) return;

    const user = viewedUser || currentUser;
    if (!user) return;

    const originalUsername = user.username || '';
    const originalLocation = user.location || '';
    const originalSocialLinks = (user.socialLinks || []).filter(link => typeof link === 'string' && link.trim());

    const newUsername = editUsername.trim();
    const newLocation = editLocation.trim();
    const newSocialLinks = editSocialLinks
      .map(link => (typeof link === 'string' ? link.trim() : ''))
      .filter(link => link);

    // Check if any field actually changed
    const usernameChanged = newUsername !== originalUsername;
    const locationChanged = newLocation !== originalLocation;
    const socialLinksChanged = JSON.stringify(newSocialLinks) !== JSON.stringify(originalSocialLinks);

    if (!usernameChanged && !locationChanged && !socialLinksChanged) {
      // No changes; close sheet silently
      setEditSheetVisible(false);
      return;
    }

    try {
      const authUpdate = await updateAuthUser({
        username: newUsername,
        location: newLocation,
        socialLinks: newSocialLinks,
      });

      if (authUpdate.success) {
        const updatedUser = authUpdate.user;
        setCurrentUser(updatedUser);
        setViewedUser(updatedUser);
        setAvatarUri(updatedUser.avatar || null);
        setSocialLinks(updatedUser.socialLinks || []);
        setUsername(updatedUser.username || updatedUser.phone || '');
        await syncStoredUser(updatedUser);
        Alert.alert('Success', t.profileUpdated);
        setEditSheetVisible(false);
      } else {
        Alert.alert('Error', authUpdate.message || t.updateFailed);
      }
    } catch (error) {
      console.error('Update error:', error);
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
      if (response.data.success) {
        if (!response.data.saved) {
          setSavedPosts(prev => prev.filter(p => p._id !== post._id));
          setSavedPostIds(prev => prev.filter(id => id !== post._id));
        }
      }
    } catch (error) {
      console.error('Toggle save error:', error);
      Alert.alert('Error', 'Failed to unsave post');
    }
  };

  // ---------- Logout Bottom Sheet Handlers ----------
  const openLogoutSheet = () => {
    closeSidebar();
    setLogoutSheetVisible(true);
  };

  const closeLogoutSheet = () => {
    setLogoutSheetVisible(false);
  };

  const handleLogout = () => {
    openLogoutSheet();
  };

  const confirmLogout = async () => {
    closeLogoutSheet();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  // ---------- Sidebar menu options ----------
  const handleMenuOption = (option) => {
    closeSidebar();
    if (option === 'addPost') {
      try {
        navigation.navigate('Main', { screen: 'BuyPost' });
      } catch (e) {
        Alert.alert('Error', 'BuyPost screen not found. Please check your navigation.');
      }
    } else if (option === 'settings') {
      try {
        navigation.navigate('Main', { screen: 'Settings' });
      } catch (e) {
        Alert.alert('Error', 'Settings screen not found. Please check your navigation.');
      }
    } else if (option === 'logout') {
      handleLogout();
    }
  };

  const openSidebar = () => {
    if (!isOwnProfile) return;
    setSidebarVisible(true);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  // ---------- Bottom Sheet Handlers ----------
  const openEditSheet = () => {
    const user = viewedUser || currentUser;
    setEditUsername(user?.username || '');
    setEditLocation(user?.location || '');
    setEditSocialLinks([
      ...(user?.socialLinks || []).slice(0, 3),
      '',
      '',
    ].slice(0, 3));
    setEditSheetVisible(true);
  };

  const closeEditSheet = () => {
    setEditSheetVisible(false);
  };

  // ---------- Render helpers ----------
  const renderGridPostItem = ({ item }) => {
    const isSavedTab = activeTab === 'saved';
    const showDelete = isOwnProfile && !isSavedTab;

    return (
      <View style={styles.gridPostItem}>
        <TouchableOpacity
          style={styles.gridPostImageContainer}
          onPress={() => {
            const imageUrl = item.houseImages?.[0];
            if (imageUrl) {
              setSelectedImageUrl(imageUrl);
              setImageViewerVisible(true);
            } else {
              navigation.navigate('PostDetail', { house: item });
            }
          }}
        >
          <Image
            source={{
              uri: item.houseImages?.[0] || 'https://via.placeholder.com/150',
            }}
            style={styles.gridPostImage}
          />
          {isSavedTab && isOwnProfile && (
            <TouchableOpacity
              style={styles.unsaveButton}
              onPress={() => toggleSavePost(item)}
            >
              <Ionicons name="bookmark" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {showDelete && (
          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
              },
            ]}
            onPress={() => confirmDeletePost(item._id)}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={isDarkMode ? '#000' : '#fff'}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderProfileHeader = () => {
    const user = viewedUser || currentUser;
    if (!user) return null;

    const postCount = userPosts.length;
    const savedCount = savedPosts.length;

    return (
      <>
        {/* Avatar + Username + Stats Row */}
        <View style={styles.profileHeaderRow}>
          {/* Left column: Avatar and username below it */}
          <TouchableOpacity
            onPress={() => {
              if (isOwnProfile) {
                pickImage();
              } else if (avatarUri) {
                setSelectedImageUrl(avatarUri);
                setImageViewerVisible(true);
              }
            }}
            style={styles.avatarColumn}
            disabled={uploading}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarRow} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholderRow,
                  { backgroundColor: theme.accent },
                ]}
              >
                <Text style={styles.avatarInitialsRow}>
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isOwnProfile && (
              <View style={styles.editIconRow}>
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={20} color="white" />
                )}
              </View>
            )}
            <Text
              style={[styles.usernameUnderAvatar, { color: theme.text }]}
              numberOfLines={1}
            >
              {username}
            </Text>
          </TouchableOpacity>

          {/* Right side: Stats row (posts, saved, menu icon) */}
          <View style={styles.profileStatsRow}>
            <View style={styles.statItemCenter}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {postCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.posts}</Text>
            </View>

            {isOwnProfile && (
              <View style={styles.statItemCenter}>
                <Text style={[styles.statNumber, { color: theme.text }]}>
                  {savedCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.saved}</Text>
              </View>
            )}

            {isOwnProfile && (
              <TouchableOpacity
                style={styles.statItemCenter}
                onPress={openSidebar}
              >
                <Ionicons name="menu-outline" size={28} color={theme.text} />
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Menu</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bio section */}
        <View style={styles.profileBioSection}>
          {user.bio ? (
            <Text style={[styles.profileBio, { color: theme.text }]}>{user.bio}</Text>
          ) : null}
          <Text style={[styles.profileLocation, { color: theme.textSecondary }]}>
            {user.location || 'Kigali, Rwanda'}
          </Text>
          {(socialLinks && socialLinks.length > 0) ? (
            <View style={styles.socialLinksRow}>
              {socialLinks.slice(0, 3).map((link, index) => (
                <TouchableOpacity
                  key={`${link}-${index}`}
                  onPress={() => {
                    if (link) Linking.openURL(link).catch(() => Alert.alert('Invalid link', 'Unable to open this link.'));
                  }}
                  style={[styles.socialLinkItem, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                >
                  <Ionicons name="link-outline" size={14} color={theme.text} />
                  <Text style={[styles.socialLinkText, { color: theme.text }]} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {isOwnProfile && (
            <TouchableOpacity
              style={[styles.editProfileButton, { backgroundColor: theme.accent }]}
              onPress={openEditSheet}
            >
              <Text style={styles.editProfileButtonText}>{t.editProfile}</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  };

  const renderTabBar = () => {
    const tabs = [{ key: 'posts', icon: 'grid-outline' }];
    if (isOwnProfile) {
      tabs.push({ key: 'saved', icon: 'bookmark-outline' });
    }
    return (
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={24}
              color={activeTab === tab.key ? theme.accent : theme.textSecondary}
            />
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

  const ListEmpty = () => {
    if (activeTab === 'saved' && isOwnProfile) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            {t.noSavedPosts}
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>
            {t.savePostsHint}
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: theme.accent }]}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.exploreBtnText}>{t.explorePosts}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={activeTab === 'posts' ? 'images-outline' : 'bookmark-outline'}
          size={64}
          color={theme.textSecondary}
        />
        <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
          {activeTab === 'posts' ? t.noPosts : t.noSavedPosts}
        </Text>
        {activeTab === 'saved' && (
          <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>
            {t.savePostsHint}
          </Text>
        )}
        {activeTab === 'posts' && isOwnProfile && (
          <TouchableOpacity
            style={[styles.createPostBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              try {
                navigation.navigate('Main', { screen: 'BuyPost' });
              } catch (e) {
                Alert.alert('Error', 'BuyPost screen not found.');
              }
            }}
          >
            <Text style={styles.createPostBtnText}>{t.createFirstPost}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Animated.Image
            source={loadingLogo}
            style={[styles.loadingImage, { transform: [{ scale: scaleAnim }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.text }]}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sidebarBorderColor = isDarkMode ? '#3a3a3c' : '#d0d0d0';

  const currentData = activeTab === 'posts' ? userPosts : savedPosts;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        key={activeTab}
        ListHeaderComponent={ListHeader}
        data={currentData}
        keyExtractor={(item) => item._id}
        renderItem={renderGridPostItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.postsGrid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmpty}
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
        >
          <View style={styles.sidebarContent}>
            {/* Post - Navigate to BuyPostScreen */}
            <TouchableOpacity
              style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]}
              onPress={() => handleMenuOption('addPost')}
            >
              <Ionicons name="grid-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>{t.post}</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={[styles.sidebarOption, { borderBottomColor: sidebarBorderColor }]}
              onPress={() => handleMenuOption('settings')}
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
              <Text style={[styles.sidebarOptionText, { color: theme.text }]}>{t.settings}</Text>
            </TouchableOpacity>

            {/* Logout - Opens bottom sheet */}
            <TouchableOpacity
              style={styles.sidebarOption}
              onPress={() => handleMenuOption('logout')}
            >
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
              <TouchableOpacity
                style={[styles.logoutBtn, { backgroundColor: '#47ae87' }]}
                onPress={closeLogoutSheet}
              >
                <Text style={styles.logoutBtnText}>{t.no}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutBtn, { backgroundColor: '#d87428' }]}
                onPress={confirmLogout}
              >
                <Text style={styles.logoutBtnText}>{t.yes}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}

      {/* Edit Profile Bottom Sheet */}
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
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{t.editProfile}</Text>
              <TouchableOpacity onPress={closeEditSheet} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <TextInput
                style={[
                  styles.sheetInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
                placeholder={t.username}
                placeholderTextColor={theme.textSecondary}
                value={editUsername}
                onChangeText={setEditUsername}
              />

              <TextInput
                style={[
                  styles.sheetInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
                placeholder={t.location}
                placeholderTextColor={theme.textSecondary}
                value={editLocation}
                onChangeText={setEditLocation}
              />

              <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>Social Links</Text>
              {[0, 1, 2].map((index) => (
                <TextInput
                  key={`social-link-${index}`}
                  style={[
                    styles.sheetInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.cardBackground,
                    },
                  ]}
                  placeholder={`Social link ${index + 1}`}
                  placeholderTextColor={theme.textSecondary}
                  value={editSocialLinks[index] || ''}
                  onChangeText={(value) => {
                    const updated = [...editSocialLinks];
                    updated[index] = value;
                    setEditSocialLinks(updated);
                  }}
                />
              ))}

              <View style={styles.sheetButtons}>
                <TouchableOpacity
                  onPress={closeEditSheet}
                  style={[styles.sheetCancelBtn, { borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.textSecondary }}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={updateProfile}
                  style={[styles.sheetSaveBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>{t.save}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}

      <FullScreenImageViewer
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageViewerVisible(false)}
        language={language}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingImage: {
    width: 150,
    height: 150,
  },
  loadingText: { marginTop: 22, fontSize: 16 },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0,
    borderBottomColor: '#e0e0e0',
  },
  avatarColumn: {
    alignItems: 'center',
    position: 'relative',
    marginRight: 16,
  },
  avatarRow: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholderRow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsRow: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  editIconRow: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    backgroundColor: '#7a7a7a',
    borderRadius: 14,
    padding: 4,
  },
  usernameUnderAvatar: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 80,
  },
  profileStatsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginLeft: 16,
    alignSelf: 'center',
  },
  statItemCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  profileBioSection: { marginHorizontal: 20, marginTop: 0 },
  profileBio: { fontSize: 14, marginTop: 0, lineHeight: 20 },
  profileLocation: { fontSize: 13, marginTop: 0},
  socialLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 20,
    borderWidth: 0,
    marginRight: 8,
    marginBottom: 5,
  },
  socialLinkText: {
    marginLeft: 6,
    fontSize: 12,
    maxWidth: 140,
  },
  editProfileButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  postsGrid: { paddingHorizontal: 8, paddingBottom: 80 },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridPostItem: {
    width: (width - 32) / 2,
    aspectRatio: 1,
    marginBottom: 8,
    position: 'relative',
  },
  gridPostImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  gridPostImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 12,
    padding: 2,
  },
  unsaveButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 0,
    paddingVertical: 12,
    marginTop: 4,
  },
  tab: { paddingHorizontal: 20, paddingVertical: 8 },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#47ae87',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyStateText: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center' },
  createPostBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  createPostBtnText: { color: 'white', fontWeight: '600' },
  exploreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  exploreBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  transparentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 11,
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
  sidebarContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  sidebarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0,
  },
  sidebarOptionText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  // Overlay for bottom sheets
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  // Edit Bottom Sheet Styles
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
  // Logout Bottom Sheet Styles
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
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetContent: {
    flex: 1,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  sheetLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  sheetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  sheetCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  sheetSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  // Logout bottom sheet specific styles
  logoutConfirmMsg: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
    lineHeight: 22,
  },
  logoutButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  logoutBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});

// Download translations
const downloadTranslations = {
  English: {
    download: 'Download Image',
    downloading: 'Downloading...',
    downloaded: 'Image downloaded successfully.',
    downloadFailed: 'Failed to download image. Please try again.',
    permissionNeeded: 'Please allow access to photos to save images.',
  },
  Kinyarwanda: {
    download: 'Gukuramo Ifoto',
    downloading: 'Turi kugukuramo...',
    downloaded: 'Ifoto yahinduwe neza.',
    downloadFailed: 'Gukuramo ifoto byanze. Ongera ugerageze.',
    permissionNeeded: 'Shyira uruhushya rwo kujya mu ifoto.',
  },
};

export default ProfileScreen;