// screens/SearchScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';

// ========== Helper functions (same as BuyPostScreen) ==========
const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

const sortFeedPosts = (posts, shuffleNonFeatured = false) => {
  const featured = posts.filter(p => p.featured);
  const nonFeatured = posts.filter(p => !p.featured);
  featured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (shuffleNonFeatured) {
    return [...featured, ...shuffleArray(nonFeatured)];
  } else {
    nonFeatured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return [...featured, ...nonFeatured];
  }
};
// ================================================================

const { height } = Dimensions.get('window');
const RECENT_SEARCHES_KEY = '@recent_searches';
const PAGE_SIZE = 10;

const loadingLogo = require('../assets/logos.png');

const defaultTheme = {
  background: '#ffffff',
  cardBackground: '#ffffff',
  border: '#e5e5e5',
  accent: '#4CAF50',
  text: '#111111',
  textSecondary: '#6b7280',
};

const SEARCH_BAR_HEIGHT = 56;
const SCROLL_THRESHOLD = 20;
const LOOP_MULTIPLIER = 30;

const SearchScreen = ({ navigation, route, language }) => {
  const { theme } = useTheme();
  const { user: authUser } = useAuth();
  const activeTheme = theme || defaultTheme;

  const [searchQuery, setSearchQuery] = useState('');
  const [feedPosts, setFeedPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchSections, setSearchSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(!!authUser);
  const [currentUser, setCurrentUser] = useState(authUser || null);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    } else {
      setCurrentUser(null);
      setIsLoggedIn(false);
    }
  }, [authUser]);

  // ---------- Header collapse animation ----------
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHeightAnim = useRef(new Animated.Value(SEARCH_BAR_HEIGHT)).current;
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const scrollAccumulator = useRef(0);
  const isAnimatingHeader = useRef(false);

  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const translations = {
    English: {
      loading: 'Getting things ready...',
      placeholder: 'Search products, locations...',
      noResults: 'No results found',
      recent: 'Recent searches',
      clear: 'Clear',
      noPosts: 'No posts available',
      loginRequired: 'Login Required',
      loginMessage: 'Please login to view post details',
      login: 'Login',
      cancel: 'Cancel',
      topResults: 'Top Results',
      users: 'Users',
      posts: 'Posts',
      places: 'Places',
      hashtags: 'Hashtags',
    },
    Kinyarwanda: {
      loading: 'Turigutunganya page neza...',
      placeholder: 'Shakisha ibicuruzwa, hano...',
      noResults: 'Nta byabonetse',
      recent: 'Ibyashakishijwe cyane',
      clear: 'Hanagura',
      noPosts: 'Nta gicuruzwa gihari',
      loginRequired: 'Ugomba kwinjira',
      loginMessage: 'Nyamuneka winjire kugira ngo urebe ibyo ushaka',
      login: 'Kwinjira',
      cancel: 'Hagarika',
      topResults: 'Ibyavuye mu gushaka',
      users: 'Abakoresha',
      posts: 'Igicuruzwa',
      places: 'Ahantu',
      hashtags: 'urwego',
    },
  };

  const t = translations[language] || translations.English;

  // Loading animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoScaleAnim, {
            toValue: 1.2,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading, logoScaleAnim]);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ---------- Header animation helpers ----------
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
        toValue: SEARCH_BAR_HEIGHT,
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

  const handleScroll = useCallback(
    (event) => {
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
    },
    [headerVisible]
  );

  useEffect(() => {
    if (!headerVisible) animateHeaderShow();
    lastScrollY.current = 0;
    scrollAccumulator.current = 0;
  }, [searchQuery]);

  const getToken = async () => await AsyncStorage.getItem('userToken');

  const loadCurrentUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        if (authUser) {
          setCurrentUser(authUser);
          setIsLoggedIn(true);
        }
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success && response.data.user) {
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
      } else if (authUser) {
        setCurrentUser(authUser);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error('Load current user error:', error);
      if (authUser) {
        setCurrentUser(authUser);
        setIsLoggedIn(true);
      }
    }
  }, [authUser, getToken]);

  const checkLoginStatus = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
      if (loggedIn === 'true') await loadCurrentUser();
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFeed = useCallback(async (pageNum = 1, limit = 20) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/posts`, {
        params: { page: pageNum, limit },
      });
      const activePosts = (response.data.posts || []).map(mapPost).filter(p => p.status !== 'stopped');
      return { posts: activePosts, hasMore: response.data.hasMore !== false };
    } catch (error) {
      console.error('Feed fetch failed:', error.message);
      throw error;
    }
  }, []);

  const fetchPosts = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const feed = await fetchFeed(pageNum);
      const newPosts = feed.posts;

      let filteredPosts = newPosts;
      if (isLoggedIn && currentUser) {
        filteredPosts = newPosts.filter(post => post.userId !== currentUser._id);
      }

      if (refresh) {
        const sorted = sortFeedPosts(filteredPosts, true);
        setAllPosts(sorted);
        setFeedPosts(sorted);
        setPage(1);
        setHasMore(feed.hasMore);
      } else {
        const combined = [...feedPosts, ...filteredPosts];
        const sortedCombined = sortFeedPosts(combined, false);
        setFeedPosts(sortedCombined);
        setAllPosts(sortedCombined);
        setPage(pageNum);
        setHasMore(feed.hasMore);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn, currentUser, feedPosts, fetchFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    if (!headerVisible) animateHeaderShow();
    fetchPosts(1, true);
  };

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const saveRecentSearch = async (query) => {
    if (!query.trim()) return;
    let updated = [query, ...recentSearches.filter((s) => s !== query)];
    if (updated.length > 10) updated = updated.slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // ---------- Modified performSearch: include user avatar ----------
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchSections([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    let filtered = allPosts.filter((post) =>
      post.productName?.toLowerCase().includes(lowerQuery) ||
      post.description?.toLowerCase().includes(lowerQuery) ||
      post.location?.toLowerCase().includes(lowerQuery) ||
      post.username?.toLowerCase().includes(lowerQuery)
    );

    setSearchResults(filtered);

    const sections = [];

    if (filtered.length > 0) {
      sections.push({
        title: t.topResults,
        data: filtered.slice(0, 3),
        type: 'post',
      });
    }

    // Build users list with avatar
    const matchedUsersMap = new Map(); // key = username, value = first post with that username
    allPosts.forEach((p) => {
      if (p.username?.toLowerCase().includes(lowerQuery)) {
        if (!matchedUsersMap.has(p.username)) {
          matchedUsersMap.set(p.username, p);
        }
      }
    });

    const matchedUsers = Array.from(matchedUsersMap.values()).slice(0, 5).map((post) => ({
      id: `user-${post.username}`,
      value: post.username,
      avatar: post.userAvatar || null,
    }));

    if (matchedUsers.length > 0) {
      sections.push({
        title: t.users,
        data: matchedUsers,
        type: 'user',
      });
    }

    const remainingPosts = filtered.slice(3);
    if (remainingPosts.length > 0) {
      sections.push({
        title: t.posts,
        data: remainingPosts,
        type: 'post',
      });
    }

    const matchedPlaces = [...new Set(
      allPosts
        .filter((p) => p.location?.toLowerCase().includes(lowerQuery))
        .map((p) => p.location)
    )];

    if (matchedPlaces.length > 0) {
      sections.push({
        title: t.places,
        data: matchedPlaces.slice(0, 5).map((p) => ({ id: `place-${p}`, value: p })),
        type: 'place',
      });
    }

    const hashtags = [];
    allPosts.forEach((p) => {
      if (p.description) {
        const words = p.description.split(' ');
        words.forEach((w) => {
          if (w.startsWith('#') && w.toLowerCase().includes(lowerQuery)) {
            hashtags.push(w);
          }
        });
      }
    });

    const uniqueHashtags = [...new Set(hashtags)];
    if (uniqueHashtags.length > 0) {
      sections.push({
        title: t.hashtags,
        data: uniqueHashtags.slice(0, 5).map((h) => ({ id: `hashtag-${h}`, value: h })),
        type: 'hashtag',
      });
    }

    setSearchSections(sections);
  };

  useEffect(() => {
    const initialQuery = route?.params?.searchQuery || '';
    if (initialQuery && initialQuery !== searchQuery) {
      setSearchQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [route?.params?.searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, allPosts]);

  useEffect(() => {
    checkLoginStatus();
    fetchPosts(1, true);
    loadRecentSearches();

    const unsubscribe = navigation.addListener('focus', () => {
      checkLoginStatus();
      fetchPosts(1, true);
    });

    return unsubscribe;
  }, [navigation]);

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSections([]);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      performSearch(searchQuery);
      Keyboard.dismiss();
    }
  };

  const handleRecentPress = (term) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    performSearch(term);
    Keyboard.dismiss();
  };

  const handlePostPress = (item) => {
    if (!isLoggedIn) {
      showAppAlert(
        t.loginRequired,
        t.loginMessage,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.login, onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    navigation.navigate('PostDetail', { house: item });
  };

  const loopedExploreData = useMemo(() => {
    if (!allPosts || allPosts.length === 0) return [];
    let arr = [];
    for (let i = 0; i < LOOP_MULTIPLIER; i++) {
      arr = arr.concat(allPosts);
    }
    return arr;
  }, [allPosts]);

  const renderExploreItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.gridItem, { borderColor: activeTheme.border }]}
      onPress={() => handlePostPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.houseImages?.[0] || 'https://via.placeholder.com/300x300' }}
        style={styles.gridImage}
      />
      {item.videoUrl && (
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={30} color="white" />
        </View>
      )}
      {item.houseImages?.length > 1 && (
        <View style={styles.carouselIcon}>
          <Ionicons name="images-outline" size={16} color="white" />
        </View>
      )}

      <View style={styles.gridInfo}>
        <Text style={[styles.gridTitle, { color: activeTheme.disc }]} numberOfLines={1}>
          {item.productName || 'Item'}
        </Text>
        <Text style={[styles.gridPrice, { color: activeTheme.title }]}>
          {item.amount || `${item.price?.toLocaleString() || 0} RWF`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ---------- Updated renderSearchSection to show real avatar ----------
  const renderSearchSection = ({ section }) => {
    if (section.type === 'user') {
      return section.data.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.searchUserItem, { borderBottomColor: activeTheme.border }]}
          onPress={() => {
            setSearchQuery(item.value);
            saveRecentSearch(item.value);
            performSearch(item.value);
            Keyboard.dismiss();
          }}
        >
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar }}
              style={styles.userAvatar}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={40} color={activeTheme.accent} />
          )}
          <Text style={[styles.searchUserText, { color: activeTheme.text }]}>{item.value}</Text>
        </TouchableOpacity>
      ));
    }

    if (section.type === 'place') {
      return section.data.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.searchPlaceItem, { borderBottomColor: activeTheme.border }]}
          onPress={() => {
            setSearchQuery(item.value);
            saveRecentSearch(item.value);
            performSearch(item.value);
            Keyboard.dismiss();
          }}
        >
          <Ionicons name="location-outline" size={20} color={activeTheme.textSecondary} />
          <Text style={[styles.searchPlaceText, { color: activeTheme.text }]}>{item.value}</Text>
        </TouchableOpacity>
      ));
    }

    if (section.type === 'hashtag') {
      return section.data.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.searchHashtagItem, { borderBottomColor: activeTheme.border }]}
          onPress={() => {
            setSearchQuery(item.value);
            saveRecentSearch(item.value);
            performSearch(item.value);
            Keyboard.dismiss();
          }}
        >
          <Text style={[styles.searchHashtagText, { color: activeTheme.accent }]}>{item.value}</Text>
        </TouchableOpacity>
      ));
    }

    return section.data.map((item) => (
      <TouchableOpacity
        key={item._id}
        style={[styles.searchPostItem, { borderBottomColor: activeTheme.border }]}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.houseImages?.[0] || 'https://via.placeholder.com/60x60' }}
          style={styles.searchPostThumb}
        />
        <View style={styles.searchPostInfo}>
          <Text style={[styles.searchPostTitle, { color: activeTheme.text }]} numberOfLines={1}>
            {item.productName || item.description}
          </Text>
          <Text style={[styles.searchPostMeta, { color: activeTheme.textSecondary }]}>
            {item.username} • {item.location}
          </Text>
        </View>
      </TouchableOpacity>
    ));
  };

  if (loading && allPosts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]} edges={[]}>
        <View style={styles.center}>
          <Animated.Image
            source={loadingLogo}
            style={[styles.loadingImage, { transform: [{ scale: logoScaleAnim }] }]}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: activeTheme.text }]}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSearching = searchQuery.trim() !== '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]} edges={[]}>
      <View style={{ flex: 1 }}>
        {/* Animated search bar */}
        <Animated.View
          style={{
            height: headerHeightAnim,
            opacity: headerOpacityAnim,
            overflow: 'hidden',
          }}
        >
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: activeTheme.cardBackground,
                borderColor: activeTheme.border,
              },
            ]}
          >
            <Ionicons name="search" size={20} color={activeTheme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: activeTheme.text,
                  borderRadius: 12,
                  borderWidth: 0,
                  borderColor: activeTheme.border,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                },
              ]}
              placeholder={t.placeholder}
              placeholderTextColor={activeTheme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              autoFocus={false}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color={activeTheme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <View style={{ flex: 1, paddingBottom: 0 }}>
          {!isSearching ? (
            <>
              {allPosts.length === 0 ? (
                <View style={styles.center}>
                  <Text style={{ color: activeTheme.textSecondary, fontSize: 16, marginTop: 40 }}>
                    {t.noPosts}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={loopedExploreData}
                  keyExtractor={(item, index) => `${item._id}-${index}`}
                  numColumns={2}
                  renderItem={renderExploreItem}
                  contentContainerStyle={[styles.gridList, { paddingBottom: 0 }]}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={activeTheme.accent}
                    />
                  }
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                />
              )}
            </>
          ) : (
            <SectionList
              sections={searchSections}
              keyExtractor={(item, index) => (item.id ? item.id : item._id ? item._id : `${String(item)}-${index}`)}
              renderSectionHeader={({ section: { title } }) => (
                <View style={[styles.sectionHeader, { backgroundColor: activeTheme.background }]}>
                  <Text style={[styles.sectionTitle, { color: activeTheme.text }]}>{title}</Text>
                </View>
              )}
              renderItem={() => null}
              renderSectionFooter={({ section }) => (
                <View style={styles.sectionFooter}>
                  {section.data.length > 0 ? renderSearchSection({ section }) : null}
                </View>
              )}
              contentContainerStyle={[styles.searchList, { paddingBottom: 0 }]}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={{ color: activeTheme.textSecondary, fontSize: 16, marginTop: 40 }}>
                    {t.noResults}
                  </Text>
                </View>
              }
              stickySectionHeadersEnabled={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingImage: {
    width: 150,
    height: 150,
  },
  loadingText: {
    marginTop: 22,
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 5,
    marginBottom: 5,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 16,
    borderWidth: 1.2,
    height: 48,
    width: 'auto',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearBtn: {
    marginLeft: 8,
    padding: 4,
  },
  gridList: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  gridItem: {
    flex: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  carouselIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  gridInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(62, 62, 62, 0.76)',
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  gridPrice: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ffcc00',
  },
  searchList: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionFooter: {
    marginBottom: 12,
  },
  searchUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchUserText: {
    fontSize: 16,
    marginLeft: 12,
  },
  searchPlaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  searchPlaceText: {
    fontSize: 14,
    marginLeft: 8,
  },
  searchHashtagItem: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  searchHashtagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchPostItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  searchPostThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  searchPostInfo: {
    flex: 1,
  },
  searchPostTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchPostMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 0.8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchScreen;