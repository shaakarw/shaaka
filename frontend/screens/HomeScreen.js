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
  Animated,
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
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';
import { BASE_URL } from '../constants';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
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
    popularProducts: 'Popular products',
    trendingProducts: 'Trending now',
    seeAllPosts: 'See all products',
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
    popularProducts: 'Ibicuruzwa bikunzwe',
    trendingProducts: 'Ibikunzwe ubu',
    seeAllPosts: 'Reba ibicuruzwa byose',
    loading: 'Murakazaneza kuri Shaaka App...',
    loginRequired: 'Ugomba kwinjira',
    loginMessage: 'Nyamuneka winjire kugira ngo urebe ibyo ushaka',
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
  videoUrl: post.videoUrl || '',
  videoThumbnail: post.videoThumbnail || '',
  videoLink: post.videoLink || '',
  videoDuration: post.videoDuration || 0,
  videoHlsUrl: post.videoHlsUrl || '',
  videoId: post.videoId || '',
});

const hasDeckMedia = (post) =>
  Boolean(
    (Array.isArray(post.houseImages) && post.houseImages.find(Boolean)) ||
      post.videoUrl ||
      post.videoThumbnail
  );

const WelcomeHomeScreen = ({ navigation, language }) => {
  const { isDarkMode } = useTheme();
  const { setTabMode } = useTabMode();
  const [activeCard, setActiveCard] = useState('buySell');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const [allPosts, setAllPosts] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const t = translations[language] || translations.English;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const colors = {
    background: isDarkMode ? '#111' : '#ffffff',
    cardBackground: isDarkMode ? '#1e1e1e' : '#f8f8f8',
    border: isDarkMode ? '#333' : '#e0e0e0',
    textPrimary: isDarkMode ? '#f5f5f5' : '#1a1a1a',
    textSecondary: isDarkMode ? '#b0b0b0' : '#555555',
    textTertiary: isDarkMode ? '#888' : '#999',
    accent: isDarkMode ? '#dddddd' : '#333333',
    activeCardBg: isDarkMode ? '#444' : '#222',
    activeText: isDarkMode ? '#fff' : '#fff',
    inactiveCardBg: isDarkMode ? '#2a2a2a' : '#f0f0f0',
    curveBg: isDarkMode ? '#222' : '#eaeaea',
    shadowColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
    authButtonBg: isDarkMode ? '#3a3a3a' : '#e8e8e8',
    howItWorksBg: isDarkMode ? '#2a2a2a' : '#ffffff',
  };

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
  }, [loading, scaleAnim]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const cachedFeed = await offlineDatabase.getRecord('feed', 'page-1');
    if (cachedFeed) {
      setAllPosts(
        (await mediaCache.hydrate(cachedFeed))
          .map(mapPost)
          .filter((p) => p.status !== 'stopped')
      );
    }
    if (!networkStatus.get().isOnline) {
      setLoading(false);
      return;
    }
    try {
      const postsResponse = await axios.get(`${BASE_URL}/api/posts`, {
        params: { page: 1, limit: 50 },
      });
      const activePosts = (postsResponse.data.posts || [])
        .map(mapPost)
        .filter((p) => p.status !== 'stopped');
      setAllPosts(activePosts);
      await offlineDatabase.putRecord(
        'feed',
        'page-1',
        await mediaCache.hydrate(postsResponse.data.posts || []),
        { priority: 'medium' }
      );
    } catch (error) {
      console.error('Posts fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleUserProfilePress = (product) => {
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

      const response = await axios.get(`${BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadNotifications(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Home unread notifications check error:', error);
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

  // ---------------------------------------------------------------
  // Hero deck data — Trending first, fallback to all posts with media.
  // ---------------------------------------------------------------
  const trendingPosts = allPosts.filter(
    (post) => post.trending && hasDeckMedia(post)
  );

  const fallbackPosts = allPosts.filter((post) => hasDeckMedia(post));

  const heroDeckPosts = (trendingPosts.length > 0 ? trendingPosts : fallbackPosts)
    .slice(0, 8);

  const deckTitle = trendingPosts.length > 0
    ? t.trendingProducts
    : t.popularProducts;

  if (loading) {
    return (
      <ShaakaLoadingScreen
        message={t.loading}
        backgroundColor={isDarkMode ? '#111' : '#dddd'}
        textColor={colors.textSecondary}
      />
    );
  }

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
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
                  ? 'rgba(0, 0, 0, 0.82)'
                  : 'rgba(224, 224, 224, 0.86)',
              },
            ]}
          />
          <View
            style={[
              styles.curveTopExtra,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(0, 0, 0, 0.35)'
                  : 'rgba(245, 245, 245, 0.35)',
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

            <View style={styles.productSectionHeader}>
              <Text style={[styles.productSectionTitle, { color: colors.textPrimary }]}>
                {deckTitle}
              </Text>
              {trendingPosts.length > 0 && (
                <View style={styles.trendingBadge}>
                  <Ionicons name="flame" size={12} color="#fff" />
                  <Text style={styles.trendingBadgeText}>{t.trendingProducts}</Text>
                </View>
              )}
            </View>

            <View style={styles.productSection}>
              <ProductHeroDeck
                products={heroDeckPosts}
                colors={colors}
                onPressProduct={handlePostResultPress}
                onPressUserProfile={handleUserProfilePress}
              />
            </View>
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
  topContent: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeText: {
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: 'bold',
    fontFamily: 'Irish Grover',
    textAlign: 'center',
    marginBottom: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },

  productSection: {
    width: '92%',
    marginTop: 20,
    alignItems: 'center',
  },
  productSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '92%',
    marginTop: 6,
    marginBottom: 10,
  },
  productSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d87428',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  trendingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
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