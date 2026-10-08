// screens/AdminPostsScreen.js
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import AdminScreenHeader from '../components/AdminScreenHeader';

const { width, height } = Dimensions.get('window');
const CARD_MARGIN = 6;
const ITEMS_PER_ROW = 2;
const CARD_WIDTH = (width - CARD_MARGIN * (ITEMS_PER_ROW + 1)) / ITEMS_PER_ROW;
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.75;
const BOTTOM_SHEET_MIN_HEIGHT = height * 0.25;

// ---------- Translations ----------
const translations = {
  English: {
    posts: 'Posts',
    searchPlaceholder: 'Search by title, location, or owner...',
    noPosts: 'No posts found.',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this?',
    stop: 'Stop',
    stopConfirm: 'Are you sure you want to stop this?',
    restore: 'Restore',
    restoreConfirm: 'Are you sure you want to restore this?',
    viewDetails: 'View Details',
    owner: 'Owner',
    location: 'Location',
    price: 'Price',
    status: 'Status',
    active: 'Active',
    stopped: 'Stopped',
    notProvided: 'N/A',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    cancel: 'Cancel',
    back: 'Back',
    viewImages: 'View Images',
    title: 'Title',
    trending: 'Trending',
    trend: 'Add to Trending',
    untrend: 'Remove from Trending',
  },
  Kinyarwanda: {
    posts: 'Inyandiko',
    searchPlaceholder: 'Shakisha izina, ahantu, cyangwa nyirarwo...',
    noPosts: 'Nta nyandiko zihari.',
    delete: 'Siba',
    deleteConfirm: 'Uri kwizera ko ushaka gusiba ibi?',
    stop: 'Hagarika',
    stopConfirm: 'Uri kwizera ko ushaka guhagarika ibi?',
    restore: 'Garura',
    restoreConfirm: 'Uri kwizera ko ushaka kugarura ibi?',
    viewDetails: 'Reba ibisobanuro',
    owner: 'Nyirarwo',
    location: 'Ahantu',
    price: 'Igiciro',
    status: 'Imyanya',
    active: 'Ikora',
    stopped: 'Yahagaritswe',
    notProvided: 'Ntaboneka',
    ok: 'Sawa',
    success: 'Byakunze',
    error: 'Ikibazo',
    cancel: 'Reka',
    back: 'Subira',
    viewImages: 'Reba amashusho',
    title: 'Umutwe',
    trending: 'Ibikunzwe',
    trend: 'Shyira mu Bikunzwe',
    untrend: 'Kuramo mu Bikunzwe',
  },
};

