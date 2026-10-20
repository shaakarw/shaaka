// screens/ViewShopScreen.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  FlatList,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import * as ImagePicker from 'expo-image-picker';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { networkStatus } from '../services/networkStatus';
import { offlineDatabase } from '../services/offlineDatabase';
import { mediaCache } from '../services/mediaCache';

const { height, width } = Dimensions.get('window');
const MODAL_HEIGHT_80 = height * 0.7;   // same as ViewPlaceScreen
const MODAL_HEIGHT_90 = height * 0.9;
const SWIPE_THRESHOLD = 60;
const HANDLE_HEIGHT = height * 0.05;
const ADD_PRODUCT_SHEET_HEIGHT = height * 0.65;

const getToken = async () => {
  let token = await AsyncStorage.getItem('userToken');
  if (!token) token = await AsyncStorage.getItem('adminToken');
  return token;
};

// ----- Helper: toggle favorite (shop) -----
const toggleFavoriteShop = async (shopId) => {
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const favShopsJson = await AsyncStorage.getItem('favoriteShops');
    let favShops = favShopsJson ? JSON.parse(favShopsJson) : [];
    const isCurrentlyFav = favShops.includes(shopId);

    const method = isCurrentlyFav ? 'DELETE' : 'POST';
    const url = `${BASE_URL}/api/favorites/shops`;

    const response = await axios({
      method,
      url,
      data: { shopId },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success) {
      const newFavs = response.data.favoriteShops.map(s => s._id || s.id);
      await AsyncStorage.setItem('favoriteShops', JSON.stringify(newFavs));
      return !isCurrentlyFav;
    } else {
      throw new Error(response.data.message || 'Failed to toggle favorite');
    }
  } catch (error) {
    console.error('Toggle favorite shop error:', error);
    throw error;
  }
};

