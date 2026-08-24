// screens/AddPlaceScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { normalizeRwandaPhone, isValidRwandaPhone, formatPhoneInput } from '../utils/phoneNormalizer';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.35;
const CATEGORY_ICON_SIZE = 28;
const BOTTOM_SHEET_HEIGHT = height * 0.75;

// ---------- Translations ----------
const translations = {
  English: {
    addPlace: 'Add Place',
    step1: 'Choose Location',
    step1Sub: 'Tap on the map or drag to select your place\'s location. Existing places are shown in grey.',
    step2: 'Choose Category',
    step2Sub: 'Select the category that best fits your place.',
    step3: 'Business Information',
    step3Sub: 'Fill in the details of your place.',
    step4: 'Street Image',
    step4Sub: 'Upload a street image for your place.',
    step5: 'Preview & Publish',
    step5Sub: 'Review your place before publishing.',
    searchPlaceholder: 'Search places in Rwanda...',
    addressCountry: 'Country:',
    addressProvince: 'Province:',
    addressDistrict: 'District:',
    addressSector: 'Sector:',
    addressCell: 'Cell:',
    addressVillage: 'Village:',
    addressStreet: 'Street:',
    addressSelected: 'Selected Location ✓',
    addressLoading: 'Getting address...',
    addressHint: 'Move map or click to select location',
    category: 'Category',
    name: 'Business / Place Name *',
    description: 'Description (max 500 chars)',
    phone: 'Phone Number',
    whatsapp: 'WhatsApp Number',
    email: 'Email',
    website: 'Website',
    openingTime: 'Opening Time',
    closingTime: 'Closing Time',
    streetName: 'Street Name',
    buildingNumber: 'Building Number (optional)',
    streetImage: 'Street Image *',
    uploadStreet: 'Upload Street Image',
    products: 'Products (optional)',
    productName: 'Product name',
    productPrice: 'Price (RWF)',
    addProduct: 'Add Product',
    updateProduct: 'Update Product',
    addedProducts: 'Added Products:',
    imageCount: 'image(s)',
    previewButton: 'Preview',
    publish: 'Publish Place',
    publishing: 'Publishing',
    publishProgress: 'Publishing {progress}%',
    back: 'Back',
    next: 'Next',
    success: 'Success',
    placePublished: 'Place Published Successfully!',
    missing: 'Missing',
    locationMissing: 'Please select a location on the map.',
    categoryMissing: 'Please select a category.',
    nameMissing: 'Please enter a business/place name.',
    imageMissing: 'Please upload a street image.',
    productMissing: 'Please provide product name, price, and at least one image.',
    error: 'Error',
    loginRequired: 'You must be logged in to publish.',
    publishFailed: 'Failed to publish. Please try again.',
    limitReached: 'Limit Reached',
    limitMessage: 'You already have a place registered. You can only add one place per account.\n\nIf you want to change your place, please delete the existing one first.',
    permissionDenied: 'Permission Denied',
    locationAccess: 'We need location access.',
    locationError: 'Could not get your location.',
    addressError: 'Could not get address details.',
    imagePermission: 'Please grant permission to access your photos.',
    preview: 'Preview',
    previewName: 'Untitled Place',
    previewOwner: 'Owner',
    noPhone: 'No phone',
    previewStatus: 'Open',
    call: 'Call',
    direction: 'Direction',
    phoneError: 'Phone must start with 07 and be exactly 10 digits',
    locating: 'Locating...',
    pleaseWait: 'Locating your position... Please wait...',
    geocodingFailed: 'Geocoding failed.',
    noPlacesFound: 'No places found in Rwanda for: ',
  },
  Kinyarwanda: {
    addPlace: 'Ongera ahantu',
    step1: 'Hitamo aho',
    step1Sub: 'Kanda ku ikarita cyangwa ukurure kugirango uhitemo ahantu. Ahantu hahari hagaragazwa n\'ibara ry\'umukara.',
    step2: 'Hitamo icyiciro',
    step2Sub: 'Hitamo icyiciro gikwiriye aha hantu.',
    step3: 'Amakuru y\'ubucuruzi',
    step3Sub: 'Uzuza amakuru y\'aha hantu.',
    step4: 'Ifoto y\'umuhanda',
    step4Sub: 'Shyira ifoto y\'umuhanda w\'aha hantu.',
    step5: 'Reba & Tangaza',
    step5Sub: 'Reba aha hantu mbere yo gutangaza.',
    searchPlaceholder: 'Shakisha ahantu mu Rwanda...',
    addressCountry: 'Igihugu:',
    addressProvince: 'Intara:',
    addressDistrict: 'Akarere:',
    addressSector: 'Umurenge:',
    addressCell: 'Akagali:',
    addressVillage: 'Umudugudu:',
    addressStreet: 'Umuhanda:',
    addressSelected: 'Ahantu hamaze gutoranywa ✓',
    addressLoading: 'Turabona aderesi...',
    addressHint: 'Himba ikarita cyangwa kanda kuri aho hantu',
    category: 'Icyiciro',
    name: 'Izina ry\'ubucuruzi / Ahantu *',
    description: 'Ibisobanuro (ntagisumvwa 500)',
    phone: 'Numero ya telefoni',
    whatsapp: 'Numero ya WhatsApp',
    email: 'Imeyili',
    website: 'Urubuga',
    openingTime: 'Isaha yo gufungura',
    closingTime: 'Isaha yo gufunga',
    streetName: 'Izina ry\'umuhanda',
    buildingNumber: 'Numero y\'inyubako (bitari ngombwa)',
    streetImage: 'Ifoto y\'umuhanda *',
    uploadStreet: 'Shyira ifoto y\'umuhanda',
    products: 'Ibicuruzwa (bitari ngombwa)',
    productName: 'Izina ry\'igicuruzwa',
    productPrice: 'Igiciro (FRW)',
    addProduct: 'Ongera igicuruzwa',
    updateProduct: 'Hindura igicuruzwa',
    addedProducts: 'Ibicuruzwa byongewe:',
    imageCount: 'amashusho',
    previewButton: 'Reba mbere',
    publish: 'Tangaza',
    publishing: 'Iratangazwa',
    publishProgress: 'Iratangazwa {progress}%',
    back: 'Subira inyuma',
    next: 'Komeza',
    success: 'Byakunze',
    placePublished: 'Ahantu hatanzwe neza!',
    missing: 'Ibyuzuzwa',
    locationMissing: 'Hitamo ahantu ku ikarita.',
    categoryMissing: 'Hitamo icyiciro.',
    nameMissing: 'Andika izina ry\'ubucuruzi/ahantu.',
    imageMissing: 'Shyira ifoto y\'umuhanda.',
    productMissing: 'Uzuza izina, igiciro, n\'ifoto by\'igicuruzwa.',
    error: 'Ikibazo',
    loginRequired: 'Ugomba kwinjira kugira ngo utangaze.',
    publishFailed: 'Kutanga byanze. Ongera ugerageze.',
    limitReached: 'Imipaka yagezweho',
    limitMessage: 'Ufite ahantu hamaze kwandikwa. Ushobora kongeramo ahantu hamwe gusa kuri konti imwe.\n\nNiba ushaka guhindura, siba aha hantu mbere.',
    permissionDenied: 'Uruhushya rwabaye impamvu',
    locationAccess: 'Dukeneye uruhushya rw\'ahantu.',
    locationError: 'Ntibyashobotse kubona ahantu.',
    addressError: 'Ntibyashobotse kubona aderesi.',
    imagePermission: 'Tangire uruhushya rwo gufata amashusho.',
    preview: 'Reba',
    previewName: 'Ahantu kitazwi',
    previewOwner: 'Nyir\'ahantu',
    noPhone: 'Nta telefoni',
    previewStatus: 'Ifunguye',
    call: 'Guhamagara',
    direction: 'Inzira',
    phoneError: 'Numero igomba gutangira na 07 kandi ibe imibare 10',
    locating: 'Turahashakisha...',
    pleaseWait: 'Turashakisha ahantu... Nyamuneka tegereza...',
    geocodingFailed: 'Gushakisha byanze.',
    noPlacesFound: 'Nta hantu habonetse mu Rwanda hita: ',
  },
};

