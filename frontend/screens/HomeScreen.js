// screens/WelcomeHomeScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useTabMode } from '../context/TabModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { networkStatus } from '../services/networkStatus';
import { finishStartupPerformance } from '../services/startupPerformance';
import { logPerformance } from '../utils/performanceLogger';
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';
import { BASE_URL } from '../constants';
import ProductHeroDeck from '../components/ProductHeroDeck';
import { getUserDisplayName } from '../utils/userIdentity';

// Assets
const logo = require('../assets/logos.png');
const user1 = require('../assets/user1.png');
const user2 = require('../assets/user2.png');
const countryFlag = require('../assets/flga1.webp');
const houseBg = require('../assets/house.png');

const { width, height } = Dimensions.get('window');

const translations = {
  English: {
    welcome: 'Welcome to Shaaka',
    locate: 'Shaaka',
    locateShop: 'Map',
    buySell: 'Buy',
    businessIdeas: 'Business',
    login: 'Login',
    register: 'Register',
    users: ' 10,000⁺   Users ',
    trendingProducts: 'Trending now',
    loading: 'Murakazaneza kuri Shaaka App...',
    loginRequired: 'Login Required',
    loginMessage: 'Please login to view post details',
    cancel: 'Cancel',
  },
  Kinyarwanda: {
    welcome: 'Murakaza neza kuri Shaaka',
    locate: 'Shaaka',
    locateShop: 'Ikarita',
    buySell: 'Gurisha',
    businessIdeas: 'Imishinga',
    login: 'Injira',
    register: 'Iyandikishe',
    users: ' 10,000⁺  Byabayikoresha ',
    trendingProducts: 'Ibikunzwe ubu',
    loading: 'Murakazaneza kuri Shaaka App...',
    loginRequired: 'Ugomba kwinjira',
    loginMessage: 'Nyamuneka injira kugira ngo urebe ibyo ushaka',
    cancel: 'Hagarika',
  },
};

const mapPost = (post) => ({
  ...post,
  _id: post._id,
  id: post._id,
  username: getUserDisplayName(post.user || post, 'User'),
  userAvatar: post.userAvatar || post.user?.avatar,
  amount: post.amount || `RWF ${post.price?.toLocaleString()}`,
  price: post.price,
  location: post.location,
  description: post.description,
  productName: post.productName || 'Product',
  houseImages: post.houseImages || [],
  contactNumber1: post.contactNumbers?.[0] || '',
  contactNumber2: post.contactNumbers?.[1] || '',
  priceNegotiable: post.priceNegotiable || false,
  userId: post.user?._id || post.user,
  status: post.status || 'active',
  featured: post.featured || false,
  trending: post.trending || false,
  // 👇 Video fields — required by the deck to render the video badge
  videoUrl: post.videoUrl || post.videoHlsUrl || post.video?.url || '',
  videoThumbnail: post.videoThumbnail || '',
  videoLink: post.videoLink || '',
  videoDuration: post.videoDuration || 0,
  videoHlsUrl: post.videoHlsUrl || '',
  videoId: post.videoId || '',
});

const getPostImage = post => {
  const image = (Array.isArray(post.houseImages) && post.houseImages.find(Boolean))
    || post.videoThumbnail
    || post.imageUrl;
  if (typeof image === 'string') return image;
  if (image?.uri || image?.url) return image.uri || image.url;

  const videoUrl = post.videoUrl;
  if (!videoUrl?.includes('res.cloudinary.com')) return null;
  const uploadMarker = '/video/upload/';
  if (!videoUrl.includes(uploadMarker)) return null;
  return videoUrl
    .replace(uploadMarker, '/video/upload/so_5/')
    .replace(/\.[^/.?]+(?=\?|$)/, '.jpg');
};

const buildHomeSections = posts => {
  const trendingPosts = posts.filter(
    post => post.status !== 'stopped' && post.trending && getPostImage(post)
  );

  return [{ key: 'trending', posts: trendingPosts }];
};

