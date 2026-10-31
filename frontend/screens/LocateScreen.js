// screens/LocateScreen.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import Compass from '../components/Compass';
import { networkStatus } from '../services/networkStatus';
import { mapOfflineCache } from '../services/mapOfflineCache';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import ScreenTutorialOverlay from '../components/ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';
import { getAddressText } from '../utils/address';

const { height, width: SCREEN_WIDTH } = Dimensions.get('window');
const EXPANDED_SEARCH_WIDTH = SCREEN_WIDTH * 0.7;

// ---- Tutorial config ---------------------------------------------------------
const LOCATE_TUTORIAL_DELAY_MS = 900;

const travelSpeeds = {
  walking: 3.6,
  bicycle: 12,
  motorcycle: 45.47,
  car: 63,
};

const modeIcons = {
  walking: 'walk-outline',
  bicycle: 'bicycle-outline',
  motorcycle: 'car-sport-outline',
  car: 'car-outline',
};

// ----- CATEGORIES -----
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

const getAddressString = (place) => {
  return getAddressText(place?.address, 'No address');
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (angle) => (angle * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function LocateScreen({ navigation, route, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const translations = {
    English: {
      loading: 'Getting things ready…',
      searchPlaceholder: 'Search places, shops...',
      noResultsTitle: 'No Results',
      noResultsMessage: 'Please enter a place name.',
      matchingResults: 'Matching Results',
      nearbyShops: 'Nearby Shops',
      noResultsFound: 'No results found',
      errorTitle: 'Error',
      noCoordinates: 'This place has no valid coordinates.',
      myShops: 'My Shops',
      noShopsYet: "You haven't added any shops yet.",
      addFirstShop: 'Add Your First Shop',
      savedPlaces: 'Saved Places & Shops',
      noSavedPlaces: "You haven't saved any places or shops yet.",
      savedPlacesHint: 'Tap the ❤️ on a place or shop to save it.',
      deleteShop: 'Delete Shop',
      deleteConfirm: 'Are you sure you want to delete this place?',
      deleteMallShopConfirm: 'Are you sure you want to delete this shop from the mall?',
      deleteCancel: 'Cancel',
      deleteOk: 'Delete',
      deleteError: 'Error',
      deleteFailed: 'Could not delete place.',
      permissionDenied: 'Permission Denied',
      locationAccessRequired: 'Location access required for directions.',
      servicesDisabled: 'Location Services Disabled',
      enableGPS: 'Please enable GPS to get directions.',
      locationError: 'Location Error',
      locationFailed: 'Could not get your location.',
      loginRequired: 'Login Required',
      loginMessage: 'You need to be logged in to perform this action.',
      login: 'Login',
      cancel: 'Cancel',
      walk: 'Walk',
      bike: 'Bike',
      moto: 'Moto',
      car: 'Car',
      km: 'km',
      min: 'min',
      noPlacesFound: 'No places found in Rwanda for: ',
      geocodingFailed: 'Geocoding failed.',
      shopsInMalls: 'Shops inside Malls',
      online: 'ONLINE',
      offline: 'OFFLINE',
      offlineMap: 'Offline map - showing saved map data',
      offlineSearch: 'Internet connection required to search for new places.',
      offlineRoute: 'Internet connection required to calculate a new route.',
      // Tutorial
      tSearchTitle: 'Search places',
      tSearchBody: 'Tap here to search for places, shops, or malls by name or category.',
      tSavedTitle: 'Saved places',
      tSavedBody: 'Tap the heart to see places and shops you have saved for later.',
      tMyShopsTitle: 'My shops',
      tMyShopsBody: 'Tap the store icon to manage the shops you have added. You can open or delete them.',
      tLocateTitle: 'Find me',
      tLocateBody: 'Tap here to center the map on your current location.',
      tCompassTitle: 'Compass',
      tCompassBody: 'Tap here to open the compass and see which direction you are facing.',
    },
    Kinyarwanda: {
      loading: 'Turigutunganya…',
      searchPlaceholder: 'Shakisha ahantu, amaduka...',
      noResultsTitle: 'Nta byabonetse',
      noResultsMessage: 'Andika izina ry\'ahantu.',
      matchingResults: 'Ibihura nibyo',
      nearbyShops: 'Ibicuruzwa biri hafi',
      noResultsFound: 'Nta byabonetse',
      errorTitle: 'Ikibazo',
      noCoordinates: 'Aha hantu ntihamaze kugaragara.',
      myShops: 'Amabanga yanjye',
      noShopsYet: 'Nta iduka wongeyemo.',
      addFirstShop: 'Ongera iduka ryawe rya mbere',
      savedPlaces: 'Ahantu n’amaduka wabitse',
      noSavedPlaces: 'Nta hantu cyangwa iduka wabikitse.',
      savedPlacesHint: 'Kanda kuri ❤️ ku hantu cyangwa ku iduka uribike.',
      deleteShop: 'Siba iduka',
      deleteConfirm: 'Ese urabyemera gusiba iri duka?',
      deleteMallShopConfirm: 'Ese urashaka gusiba iri duka ryo mu isoko rinini?',
      deleteCancel: 'Reka',
      deleteOk: 'Siba',
      deleteError: 'Ikibazo',
      deleteFailed: 'Ntibyashobotse gusiba iduka.',
      permissionDenied: 'Uruhushya rwabaye impamvu',
      locationAccessRequired: 'Ugomba guha uruhushya rw\'ahantu.',
      servicesDisabled: 'Serivisi z\'ahantu zirazimiye',
      enableGPS: 'Fungura GPS kugirango ubone inzira.',
      locationError: 'Ikibazo cy\'ahantu',
      locationFailed: 'Ntibyashobotse kubona ahantu.',
      loginRequired: 'Ugomba kwinjira',
      loginMessage: 'Ugomba kuba winjiye kugirango ukore iki gikorwa.',
      login: 'Injira',
      cancel: 'Reka',
      walk: 'Amagur',
      bike: 'Igare',
      moto: 'Moto',
      car: 'Imodoka',
      km: 'km',
      min: 'min',
      noPlacesFound: 'Nta hantu habonetse mu Rwanda hita: ',
      geocodingFailed: 'Gushakisha byanze.',
      shopsInMalls: 'Amaduka mu Maduka manini',
      online: 'KURI INTERINETI',
      offline: 'NTA INTERINETI',
      offlineMap: 'Ikarita itari kuri interneti - herekana amakuru wabitse',
      offlineSearch: 'Internet irakenewe kugirango ushakishe ahandi hantu.',
      offlineRoute: 'Internet irakenewe kugirango ubare indi nzira.',
      // Tutorial
      tSearchTitle: 'Shakisha ahantu',
      tSearchBody: 'Kanda hano ushakishe ahantu, amaduka, cyangwa amaduka manini ku izina cyangwa icyiciro.',
      tSavedTitle: 'Ahantu wabitse',
      tSavedBody: 'Kanda ku mutima urebe ahantu n’amaduka wabitse.',
      tMyShopsTitle: 'Amaduka yanjye',
      tMyShopsBody: 'Kanda ku kamenyetso k’iduka ucunge amaduka wongeyeho. Ushobora kuyafungura cyangwa uyasive.',
      tLocateTitle: 'Nshakira',
      tLocateBody: 'Kanda hano uhuze ikarita n’ahantu uri ubu.',
      tCompassTitle: 'Kompasi',
      tCompassBody: 'Kanda hano ufungure kompasi urebe icyerekezo ugana.',
    },
  };
  const t = translations[language] || translations.English;

  const modeLabels = {
    walking: t.walk,
    bicycle: t.bike,
    motorcycle: t.moto,
    car: t.car,
  };

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [distanceKm, setDistanceKm] = useState(null);
  const [selectedMode, setSelectedMode] = useState('car');
  const [heading, setHeading] = useState(0);
  const [mapBearing, setMapBearing] = useState(0);
  const [singleSelectedPlaceId, setSingleSelectedPlaceId] = useState(null);
  const [showCompass, setShowCompass] = useState(false);
  const webViewRef = useRef(null);

  const [places, setPlaces] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const intervalRef = useRef(null);
  const routeDestinationRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const shopRedirectTimerRef = useRef(null);

  const [myShopsVisible, setMyShopsVisible] = useState(false);
  const [savedPlacesVisible, setSavedPlacesVisible] = useState(false);
  const shopSheetTranslateY = useRef(new Animated.Value(height * 0.75)).current;
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);

  const shopSheetVisible = myShopsVisible || savedPlacesVisible;

  // ---- Tutorial refs ----
  const searchIconRef = useRef(null);
  const savedBtnRef = useRef(null);
  const myShopsBtnRef = useRef(null);
  const locateBtnRef = useRef(null);
  const compassBtnRef = useRef(null);

  // ---- Tutorial hook (same pattern as WelcomeHome) ----
  const [showTutorial, finishTutorial] = useScreenTutorial(
    'locate',
    isFocused && !loading,
    LOCATE_TUTORIAL_DELAY_MS
  );

  // ---- Single-sheet enforcement ----
  useEffect(() => {
    if (myShopsVisible && savedPlacesVisible) {
      setSavedPlacesVisible(false);
    }
  }, [myShopsVisible, savedPlacesVisible]);

  useEffect(() => {
    if (!shopSheetVisible) return;
    shopSheetTranslateY.setValue(height * 0.75);
    Animated.spring(shopSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  }, [shopSheetVisible, shopSheetTranslateY]);

  const [userLocation, setUserLocation] = useState(null);
  const [matchingResults, setMatchingResults] = useState([]);
  const [nearbyShops, setNearbyShops] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const [allMallShops, setAllMallShops] = useState([]);
  const [myMallShops, setMyMallShops] = useState([]);
  const [allMallShopsLoaded, setAllMallShopsLoaded] = useState(false);
  const [shopSearchResults, setShopSearchResults] = useState([]);

  const isClearingRoute = useRef(false);
  const isRouteActive = useRef(false);
  const initialNearestSet = useRef(false);

  const handleHeadingChange = useCallback((newHeading) => {
    setHeading(newHeading);
    setMapBearing(newHeading);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.setBearing(${newHeading});
        }
      `);
    }
  }, []);

  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchWidthAnim = useRef(new Animated.Value(0)).current;

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

  const isAuthenticated = async () => {
    const token = await AsyncStorage.getItem('userToken');
    return !!token;
  };

  const requireAuth = async () => {
    const authed = await isAuthenticated();
    if (!authed) {
      showAppAlert(
        t.loginRequired,
        t.loginMessage,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.login, onPress: () => navigation.navigate('Login') },
        ]
      );
      return false;
    }
    return true;
  };

  const checkExistingShopBeforeAdd = useCallback(async () => {
    const authed = await requireAuth();
    if (!authed) return true;

    const userId = user?._id || user?.id;
    if (!userId) return false;

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return false;

      const headers = { Authorization: `Bearer ${token}` };
      const [placesResponse, shopsResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/places`, { headers }),
        axios.get(`${BASE_URL}/api/mall-shops/mine`, { headers }),
      ]);

      const placesRes = placesResponse.data?.places || [];
      const mallShops = shopsResponse.data?.shops || [];
      const normalizeOwnerId = (value) => {
        if (!value) return null;
        if (typeof value === 'object') return String(value._id || value.id || '');
        return String(value);
      };

      const hasPlaceAlready = placesRes.some(place => {
        const ownerId = normalizeOwnerId(place.userId || place.owner || place.ownerId);
        return ownerId && ownerId === String(userId);
      });

      const hasMallShopAlready = mallShops.some(shop => {
        const ownerId = normalizeOwnerId(shop.ownerId || shop.userId);
        return ownerId && ownerId === String(userId);
      });

      if (hasPlaceAlready || hasMallShopAlready) {
        showAppAlert(
          'Shop Already Added',
          'You have already added a shop before. Please delete your first shop or contact the admin for help.',
          [{ text: 'OK' }]
        );
        return true;
      }
    } catch (error) {
      console.warn('Could not verify existing shop before add:', error?.message || error);
    }

    return false;
  }, [navigation, user, showAppAlert]);

  // Location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        } catch (e) {}
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      if (shopRedirectTimerRef.current) {
        clearTimeout(shopRedirectTimerRef.current);
        shopRedirectTimerRef.current = null;
      }
    };
  }, []);

  const loadCachedMapData = async () => {
    const [cachedPlaces, cachedMallShops] = await Promise.all([
      mapOfflineCache.getPlaces(),
      mapOfflineCache.getMallShops(),
    ]);
    if (cachedPlaces.length > 0) setPlaces(cachedPlaces);
    if (cachedMallShops.length > 0) {
      setAllMallShops(cachedMallShops);
      setAllMallShopsLoaded(true);
    }
  };

  const fetchPlaces = async () => {
    await loadCachedMapData();
    if (!networkStatus.get().isConnected || !networkStatus.get().isInternetReachable) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await axios.get(`${BASE_URL}/api/places`, { headers });
      if (response.data && response.data.places) {
        setPlaces(response.data.places);
        await mapOfflineCache.savePlaces(response.data.places);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setPlaces([]);
      } else {
        console.error('Error fetching places:', error);
      }
    }
  };

  const fetchPlacesSilent = async () => {
    if (!networkStatus.get().isConnected || !networkStatus.get().isInternetReachable) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await axios.get(`${BASE_URL}/api/places`, { headers });
      if (response.data && response.data.places) {
        setPlaces(response.data.places);
        await mapOfflineCache.savePlaces(response.data.places);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setPlaces([]);
      }
    }
  };

  const fetchAllMallShops = async () => {
    const mallIds = places
      .filter(place => place.category === 'shoppingmall')
      .map(place => place._id || place.id)
      .filter(Boolean);
    if (mallIds.length === 0) {
      const cachedShops = await mapOfflineCache.getMallShops();
      setAllMallShops(cachedShops);
      setAllMallShopsLoaded(true);
      return;
    }
    if (!networkStatus.get().isConnected || !networkStatus.get().isInternetReachable) {
      const cachedShops = await mapOfflineCache.getMallShops();
      setAllMallShops(cachedShops);
      setAllMallShopsLoaded(true);
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const responses = await Promise.all(mallIds.map(mallId => axios.get(`${BASE_URL}/api/mall-shops`, {
        params: { mallId },
        headers,
      })));
      const shops = responses.flatMap(response => response.data?.shops || (Array.isArray(response.data) ? response.data : []));
      setAllMallShops(shops);
      setAllMallShopsLoaded(true);
      await mapOfflineCache.saveMallShops(shops);
    } catch (error) {
      console.warn('Failed to fetch all mall shops:', error.message);
      const cachedShops = await mapOfflineCache.getMallShops();
      setAllMallShops(cachedShops);
      setAllMallShopsLoaded(true);
    }
  };

  const fetchMyMallShops = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setMyMallShops([]);
        return;
      }
      if (!networkStatus.get().isConnected || !networkStatus.get().isInternetReachable) {
        const cachedShops = await mapOfflineCache.getMallShops();
        const viewerId = user?._id || user?.id;
        setMyMallShops(cachedShops.filter(shop => {
          const owner = shop.owner || shop.ownerId || shop.userId;
          const ownerId = typeof owner === 'object' ? owner?._id || owner?.id : owner;
          return viewerId && String(ownerId) === String(viewerId);
        }));
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/mall-shops/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ownedShops = response.data?.shops || [];
      setMyMallShops(ownedShops);
      setAllMallShops(current => {
        const otherShops = current.filter(shop =>
          !ownedShops.some(owned => String(owned._id) === String(shop._id))
        );
        const updatedShops = [...ownedShops, ...otherShops];
        mapOfflineCache.saveMallShops(updatedShops).catch(error => {
          console.warn('Could not cache owned mall shops:', error.message);
        });
        return updatedShops;
      });
    } catch (error) {
      console.error('Error fetching owned mall shops:', error);
    }
  }, [user?._id, user?.id]);

  const loadFavoriteIds = async () => {
    try {
      const favJson = await AsyncStorage.getItem('favorites');
      if (favJson) {
        setFavoriteIds(JSON.parse(favJson));
      } else {
        setFavoriteIds([]);
      }
    } catch (e) {
      setFavoriteIds([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavoriteIds();
      fetchMyMallShops();
    }, [fetchMyMallShops])
  );

  useEffect(() => networkStatus.subscribe(status => {
    const online = status.isConnected && status.isInternetReachable;
    setIsOnline(online);
    if (online) {
      fetchPlacesSilent();
      fetchAllMallShops();
    }
  }), []);

  const sendPlacesToMap = () => {
    if (!webViewRef.current || places.length === 0) return;
    const placesData = places.map(p => {
      const cat = CATEGORIES.find(c => c.id === p.category);
      const icon = cat ? cat.icon : 'map-marker';
      const addressStr = getAddressString(p);
      return {
        id: p._id,
        name: p.name || 'Unnamed Place',
        lat: p.location?.latitude || p.lat || 0,
        lon: p.location?.longitude || p.lon || 0,
        category: p.category || 'other',
        icon: icon,
        address: addressStr,
        description: p.description || '',
        openingTime: p.openingTime || '',
        closingTime: p.closingTime || '',
        streetName: p.streetName || '',
        buildingNumber: p.buildingNumber || '',
        images: {
          street: p.images?.street || null,
          logo: p.images?.logo || null,
          products: p.images?.products || [],
        },
        contact: p.contact || {},
        phone: p.contact?.phone || '',
        whatsapp: p.contact?.whatsapp || '',
        email: p.contact?.email || '',
        website: p.contact?.website || '',
        extras: p.extras || {},
        products: p.products || [],
        userId: p.userId,
        isOwn: p.userId === user?._id,
        isLiked: favoriteIds.includes(p._id),
      };
    });
    webViewRef.current.injectJavaScript(`
      if (window.addPlaces) {
        window.addPlaces(${JSON.stringify(placesData)});
      }
      if (window.highlightSinglePlace && '${singleSelectedPlaceId}') {
        window.highlightSinglePlace('${singleSelectedPlaceId}');
      }
    `);
  };

  useEffect(() => {
    if (mapReady && places.length > 0) {
      sendPlacesToMap();
    }
  }, [mapReady, places, favoriteIds, singleSelectedPlaceId]);

  useEffect(() => {
    if (mapReady && places.length > 0) {
      fetchAllMallShops();
    }
  }, [mapReady, places]);

  useEffect(() => {
    const params = route?.params || {};
    if (!params.showMallShops) return;

    const tryShowMallShops = async () => {
      if (!allMallShopsLoaded) await fetchAllMallShops();
      if (!mapReady || !allMallShopsLoaded) return;
      const mallPlaces = allMallShops.map(s => buildMallPlaceFromShop(s));
      if (webViewRef.current && mallPlaces.length > 0) {
        webViewRef.current.injectJavaScript(`
          if (window.addPlaces) {
            window.addPlaces(${JSON.stringify(mallPlaces)});
          }
        `);
      }
    };

    tryShowMallShops();
  }, [route?.params, mapReady, allMallShopsLoaded]);

  // Center on user / nearest
  useEffect(() => {
    if (initialNearestSet.current) return;
    if (!mapReady || !userLocation || !webViewRef.current) return;

    const isUserInRwanda =
      userLocation.latitude >= -2.8 && userLocation.latitude <= -1.0 &&
      userLocation.longitude >= 28.8 && userLocation.longitude <= 30.9;

    if (isUserInRwanda) {
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${userLocation.longitude}, ${userLocation.latitude}], zoom: 15 });
        }
        if (window.updateUserLocation) {
          window.updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});
        }
      `);
      initialNearestSet.current = true;
      return;
    }

    const hasMalls = places.some(place => place.category === 'shoppingmall');
    if (hasMalls && !allMallShopsLoaded) return;

    const placeLocations = places
      .map(place => ({
        ...place,
        lat: place.location?.latitude ?? place.lat,
        lon: place.location?.longitude ?? place.lon,
        type: 'place',
      }))
      .filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon));
    const mallShopLocations = allMallShops
      .map(shop => ({
        ...shop,
        lat: shop.mall?.lat ?? shop.lat,
        lon: shop.mall?.lon ?? shop.lon,
        type: 'mallshop',
        _id: shop._id || shop.mall?._id,
      }))
      .filter(shop => Number.isFinite(shop.lat) && Number.isFinite(shop.lon));
    const shopLocations = [
      ...placeLocations.filter(place => ['shop', 'shoppingmall'].includes(place.category)),
      ...mallShopLocations,
    ];
    const candidates = shopLocations.length > 0 ? shopLocations : placeLocations;
    if (candidates.length === 0) return;

    const nearest = candidates.reduce((closest, item) => {
      const distance = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        item.lat,
        item.lon
      );
      return distance < closest.distance ? { item, distance } : closest;
    }, { item: null, distance: Infinity }).item;

    if (nearest.type === 'place') {
      setSingleSelectedPlaceId(nearest._id);
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${nearest.lon}, ${nearest.lat}], zoom: 15 });
        }
        if (window.highlightSinglePlace) {
          window.highlightSinglePlace('${nearest._id}');
        }
      `);
    } else {
      webViewRef.current.injectJavaScript(`
        if (window.highlightShopLocation) {
          window.highlightShopLocation(${JSON.stringify({
            lat: nearest.lat,
            lon: nearest.lon,
            name: nearest.name || '',
            mallName: nearest.mall?.name || '',
          })});
        }
      `);
    }
    initialNearestSet.current = true;
  }, [mapReady, places, allMallShops, allMallShopsLoaded, userLocation]);

  const performSearch = (query) => {
    const trimmed = query.trim();
    setShowSearchPanel(trimmed.length > 0);

    if (trimmed.length === 0) {
      setMatchingResults([]);
      setNearbyShops([]);
      setShopSearchResults([]);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`if (window.filterPlaces) window.filterPlaces(null);`);
      }
      return;
    }

    const lowerQuery = trimmed.toLowerCase();

    const matched = places.filter(p => {
      const searchIn = (value) => {
        if (!value) return false;
        return String(value).toLowerCase().includes(lowerQuery);
      };
      if (searchIn(p.name)) return true;
      if (searchIn(p.category)) return true;
      if (searchIn(getAddressString(p))) return true;
      if (searchIn(p.phone)) return true;
      if (searchIn(p.website)) return true;
      if (searchIn(p.description)) return true;
      if (p.extras) {
        for (let key in p.extras) {
          if (p.extras[key] && searchIn(key)) return true;
        }
      }
      if (p.products && Array.isArray(p.products)) {
        for (let product of p.products) {
          if (searchIn(product.name)) return true;
        }
      }
      return false;
    });

    setMatchingResults(matched);
    mapOfflineCache.saveSearch(trimmed, matched).catch(() => {});

    let nearby = [];
    if (userLocation) {
      const withDistance = places.map(p => {
        const dist = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          p.location?.latitude || p.lat || 0,
          p.location?.longitude || p.lon || 0
        );
        return { ...p, distance: dist };
      });
      withDistance.sort((a, b) => a.distance - b.distance);
      nearby = withDistance.slice(0, 10);
      setNearbyShops(nearby);
    } else {
      setNearbyShops([]);
      nearby = [];
    }

    let mallShops = [];
    if (allMallShopsLoaded) {
      mallShops = allMallShops.filter(shop => {
        const name = shop.name || '';
        return name.toLowerCase().includes(lowerQuery);
      });
      setShopSearchResults(mallShops);
    } else {
      if (isOnline) fetchShopsBySearch(trimmed);
    }

    const matchedIds = matched.map(p => p._id);
    const nearbyIds = nearby.map(p => p._id);
    const allMatchIds = [...new Set([...matchedIds, ...nearbyIds])];

    if (webViewRef.current) {
      if (allMatchIds.length > 0) {
        webViewRef.current.injectJavaScript(`
          if (window.filterPlaces) window.filterPlaces(${JSON.stringify(allMatchIds)});
        `);
      } else {
        webViewRef.current.injectJavaScript(`
          if (window.filterPlaces) window.filterPlaces([]);
        `);
      }
    }
  };

  const fetchShopsBySearch = useCallback(async (query) => {
    if (!query.trim()) {
      setShopSearchResults([]);
      return;
    }
    if (!networkStatus.get().isConnected || !networkStatus.get().isInternetReachable) {
      const cached = await mapOfflineCache.search(query);
      setShopSearchResults(cached);
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${BASE_URL}/api/mall-shops/search`, {
        params: { q: query.trim() },
        headers,
      });
      if (response.data && response.data.shops) {
        setShopSearchResults(response.data.shops);
        await mapOfflineCache.saveSearch(query, response.data.shops);
      } else {
        setShopSearchResults([]);
      }
    } catch (error) {
      console.warn('Shop search failed:', error.message);
      setShopSearchResults([]);
    }
  }, []);

  const onSearchChange = (text) => {
    setSearchQuery(text);
    performSearch(text);
  };

  useEffect(() => {
    const initialQuery = route?.params?.searchQuery || '';
    if (initialQuery && initialQuery !== searchQuery) {
      onSearchChange(initialQuery);
      if (!searchExpanded) toggleSearch();
    }
  }, [route?.params?.searchQuery, mapReady]);

  const handleSearchSubmit = () => {
    if (matchingResults.length > 0) {
      setSingleSelectedPlaceId(matchingResults[0]._id);
      setShowSearchPanel(false);
      if (searchExpanded) toggleSearch();

      const first = matchingResults[0];
      const lat = first?.location?.latitude || first?.lat || 0;
      const lon = first?.location?.longitude || first?.lon || 0;
      if (first && lat && lon && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          window.mapInstance.flyTo({ center: [${lon}, ${lat}], zoom: 17 });
        `);
      }
    } else if (shopSearchResults.length > 0) {
      const firstShop = shopSearchResults[0];
      if (firstShop.mall && firstShop.mall.lat && firstShop.mall.lon) {
        webViewRef.current.injectJavaScript(`
          window.mapInstance.flyTo({ center: [${firstShop.mall.lon}, ${firstShop.mall.lat}], zoom: 17 });
        `);
      }
      setShowSearchPanel(false);
      if (searchExpanded) toggleSearch();
    } else {
      const query = searchQuery.trim();
      if (query.length > 0 && webViewRef.current) {
        if (!isOnline) {
          showAppAlert(t.noResultsTitle, t.offlineSearch);
          return;
        }
        webViewRef.current.injectJavaScript(`
          window.searchPlace("${query.replace(/"/g, '\\"')}");
        `);
        setShowSearchPanel(false);
        setSingleSelectedPlaceId(null);
        setSearchQuery('');
        setMatchingResults([]);
        setNearbyShops([]);
        setShopSearchResults([]);
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`if (window.filterPlaces) window.filterPlaces(null);`);
        }
        if (searchExpanded) toggleSearch();
      } else {
        showAppAlert(t.noResultsTitle, t.noResultsMessage);
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setMatchingResults([]);
    setNearbyShops([]);
    setShopSearchResults([]);
    setShowSearchPanel(false);
    setSingleSelectedPlaceId(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.filterPlaces) window.filterPlaces(null);`);
    }
    if (searchExpanded) toggleSearch();
  };

  const handleResultPress = async (place) => {
    const can = await requireAuth();
    if (!can) return;

    setSingleSelectedPlaceId(place._id);
    setShowSearchPanel(false);
    setSearchQuery('');
    setMatchingResults([]);
    setNearbyShops([]);
    setShopSearchResults([]);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.filterPlaces) window.filterPlaces(null);`);
    }
    if (searchExpanded) toggleSearch();

    const lat = place?.location?.latitude ?? place?.lat ?? 0;
    const lon = place?.location?.longitude ?? place?.lon ?? 0;

    if (!lat || !lon) {
      showAppAlert(t.errorTitle, t.noCoordinates);
      return;
    }

    const placeToSend = {
      ...place,
      lat,
      lon,
      address: getAddressString(place),
    };

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${lon}, ${lat}], zoom: 17 });
        }
        if (window.highlightSinglePlace) {
          window.highlightSinglePlace('${place._id}');
        }
      `);
    }
  };

  const buildMallPlaceFromShop = (shop) => {
    const mallName = shop.mall?.name || shop.mallName || 'Shopping Mall';
    const shopId = String(shop._id || shop.id || shop.shopId || '');
    const mallLat = shop.lat ?? shop.mall?.lat ?? 0;
    const mallLon = shop.lon ?? shop.mall?.lon ?? 0;

    return {
      _id: shopId,
      id: shopId,
      shopId,
      type: 'mallshop',
      name: shop.name || shop.title || mallName,
      category: 'shoppingmall',
      icon: 'store',
      lat: mallLat,
      lon: mallLon,
      address: getAddressText(shop.address || shop.mall?.address),
      mallName,
      shopNumber: shop.shopNumber || '',
      images: {
        street: shop.images?.frontImage || shop.images?.frontVideo || null,
      },
    };
  };

  useEffect(() => {
    const requestedShopId = route?.params?.focusMallShopId;
    if (!requestedShopId || !mapReady || !webViewRef.current) return;

    const listedShop = allMallShops.find(shop =>
      String(shop._id || shop.id || shop.shopId) === String(requestedShopId)
    );
    const requestedShop = listedShop || route?.params?.focusMallShop;
    if (!requestedShop) return;

    const mapShop = buildMallPlaceFromShop({ ...requestedShop, _id: requestedShopId });
    if (mapShop.lat && mapShop.lon) {
      setSingleSelectedPlaceId(mapShop.id);
      webViewRef.current.injectJavaScript(`
        if (window.addPlaces) window.addPlaces([${JSON.stringify(mapShop)}]);
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${mapShop.lon}, ${mapShop.lat}], zoom: 17 });
        }
        if (window.highlightSinglePlace) window.highlightSinglePlace(${JSON.stringify(mapShop.id)});
      `);
    }
    const openDetails = route?.params?.openMallShopDetails;
    navigation.setParams({
      focusMallShopId: undefined,
      focusMallShop: undefined,
      openMallShopDetails: undefined,
    });
    if (openDetails) navigation.navigate('ViewShop', { shopId: requestedShopId });
  }, [route?.params?.focusMallShopId, route?.params?.focusMallShop, route?.params?.openMallShopDetails, mapReady, allMallShops, navigation]);

  useEffect(() => {
    const context = route?.params?.openPlaceContext;
    if (!context || !mapReady) return;

    const placeId = context.contextId || context.postId || context._id;
    const place = places.find(item => String(item._id || item.id) === String(placeId)) || {
      _id: placeId,
      id: placeId,
      name: context.title || 'Place',
      description: context.description || '',
      category: context.category || 'other',
      address: context.location || '',
      lat: context.lat,
      lon: context.lon,
      location: {
        latitude: context.lat,
        longitude: context.lon,
      },
      images: { street: context.image || '' },
      userId: context.ownerId,
    };

    if (place.lat && place.lon && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${place.lon}, ${place.lat}], zoom: 17 });
        }
        if (window.highlightSinglePlace) window.highlightSinglePlace(${JSON.stringify(String(placeId))});
      `);
    }
    navigation.setParams({ openPlaceContext: undefined });
    navigation.navigate('ViewPlace', { place });
  }, [route?.params?.openPlaceContext, mapReady, places, navigation]);

  const handleShopResultPress = (shop) => {
    const mapLocation = {
      lat: shop.mall?.lat || shop.lat || 0,
      lon: shop.mall?.lon || shop.lon || 0,
      name: shop.name || '',
      mallName: shop.mall?.name || shop.mallName || '',
    };

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.highlightShopLocation) {
          window.highlightShopLocation(${JSON.stringify(mapLocation)});
        }
      `);
    }

    if (shopRedirectTimerRef.current) {
      clearTimeout(shopRedirectTimerRef.current);
    }
    shopRedirectTimerRef.current = setTimeout(() => {
      navigation.navigate('ViewShop', { shopId: shop._id });
    }, 2000);

    setShowSearchPanel(false);
    setSearchQuery('');
    setShopSearchResults([]);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.filterPlaces) window.filterPlaces(null);`);
    }
    if (searchExpanded) toggleSearch();
  };

  const highlightText = (text, query) => {
    if (!text || !query) return text;
    const lowerQuery = query.toLowerCase().trim();
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
      <Text>
        {text.substring(0, index)}
        <Text style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold' }}>
          {text.substring(index, index + query.length)}
        </Text>
        {text.substring(index + query.length)}
      </Text>
    );
  };

  const handleLoadEnd = () => {
    setLoading(false);
    setMapReady(true);
    fetchPlaces();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getTravelTime = (mode) => {
    if (!distanceKm || distanceKm === 0) {
      return { value: 0, unit: `0 ${t.min}` };
    }
    const speed = travelSpeeds[mode];
    const minutes = Math.round((distanceKm / speed) * 60);
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      return { value: h, unit: m > 0 ? `${h}h ${m}${t.min}` : `${h}h` };
    }
    return { value: minutes, unit: `${minutes}${t.min}` };
  };

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.bearing !== undefined) {
        setMapBearing(data.bearing);
      } else if (data.distance !== undefined) {
        if (typeof data.distance === 'number') {
          setDistanceKm(data.distance / 1000);
          isRouteActive.current = true;
        } else if (data.distance === null) {
          if (isClearingRoute.current) {
            setDistanceKm(null);
            isRouteActive.current = false;
            isClearingRoute.current = false;
          }
        }
      } else if (data.type === 'placeSelected') {
        const can = await requireAuth();
        if (!can) return;

        const place = data.place;
        if (place.type === 'mallshop' && place.shopId) {
          navigation.navigate('ViewShop', { shopId: place.shopId });
          return;
        }
        if (place.address && typeof place.address === 'object') {
          place.address = getAddressString(place);
        }
        navigation.navigate('ViewPlace', { place });
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  };

  const clearRoute = () => {
    isClearingRoute.current = true;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.clearRoute) window.clearRoute();`);
    }
    setDistanceKm(null);
    isRouteActive.current = false;
    routeDestinationRef.current = null;
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
    setTimeout(() => {
      isClearingRoute.current = false;
    }, 500);
  };

  const drawRouteToPlace = async (place, profile = 'foot') => {
    if (!place?.lat || !place?.lon) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAppAlert(t.permissionDenied, t.locationAccessRequired);
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        showAppAlert(t.servicesDisabled, t.enableGPS);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      const { latitude, longitude } = location.coords;
      routeDestinationRef.current = { lat: place.lat, lon: place.lon };

      const routeColor = isDarkMode ? '#FFFFFF' : '#000000';

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.updateUserLocation) {
            window.updateUserLocation(${latitude}, ${longitude});
          }
          if (window.drawRoute) {
            window.drawRoute(${longitude}, ${latitude}, ${place.lon}, ${place.lat}, '${routeColor}');
          }
        `);
      }

      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      locationWatcherRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
        (newLocation) => {
          const { latitude: newLat, longitude: newLon } = newLocation.coords;
          if (routeDestinationRef.current && webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.updateUserLocation) {
                window.updateUserLocation(${newLat}, ${newLon});
              }
              if (window.drawRoute) {
                window.drawRoute(${newLon}, ${newLat}, ${routeDestinationRef.current.lon}, ${routeDestinationRef.current.lat}, '${routeColor}');
              }
            `);
          }
        }
      );
    } catch (error) {
      console.error('Directions error:', error);
      showAppAlert(t.locationError, t.locationFailed);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkPendingRoute = async () => {
        try {
          const pending = await AsyncStorage.getItem('pendingRoute');
          if (pending) {
            const place = JSON.parse(pending);
            await AsyncStorage.removeItem('pendingRoute');
            drawRouteToPlace(place);
          }
        } catch (e) {}
      };
      checkPendingRoute();
    }, [])
  );

  const loadSavedPlaces = async () => {
    try {
      const [favoritesJson, favoriteShopsJson] = await Promise.all([
        AsyncStorage.getItem('favorites'),
        AsyncStorage.getItem('favoriteShops'),
      ]);
      let favoriteIds = favoritesJson ? JSON.parse(favoritesJson) : [];
      let favoriteShopIds = favoriteShopsJson ? JSON.parse(favoriteShopsJson) : [];
      let favoritePlaces = places.filter(place =>
        favoriteIds.includes(String(place._id || place.id))
      );
      let favoriteShops = allMallShops
        .filter(shop => favoriteShopIds.includes(String(shop._id || shop.id)))
        .map(shop => ({ ...shop, isMallShop: true }));

      const token = await AsyncStorage.getItem('userToken');
      if (token && networkStatus.get().isConnected && networkStatus.get().isInternetReachable) {
        try {
          const response = await axios.get(`${BASE_URL}/api/favorites`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.data?.success) {
            favoritePlaces = response.data.favorites || [];
            favoriteShops = (response.data.favoriteShops || []).map(shop => ({
              ...shop,
              isMallShop: true,
            }));
            favoriteIds = favoritePlaces.map(place => String(place._id || place.id)).filter(Boolean);
            favoriteShopIds = favoriteShops.map(shop => String(shop._id || shop.id)).filter(Boolean);
            await Promise.all([
              AsyncStorage.setItem('favorites', JSON.stringify(favoriteIds)),
              AsyncStorage.setItem('favoriteShops', JSON.stringify(favoriteShopIds)),
            ]);
          }
        } catch (error) {
          console.warn('Could not refresh saved places and shops:', error.message);
        }
      }

      const mappedPlaces = favoritePlaces.map(place => ({
        ...place,
        address: getAddressString(place),
      }));
      setSavedPlaces([...mappedPlaces, ...favoriteShops]);
    } catch (error) {
      console.error('Error loading saved places:', error);
      setSavedPlaces([]);
    }
  };

  // ---- Single-sheet aware openers ----
  const handleSavedLocationsPress = async () => {
    const can = await requireAuth();
    if (!can) return;
    if (myShopsVisible) setMyShopsVisible(false);
    setSavedPlacesVisible(true);
    loadSavedPlaces();
  };

  const openMyShops = async () => {
    const can = await requireAuth();
    if (!can) return;
    if (savedPlacesVisible) setSavedPlacesVisible(false);
    setMyShopsVisible(true);
  };

  // ---- Locate helper: fly map → highlight → navigate ----
  const locateAndOpen = useCallback((item, isMallShop) => {
    const lat =
      item.lat ??
      item.location?.latitude ??
      item.mall?.lat ??
      0;
    const lon =
      item.lon ??
      item.location?.longitude ??
      item.mall?.lon ??
      0;

    if (!lat || !lon || !webViewRef.current) {
      if (isMallShop) {
        navigation.navigate('ViewShop', { shopId: item._id || item.id });
      } else {
        navigation.navigate('ViewPlace', { place: item });
      }
      return;
    }

    if (isMallShop) {
      webViewRef.current.injectJavaScript(`
        if (window.highlightShopLocation) {
          window.highlightShopLocation(${JSON.stringify({
            lat,
            lon,
            name: item.name || '',
            mallName: item.mall?.name || item.mallName || '',
          })});
        }
      `);
    } else {
      setSingleSelectedPlaceId(item._id || item.id);
      webViewRef.current.injectJavaScript(`
        if (window.mapInstance) {
          window.mapInstance.flyTo({ center: [${lon}, ${lat}], zoom: 17 });
        }
        if (window.highlightSinglePlace) {
          window.highlightSinglePlace('${item._id || item.id}');
        }
      `);
    }

    if (shopRedirectTimerRef.current) clearTimeout(shopRedirectTimerRef.current);
    shopRedirectTimerRef.current = setTimeout(() => {
      if (isMallShop) {
        navigation.navigate('ViewShop', { shopId: item._id || item.id });
      } else {
        navigation.navigate('ViewPlace', { place: item });
      }
    }, 1500);
  }, [navigation]);

  const handleSavedPlacePress = async (item) => {
    const can = await requireAuth();
    if (!can) return;
    closeSavedPlaces();
    locateAndOpen(item, !!item.isMallShop);
  };

  const handleMyShopPress = async (item) => {
    const can = await requireAuth();
    if (!can) return;
    closeMyShops();
    locateAndOpen(item, !!item.isMallShop);
  };

  const viewerId = user?._id || user?.id;
  const userPlaces = places.filter(place => {
    const owner = place.userId || place.owner || place.ownerId;
    const ownerId = typeof owner === 'object' ? owner?._id || owner?.id : owner;
    return viewerId && String(ownerId) === String(viewerId);
  });
  const myBusinesses = [
    ...userPlaces,
    ...myMallShops.map(shop => ({ ...shop, isMallShop: true })),
  ];

  const deletePlace = async (placeId) => {
    Alert.alert(
      t.deleteShop,
      t.deleteConfirm,
      [
        { text: t.deleteCancel, style: 'cancel' },
        {
          text: t.deleteOk,
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(`${BASE_URL}/api/places/${placeId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              fetchPlaces();
              closeMyShops();
            } catch (error) {
              showAppAlert(t.deleteError, t.deleteFailed);
            }
          },
        },
      ]
    );
  };

  const deleteMallShop = async (shopId) => {
    Alert.alert(
      t.deleteShop,
      t.deleteMallShopConfirm,
      [
        { text: t.deleteCancel, style: 'cancel' },
        {
          text: t.deleteOk,
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(`${BASE_URL}/api/mall-shops/${shopId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              setMyMallShops(current => current.filter(shop => String(shop._id) !== String(shopId)));
              setAllMallShops(current => {
                const updatedShops = current.filter(shop => String(shop._id) !== String(shopId));
                mapOfflineCache.saveMallShops(updatedShops).catch(error => {
                  console.warn('Could not update cached mall shops after deletion:', error.message);
                });
                return updatedShops;
              });
              closeMyShops();
            } catch (error) {
              console.error('Error deleting mall shop:', error);
              showAppAlert(t.deleteError, t.deleteFailed);
            }
          },
        },
      ]
    );
  };

  // ---- My Shop Row (tap to locate, delete button separate) ----
  const renderMyShopItem = ({ item }) => {
    const cat = CATEGORIES.find(c => c.id === item.category);
    const icon = cat ? cat.icon : 'map-marker';
    const addressStr = item.isMallShop
      ? [item.mallName || item.mall?.name, item.shopNumber ? `Shop ${item.shopNumber}` : null].filter(Boolean).join(' • ')
      : getAddressString(item);
    return (
      <TouchableOpacity
        style={[styles.myShopItem, { backgroundColor: theme.background }]}
        onPress={() => handleMyShopPress(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.myShopIconCircle, { backgroundColor: theme.accent + '22' }]}>
          <MaterialCommunityIcons
            name={item.isMallShop ? 'store' : icon}
            size={22}
            color={theme.accent}
          />
        </View>
        <View style={styles.myShopTexts}>
          <Text style={[styles.myShopName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.myShopAddress, { color: theme.textSecondary }]} numberOfLines={1}>
            {addressStr}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e?.stopPropagation?.();
            item.isMallShop ? deleteMallShop(item._id) : deletePlace(item._id);
          }}
          style={styles.myShopActionBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const tileUrl = isDarkMode
    ? 'https://api.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=ad15f28266904ce28f417e5f7b45e832'
    : 'https://api.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=ad15f28266904ce28f417e5f7b45e832';

  const routeColor = isDarkMode ? '#FFFFFF' : '#000000';

  // ---- Tutorial steps ----
  const tutorialSteps = useMemo(() => [
    {
      getTarget: () => searchIconRef.current,
      title: t.tSearchTitle,
      body: t.tSearchBody,
    },
    {
      getTarget: () => savedBtnRef.current,
      title: t.tSavedTitle,
      body: t.tSavedBody,
    },
    {
      getTarget: () => myShopsBtnRef.current,
      title: t.tMyShopsTitle,
      body: t.tMyShopsBody,
    },
    {
      getTarget: () => locateBtnRef.current,
      title: t.tLocateTitle,
      body: t.tLocateBody,
    },
    {
      getTarget: () => compassBtnRef.current,
      title: t.tCompassTitle,
      body: t.tCompassBody,
    },
  ], [t]);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css" />
      <link href="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.css" rel="stylesheet" />
      <script src="https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.js"></script>
      <style>
        body, html, #map { margin: 0; height: 100%; width: 100%; }
        .custom-marker {
          width: 20px;
          height: 20px;
          border-radius: 20%;
          background-color: #47ae87;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          border: 1px solid white;
        }
        .custom-marker i { font-size: 15px; color: white; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const baseStyle = { 
          version: 8, 
          sources: { 
            'tf-tiles': { 
              type: 'raster', 
              tiles: ['${tileUrl}'], 
              tileSize: 256, 
              attribution: '&copy; OpenStreetMap contributors &copy; Thunderforest' 
            } 
          }, 
          layers: [{ id: 'tf-tiles-layer', type: 'raster', source: 'tf-tiles', minzoom: 0, maxzoom: 20 }] 
        };
        const rwandaBounds = [[28.8, -2.8], [30.9, -1.0]];
        let map, routeSource = null, routeLayer = null, searchMarker = null, userMarkers = [], userMarker = null;
        let highlightedMarkers = [];
        try {
          map = new maplibregl.Map({
            container: 'map', style: baseStyle, center: [29.641789, -1.507005],
            zoom: 17, minZoom: 16, maxZoom: 19.9, pitch: 0, bearing: 0
          });
          map.setMaxBounds(rwandaBounds);
          window.mapInstance = map;

          map.on('rotate', () => {
            const bearing = map.getBearing();
            window.ReactNativeWebView.postMessage(JSON.stringify({ bearing: bearing }));
          });

          window.zoomInMap = function() { if (map) map.zoomIn(); };
          window.zoomOutMap = function() { if (map) map.zoomOut(); };
          window.rotateMap = function(degrees) {
            if (map) {
              const current = map.getBearing();
              map.setBearing(current + degrees);
            }
          };
          window.resetBearing = function() { if (map) map.setBearing(0); };

          window.updateUserLocation = function(lat, lon) {
            if (userMarker) userMarker.remove();
            userMarker = new maplibregl.Marker({ color: '#FFD700' }).setLngLat([lon, lat]).addTo(map);
          };

          window.clearRoute = function() {
            if (routeSource) {
              map.removeLayer(routeLayer);
              map.removeSource(routeSource);
              routeSource = null; routeLayer = null;
            }
            if (searchMarker) { searchMarker.remove(); searchMarker = null; }
            window.ReactNativeWebView.postMessage(JSON.stringify({ distance: null }));
          };

          window.drawRoute = function(startLon, startLat, endLon, endLat, color) {
            if (routeSource) {
              map.removeLayer(routeLayer);
              map.removeSource(routeSource);
              routeSource = null; routeLayer = null;
              window.ReactNativeWebView.postMessage(JSON.stringify({ distance: null }));
            }
            const url = 'https://router.project-osrm.org/route/v1/foot/'
                      + startLon + ',' + startLat + ';' + endLon + ',' + endLat
                      + '?geometries=geojson&overview=full';
            fetch(url)
              .then(r => r.json())
              .then(data => {
                if (data.code === 'Ok' && data.routes.length > 0) {
                  const routeGeoJSON = data.routes[0].geometry;
                  const distance = data.routes[0].distance;
                  routeSource = 'route-source';
                  map.addSource(routeSource, { type: 'geojson', data: routeGeoJSON });
                  routeLayer = 'route-layer';
                  map.addLayer({
                    id: routeLayer, type: 'line', source: routeSource,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': color, 'line-width': 5 }
                  });
                  window.ReactNativeWebView.postMessage(JSON.stringify({ distance }));
                } else {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ distance: null }));
                }
              })
              .catch(() => window.ReactNativeWebView.postMessage(JSON.stringify({ distance: null })));
          };

          window.searchPlace = function(query) {
            if (!query.trim()) return;
            const url = 'https://nominatim.openstreetmap.org/search?format=json&q='
                      + encodeURIComponent(query) + '&countrycodes=RW&limit=1';
            fetch(url)
              .then(r => r.json())
              .then(data => {
                if (data && data.length > 0) {
                  const { lon, lat, display_name } = data[0];
                  map.setCenter([parseFloat(lon), parseFloat(lat)], 17);
                  if (searchMarker) searchMarker.remove();
                  searchMarker = new maplibregl.Marker({ color: '#47ae87' })
                    .setLngLat([parseFloat(lon), parseFloat(lat)])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<b>' + display_name + '</b>'))
                    .addTo(map);
                } else alert('${t.noPlacesFound}' + query);
              })
              .catch(() => alert('${t.geocodingFailed}'));
          };

          window.highlightPlaces = function(placesData) {
            highlightedMarkers.forEach(m => m.remove());
            highlightedMarkers = [];
            placesData.forEach(p => {
              if (!p.lat || !p.lon) return;
              const el = document.createElement('div');
              el.className = 'custom-marker highlight-marker';
              const iconName = p.icon || 'map-marker';
              el.innerHTML = '<i class="mdi mdi-' + iconName + '"></i>';
              const marker = new maplibregl.Marker({ element: el })
                .setLngLat([p.lon, p.lat])
                .addTo(map);
              el.addEventListener('click', () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'placeSelected', place: p }));
              });
              highlightedMarkers.push(marker);
            });
            if (placesData.length > 0) {
              const bounds = new maplibregl.LngLatBounds();
              placesData.forEach(p => bounds.extend([p.lon, p.lat]));
              map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
            }
          };

          window.highlightMatchingPlaces = function(matchIds) {
            userMarkers.forEach(item => {
              const el = item.marker.getElement();
              const id = item.id;
              if (matchIds.length === 0) {
                const baseColor = el.getAttribute('data-base-color');
                if (baseColor) el.style.backgroundColor = baseColor;
              } else {
                if (matchIds.includes(id)) {
                  el.style.backgroundColor = '#47ae87';
                } else {
                  const baseColor = el.getAttribute('data-base-color');
                  if (baseColor) el.style.backgroundColor = baseColor;
                }
              }
            });
          };

          window.highlightSinglePlace = function(placeId) {
            userMarkers.forEach(item => {
              const el = item.marker.getElement();
              const id = item.id;
              if (id === placeId) {
                el.style.backgroundColor = '#47ae87';
              } else {
                const baseColor = el.getAttribute('data-base-color');
                if (baseColor) el.style.backgroundColor = baseColor;
              }
            });
          };

          window.filterPlaces = function(placeIds) {
            if (!userMarkers) return;
            userMarkers.forEach(item => {
              const el = item.marker.getElement();
              if (placeIds === null || placeIds.length === 0) {
                el.style.display = 'flex';
              } else {
                if (placeIds.includes(item.id)) {
                  el.style.display = 'flex';
                } else {
                  el.style.display = 'none';
                }
              }
            });
          };

          let selectedShopMarker = null;
          window.highlightShopLocation = function(location) {
            if (!location || !location.lat || !location.lon) return;
            if (selectedShopMarker) {
              selectedShopMarker.remove();
              selectedShopMarker = null;
            }
            const el = document.createElement('div');
            el.className = 'custom-marker highlight-marker';
            el.style.backgroundColor = '#47ae87';
            el.innerHTML = '<i class="mdi mdi-store"></i>';
            selectedShopMarker = new maplibregl.Marker({ element: el })
              .setLngLat([location.lon, location.lat])
              .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
                '<b>' + (location.name || 'Shop') + '</b>' +
                (location.mallName ? '<br/><small>' + location.mallName + '</small>' : '')
              ))
              .addTo(map);
            map.flyTo({ center: [location.lon, location.lat], zoom: 17 });
          };

          window.addPlaces = function(placesData) {
            userMarkers.forEach(item => item.marker.remove());
            userMarkers = [];

            placesData.forEach(p => {
              if (!p.lat || !p.lon) return;
              const el = document.createElement('div');
              el.className = 'custom-marker';
              const iconName = p.icon || 'map-marker';
              el.innerHTML = '<i class="mdi mdi-' + iconName + '"></i>';

              let baseColor = '#ffd500';
              if (p.isOwn) baseColor = '#007AFF';
              else if (p.isLiked) baseColor = '#FF1493';

              el.style.backgroundColor = baseColor;
              el.setAttribute('data-base-color', baseColor);

              const marker = new maplibregl.Marker({ element: el })
                .setLngLat([p.lon, p.lat])
                .addTo(map);

              el.addEventListener('click', () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'placeSelected', place: p }));
              });

              userMarkers.push({ marker, id: p.id });
            });
            window.filterPlaces(null);
          };
        } catch (e) { console.log("Map Error: " + e.message); }
      </script>
    </body>
    </html>
  `;

  const locateUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAppAlert(t.permissionDenied, t.locationAccessRequired);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.mapInstance) {
            window.mapInstance.setCenter([${longitude}, ${latitude}], 17);
            window.updateUserLocation(${latitude}, ${longitude});
          }
        `);
      }
    } catch (error) {
      showAppAlert(t.errorTitle, t.locationFailed);
    }
  };

  const zoomInMap = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.zoomInMap();`);
    }
  };

  const zoomOutMap = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.zoomOutMap();`);
    }
  };

  const rotateMapLeft = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.rotateMap(-15);`);
    }
  };

  const rotateMapRight = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.rotateMap(15);`);
    }
  };

  const resetBearing = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.resetBearing();`);
    }
  };

  const toggleCompass = () => {
    setShowCompass(!showCompass);
  };

  const backgroundColor = theme.background;
  const overlayColor = theme.background;
  const searchBackground = theme.background;
  const searchBorder = theme.border;
  const cardBg = theme.background;
  const textColor = theme.text;
  const secondaryText = theme.textSecondary;

  const renderModeItem = (mode) => {
    const isActive = selectedMode === mode;
    const time = getTravelTime(mode);
    return (
      <TouchableOpacity
        key={mode}
        style={[
          styles.modeItem,
          {
            backgroundColor: isActive ? theme.accent : 'transparent',
            borderColor: isActive ? theme.text : 'transparent',
          },
        ]}
        onPress={() => setSelectedMode(mode)}
      >
        <Ionicons name={modeIcons[mode]} size={20} color={isActive ? '#fff' : secondaryText} style={styles.modeIcon} />
        <Text style={[styles.modeName, { color: isActive ? '#fff' : secondaryText }]}>{modeLabels[mode]}</Text>
        <Text style={[styles.modeTime, { color: isActive ? '#fff' : secondaryText }]}>
          {time.unit}
        </Text>
      </TouchableOpacity>
    );
  };

  const dismissShopSheet = useCallback((setVisible) => {
    Animated.timing(shopSheetTranslateY, {
      toValue: height * 0.75,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [shopSheetTranslateY]);

  const closeMyShops = useCallback(() => {
    dismissShopSheet(setMyShopsVisible);
  }, [dismissShopSheet]);

  const closeSavedPlaces = useCallback(() => {
    dismissShopSheet(setSavedPlacesVisible);
  }, [dismissShopSheet]);

  useEffect(() => {
    if (!shopSheetVisible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savedPlacesVisible) closeSavedPlaces();
      else closeMyShops();
      return true;
    });
    return () => subscription.remove();
  }, [shopSheetVisible, savedPlacesVisible, closeMyShops, closeSavedPlaces]);

  // ---- My Shops Sheet ----
  const renderMyShopsSheet = () => myShopsVisible ? (
    <View style={styles.myShopsOverlay}>
      <Animated.View
        style={[
          styles.myShopsSheet,
          { backgroundColor: cardBg, transform: [{ translateY: shopSheetTranslateY }] },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: secondaryText }]} />
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="store-outline" size={24} color={theme.accent} />
            <Text style={[styles.modalTitle, { color: textColor }]}>{t.myShops}</Text>
          </View>
          <TouchableOpacity onPress={closeMyShops}>
            <Ionicons name="close" size={26} color={textColor} />
          </TouchableOpacity>
        </View>
        {myBusinesses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="store-off" size={60} color={secondaryText} />
            <Text style={[styles.emptyText, { color: secondaryText }]}>{t.noShopsYet}</Text>
            <TouchableOpacity
              style={[styles.addShopBtn, { backgroundColor: theme.accent }]}
              onPress={async () => {
                closeMyShops();
                const blocked = await checkExistingShopBeforeAdd();
                if (!blocked) navigation.navigate('AddShop');
              }}
            >
              <Text style={styles.addShopBtnText}>{t.addFirstShop}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={myBusinesses}
            renderItem={renderMyShopItem}
            keyExtractor={(item) => `${item.isMallShop ? 'mall-' : 'place-'}${item._id}`}
            contentContainerStyle={styles.myShopsList}
            ItemSeparatorComponent={() => (
              <View style={{ height: 8 }} />
            )}
          />
        )}
      </Animated.View>
    </View>
  ) : null;

  // ---- Saved Places Sheet ----
  const renderSavedPlacesSheet = () => savedPlacesVisible ? (
    <View style={styles.myShopsOverlay}>
      <Animated.View
        style={[
          styles.myShopsSheet,
          { backgroundColor: cardBg, transform: [{ translateY: shopSheetTranslateY }] },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: secondaryText }]} />
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="heart" size={22} color={theme.accent} />
            <Text style={[styles.modalTitle, { color: textColor }]}>{t.savedPlaces}</Text>
          </View>
          <TouchableOpacity onPress={closeSavedPlaces}>
            <Ionicons name="close" size={26} color={textColor} />
          </TouchableOpacity>
        </View>
        {savedPlaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={60} color={secondaryText} />
            <Text style={[styles.emptyText, { color: secondaryText }]}>
              {t.noSavedPlaces}
            </Text>
            <Text style={[styles.emptySubText, { color: secondaryText }]}>
              {t.savedPlacesHint}
            </Text>
          </View>
        ) : (
          <FlatList
            data={savedPlaces}
            renderItem={({ item }) => {
              const cat = CATEGORIES.find(c => c.id === item.category);
              const icon = cat ? cat.icon : 'map-marker';
              const addressStr = item.isMallShop
                ? [item.mall?.name || item.mallName, item.shopNumber ? `Shop ${item.shopNumber}` : null].filter(Boolean).join(' • ')
                : getAddressString(item);
              return (
                <TouchableOpacity
                  style={[styles.myShopItem, { backgroundColor: theme.background }]}
                  onPress={() => handleSavedPlacePress(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.myShopIconCircle, { backgroundColor: theme.accent + '22' }]}>
                    <MaterialCommunityIcons
                      name={item.isMallShop ? 'store' : icon}
                      size={22}
                      color={theme.accent}
                    />
                  </View>
                  <View style={styles.myShopTexts}>
                    <Text style={[styles.myShopName, { color: textColor }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.myShopAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                      {addressStr}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => `${item.isMallShop ? 'shop' : 'place'}-${item._id || item.id}`}
            contentContainerStyle={styles.myShopsList}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </Animated.View>
    </View>
  ) : null;

  const renderSearchPanel = () => {
    if (!showSearchPanel) return null;
    const hasMatches = matchingResults.length > 0;
    const hasNearby = nearbyShops.length > 0;
    const hasShopResults = shopSearchResults.length > 0;

    const data = [];
    if (hasMatches) {
      matchingResults.forEach(item => data.push({ ...item, type: 'match' }));
    }
    if (hasShopResults) {
      shopSearchResults.forEach(shop => data.push({ ...shop, type: 'mallshop' }));
    }
    if (!hasMatches && hasNearby) {
      nearbyShops.forEach(item => data.push({ ...item, type: 'nearby' }));
    }
    if (!hasMatches && !hasNearby && !hasShopResults) {
      data.push({ type: 'empty', id: 'empty' });
    }

    const renderItem = ({ item }) => {
      if (item.type === 'empty') {
        return (
          <View style={styles.searchEmpty}>
            <Text style={[styles.searchEmptyText, { color: secondaryText }]}>{t.noResultsFound}</Text>
          </View>
        );
      }
      if (item.type === 'mallshop') {
        const cat = CATEGORIES.find(c => c.id === item.category);
        const mallName = item.mall?.name || 'Shopping Mall';
        const distanceStr = item.distance !== undefined
          ? (item.distance < 1 ? `${(item.distance * 1000).toFixed(0)} m` : `${item.distance.toFixed(1)} km`)
          : '';
        return (
          <TouchableOpacity
            style={[styles.searchResultCard, { borderColor: searchBorder }]}
            onPress={() => handleShopResultPress(item)}
          >
            <View style={styles.searchResultRow}>
              <View style={[styles.mallShopIconContainer, isDarkMode && styles.mallShopIconDark]}>
                <MaterialCommunityIcons
                  name={cat?.icon || 'store'}
                  size={20}
                  color={isDarkMode ? '#fff' : theme.accent}
                />
              </View>
              <View style={styles.searchResultTexts}>
                <Text style={[styles.searchResultName, { color: textColor }]}>
                  {highlightText(item.name, searchQuery)}
                </Text>
                <Text style={[styles.searchResultMatch, { color: theme.accent }]}>
                  {highlightText(cat?.label || item.category || 'Shop', searchQuery)}
                  {distanceStr ? ` • ${distanceStr}` : ''}
                </Text>
                <Text style={[styles.searchResultAddress, { color: secondaryText }]} numberOfLines={1}>
                  🏢 {highlightText(mallName, searchQuery)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }
      const lowerQuery = searchQuery.toLowerCase().trim();
      const cat = CATEGORIES.find(c => c.id === item.category);
      let matchField = '';
      if (item.type === 'match') {
        if (item.category && item.category.toLowerCase().includes(lowerQuery)) {
          matchField = cat?.label || item.category;
        } else if (item.name && item.name.toLowerCase().includes(lowerQuery)) {
          matchField = 'Name';
        } else if (item.extras) {
          for (let key in item.extras) {
            if (item.extras[key] && key.toLowerCase().includes(lowerQuery)) {
              matchField = key.charAt(0).toUpperCase() + key.slice(1);
              break;
            }
          }
        } else if (item.products && Array.isArray(item.products)) {
          for (let prod of item.products) {
            if (prod.name && prod.name.toLowerCase().includes(lowerQuery)) {
              matchField = 'Product: ' + prod.name;
              break;
            }
          }
        } else if (item.description && item.description.toLowerCase().includes(lowerQuery)) {
          matchField = 'Description';
        } else if (getAddressString(item).toLowerCase().includes(lowerQuery)) {
          matchField = 'Address';
        }
      }
      const addressStr = getAddressString(item);
      const distanceStr = item.distance !== undefined
        ? (item.distance < 1 ? `${(item.distance * 1000).toFixed(0)} m` : `${item.distance.toFixed(1)} km`)
        : '';
      return (
        <TouchableOpacity
          style={[styles.searchResultCard, { borderColor: searchBorder }]}
          onPress={() => handleResultPress(item)}
        >
          <View style={styles.searchResultRow}>
            <MaterialCommunityIcons
              name={cat?.icon || 'map-marker'}
              size={20}
              color={theme.accent}
              style={styles.searchResultIcon}
            />
            <View style={styles.searchResultTexts}>
              <Text style={[styles.searchResultName, { color: textColor }]}>
                {highlightText(item.name, searchQuery)}
              </Text>
              {(matchField || distanceStr) && (
                <Text style={[styles.searchResultMatch, { color: theme.accent }]}>
                  {matchField ? highlightText(matchField, searchQuery) : ''}
                  {matchField && distanceStr ? ' • ' : ''}
                  {distanceStr}
                </Text>
              )}
              <Text style={[styles.searchResultAddress, { color: secondaryText }]} numberOfLines={1}>
                {addressStr}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <TouchableWithoutFeedback onPress={() => setShowSearchPanel(false)}>
        <View style={styles.searchPanelOverlay}>
          <View style={[styles.searchPanelContainer, { backgroundColor: cardBg }]}>
            <FlatList
              data={data}
              renderItem={renderItem}
              keyExtractor={(item) => item.id || item._id || Math.random().toString()}
              showsVerticalScrollIndicator={false}
              style={styles.searchPanelList}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.map}
          geolocationEnabled={false}
          onLoadEnd={handleLoadEnd}
          onError={() => setLoading(false)}
          onMessage={handleMessage}
        />

        {searchExpanded && (
          <TouchableWithoutFeedback onPress={() => { if (searchExpanded) toggleSearch(); }}>
            <View style={styles.touchOutsideOverlay} />
          </TouchableWithoutFeedback>
        )}

        {showCompass && (
          <View style={styles.compassContainer}>
            <TouchableOpacity style={styles.compassCloseBtn} onPress={toggleCompass}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
            <Compass theme={theme} onHeadingChange={handleHeadingChange} mapBearing={mapBearing} />
          </View>
        )}

        <View style={[styles.topOverlay, { backgroundColor: 'transparent' }]}>
          <View style={styles.iconsColumnAll}>
            <Animated.View style={[styles.searchWrapper, { width: searchContainerWidth }]}>
              {!searchExpanded ? (
                <TouchableOpacity
                  ref={searchIconRef}
                  onPress={toggleSearch}
                  style={[
                    styles.searchIconButton,
                    { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }
                  ]}
                >
                  <Ionicons name="search" size={28} color={textColor} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.expandedSearchContainer, { backgroundColor: searchBackground, borderColor: searchBorder }]}>
                  <Ionicons name="search" size={20} color={secondaryText} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder={t.searchPlaceholder}
                    placeholderTextColor={secondaryText}
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) {
                        setShowSearchPanel(true);
                        performSearch(searchQuery);
                      }
                    }}
                    returnKeyType="search"
                    onSubmitEditing={handleSearchSubmit}
                    autoFocus={true}
                  />
                  {searchQuery !== '' && (
                    <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                      <Ionicons name="close-circle" size={20} color={secondaryText} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={locateUser} style={styles.locationBtn}>
                    <Ionicons name="locate" size={24} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleSearch} style={styles.closeSearchBtn}>
                    <Ionicons name="close" size={20} color={secondaryText} />
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            <TouchableOpacity
              ref={savedBtnRef}
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={handleSavedLocationsPress}
            >
              <Ionicons name="heart-outline" size={28} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              ref={myShopsBtnRef}
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={openMyShops}
            >
              <MaterialCommunityIcons name="store-outline" size={28} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              ref={locateBtnRef}
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={locateUser}
            >
              <Ionicons name="locate" size={28} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={zoomInMap}
            >
              <Ionicons name="add-circle-outline" size={28} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={zoomOutMap}
            >
              <Ionicons name="remove-circle-outline" size={28} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={rotateMapLeft}
            >
              <FontAwesome5 name="undo" size={24} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={rotateMapRight}
            >
              <FontAwesome5 name="redo" size={24} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              ref={compassBtnRef}
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
              onPress={toggleCompass}
            >
              <FontAwesome5 name="compass" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>

        {renderSearchPanel()}

        {isRouteActive.current && distanceKm !== null && (
          <View style={[styles.infoBox, { backgroundColor: cardBg }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.distanceText, { color: textColor }]}>
                <Ionicons name="location" size={24} color="red" />{' '}
                {distanceKm.toFixed(1)} {t.km}
              </Text>
              <TouchableOpacity onPress={clearRoute} style={styles.clearRouteBtn}>
                <Ionicons name="close" size={22} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.modeColumn}>
              {['walking', 'bicycle', 'motorcycle', 'car'].map(renderModeItem)}
            </View>
          </View>
        )}

        {renderMyShopsSheet()}
        {renderSavedPlacesSheet()}

        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: overlayColor }]}>
            <ShaakaLoadingScreen
              message={t.loading}
              backgroundColor={overlayColor}
              textColor={textColor}
            />
          </View>
        )}

        {/* ============ LOCATE TUTORIAL ============ */}
        <ScreenTutorialOverlay
          visible={showTutorial}
          steps={tutorialSteps}
          isDarkMode={isDarkMode}
          language={language}
          padding={5}
          dimOpacity={0}
          onFinish={finishTutorial}
        />
      </View>
    </SafeAreaView>
  );
}

