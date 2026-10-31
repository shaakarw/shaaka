
// screens/AdminReportsScreen.js
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
import { showAdminFeedback } from '../utils/adminFeedback';
import { normalizeImageSource } from '../utils/imageUrl';


const { width, height } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.75;
const BOTTOM_SHEET_MIN_HEIGHT = height * 0.25;

// ---------- Translations ----------
const translations = {
  English: {
    reports: 'Reports',
    searchPlaceholder: 'Search by reason or reporter...',
    noReports: 'No reports found.',
    ignore: 'Ignore',
    ignoreConfirm: 'Are you sure you want to ignore this report?',
    viewDetails: 'View Details',
    reportedBy: 'Reported by',
    reason: 'Reason',
    reportDate: 'Date',
    post: 'Post',
    ignored: 'Ignored',
    notProvided: 'N/A',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    cancel: 'Cancel',
    back: 'Back',
    viewImages: 'View Images',
    viewReportedPost: 'View Reported Post',
    postedBy: 'Posted by',
    contact: 'Contact',
    location: 'Location',
    price: 'Price',
    description: 'Description',
  },
  Kinyarwanda: {
    reports: 'Imenyesha',
    searchPlaceholder: 'Shakisha impamvu cyangwa uwamenyesheje...',
    noReports: 'Nta menyesha zihari.',
    ignore: 'Reka',
    ignoreConfirm: 'Uri kwizera ko ushaka kureka iki kibazo?',
    viewDetails: 'Reba ibisobanuro',
    reportedBy: 'Byamenyeshejwe na',
    reason: 'Impamvu',
    reportDate: 'Itariki',
    post: 'Inyandiko',
    ignored: 'Yarekwetse',
    notProvided: 'Ntaboneka',
    ok: 'Sawa',
    success: 'Byakunze',
    error: 'Ikibazo',
    cancel: 'Reka',
    back: 'Subira',
    viewImages: 'Reba amashusho',
    viewReportedPost: 'Reba Inyandiko Yamenyeshejwe',
    postedBy: 'Yashyizweho na',
    contact: 'Telefone',
    location: 'Aho',
    price: 'Igiciro',
    description: 'Ibisobanuro',
  },
};

// ---------- Image Slider (reused from BuyPostScreen) ----------
const ImageSlider = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const onScroll = useCallback((event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideSize);
    setCurrentIndex(index);
  }, []);

  if (!images || images.length === 0) return null;

  return (
    <View style={styles.sliderContainer}>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }) => (
          <Image source={normalizeImageSource({ uri: item })} style={styles.sliderImage} resizeMode="cover" />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === currentIndex && styles.activeDot]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ---------- Main Component ----------
const AdminReportsScreen = ({ navigation, language }) => {
  const { theme } = useTheme();
  const t = translations[language] || translations.English;

  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bottom sheet state
  const [selectedReport, setSelectedReport] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Image Carousel (existing, still usable)
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // ---------- NEW: View Reported Post Modal ----------
  const [viewPostModalVisible, setViewPostModalVisible] = useState(false);
  const [selectedReportForPost, setSelectedReportForPost] = useState(null);

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
    showAdminFeedback(title, message, title === t.error ? 'error' : 'success', { buttonText: t.ok });
  };

  const openCarousel = (images, index = 0) => {
    if (!images || images.length === 0) return;
    setCarouselImages(images);
    setCarouselIndex(index);
    setCarouselVisible(true);
  };

  // ---------- Fetch reports ----------
  const fetchReports = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin');
        return;
      }
      const res = await axios.get(`${BASE_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const reportList = res.data.reports || [];
        setReports(reportList);
        setFilteredReports(reportList);
      } else {
        showAdminFeedback(t.error, 'Failed to fetch reports.', 'error');
      }
    } catch (error) {
      console.error('Fetch reports error:', error);
      if (error.response?.status === 401) {
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(t.error, 'An error occurred while fetching reports.', 'error');
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  // ---------- Search filtering ----------
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredReports(reports);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = reports.filter(
      (report) =>
        (report.reason && report.reason.toLowerCase().includes(q)) ||
        (report.reporterName && report.reporterName.toLowerCase().includes(q)) ||
        (report.postTitle && report.postTitle.toLowerCase().includes(q))
    );
    setFilteredReports(filtered);
  }, [searchQuery, reports]);

  // ---------- Handlers ----------
  const handleIgnoreReport = (reportId) => {
    Alert.alert(t.ignore, t.ignoreConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.ignore,
        onPress: async () => {
          try {
            const token = await getToken();
            await axios.put(`${BASE_URL}/api/admin/reports/${reportId}/ignore`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'Report ignored.');
            closeSheet();
            fetchReports();
          } catch (e) {
            showAdminFeedback(t.error, 'Failed to ignore report.', 'error');
          }
        },
      },
    ]);
  };

  // ---------- Bottom sheet controls ----------
  const openSheet = (report) => {
    setSelectedReport(report);
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
      setSelectedReport(null);
    });
  };

  // ---------- NEW: Open View Post Modal ----------
  const openViewPostModal = () => {
    setSelectedReportForPost(selectedReport);
    setViewPostModalVisible(true);
  };

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
          data={carouselImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.carouselSlide}>
              <Image source={normalizeImageSource({ uri: item })} style={styles.carouselImage} resizeMode="contain" />
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

  // ---------- NEW: View Reported Post Modal ----------
  const renderViewPostModal = () => {
    if (!selectedReportForPost) return null;
    const post = selectedReportForPost.post || {};
    const images = post.houseImages || [];
    const username = post.username || t.notProvided;
    const amount = post.amount || (post.price ? `${post.price.toLocaleString()} RWF` : t.notProvided);
    const location = post.location || t.notProvided;
    const description = post.description || t.notProvided;
    const contact1 = post.contactNumbers?.[0] || '';
    const contact2 = post.contactNumbers?.[1] || '';

    return (
      <Modal
        visible={viewPostModalVisible}
        animationType="slide"
        onRequestClose={() => setViewPostModalVisible(false)}
      >
        <SafeAreaView style={[styles.viewPostContainer, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
          {/* Header */}
          <View style={[styles.viewPostHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setViewPostModalVisible(false)}>
              <Ionicons name="arrow-back" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.viewPostHeaderTitle, { color: theme.text }]}>{t.viewReportedPost}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.viewPostContent}>
            {/* Image Slider */}
            {images.length > 0 ? (
              <ImageSlider images={images} />
            ) : (
              <View style={[styles.viewPostNoImage, { backgroundColor: theme.border }]}>
                <Ionicons name="image-outline" size={60} color={theme.textSecondary} />
              </View>
            )}

            {/* Post details */}
            <View style={styles.viewPostDetails}>
              <Text style={[styles.viewPostPrice, { color: theme.accent }]}>{amount}</Text>
              <View style={styles.viewPostInfoRow}>
                <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.viewPostInfoText, { color: theme.textSecondary }]}>{t.postedBy}: {username}</Text>
              </View>
              <View style={styles.viewPostInfoRow}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.viewPostInfoText, { color: theme.textSecondary }]}>{t.location}: {location}</Text>
              </View>
              <Text style={[styles.viewPostDescription, { color: theme.text }]}>{t.description}:</Text>
              <Text style={[styles.viewPostDescriptionText, { color: theme.text }]}>{description}</Text>

              {(contact1 || contact2) ? (
                <View style={styles.viewPostContacts}>
                  <Text style={[styles.viewPostContactLabel, { color: theme.text }]}>{t.contact}:</Text>
                  {contact1 ? <Text style={[styles.viewPostContact, { color: theme.text }]}>{contact1}</Text> : null}
                  {contact2 ? <Text style={[styles.viewPostContact, { color: theme.text }]}>{contact2}</Text> : null}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ---------- Bottom sheet ----------
  const renderBottomSheet = () => {
    if (!selectedReport) return null;
    const isIgnored = selectedReport.ignored || false;
    const imageUrl =
      selectedReport.post?.houseImages && selectedReport.post.houseImages.length > 0
        ? selectedReport.post.houseImages[0]
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
                  if (
                    selectedReport.post?.houseImages &&
                    selectedReport.post.houseImages.length > 0
                  ) {
                    openCarousel(selectedReport.post.houseImages, 0);
                  }
                }}
                activeOpacity={0.9}
              >
                {imageUrl ? (
                  <Image source={normalizeImageSource({ uri: imageUrl })} style={styles.sheetImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.sheetImagePlaceholder, { backgroundColor: theme.border }]}>
                    <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
                  </View>
                )}
                {selectedReport.post?.houseImages &&
                selectedReport.post.houseImages.length > 1 ? (
                  <View style={styles.sheetImageCount}>
                    <Text style={styles.sheetImageCountText}>
                      +{selectedReport.post.houseImages.length - 1}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {selectedReport.reason || t.notProvided}
              </Text>
              <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                {t.reportedBy}: {selectedReport.reporterName || t.notProvided}
              </Text>

              {/* Info rows */}
              <View style={styles.sheetInfoRow}>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.post}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]} numberOfLines={1}>
                    {selectedReport.postTitle || t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.reportDate}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]}>
                    {selectedReport.createdAt
                      ? new Date(selectedReport.createdAt).toLocaleDateString()
                      : t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.status}
                  </Text>
                  <View
                    style={[
                      styles.sheetStatusBadge,
                      { backgroundColor: isIgnored ? theme.textSecondary : theme.accent },
                    ]}
                  >
                    <Text style={styles.sheetStatusText}>
                      {isIgnored ? t.ignored : t.reason}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.sheetActions}>
                {!isIgnored && (
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: theme.textSecondary }]}
                    onPress={() => handleIgnoreReport(selectedReport._id)}
                  >
                    <Ionicons name="close-circle-outline" size={22} color="#fff" />
                    <Text style={styles.sheetActionText}>{t.ignore}</Text>
                  </TouchableOpacity>
                )}
                {/* ---------- NEW: View Post Button ---------- */}
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: theme.accent }]}
                  onPress={openViewPostModal}
                >
                  <Ionicons name="eye-outline" size={22} color="#fff" />
                  <Text style={styles.sheetActionText}>{t.viewReportedPost}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // ---------- Render item ----------
  const renderReportItem = ({ item }) => {
    const isIgnored = item.ignored || false;
    const imageUrl =
      item.post?.houseImages && item.post.houseImages.length > 0
        ? item.post.houseImages[0]
        : null;
    return (
      <TouchableOpacity
        style={[
          styles.reportCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            opacity: isIgnored ? 0.5 : 1,
          },
        ]}
        onPress={() => openSheet(item)}
        activeOpacity={0.8}
      >
        <View style={styles.reportContent}>
          <View style={styles.reportHeader}>
            <TouchableOpacity
              onPress={() => {
                if (item.post?.houseImages && item.post.houseImages.length > 0) {
                  openCarousel(item.post.houseImages, 0);
                }
              }}
              activeOpacity={0.9}
            >
              {imageUrl ? (
                <Image source={normalizeImageSource({ uri: imageUrl })} style={styles.reportImage} />
              ) : (
                <View
                  style={[
                    styles.reportImage,
                    {
                      backgroundColor: theme.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
                </View>
              )}
              {item.post?.houseImages && item.post.houseImages.length > 1 && (
                <View style={styles.imageCountBadgeSmall}>
                  <Text style={styles.imageCountTextSmall}>
                    +{item.post.houseImages.length - 1}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={[styles.reportTitle, { color: theme.text, flex: 1 }]} numberOfLines={2}>
              {item.reason || 'No reason'}
            </Text>
            {isIgnored && (
              <View style={[styles.statusBadge, { backgroundColor: theme.textSecondary }]}>
                <Text style={styles.statusBadgeText}>Ignored</Text>
              </View>
            )}
          </View>
          <Text style={[styles.reportSubtitle, { color: theme.textSecondary }]}>
            {t.reportedBy}: {item.reporterName || 'Unknown'}
          </Text>
          <Text style={[styles.reportSubtitle, { color: theme.textSecondary }]}>
            Post: {item.postTitle || 'Unknown'}
          </Text>
          <Text style={[styles.reportDate, { color: theme.textSecondary }]}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- Render list ----------
  const renderReportsList = () => (
    <FlatList
      data={filteredReports}
      keyExtractor={(item) => item._id}
      renderItem={renderReportItem}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchReports} tintColor={theme.accent} />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noReports}</Text>
        </View>
      }
    />
  );

  // ---------- Render search ----------
  const renderSearch = () => (
    <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
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
    </View>
  );

  // ---------- Main render ----------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <AdminScreenHeader
        title={t.reports}
        theme={theme}
        onBack={() => navigation.goBack()}
        actionIcon="refresh-outline"
        actionLabel="Refresh reports"
        onAction={fetchReports}
      />

      {/* Search */}
      {renderSearch()}

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />
        </View>
      ) : (
        renderReportsList()
      )}

      {/* Modals */}
      {renderBottomSheet()}
      {renderCarousel()}
      {renderViewPostModal()}  {/* NEW */}
    </SafeAreaView>
  );
};

// ---------- Updated Styles ----------
const styles = StyleSheet.create({
  // ... (keep all existing styles unchanged) ...
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
  headerTitle: { fontSize: 20, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
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

  listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  reportCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  reportContent: { flex: 1 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  reportImage: { width: 50, height: 50, borderRadius: 8, marginRight: 10 },
  reportTitle: { fontSize: 14, fontWeight: '600' },
  reportSubtitle: { fontSize: 13, marginBottom: 2 },
  reportDate: { fontSize: 12, opacity: 0.7 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  imageCountBadgeSmall: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  imageCountTextSmall: { color: '#fff', fontSize: 8, fontWeight: '600' },

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
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sheetSub: { fontSize: 14, marginBottom: 12 },
  sheetInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  sheetInfoItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  sheetInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sheetInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
    justifyContent: 'space-around',
    gap: 12,
  },
  sheetActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  sheetActionText: {
    color: '#fff',
    fontSize: 16,
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

  // Carousel
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

  // ---------- NEW: View Reported Post Styles ----------
  sliderContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  sliderImage: {
    width: width,
    height: 300,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: '#ffffff',
    width: 12,
    height: 8,
  },
  viewPostContainer: {
    flex: 1,
  },
  viewPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  viewPostHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewPostContent: {
    paddingBottom: 40,
  },
  viewPostNoImage: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewPostDetails: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  viewPostPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  viewPostInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  viewPostInfoText: {
    fontSize: 15,
  },
  viewPostDescription: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
    fontSize: 16,
  },
  viewPostDescriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  viewPostContacts: {
    marginTop: 16,
  },
  viewPostContactLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  viewPostContact: {
    fontSize: 15,
    marginBottom: 4,
  },
});

export default AdminReportsScreen;