export default function ViewShopScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { shopId } = route.params;
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [owner, setOwner] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Add product sheet
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    images: [],
  });
  const [uploadingProduct, setUploadingProduct] = useState(false);

  // Confirm modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOnYes, setConfirmOnYes] = useState(null);
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  // Status/info modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [statusModalType, setStatusModalType] = useState('info'); // 'success' | 'error' | 'info'

  const modalHeight = useRef(new Animated.Value(MODAL_HEIGHT_80)).current;

  // ----- Modal helpers -----
  const openConfirmModal = ({ title, message, onYes, destructive = false }) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmOnYes(() => onYes);
    setConfirmDestructive(destructive);
    setConfirmModalVisible(true);
  };

  const showStatusModal = ({ title, message, type = 'info' }) => {
    setStatusModalTitle(title);
    setStatusModalMessage(message);
    setStatusModalType(type);
    setStatusModalVisible(true);
  };

  // Add Product swipe-up sheet animation
  const addProductSheetTranslateY = useRef(new Animated.Value(ADD_PRODUCT_SHEET_HEIGHT)).current;
  const addProductBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [addProductSheetVisible, setAddProductSheetVisible] = useState(false);

  const openAddProductSheet = () => {
    setNewProduct({ name: '', price: '', images: [] });
    setAddProductSheetVisible(true);
    Animated.parallel([
      Animated.timing(addProductSheetTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(addProductBackdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeAddProductSheet = () => {
    Animated.parallel([
      Animated.timing(addProductSheetTranslateY, {
        toValue: ADD_PRODUCT_SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(addProductBackdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAddProductSheetVisible(false);
    });
  };

  // PanResponder for the Add Product sheet
  const addProductPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 8 && gestureState.dy > 0,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          addProductSheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > SWIPE_THRESHOLD) {
          closeAddProductSheet();
        } else {
          Animated.spring(addProductSheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Main pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        modalHeight.stopAnimation();
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy, vy } = gestureState;
        const currentHeight = modalHeight._value;
        const isAt80 = Math.abs(currentHeight - MODAL_HEIGHT_80) < 10;
        const isAt90 = Math.abs(currentHeight - MODAL_HEIGHT_90) < 10;

        if (dy > SWIPE_THRESHOLD || vy > 0.5) {
          if (isAt90) {
            setExpanded(false);
            Animated.spring(modalHeight, {
              toValue: MODAL_HEIGHT_80,
              useNativeDriver: false,
              speed: 10,
            }).start();
          } else {
            navigation.goBack();
          }
        } else if (dy < -SWIPE_THRESHOLD || vy < -0.5) {
          setExpanded(true);
          Animated.spring(modalHeight, {
            toValue: MODAL_HEIGHT_90,
            useNativeDriver: false,
            speed: 10,
          }).start();
        } else {
          const target = isAt90 ? MODAL_HEIGHT_90 : MODAL_HEIGHT_80;
          Animated.spring(modalHeight, {
            toValue: target,
            useNativeDriver: false,
            speed: 10,
          }).start();
        }
      },
    })
  ).current;

  const backdropHeight = modalHeight.interpolate({
    inputRange: [0, MODAL_HEIGHT_90],
    outputRange: [height, height - MODAL_HEIGHT_90],
    extrapolate: 'clamp',
  });

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    await networkStatus.start();
    let cachedUser = null;
    try {
      const cached = await AsyncStorage.getItem('user');
      if (cached) cachedUser = JSON.parse(cached);
    } catch {}
    if (!networkStatus.get().isOnline) {
      setCurrentUser(cachedUser);
      return;
    }
    try {
      const token = await getToken();
      if (!token) {
        setCurrentUser(cachedUser);
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setCurrentUser(response.data.user);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      setCurrentUser(cachedUser);
    }
  }, []);

  // Fetch shop
  const fetchShop = useCallback(async () => {
    setLoading(true);
    let cachedShop = null;
    try {
      cachedShop = await offlineDatabase.getRecord('mall-shop-details', String(shopId));
      if (cachedShop) {
        const hydratedShop = await mediaCache.hydrate(cachedShop);
        setShop(hydratedShop);
        const cachedOwner = cachedShop.owner || (typeof cachedShop.ownerId === 'object' ? cachedShop.ownerId : null);
        if (cachedOwner) setOwner(await mediaCache.hydrate(cachedOwner));
      }

      await networkStatus.start();
      if (!networkStatus.get().isOnline) {
        if (!cachedShop) setShop(null);
        return;
      }
      const token = await getToken();
      const response = await axios.get(`${BASE_URL}/api/mall-shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const shopData = await mediaCache.hydrate(response.data.shop);
      setShop(shopData);

      // Determine owner
      let ownerInfo = null;
      if (shopData.ownerId) {
        if (typeof shopData.ownerId === 'object' && shopData.ownerId._id) {
          ownerInfo = shopData.ownerId;
        } else if (typeof shopData.ownerId === 'string') {
          try {
            const userRes = await axios.get(`${BASE_URL}/api/users/${shopData.ownerId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            ownerInfo = userRes.data.success ? userRes.data.user : { _id: shopData.ownerId, name: 'Shop Owner' };
          } catch (e) {
            ownerInfo = { _id: shopData.ownerId, name: 'Shop Owner' };
          }
        }
      } else if (shopData.owner) {
        if (typeof shopData.owner === 'object' && shopData.owner._id) ownerInfo = shopData.owner;
        else if (typeof shopData.owner === 'string') {
          try {
            const userRes = await axios.get(`${BASE_URL}/api/users/${shopData.owner}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            ownerInfo = userRes.data.success ? userRes.data.user : { _id: shopData.owner, name: 'Shop Owner' };
          } catch (e) {
            ownerInfo = { _id: shopData.owner, name: 'Shop Owner' };
          }
        }
      } else if (shopData.userId) {
        try {
          const userRes = await axios.get(`${BASE_URL}/api/users/${shopData.userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          ownerInfo = userRes.data.success ? userRes.data.user : { _id: shopData.userId, name: 'Shop Owner' };
        } catch (e) {
          ownerInfo = { _id: shopData.userId, name: 'Shop Owner' };
        }
      }
      if (!ownerInfo) ownerInfo = { _id: null, name: 'Shop Owner' };
      if (!ownerInfo.name) ownerInfo.name = ownerInfo.username || 'Shop Owner';
      const hydratedOwner = await mediaCache.hydrate(ownerInfo);
      setOwner(hydratedOwner);
      await offlineDatabase.putRecord('mall-shop-details', String(shopId), {
        ...shopData,
        owner: hydratedOwner,
      }, { priority: 'high' });
    } catch (error) {
      console.error('Fetch shop error:', error);
      if (!cachedShop) {
        showStatusModal({ title: 'Error', message: 'Could not load shop details.', type: 'error' });
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, navigation]);

  // Load favorite status
  const loadFavoriteStatus = async () => {
    try {
      const favShopsJson = await AsyncStorage.getItem('favoriteShops');
      if (favShopsJson) {
        const favShops = JSON.parse(favShopsJson);
        setIsFavorite(favShops.includes(shopId));
      } else {
        setIsFavorite(false);
      }
    } catch (e) {
      setIsFavorite(false);
    }
  };

  useEffect(() => {
    fetchShop();
    fetchCurrentUser();
    loadFavoriteStatus();
  }, [fetchShop, fetchCurrentUser, shopId]);

  // Check if current user is owner
  const isOwner = useMemo(() => {
    if (!currentUser || !shop) return false;
    let ownerId = shop.ownerId?._id || shop.ownerId || shop.owner?._id || shop.owner || shop.userId;
    if (!ownerId) return false;
    return String(currentUser._id) === String(ownerId);
  }, [currentUser, shop]);

  // Helpers
  const openLink = (url) => {
    if (!url) return;
    let formatted = url;
    if (!/^https?:\/\//i.test(formatted)) formatted = 'https://' + formatted;
    Linking.openURL(formatted).catch(() => showStatusModal({ title: 'Error', message: 'Could not open link.', type: 'error' }));
  };

  const [appShareLink, setAppShareLink] = useState('');

  useEffect(() => {
    const loadShareLink = async () => {
      try {
        await networkStatus.start();
        if (!networkStatus.get().isOnline) {
          setAppShareLink((await AsyncStorage.getItem('appShareLink')) || '');
          return;
        }
        const response = await axios.get(`${BASE_URL}/api/settings/share-link`);
        if (response.data.success) {
          setAppShareLink(response.data.shareLink || '');
          await AsyncStorage.setItem('appShareLink', response.data.shareLink || '');
        }
      } catch (error) {
        console.error('Load share link error:', error.message);
      }
    };
    loadShareLink();
  }, []);

  const handleShare = async () => {
    if (!shop) return;
    const link = appShareLink || 'https://shaaka.app';
    const message = `🛍️ ${shop.name}\n📍 ${shop.address || ''}\n🏢 ${shop.mallName || 'Shopping Mall'}\nCategory: ${shop.category || 'General'}\n\n${link}`;
    await Share.share({ message });
  };

  const handleMessageOwner = () => {
    if (!shop) return;

    const sellerId = owner?._id || shop.ownerId?._id || shop.ownerId || shop.owner || shop.userId;
    const sellerName = owner?.name || owner?.username || shop.ownerName || 'Shop owner';
    const sellerPhone = owner?.phone || shop.phone || '';
    const contextId = shop?._id || shopId || `shop_${shop?.name || 'shop'}`;

    if (!sellerId) {
      showStatusModal({ title: 'Error', message: 'Owner information is not available yet.', type: 'error' });
      return;
    }

    const replyPost = {
      postId: contextId,
      contextType: 'shop',
      contextId,
      shopId: String(shop._id || shopId),
      mallId: String(shop.mallId || shop.mall?._id || ''),
      lat: shop.lat ?? shop.mall?.lat ?? null,
      lon: shop.lon ?? shop.mall?.lon ?? null,
      title: shop.name || 'Shop',
      description: shop.description || '',
      image: shop.logo || shop.coverImage || shop.image || '',
      price: null,
      amount: '',
      location: shop.address || '',
      category: shop.category || '',
      username: sellerName,
      ownerId: sellerId,
      timestamp: new Date().toISOString(),
    };

    navigation.navigate('Chat', {
      sellerId,
      sellerName: sellerName,
      sellerPhone: sellerPhone,
      postId: contextId,
      postTitle: shop.name || 'Shop',
      replyPost,
    });
  };

  const handleCall = () => { if (shop?.phone) openLink(`tel:${shop.phone}`); };
  const handleWhatsApp = () => {
    if (shop?.whatsapp) {
      const num = shop.whatsapp.startsWith('+') ? shop.whatsapp : `+250${shop.whatsapp}`;
      openLink(`whatsapp://send?phone=${num}`);
    }
  };
  const handleDirections = () => {
    if (shop?.lat && shop?.lon) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`;
      openLink(url);
    } else {
      showStatusModal({ title: 'No location', message: 'Shop location not available.', type: 'info' });
    }
  };
  const clearSearch = () => setSearchQuery('');

  // ---- Favorite toggle ----
  const handleFavorite = async () => {
    try {
      const newState = await toggleFavoriteShop(shopId);
      setIsFavorite(newState);
      await loadFavoriteStatus();
    } catch (error) {
      showStatusModal({ title: 'Error', message: 'Could not update favorite. Please try again.', type: 'error' });
    }
  };

  // ---- Delete shop ----
  const handleDeleteShop = () => {
    openConfirmModal({
      title: 'Delete Shop',
      message: `Are you sure you want to delete "${shop.name}"? This action cannot be undone.`,
      destructive: true,
      onYes: async () => {
        setConfirmModalVisible(false);
        try {
          const token = await getToken();
          await axios.delete(`${BASE_URL}/api/mall-shops/${shopId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          showStatusModal({ title: 'Deleted', message: 'Your shop has been removed.', type: 'success' });
          navigation.goBack();
        } catch (error) {
          showStatusModal({ title: 'Error', message: 'Could not delete shop.', type: 'error' });
        }
      },
    });
  };

  // ---- Add product sheet ----
  const handleAddProduct = () => {
    openAddProductSheet();
  };

  // ---- Pick one product image ----
  const pickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showStatusModal({ title: 'Permission Denied', message: 'Please grant access to your photos.', type: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const newImages = [{
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
      }];
      setNewProduct(prev => ({
        ...prev,
        images: newImages,
      }));
    }
  };

  const removeProductImage = (index) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleProductPriceChange = (text) => {
    const digits = text.replace(/\D/g, '');
    const formattedPrice = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setNewProduct(prev => ({ ...prev, price: formattedPrice }));
  };

  // ---- Add product using PUT (upload all images) ----
  const submitProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) {
      showStatusModal({ title: 'Missing', message: 'Please provide product name and price.', type: 'error' });
      return;
    }
    if (newProduct.name.trim().length > 10) {
      showStatusModal({ title: 'Invalid Name', message: 'Product name must be 10 characters or fewer.', type: 'error' });
      return;
    }
    if (newProduct.images.length === 0) {
      showStatusModal({ title: 'Missing', message: 'Please add at least one product image.', type: 'error' });
      return;
    }

    setUploadingProduct(true);
    try {
      const token = await getToken();
      if (!token) {
        showStatusModal({ title: 'Error', message: 'You are not logged in.', type: 'error' });
        return;
      }

      // Upload all images
      const imageUrls = [];
      for (const img of newProduct.images) {
        const formData = new FormData();
        formData.append('image', {
          uri: img.uri,
          type: img.type || 'image/jpeg',
          name: img.name,
        });
        const uploadRes = await axios.post(`${BASE_URL}/api/places/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        if (uploadRes.data.success) {
          imageUrls.push(uploadRes.data.url);
        } else {
          throw new Error('Image upload failed');
        }
      }

      const newProductObj = {
        name: newProduct.name.trim(),
        price: Number(newProduct.price.replace(/,/g, '')) || 0,
        images: imageUrls,   // array of URLs
      };

      const updatedProducts = [...(shop.products || []), newProductObj];
      const updatedShopData = { ...shop, products: updatedProducts };

      const response = await axios.put(`${BASE_URL}/api/mall-shops/${shopId}`, updatedShopData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const updatedShop = response.data.shop || { ...shop, products: updatedProducts };
        setShop(updatedShop);
        await offlineDatabase.putRecord('mall-shop-details', String(shopId), {
          ...await mediaCache.hydrate(updatedShop),
          owner: await mediaCache.hydrate(owner || updatedShop.owner || {}),
        }, { priority: 'high' });
        closeAddProductSheet();
        showStatusModal({ title: 'Success', message: 'Product added successfully!', type: 'success' });
        setNewProduct({ name: '', price: '', images: [] });
      } else {
        throw new Error(response.data.message || 'Failed to add product');
      }
    } catch (error) {
      console.error('Add product error:', error);
      showStatusModal({ title: 'Error', message: error.response?.data?.message || 'Could not add product. Please try again.', type: 'error' });
    } finally {
      setUploadingProduct(false);
    }
  };

  // ---- Delete product ----
  const handleDeleteProduct = (productId, productName) => {
    openConfirmModal({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${productName}"?`,
      destructive: true,
      onYes: async () => {
        setConfirmModalVisible(false);
        try {
          const token = await getToken();
          const updatedProducts = shop.products.filter(p => p._id !== productId);
          const updatedShopData = { ...shop, products: updatedProducts };

          const response = await axios.put(`${BASE_URL}/api/mall-shops/${shopId}`, updatedShopData, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.data.success) {
            const updatedShop = response.data.shop || { ...shop, products: updatedProducts };
            setShop(updatedShop);
            await offlineDatabase.putRecord('mall-shop-details', String(shopId), {
              ...await mediaCache.hydrate(updatedShop),
              owner: await mediaCache.hydrate(owner || updatedShop.owner || {}),
            }, { priority: 'high' });
            showStatusModal({ title: 'Deleted', message: 'Product has been removed.', type: 'success' });
          } else {
            throw new Error(response.data.message || 'Failed to delete');
          }
        } catch (error) {
          showStatusModal({ title: 'Error', message: 'Could not delete product.', type: 'error' });
        }
      },
    });
  };

  // ---- Filtered products ----
  const filteredProducts = useMemo(() => {
    if (!shop?.products) return [];
    if (!searchQuery.trim()) return shop.products;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return shop.products.filter(p => p.name.toLowerCase().includes(lowerQuery));
  }, [shop, searchQuery]);

  // ---- Render product item ----
  const renderProductItem = ({ item }) => {
    const firstImage = item.images && item.images.length > 0 ? item.images[0] : null;
    return (
      <View style={[styles.productGridItem, { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (firstImage) {
              navigation.navigate('Preview', { imageUri: firstImage });
            }
          }}
        >
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.productGridImage} />
          ) : (
            <View style={[styles.productGridImage, styles.productImagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.productGridInfo}>
          <Text style={[styles.productGridName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.productGridPrice, { color: theme.accent }]}>
            {item.price.toLocaleString()} RWF
          </Text>
          {isOwner && (
            <TouchableOpacity
              style={[
                styles.productDeleteBtn,
                { backgroundColor: isDarkMode ? '#353535' : '#111' },   // ← dynamic background
              ]}
              onPress={() => handleDeleteProduct(item._id, item.name)}
            >
              <Ionicons name="trash-outline" size={18} color="#ddd" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ============================================================
  // STICKY HEADER
  // ============================================================
  const renderStickyHeader = () => (
    <View style={[styles.stickyHeader, { backgroundColor: theme.background }]}>
      <View style={styles.stickyHeaderRow}>
        <TouchableOpacity
          style={styles.stickyBackBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to mall"
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderInfo}>
          <Text style={[styles.stickyShopName, { color: theme.text }]} numberOfLines={1}>
            {shop?.name || 'Shop'}
          </Text>
          {shop?.mallName && (
            <Text style={[styles.stickyMallName, { color: theme.textSecondary }]} numberOfLines={1}>
              <Ionicons name="business-outline" size={14} /> {shop.mallName}
            </Text>
          )}
          {shop?.address && (
            <Text style={[styles.stickyAddress, { color: theme.textSecondary }]} numberOfLines={1}>
              <Ionicons name="location-outline" size={14} /> {shop.address}
            </Text>
          )}
        </View>
        {isOwner && (
          <TouchableOpacity
            style={[styles.stickyDeleteBtn, { backgroundColor: '#353535' }]}
            onPress={handleDeleteShop}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ============================================================
  // BOTTOM NAVIGATION BAR (placeholder)
  // ============================================================
  const renderBottomNav = () => (
    <View style={[styles.bottomNav, { backgroundColor: theme.background }]} />
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  if (loading) {
    return <ShaakaLoadingScreen backgroundColor={theme.background} textColor={theme.text} hideText />;
  }

  if (!shop) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Shop not found.</Text>
      </View>
    );
  }

  const displayOwner = owner || { _id: null, name: 'Shop Owner' };
  const ownerId = displayOwner._id || shop.ownerId?._id || shop.userId || null;
  const ownerName = displayOwner.name || displayOwner.username || 'Shop Owner';
  const ownerAvatar = displayOwner.avatar || null;

  const frontImage = shop.images?.frontImage || shop.images?.front || null;
  const hasProducts = shop.products && shop.products.length > 0;

  const goToOwnerProfile = () => {
    if (ownerId) {
      navigation.navigate('Profile', { userId: ownerId, username: ownerName });
    } else {
      showStatusModal({ title: 'Error', message: 'Owner information not available.', type: 'error' });
    }
  };

  // Confirm modal component
  const renderConfirmModal = () => (
    <Modal transparent visible={confirmModalVisible} animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
      <View style={[styles.confirmModalOverlay, { backgroundColor: theme.action }]}>
        <View style={[styles.confirmModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.confirmModalIconContainer}>
            <Ionicons
              name={confirmDestructive ? 'trash-outline' : 'alert-circle-outline'}
              size={40}
              color={confirmDestructive ? '#353535' : theme.accent}
            />
          </View>
          <Text style={[styles.confirmModalTitle, { color: theme.text }]}>{confirmTitle}</Text>
          <Text style={[styles.confirmModalMessage, { color: theme.textSecondary }]}>{confirmMessage}</Text>
          <View style={styles.confirmModalButtonsRow}>
            <TouchableOpacity
              style={[styles.confirmModalButton, styles.confirmModalCancelButton, { borderColor: theme.border }]}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={[styles.confirmModalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmModalButton,
                styles.confirmModalYesButton,
                { backgroundColor: confirmDestructive ? '#353535' : theme.accent },
              ]}
              onPress={confirmOnYes}
            >
              <Text style={[styles.confirmModalButtonText, { color: '#fff' }]}>
                {confirmDestructive ? 'Delete' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Status modal component
  const renderStatusModal = () => {
    const iconName = statusModalType === 'success' ? 'checkmark-circle' : statusModalType === 'error' ? 'alert-circle' : 'information-circle';
    const iconColor = statusModalType === 'success' ? '#47ae87' : statusModalType === 'error' ? '#d87428' : theme.accent;
    return (
      <Modal transparent visible={statusModalVisible} animationType="fade" onRequestClose={() => setStatusModalVisible(false)}>
        <View style={[styles.confirmModalOverlay, { backgroundColor: theme.action }]}>
          <View style={[styles.confirmModalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.confirmModalIconContainer}>
              <Ionicons name={iconName} size={40} color={iconColor} />
            </View>
            <Text style={[styles.confirmModalTitle, { color: theme.text }]}>{statusModalTitle}</Text>
            <Text style={[styles.confirmModalMessage, { color: theme.textSecondary }]}>{statusModalMessage}</Text>
            <TouchableOpacity
              style={[styles.confirmModalButton, { backgroundColor: theme.accent }]}
              onPress={() => setStatusModalVisible(false)}
            >
              <Text style={[styles.confirmModalButtonText, { color: '#fff' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: 'transparent' }]}>
      {/* Animated backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            height: backdropHeight,
            backgroundColor: 'rgba(0,0,0,0.5)',
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={() => navigation.goBack()}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            backgroundColor: theme.background,
            height: modalHeight,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
          },
        ]}
      >
        {/* Handle area */}
        <View
          style={[styles.handleArea, { height: HANDLE_HEIGHT }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
            {hasProducts && !expanded && (
              <View style={styles.swipeIndicator}>
                <Text style={[styles.swipeText, { color: theme.text }]}>Swipe up to see products</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sticky Header */}
        {renderStickyHeader()}

        {/* Main scrollable content */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item, idx) => idx.toString()}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.productGridContainer}
          renderItem={renderProductItem}
          ListHeaderComponent={
            <>
              {/* Show detailed info ONLY when NOT expanded (like ViewPlaceScreen) */}
              {!expanded && (
                <View style={styles.content}>
                  {/* Cover image */}
                  {frontImage ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Preview', { imageUri: frontImage })}>
                      <Image source={{ uri: frontImage }} style={styles.coverImage} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.coverPlaceholder, { backgroundColor: theme.border }]}>
                      <Ionicons name="storefront-outline" size={60} color={theme.textSecondary} />
                    </View>
                  )}

                  {shop.category && (
                    <Text style={[styles.category, { color: theme.textSecondary }]}>{shop.category}</Text>
                  )}
                  {shop.description && (
                    <Text style={[styles.description, { color: theme.text }]}>{shop.description}</Text>
                  )}
                  {shop.shopNumber && (
                    <Text style={[styles.shopNumber, { color: theme.textSecondary }]}>
                      Shop #{shop.shopNumber}{shop.floorNumber ? `, Floor ${shop.floorNumber}` : ''}
                    </Text>
                  )}

                  {/* Owner card */}
                  <TouchableOpacity
                    style={[styles.ownerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                    onPress={goToOwnerProfile}
                    activeOpacity={ownerId ? 0.7 : 1}
                    disabled={!ownerId}
                  >
                    {ownerAvatar ? (
                      <Image source={{ uri: ownerAvatar }} style={styles.ownerAvatar} />
                    ) : (
                      <View style={[styles.ownerAvatarPlaceholder, { backgroundColor: theme.border }]}>
                        <Text style={[styles.ownerAvatarInitials, { color: theme.text }]}>
                          {ownerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.ownerInfo}>
                      <Text style={[styles.ownerName, { color: theme.text }]}>{ownerName}</Text>
                    </View>
                    {ownerId && <Ionicons name="arrow-forward-circle" size={20} color={theme.textSecondary} />}
                  </TouchableOpacity>

                  {/* Contact buttons */}
                  <View style={styles.contactRow}>
                    {shop.phone && (
                      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: theme.accent }]} onPress={handleCall}>
                        <Ionicons name="call-outline" size={20} color="#fff" />
                        <Text style={styles.contactBtnText}>Call</Text>
                      </TouchableOpacity>
                    )}
                    {shop.whatsapp && (
                      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25d366' }]} onPress={handleWhatsApp}>
                        <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                        <Text style={styles.contactBtnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {shop.email && (
                      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#34b7f1' }]} onPress={() => openLink(`mailto:${shop.email}`)}>
                        <Ionicons name="mail-outline" size={20} color="#fff" />
                        <Text style={styles.contactBtnText}>Email</Text>
                      </TouchableOpacity>
                    )}
                    {shop.website && (
                      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#6c5ce7' }]} onPress={() => openLink(shop.website)}>
                        <Ionicons name="globe-outline" size={20} color="#fff" />
                        <Text style={styles.contactBtnText}>Website</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Action row – horizontally scrollable */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.actionRowScroll}
                    contentContainerStyle={styles.actionRowContent}
                  >
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={handleDirections}>
                      <Ionicons name="navigate" size={22} color="#fff" />
                      <Text style={styles.actionBtnText}>Directions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={handleMessageOwner}>
                      <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
                      <Text style={styles.actionBtnText}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.border }]} onPress={handleShare}>
                      <Ionicons name="share-social" size={22} color={theme.text} />
                      <Text style={[styles.actionBtnText, { color: theme.text }]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.border }]} onPress={handleFavorite}>
                      <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? 'red' : theme.text} />
                      <Text style={[styles.actionBtnText, { color: theme.text }]}>{isFavorite ? 'Saved' : 'Save'}</Text>
                    </TouchableOpacity>
                    {isOwner && (
                      <TouchableOpacity style={[styles.actionBtn, styles.deleteShopBtn]} onPress={handleDeleteShop}>
                        <Ionicons name="trash-outline" size={22} color="#353535" />
                        <Text style={styles.actionBtnText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>

                  {/* Product header (title + Add button) */}
                  <View style={styles.productHeaderRow}>
                    <Text style={[styles.productGridTitle, { color: theme.text }]}>
                      Products ({shop.products?.length || 0})
                    </Text>
                    {isOwner && (
                      <TouchableOpacity style={[styles.addProductBtn, { backgroundColor: theme.accent }]} onPress={handleAddProduct}>
                        <Ionicons name="add-circle-outline" size={18} color="#fff" />
                        <Text style={styles.addProductBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Search bar (visible only when expanded) */}
              {expanded && (
                <View style={styles.searchBarContainerWrapper}>
                  <View style={[styles.searchBarContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.text }]}
                      placeholder="Search products..."
                      placeholderTextColor={theme.textSecondary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            hasProducts && searchQuery.length > 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No products match your search.</Text>
            ) : null
          }
          ListFooterComponent={
            !hasProducts ? (
              <View style={styles.noProductsContainer}>
                <Text style={[styles.noProductsText, { color: theme.textSecondary }]}>No products yet.</Text>
                {isOwner && (
                  <TouchableOpacity style={[styles.addProductBtnLarge, { backgroundColor: theme.accent }]} onPress={handleAddProduct}>
                    <Ionicons name="add-circle-outline" size={24} color="#fff" />
                    <Text style={styles.addProductBtnLargeText}>Add Your First Product</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          style={{ flex: 1 }}
        />

        {/* Bottom Navigation Bar */}
        {renderBottomNav()}
      </Animated.View>

      {/* Add Product swipe-up bottom sheet */}
      {addProductSheetVisible && (
        <>
          <Animated.View
            style={[
              styles.addProductBackdrop,
              { opacity: addProductBackdropOpacity },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.addProductBackdropTouch}
              activeOpacity={1}
              onPress={closeAddProductSheet}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.addProductSheet,
              {
                height: ADD_PRODUCT_SHEET_HEIGHT,
                backgroundColor: theme.background,
                transform: [{ translateY: addProductSheetTranslateY }],
              },
            ]}
          >
            <View
              style={[styles.addProductSheetHandleArea, { height: HANDLE_HEIGHT }]}
              {...addProductPanResponder.panHandlers}
            >
              <View style={[styles.addProductSheetHandleBar, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.addProductSheetContent}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Product</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDarkMode ? '#333' : '#f5f5f5', color: theme.text }]}
                placeholder="Product Name"
                placeholderTextColor={theme.textSecondary}
                value={newProduct.name}
                maxLength={10}
                onChangeText={text => setNewProduct(prev => ({ ...prev, name: text }))}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDarkMode ? '#333' : '#f5f5f5', color: theme.text }]}
                placeholder="Price (RWF)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={newProduct.price}
                onChangeText={handleProductPriceChange}
              />
              <View style={styles.modalImagePicker}>
                <Text style={[styles.modalImageLabel, { color: theme.text }]}>Image:</Text>
                <TouchableOpacity style={[styles.modalAddImageBtn, { borderColor: theme.border }]} onPress={pickProductImage}>
                  <Ionicons name="add" size={24} color={theme.accent} />
                  <Text style={{ color: theme.accent, marginLeft: 8 }}>Choose Image</Text>
                </TouchableOpacity>
              </View>
              {newProduct.images.length > 0 && (
                <View style={styles.modalImagePreviewList}>
                  {newProduct.images.map((img, idx) => (
                    <View key={idx} style={styles.modalImageWrapper}>
                      <Image source={{ uri: img.uri }} style={styles.modalImagePreview} />
                      <TouchableOpacity style={styles.modalRemoveImageBtn} onPress={() => removeProductImage(idx)}>
                        <Ionicons name="close-circle" size={20} color="#353535" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={closeAddProductSheet}
                >
                  <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSubmitBtn, { backgroundColor: theme.accent }]}
                  onPress={submitProduct}
                  disabled={uploadingProduct}
                >
                  {uploadingProduct ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Product</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {/* Confirm modal */}
      {renderConfirmModal()}
      {/* Status modal */}
      {renderStatusModal()}

    </View>
  );
}

// ----- STYLES -----
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backdropTouch: {
    flex: 1,
  },
  modalContainer: {
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  handleArea: {
    width: '100%',
    justifyContent: 'flex-end',
    paddingTop: 12,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  swipeIndicator: {
    marginTop: 6,
    marginBottom: 2,
  },
  swipeText: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },

  // ----- Sticky Header -----
  stickyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  stickyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyBackBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stickyHeaderInfo: {
    flex: 1,
  },
  stickyDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stickyShopName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  stickyMallName: {
    fontSize: 14,
    marginTop: 2,
  },
  stickyAddress: {
    fontSize: 14,
    marginTop: 2,
  },

  // ----- Scrollable Content (hidden when expanded) -----
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  coverPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  category: {
    fontSize: 16,
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  shopNumber: {
    fontSize: 14,
    marginBottom: 10,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  ownerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  ownerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ownerAvatarInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  ownerPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 6,
  },
  contactBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  // Action row – horizontal scroll
  actionRowScroll: {
    marginBottom: 16,
  },
  actionRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    marginRight: 8,
  },
  deleteShopBtn: {
    backgroundColor: '#353535',
  },
  actionBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },

  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  productGridTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addProductBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  addProductBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  addProductBtnLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  searchBarContainerWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },

  productGridContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productGridItem: {
    width: (width - 40) / 2,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productGridImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productGridInfo: {
    position: 'relative',
  },
  productGridName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  productGridPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  productDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noProductsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProductsText: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ----- Bottom Navigation Bar -----
  bottomNav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 35,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },

  // ----- Add Product swipe-up sheet -----
  addProductBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addProductBackdropTouch: {
    flex: 1,
  },
  addProductSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  addProductSheetHandleArea: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  addProductSheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  addProductSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  // ----- Modal styles (confirm / status) -----
  confirmModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmModalIconContainer: {
    marginBottom: 12,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmModalCancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  confirmModalYesButton: {
    borderWidth: 0,
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  modalImagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalImageLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  modalAddImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalImagePreviewList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  modalImageWrapper: {
    position: 'relative',
    marginRight: 6,
    marginBottom: 6,
  },
  modalImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  modalRemoveImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalSubmitBtn: {},
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
