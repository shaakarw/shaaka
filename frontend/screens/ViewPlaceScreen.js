// screens/ViewPlaceScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TextInput,
  SectionList,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth, useUserLimits } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import FullScreenImageViewer from '../components/FullScreenImageViewer';

const { height, width } = Dimensions.get('window');
const MODAL_HEIGHT_80 = height * 0.7;
const MODAL_HEIGHT_90 = height * 0.9;
const SWIPE_THRESHOLD = 60;
const HANDLE_HEIGHT = height * 0.05;
const ADD_PRODUCT_SHEET_HEIGHT = height * 0.45;

// ----- CATEGORIES (exactly as before) -----
const CATEGORIES = [
  { id: 'location', label: 'Location', icon: 'map-marker' },
  { id: 'shop', label: 'Shop', icon: 'store' },
  { id: 'restaurant', label: 'Restaurant', icon: 'silverware-fork-knife' },
  { id: 'coffee', label: 'Coffee', icon: 'coffee' },
  { id: 'fastfood', label: 'Fast Food', icon: 'hamburger' },
  { id: 'supermarket', label: 'Supermarket', icon: 'cart' },
  { id: 'shoppingmall', label: 'Shopping Mall', icon: 'shopping' },
  { id: 'hotel', label: 'Hotel', icon: 'bed' },
  { id: 'house', label: 'House', icon: 'home' },
  { id: 'office', label: 'Office', icon: 'office-building' },
  { id: 'church', label: 'Church', icon: 'church' },
  { id: 'mosque', label: 'Mosque', icon: 'mosque' },
  { id: 'temple', label: 'Temple', icon: 'hinduism' },
  { id: 'hospital', label: 'Hospital', icon: 'hospital' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'pharmacy' },
  { id: 'clinic', label: 'Clinic', icon: 'medical-bag' },
  { id: 'school', label: 'School', icon: 'school' },
  { id: 'university', label: 'University', icon: 'school-outline' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'bank', label: 'Bank', icon: 'bank' },
  { id: 'atm', label: 'ATM', icon: 'cash' },
  { id: 'fuel', label: 'Fuel Station', icon: 'gas-station' },
  { id: 'police', label: 'Police', icon: 'police-badge' },
  { id: 'fire', label: 'Fire Station', icon: 'fire-truck' },
  { id: 'airport', label: 'Airport', icon: 'airplane' },
  { id: 'bus', label: 'Bus Station', icon: 'bus' },
  { id: 'train', label: 'Train Station', icon: 'train' },
  { id: 'taxi', label: 'Taxi', icon: 'taxi' },
  { id: 'parking', label: 'Parking', icon: 'parking' },
  { id: 'park', label: 'Park', icon: 'tree' },
  { id: 'forest', label: 'Forest', icon: 'pine-tree' },
  { id: 'beach', label: 'Beach', icon: 'beach' },
  { id: 'stadium', label: 'Stadium', icon: 'stadium' },
  { id: 'gym', label: 'Gym', icon: 'dumbbell' },
  { id: 'cinema', label: 'Cinema', icon: 'movie' },
  { id: 'bar', label: 'Bar', icon: 'glass-mug' },
  { id: 'salon', label: 'Salon / Barber', icon: 'content-cut' },
  { id: 'veterinary', label: 'Veterinary', icon: 'dog' },
  { id: 'government', label: 'Government Office', icon: 'domain' },
  { id: 'factory', label: 'Factory', icon: 'factory' },
  { id: 'postoffice', label: 'Post Office', icon: 'email' },
  { id: 'water', label: 'Water Point', icon: 'water' },
  { id: 'power', label: 'Power Station', icon: 'transmission-tower' },
  { id: 'bridge', label: 'Bridge', icon: 'bridge' },
  { id: 'road', label: 'Road', icon: 'road' },
  { id: 'tourist', label: 'Tourist Attraction', icon: 'camera' },
  { id: 'camp', label: 'Camp', icon: 'tent' },
  { id: 'garage', label: 'Garage', icon: 'garage' },
  { id: 'bicycle', label: 'Bicycle Shop', icon: 'bike' },
  { id: 'motorcycle', label: 'Motorcycle Shop', icon: 'motorbike' },
  { id: 'cardealer', label: 'Car Dealer', icon: 'car' },
  { id: 'farm', label: 'Farm', icon: 'barn' },
  { id: 'fishmarket', label: 'Fish Market', icon: 'fish' },
  { id: 'agriculture', label: 'Agriculture', icon: 'sprout' },
  { id: 'electronics', label: 'Electronics', icon: 'laptop' },
  { id: 'other', label: 'Other', icon: 'dots-horizontal' },
];

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (angle) => (angle * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.mov') ||
    lower.includes('.webm') ||
    lower.includes('.m3u8') ||
    lower.includes('video/') ||
    (lower.includes('cloudinary.com') && lower.includes('/video/'))
  );
};