// ----- Full categories (admin-restricted) -----
const ALL_CATEGORIES = [
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
  { id: 'temple', label: 'Temple', icon: 'temple' },
  { id: 'hospital', label: 'Hospital', icon: 'hospital' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'medical-bag' },
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

const ADMIN_ONLY_CATEGORIES = ['police', 'house', 'airport', 'train', 'government', 'shoppingmall'];

export default function AddPlaceScreen({ navigation, route, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const { refreshUser } = useAuth();
  const adminLimits = useUserLimits();
  const t = translations[language] || translations.English;

  // ----- Step & Form State -----
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);

  // ----- Map & Location (Step 1) -----
  const webViewRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: -1.507005,
    longitude: 29.641789,
  });
  const [address, setAddress] = useState({
    country: '', province: '', district: '', sector: '', cell: '', village: '', street: '', full: '',
  });
  const [addressLoading, setAddressLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // ----- Search -----
  const [searchQuery, setSearchQuery] = useState('');

  // ----- Category -----
  const [selectedCategory, setSelectedCategory] = useState(null);

  // ----- Business Info -----
  const [form, setForm] = useState({
    name: '', description: '', phone: '', whatsapp: '', email: '', website: '',
    openingTime: '', closingTime: '', streetName: '', buildingNumber: '',
  });
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(false);

  // ----- Products & Images -----
  const [streetImage, setStreetImage] = useState(null);
  const [products, setProducts] = useState([]);
  const [currentProduct, setCurrentProduct] = useState({ name: '', price: '', images: [] });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // ----- Extras -----
  const [extras, setExtras] = useState({});
  const [contactButtons, setContactButtons] = useState({});
  const [socialLinks, setSocialLinks] = useState({});

  // ----- Preview Bottom Sheet -----
  const [showPreview, setShowPreview] = useState(false);
  const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;

  // ----- Current user -----
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ----- Existing places and shops -----
  const [existingPlaces, setExistingPlaces] = useState([]);
  const [existingShops, setExistingShops] = useState([]);

  // ----- Theme colors -----
  const backgroundColor = theme.background;
  const textColor = theme.text;
  const inputBg = isDarkMode ? theme.cardBackground : '#f8f8f8';
  const borderColor = theme.border;
  const cardBg = theme.cardBackground;
  const secondaryText = theme.textSecondary;
  const accentColor = theme.accent;

  const isShoppingMall = selectedCategory === 'shoppingmall';
  const [visibleCategories, setVisibleCategories] = useState([]);

  // ----- PanResponder for bottom sheet -----
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.8) closePreview();
        else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
      },
    })
  ).current;

  // ----- Bottom sheet animation -----
  useEffect(() => {
    if (showPreview) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: BOTTOM_SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showPreview]);

  const openPreview = () => setShowPreview(true);
  const closePreview = () => setShowPreview(false);

  // ----- Fetch current user -----
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        await refreshUser();
        const token = await AsyncStorage.getItem('userToken');
        if (!token) { setLoadingUser(false); return; }
        const response = await axios.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data.success) {
          const user = response.data.user;
          setCurrentUser(user);
          const isAdmin = user.role === 'admin';
          setVisibleCategories(isAdmin ? ALL_CATEGORIES : ALL_CATEGORIES.filter(c => !ADMIN_ONLY_CATEGORIES.includes(c.id)));
        }
      } catch (error) {
        setVisibleCategories(ALL_CATEGORIES.filter(c => !ADMIN_ONLY_CATEGORIES.includes(c.id)));
      } finally {
        setLoadingUser(false);
      }
    };
    fetchCurrentUser();
  }, []);

  // ----- Fetch existing places and shops -----
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [placesRes, shopsRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/places`, { headers }),
          axios.get(`${BASE_URL}/api/mall-shops`, { headers }),
        ]);
        setExistingPlaces(placesRes.data.places || []);
        setExistingShops(shopsRes.data.shops || []);
      } catch (error) {
        console.error('Error fetching existing places/shops:', error);
      }
    };
    fetchExisting();
  }, []);

  // ----- Send existing markers to map -----
  useEffect(() => {
    if (!mapLoaded || !webViewRef.current) return;
    if (existingPlaces.length === 0 && existingShops.length === 0) return;

    const allMarkers = [];
    existingPlaces.forEach(p => {
      const lat = p.location?.latitude || p.lat;
      const lon = p.location?.longitude || p.lon;
      if (lat && lon) allMarkers.push({ lat, lon, name: p.name, type: 'place', id: p._id, category: p.category });
    });
    existingShops.forEach(s => {
      if (s.lat && s.lon) allMarkers.push({ lat: s.lat, lon: s.lon, name: s.name, type: 'shop', id: s._id });
    });

    webViewRef.current.injectJavaScript(`
      if (window.addExistingMarkers) {
        window.addExistingMarkers(${JSON.stringify(allMarkers)});
      }
    `);
  }, [mapLoaded, existingPlaces, existingShops]);

  // ----- Phone validation -----
  const validatePhone = (phone) => {
    if (!phone) return true;
    return isValidRwandaPhone(phone);
  };

  // ----- Map HTML -----
  const tileUrl = isDarkMode
    ? 'https://api.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=ad15f28266904ce28f417e5f7b45e832'
    : 'https://api.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=ad15f28266904ce28f417e5f7b45e832';

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
        .existing-place-marker {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px; cursor: default;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const baseStyle = { 
          version: 8, 
          sources: { 'tf-tiles': { type: 'raster', tiles: ['${tileUrl}'], tileSize: 256, attribution: '&copy; OpenStreetMap contributors &copy; Thunderforest' } }, 
          layers: [{ id: 'tf-tiles-layer', type: 'raster', source: 'tf-tiles', minzoom: 0, maxzoom: 20 }] 
        };
        const rwandaBounds = [[28.8, -2.8], [30.9, -1.0]];
        let map, marker;

        try {
          map = new maplibregl.Map({
            container: 'map', style: baseStyle, center: [29.641789, -1.507005],
            zoom: 17, minZoom: 10, maxZoom: 18.9, pitch: 0, bearing: 0
          });
          map.setMaxBounds(rwandaBounds);
          window.mapInstance = map;

          map.addControl(new maplibregl.NavigationControl({
            showCompass: true, showZoom: true, visualizePitch: true
          }), 'top-left');

          window.zoomInMap = function() { if (map) map.zoomIn(); };
          window.zoomOutMap = function() { if (map) map.zoomOut(); };
          window.rotateMap = function(degrees) {
            if (map) { const current = map.getBearing(); map.setBearing(current + degrees); }
          };
          window.resetBearing = function() { if (map) map.setBearing(0); };

          marker = new maplibregl.Marker({ color: '${accentColor}' })
            .setLngLat([29.641789, -1.507005]).addTo(map);

          function updateLocation() {
            const center = map.getCenter();
            marker.setLngLat([center.lng, center.lat]);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'location', latitude: center.lat, longitude: center.lng
            }));
          }
          map.on('moveend', updateLocation);
          map.on('click', function(e) {
            const { lng, lat } = e.lngLat;
            map.flyTo({ center: [lng, lat], zoom: map.getZoom() });
          });

          window.searchPlace = function(query) {
            if (!query || query.trim() === '') return;
            const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' 
                        + encodeURIComponent(query) + '&countrycodes=RW&limit=1';
            fetch(url)
              .then(response => response.json())
              .then(data => {
                if (data && data.length > 0) {
                  const lon = parseFloat(data[0].lon), lat = parseFloat(data[0].lat);
                  map.flyTo({ center: [lon, lat], zoom: 17 });
                } else { alert('${t.noPlacesFound}' + query); }
              })
              .catch(() => alert('${t.geocodingFailed}'));
          };

          window.flyToLocation = function(lat, lon) {
            if (map && marker) {
              map.flyTo({ center: [lon, lat], zoom: 17 });
              marker.setLngLat([lon, lat]);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location', latitude: lat, longitude: lon
              }));
            }
          };

          window.requestLocation = function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestLocation' }));
          };

          window.addExistingMarkers = function(markersData) {
            markersData.forEach(m => {
              const el = document.createElement('div');
              el.className = 'existing-place-marker';
              const catColors = {
                shop: '#FF9500', restaurant: '#FF3B30', hotel: '#007AFF', hospital: '#FF2D55',
                school: '#5856D6', bank: '#34C759', church: '#AF52DE', mosque: '#5AC8FA',
                supermarket: '#FFCC00', default: '#8E8E93'
              };
              el.style.backgroundColor = catColors[m.category] || catColors.default;
              el.innerHTML = '<i class="mdi mdi-map-marker" style="font-size:12px;"></i>';
              el.title = m.name || '';
              new maplibregl.Marker({ element: el }).setLngLat([m.lon, m.lat]).addTo(map);
            });
          };

          setTimeout(() => {
            const center = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'location', latitude: center.lat, longitude: center.lng
            }));
          }, 1000);
        } catch (e) { console.log("Map Error: " + e.message); }
      </script>
    </body>
    </html>
  `;

  // ----- Reverse geocode -----
  const reverseGeocode = async (lat, lon) => {
    setAddressLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const response = await axios.get(url, { headers: { 'User-Agent': 'SHAAKA-App/1.0' } });
      const data = response.data;
      if (data?.address) {
        const addr = data.address;
        setAddress({
          country: addr.country || '', province: addr.state || addr.province || '',
          district: addr.district || addr.county || '', sector: addr.suburb || addr.neighbourhood || '',
          cell: addr.city || addr.town || '', village: addr.village || addr.hamlet || '',
          street: addr.road || '', full: data.display_name || '',
        });
      } else {
        setAddress({ country: '', province: '', district: '', sector: '', cell: '', village: '', street: '', full: '' });
      }
    } catch (error) {
      Alert.alert(t.error, t.addressError);
    } finally {
      setAddressLoading(false);
    }
  };

  // ----- Handle messages -----
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location') {
        setSelectedLocation({ latitude: data.latitude, longitude: data.longitude });
        reverseGeocode(data.latitude, data.longitude);
      } else if (data.type === 'requestLocation') {
        locateUser();
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  };

  // ----- Locate user -----
  const locateUser = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.permissionDenied, t.locationAccess);
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setSelectedLocation({ latitude, longitude });
      reverseGeocode(latitude, longitude);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.flyToLocation) { window.flyToLocation(${latitude}, ${longitude}); }
        `);
      }
    } catch (error) {
      Alert.alert(t.error, t.locationError);
    } finally {
      setIsLocating(false);
    }
  };

  // ----- Map controls -----
  const zoomInMap = () => {
    if (webViewRef.current) webViewRef.current.injectJavaScript('window.zoomInMap();');
  };
  const zoomOutMap = () => {
    if (webViewRef.current) webViewRef.current.injectJavaScript('window.zoomOutMap();');
  };
  const rotateMapLeft = () => {
    if (webViewRef.current) webViewRef.current.injectJavaScript('window.rotateMap(-15);');
  };
  const rotateMapRight = () => {
    if (webViewRef.current) webViewRef.current.injectJavaScript('window.rotateMap(15);');
  };

  // ----- Search on map -----
  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.searchPlace) { window.searchPlace('${searchQuery.replace(/'/g, "\\'")}'); }
      `);
    }
  };

  // ----- Step management -----
  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  // ----- Form handlers -----
  const updateForm = (key, value) => setForm({ ...form, [key]: value });
  const handlePhoneChange = (key, text) => {
    const formatted = formatPhoneInput(text);
    if (key === 'phone') {
      setForm(prev => ({
        ...prev,
        phone: formatted,
        ...(whatsappSameAsPhone ? { whatsapp: formatted } : {}),
      }));
    } else {
      setForm(prev => ({ ...prev, [key]: formatted }));
    }
  };

  // ----- Image pickers -----
  const pickStreetImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.permissionDenied, t.imagePermission); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    if (!result.canceled) setStreetImage(result.assets[0].uri);
  };

  const pickProductImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.permissionDenied, t.imagePermission); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map(asset => ({ uri: asset.uri, type: 'image/jpeg', name: `product_${Date.now()}_${Math.random()}.jpg` }));
      setCurrentProduct({ ...currentProduct, images: [...currentProduct.images, ...newImages] });
    }
  };

  const removeProductImage = (index) => {
    const updated = [...currentProduct.images];
    updated.splice(index, 1);
    setCurrentProduct({ ...currentProduct, images: updated });
  };

  // ----- Product CRUD -----
  const addProduct = () => {
    if (!currentProduct.name.trim() || !currentProduct.price || currentProduct.images.length === 0) {
      Alert.alert(t.missing, t.productMissing); return;
    }
    if (editingProductIndex !== null) {
      const updated = [...products];
      updated[editingProductIndex] = { ...currentProduct };
      setProducts(updated);
      setEditingProductIndex(null);
    } else {
      setProducts([...products, { ...currentProduct }]);
    }
    setCurrentProduct({ name: '', price: '', images: [] });
  };

  const removeProduct = (index) => {
    const updated = [...products];
    updated.splice(index, 1);
    setProducts(updated);
    if (editingProductIndex === index) {
      setEditingProductIndex(null);
      setCurrentProduct({ name: '', price: '', images: [] });
    }
  };

  const editProduct = (index) => {
    setCurrentProduct({ ...products[index] });
    setEditingProductIndex(index);
  };

  // ----- Validation -----
  const validateStep = () => {
    if (step === 1 && !address.full) { Alert.alert(t.missing, t.locationMissing); return false; }
    if (step === 2 && !selectedCategory) { Alert.alert(t.missing, t.categoryMissing); return false; }
    if (step === 3) {
      if (!form.name.trim()) { Alert.alert(t.missing, t.nameMissing); return false; }
      if (form.phone && !validatePhone(form.phone)) { Alert.alert(t.error, t.phoneError); return false; }
      if (form.whatsapp && !validatePhone(form.whatsapp)) { Alert.alert(t.error, t.phoneError); return false; }
    }
    if (step === 4 && !streetImage) { Alert.alert(t.missing, t.imageMissing); return false; }
    return true;
  };

  // ----- Publish -----
  const publishPlace = async () => {
    if (!validateStep()) return;
    setPublishing(true);
    setProgress(0);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) { Alert.alert(t.error, t.loginRequired); setPublishing(false); return; }
      
      // One-type-only check: verify user does not already have a shopping mall shop
      const mallShopsRes = await axios.get(`${BASE_URL}/api/mall-shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allMallShops = mallShopsRes.data.shops || [];
      const userMallShops = allMallShops.filter(s => {
        const ownerId = s.ownerId?._id || s.ownerId;
        return ownerId === currentUser?._id;
      });
      if (userMallShops.length > 0) {
        Alert.alert(t.limitReached, 'You already have a Shopping Mall Shop. You cannot add a Shop/Place.');
        setPublishing(false);
        return;
      }

      const userPlacesResponse = await axios.get(`${BASE_URL}/api/places`, { headers: { Authorization: `Bearer ${token}` } });
      const allPlaces = userPlacesResponse.data.places || [];
      const userPlaces = allPlaces.filter(p => p.userId === currentUser?._id);
      if (userPlaces.length > 0) { Alert.alert(t.limitReached, t.limitMessage); setPublishing(false); return; }

      let streetImageUrl = null;
      if (streetImage) {
        const formData = new FormData();
        formData.append('image', { uri: streetImage, type: 'image/jpeg', name: 'street.jpg' });
        const uploadRes = await axios.post(`${BASE_URL}/api/places/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
        });
        if (uploadRes.data.success) streetImageUrl = uploadRes.data.url;
      }

      let uploadedProducts = [];
      if (!isShoppingMall && products.length > 0) {
        uploadedProducts = await Promise.all(products.map(async (product) => {
          const productImagesUrls = await Promise.all(product.images.map(async (img) => {
            const formData = new FormData();
            formData.append('image', { uri: img.uri, type: 'image/jpeg', name: 'product.jpg' });
            const res = await axios.post(`${BASE_URL}/api/places/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
            });
            return res.data.url;
          }));
          return { name: product.name, price: parseFloat(product.price), description: product.description || '', images: productImagesUrls };
        }));
      }

      const payload = {
        name: form.name, description: form.description, category: selectedCategory,
        location: selectedLocation, address,
        contact: {
          phone: normalizeRwandaPhone(form.phone) || form.phone,
          whatsapp: form.whatsapp ? (normalizeRwandaPhone(form.whatsapp) || form.whatsapp) : '',
          email: form.email, website: form.website,
        },
        openingTime: form.openingTime, closingTime: form.closingTime,
        streetName: form.streetName, buildingNumber: form.buildingNumber,
        images: { street: streetImageUrl }, products: uploadedProducts,
        extras, contactButtons, socialLinks,
      };

      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(i);
      }

      const response = await axios.post(`${BASE_URL}/api/places`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        Alert.alert(t.success, t.placePublished);
        navigation.navigate('Locate');
      } else {
        throw new Error(response.data.message || 'Publish failed');
      }
    } catch (error) {
      Alert.alert(t.error, error.response?.data?.message || t.publishFailed);
    } finally {
      setPublishing(false);
      setProgress(0);
    }
  };

  // ----- Render step indicator -----
  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {[1, 2, 3, 4, 5].map((s) => (
        <View key={s} style={styles.stepWrapper}>
          <View style={[styles.stepCircle, { backgroundColor: step >= s ? accentColor : borderColor, borderColor }]}>
            <Text style={[styles.stepNumber, { color: step >= s ? '#fff' : textColor }]}>{s}</Text>
          </View>
          {s < 5 && <View style={[styles.stepLine, { backgroundColor: step > s ? accentColor : borderColor }]} />}
        </View>
      ))}
    </View>
  );

  // ----- Render step content -----
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step1}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step1Sub}</Text>

            <View style={styles.mapWrapper}>
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.map}
                onMessage={handleMessage}
                onLoadEnd={() => setMapLoaded(true)}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
              <View style={styles.markerOverlay} pointerEvents="none">
                <MaterialCommunityIcons name="map-marker" size={40} color={accentColor} />
              </View>

              {/* Map Controls Overlay */}
              <View style={styles.mapControlsOverlay}>
                <View style={styles.mapControlsColumn}>
                  <TouchableOpacity
                    style={[styles.mapControlBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
                    onPress={locateUser}
                    disabled={isLocating}
                  >
                    {isLocating ? (
                      <ActivityIndicator size="small" color={textColor} />
                    ) : (
                      <Ionicons name="locate" size={24} color={textColor} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
                    onPress={zoomInMap}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
                    onPress={zoomOutMap}
                  >
                    <Ionicons name="remove-circle-outline" size={24} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
                    onPress={rotateMapLeft}
                  >
                    <FontAwesome5 name="undo" size={20} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlBtn, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}
                    onPress={rotateMapRight}
                  >
                    <FontAwesome5 name="redo" size={20} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.mapControls}>
              <View style={[styles.searchContainer, { backgroundColor: inputBg, borderColor }]}>
                <Ionicons name="search" size={20} color={secondaryText} />
                <TextInput
                  style={[styles.searchInput, { color: textColor }]}
                  placeholder={t.searchPlaceholder}
                  placeholderTextColor={secondaryText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
              {isLocating && (
                <Text style={[styles.locatingText, { color: secondaryText }]}>
                  {t.locating} {t.pleaseWait}
                </Text>
              )}
            </View>

            <View style={styles.addressContainer}>
              {addressLoading ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : address.full ? (
                <>
                  {['country', 'province', 'district', 'sector', 'cell', 'village', 'street'].map((field) => (
                    <View key={field} style={styles.addressRow}>
                      <Text style={[styles.addressLabel, { color: textColor }]}>
                        {t[`address${field.charAt(0).toUpperCase() + field.slice(1)}`]}
                      </Text>
                      <Text style={[styles.addressValue, { color: textColor }]}>{address[field]}</Text>
                    </View>
                  ))}
                  <View style={styles.addressSuccess}>
                    <Ionicons name="checkmark-circle" size={20} color={accentColor} />
                    <Text style={[styles.addressSuccessText, { color: accentColor }]}>{t.addressSelected}</Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.addressPlaceholder, { color: secondaryText }]}>{t.addressHint}</Text>
              )}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step2}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step2Sub}</Text>
            <FlatList
              data={visibleCategories}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.categoryCard, {
                      backgroundColor: isSelected ? accentColor : (isDarkMode ? theme.cardBackground : '#f0f0f0'),
                      borderColor: isSelected ? accentColor : borderColor,
                    }]}
                    onPress={() => setSelectedCategory(isSelected ? null : item.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={item.icon} size={CATEGORY_ICON_SIZE} color={isSelected ? '#fff' : textColor} />
                    <Text style={[styles.categoryLabel, { color: isSelected ? '#fff' : textColor }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={item => item.id}
              numColumns={3}
              columnWrapperStyle={styles.categoryRow}
              scrollEnabled={false}
            />
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step3}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step3Sub}</Text>
            {['name', 'description', 'phone', 'whatsapp', 'email', 'website'].map((field) => (
              <TextInput
                key={field}
                style={[styles.input, field === 'description' && styles.textArea, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder={t[field]}
                placeholderTextColor={secondaryText}
                multiline={field === 'description'}
                numberOfLines={field === 'description' ? 4 : 1}
                maxLength={field === 'description' ? 500 : field === 'phone' || field === 'whatsapp' ? 10 : undefined}
                keyboardType={field === 'phone' || field === 'whatsapp' ? 'phone-pad' : field === 'email' ? 'email-address' : 'default'}
                value={form[field]}
                onChangeText={text => field === 'phone' || field === 'whatsapp' ? handlePhoneChange(field, text) : updateForm(field, text)}
              />
            ))}
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder={t.openingTime} placeholderTextColor={secondaryText}
                value={form.openingTime} onChangeText={text => updateForm('openingTime', text)}
              />
              <TextInput
                style={[styles.input, styles.timeInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder={t.closingTime} placeholderTextColor={secondaryText}
                value={form.closingTime} onChangeText={text => updateForm('closingTime', text)}
              />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder={t.streetName} placeholderTextColor={secondaryText}
              value={form.streetName} onChangeText={text => updateForm('streetName', text)}
            />
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder={t.buildingNumber} placeholderTextColor={secondaryText}
              value={form.buildingNumber} onChangeText={text => updateForm('buildingNumber', text)}
            />
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step4}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step4Sub}</Text>
            <Text style={[styles.imageLabel, { color: textColor }]}>{t.streetImage}</Text>
            <TouchableOpacity style={[styles.imageUploadBox, { borderColor }]} onPress={pickStreetImage}>
              {streetImage ? (
                <Image source={{ uri: streetImage }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={40} color={secondaryText} />
                  <Text style={{ color: secondaryText, marginTop: 8 }}>{t.uploadStreet}</Text>
                </View>
              )}
            </TouchableOpacity>
            {!isShoppingMall && (
              <>
                <Text style={[styles.productSectionTitle, { color: textColor, marginTop: 16 }]}>{t.products}</Text>
                <View style={[styles.productForm, { borderColor }]}>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                    placeholder={t.productName} placeholderTextColor={secondaryText}
                    value={currentProduct.name} onChangeText={(text) => setCurrentProduct({ ...currentProduct, name: text })}
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                    placeholder={t.productPrice} placeholderTextColor={secondaryText}
                    keyboardType="numeric" value={currentProduct.price}
                    onChangeText={(text) => setCurrentProduct({ ...currentProduct, price: text })}
                  />
                  <View style={styles.productImagePicker}>
                    <Text style={[styles.productImageLabel, { color: textColor }]}>Images:</Text>
                    <TouchableOpacity style={[styles.addImageBtn, { borderColor }]} onPress={pickProductImages}>
                      <Ionicons name="add" size={24} color={accentColor} />
                      <Text style={{ color: accentColor, marginLeft: 8 }}>Add Images</Text>
                    </TouchableOpacity>
                  </View>
                  {currentProduct.images.length > 0 && (
                    <ScrollView horizontal style={styles.productImagePreviewList}>
                      {currentProduct.images.map((img, idx) => (
                        <View key={idx} style={styles.productImageWrapper}>
                          <Image source={{ uri: img.uri }} style={styles.productImagePreview} />
                          <TouchableOpacity style={styles.removeProductImageBtn} onPress={() => removeProductImage(idx)}>
                            <Ionicons name="close-circle" size={20} color="#ff3b30" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  <TouchableOpacity style={[styles.addProductBtn, { backgroundColor: accentColor }]} onPress={addProduct}>
                    <Text style={styles.addProductBtnText}>
                      {editingProductIndex !== null ? t.updateProduct : t.addProduct}
                    </Text>
                  </TouchableOpacity>
                </View>
                {products.length > 0 && (
                  <View style={styles.productList}>
                    <Text style={[styles.productListTitle, { color: textColor }]}>{t.addedProducts}</Text>
                    {products.map((p, idx) => (
                      <View key={idx} style={[styles.productItem, { borderColor }]}>
                        <View style={styles.productItemInfo}>
                          <Text style={[styles.productItemName, { color: textColor }]}>{p.name}</Text>
                          <Text style={[styles.productItemPrice, { color: secondaryText }]}>
                            {parseFloat(p.price).toLocaleString()} RWF
                          </Text>
                          <Text style={[styles.productItemImages, { color: secondaryText }]}>
                            {p.images.length} {t.imageCount}
                          </Text>
                        </View>
                        <View style={styles.productItemActions}>
                          <TouchableOpacity onPress={() => editProduct(idx)} style={styles.productItemAction}>
                            <Ionicons name="create-outline" size={22} color={textColor} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeProduct(idx)} style={styles.productItemAction}>
                            <Ionicons name="trash-outline" size={22} color="#ff3b30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step5}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step5Sub}</Text>
            <TouchableOpacity style={[styles.previewButton, { backgroundColor: accentColor }]} onPress={openPreview}>
              <Text style={styles.previewButtonText}>{t.previewButton}</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  // ----- Main render -----
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={[]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: textColor }]}>{t.addPlace}</Text>
          </View>
          {renderStepIndicator()}
          <View style={styles.content}>{renderStepContent()}</View>
          
          {/* Bottom Buttons Row - Preview button only in step 5, otherwise Back/Next */}
          <View style={styles.buttonRow}>
            {step > 1 && (
              <TouchableOpacity style={[styles.button, styles.backButton, { borderColor: accentColor }]} onPress={prevStep} disabled={publishing}>
                <Text style={[styles.buttonText, { color: accentColor }]}>{t.back}</Text>
              </TouchableOpacity>
            )}
            {step < totalSteps ? (
              <TouchableOpacity style={[styles.button, styles.nextButton, { backgroundColor: accentColor }]} onPress={() => { if (validateStep()) nextStep(); }} disabled={publishing}>
                <Text style={styles.nextButtonText}>{t.next}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, styles.publishButtonFinal, { backgroundColor: accentColor }]} onPress={publishPlace} disabled={publishing}>
                {publishing ? (
                  <View style={styles.publishProgress}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.publishButtonText}>{t.publishProgress.replace('{progress}', progress)}</Text>
                  </View>
                ) : (
                  <Text style={styles.publishButtonText}>{t.publish}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Preview Bottom Sheet */}
      {showPreview && (
        <>
          <TouchableWithoutFeedback onPress={closePreview}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
               styles.previewBottomSheet,
    {
      backgroundColor: theme.background, // 👈 Use main background
      borderTopColor: borderColor,
      borderTopLeftRadius: 24, // 👈 Already set in styles
      borderTopRightRadius: 24, // 👈 Already set in styles
      transform: [{ translateY: slideAnim }],
    },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: textColor }]}>{t.preview}</Text>
              <TouchableOpacity onPress={closePreview} style={styles.previewCloseBtn}>
                <Ionicons name="close" size={28} color={textColor} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {streetImage && <Image source={{ uri: streetImage }} style={styles.previewImage} />}
              <View style={styles.previewInfo}>
                <Text style={[styles.previewName, { color: textColor }]}>{form.name || t.previewName}</Text>
                {selectedCategory && (
                  <View style={styles.previewCategory}>
                    <MaterialCommunityIcons
                      name={visibleCategories.find(c => c.id === selectedCategory)?.icon || 'map-marker'}
                      size={20} color={accentColor}
                    />
                    <Text style={[styles.previewCategoryText, { color: textColor }]}>
                      {visibleCategories.find(c => c.id === selectedCategory)?.label || 'Category'}
                    </Text>
                  </View>
                )}
                <Text style={[styles.previewAddress, { color: secondaryText }]}>
                  {address.full || 'No address selected'}
                </Text>
                {currentUser && (
                  <View style={styles.previewOwner}>
                    <Text style={[styles.previewOwnerTitle, { color: textColor }]}>{t.previewOwner}</Text>
                    <View style={styles.previewOwnerRow}>
                      {currentUser.avatar ? (
                        <Image source={{ uri: currentUser.avatar }} style={styles.previewOwnerAvatar} />
                      ) : (
                        <View style={[styles.previewOwnerAvatarPlaceholder, { backgroundColor: accentColor }]}>
                          <Text style={styles.previewOwnerAvatarInitials}>
                            {currentUser.username?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={[styles.previewOwnerName, { color: textColor }]}>
                          {currentUser.name || currentUser.username || 'User'}
                        </Text>
                        <Text style={[styles.previewOwnerPhone, { color: secondaryText }]}>
                          {currentUser.phone || t.noPhone}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {!isShoppingMall && products.length > 0 && (
                  <View style={styles.previewProducts}>
                    <Text style={[styles.previewProductsTitle, { color: textColor }]}>Products:</Text>
                    {products.map((p, idx) => (
                      <View key={idx} style={[styles.previewProductItem, { borderColor }]}>
                        <Text style={[styles.previewProductName, { color: textColor }]}>{p.name}</Text>
                        <Text style={[styles.previewProductPrice, { color: accentColor }]}>
                          {parseFloat(p.price).toLocaleString()} RWF
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={[styles.previewStatus, { color: accentColor }]}>{t.previewStatus}</Text>
                <View style={styles.previewActions}>
                  <TouchableOpacity style={[styles.previewActionBtn, { backgroundColor: accentColor }]}>
                    <Ionicons name="call" size={20} color="#fff" />
                    <Text style={styles.previewActionText}>{t.call}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.previewActionBtn, { backgroundColor: accentColor }]}>
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.previewActionText}>{t.direction}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

// ----- Styles -----
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16, paddingHorizontal: 8 },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepCircle: { width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  stepNumber: { fontSize: 16, fontWeight: 'bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  content: { flex: 1 },
  stepContainer: { paddingBottom: 16 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  stepSubtitle: { fontSize: 14, marginBottom: 16 },
  mapWrapper: { height: MAP_HEIGHT, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  markerOverlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
  mapControlsOverlay: { position: 'absolute', top: 8, left: 60, zIndex: 5 },
  mapControlsColumn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapControlBtn: { padding: 6, borderRadius: 20, marginHorizontal: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  mapControls: { marginVertical: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: 1, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8, marginLeft: 8 },
  locatingText: { textAlign: 'center', marginTop: 4, fontSize: 12, fontStyle: 'italic' },
  addressContainer: { padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  addressRow: { flexDirection: 'row', marginBottom: 2 },
  addressLabel: { fontWeight: '600', width: 80 },
  addressValue: { flex: 1 },
  addressSuccess: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  addressSuccessText: { marginLeft: 6, fontWeight: '600' },
  addressPlaceholder: { fontStyle: 'italic' },
  categoryRow: { justifyContent: 'space-between', marginBottom: 8 },
  categoryCard: { width: (width - 48) / 3, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryLabel: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeInput: { width: '48%' },
  imageLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 10 },
  imageUploadBox: { borderWidth: 1, borderRadius: 8, height: 150, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center' },
  productSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  productForm: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  productImagePicker: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  productImageLabel: { fontSize: 14, fontWeight: '500', marginRight: 8 },
  addImageBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 6, borderRadius: 20 },
  productImagePreviewList: { flexDirection: 'row', marginBottom: 8 },
  productImageWrapper: { position: 'relative', marginRight: 6 },
  productImagePreview: { width: 60, height: 60, borderRadius: 6 },
  removeProductImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: 'white', borderRadius: 10 },
  addProductBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addProductBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  productList: { marginTop: 8 },
  productListTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  productItemInfo: { flex: 1 },
  productItemName: { fontSize: 16, fontWeight: '500' },
  productItemPrice: { fontSize: 14 },
  productItemImages: { fontSize: 12 },
  productItemActions: { flexDirection: 'row' },
  productItemAction: { padding: 6, marginLeft: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, gap: 12 },
  button: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { borderWidth: 1, backgroundColor: 'transparent' },
  nextButton: {},
  buttonText: { fontSize: 16, fontWeight: '600' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  publishButtonFinal: {},
  publishButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  publishProgress: { flexDirection: 'row', alignItems: 'center' },
  previewButton: { paddingVertical: 16, borderRadius: 24, alignItems: 'center' },
  previewButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // Preview Bottom Sheet Styles
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
  previewBottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    zIndex: 101,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 12 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewTitle: { fontSize: 22, fontWeight: 'bold' },
  previewCloseBtn: { padding: 4 },
  previewImage: { width: '100%', height: 200, resizeMode: 'cover', borderRadius: 12 },
  previewInfo: { paddingVertical: 12 },
  previewName: { fontSize: 22, fontWeight: 'bold' },
  previewCategory: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  previewCategoryText: { marginLeft: 6, fontSize: 16 },
  previewAddress: { fontSize: 14, marginVertical: 2 },
  previewOwner: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ddd' },
  previewOwnerTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  previewOwnerRow: { flexDirection: 'row', alignItems: 'center' },
  previewOwnerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  previewOwnerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  previewOwnerAvatarInitials: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  previewOwnerName: { fontSize: 15, fontWeight: '500' },
  previewOwnerPhone: { fontSize: 13 },
  previewProducts: { marginVertical: 8 },
  previewProductsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  previewProductItem: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, paddingVertical: 4 },
  previewProductName: { fontSize: 14 },
  previewProductPrice: { fontSize: 14, fontWeight: '500' },
  previewStatus: { fontSize: 16, fontWeight: '600', marginVertical: 4 },
  previewActions: { flexDirection: 'row', marginTop: 12 },
  previewActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 12 },
  previewActionText: { color: '#fff', marginLeft: 6, fontWeight: '500' },
});