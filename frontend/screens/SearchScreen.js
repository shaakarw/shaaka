// screens/SearchScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import ProductHeroDeck from '../components/ProductHeroDeck';
import { getUserDisplayName } from '../utils/userIdentity';

// ========== Helper functions ==========
const shuffleArray = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const mapPost = (post) => ({
  ...post,
  _id: post._id,
  id: post._id,
  username: getUserDisplayName(post.user || post, 'User'),
  userAvatar: post.userAvatar || post.user?.avatar,
  amount: post.amount || `RWF ${post.price?.toLocaleString() || '0'}`,
  price: post.price,
  category: post.category || '',
  location: post.location || 'Unknown location',
  description: post.description || 'No description provided.',
  productName: post.productName || 'Product',
  houseImages: post.houseImages || [],
  videoUrl: post.videoUrl || post.video?.url || '',
  videoThumbnail: post.videoThumbnail || post.video?.thumbnail || '',
  videoLink: post.videoLink || '',
  videoDuration: post.videoDuration || post.video?.duration || 0,
  videoHlsUrl: post.videoHlsUrl || '',
  videoId: post.videoId || '',
  contactNumber1: post.contactNumbers?.[0] || '',
  contactNumber2: post.contactNumbers?.[1] || '',
  priceNegotiable: post.priceNegotiable || false,
  userId: post.user?._id || post.user,
  status: post.status || 'active',
  featured: post.featured || false,
  trending: post.trending || false,
});

const getVideoCover = (videoUrl, videoThumbnail) => {
  if (videoThumbnail) return videoThumbnail;
  if (!videoUrl || !videoUrl.includes('res.cloudinary.com')) return null;
  const [urlWithoutQuery] = videoUrl.split('?');
  const uploadMarker = '/video/upload/';
  if (!urlWithoutQuery.includes(uploadMarker)) return null;
  return urlWithoutQuery
    .replace(uploadMarker, '/video/upload/so_5/')
    .replace(/\.[^/.]+$/, '.jpg');
};

const sortFeedPosts = (posts, shuffleNonFeatured = false) => {
  const featured = posts.filter((p) => p.featured);
  const nonFeatured = posts.filter((p) => !p.featured);
  featured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (shuffleNonFeatured) {
    return [...featured, ...shuffleArray(nonFeatured)];
  } else {
    nonFeatured.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return [...featured, ...nonFeatured];
  }
};
// ================================================================

const { width } = Dimensions.get('window');
const RECENT_SEARCHES_KEY = '@recent_searches';
const PAGE_SIZE = 20;
const SECTION_WIDTH = width;
const AUTO_SLIDE_INTERVAL = 10000;

// ---------- Hero-deck section (3 cards sliding) ----------
const HeroDeckSection = ({ posts, theme, isDarkMode, onPressPost, onPressUser }) => {
  const colors = {
    background: theme.background,
    cardBackground: theme.cardBackground || (isDarkMode ? '#1C1C1E' : '#FFFFFF'),
    border: theme.border || (isDarkMode ? '#2C2C2E' : '#D7DDD8'),
    text: theme.text,
    textSecondary: theme.textSecondary,
    login: theme.login || '#47ae87',
    brand: theme.login || '#47ae87',
    title: theme.text,
    overlay: '#000000',
  };

  if (!posts || posts.length === 0) return null;

  return (
    <View style={[styles.heroSection, { width: SECTION_WIDTH }]}>
      <View style={styles.heroSectionHeader}>
        <View style={styles.heroSectionBadge}>
          <Ionicons name="flame" size={18} color="#fff" />
          <Text style={styles.heroSectionBadgeText}>Trending</Text>
        </View>
      </View>
      <ProductHeroDeck
        products={posts}
        colors={colors}
        onPressProduct={onPressPost}
        onPressUserProfile={onPressUser}
      />
    </View>
  );
};

