import { getAuthToken } from '../utils/authStorage';

﻿// screens/SearchScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Keyboard,
  ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
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
import { getImageUri, normalizeImageSource } from '../utils/imageUrl';
import { getPostCoverUri, getPostImages } from '../utils/postMedia';
import OnlineStatusDot from '../components/OnlineStatusDot';
import useOnlineUsers from '../hooks/useOnlineUsers';
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
  houseImages: getPostImages(post),
  videoUrl: post.videoUrl || post.videoHlsUrl || post.video?.url || '',
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
const SEARCH_FEED_CACHE_KEY = '@search_feed_cache';
const PAGE_SIZE = 20;
const SECTION_WIDTH = width;
const AUTO_SLIDE_INTERVAL = 10000;

// ---------- Hero-deck section (3 cards sliding) ----------
// NOTE: `paused` is forwarded to ProductHeroDeck so its internal
// auto-advance / image-change timer stops while the tutorial is showing.
const HeroDeckSection = ({
  posts,
  theme,
  isDarkMode,
  onPressPost,
  onPressUser,
  paused = false,
}) => {
  const colors = {
    background: theme.background,
    cardBackground: theme.cardBackground || (isDarkMode ? '#1C1C1E' : '#FFFFFF'),
    border: theme.border || (isDarkMode ? '#2C2C2E' : '#D7DDD8'),
    text: theme.text,
    textSecondary: theme.textSecondary,
    login: theme.background || '#47ae87',
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
        paused={paused} // ← pauses internal image-change / auto-advance
      />
    </View>
  );
};