const makeProtectedHomeSections = sections => sections.map(section => ({
  ...section,
  posts: section.posts.map(post => {
    const postData = { ...post };
    for (const key of ['avatar', 'userAvatar', 'logo', 'frontImage', 'imageUrl', 'videoThumbnail', 'images', 'products']) {
      delete postData[key];
    }
    return { ...postData, houseImages: [getPostImage(post)] };
  }),
}));

const WelcomeHomeScreen = ({ navigation, language, launchStartedAt }) => {
  const { theme, isDarkMode } = useTheme();
  const { setTabMode } = useTabMode();
  const [activeCard, setActiveCard] = useState('buySell');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [allPosts, setAllPosts] = useState([]);
  const [featuredSections, setFeaturedSections] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const homeStartedAt = useRef(Date.now());
  const firstUsableLogged = useRef(false);
  const firstProductsLogged = useRef(false);

  const t = translations[language] || translations.English;

  const colors = {
    background: isDarkMode ? '#111' : '#ffffff',
    cardBackground: isDarkMode ? '#1e1e1e' : '#f8f8f8',
    border: isDarkMode ? '#333' : '#e0e0e0',
    textPrimary: isDarkMode ? '#f5f5f5' : '#1a1a1a',
    textSecondary: isDarkMode ? '#b0b0b0' : '#555555',
    textTertiary: isDarkMode ? '#888' : '#999',
    accent: isDarkMode ? '#dddddd' : '#333333',
    activeCardBg: isDarkMode ? '#222' : '#222',
    activeText: isDarkMode ? '#fff' : '#fff',
    inactiveCardBg: isDarkMode ? '#606060' : '#f0f0f0',
    curveBg: isDarkMode ? '#222' : '#eaeaea',
    shadowColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
    authButtonBg: isDarkMode ? '#3a3a3a' : '#e8e8e8',
    howItWorksBg: isDarkMode ? '#2a2a2a' : '#ffffff',
  };
  const deckColors = {
    ...colors,
    login: theme.login || '#47ae87',
    brand: theme.login || '#47ae87',
    title: colors.textPrimary,
    text: colors.textPrimary,
    overlay: '#000000',
    glow: 'rgba(71, 174, 134, 0.16)',
    glowShadow: theme.login || '#47ae87',
  };

  const fetchPosts = useCallback(async () => {
    const isOnline = networkStatus.get().isOnline;
    const feedRequest = isOnline
      ? axios.get(`${BASE_URL}/api/posts`, {
        params: { page: 1, limit: 50 },
        timeout: 8000,
      }).then(response => ({ response }), error => ({ error }))
      : null;
    const [cachedFeed, cachedSections] = await Promise.all([
      offlineDatabase.getRecord('feed', 'page-1'),
      offlineDatabase.getRecord('home', 'featured-sections'),
    ]);
    if (Array.isArray(cachedFeed)) {
      const cachedPosts = cachedFeed.map(mapPost).filter(post => post.status !== 'stopped');
      setAllPosts(cachedPosts);
      setFeaturedSections(buildHomeSections(cachedPosts));
    } else if (cachedSections?.length) {
      const cachedTrending = cachedSections.find(section => section.key === 'trending');
      const cachedPosts = (cachedTrending?.posts || []).map(mapPost).filter(post => post.trending);
      setAllPosts(cachedPosts);
      setFeaturedSections(buildHomeSections(cachedPosts));
    }
    if (!feedRequest) return;
    try {
      const requestResult = await feedRequest;
      if (requestResult.error) throw requestResult.error;
      const postsResponse = requestResult.response;
      const activePosts = (postsResponse.data.posts || [])
        .map(mapPost)
        .filter((p) => p.status !== 'stopped');
      setAllPosts(activePosts);
      const nextSections = buildHomeSections(activePosts);
      setFeaturedSections(nextSections);

      offlineDatabase.putRecord(
        'feed',
        'page-1',
        postsResponse.data.posts || [],
        { priority: 'medium' }
      ).catch(() => {});
      const imageSections = nextSections.map(section => ({
        ...section,
        posts: section.posts.slice(0, 3),
      }));
      const hydratedSections = await mediaCache.hydrate(makeProtectedHomeSections(imageSections), {
        protected: true,
      });
      setFeaturedSections(nextSections.map((section, sectionIndex) => ({
        ...section,
        posts: section.posts.map((post, postIndex) => ({
          ...post,
          _homeImageUri: postIndex < 3
            ? getPostImage(hydratedSections[sectionIndex]?.posts?.[postIndex] || {})
            : undefined,
        })),
      })));
      await offlineDatabase.putRecord('home', 'featured-sections', hydratedSections, {
        priority: 'high',
        protected: true,
      });
    } catch (error) {
      console.error('Posts fetch error:', error);
    }
  }, []);

  useEffect(() => {
    if (!allPosts.length || firstProductsLogged.current) return;
    firstProductsLogged.current = true;
    logPerformance(`[Perf] home-first-products ${Date.now() - homeStartedAt.current}ms count=${allPosts.length}`);
  }, [allPosts]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePostResultPress = (post) => {
    if (!isLoggedIn) {
      Alert.alert(t.loginRequired, t.loginMessage, [
        { text: t.cancel, style: 'cancel' },
        { text: t.login || 'Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    navigation.navigate('PostDetail', { house: post, language });
  };

  const handleUserProfilePress = product => {
    const userId = product?.userId || product?.user?._id || product?.user;
    if (!userId) return;

    navigation.navigate('Profile', {
      userId,
      username: product?.username || 'User',
    });
  };

  const fetchUnreadNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setUnreadNotifications(0);
        return;
      }
      if (!networkStatus.get().isOnline) {
        setUnreadNotifications(0);
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadNotifications(response.data.unreadCount || 0);
    } catch (error) {
      if (!(error?.response?.status === 401 || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')) {
        console.error('Home unread notifications check error:', error);
      }
      setUnreadNotifications(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadNotifications();
    }, [fetchUnreadNotifications])
  );

  const navigateToAllProducts = () => {
    setTabMode('shopMode');
    navigation.navigate('BuyPost', { activeTab: 'ushaka' });
  };

  useEffect(() => {
    checkLoginStatus();
    const unsubscribe = navigation.addListener('focus', checkLoginStatus);
    return unsubscribe;
  }, [navigation]);

  const checkLoginStatus = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCardPress = (cardType, action) => {
    setActiveCard(cardType);
    action();
  };

  const homeSections = featuredSections.length
    ? featuredSections
    : buildHomeSections(allPosts);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      onLayout={() => {
        if (firstUsableLogged.current) return;
        firstUsableLogged.current = true;
        finishStartupPerformance();
        if (launchStartedAt) {
          logPerformance(`[Perf] launch-to-home-layout ${Date.now() - launchStartedAt}ms`);
        }
      }}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.curve} pointerEvents="none">
        <ImageBackground
          source={houseBg}
          style={StyleSheet.absoluteFill}
          imageStyle={styles.curveImage}
          resizeMode="cover"
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(0, 0, 0, 0.86)'
                  : 'rgba(224, 224, 224, 0.86)',
              },
            ]}
          />
          <View
            style={[
              styles.curveTopExtra,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(0, 0, 0, 0)'
                  : 'rgba(245, 245, 245, 0)',
              },
            ]}
          />
        </ImageBackground>
      </View>

      <View style={styles.mainContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topContent}>
            <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>
              {t.welcome}
            </Text>

            <View style={styles.selectionContainer}>
              <TouchableOpacity
                style={[
                  styles.selectionCard,
                  {
                    backgroundColor:
                      activeCard === 'locate' ? colors.activeCardBg : colors.inactiveCardBg,
                    borderColor:
                      activeCard === 'locate' ? colors.activeCardBg : colors.border,
                  },
                ]}
                onPress={() =>
                  handleCardPress('locate', () => {
                    setTabMode('locateMode');
                    navigation.navigate('Locate');
                  })
                }
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={activeCard === 'locate' ? colors.activeText : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: activeCard === 'locate' ? colors.activeText : colors.textPrimary },
                  ]}
                >
                  {t.locateShop}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.selectionCard,
                  {
                    backgroundColor:
                      activeCard === 'buySell' ? colors.activeCardBg : colors.inactiveCardBg,
                    borderColor:
                      activeCard === 'buySell' ? colors.activeCardBg : colors.border,
                  },
                ]}
                onPress={() =>
                  handleCardPress('buySell', () => {
                    setTabMode('shopMode');
                    navigation.navigate('BuyPost', { activeTab: 'ushaka' });
                  })
                }
              >
                <Ionicons
                  name="cart-outline"
                  size={18}
                  color={activeCard === 'buySell' ? colors.activeText : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: activeCard === 'buySell' ? colors.activeText : colors.textPrimary },
                  ]}
                >
                  {t.buySell}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.selectionCard,
                  {
                    backgroundColor:
                      activeCard === 'business' ? colors.activeCardBg : colors.inactiveCardBg,
                    borderColor:
                      activeCard === 'business' ? colors.activeCardBg : colors.border,
                  },
                ]}
                onPress={() =>
                  handleCardPress('business', () => {
                    navigation.navigate('BusinessIdeas');
                  })
                }
              >
                <Ionicons
                  name="bulb-outline"
                  size={18}
                  color={activeCard === 'business' ? colors.activeText : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: activeCard === 'business' ? colors.activeText : colors.textPrimary },
                  ]}
                >
                  {t.businessIdeas}
                </Text>
              </TouchableOpacity>
            </View>

            {homeSections.map(section => {
              if (!section.posts?.length) return null;
              return (
                <View key={section.key} style={styles.heroSection}>
                  <View style={styles.heroSectionHeader}>
                    <View style={styles.heroSectionBadge}>
                      <Ionicons name="flame" size={18} color="#fff" />
                      <Text style={styles.heroSectionBadgeText}>{t.trendingProducts}</Text>
                    </View>
                  </View>
                  <ProductHeroDeck
                    products={section.posts}
                    colors={deckColors}
                    showProgress={false}
                    onPressProduct={handlePostResultPress}
                    onPressUserProfile={handleUserProfilePress}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.bottomContentContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Notifications')}
            style={styles.locationRow}
          >
            <Image source={logo} style={[styles.locationIcon, { tintColor: colors.textPrimary }]} />
            <Text style={[styles.locationText, { color: colors.textPrimary }]}>{t.locate}</Text>
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarRow}>
            <Image source={user2} style={[styles.avatar, { backgroundColor: '#ccc' }]} />
            <Image source={user1} style={[styles.avatar, styles.avatarOverlap, { backgroundColor: '#ccc' }]} />
            <Image source={countryFlag} style={[styles.avatar, styles.avatarOverlap2]} />
            <Text style={[styles.communityText, { color: colors.textPrimary }]}>{t.users}</Text>
          </View>
        </View>

        {!isLoggedIn && (
          <View style={styles.footer}>
            <View style={styles.authButtonsContainer}>
              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: colors.authButtonBg }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>
                  {t.login}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: colors.authButtonBg }]}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>
                  {t.register}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  curve: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
    borderBottomLeftRadius: width * 0.9,
  },
  curveImage: {
    borderBottomLeftRadius: width * 0.9,
  },
  curveTopExtra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },

  mainContainer: {
    flex: 1,
    paddingTop: 8,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  topContent: { alignItems: 'center', width: '100%' },
  welcomeText: {
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: 'bold',
    fontFamily: 'Irish Grover',
    textAlign: 'center',
    width: '100%',
    marginBottom: 8,
  },
  selectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
    marginBottom: 20,
  },
  selectionCard: {
    flexDirection: 'row',
    width: '32%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#828282',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  heroSection: {
    width: '100%',
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  heroSectionHeader: {
    flexDirection: 'row',
     alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  heroSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d87428',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    gap: 6,
  },
  heroSectionBadgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bottomContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingLeft: 8,
    paddingRight: 12,
    position: 'relative',
  },
  locationIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: '#47ae87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  locationText: {
    fontSize: Math.min(width * 0.05, 20),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  avatar: {
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarOverlap: { marginLeft: -width * 0.03 },
  avatarOverlap2: { marginLeft: -width * 0.03 },
  communityText: {
    marginLeft: width * 0.03,
    fontSize: Math.min(width * 0.035, 14),
    fontFamily: 'Inter',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  authButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 10,
    marginBottom: 0,
  },
  authButton: {
    flex: 1,
    paddingVertical: 12,
    top: 0,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WelcomeHomeScreen;