const getPrimaryMedia = ({ imageUrl, videoUrl }) => {
  if (isVideoUrl(videoUrl)) {
    return { type: 'video', url: videoUrl };
  }
  if (isVideoUrl(imageUrl)) {
    return { type: 'video', url: imageUrl };
  }
  return { type: 'image', url: imageUrl || videoUrl || null };
};

// ----- Helper: get token -----
const getToken = async () => {
  let token = await AsyncStorage.getItem('userToken');
  if (!token) token = await AsyncStorage.getItem('adminToken');
  return token;
};

// ----- Helper: toggle favorite (place) -----
const toggleFavoritePlace = async (placeId) => {
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const favoritesJson = await AsyncStorage.getItem('favorites');
    let favs = favoritesJson ? JSON.parse(favoritesJson) : [];
    const isCurrentlyFav = favs.includes(placeId);

    const method = isCurrentlyFav ? 'DELETE' : 'POST';
    const url = `${BASE_URL}/api/favorites/places`;

    const response = await axios({
      method,
      url,
      data: { placeId },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success) {
      const newFavs = response.data.favorites.map((p) => p._id || p.id);
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavs));
      return !isCurrentlyFav;
    } else {
      throw new Error(response.data.message || 'Failed to toggle favorite');
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    throw error;
  }
};