const SearchScreen = ({ navigation, route, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const isFocused = useIsFocused();

  const bgColor = theme.background || (isDarkMode ? '#111111' : '#FFFFFF');
  const txtColor = theme.text || (isDarkMode ? '#FFFFFF' : '#111111');
  const subTextColor = theme.textSecondary || (isDarkMode ? '#9CA3AF' : '#6B7280');
  const inputBgColor = isDarkMode ? '#1C1C1E' : '#F2F2F2';
  const softBorder = theme.border || (isDarkMode ? '#2C2C2E' : '#D7DDD8');

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularSearches, setPopularSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLoopCount, setSearchLoopCount] = useState(0);
  const [correctedQuery, setCorrectedQuery] = useState('');

  const [allPosts, setAllPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [matchedUsers, setMatchedUsers] = useState([]);
  const onlineUsers = useOnlineUsers(matchedUsers.map(user => user.userId));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(!!authUser);
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const searchLoadingMoreRef = useRef(false);
  const searchLoopingRef = useRef(false);
  const searchRequestRef = useRef(0);
  const activeSearchRef = useRef({ query: '', loading: false, results: [], correctedQuery: '', error: false, track: false });

  const didInitialLoadRef = useRef(false);
  const leftScreenRef = useRef(false);
  const firstAuthRunRef = useRef(true);

  const heroScrollRef = useRef(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  // ---- 3-per-row trending grid (infinite loop) ----
  const [gridPosts, setGridPosts] = useState([]);
  const gridOffsetRef = useRef(0);
  const gridSourceRef = useRef([]);

  const sectionGroups = useMemo(() => chunk(trendingPosts, 3), [trendingPosts]);
  const displayedSearchResults = useMemo(
    () => searchLoopCount > 0
      ? [...searchResults, ...Array.from({ length: searchLoopCount }, () => searchResults).flat()]
      : searchResults,
    [searchLoopCount, searchResults]
  );
  const recentSearchStorageKey = useMemo(
    () => `${RECENT_SEARCHES_KEY}:${currentUser?._id || currentUser?.id || authUser?._id || authUser?.id || 'guest'}`,
    [currentUser?._id, currentUser?.id, authUser?._id, authUser?.id]
  );

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
      recentSearches: 'Recent search',
      popularSearches: 'Popular searches',
      clearAll: 'Clear all',
      didYouMean: 'Did you mean',
      searchFailed: 'Search is temporarily unavailable.',
      retry: 'Try again',
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
      recentSearches: 'Ibyashakishijwe vuba',
      popularSearches: 'Ibyakunzwe gushakishwa',
      clearAll: 'Siba byose',
      didYouMean: 'Waba washakaga kuvuga',
      searchFailed: 'Gushakisha ntibishobotse ubu.',
      retry: 'Ongera ugerageze',
    },
  };

  const t = translations[language] || translations.English;
  const searchFailedText = t.searchFailed;

  // ---------- Recent Searches Logic ----------
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(recentSearchStorageKey)
      .then((existing) => {
        if (!active) return;
        const parsed = existing ? JSON.parse(existing) : [];
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      })
      .catch((error) => console.error('Recent search load failed:', error));
    return () => { active = false; };
  }, [recentSearchStorageKey]);

  const addRecentSearch = useCallback(async (query) => {
    try {
      const list = [query, ...recentSearches.filter(
        (item) => item.toLowerCase() !== query.toLowerCase()
      )].slice(0, 8);
      setRecentSearches(list);
      await AsyncStorage.setItem(recentSearchStorageKey, JSON.stringify(list));
    } catch (error) {
      console.error('Recent search save failed:', error);
    }
  }, [recentSearches, recentSearchStorageKey]);

  // ---------- Stable helpers ----------
  const getToken = useCallback(async () => await getAuthToken('userToken'), []);

  const trackSearchEvent = useCallback((query, event, postId) => {
    axios.post(`${BASE_URL}/api/posts/search/analytics`, { query, event, postId })
      .catch((error) => console.error('Search analytics request failed:', error.message));
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        if (authUser) {
          setCurrentUser(authUser);
          setIsLoggedIn(true);
        } else {
          setCurrentUser(null);
          setIsLoggedIn(false);
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
      } else {
        setCurrentUser(null);
        setIsLoggedIn(false);
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
  }, [authUser, loadCurrentUser]);

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

        if (refresh) {
          AsyncStorage.setItem(
            SEARCH_FEED_CACHE_KEY,
            JSON.stringify({ posts: newPosts, hasMore: feed.hasMore })
          ).catch((error) => {
            console.error('Search feed cache write failed:', error);
          });
        }

        let filteredPosts = newPosts;
        if (isLoggedIn && currentUser) {
          filteredPosts = newPosts.filter((post) => post.userId !== currentUser._id);
        }

        const sorted = sortFeedPosts(filteredPosts, refresh);
        const combinedPosts = refresh
          ? sorted
          : sortFeedPosts([...allPosts, ...sorted], false);

        if (refresh) {
          setPage(1);
        } else {
          setPage(pageNum);
        }

        setAllPosts(combinedPosts);
        const trending = combinedPosts.filter((post) => post.trending);
        setTrendingPosts(trending.length > 0 ? trending : combinedPosts);

        setHasMore(feed.hasMore);
        return { posts: sorted, hasMore: feed.hasMore };
      } catch (error) {
        console.error('Error loading posts:', error);
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLoggedIn, currentUser, fetchFeed, allPosts]
  );

  const restoreCachedFeed = useCallback(async () => {
    try {
      const cachedValue = await AsyncStorage.getItem(SEARCH_FEED_CACHE_KEY);
      if (!cachedValue) return;

      const cachedFeed = JSON.parse(cachedValue);
      if (!Array.isArray(cachedFeed.posts)) return;

      const cachedPosts = cachedFeed.posts.map(mapPost);
      const visiblePosts =
        isLoggedIn && currentUser
          ? cachedPosts.filter((post) => post.userId !== currentUser._id)
          : cachedPosts;
      const sorted = sortFeedPosts(visiblePosts);
      const trending = sorted.filter((post) => post.trending);

      setAllPosts(sorted);
      setTrendingPosts(trending.length > 0 ? trending : sorted);
      setHasMore(cachedFeed.hasMore !== false);
      setLoading(false);
    } catch (error) {
      console.error('Search feed cache read failed:', error);
    }
  }, [isLoggedIn, currentUser]);

  const fetchPostsRef = useRef(fetchPosts);
  const checkLoginStatusRef = useRef(checkLoginStatus);

  useEffect(() => { fetchPostsRef.current = fetchPosts; }, [fetchPosts]);
  useEffect(() => { checkLoginStatusRef.current = checkLoginStatus; }, [checkLoginStatus]);

  // ---------- Auto-slide every 10s (outer section pager) ----------
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(1, true);
  }, [fetchPosts]);

  // ---------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------
  const runSearch = useCallback(async (rawQuery, pageNum = 1, track = false) => {
    const query = String(rawQuery || '').trim();
    if (!query) {
      setSearchResults([]);
      setSuggestions([]);
      setSearchHasMore(false);
      setSearchLoading(false);
      return;
    }

    const activeSearch = activeSearchRef.current;
    if (pageNum === 1 && activeSearch.query === query && activeSearch.loading) {
      activeSearch.track = activeSearch.track || track;
      return;
    }
    if (pageNum === 1 && activeSearch.query === query && !activeSearch.error) {
      if (track) {
        trackSearchEvent(query, 'search');
        if (activeSearch.results.length === 0) trackSearchEvent(query, 'no_results');
        if (activeSearch.correctedQuery) trackSearchEvent(query, 'typo');
      }
      return;
    }

    const requestId = ++searchRequestRef.current;
    activeSearchRef.current = {
      query,
      loading: true,
      results: [],
      correctedQuery: '',
      error: false,
      track,
    };
    setSearchLoading(true);
    setSearchError('');
    if (pageNum === 1) {
      setSearchResults([]);
      setSearchPage(1);
      setSearchLoopCount(0);
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/posts/search`, {
        params: { q: query, page: pageNum, limit: PAGE_SIZE },
        timeout: 15000,
      });
      if (requestId !== searchRequestRef.current) return;
      const data = response.data || {};
      const posts = (data.posts || []).map(mapPost);
      const usersById = new Map();
      posts.forEach((post) => {
        const username = post.username || '';
        const userId = String(post.userId || '');
        if (username.toLowerCase().includes(query.toLowerCase()) && userId) {
          const user = usersById.get(userId) || {
            username,
            userId,
            avatar: post.userAvatar,
            productCount: 0,
          };
          user.productCount += 1;
          usersById.set(userId, user);
        }
      });
      setMatchedUsers((previous) => pageNum === 1
        ? [...usersById.values()]
        : [...new Map([...previous, ...usersById.values()].map((user) => [String(user.userId), user])).values()]);
      setSearchResults((previous) => {
        if (pageNum === 1) return posts;
        const existingIds = new Set(previous.map((post) => String(post._id)));
        return [...previous, ...posts.filter((post) => !existingIds.has(String(post._id)))];
      });
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setCorrectedQuery(data.correctedQuery || '');
      setSearchHasMore(data.hasMore === true);
      setSearchPage(pageNum);
      setSubmittedQuery(query);
      activeSearchRef.current.results = posts;
      activeSearchRef.current.correctedQuery = data.correctedQuery || '';
      activeSearchRef.current.loading = false;
      const shouldTrack = activeSearchRef.current.track;
      activeSearchRef.current.track = false;
      if (shouldTrack) {
        trackSearchEvent(query, 'search');
        if (posts.length === 0 && pageNum === 1) trackSearchEvent(query, 'no_results');
        if (data.correctedQuery) trackSearchEvent(query, 'typo');
      }
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      console.error('Product search failed:', error.message);
      setSearchError(searchFailedText);
      setSearchResults([]);
      setSearchHasMore(false);
      activeSearchRef.current.error = true;
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearchLoading(false);
        activeSearchRef.current.loading = false;
      }
      if (pageNum > 1) searchLoadingMoreRef.current = false;
    }
  }, [searchFailedText, trackSearchEvent]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSubmittedQuery('');
      setSearchResults([]);
      setMatchedUsers([]);
      setSuggestions([]);
      setCorrectedQuery('');
      setSearchError('');
      setSearchLoading(false);
      setSearchHasMore(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      runSearch(q);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  useEffect(() => {
    let active = true;
    axios.get(`${BASE_URL}/api/posts/search/popular`, { timeout: 10000 })
      .then((response) => {
        if (active && Array.isArray(response.data?.searches)) setPopularSearches(response.data.searches);
      })
      .catch((error) => console.error('Popular search load failed:', error.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const initialQuery = route?.params?.searchQuery || '';
    if (initialQuery && initialQuery !== searchQuery) {
      setSearchQuery(initialQuery);
      setSuggestionsOpen(false);
      trackSearchEvent(initialQuery, 'search');
    }
  }, [route?.params?.searchQuery, searchQuery, trackSearchEvent]);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      const initializeFeed = async () => {
        await restoreCachedFeed();
        checkLoginStatusRef.current?.();
        fetchPostsRef.current?.(1, true);
      };
      initializeFeed();
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
  }, [navigation, restoreCachedFeed]);

  useEffect(() => {
    if (firstAuthRunRef.current) {
      firstAuthRunRef.current = false;
      return;
    }
    fetchPostsRef.current?.(1, true);
  }, [authUser?._id]);

  // ---------------------------------------------------------------
  // Trending grid → seed on feed load
  // ---------------------------------------------------------------
  useEffect(() => {
    const source = trendingPosts.length ? trendingPosts : allPosts;
    if (source.length === 0) {
      setGridPosts([]);
      gridOffsetRef.current = 0;
      gridSourceRef.current = [];
      return;
    }
    const previousSource = gridSourceRef.current;
    const sourceWasExtended = previousSource.length > 0 &&
      source.length >= previousSource.length &&
      previousSource.every((post, index) =>
        String(post._id) === String(source[index]._id)
      );
    if (sourceWasExtended) {
      gridOffsetRef.current = previousSource.length % source.length;
      gridSourceRef.current = source;
      return;
    }

    const seed = source.slice(0, Math.min(PAGE_SIZE, source.length));
    setGridPosts(seed);
    gridOffsetRef.current = seed.length % source.length;
    gridSourceRef.current = source;
  }, [trendingPosts, allPosts]);

  const loadMoreGridPosts = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const source = trendingPosts.length ? trendingPosts : allPosts;
    if (source.length === 0) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      if (hasMore) {
        let nextPage = page + 1;
        let result;
        do {
          result = await fetchPosts(nextPage);
          if (!result) return;
          if (result.posts.length > 0) {
            setGridPosts((previous) => [...previous, ...result.posts]);
            return;
          }
          nextPage += 1;
        } while (result.hasMore);
      }

      setGridPosts((previous) => {
        const next = [];
        const start = gridOffsetRef.current;
        for (let i = 0; i < PAGE_SIZE; i++) {
          const idx = (start + i) % source.length;
          next.push(source[idx]);
        }
        gridOffsetRef.current = (start + PAGE_SIZE) % source.length;
        return [...previous, ...next];
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [trendingPosts, allPosts, hasMore, page, fetchPosts]);

  const handleClear = () => {
    searchRequestRef.current += 1;
    activeSearchRef.current = { query: '', loading: false, results: [], correctedQuery: '', error: false, track: false };
    setSearchQuery('');
    setSubmittedQuery('');
    setSearchResults([]);
    setMatchedUsers([]);
    setSuggestions([]);
    setSearchError('');
    setCorrectedQuery('');
    setSearchLoading(false);
    setSuggestionsOpen(true);
    setSelectedSuggestionIndex(-1);
    setSearchHasMore(false);
  };

  const handleSearchSubmit = () => {
    if (suggestionsOpen && selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
      handleSuggestionPress(suggestions[selectedSuggestionIndex]);
      return;
    }
    const q = searchQuery.trim();
    if (!q) {
      handleClear();
      return;
    }
    setSuggestionsOpen(false);
    setSelectedSuggestionIndex(-1);
    runSearch(q, 1, true);
    addRecentSearch(q);
    Keyboard.dismiss();
  };

  const handleRecentPress = (query) => {
    setSearchQuery(query);
    setSuggestionsOpen(false);
    runSearch(query, 1, true);
    addRecentSearch(query);
    Keyboard.dismiss();
  };

  const handleSuggestionPress = (suggestion) => {
    const query = typeof suggestion === 'string' ? suggestion : suggestion.label;
    if (!query) return;
    setSearchQuery(query);
    setSuggestionsOpen(false);
    setSelectedSuggestionIndex(-1);
    runSearch(query, 1, true);
    trackSearchEvent(query, 'suggestion');
    addRecentSearch(query);
    Keyboard.dismiss();
  };

  const handleRemoveRecentSearch = async (query) => {
    const updated = recentSearches.filter((item) => item !== query);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem(recentSearchStorageKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Recent search removal failed:', error);
    }
  };

  const handleClearRecentSearches = async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(recentSearchStorageKey);
    } catch (error) {
      console.error('Recent search clear failed:', error);
    }
  };

  const handleQueryChange = (value) => {
    searchRequestRef.current += 1;
    activeSearchRef.current = { query: '', loading: false, results: [], correctedQuery: '', error: false, track: false };
    setSearchQuery(value);
    setSuggestionsOpen(true);
    setSelectedSuggestionIndex(-1);
    setSuggestions([]);
    setSearchResults([]);
    setMatchedUsers([]);
    setCorrectedQuery('');
    setSearchError('');
    setSearchLoading(Boolean(value.trim()));
  };

  const handleSuggestionKeyPress = (event) => {
    if (!suggestionsOpen || suggestions.length === 0) return;
    const key = event.nativeEvent.key;
    if (key === 'ArrowDown') {
      setSelectedSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (key === 'ArrowUp') {
      setSelectedSuggestionIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    }
  };

  const loadMoreSearchResults = () => {
    if (searchLoading || searchLoadingMoreRef.current) return;
    if (!searchHasMore) {
      if (searchResults.length === 0 || searchLoopingRef.current) return;
      searchLoopingRef.current = true;
      setSearchLoopCount((count) => count + 1);
      requestAnimationFrame(() => {
        searchLoopingRef.current = false;
      });
      return;
    }
    searchLoadingMoreRef.current = true;
    runSearch(searchQuery, searchPage + 1).finally(() => {
      searchLoadingMoreRef.current = false;
    });
  };

  const handlePostPress = (item) => {
    if (submittedQuery) trackSearchEvent(submittedQuery, 'product_view', item._id);
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
      style={[styles.resultItem, { backgroundColor: 'transparent', borderWidth: 0 }]}
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
          source={normalizeImageSource(getPostCoverUri(item)
            ? { uri: getPostCoverUri(item) }
            : require('../assets/house.png'))}
          style={styles.resultImage}
        />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: txtColor }]} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={[styles.resultSub, { color: subTextColor }]} numberOfLines={1}>
          {[
            item.storeName || (item.username ? `@${item.username}` : ''),
            item.category,
            item.location,
          ].filter(Boolean).join(' · ')}
        </Text>
        {!!item.amount && (
          <Text style={[styles.resultAmount, { color: theme.login || '#47ae87' }]} numberOfLines={1}>
            {item.amount}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={subTextColor} />
    </TouchableOpacity>
  );

  const renderUserResultItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userResultItem, { backgroundColor: 'transparent', borderWidth: 0 }]}
      onPress={() => navigation.navigate('Profile', { userId: item.userId, username: item.username })}
      activeOpacity={0.8}
    >
      <View style={styles.userAvatarWrap}>
        {getImageUri(item.avatar) ? (
          <Image source={normalizeImageSource({ uri: getImageUri(item.avatar) })} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatarFallback, { backgroundColor: theme.login || '#47ae87' }]}>
            <Text style={styles.userAvatarInitial}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <OnlineStatusDot visible={Boolean(onlineUsers[String(item.userId)])} />
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

  const renderGridItem = ({ item }) => {
    const amountText = item.amount || (item.price != null ? `RWF ${item.price.toLocaleString()}` : '');
    return (
      <TouchableOpacity style={styles.gridItem} activeOpacity={0.85} onPress={() => handlePostPress(item)}>
        <View style={styles.gridImageWrap}>
          <Image
            source={normalizeImageSource(getPostCoverUri(item)
              ? { uri: getPostCoverUri(item) }
              : require('../assets/house.png'))}
            style={styles.gridImage}
          />
          <View style={styles.gridImageShade} />
          {!!item.productName && (
            <Text style={styles.gridOverlayTitle} numberOfLines={2}>
              {item.productName}
            </Text>
          )}
          {item.videoUrl && (
            <View style={styles.gridVideoBadge}>
              <Ionicons name="videocam" size={12} color="#fff" />
            </View>
          )}
          {!!amountText && (
            <Text style={styles.gridOverlayAmount} numberOfLines={1}>
              {amountText}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchInput = () => {
    return (
      <View style={styles.searchInputWrapper}>
        <View style={[styles.searchContainer, { backgroundColor: inputBgColor }]}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: txtColor }]}
            placeholder={t.placeholder}
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearchSubmit}
            onKeyPress={handleSuggestionKeyPress}
            returnKeyType="search"
            autoFocus={false}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
        {suggestionsOpen && searchQuery.trim() !== '' && suggestions.length > 0 && (
          <View style={[styles.suggestionList, { backgroundColor: theme.cardBackground || inputBgColor, borderColor: softBorder }]}>
            {suggestions.map((suggestion, index) => {
              const label = typeof suggestion === 'string' ? suggestion : suggestion.label;
              const matchStart = label.toLowerCase().indexOf(searchQuery.trim().toLowerCase());
              return (
                <TouchableOpacity
                  key={`${suggestion.type || 'product'}-${label}-${index}`}
                  style={[
                    styles.suggestionItem,
                    index === selectedSuggestionIndex && { backgroundColor: `${theme.login || '#47ae87'}22` },
                  ]}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="search-outline" size={17} color={subTextColor} />
                  <Text style={[styles.suggestionText, { color: txtColor }]} numberOfLines={1}>
                    {matchStart >= 0 ? (
                      <>
                        {label.slice(0, matchStart)}
                        <Text style={{ color: theme.login || '#47ae87', fontWeight: '700' }}>
                          {label.slice(matchStart, matchStart + searchQuery.trim().length)}
                        </Text>
                        {label.slice(matchStart + searchQuery.trim().length)}
                      </>
                    ) : label}
                  </Text>
                  <Text style={[styles.suggestionType, { color: subTextColor }]}>
                    {suggestion.type && suggestion.type !== 'product' ? suggestion.type : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderRecentSearches = () => {
    if (searchQuery.trim() !== '' || recentSearches.length === 0) return null;

    return (
      <View style={styles.recentContainer}>
        <View style={styles.recentHeader}>
          <Text style={[styles.recentTitle, { color: subTextColor }]}>{t.recentSearches}</Text>
          <TouchableOpacity onPress={handleClearRecentSearches}>
            <Text style={[styles.recentAction, { color: theme.login || '#47ae87' }]}>{t.clearAll}</Text>
          </TouchableOpacity>
        </View>
        {recentSearches.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={styles.recentItem}
          >
            <TouchableOpacity style={styles.recentSearchPress} onPress={() => handleRecentPress(item)}>
              <Ionicons name="time-outline" size={17} color={subTextColor} />
              <Text style={[styles.recentText, { color: txtColor }]} numberOfLines={1}>{item}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveRecentSearch(item)} hitSlop={8}>
              <Ionicons name="close" size={18} color={subTextColor} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderPopularSearches = () => {
    if (searchQuery.trim() !== '' || popularSearches.length === 0) return null;
    return (
      <View style={styles.recentContainer}>
        <View style={styles.popularChips}>
          {popularSearches.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.popularChip, { borderColor: softBorder, backgroundColor: inputBgColor }]}
              onPress={() => handleRecentPress(item)}
            >
              <Ionicons name="trending-up-outline" size={15} color={theme.login || '#47ae87'} />
              <Text style={[styles.popularChipText, { color: txtColor }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderBrowseView = () => {
    if (sectionGroups.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1, backgroundColor: bgColor }}
            contentContainerStyle={styles.emptyBrowseContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={txtColor} />}
          >
            {renderSearchInput()}
            {renderRecentSearches()}
            {renderPopularSearches()}
            <View style={styles.center}>
              <Ionicons name="flame-outline" size={48} color={subTextColor} />
              <Text style={{ color: subTextColor, fontSize: 15, marginTop: 12 }}>{t.noPosts}</Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    const handleSectionScroll = (event) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      setActiveSectionIndex(Math.round(offsetX / SECTION_WIDTH));
    };

    const ListHeader = (
      <View>
        {renderSearchInput()}
        {renderRecentSearches()}
        {renderPopularSearches()}

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
                      backgroundColor: i === activeSectionIndex ? theme.text || '#47ae87' : subTextColor + '55',
                      width: i === activeSectionIndex ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: txtColor, marginHorizontal: 16, marginTop: 18, marginBottom: 10 }]}>
          {t.trending}
        </Text>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          key="browse-grid"
          data={gridPosts}
          keyExtractor={(item, index) => `grid-${item._id}-${index}`}
          renderItem={renderGridItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.gridContent, { backgroundColor: bgColor }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreGridPosts}
          onEndReachedThreshold={0.6}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={txtColor} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadMoreIndicator} color={txtColor} /> : null}
        />
      </View>
    );
  };

  const renderSearchResults = () => {
    const ListHeader = (
      <View>
        {renderSearchInput()}
        {matchedUsers.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: txtColor, marginHorizontal: 16, marginTop: 6, marginBottom: 6 }]}>
              {t.users}
            </Text>
            {matchedUsers.slice(0, 5).map((user) => (
              <View key={`user-${user.userId}`}>
                {renderUserResultItem({ item: user })}
              </View>
            ))}
          </>
        )}
        {correctedQuery && (
          <TouchableOpacity
            style={styles.correctionRow}
            onPress={() => handleSuggestionPress(correctedQuery)}
          >
            <Text style={[styles.resultSub, { color: subTextColor }]}>{t.didYouMean} </Text>
            <Text style={[styles.correctionText, { color: theme.login || '#47ae87' }]}>
              {correctedQuery}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.sectionTitle, { color: txtColor, marginHorizontal: 16, marginTop: 12, marginBottom: 6 }]}>
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
        data={displayedSearchResults}
        keyExtractor={(item, index) => `search-${item._id}-${index}`}
        renderItem={renderSearchResultItem}
        contentContainerStyle={[styles.listContent, { backgroundColor: bgColor }]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.center}>
            {searchLoading ? (
              <ActivityIndicator size="large" color={theme.login || '#47ae87'} />
            ) : searchError ? (
              <>
                <Ionicons name="cloud-offline-outline" size={42} color={subTextColor} />
                <Text style={[styles.emptyMessage, { color: subTextColor }]}>{searchError}</Text>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: theme.login || '#47ae87' }]}
                  onPress={() => runSearch(searchQuery)}
                >
                  <Text style={styles.retryButtonText}>{t.retry}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="search-outline" size={48} color={subTextColor} />
                <Text style={[styles.emptyMessage, { color: subTextColor }]}>{t.noResults}</Text>
              </>
            )}
          </View>
        }
        onEndReached={loadMoreSearchResults}
        onEndReachedThreshold={0.5}
        ListFooterComponent={searchLoading && searchResults.length > 0
          ? <ActivityIndicator style={styles.loadMoreIndicator} color={theme.login || '#47ae87'} />
          : null}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        removeClippedSubviews
      />
    );
  };

  const renderContent = () => {
    if (!searchQuery.trim() && loading && allPosts.length === 0) {
      return (
        <View style={[styles.center, { backgroundColor: bgColor }]}>
          <ShaakaLoadingScreen message={t.loading} backgroundColor={bgColor} textColor={txtColor} compact />
        </View>
      );
    }

    const isSearching = searchQuery.trim() !== '';
    if (isSearching) return renderSearchResults();
    return renderBrowseView();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['left', 'right']}>
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  /* ---------- Search Input ---------- */
  searchInputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    width: '100%',
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearBtn: { marginLeft: 8, padding: 4 },
  suggestionList: {
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  suggestionText: { flex: 1, fontSize: 14 },
  suggestionType: { fontSize: 11, textTransform: 'capitalize' },

  /* ---------- Recent Searches ---------- */
  recentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: 10,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recentTitle: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '400',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recentSearchPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentText: {
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
  },
  recentAction: { fontSize: 12, fontWeight: '600' },
  popularChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  popularChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    MarginTop:5,
    paddingHorizontal: 10,
    gap: 5,
  },
  popularChipText: { fontSize: 12 },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  correctionText: { fontSize: 14, fontWeight: '700' },
  emptyMessage: { fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 16 },
  retryButton: { marginTop: 14, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ---------- Section header ---------- */
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  /* ---------- Hero deck section ---------- */
  heroSection: {
    paddingTop: 12,
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

  /* ---------- 2-per-row product grid ---------- */
  gridContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  emptyBrowseContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  gridItem: {
    width: (width - 40) / 2,
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
  gridImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  gridOverlayTitle: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 34,
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridVideoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  gridOverlayAmount: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    maxWidth: '75%',
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ---------- Search result rows ---------- */
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
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
});

export default SearchScreen;