// ---------- Main Component ----------
const AdminPostsScreen = ({ navigation, language }) => {
  const { theme } = useTheme();
  const t = translations[language] || translations.English;

  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bottom sheet state
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Status modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusTitle, setStatusTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Image Carousel
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselFlatListRef = useRef(null);

  // Collapsible search animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -70],
    extrapolate: 'clamp',
  });
  const searchOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Animation for bottom sheet
  const translateY = useRef(new Animated.Value(BOTTOM_SHEET_MAX_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > BOTTOM_SHEET_MAX_HEIGHT * 0.3) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  // ---------- API helpers ----------
  const getToken = async () => AsyncStorage.getItem('adminToken');

  const showStatus = (title, message) => {
    setStatusTitle(title);
    setStatusMessage(message);
    setStatusModalVisible(true);
  };

  // ---------- Open Carousel (smooth) ----------
  const openCarousel = (images, index = 0) => {
    if (!images || images.length === 0) return;
    setCarouselImages(images);
    setCarouselIndex(index);
    setCarouselVisible(true);
    setTimeout(() => {
      if (carouselFlatListRef.current) {
        carouselFlatListRef.current.scrollToIndex({
          index: index,
          animated: true,
        });
      }
    }, 100);
  };

  // ---------- Sorting: featured first ----------
  const sortPosts = (postList) => {
    return [...postList].sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // ---------- Fetch posts ----------
  const fetchPosts = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin');
        return;
      }
      const res = await axios.get(`${BASE_URL}/api/admin/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const postList = res.data.posts || [];
        setPosts(postList);
        setFilteredPosts(sortPosts(postList));
      } else {
        Alert.alert(t.error, 'Failed to fetch posts.');
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
      if (error.response?.status === 401) {
        navigation.replace('AdminLogin');
      } else {
        Alert.alert(t.error, 'An error occurred while fetching posts.');
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [navigation, t]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  // ---------- Search filtering ----------
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPosts(sortPosts(posts));
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = posts.filter(
      (post) =>
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.productName && post.productName.toLowerCase().includes(q)) ||
        (post.location && post.location.toLowerCase().includes(q)) ||
        (post.ownerName && post.ownerName.toLowerCase().includes(q))
    );
    setFilteredPosts(sortPosts(filtered));
  }, [searchQuery, posts]);

  // ---------- Handlers ----------
  const handleDeletePost = (postId) => {
    if (!postId) { Alert.alert(t.error, 'No post ID provided.'); return; }
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.delete(`${BASE_URL}/api/admin/posts/${postId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'Post deleted successfully.');
            closeSheet();
            fetchPosts();
          } catch (e) {
            Alert.alert(t.error, 'Failed to delete post.');
          }
        },
      },
    ]);
  };

  const handleStopPost = (postId) => {
    if (!postId) { Alert.alert(t.error, 'No post ID provided.'); return; }
    Alert.alert(t.stop, t.stopConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.stop,
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.put(`${BASE_URL}/api/admin/posts/${postId}/stop`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'Post stopped successfully.');
            closeSheet();
            fetchPosts();
          } catch (e) {
            Alert.alert(t.error, 'Failed to stop post.');
          }
        },
      },
    ]);
  };

  const handleRestorePost = (postId) => {
    if (!postId) { Alert.alert(t.error, 'No post ID provided.'); return; }
    Alert.alert(t.restore, t.restoreConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.restore,
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.put(`${BASE_URL}/api/admin/posts/${postId}/restore`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'Post restored successfully.');
            closeSheet();
            fetchPosts();
          } catch (e) {
            Alert.alert(t.error, 'Failed to restore post.');
          }
        },
      },
    ]);
  };

  const handleToggleTrending = async (post) => {
    try {
      const token = await getToken();
      const newTrending = !post.trending;
      await axios.patch(
        `${BASE_URL}/api/admin/posts/${post._id}`,
        { trending: newTrending },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showStatus(t.success, newTrending ? 'Post added to Trending.' : 'Post removed from Trending.');
      closeSheet();
      fetchPosts();
    } catch (error) {
      console.error('Toggle trending error:', error);
      Alert.alert(t.error, 'Failed to update Trending status. Please try again.');
    }
  };

  // ---------- Bottom sheet controls ----------
  const openSheet = (post) => {
    setSelectedPost(post);
    setSheetVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeSheet = () => {
    Animated.spring(translateY, {
      toValue: BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => {
      setSheetVisible(false);
      setSelectedPost(null);
    });
  };

  // ---------- Render modals ----------
  const renderStatusModal = () => (
    <Modal transparent visible={statusModalVisible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.text }]}>{statusTitle}</Text>
          <Text style={[styles.modalText, { color: theme.textSecondary }]}>{statusMessage}</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: theme.accent }]}
            onPress={() => setStatusModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>{t.ok}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ---------- Smooth Carousel ----------
  const renderCarousel = () => (
    <Modal
      visible={carouselVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setCarouselVisible(false)}
    >
      <View style={[styles.carouselContainer, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        <TouchableOpacity
          style={styles.carouselClose}
          onPress={() => setCarouselVisible(false)}
        >
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>

        <FlatList
          ref={carouselFlatListRef}
          data={carouselImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.carouselSlide}>
              <Image source={{ uri: item }} style={styles.carouselImage} resizeMode="contain" />
            </View>
          )}
          initialScrollIndex={carouselIndex}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setCarouselIndex(index);
          }}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          snapToInterval={width}
          snapToAlignment="center"
          decelerationRate="fast"
          scrollEnabled={carouselImages.length > 1}
        />

        {carouselImages.length > 1 && (
          <View style={styles.carouselCounter}>
            <Text style={styles.carouselCounterText}>
              {carouselIndex + 1} / {carouselImages.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );

  // ---------- Bottom sheet ----------
  const renderBottomSheet = () => {
    if (!selectedPost) return null;
    const isStopped = selectedPost.status === 'stopped';
    const isTrending = selectedPost.trending || false;
    const imageUrl = (selectedPost.houseImages && selectedPost.houseImages.length > 0)
      ? selectedPost.houseImages[0]
      : null;

    return (
      <Modal
        transparent
        visible={sheetVisible}
        animationType="none"
        onRequestClose={closeSheet}
      >
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
            {/* Drag handle */}
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: theme.textSecondary }]} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              {/* Image thumbnail */}
              <TouchableOpacity
                style={styles.sheetImageContainer}
                onPress={() => {
                  if (selectedPost.houseImages && selectedPost.houseImages.length > 0) {
                    openCarousel(selectedPost.houseImages, 0);
                  }
                }}
                activeOpacity={0.9}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.sheetImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.sheetImagePlaceholder, { backgroundColor: theme.border }]}>
                    <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
                  </View>
                )}
                {selectedPost.houseImages && selectedPost.houseImages.length > 1 && (
                  <View style={styles.sheetImageCount}>
                    <Text style={styles.sheetImageCountText}>
                      +{selectedPost.houseImages.length - 1}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Title and owner */}
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {selectedPost.title || selectedPost.productName || t.title}
              </Text>
              <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                {t.owner}: {selectedPost.ownerName || t.notProvided}
              </Text>

              {/* Info rows */}
              <View style={styles.sheetInfoRow}>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.location}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]}>
                    {selectedPost.location || t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.price}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]}>
                    {selectedPost.price ? `${selectedPost.price} RWF` : t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.status}
                  </Text>
                  <View
                    style={[
                      styles.sheetStatusBadge,
                      { backgroundColor: isStopped ? theme.textSecondary : theme.accent },
                    ]}
                  >
                    <Text style={styles.sheetStatusText}>
                      {isStopped ? t.stopped : t.active}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: isTrending ? '#d87428' : '#47ae87' }]}
                  onPress={() => handleToggleTrending(selectedPost)}
                >
                  <Ionicons
                    name={isTrending ? 'flame' : 'flame-outline'}
                    size={22}
                    color="#fff"
                  />
                  <Text style={styles.sheetActionText}>
                    {isTrending ? t.untrend : t.trend}
                  </Text>
                </TouchableOpacity>

                {isStopped ? (
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => handleRestorePost(selectedPost._id)}
                  >
                    <Ionicons name="play-circle-outline" size={22} color="#fff" />
                    <Text style={styles.sheetActionText}>{t.restore}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: theme.textSecondary }]}
                    onPress={() => handleStopPost(selectedPost._id)}
                  >
                    <Ionicons name="pause-circle-outline" size={22} color="#fff" />
                    <Text style={styles.sheetActionText}>{t.stop}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: '#dc3545' }]}
                  onPress={() => handleDeletePost(selectedPost._id)}
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text style={styles.sheetActionText}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // ---------- Render item ----------
  const renderPostItem = ({ item }) => {
    const imageUrl = (item.houseImages && item.houseImages.length > 0) ? item.houseImages[0] : null;
    const isStopped = item.status === 'stopped';
    const isFeatured = item.featured || false;
    const statusColor = isStopped ? theme.textSecondary : theme.accent;
    const statusLabel = isStopped ? t.stopped : t.active;

    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: isFeatured ? '#FFD700' : theme.border,
            borderWidth: isFeatured ? 2 : 1,
            opacity: isStopped ? 0.6 : 1,
          },
        ]}
        onPress={() => openSheet(item)}
        activeOpacity={0.8}
      >
        <TouchableOpacity
          style={styles.postImageContainer}
          onPress={() => {
            if (item.houseImages && item.houseImages.length > 0) {
              openCarousel(item.houseImages, 0);
            }
          }}
          activeOpacity={0.9}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
          ) : (
            <View style={[styles.postImagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="image-outline" size={30} color={theme.textSecondary} />
            </View>
          )}
          {isFeatured && (
            <View style={[styles.featuredBadgeSmall, { backgroundColor: '#FFD700' }]}>
              <Ionicons name="star" size={12} color="#000" />
            </View>
          )}
          {item.houseImages && item.houseImages.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>+{item.houseImages.length - 1}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColor, position: 'absolute', top: 4, right: 4 }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
          {item.title || item.productName}
        </Text>
        <Text style={[styles.gridSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.location || t.notProvided}
        </Text>
        <Text style={[styles.gridSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          Owner: {item.ownerName || 'Unknown'}
        </Text>
      </TouchableOpacity>
    );
  };

  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  // ---------- Render list ----------
  const renderPostsList = () => (
    <AnimatedFlatList
      key="posts"
      data={filteredPosts}
      keyExtractor={(item) => item._id}
      renderItem={renderPostItem}
      numColumns={ITEMS_PER_ROW}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchPosts} tintColor={theme.accent} />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noPosts}</Text>
        </View>
      }
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
    />
  );

  // ---------- Render search (collapsible) ----------
  const renderSearch = () => (
    <Animated.View
      style={[
        styles.searchContainer,
        {
          backgroundColor: theme.background,
          transform: [{ translateY: searchTranslateY }],
          opacity: searchOpacity,
        },
      ]}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={theme.textSecondary}
        style={styles.searchIcon}
      />
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
    </Animated.View>
  );

  // ---------- Main render ----------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Refresh Button */}
      <AdminScreenHeader
        title={t.posts}
        theme={theme}
        onBack={() => navigation.goBack()}
        actionIcon="refresh-outline"
        actionLabel="Refresh posts"
        onAction={fetchPosts}
      />

      {/* Search (collapsible) */}
      {renderSearch()}

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />
        </View>
      ) : (
        renderPostsList()
      )}

      {/* Modals */}
      {renderStatusModal()}
      {renderBottomSheet()}
      {renderCarousel()}
    </SafeAreaView>
  );
};

// ---------- Styles ----------
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

  // Search – now Animated.View
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 1,
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
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    position: 'relative',
  },
  gridTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  gridSubtitle: { fontSize: 11, textAlign: 'center', opacity: 0.7, marginBottom: 2 },

  postImageContainer: {
    width: '100%',
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    position: 'relative',
  },
  postImage: { width: '100%', height: '100%' },
  postImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  featuredBadgeSmall: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  imageCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, textAlign: 'center' },

  // Bottom Sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    minHeight: BOTTOM_SHEET_MIN_HEIGHT,
    paddingBottom: 20,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  sheetImage: { width: '100%', height: '100%' },
  sheetImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetImageCount: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sheetImageCountText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#FFD700',
  },
  featuredBadgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sheetSub: { fontSize: 14, marginBottom: 12 },
  sheetInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  sheetInfoItem: {
    alignItems: 'center',
  },
  sheetInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sheetInfoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  sheetStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  sheetActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    borderWidth: 0.5,
  },
  modalTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Carousel – smooth sliding
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselSlide: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: width * 0.95,
    height: height * 0.85,
  },
  carouselClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  carouselCounter: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  carouselCounterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminPostsScreen;