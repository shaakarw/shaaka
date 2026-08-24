// screens/WelcomeHomeScreen.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTabMode } from '../context/TabModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';

// Assets
const map1flag = require('../assets/map1.png');
const logo = require('../assets/logos.png');
const user1 = require('../assets/user1.png');
const user2 = require('../assets/user2.png');
const countryFlag = require('../assets/flga1.webp');

const { width, height } = Dimensions.get('window');

const translations = {
  English: {
    welcome: 'Welcome to Shaaka',
    tagline: 'Find Shops,Buy,Sell anywhere you are',
    locate: 'Shaaka',
    description: 'Helps you to discover shops near you , sell and buy across the country, quickly, easily.',
    locateShop: 'Map',
    buySell: 'Buy',
    businessIdeas: 'Business',
    login: 'Login',
    register: 'Register',
    users: ' 10,000⁺   Users ',
    howItWorks: 'How Shaaka works',
    searchPlaceholder: 'Search shops, products, or places',
    searchMap: 'Map',
    searchPosts: 'Posts',
    searchProductsHint: 'Find products and listings',
    searchMapHint: 'Find shops and places on the map',
    products: 'Products',
    places: 'Places',
    shops: 'Shops',
    noResults: 'No results found',
    seeAllPosts: 'See all products',
    seeAllPlaces: 'See all places',
    loading: 'Searching...',
    loginRequired: 'Login Required',
    loginMessage: 'Please login to view post details',
    cancel: 'Cancel',
  },
  Kinyarwanda: {
    welcome: 'Murakaza neza kuri Shaaka',
    tagline: 'Shaaka Amaduka,Ugure,Unagurishe aho ari hose',
    locate: 'Shaaka',
    description: 'Igufasha kubona amaduka akwegere aho uri hose, kugura no  kugurisha byihuse, byoroshye.',
    locateShop: 'Ikarita',
    buySell: 'Gurisha',
    businessIdeas: 'Imishinga',
    login: 'Injira',
    register: 'Iyandikishe',
    users: ' 10,000⁺  Byabayikoresha ',
    howItWorks: 'Uko Shaaka ikora',
    searchPlaceholder: 'Shakisha amaduka, ibicuruzwa, cyangwa ahantu',
    searchMap: 'Ikarita',
    searchPosts: 'Ibicuruzwa',
    searchProductsHint: 'Shakisha ibicuruzwa n’amatangazo',
    searchMapHint: 'Shakisha amaduka n’ahantu ku ikarita',
    products: 'Ibicuruzwa',
    places: 'Ahantu',
    shops: 'Amaduka',
    noResults: 'Nta byabonetse',
    seeAllPosts: 'Reba ibicuruzwa byose',
    seeAllPlaces: 'Reba ahantu hose',
    loading: 'Gushaka...',
    loginRequired: 'Ugomba kwinjira',
    loginMessage: 'Nyamuneka winjire kugira ngo urebe ibyo ushaka',
    cancel: 'Hagarika',
  },
};

const mapPost = (post) => ({
  ...post,
  _id: post._id,
  id: post._id,
  username: post.username || post.user?.username || 'User',
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
});

const WelcomeHomeScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { setTabMode } = useTabMode();
  const [activeCard, setActiveCard] = useState('buySell');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchWidthAnim = useRef(new Animated.Value(0)).current;
  const EXPANDED_SEARCH_WIDTH = width * 0.8;

  // New states for search data
  const [allPosts, setAllPosts] = useState([]);
  const [allPlaces, setAllPlaces] = useState([]);
  const [allMallShops, setAllMallShops] = useState([]);
  const [searchResults, setSearchResults] = useState({
    posts: [],
    places: [],
    shops: [],
  });
  const [isSearching, setIsSearching] = useState(false);

  const t = translations[language] || translations.English;

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

  const toggleSearch = () => {
    const toValue = searchExpanded ? 0 : 1;
    Animated.timing(searchWidthAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start(() => setSearchExpanded(!searchExpanded));
  };

  const searchContainerWidth = searchWidthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [46, EXPANDED_SEARCH_WIDTH],
  });

  // Fetch all data needed for search (posts, places, mall shops)
  const fetchSearchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const postsResponse = await axios.get(`${BASE_URL}/api/posts`, {
        params: { page: 1, limit: 50 },
      });
      const activePosts = (postsResponse.data.posts || [])
        .map(mapPost)
        .filter(p => p.status !== 'stopped');
      setAllPosts(activePosts);

      try {
        const placesResponse = await axios.get(`${BASE_URL}/api/places`, { headers });
        setAllPlaces(placesResponse.data.places || []);
      } catch (e) {
        console.warn('Places fetch failed:', e.message);
        setAllPlaces([]);
      }

      try {
        const shopsResponse = await axios.get(`${BASE_URL}/api/mall-shops`, { headers });
        let shops = [];
        if (shopsResponse.data && shopsResponse.data.shops) {
          shops = shopsResponse.data.shops;
        } else if (Array.isArray(shopsResponse.data)) {
          shops = shopsResponse.data;
        }
        setAllMallShops(shops);
      } catch (e) {
        console.warn('Mall shops fetch failed:', e.message);
        setAllMallShops([]);
      }
    } catch (error) {
      console.error('Search data fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchSearchData();
  }, [fetchSearchData]);

  // Perform search when query changes
  useEffect(() => {
    if (!searchExpanded || searchQuery.trim().length === 0) {
      setSearchResults({ posts: [], places: [], shops: [] });
      return;
    }

    const delayDebounce = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, searchExpanded, allPosts, allPlaces, allMallShops]);

  const performSearch = (query) => {
    setIsSearching(true);
    const lowerQuery = query.toLowerCase().trim();

    const matchedPosts = allPosts.filter(post =>
      post.productName?.toLowerCase().includes(lowerQuery) ||
      post.description?.toLowerCase().includes(lowerQuery) ||
      post.location?.toLowerCase().includes(lowerQuery) ||
      post.username?.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);

    const matchedPlaces = allPlaces.filter(place => {
      const searchIn = (value) => {
        if (!value) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      };
      return (
        searchIn(place.name) ||
        searchIn(place.category) ||
        searchIn(place.address) ||
        searchIn(place.description) ||
        (place.products && place.products.some(p => searchIn(p.name)))
      );
    }).slice(0, 5);

    const matchedShops = allMallShops.filter(shop => {
      const name = shop.name || '';
      const mallName = shop.mall?.name || '';
      return name.toLowerCase().includes(lowerQuery) ||
             mallName.toLowerCase().includes(lowerQuery);
    }).slice(0, 5);

    setSearchResults({
      posts: matchedPosts,
      places: matchedPlaces,
      shops: matchedShops,
    });
    setIsSearching(false);
  };

  // Navigation handlers for results
  const handlePostResultPress = (post) => {
    if (!isLoggedIn) {
      Alert.alert(
        t.loginRequired,
        t.loginMessage,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.login || 'Login', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    navigation.navigate('PostDetail', { house: post, language });
  };

  const handlePlaceResultPress = (place) => {
    setTabMode('locateMode');
    navigation.navigate('Locate', { placeId: place._id, searchQuery: searchQuery });
  };

  const handleShopResultPress = (shop) => {
    navigation.navigate('ViewShop', { shopId: shop._id });
  };

  const navigateToSearch = (target) => {
    const query = searchQuery.trim();
    if (target === 'map') {
      setTabMode('locateMode');
      navigation.navigate('Locate', { searchQuery: query });
    } else {
      setTabMode('shopMode');
      navigation.navigate('Search', { searchQuery: query });
    }
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

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.curve, { backgroundColor: colors.curveBg }]} />

      <View style={styles.mainContainer}>
        {/* MAIN SCROLLVIEW - disabled when search expanded to keep top content fixed */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!searchExpanded}
        >
          <View style={styles.topContent}>
            <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>{t.welcome}</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t.tagline}</Text>

            {/* Animated Search Section */}
            <Animated.View style={[styles.searchWrapper, { width: searchContainerWidth }]}>
              {!searchExpanded ? (
                <TouchableOpacity
                  onPress={toggleSearch}
                  style={[
                    styles.searchIconButton,
                    { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }
                  ]}
                >
                  <Ionicons name="search" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.expandedSearchContainer,
                    { backgroundColor: isDarkMode ? '#222' : '#eaeaea', borderColor: colors.border }
                  ]}
                >
                  <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    placeholder={t.searchPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => navigateToSearch('posts')}
                    autoFocus={true}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={toggleSearch} style={styles.closeSearchBtn}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* Search Results Dropdown - now with own scroll area */}
            {searchExpanded && searchQuery.trim().length > 0 && (
              <View style={[styles.searchDropdown, { borderTopColor: colors.border }]}>
                <ScrollView
                  style={styles.searchDropdownScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {isSearching ? (
                    <View style={styles.searchLoadingRow}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.searchLoadingText, { color: colors.textSecondary }]}>{t.loading}</Text>
                    </View>
                  ) : (
                    <>
                      {/* Products Section */}
                      {searchResults.posts.length > 0 && (
                        <View style={styles.searchSection}>
                          <Text style={[styles.searchSectionTitle, { color: colors.textTertiary }]}>{t.products}</Text>
                          {searchResults.posts.map((post) => (
                            <TouchableOpacity
                              key={post._id}
                              style={styles.searchResultItem}
                              onPress={() => handlePostResultPress(post)}
                            >
                              <Image
                                source={{ uri: post.houseImages?.[0] || 'https://via.placeholder.com/50' }}
                                style={styles.searchResultImage}
                              />
                              <View style={styles.searchResultInfo}>
                                <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                                  {post.productName}
                                </Text>
                                <Text style={[styles.searchResultSub, { color: colors.textSecondary }]}>
                                  {post.amount} • {post.location}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Places Section */}
                      {searchResults.places.length > 0 && (
                        <View style={styles.searchSection}>
                          <Text style={[styles.searchSectionTitle, { color: colors.textTertiary }]}>{t.places}</Text>
                          {searchResults.places.map((place) => (
                            <TouchableOpacity
                              key={place._id}
                              style={styles.searchResultItem}
                              onPress={() => handlePlaceResultPress(place)}
                            >
                              <View style={[styles.searchResultIcon, { backgroundColor: colors.activeCardBg }]}>
                                <Ionicons name="location-outline" size={18} color={colors.activeText} />
                              </View>
                              <View style={styles.searchResultInfo}>
                                <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                                  {place.name}
                                </Text>
                                <Text style={[styles.searchResultSub, { color: colors.textSecondary }]}>
                                  {place.category || 'Place'} • {place.address?.full || place.address || ''}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Shops Section */}
                      {searchResults.shops.length > 0 && (
                        <View style={styles.searchSection}>
                          <Text style={[styles.searchSectionTitle, { color: colors.textTertiary }]}>{t.shops}</Text>
                          {searchResults.shops.map((shop) => (
                            <TouchableOpacity
                              key={shop._id}
                              style={styles.searchResultItem}
                              onPress={() => handleShopResultPress(shop)}
                            >
                              <View style={[styles.searchResultIcon, { backgroundColor: colors.inactiveCardBg }]}>
                                <MaterialCommunityIcons name="store-outline" size={18} color={colors.textPrimary} />
                              </View>
                              <View style={styles.searchResultInfo}>
                                <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                                  {shop.name}
                                </Text>
                                <Text style={[styles.searchResultSub, { color: colors.textSecondary }]}>
                                  {shop.mall?.name || 'Shopping Mall'} • {shop.mall?.address || ''}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* No results */}
                      {searchResults.posts.length === 0 &&
                       searchResults.places.length === 0 &&
                       searchResults.shops.length === 0 && (
                        <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>{t.noResults}</Text>
                      )}

                      {/* "See all" links */}
                      <View style={styles.seeAllRow}>
                        <TouchableOpacity onPress={() => navigateToSearch('posts')} style={styles.seeAllButton}>
                          <Text style={[styles.seeAllText, { color: colors.accent }]}>{t.seeAllPosts}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigateToSearch('map')} style={styles.seeAllButton}>
                          <Text style={[styles.seeAllText, { color: colors.accent }]}>{t.seeAllPlaces}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Map image – hidden when search is expanded */}
            {!searchExpanded && (
              <View style={styles.imageCenteredContainer}>
                <Image source={map1flag} style={styles.mapImage} resizeMode="contain" />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed bottom content */}
        <View style={styles.bottomContentContainer}>
          <View style={styles.locationRow}>
            <Image source={logo} style={[styles.locationIcon, { tintColor: colors.textPrimary }]} />
            <Text style={[styles.locationText, { color: colors.textPrimary }]}>{t.locate}</Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>{t.description}</Text>

          <View style={styles.avatarRow}>
            <Image source={user2} style={[styles.avatar, { backgroundColor: '#ccc' }]} />
            <Image source={user1} style={[styles.avatar, styles.avatarOverlap, { backgroundColor: '#ccc' }]} />
            <Image source={countryFlag} style={[styles.avatar, styles.avatarOverlap2]} />
            <Text style={[styles.communityText, { color: colors.textPrimary }]}>{t.users}</Text>
          </View>
        </View>

        {/* Fixed bottom area: selection cards + auth buttons */}
        <View style={styles.footer}>
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
                  navigation.navigate('Search');
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

          {!isLoggedIn && (
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
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  curve: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: width * 0.9,
    top: 0,
    left: 0,
    zIndex: -1,
  },
  mainContainer: {
    flex: 1,
    paddingTop: 8,
  },
  scrollView: {
    flex: 1,
  },
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

  // Search styles
  searchWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    overflow: 'hidden',
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  searchIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00000001',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  expandedSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 5,
  },
  closeSearchBtn: { marginLeft: 8, padding: 4 },
  searchDropdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
    width: '100%',
  },
  searchDropdownScroll: {
    maxHeight: height * 0.4, // Limit height so only this area scrolls
  },
  searchSection: {
    marginBottom: 10,
  },
  searchSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchResultSub: {
    fontSize: 11,
    marginTop: 2,
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  searchLoadingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  noResultsText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  seeAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingBottom: 4,
  },
  seeAllButton: {
    paddingVertical: 6,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Welcome & tagline
  welcomeText: {
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: 'bold',
    fontFamily: 'Irish Grover',
    textAlign: 'center',
    marginBottom: height * 0.008,
  },
  tagline: {
    fontSize: Math.min(width * 0.04, 16),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  // Map image
  imageCenteredContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  mapImage: {
    width: width * 0.95,
    height: width * 0.5,
    alignSelf: 'center',
  },

  // Bottom fixed content
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
  },
  locationIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  locationText: {
    fontSize: Math.min(width * 0.05, 20),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  description: {
    fontSize: Math.min(width * 0.035, 14),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: Math.min(width * 0.06, 24),
    paddingHorizontal: 10,
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
  avatarOverlap: {
    marginLeft: -width * 0.03,
  },
  avatarOverlap2: {
    marginLeft: -width * 0.03,
  },
  communityText: {
    marginLeft: width * 0.03,
    fontSize: Math.min(width * 0.035, 14),
    fontFamily: 'Inter',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  selectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectionCard: {
    flexDirection: 'row',
    width: '32%',
    alignItems: 'center',
    paddingVertical: 10,
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
    top: -8,
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