// ----- Styles (unchanged) -----
const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10000, elevation: 10000, justifyContent: 'center', alignItems: 'center',
  },
  touchOutsideOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 5, backgroundColor: 'transparent',
  },
  compassContainer: {
    position: 'absolute', bottom: 0, left: 0, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  compassCloseBtn: { alignSelf: 'flex-end', padding: 4 },
  topOverlay: {
    position: 'absolute', top: 10, left: 0, paddingLeft: 16, zIndex: 6,
    flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start',
  },
  iconsColumnAll: {
    flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', marginTop: 4,
  },
  headerIconBtn: {
    padding: 6, marginBottom: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  searchWrapper: {
    alignItems: 'center', justifyContent: 'center',
    height: 46, overflow: 'hidden', marginBottom: 8,
    zIndex: 10, position: 'absolute', left: 50,
  },
  searchIconButton: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  expandedSearchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderBottomWidth: 2,
    paddingHorizontal: 14, height: 46, minWidth: 180,
    shadowColor: '#00000001', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4, width: '100%',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  clearBtn: { marginLeft: 8, padding: 4 },
  locationBtn: { marginLeft: 8, padding: 4 },
  closeSearchBtn: { marginLeft: 8, padding: 4 },
  infoBox: {
    position: 'absolute', bottom: 0, right: 0, padding: 14,
    borderTopLeftRadius: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
    minWidth: 200, maxWidth: 300, zIndex: 6,
  },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  distanceText: { fontSize: 16, fontWeight: '700' },
  clearRouteBtn: { padding: 4 },
  modeColumn: { flexDirection: 'column', gap: 6 },
  modeItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 16, borderWidth: 1, marginBottom: 4,
  },
  modeIcon: { marginRight: 8 },
  modeName: { fontSize: 14, fontWeight: '500', flex: 1 },
  modeTime: { fontSize: 13, fontWeight: '400', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  myShopsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  myShopsSheet: {
    width: '100%',
    maxHeight: '80%',
    minHeight: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    alignSelf: 'center', width: 42, height: 5,
    borderRadius: 3, marginBottom: 16, opacity: 0.5,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingHorizontal: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  myShopsList: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  myShopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    minHeight: 68,
  },
  myShopIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  myShopInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  myShopTexts: { marginLeft: 0, flex: 1, justifyContent: 'center' },
  myShopName: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  myShopAddress: { fontSize: 13 },
  myShopActionBtn: { padding: 8, marginLeft: 6 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, textAlign: 'center', marginTop: 12 },
  emptySubText: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  addShopBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 20 },
  addShopBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  savedPlacesList: { paddingBottom: 20 },
  savedPlaceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5,
  },
  savedPlaceInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  savedPlaceTexts: { marginLeft: 12, flex: 1 },
  savedPlaceName: { fontSize: 18, fontWeight: '500' },
  savedPlaceAddress: { fontSize: 14 },
  searchPanelOverlay: {
    position: 'absolute', top: 80, left: 16, right: 16,
    zIndex: 8, elevation: 8, pointerEvents: 'box-none',
  },
  searchPanelContainer: {
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
    maxHeight: height * 0.4, pointerEvents: 'auto',
  },
  searchPanelList: { flexGrow: 0 },
  searchResultCard: { borderBottomWidth: 0.5, paddingVertical: 8 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center' },
  searchResultIcon: { marginRight: 10 },
  searchResultTexts: { flex: 1 },
  searchResultName: { fontSize: 15, fontWeight: '500' },
  searchResultMatch: { fontSize: 13, fontWeight: '400' },
  searchResultAddress: { fontSize: 12 },
  searchEmpty: { paddingVertical: 20, alignItems: 'center' },
  searchEmptyText: { fontSize: 14 },
  mallShopIconContainer: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10, backgroundColor: 'transparent',
  },
  mallShopIconDark: { backgroundColor: '#000000' },
});

export default LocateScreen;