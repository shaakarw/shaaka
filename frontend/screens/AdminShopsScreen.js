
// screens/AdminShopsScreen.js
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
const CARD_MARGIN = 6;
const ITEMS_PER_ROW = 2;
const CARD_WIDTH = (width - CARD_MARGIN * (ITEMS_PER_ROW + 1)) / ITEMS_PER_ROW;
const BOTTOM_SHEET_MAX_HEIGHT = height * 0.75;
const BOTTOM_SHEET_MIN_HEIGHT = height * 0.25;

// ---------- Translations ----------
const translations = {
  English: {
    shops: 'Shops',
    searchPlaceholder: 'Search by name, location, or owner...',
    noShops: 'No shops found.',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this shop?',
    viewDetails: 'View Details',
    owner: 'Owner',
    location: 'Location',
    phone: 'Phone',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    notProvided: 'N/A',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    cancel: 'Cancel',
    back: 'Back',
    promote: 'Promote',
    unpromote: 'Unpromote',
    promoted: 'Promoted',
  },
  Kinyarwanda: {
    shops: 'Amaduka',
    searchPlaceholder: 'Shakisha izina, ahantu, cyangwa nyirarwo...',
    noShops: 'Nta maduka aboneka.',
    delete: 'Siba',
    deleteConfirm: 'Uri kwizera ko ushaka gusiba iri duka?',
    viewDetails: 'Reba ibisobanuro',
    owner: 'Nyirarwo',
    location: 'Ahantu',
    phone: 'Telefone',
    status: 'Imyanya',
    active: 'Ikora',
    inactive: 'Ntigikora',
    notProvided: 'Ntaboneka',
    ok: 'Sawa',
    success: 'Byakunze',
    error: 'Ikibazo',
    cancel: 'Reka',
    back: 'Subira',
    promote: 'Kuzamura',
    unpromote: 'Kuraho kuzamura',
    promoted: 'Byazamuwe',
  },
};