export default function ViewPlaceScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { refreshUser } = useAuth();
  const adminLimits = useUserLimits();
  const { place, pendingShopId } = route.params || {};

  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ownerData, setOwnerData] = useState(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // ----- Shopping Mall specific state -----
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [refreshingShops, setRefreshingShops] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [redirectingToShop, setRedirectingToShop] = useState(false);
  const isMall =
    place?.category === 'shoppingmall' || place?.category === 'shopping_mall';

  // ----- Add product swipe‑up sheet state -----
  const [addProductSheetVisible, setAddProductSheetVisible] = useState(false);
  const addProductSheetTranslateY = useRef(
    new Animated.Value(ADD_PRODUCT_SHEET_HEIGHT)
  ).current;
  const addProductBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [productImages, setProductImages] = useState([]); // multiple images
  const [newProduct, setNewProduct] = useState({ name: '', price: '' }); // no description
  const [submittingProduct, setSubmittingProduct] = useState(false);

  useEffect(() => {
    if (pendingShopId) {
      setRedirectingToShop(true);
      const timer = setTimeout(() => {
        navigation.navigate('ViewShop', { shopId: pendingShopId });
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [pendingShopId, navigation]);

  // ----- Product search state -----
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const filteredProducts = useMemo(() => {
    if (!place?.products) return [];
    if (!productSearchQuery.trim()) return place.products;
    const lowerQuery = productSearchQuery.toLowerCase().trim();
    return place.products.filter(
      (p) =>
        p.name?.toLowerCase().includes(lowerQuery) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  }, [place?.products, productSearchQuery]);

  // ----- Filtered shops -----
  const filteredShops = useMemo(() => {
    if (!shopSearchQuery.trim()) return shops;
    const lowerQuery = shopSearchQuery.toLowerCase().trim();
    return shops.filter((shop) => {
      const shopOwner = shop.owner || shop.ownerId || shop.userId;
      const ownerName = shopOwner?.name || shopOwner?.username || '';
      return (
        shop.name?.toLowerCase().includes(lowerQuery) ||
        shop.category?.toLowerCase().includes(lowerQuery) ||
        ownerName.toLowerCase().includes(lowerQuery)
      );
    });
  }, [shops, shopSearchQuery]);

  const modalHeight = useRef(new Animated.Value(MODAL_HEIGHT_80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (place?.products?.length > 0 && !expanded) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [place, expanded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dy) > 5,
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

  // ---- Add Product sheet PanResponder ----
  const addProductPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gs) =>
        Math.abs(gs.dy) > 8 && gs.dy > 0,
      onPanResponderMove: (evt, gs) => {
        if (gs.dy > 0) addProductSheetTranslateY.setValue(gs.dy);
      },
      onPanResponderRelease: (evt, gs) => {
        if (gs.dy > SWIPE_THRESHOLD) {
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

  const backdropHeight = modalHeight.interpolate({
    inputRange: [0, MODAL_HEIGHT_90],
    outputRange: [height, height - MODAL_HEIGHT_90],
    extrapolate: 'clamp',
  });

  // ---- Sheet open/close helpers ----
  const openAddProductSheet = () => {
    setNewProduct({ name: '', price: '' });
    setProductImages([]);
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
    ]).start(() => setAddProductSheetVisible(false));
  };

  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setCurrentUser(null);
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response?.data?.user || response?.data;
      setCurrentUser(data && (data._id || data.id) ? data : null);
    } catch (e) {
      console.warn('Fetch logged-in user profile failed:', e);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchOwner = async (userId) => {
    if (!userId) return;
    setLoadingOwner(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadingOwner(false);
        setOwnerData({ _id: userId, name: 'User', username: 'user', phone: 'N/A' });
        return;
      }

      let response = null;
      try {
        response = await axios.get(`${BASE_URL}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (primaryError) {
        try {
          response = await axios.get(`${BASE_URL}/api/user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (secondaryError) {
          console.warn('Owner fetch failed, using fallback');
          setOwnerData({
            _id: userId,
            name: 'User',
            username: 'user',
            phone: 'N/A',
          });
          setLoadingOwner(false);
          return;
        }
      }

      let userData = null;
      if (response && response.data) {
        if (response.data.user) userData = response.data.user;
        else if (response.data.success && response.data.user)
          userData = response.data.user;
        else if (response.data._id) userData = response.data;
      }

      setOwnerData(
        userData || { _id: userId, name: 'User', username: 'user', phone: 'N/A' }
      );
    } catch (error) {
      console.error('Fetch owner error:', error);
      setOwnerData({ _id: userId, name: 'User', username: 'user', phone: 'N/A' });
    } finally {
      setLoadingOwner(false);
    }
  };

  const fetchShops = async (refresh = false) => {
    if (!isMall || !place?.id) return;
    if (refresh) setRefreshingShops(true);
    else setLoadingShops(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadingShops(false);
        setRefreshingShops(false);
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/mall-shops`, {
        params: { mallId: place.id },
        headers: { Authorization: `Bearer ${token}` },
      });
      setShops(
        response.data && response.data.shops ? response.data.shops : []
      );
    } catch (error) {
      console.error('Error fetching mall shops:', error);
      setShops([]);
    } finally {
      setLoadingShops(false);
      setRefreshingShops(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isMall) {
        fetchShops();
      }
    }, [isMall, place?.id])
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setUserLocation(loc.coords);
        if (place && place.lat && place.lon) {
          const dist = haversineDistance(
            loc.coords.latitude,
            loc.coords.longitude,
            place.lat,
            place.lon
          );
          setDistance(dist);
        }
      }
    })();
  }, []);

  const loadFavoriteStatus = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favorites');
      if (favorites) {
        const favs = JSON.parse(favorites);
        setIsFavorite(favs.includes(place?.id));
      } else {
        setIsFavorite(false);
      }
    } catch (e) {
      setIsFavorite(false);
    }
  };

  useEffect(() => {
    loadFavoriteStatus();
  }, [place]);

  useEffect(() => {
    if (place?.userId) {
      fetchOwner(place.userId);
    }
  }, [place]);

  const isOwner = Boolean(
    currentUser &&
      place?.userId &&
      String(place.userId) === String(currentUser._id || currentUser.id)
  );

  const checkUserHasNormalPlace = async () => {
    if (!currentUser?._id && !currentUser?.id) return false;
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return false;
      const res = await axios.get(`${BASE_URL}/api/places`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allPlaces = res.data.places || [];
      return allPlaces.some(p => String(p.userId) === String(currentUser._id || currentUser.id));
    } catch (e) {
      return false;
    }
  };

  const handleAddMallShop = async () => {
    const hasPlace = await checkUserHasNormalPlace();
    if (hasPlace) {
      Alert.alert('Limit Reached', 'You already have a Shop/Place. You cannot add a Shopping Mall Shop.');
      return;
    }
    navigation.navigate('AddShoppingMallShop', { mall: place });
  };

  if (!place) {
    return (
      <View style={[styles.outerContainer, { backgroundColor: 'transparent' }]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.background,
              height: MODAL_HEIGHT_80,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Text style={{ color: theme.text }}>Place not found</Text>
        </View>
      </View>
    );
  }

  const cat = CATEGORIES.find((c) => c.id === place.category);
  const iconName = cat ? cat.icon : 'map-marker';
  const categoryLabel = cat ? cat.label : 'Location';

  const handleDirections = async () => {
    try {
      await AsyncStorage.setItem('pendingRoute', JSON.stringify(place));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not set route. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      const message = `📍 ${place.name}\n${place.address || ''}\nCategory: ${categoryLabel}`;
      await Share.share({ message });
    } catch (e) {
      Alert.alert('Error', 'Could not share place.');
    }
  };

  const handleFavorite = async () => {
    try {
      const newState = await toggleFavoritePlace(place.id);
      setIsFavorite(newState);
      await loadFavoriteStatus();
    } catch (error) {
      Alert.alert('Error', 'Could not update favorite. Please try again.');
    }
  };

  const handleReport = () => {
    Alert.alert(
      'Report Place',
      'Do you want to report this place for inappropriate content or incorrect information?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Thank you', 'Your report has been submitted.'),
        },
      ]
    );
  };

  const openLink = (url) => {
    if (!url) return;
    if (url.startsWith('whatsapp://')) {
      return openSocialLink(
        url,
        `https://wa.me/${url.replace(/[^0-9+]/g, '')}`
      );
    }
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    Linking.openURL(formattedUrl).catch(() =>
      Alert.alert('Error', 'Could not open link.')
    );
  };

  const openSocialLink = async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        Alert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        Alert.alert('Error', 'Unable to open link');
      }
    }
  };

  const getAllImages = () => {
    const images = [];
    const streetImage =
      place.images?.street ||
      place.images?.streetImage ||
      place.images?.images?.street;
    if (streetImage) {
      images.push(streetImage);
    }
    if (place.products && Array.isArray(place.products)) {
      place.products.forEach((product) => {
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img) => images.push(img));
        }
      });
    }
    return images;
  };

  const openCarousel = (startIndex = 0) => {
    const allImages = getAllImages();
    if (allImages.length === 0) return;
    setCarouselImages(allImages);
    setCarouselIndex(Math.min(startIndex, allImages.length - 1));
    setCarouselVisible(true);
  };

  const closeCarousel = () => {
    setCarouselVisible(false);
    setCarouselImages([]);
    setCarouselIndex(0);
  };

  const downloadCarouselImage = async (imageUrl) => {
    try {
      if (!imageUrl || typeof imageUrl !== 'string') {
        Alert.alert('Error', 'No image URL available');
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to photos to save images.');
        return;
      }

      const url = new URL(imageUrl);
      const filenameFromUrl = url.pathname.split('/').pop() || 'shaaka-image.jpg';
      const extension = filenameFromUrl.includes('.') ? filenameFromUrl.split('.').pop() : 'jpg';
      const filename = `${Date.now()}_${filenameFromUrl.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'shaaka_image'}.${extension}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (downloadResult.status !== 200 || !downloadResult.uri) {
        throw new Error('Download failed');
      }

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      const albumName = 'Shaaka';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album.id, false);
      }

      Alert.alert('Success', 'Image downloaded successfully.');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download image. Please try again.');
    }
  };

  const renderCarouselItem = ({ item }) => {
    const media = getPrimaryMedia({ imageUrl: item, videoUrl: item });
    if (media?.type === 'video') {
      return (
        <View
          style={{
            width: width,
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Video
            source={{ uri: media.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
            shouldPlay
            isMuted
            isLooping
            useNativeControls={false}
          />
        </View>
      );
    }

    return (
      <View
        style={{
          width: width,
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image
          source={{ uri: item }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
        />
      </View>
    );
  };

  const renderContactButton = (icon, label, value, onPress) => {
    if (!value) return null;
    return (
      <TouchableOpacity
        style={[styles.contactBtn, { backgroundColor: theme.accent }]}
        onPress={onPress}
      >
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.contactBtnText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  // ---------- Pick multiple product images ----------
  const pickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to choose images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newImgs = result.assets.map((asset) => ({
        uri: asset.uri,
        type: 'image/jpeg',
        name: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
      }));
      setProductImages((prev) => [...prev, ...newImgs]);
    }
  };

  const removeProductImage = (index) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- Submit product (no description) ----------
  const submitProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) {
      Alert.alert('Missing fields', 'Product name and price are required.');
      return;
    }
    if (productImages.length === 0) {
      Alert.alert('Missing', 'Please add at least one product image.');
      return;
    }

    setSubmittingProduct(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Upload all images
      const uploadedUrls = [];
      for (const img of productImages) {
        const formData = new FormData();
        formData.append('image', {
          uri: img.uri,
          type: img.type,
          name: img.name,
        });
        const uploadRes = await axios.post(
          `${BASE_URL}/api/places/upload`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (uploadRes.data.success) {
          uploadedUrls.push(uploadRes.data.url);
        } else {
          throw new Error('Image upload failed');
        }
      }

      const response = await axios.post(
        `${BASE_URL}/api/places/${place._id || place.id}/products`,
        {
          name: newProduct.name.trim(),
          price: Number(newProduct.price),
          images: uploadedUrls, // description removed
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Product added to the place.');
        closeAddProductSheet();
      } else {
        throw new Error(response.data.message || 'Product add failed');
      }
    } catch (error) {
      console.error('Product add error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Could not add product.'
      );
    } finally {
      setSubmittingProduct(false);
    }
  };

  // ----- Render product grid item (for SectionList) -----
  const renderProductItem = ({ item }) => {
    const firstImage =
      item.images && item.images.length > 0 ? item.images[0] : null;
    const productIndex = place.products.indexOf(item);
    let startIndex = place.images?.street ? 1 : 0;
    for (let i = 0; i < productIndex; i++) {
      if (place.products[i].images) {
        startIndex += place.products[i].images.length;
      }
    }

    return (
      <View
        style={[
          styles.productGridItem,
          { backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openCarousel(startIndex)}
        >
          {firstImage ? (
            <Image
              source={{ uri: firstImage }}
              style={styles.productGridImage}
            />
          ) : (
            <View
              style={[
                styles.productGridImage,
                styles.productImagePlaceholder,
                { backgroundColor: theme.border },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={40}
                color={theme.textSecondary}
              />
            </View>
          )}
        </TouchableOpacity>
        <Text
          style={[styles.productGridName, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.productGridPrice, { color: theme.accent }]}>
          {parseFloat(item.price).toLocaleString()} RWF
        </Text>
        {item.description && (
          <Text
            style={[styles.productGridDesc, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}
      </View>
    );
  };

  // ----- Render shop card -----
  const renderShopItem = ({ item }) => {
    const shopOwner = item.owner || item.ownerId || item.userId;
    const ownerName = shopOwner?.name || shopOwner?.username || 'Unknown';
    const shopImage =
      item.images?.frontImage || item.images?.front || item.logo || null;
    const doorNumber = item.shopNumber || '';
    const floor = item.floorNumber ? `, Floor ${item.floorNumber}` : '';
    const ownerAvatar = shopOwner?.avatar || shopOwner?.userAvatar || null;
    const initials =
      ownerName !== 'Unknown' ? ownerName.charAt(0).toUpperCase() : '?';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ViewShop', { shopId: item._id })}
        style={[
          styles.shopCard,
          { backgroundColor: isDarkMode ? '#333' : '#f8f8f8' },
        ]}
      >
        <View style={styles.shopCardTop}>
          <View style={styles.shopCardLeft}>
            {shopImage ? (
              <Image source={{ uri: shopImage }} style={styles.shopLogo} />
            ) : (
              <View
                style={[
                  styles.shopLogoPlaceholder,
                  { backgroundColor: theme.border },
                ]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={24}
                  color={theme.textSecondary}
                />
              </View>
            )}
            <View style={styles.shopCardInfo}>
              <Text
                style={[styles.shopName, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {doorNumber ? (
                <Text
                  style={[
                    styles.shopDoorNumber,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Door #{doorNumber}
                  {floor}
                </Text>
              ) : null}
              <View style={styles.categoryBadgeContainer}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: isDarkMode ? '#444' : '#e0e0e0' },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      { color: isDarkMode ? '#fff' : '#333' },
                    ]}
                  >
                    {item.category || 'General'}
                  </Text>
                </View>
              </View>
              <View style={styles.shopOwnerRow}>
                {ownerAvatar ? (
                  <Image
                    source={{ uri: ownerAvatar }}
                    style={styles.shopOwnerAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.shopOwnerAvatarPlaceholder,
                      { backgroundColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.shopOwnerAvatarInitials,
                        { color: theme.text },
                      ]}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.shopOwnerName,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Owner: {ownerName}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.shopCardStats}>
            <Ionicons
              name="arrow-forward-circle"
              size={22}
              color={theme.textSecondary}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ----- Owner section (reused) -----
  const renderOwner = () => {
    if (!place.userId) return null;
    if (loadingOwner) {
      return (
        <View style={styles.ownerSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Owner</Text>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      );
    }
    if (!ownerData) {
      return (
        <View style={styles.ownerSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Owner</Text>
          <Text style={{ color: theme.textSecondary }}>
            Owner information unavailable
          </Text>
        </View>
      );
    }

    const initials = ownerData.username?.charAt(0).toUpperCase() || '?';
    const displayName = ownerData.name || ownerData.username || 'User';
    const ownerPhone = ownerData.phone || 'N/A';
    const ownerId = ownerData._id;

    return (
      <View style={styles.ownerSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Owner</Text>
        <TouchableOpacity
          style={[
            styles.ownerCard,
            {
              backgroundColor: theme.cardBackground || theme.background,
              borderColor: theme.border,
            },
          ]}
          onPress={() =>
            navigation.navigate('Profile', {
              userId: ownerId,
              username: ownerData.username,
            })
          }
          activeOpacity={0.7}
          disabled={!ownerId}
        >
          {ownerData.avatar || ownerData.userAvatar ? (
            <Image
              source={{ uri: ownerData.avatar || ownerData.userAvatar }}
              style={styles.ownerAvatar}
            />
          ) : (
            <View
              style={[
                styles.ownerAvatarPlaceholder,
                { backgroundColor: theme.border },
              ]}
            >
              <Text
                style={[styles.ownerAvatarInitials, { color: theme.text }]}
              >
                {initials}
              </Text>
            </View>
          )}
          <View style={styles.ownerInfo}>
            <Text style={[styles.ownerName, { color: theme.text }]}>
              {displayName}
            </Text>
            {!isOwner && (
              <Text
                style={[styles.ownerPhone, { color: theme.textSecondary }]}
              >
                {ownerPhone}
              </Text>
            )}
          </View>
          {ownerId && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ----- Build sections for SectionList -----
  const sections = useMemo(() => {
    const result = [];

    if (place.products && place.products.length > 0) {
      result.push({
        title: 'Products',
        data: filteredProducts,
        renderItem: renderProductItem,
        key: 'products',
        numColumns: 2,
        columnWrapperStyle: styles.productRow,
      });
    }

    if (isMall && filteredShops.length > 0) {
      result.push({
        title: 'Shops Inside This Mall',
        data: filteredShops,
        renderItem: renderShopItem,
        key: 'shops',
      });
    }

    return result;
  }, [filteredProducts, filteredShops, isMall, place.products]);

  const renderSectionHeader = ({ section }) => {
    if (section.key === 'products') {
      return (
        <View style={styles.sectionHeaderWrapper}>
          <Text
            style={[styles.sectionTitle, { color: theme.text, marginTop: 12 }]}
          >
            Products
          </Text>
          <View
            style={[
              styles.productSearchContainer,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={theme.textSecondary}
              style={styles.productSearchIcon}
            />
            <TextInput
              style={[styles.productSearchInput, { color: theme.text }]}
              placeholder="Search products..."
              placeholderTextColor={theme.textSecondary}
              value={productSearchQuery}
              onChangeText={setProductSearchQuery}
            />
            {productSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setProductSearchQuery('')}
                style={styles.productSearchClear}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
    if (section.key === 'shops') {
      return (
        <View style={styles.sectionHeaderWrapper}>
          <View style={styles.shopSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Shops Inside This Mall
            </Text>
            <TouchableOpacity
              style={[styles.addShopButton, { backgroundColor: theme.accent }]}
              onPress={handleAddMallShop}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addShopButtonText}>Add Your Shop</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  };

  const renderStickyHeader = () => (
    <View
      style={[styles.stickyHeader, { backgroundColor: theme.background }]}
    >
      <View style={styles.titleRow}>
        <MaterialCommunityIcons
          name={iconName}
          size={24}
          color={theme.accent}
        />
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {place.name}
        </Text>
      </View>
      {distance !== null && (
        <Text
          style={[
            styles.distance,
            { color: theme.textSecondary, marginBottom: 4 },
          ]}
        >
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.textSecondary}
          />{' '}
          {distance < 1
            ? `${(distance * 1000).toFixed(0)} m`
            : `${distance.toFixed(1)} km`}{' '}
          away
        </Text>
      )}
      {isMall && expanded && (
        <View
          style={[
            styles.shopSearchContainer,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              marginVertical: 0,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.textSecondary}
            style={styles.shopSearchIcon}
          />
          <TextInput
            style={[styles.shopSearchInput, { color: theme.text }]}
            placeholder="Search shops inside this mall..."
            placeholderTextColor={theme.textSecondary}
            value={shopSearchQuery}
            onChangeText={setShopSearchQuery}
          />
          {shopSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setShopSearchQuery('')}
              style={styles.shopSearchClear}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderBottomNav = () => (
    <View style={[styles.bottomNav, { backgroundColor: theme.background }]} />
  );

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
            <View
              style={[styles.handleBar, { backgroundColor: theme.border }]}
            />
            {place?.products?.length > 0 && !expanded && (
              <Animated.View
                style={[
                  styles.swipeIndicator,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={[styles.swipeText, { color: theme.text }]}>
                  Swipe up to see products
                </Text>
              </Animated.View>
            )}
            {isMall && !expanded && (
              <Animated.View
                style={[
                  styles.swipeIndicator,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={[styles.swipeText, { color: theme.text }]}>
                  Swipe up to browse shops
                </Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Sticky Header (place name, distance, shop search – only when expanded) */}
        {renderStickyHeader()}

        {redirectingToShop && (
          <View
            style={[
              styles.pendingRedirectBanner,
              { backgroundColor: theme.accent },
            ]}
          >
            <Text style={[styles.pendingRedirectText, { color: '#fff' }]}>
              Opening shop details...
            </Text>
          </View>
        )}

        {/* Main scrollable content (SectionList) */}
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item._id || item.id || index}`}
          renderItem={({ section, item }) => {
            if (section.key === 'products') {
              return renderProductItem({ item });
            }
            if (section.key === 'shops') {
              return renderShopItem({ item });
            }
            return null;
          }}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={() => (
            <View style={styles.content}>
              {!expanded && (
                <>
                  {(() => {
                    const streetImage =
                      place.images?.street ||
                      place.images?.streetImage ||
                      null;
                    return streetImage ? (
                      <TouchableOpacity
                        onPress={() => openCarousel(0)}
                        activeOpacity={0.9}
                        style={{ marginBottom: 8 }}
                      >
                        {getPrimaryMedia({
                          imageUrl: streetImage,
                          videoUrl: streetImage,
                        }).type === 'video' ? (
                          <Video
                            source={{ uri: streetImage }}
                            style={styles.headerImage}
                            resizeMode="cover"
                            shouldPlay
                            isMuted
                            isLooping
                            useNativeControls={false}
                          />
                        ) : (
                          <Image
                            source={{ uri: streetImage }}
                            style={styles.headerImage}
                          />
                        )}
                      </TouchableOpacity>
                    ) : null;
                  })()}

                  <Text
                    style={[styles.category, { color: theme.textSecondary }]}
                  >
                    {categoryLabel}
                  </Text>

                  {place.address && (
                    <Text style={[styles.address, { color: theme.text }]}>
                      <Ionicons
                        name="location-sharp"
                        size={16}
                        color={theme.textSecondary}
                      />{' '}
                      {place.address}
                    </Text>
                  )}

                  {place.description && (
                    <Text
                      style={[styles.description, { color: theme.text }]}
                    >
                      {place.description}
                    </Text>
                  )}

                  {(place.openingTime || place.closingTime) && (
                    <View style={styles.hoursRow}>
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={theme.textSecondary}
                      />
                      <Text style={[styles.hoursText, { color: theme.text }]}>
                        {place.openingTime}{' '}
                        {place.closingTime ? `- ${place.closingTime}` : ''}
                      </Text>
                    </View>
                  )}

                  <View style={styles.contactRow}>
                    {renderContactButton(
                      'call',
                      'Call',
                      place.phone,
                      () => openLink(`tel:${place.phone}`)
                    )}
                    {renderContactButton(
                      'logo-whatsapp',
                      'WhatsApp',
                      place.whatsapp,
                      () => {
                        const num = place.whatsapp.startsWith('+')
                          ? place.whatsapp
                          : `+250${place.whatsapp}`;
                        openLink(`whatsapp://send?phone=${num}`);
                      }
                    )}
                    {renderContactButton(
                      'mail',
                      'Email',
                      place.email,
                      () => openLink(`mailto:${place.email}`)
                    )}
                    {renderContactButton(
                      'globe',
                      'Website',
                      place.website,
                      () => openLink(place.website)
                    )}
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: theme.accent },
                      ]}
                      onPress={handleDirections}
                    >
                      <Ionicons name="navigate" size={22} color="#fff" />
                      <Text style={styles.actionBtnText}>Directions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: theme.border },
                      ]}
                      onPress={handleShare}
                    >
                      <Ionicons
                        name="share-social"
                        size={22}
                        color={theme.text}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: theme.text },
                        ]}
                      >
                        Share
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: theme.border },
                      ]}
                      onPress={handleFavorite}
                    >
                      <Ionicons
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={22}
                        color={isFavorite ? '#353535' : theme.text}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: theme.text },
                        ]}
                      >
                        {isFavorite ? 'Saved' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: theme.border },
                      ]}
                      onPress={handleReport}
                    >
                      <Ionicons
                        name="flag-outline"
                        size={22}
                        color={theme.text}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: theme.text },
                        ]}
                      >
                        Report
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* "Add Your Shop" big button for malls */}
                  {isMall && (
                    <TouchableOpacity
                      style={[
                        styles.addShopBigButton,
                        { backgroundColor: theme.accent },
                      ]}
                      onPress={handleAddMallShop}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={24}
                        color="#fff"
                      />
                      <Text style={styles.addShopBigText}>Add Your Shop</Text>
                    </TouchableOpacity>
                  )}

                  {/* Amenities */}
                  {place.extras &&
                    Object.keys(place.extras).filter(
                      (k) => place.extras[k]
                    ).length > 0 && (
                      <View style={styles.section}>
                        <Text
                          style={[
                            styles.sectionTitle,
                            { color: theme.text },
                          ]}
                        >
                          Amenities
                        </Text>
                        <View style={styles.extrasRow}>
                          {Object.keys(place.extras)
                            .filter((k) => place.extras[k])
                            .map((key, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.extraTag,
                                  { backgroundColor: theme.border },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.extraTagText,
                                    { color: theme.text },
                                  ]}
                                >
                                  {key.charAt(0).toUpperCase() + key.slice(1)}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    )}

                  {isOwner && (
                   <TouchableOpacity
      style={[styles.addProductBtn, { backgroundColor: theme.accent }]}
      onPress={openAddProductSheet}>
      <Ionicons name="add-circle-outline" size={18} color="#fff" />
      <Text style={styles.addProductBtnText}>Add</Text>
    </TouchableOpacity>
                  )}

                  {renderOwner()}
                </>
              )}
            </View>
          )}
          contentContainerStyle={[
            styles.sectionListContent,
            { paddingTop: 8 },
          ]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            isMall ? (
              <RefreshControl
                refreshing={refreshingShops}
                onRefresh={() => fetchShops(true)}
                tintColor={theme.accent}
              />
            ) : undefined
          }
        />

        {/* Bottom Navigation Bar */}
        {renderBottomNav()}
      </Animated.View>

      {/* ============ Add Product Swipe‑Up Sheet ============ */}
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
      borderTopWidth: 2,
      borderTopColor: theme.text,
      transform: [{ translateY: addProductSheetTranslateY }],
    },
            ]}
          >
            <View
              style={[
                styles.addProductSheetHandleArea,
                { height: HANDLE_HEIGHT },
              ]}
              {...addProductPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.addProductSheetHandleBar,
                  { backgroundColor: theme.border },
                ]}
              />
            </View>

            <View style={styles.addProductSheetContent}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Add Product
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
                    color: theme.text,
                  },
                ]}
                placeholder="Product Name"
                placeholderTextColor={theme.textSecondary}
                value={newProduct.name}
                onChangeText={(text) =>
                  setNewProduct((prev) => ({ ...prev, name: text }))
                }
              />
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
                    color: theme.text,
                  },
                ]}
                placeholder="Price (RWF)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={newProduct.price}
                onChangeText={(text) =>
                  setNewProduct((prev) => ({ ...prev, price: text }))
                }
              />

              <View style={styles.modalImagePicker}>
                <Text style={[styles.modalImageLabel, { color: theme.text }]}>
                  Images:
                </Text>
                <TouchableOpacity
                  style={[
                    styles.modalAddImageBtn,
                    { borderColor: theme.border },
                  ]}
                  onPress={pickProductImage}
                >
                  <Ionicons name="add" size={24} color={theme.accent} />
                  <Text style={{ color: theme.accent, marginLeft: 8 }}>
                    Add Images
                  </Text>
                </TouchableOpacity>
              </View>

              {productImages.length > 0 && (
                <View style={styles.modalImagePreviewList}>
                  {productImages.map((img, idx) => (
                    <View key={idx} style={styles.modalImageWrapper}>
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.modalImagePreview}
                      />
                      <TouchableOpacity
                        style={styles.modalRemoveImageBtn}
                        onPress={() => removeProductImage(idx)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#353535"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalCancelBtn,
                    { borderColor: theme.border },
                  ]}
                  onPress={closeAddProductSheet}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalSubmitBtn,
                    { backgroundColor: theme.accent },
                  ]}
                  onPress={submitProduct}
                  disabled={submittingProduct}
                >
                  {submittingProduct ? (
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

      {/* ----- CAROUSEL MODAL ----- */}
      <Modal
        visible={carouselVisible}
        transparent
        onRequestClose={closeCarousel}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.carouselBackdrop}
          activeOpacity={1}
          onPress={closeCarousel}
        />
        <View style={styles.carouselOverlayContainer}>
          <SafeAreaView style={styles.carouselOverlay}>
            <FlatList
              data={carouselImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={renderCarouselItem}
              initialScrollIndex={carouselIndex}
              getItemLayout={(data, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onScrollToIndexFailed={() => {}}
              style={{ width, height: '100%' }}
              contentContainerStyle={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onScroll={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                setCarouselIndex(Math.round(offsetX / width));
              }}
              scrollEventThrottle={200}
            />
            <TouchableOpacity
              style={styles.carouselClose}
              onPress={closeCarousel}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.carouselCounter}>
              {carouselIndex + 1} / {carouselImages.length}
            </Text>
            <TouchableOpacity
              style={styles.carouselDownload}
              onPress={() => downloadCarouselImage(carouselImages[carouselIndex])}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
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
  productHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  marginTop: 12,
},
productGridTitle: {
  fontSize: 18,
  fontWeight: '600',
},
addProductBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 22,
  width:'40%',
  paddingVertical: 6,
  borderRadius: 20,
},
addProductBtnText: {
  color: '#fff',
  fontSize: 23,
  fontWeight: '600',
  marginLeft: 4,
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
    paddingTop: 2,
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
    marginTop: 0,
    marginBottom: 3,
  },
  swipeText: {
    fontSize: 12,
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

  // ----- Scrollable Content -----
  sectionListContent: {
    paddingBottom: 12,
  },
  headerImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    borderRadius: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  category: {
    fontSize: 15,
    marginBottom: 6,
  },
  distance: {
    fontSize: 13,
    marginBottom: 4,
  },
  address: {
    fontSize: 15,
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  hoursText: {
    fontSize: 15,
    marginLeft: 6,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 2,
    marginBottom: 0,
  },
  contactBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 13,
    marginRight: 8,
    marginBottom: 8,
  },
  actionBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 0,
  },
  sectionHeaderWrapper: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  productSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    height: 46,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productSearchIcon: {
    marginRight: 8,
  },
  productSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  productSearchClear: {
    padding: 4,
    marginLeft: 4,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productGridItem: {
    width: (width - 48) / 2,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 8,
    marginBottom: 8,
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
  productGridDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  extrasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  extraTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  extraTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ownerSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
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
    fontSize: 20,
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
  carouselBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  carouselOverlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselOverlay: {
    width: '100%',
    height: height * 0.8,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  carouselClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  carouselCounter: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  carouselDownload: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addShopButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  addShopBigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  addShopBigText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  shopSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    height: 46,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shopSearchIcon: {
    marginRight: 8,
  },
  shopSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  shopSearchClear: {
    padding: 4,
    marginLeft: 4,
  },
  shopCard: {
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  shopCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shopCardLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  shopLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  shopLogoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  shopCardInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
  },
  shopDoorNumber: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  shopCategory: {
    fontSize: 13,
  },
  shopOwner: {
    fontSize: 12,
  },
  shopAddress: {
    fontSize: 12,
  },
  shopCardStats: {
    alignItems: 'flex-end',
  },
  categoryBadgeContainer: {
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  shopOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  shopOwnerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  shopOwnerAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  shopOwnerAvatarInitials: {
    fontSize: 11,
    fontWeight: '700',
  },
  shopOwnerName: {
    fontSize: 13,
    fontWeight: '500',
  },
  pendingRedirectBanner: {
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  pendingRedirectText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ----- Bottom Navigation Bar -----
  bottomNav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 35,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },

  // ----- Add Product Swipe‑Up Sheet -----
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