const SearchScreen = ({ navigation, route, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();

  const bgColor = theme.background || (isDarkMode ? '#111111' : '#DDDDDD');
  const txtColor = theme.text || (isDarkMode ? '#FFFFFF' : '#111111');
  const subTextColor = theme.textSecondary || (isDarkMode ? '#9CA3AF' : '#6B7280');
  const inputBgColor = isDarkMode ? '#202124' : '#FFFFFF';
  const softBorder = theme.border || (isDarkMode ? '#2C2C2E' : '#D7DDD8');

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const [allPosts, setAllPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(!!authUser);
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const didInitialLoadRef = useRef(false);
  const leftScreenRef = useRef(false);
  const firstAuthRunRef = useRef(true);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    } else {
      setCurrentUser(null);
      setIsLoggedIn(false);
    }
  }, [authUser]);

  const [showBackToTop, setShowBackToTop] = useState(false);
  const listRef = useRef(null);
  const heroScrollRef = useRef(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const headerOpacityAnim = useRef(new Animated.Value(1)).current;

  // ---- 3-per-row trending grid (infinite loop) ----
  const [gridPosts, setGridPosts] = useState([]);
  const gridOffsetRef = useRef(0);

  const sectionGroups = useMemo(() => chunk(trendingPosts, 3), [trendingPosts]);

  const translations = {
    English: {
      loading: 'Getting things ready...',
      placeholder: 'Search Here...',
      noResults: 'No results found',
      noPosts: 'No products available right now',
      loginRequired: 'Login Required',
      loginMessage: 'Please login to view post details',
      login: 'Login',
      cancel: 'Cancel',
      trending: 'Trending now',
      results: 'Products',
      users: 'Users',
    },
    Kinyarwanda: {
      loading: 'Turigutunganya page neza...',
      placeholder: 'Shakira Hano...',
      noResults: 'Nta byabonetse',
      noPosts: 'Nta gicuruzwa gihari ubu',
      loginRequired: 'Ugomba kwinjira',
      loginMessage: 'Nyamuneka jyakwinjira kugira ngo urebe ibyo ushaka',
      login: 'Kwinjira',
      cancel: 'Hagarika',
      trending: 'Ibikunzwe ubu',
      results: 'Ibicuruzwa',
      users: 'Abakoresha',
    },
  };

  const t = translations[language] || translations.English;

  // ---------- Stable helpers ----------
  const getToken = useCallback(async () => await AsyncStorage.getItem('userToken'), []);

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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success && response.data.user) {
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
      } else if (authUser) {
        setCurrentUser(authUser);
        setIsLoggedIn(true);
      }
    } catch (error) {
      if (authUser) {
        setCurrentUser(authUser);
        setIsLoggedIn(true);
      }
    }
  }, [authUser, getToken]);

  const checkLoginStatus = useCallback(async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
      if (loggedIn === 'true') await loadCurrentUser();
    } catch (error) {
      console.error(error);
    }
  }, [loadCurrentUser]);

  // ---------- Data fetching ----------
  const fetchFeed = useCallback(async (pageNum = 1, limit = PAGE_SIZE) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/posts`, {
        params: { page: pageNum, limit },
      });
      const activePosts = (response.data.posts || [])
        .map(mapPost)
        .filter((p) => p.status !== 'stopped');
      return { posts: activePosts, hasMore: response.data.hasMore !== false };
    } catch (error) {
      console.error('Feed fetch failed:', error.message);
      throw error;
    }
  }, []);

  const fetchPosts = useCallback(
    async (pageNum = 1, refresh = false) => {
      try {
        const feed = await fetchFeed(pageNum);
        const newPosts = feed.posts;

        let filteredPosts = newPosts;
        if (isLoggedIn && currentUser) {
          filteredPosts = newPosts.filter((post) => post.userId !== currentUser._id);
        }

        const sorted = sortFeedPosts(filteredPosts, refresh);

        if (refresh) {
          setAllPosts(sorted);
          setPage(1);
        } else {
          setAllPosts((prev) => sortFeedPosts([...prev, ...filteredPosts], false));
          setPage(pageNum);
        }

        const trending = sorted.filter((p) => p.trending);
        setTrendingPosts(trending.length > 0 ? trending : sorted);

        setHasMore(feed.hasMore);
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLoggedIn, currentUser, fetchFeed]
  );

  const loadMorePosts = useCallback(async () => {
    if (
      loading ||
      refreshing ||
      loadingMoreRef.current ||
      !hasMore ||
      searchQuery.trim()
    )
      return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchPosts(page + 1);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, refreshing, hasMore, searchQuery, page, fetchPosts]);

  const scrollToTop = useCallback(async () => {
    heroScrollRef.current?.scrollTo({ x: 0, animated: true });
    setActiveSectionIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    headerOpacityAnim.setValue(1);
    setRefreshing(true);
    try {
      await fetchPosts(1, true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPosts, headerOpacityAnim]);

  const fetchPostsRef = useRef(fetchPosts);
  const checkLoginStatusRef = useRef(checkLoginStatus);

  useEffect(() => {
    fetchPostsRef.current = fetchPosts;
  }, [fetchPosts]);

  useEffect(() => {
    checkLoginStatusRef.current = checkLoginStatus;
  }, [checkLoginStatus]);

  // ---------- Auto-slide every 10s ----------
  useEffect(() => {
    if (sectionGroups.length <= 1) return undefined;
    if (searchQuery.trim()) return undefined;

    const timer = setTimeout(() => {
      const next = (activeSectionIndex + 1) % sectionGroups.length;
      heroScrollRef.current?.scrollTo({
        x: next * SECTION_WIDTH,
        animated: true,
      });
      setActiveSectionIndex(next);
    }, AUTO_SLIDE_INTERVAL);

    return () => clearTimeout(timer);
  }, [activeSectionIndex, sectionGroups.length, searchQuery]);

  // ---------- Scroll ----------
  const handleScroll = useCallback(
    (event) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      setShowBackToTop(currentScrollY > 200);
      headerOpacityAnim.setValue(Math.max(1 - currentScrollY / 240, 0));
    },
    [headerOpacityAnim]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(1, true);
  }, [fetchPosts]);

  // ---------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------
  const runSearch = useCallback(
    (rawQuery) => {
      const q = (rawQuery || '').trim().toLowerCase();

      const candidates = allPosts;
      let productMatches = candidates;
      let userMatches = [];

      if (q) {
        productMatches = candidates.filter(
          (post) =>
            post.productName?.toLowerCase().includes(q) ||
            post.description?.toLowerCase().includes(q) ||
            post.location?.toLowerCase().includes(q) ||
            post.username?.toLowerCase().includes(q)
        );

        // Users whose username matches the query
        const userMap = new Map();
        candidates.forEach((post) => {
          const uname = post.username || '';
          if (uname.toLowerCase().includes(q)) {
            if (!userMap.has(uname)) {
              userMap.set(uname, {
                username: uname,
                userId: post.userId,
                avatar: post.userAvatar,
                productCount: 0,
              });
            }
            userMap.get(uname).productCount += 1;
          }
        });
        userMatches = Array.from(userMap.values());
      }

      productMatches.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setSearchResults(productMatches);
      setMatchedUsers(userMatches);
    },
    [allPosts]
  );

  // Debounced auto-search as the user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSubmittedQuery('');
      setSearchResults([]);
      setMatchedUsers([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSubmittedQuery(q);
      runSearch(q);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  // Initial query from route params
  useEffect(() => {
    const initialQuery = route?.params?.searchQuery || '';
    if (initialQuery && initialQuery !== searchQuery) {
      setSearchQuery(initialQuery);
      setSubmittedQuery(initialQuery);
      runSearch(initialQuery);
    }
  }, [route?.params?.searchQuery]);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      checkLoginStatusRef.current?.();
      fetchPostsRef.current?.(1, true);
    }

    const unsubscribeBlur = navigation.addListener('blur', () => {
      leftScreenRef.current = true;
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (!leftScreenRef.current) return;
      leftScreenRef.current = false;
      checkLoginStatusRef.current?.();
      fetchPostsRef.current?.(1, true);
    });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation]);

  useEffect(() => {
    if (firstAuthRunRef.current) {
      firstAuthRunRef.current = false;
      return;
    }
    fetchPostsRef.current?.(1, true);
  }, [authUser?._id]);

  // ---------------------------------------------------------------
  // 3-per-row trending grid → seed on feed load
  // ---------------------------------------------------------------
  useEffect(() => {
    const source = trendingPosts.length ? trendingPosts : allPosts;
    if (source.length === 0) {
      setGridPosts([]);
      gridOffsetRef.current = 0;
      return;
    }
    const seed = source.slice(0, Math.min(PAGE_SIZE, source.length));
    setGridPosts(seed);
    gridOffsetRef.current = seed.length % source.length;
  }, [trendingPosts, allPosts]);

  // ---------------------------------------------------------------
  // Infinite loop loader — always cycles from the top of the source
  // ---------------------------------------------------------------
  const loadMoreGridPosts = useCallback(() => {
    if (loadingMoreRef.current) return;

    const source = trendingPosts.length ? trendingPosts : allPosts;
    if (source.length === 0) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    setTimeout(() => {
      setGridPosts((prev) => {
        const next = [];
        const start = gridOffsetRef.current;
        for (let i = 0; i < PAGE_SIZE; i++) {
          const idx = (start + i) % source.length;
          next.push(source[idx]);
        }
        gridOffsetRef.current = (start + PAGE_SIZE) % source.length;
        return [...prev, ...next];
      });
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }, 250);
  }, [trendingPosts, allPosts]);

  const handleClear = () => {
    setSearchQuery('');
    setSubmittedQuery('');
    setSearchResults([]);
    setMatchedUsers([]);
  };

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!q) {
      handleClear();
      return;
    }
    setSubmittedQuery(q);
    runSearch(q);
    Keyboard.dismiss();
  };

  const handlePostPress = (item) => {
    if (!isLoggedIn) {
      showAppAlert(t.loginRequired, t.loginMessage, [
        { text: t.cancel, style: 'cancel' },
        { text: t.login, onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    navigation.navigate('PostDetail', { house: item });
  };

  const handleUserPress = (product) => {
    const userId = product?.userId || product?.user?._id || product?.user;
    if (!userId) return;
    navigation.navigate('Profile', {
      userId,
      username: product?.username || 'User',
    });
  };

  // ---------- RENDERERS ----------

  const renderSearchResultItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.resultItem,
        { backgroundColor: 'transparent', borderWidth: 0 },
      ]}
      onPress={() => handlePostPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.resultImageWrap}>
        {item.videoUrl ? (
          <View style={styles.videoBadgeResult}>
            <Ionicons name="videocam" size={14} color="#fff" />
          </View>
        ) : null}
        <Image
          source={{
            uri:
              getVideoCover(item.videoUrl, item.videoThumbnail) ||
              item.houseImages?.[0] ||
              'https://via.placeholder.com/150',
          }}
          style={styles.resultImage}
        />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: txtColor }]} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={[styles.resultSub, { color: subTextColor }]} numberOfLines={1}>
          {item.location}
        </Text>
        {!!item.amount && (
          <Text
            style={[styles.resultAmount, { color: theme.login || '#47ae87' }]}
            numberOfLines={1}
          >
            {item.amount}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={subTextColor} />
    </TouchableOpacity>
  );

  const renderUserResultItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.userResultItem,
        { backgroundColor: 'transparent', borderWidth: 0 },
      ]}
      onPress={() =>
        navigation.navigate('Profile', {
          userId: item.userId,
          username: item.username,
        })
      }
      activeOpacity={0.8}
    >
      <View style={styles.userAvatarWrap}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        ) : (
          <View
            style={[
              styles.userAvatarFallback,
              { backgroundColor: theme.login || '#47ae87' },
            ]}
          >
            <Text style={styles.userAvatarInitial}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.userName, { color: txtColor }]} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={[styles.userMeta, { color: subTextColor }]} numberOfLines={1}>
          {item.productCount} {t.results}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={subTextColor} />
    </TouchableOpacity>
  );

  // ---------- 3-per-row grid tile ----------
  const renderGridItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.gridItem}
      activeOpacity={0.85}
      onPress={() => handlePostPress(item)}
    >
      <View style={styles.gridImageWrap}>
        {item.videoUrl ? (
          <View style={styles.gridVideoBadge}>
            <Ionicons name="videocam" size={12} color="#fff" />
          </View>
        ) : null}
        <Image
          source={{
            uri:
              getVideoCover(item.videoUrl, item.videoThumbnail) ||
              item.houseImages?.[0] ||
              'https://via.placeholder.com/150',
          }}
          style={styles.gridImage}
        />
      </View>
      <Text style={[styles.gridTitle, { color: txtColor }]} numberOfLines={1}>
        {item.productName}
      </Text>
      {!!item.amount && (
        <Text
          style={[styles.gridAmount, { color: theme.login || '#47ae87' }]}
          numberOfLines={1}
        >
          {item.amount}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderBrowseView = () => {
    if (sectionGroups.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="flame-outline" size={48} color={subTextColor} />
          <Text style={{ color: subTextColor, fontSize: 15, marginTop: 12 }}>
            {t.noPosts}
          </Text>
        </View>
      );
    }

    const handleSectionScroll = (event) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SECTION_WIDTH);
      setActiveSectionIndex(index);
    };

    const ListHeader = (
      <View>
        <ScrollView
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSectionScroll}
          decelerationRate="fast"
          snapToInterval={SECTION_WIDTH}
          snapToAlignment="start"
        >
          {sectionGroups.map((groupPosts, index) => (
            <HeroDeckSection
              key={`deck-${index}`}
              posts={groupPosts}
              theme={theme}
              isDarkMode={isDarkMode}
              onPressPost={handlePostPress}
              onPressUser={handleUserPress}
            />
          ))}
        </ScrollView>

        {sectionGroups.length > 1 && (
          <View style={styles.sectionDotsRow}>
            {sectionGroups.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.sectionDot,
                  {
                    backgroundColor:
                      i === activeSectionIndex
                        ? theme.login || '#47ae87'
                        : subTextColor + '55',
                    width: i === activeSectionIndex ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        )}

        <Text
          style={[
            styles.sectionTitle,
            { color: txtColor, marginHorizontal: 16, marginTop: 18, marginBottom: 10 },
          ]}
        >
          {t.trending}
        </Text>
      </View>
    );

    return (
      <FlatList
        key="browse-grid"
        ref={listRef}
        data={gridPosts}
        keyExtractor={(item, index) => `grid-${item._id}-${index}`}
        renderItem={renderGridItem}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadMoreGridPosts}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={txtColor}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={styles.loadMoreIndicator}
              color={txtColor}
            />
          ) : null
        }
      />
    );
  };

  // ---------- Search results view (users + products) ----------
  const renderSearchResults = () => {
    // Build the ListHeader: Users section (if any) + Products heading
    const ListHeader = (
      <View>
        {matchedUsers.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: txtColor, marginHorizontal: 16, marginTop: 6, marginBottom: 6 },
              ]}
            >
              {t.users}
            </Text>
            {matchedUsers.slice(0, 5).map((u) => (
              <View key={`user-${u.username}`}>
                {renderUserResultItem({ item: u })}
              </View>
            ))}
          </>
        )}
        <Text
          style={[
            styles.sectionTitle,
            { color: txtColor, marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
          ]}
        >
          {t.results}
          {submittedQuery || searchQuery ? (
            <Text style={{ color: subTextColor, fontSize: 12, fontWeight: '500' }}>
              {'  '}"{submittedQuery || searchQuery}"
            </Text>
          ) : null}
        </Text>
      </View>
    );

    return (
      <FlatList
        key="search-results"
        ref={listRef}
        data={searchResults}
        keyExtractor={(item, index) => `search-${item._id}-${index}`}
        renderItem={renderSearchResultItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={subTextColor} />
            <Text style={{ color: subTextColor, fontSize: 15, marginTop: 12 }}>
              {t.noResults}
            </Text>
          </View>
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const renderContent = () => {
    if (loading && allPosts.length === 0) {
      return (
        <View style={styles.center}>
          <ShaakaLoadingScreen
            message={t.loading}
            backgroundColor={bgColor}
            textColor={txtColor}
            compact
          />
        </View>
      );
    }

    const isSearching = searchQuery.trim() !== '';
    if (isSearching) {
      return renderSearchResults();
    }
    return renderBrowseView();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      {/* ---------- Sticky search bar ---------- */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: inputBgColor, borderColor: softBorder },
        ]}
      >
        <Ionicons name="search" size={20} color={subTextColor} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: txtColor }]}
          placeholder={t.placeholder}
          placeholderTextColor={subTextColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          autoFocus={false}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={subTextColor} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {renderContent()}

        {showBackToTop && (
          <TouchableOpacity
            style={[
              styles.showHeaderButton,
              { backgroundColor: isDarkMode ? '#FFF' : '#111' },
            ]}
            onPress={scrollToTop}
            activeOpacity={0.9}
          >
            <Ionicons name="chevron-up" size={24} color={isDarkMode ? '#111' : '#FFF'} />
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  /* ---------- Sticky search bar ---------- */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    marginHorizontal: 16,
    marginTop: -40,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clearBtn: { marginLeft: 8, padding: 4 },

  /* ---------- Section header ---------- */
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  /* ---------- Hero deck section ---------- */
  heroSection: {
    paddingTop: 28,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  heroSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  heroSectionBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---------- Section dots ---------- */
  sectionDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  sectionDot: {
    height: 6,
    borderRadius: 3,
  },

  /* ---------- 3-per-row product grid ---------- */
  gridContent: {
    paddingBottom: 60,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  gridItem: {
    width: (width - 32 - 16) / 3, // 16 px padding each side + two 8 px gaps
  },
  gridImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridVideoBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  gridAmount: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  /* ---------- Search result rows ---------- */
  listContent: { paddingHorizontal: 0 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  resultImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
    backgroundColor: '#000',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoBadgeResult: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  resultInfo: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  resultSub: { fontSize: 12, marginBottom: 2 },
  resultAmount: { fontSize: 13, fontWeight: '800' },

  /* ---------- User result row ---------- */
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  userAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 12,
  },
  userAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  userAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  userName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  userMeta: { fontSize: 12 },

  /* ---------- Misc ---------- */
  loadMoreIndicator: { paddingVertical: 20 },
  showHeaderButton: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    zIndex: 200,
    padding: 10,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SearchScreen;  