// ---------- Main Component ----------
const AdminShopsScreen = ({ navigation, language }) => {
  const { theme } = useTheme();
  const t = translations[language] || translations.English;

  const [shops, setShops] = useState([]);
  const [filteredShops, setFilteredShops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bottom sheet state
  const [selectedShop, setSelectedShop] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

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
    showAdminFeedback(title, message, title === t.error ? 'error' : 'success', { buttonText: t.ok });
  };

  // ---------- Fetch shops ----------
  const fetchShops = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin');
        return;
      }
      const res = await axios.get(`${BASE_URL}/api/admin/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const shopList = res.data.shops || [];
        setShops(shopList);
        // Apply sorting: promoted first, then by name
        const sorted = sortShops(shopList);
        setFilteredShops(sorted);
      } else {
        showAdminFeedback(t.error, 'Failed to fetch shops.', 'error');
      }
    } catch (error) {
      console.error('Fetch shops error:', error);
      if (error.response?.status === 401) {
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(t.error, 'An error occurred while fetching shops.', 'error');
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [navigation, t]);

  // Sorting function: promoted first, then by name
  const sortShops = (shopList) => {
    return [...shopList].sort((a, b) => {
      if (a.promoted && !b.promoted) return -1;
      if (!a.promoted && b.promoted) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [fetchShops])
  );

  // ---------- Search filtering ----------
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredShops(sortShops(shops));
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = shops.filter(
      (shop) =>
        (shop.name && shop.name.toLowerCase().includes(q)) ||
        (shop.location && shop.location.toLowerCase().includes(q)) ||
        (shop.ownerName && shop.ownerName.toLowerCase().includes(q)) ||
        (shop.phone && shop.phone.includes(q))
    );
    setFilteredShops(sortShops(filtered));
  }, [searchQuery, shops]);

  // ---------- Handlers ----------
  const handleDeleteShop = (shop) => {
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            const shopType = shop.isMallShop ? 'mall-shops' : 'shops';
            await axios.delete(`${BASE_URL}/api/admin/${shopType}/${shop._id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showStatus(t.success, 'Shop deleted successfully.');
            closeSheet();
            fetchShops();
          } catch (e) {
            showAdminFeedback(t.error, 'Failed to delete shop.', 'error');
          }
        },
      },
    ]);
  };

  // ---------- Toggle promotion ----------
  const handleTogglePromote = async (shop) => {
    try {
      const token = await getToken();
      const newPromoted = !shop.promoted;
      await axios.patch(
        `${BASE_URL}/api/admin/shops/${shop._id}`,
        { promoted: newPromoted },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showStatus(t.success, newPromoted ? 'Shop promoted.' : 'Promotion removed.');
      closeSheet();
      fetchShops();
    } catch (error) {
      showAdminFeedback(t.error, 'Failed to update promotion status.', 'error');
    }
  };

  // ---------- Bottom sheet controls ----------
  const openSheet = (shop) => {
    setSelectedShop(shop);
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
      setSelectedShop(null);
    });
  };

  const renderBottomSheet = () => {
    if (!selectedShop) return null;
    const isActive = selectedShop.status === 'active';
    const isPromoted = selectedShop.promoted || false;

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
              {/* Shop image (if any) */}
              <View style={styles.sheetImageContainer}>
                {selectedShop.image ? (
                  <Image source={normalizeImageSource({ uri: selectedShop.image })} style={styles.sheetImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.sheetImagePlaceholder, { backgroundColor: theme.border }]}>
                    <Ionicons name="storefront-outline" size={50} color={theme.textSecondary} />
                  </View>
                )}
                {isPromoted && (
                  <View style={[styles.promotedBadge, { backgroundColor: '#FFD700' }]}>
                    <Ionicons name="star" size={16} color="#000" />
                    <Text style={styles.promotedBadgeText}>{t.promoted}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {selectedShop.name || t.notProvided}
              </Text>
              <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                {t.owner}: {selectedShop.ownerName || t.notProvided}
              </Text>

              {/* Info rows */}
              <View style={styles.sheetInfoRow}>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.location}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]}>
                    {selectedShop.location || t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.phone}
                  </Text>
                  <Text style={[styles.sheetInfoValue, { color: theme.text }]}>
                    {selectedShop.phone || t.notProvided}
                  </Text>
                </View>
                <View style={styles.sheetInfoItem}>
                  <Text style={[styles.sheetInfoLabel, { color: theme.textSecondary }]}>
                    {t.status}
                  </Text>
                  <View
                    style={[
                      styles.sheetStatusBadge,
                      { backgroundColor: isActive ? theme.accent : theme.textSecondary },
                    ]}
                  >
                    <Text style={styles.sheetStatusText}>
                      {isActive ? t.active : t.inactive}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.sheetActions}>
                {!selectedShop.isMallShop && (
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: '#FFD700' }]}
                    onPress={() => handleTogglePromote(selectedShop)}
                  >
                    <Ionicons name={isPromoted ? 'star' : 'star-outline'} size={22} color="#000" />
                    <Text style={[styles.sheetActionText, { color: '#000' }]}>
                      {isPromoted ? t.unpromote : t.promote}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: '#dc3545' }]}
                  onPress={() => handleDeleteShop(selectedShop)}
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
  const renderShopItem = ({ item }) => {
    const isActive = item.status === 'active';
    const statusColor = isActive ? theme.accent : theme.textSecondary;
    const statusLabel = isActive ? t.active : t.inactive;
    const isPromoted = item.promoted || false;

    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            opacity: isActive ? 1 : 0.6,
            borderWidth: isPromoted ? 2 : 1,
            borderColor: isPromoted ? '#FFD700' : theme.border,
          },
        ]}
        onPress={() => openSheet(item)}
        activeOpacity={0.8}
      >
        <View style={styles.shopImageContainer}>
          {item.image ? (
            <Image source={normalizeImageSource({ uri: item.image })} style={styles.shopImage} resizeMode="cover" />
          ) : (
            <View style={[styles.shopImagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="storefront-outline" size={30} color={theme.textSecondary} />
            </View>
          )}
          {isPromoted && (
            <View style={[styles.promotedBadgeSmall, { backgroundColor: '#FFD700' }]}>
              <Ionicons name="star" size={12} color="#000" />
            </View>
          )}
          {item.isMallShop ? (
            <View style={[styles.mallShopBadge, { backgroundColor: theme.accent }]}>
              <Text style={styles.statusBadgeText}>MALL</Text>
            </View>
          ) : null}
          <View style={[styles.statusBadge, { backgroundColor: statusColor, position: 'absolute', top: 4, right: 4 }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
          {item.name || 'Shop'}
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

  // ---------- Render list ----------
  const renderShopsList = () => (
    <FlatList
      data={filteredShops}
      keyExtractor={(item) => item._id}
      renderItem={renderShopItem}
      numColumns={ITEMS_PER_ROW}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchShops} tintColor={theme.accent} />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noShops}</Text>
        </View>
      }
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
    />
  );

  // ---------- Render search ----------
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <AdminScreenHeader
        title={t.shops}
        theme={theme}
        onBack={() => navigation.goBack()}
        actionIcon="refresh-outline"
        actionLabel="Refresh shops"
        onAction={fetchShops}
      />

      {/* Search (collapsible) */}
      {renderSearch()}

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />
        </View>
      ) : (
        renderShopsList()
      )}

      {/* Modals */}
      {renderBottomSheet()}
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
    zIndex: 2,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
    position: 'relative',
  },
  shopImageContainer: {
    width: '100%',
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    position: 'relative',
  },
  shopImage: { width: '100%', height: '100%' },
  shopImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  promotedBadgeSmall: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mallShopBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  gridSubtitle: { fontSize: 11, textAlign: 'center', opacity: 0.7, marginBottom: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, textAlign: 'center' },

  // Bottom Sheet (identical to others)
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
  promotedBadge: {
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
  promotedBadgeText: {
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
});

export default AdminShopsScreen;