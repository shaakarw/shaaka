import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import ArrowUploadLoader from '../components/ArrowUploadLoader';
import { useAuth, useUserLimits } from '../context/AuthContext';
import { computeAggregatedLimits } from '../utils/subscriptionHelpers';
import { normalizeRwandaPhone, isValidRwandaPhone, formatPhoneInput } from '../utils/phoneNormalizer';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';

const { width, height } = Dimensions.get('window');
const CATEGORY_ICON_SIZE = 28;

// ----- Categories suitable for shops inside a shopping mall -----
const MALL_SHOP_CATEGORIES = [
  { id: 'clothing', label: 'Clothing Store', icon: 'hanger' },
  { id: 'shoes', label: 'Shoe Store', icon: 'shoe-print' },
  { id: 'electronics', label: 'Electronics Store', icon: 'laptop' },
  { id: 'phone', label: 'Phone Shop', icon: 'cellphone' },
  { id: 'computer', label: 'Computer Shop', icon: 'monitor' },
  { id: 'supermarket', label: 'Supermarket', icon: 'cart' },
  { id: 'grocery', label: 'Grocery Store', icon: 'food-apple' },
  { id: 'cosmetics', label: 'Cosmetics & Beauty', icon: 'makeup' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'pharmacy' },
  { id: 'restaurant', label: 'Restaurant', icon: 'silverware-fork-knife' },
  { id: 'cafe', label: 'Café', icon: 'coffee' },
  { id: 'fastfood', label: 'Fast Food', icon: 'hamburger' },
  { id: 'bakery', label: 'Bakery', icon: 'bread-slice' },
  { id: 'jewelry', label: 'Jewelry Store', icon: 'diamond' },
  { id: 'furniture', label: 'Furniture Store', icon: 'sofa' },
  { id: 'homedecor', label: 'Home Decor', icon: 'home' },
  { id: 'bookstore', label: 'Bookstore', icon: 'book' },
  { id: 'toys', label: 'Toy Store', icon: 'toy-brick' },
  { id: 'sports', label: 'Sports Shop', icon: 'basketball' },
  { id: 'gifts', label: 'Gift Shop', icon: 'gift' },
  { id: 'watches', label: 'Watch Store', icon: 'watch' },
  { id: 'mobileaccessories', label: 'Mobile Accessories', icon: 'headphones' },
  { id: 'boutique', label: 'Boutique', icon: 'tshirt-crew' },
  { id: 'tailoring', label: 'Tailoring Shop', icon: 'scissors' },
  { id: 'barber', label: 'Barber Shop', icon: 'content-cut' },
  { id: 'salon', label: 'Salon', icon: 'spa' },
  { id: 'optical', label: 'Optical Shop', icon: 'glasses' },
  { id: 'babystore', label: 'Baby Store', icon: 'baby-bottle' },
  { id: 'petshop', label: 'Pet Shop', icon: 'dog' },
  { id: 'hardware', label: 'Hardware Store', icon: 'hammer' },
  { id: 'printing', label: 'Printing & Stationery', icon: 'printer' },
  { id: 'repair', label: 'Repair Shop', icon: 'wrench' },
  { id: 'laundry', label: 'Laundry', icon: 'washing-machine' },
  { id: 'other', label: 'Other Retail', icon: 'dots-horizontal' },
];

// ---------- Translations ----------
const translations = {
  English: {
    addShop: 'Add Shop',
    step1: 'Shop Information',
    step1Sub: 'Fill in the details of your shop inside {mallName}',
    step2: 'Choose Category',
    step2Sub: 'Select the category that best fits your shop.',
    step3: 'Shop Image',
    step3Sub: 'Upload a shop front image (required).',
    step4: 'Products (Optional)',
    step4Sub: 'Add products if you wish. You can skip this step.',
    step5: 'Preview & Publish',
    step5Sub: 'Review your shop details and products before publishing.',
    mallAddress: 'Mall Address: {address}',
    shopName: 'Shop Name *',
    shopDescription: 'Shop Description (max 500 chars)',
    shopNumber: 'Shop Number / Door Number * (e.g., Shop A-12)',
    floorNumber: 'Building Floor Number (optional, e.g., 2nd Floor)',
    phone: 'Phone Number *',
    whatsapp: 'WhatsApp Number',
    email: 'Email',
    website: 'Website (optional)',
    openingTime: 'Opening Time',
    closingTime: 'Closing Time',
    shopAddress: 'Shop Address (auto-filled from mall, editable)',
    uploadFront: 'Upload Shop Front',
    productName: 'Product name',
    productPrice: 'Price (RWF)',
    addImages: 'Add Image',
    addProduct: 'Add Product',
    updateProduct: 'Update Product',
    addedProducts: 'Added Products ({count}):',
    imageCount: 'image',
    previewButton: 'Show Preview',
    publish: 'Publish Shop',
    publishing: 'Publishing {progress}%',
    back: 'Back',
    next: 'Next',
    success: 'Success',
    shopPublished: 'Your shop has been published!',
    missing: 'Missing',
    nameMissing: 'Please enter a shop name.',
    numberMissing: 'Please enter a shop number / door number.',
    phoneMissing: 'Please enter a phone number.',
    categoryMissing: 'Please select a category.',
    imageMissing: 'Please upload a shop front image.',
    productInputMissing: 'Please provide product name, price, and at least one image.',
    error: 'Error',
    loginRequired: 'You must be logged in to publish.',
    loginPrompt: 'Please log in to add a shop.',
    publishFailed: 'Failed to publish. Please try again.',
    permissionDenied: 'Permission Denied',
    imagePermission: 'Please grant access to your photos.',
    preview: 'Preview',
    previewName: 'Untitled Shop',
    previewOwner: 'Owner',
    noPhone: 'No phone',
    previewStatus: 'Open',
    call: 'Call',
    direction: 'Direction',
    phoneError: 'Phone must start with 07 and be exactly 10 digits',
    alreadyHasShop: 'You already have a shop',
    alreadyHasShopMessage: 'You can only add one shop. If you want to change your shop, please delete the existing one first.',
    sessionExpired: 'Session expired. Please login again.',
    infoTitle: 'Why is Next disabled?',
    infoMessage: 'You already have a shop. You can only add one shop. If you want to change your shop, please delete the existing one first.',
  },
  Kinyarwanda: {
    addShop: 'Ongera iduka',
    step1: 'Amakuru y\'iduka',
    step1Sub: 'Uzuza amakuru y\'iduka ryawe muri {mallName}',
    step2: 'Hitamo icyiciro',
    step2Sub: 'Hitamo icyiciro gikwiriye iduka ryawe.',
    step3: 'Ifoto y\'iduka',
    step3Sub: 'Shyira ifoto y\'iduka (irakenewe).',
    step4: 'Ibicuruzwa (Bishakiwe)',
    step4Sub: 'Ongeraho ibicuruzwa niba ubishaka. Ushobora gusimbuka iri tuntu.',
    step5: 'Reba & Tangaza',
    step5Sub: 'Reba iduka ryawe n\'ibicuruzwa mbere yo gutangaza.',
    mallAddress: 'Aderesi y\'inyubako: {address}',
    shopName: 'Izina ry\'iduka *',
    shopDescription: 'Ibisobanuro (ntagisumvwa 500)',
    shopNumber: 'Numero y\'iduka / Umuryango * (urugero: A-12)',
    floorNumber: 'Igikari cy\'inyubako (bitari ngombwa, urugero: Igikari cya 2)',
    phone: 'Numero ya telefoni *',
    whatsapp: 'Numero ya WhatsApp',
    email: 'Imeyili',
    website: 'Urubuga (bitari ngombwa)',
    openingTime: 'Isaha yo gufungura',
    closingTime: 'Isaha yo gufunga',
    shopAddress: 'Aderesi y\'iduka (yuzuzwe mu nyubako, irahindurwa)',
    uploadFront: 'Shyira ifoto y\'iduka',
    productName: 'Izina ry\'igicuruzwa',
    productPrice: 'Igiciro (FRW)',
    addImages: 'Ongera amashusho',
    addProduct: 'Ongera igicuruzwa',
    updateProduct: 'Hindura igicuruzwa',
    addedProducts: 'Ibicuruzwa byongewe ({count}):',
    imageCount: 'amashusho',
    previewButton: 'Reba mbere',
    publish: 'Tangaza iduka',
    publishing: 'Iratangazwa {progress}%',
    back: 'Subira inyuma',
    next: 'Komeza',
    success: 'Byakunze',
    shopPublished: 'Iduka ryawe ryatangajwe neza!',
    missing: 'Ibyuzuzwa',
    nameMissing: 'Andika izina ry\'iduka.',
    numberMissing: 'Andika numero y\'iduka / umuryango.',
    phoneMissing: 'Andika numero ya telefoni.',
    categoryMissing: 'Hitamo icyiciro.',
    imageMissing: 'Shyira ifoto y\'iduka.',
    productInputMissing: 'Uzuza izina, igiciro, n\'ifoto by\'igicuruzwa.',
    error: 'Ikibazo',
    loginRequired: 'Ugomba kwinjira kugira ngo utangaze.',
    loginPrompt: 'Nyamuneka winjire kugira ngo ongeze iduka.',
    publishFailed: 'Kutanga byanze. Ongera ugerageze.',
    permissionDenied: 'Uruhushya rwabaye impamvu',
    imagePermission: 'Tangire uruhushya rwo gufata amashusho.',
    preview: 'Reba',
    previewName: 'Iduka kitazwi',
    previewOwner: 'Nyir\'iduka',
    noPhone: 'Nta telefoni',
    previewStatus: 'Ifunguye',
    call: 'Guhamagara',
    direction: 'Inzira',
    phoneError: 'Numero igomba gutangira na 07 kandi ibe imibare 10',
    alreadyHasShop: 'Ufite iduka',
    alreadyHasShopMessage: 'Ushobora kugira iduka rimwe gusa. Niba ushaka guhindura, siba iryawe mbere.',
    sessionExpired: 'Igihe cyawe cyashize. Nyamuneka winjire ondongeye.',
    infoTitle: 'Kuki Next idakora?',
    infoMessage: 'Ufite iduka. Ushobora kugira iduka rimwe gusa. Niba ushaka guhindura, siba iryawe mbere.',
  },
};

export default function AddShoppingMallShopScreen({ route, navigation, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const { refreshUser } = useAuth();
  const adminLimits = useUserLimits();
  const t = translations[language] || translations.English;
  const { mall } = route.params;

  // ----- Step & Form State -----
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);

  // ----- Shop Info (Step 1) -----
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [shopNumber, setShopNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(false);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [shopAddress, setShopAddress] = useState(mall?.address || '');

  // ----- Category (Step 2) -----
  const [selectedCategory, setSelectedCategory] = useState(null);

  // ----- Images (Step 3) -----
  const [shopFrontImage, setShopFrontImage] = useState(null);

  // ----- Products (Step 4) -----
  const [products, setProducts] = useState([]);
  const [currentProduct, setCurrentProduct] = useState({ name: '', price: '', images: [] });
  const [editingProductIndex, setEditingProductIndex] = useState(null);

  // ----- Preview (Step 5) -----
  const [showPreview, setShowPreview] = useState(false);

  // ----- Current user & shop check -----
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [checkingShop, setCheckingShop] = useState(true);
  const [hasExistingShop, setHasExistingShop] = useState(false);

  // ----- Themed alert modal state -----
  const [alertState, setAlertState] = useState(null);
  const showThemedAlert = (title, message, buttons) => {
    setAlertState({ title, message, buttons });
  };
  const closeThemedAlert = () => setAlertState(null);

  // ----- Theme colors -----
  const backgroundColor = theme.background;
  const textColor = theme.text;
  const inputBg = isDarkMode ? theme.cardBackground : '#f8f8f8';
  const borderColor = theme.border;
  const cardBg = theme.cardBackground;
  const secondaryText = theme.textSecondary;
  const accentColor = theme.accent;

  // ----- Clear token and redirect to login -----
  const redirectToLogin = (message = t.sessionExpired) => {
    showThemedAlert(t.error, message, [
      { text: 'Login', onPress: async () => {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('isLoggedIn');
          navigation.replace('Login');
        }
      },
      { text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' },
    ]);
  };

  // ----- Fetch current user and check existing shop (non-blocking) -----
  useEffect(() => {
    const init = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          showThemedAlert(t.loginRequired, t.loginPrompt, [
            { text: 'Login', onPress: () => navigation.replace('Login') },
            { text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' },
          ]);
          setLoadingUser(false);
          setCheckingShop(false);
          return;
        }

        await refreshUser();

        // 1. Get current user
        const userRes = await axios.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userRes.data.success) {
          redirectToLogin(t.sessionExpired);
          setLoadingUser(false);
          setCheckingShop(false);
          return;
        }

        const user = userRes.data.user;
        setCurrentUser(user);

        // 2. Check if user already has a shop inside THIS mall
        try {
          // Fetch shops for this mall only
          const mallIdParam = mall?._id || mall?.id || mall?.uuid || null;
          const shopsRes = await axios.get(`${BASE_URL}/api/mall-shops`, {
            params: { mallId: mallIdParam }, // pass robust mallId
            headers: { Authorization: `Bearer ${token}` },
          });

          const allShops = shopsRes.data.shops || [];
          const userShops = allShops.filter(s => {
            if (s.ownerId) {
              return s.ownerId._id === user._id || s.ownerId === user._id;
            }
            return s.userId === user._id;
          });
          if (userShops.length > 0) {
            setHasExistingShop(true);
            showThemedAlert(t.alreadyHasShop, t.alreadyHasShopMessage);
          }
        } catch (shopError) {
          // Log the error but don't block – we still proceed.
          console.warn('Could not check existing shops:', shopError.message);
        }

      } catch (error) {
        console.error('Init error:', error);
        if (error.response?.status === 400 || error.response?.status === 401) {
          redirectToLogin(t.sessionExpired);
        } else {
          showThemedAlert(t.error, 'Could not verify your account. Please try again.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } finally {
        setLoadingUser(false);
        setCheckingShop(false);
      }
    };

    init();
  }, []);

  // ----- Phone validation -----
  const validatePhone = (number) => {
    if (!number) return true;
    return isValidRwandaPhone(number);
  };

  const handlePhoneChange = (setter) => (text) => {
    const formatted = formatPhoneInput(text);
    if (setter === setPhone) {
      setPhone(formatted);
      if (whatsappSameAsPhone) {
        setWhatsapp(formatted);
      }
    } else {
      setWhatsapp(formatted);
    }
  };

  // ----- Image picker helpers -----
  const pickImage = async (setImage) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showThemedAlert(t.permissionDenied, t.imagePermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const pickProductImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showThemedAlert(t.permissionDenied, t.imagePermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const selectedImage = {
        uri: asset.uri,
        type: 'image/jpeg',
        name: `product_${Date.now()}_${Math.random()}.jpg`,
      };
      setCurrentProduct({ ...currentProduct, images: [selectedImage] });
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
      showThemedAlert(t.missing, t.productInputMissing);
      return;
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

  // ----- Step management -----
  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // ----- Validation -----
  const validateStep = () => {
    if (hasExistingShop) {
      showThemedAlert(t.alreadyHasShop, t.alreadyHasShopMessage);
      return false;
    }
    if (step === 1) {
      if (!shopName.trim()) {
        showThemedAlert(t.missing, t.nameMissing);
        return false;
      }
      if (!shopNumber.trim()) {
        showThemedAlert(t.missing, t.numberMissing);
        return false;
      }
      if (!phone.trim()) {
        showThemedAlert(t.missing, t.phoneMissing);
        return false;
      }
      if (!validatePhone(phone)) {
        showThemedAlert(t.error, t.phoneError);
        return false;
      }
      if (whatsapp && !validatePhone(whatsapp)) {
        showThemedAlert(t.error, t.phoneError);
        return false;
      }
      return true;
    }
    if (step === 2 && !selectedCategory) {
      showThemedAlert(t.missing, t.categoryMissing);
      return false;
    }
    if (step === 3 && !shopFrontImage) {
      showThemedAlert(t.missing, t.imageMissing);
      return false;
    }
    // Step 4 is optional
    return true;
  };

  // ----- Keyboard submit handler (triggers next step) -----
  const handleSubmitEditing = () => {
    if (validateStep()) {
      nextStep();
    }
  };

  // ----- Check subscription limit before publishing -----
  const [remainingPostImages, setRemainingPostImages] = useState(0);

  const checkSubscriptionLimit = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return true;
      const res = await axios.get(`${BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const limits = computeAggregatedLimits(res.data.user);
        setRemainingPostImages(limits.postsMapRemainingImages);
        if (limits.postsMapRemainingImages <= 0) {
          showThemedAlert(
            'Image Limit Reached',
            'You have used all your post and map image credits. Please try again later.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      console.warn('Failed to check subscription limit:', error.message);
      return true;
    }
  };

  // ----- Publish shop -----
  const publishShop = async () => {
    if (!validateStep()) return;

    // Check subscription limit before proceeding
    const canProceed = await checkSubscriptionLimit();
    if (!canProceed) return;

    setPublishing(true);
    setProgress(0);

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        showThemedAlert(t.error, t.loginRequired);
        setPublishing(false);
        return;
      }

      // One-type-only check: verify user does not already have a normal place/shop
      const placesRes = await axios.get(`${BASE_URL}/api/places`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allPlaces = placesRes.data.places || [];
      const userPlaces = allPlaces.filter(p => p.userId === currentUser?._id);
      if (userPlaces.length > 0) {
        showThemedAlert('Limit Reached', 'You already have a Shop/Place. You cannot add a Shopping Mall Shop.');
        setPublishing(false);
        return;
      }

      // 1. Upload shop front image
      let frontImageUrl = null;
      if (shopFrontImage) {
        const formData = new FormData();
        formData.append('image', {
          uri: shopFrontImage,
          type: 'image/jpeg',
          name: 'shop_front.jpg',
        });
        const uploadRes = await axios.post(`${BASE_URL}/api/places/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        if (uploadRes.data.success) {
          frontImageUrl = uploadRes.data.url;
        }
      }

      // 2. Upload product images (if any)
      const uploadedProducts = await Promise.all(products.map(async (product) => {
        const productImagesUrls = await Promise.all(product.images.map(async (img) => {
          const formData = new FormData();
          formData.append('image', {
            uri: img.uri,
            type: 'image/jpeg',
            name: 'product.jpg',
          });
          const res = await axios.post(`${BASE_URL}/api/places/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`,
            },
          });
          return res.data.url;
        }));
        return {
          name: product.name,
          price: parseFloat(product.price),
          images: productImagesUrls,
        };
      }));

      // 3. Build shop payload
      const mallIdPayload = mall?._id || mall?.id || mall?.uuid || null;
      const mallLat = mall?.lat || mall?.location?.latitude || mall?.location?.lat || null;
      const mallLon = mall?.lon || mall?.location?.longitude || mall?.location?.lon || null;

      const shopData = {
        mallId: mallIdPayload,
        mallName: mall.name,
        name: shopName.trim(),
        description: shopDescription.trim(),
        category: selectedCategory,
        shopNumber: shopNumber.trim(),
        floorNumber: floorNumber.trim(),
        address: shopAddress.trim(),
        phone: normalizeRwandaPhone(phone) || phone.trim(),
        whatsapp: whatsapp ? (normalizeRwandaPhone(whatsapp) || whatsapp.trim()) : '',
        email: email.trim(),
        website: website.trim(),
        openingTime,
        closingTime,
        images: {
          frontImage: frontImageUrl,
        },
        products: uploadedProducts,
        lat: mallLat,
        lon: mallLon,
        createdDate: new Date().toISOString(),
      };

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProgress(i);
      }

      // 4. Send to backend
      const response = await axios.post(`${BASE_URL}/api/mall-shops`, shopData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        showThemedAlert(t.success, t.shopPublished, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        throw new Error(response.data.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
      showThemedAlert(t.error, error.response?.data?.message || t.publishFailed);
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
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: step >= s ? accentColor : borderColor,
                borderColor: borderColor,
              },
            ]}
          >
            <Text style={[styles.stepNumber, { color: step >= s ? '#fff' : textColor }]}>
              {s}
            </Text>
          </View>
          {s < 5 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: step > s ? accentColor : borderColor },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  // ----- Render step content -----
  const renderStepContent = () => {
    const editable = !hasExistingShop;
    const inputStyle = [styles.input, { backgroundColor: inputBg, color: textColor, borderColor }];
    if (!editable) {
      inputStyle.push({ opacity: 0.6, backgroundColor: isDarkMode ? '#2a2a2a' : '#e0e0e0' });
    }

    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step1}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
              {t.step1Sub.replace('{mallName}', mall?.name)}
            </Text>

            <Text style={[styles.mallInfo, { color: secondaryText }]}>
              {t.mallAddress.replace('{address}', mall?.address || 'N/A')}
            </Text>

            <TextInput
              style={inputStyle}
              placeholder={t.shopName}
              placeholderTextColor={secondaryText}
              value={shopName}
              onChangeText={setShopName}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={[inputStyle, styles.textArea]}
              placeholder={t.shopDescription}
              placeholderTextColor={secondaryText}
              multiline
              numberOfLines={4}
              maxLength={500}
              value={shopDescription}
              onChangeText={setShopDescription}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.shopNumber}
              placeholderTextColor={secondaryText}
              value={shopNumber}
              onChangeText={setShopNumber}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.floorNumber}
              placeholderTextColor={secondaryText}
              value={floorNumber}
              onChangeText={setFloorNumber}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.phone}
              placeholderTextColor={secondaryText}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={handlePhoneChange(setPhone)}
              maxLength={10}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.whatsapp}
              placeholderTextColor={secondaryText}
              keyboardType="phone-pad"
              value={whatsapp}
              onChangeText={handlePhoneChange(setWhatsapp)}
              maxLength={10}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.email}
              placeholderTextColor={secondaryText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={editable}
              returnKeyType="next"
            />
            <TextInput
              style={inputStyle}
              placeholder={t.website}
              placeholderTextColor={secondaryText}
              autoCapitalize="none"
              value={website}
              onChangeText={setWebsite}
              editable={editable}
              returnKeyType="next"
            />
            <View style={styles.timeRow}>
              <TextInput
                style={[inputStyle, styles.timeInput]}
                placeholder={t.openingTime}
                placeholderTextColor={secondaryText}
                value={openingTime}
                onChangeText={setOpeningTime}
                editable={editable}
                returnKeyType="next"
              />
              <TextInput
                style={[inputStyle, styles.timeInput]}
                placeholder={t.closingTime}
                placeholderTextColor={secondaryText}
                value={closingTime}
                onChangeText={setClosingTime}
                editable={editable}
                returnKeyType="next"
              />
            </View>
            <TextInput
              style={inputStyle}
              placeholder={t.shopAddress}
              placeholderTextColor={secondaryText}
              value={shopAddress}
              onChangeText={setShopAddress}
              editable={editable}
              returnKeyType="done"
              onSubmitEditing={handleSubmitEditing} // triggers next step
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step2}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step2Sub}</Text>
            <FlatList
              data={MALL_SHOP_CATEGORIES}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? accentColor : (isDarkMode ? theme.cardBackground : '#f0f0f0'),
                        borderColor: isSelected ? accentColor : borderColor,
                        opacity: editable ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => { if (editable) setSelectedCategory(isSelected ? null : item.id); }}
                    activeOpacity={editable ? 0.8 : 1}
                    disabled={!editable}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={CATEGORY_ICON_SIZE}
                      color={isSelected ? '#fff' : textColor}
                    />
                    <Text style={[styles.categoryLabel, { color: isSelected ? '#fff' : textColor }]}>
                      {item.label}
                    </Text>
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

            <Text style={[styles.imageLabel, { color: textColor }]}>{t.shopName}</Text>
            <TouchableOpacity
              style={[styles.imageUploadBox, { borderColor, opacity: editable ? 1 : 0.6 }]}
              onPress={() => { if (editable) pickImage(setShopFrontImage); }}
              disabled={!editable}
            >
              {shopFrontImage ? (
                <Image source={{ uri: shopFrontImage }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={40} color={secondaryText} />
                  <Text style={{ color: secondaryText, marginTop: 8 }}>{t.uploadFront}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step4}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step4Sub}</Text>

            <View style={[styles.productForm, { borderColor, opacity: editable ? 1 : 0.6 }]}>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder={t.productName}
                placeholderTextColor={secondaryText}
                value={currentProduct.name}
                onChangeText={(text) => setCurrentProduct({ ...currentProduct, name: text })}
                editable={editable}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
                placeholder={t.productPrice}
                placeholderTextColor={secondaryText}
                keyboardType="numeric"
                value={currentProduct.price}
                onChangeText={(text) => setCurrentProduct({ ...currentProduct, price: text })}
                editable={editable}
                returnKeyType="done"
                onSubmitEditing={addProduct} // Add product when "Done" pressed
              />
              <View style={styles.productImagePicker}>
                <Text style={[styles.productImageLabel, { color: textColor }]}>{t.addImages}:</Text>
                <TouchableOpacity
                  style={[styles.addImageBtn, { borderColor }]}
                  onPress={pickProductImages}
                  disabled={!editable}
                >
                  <Ionicons name="add" size={24} color={accentColor} />
                  <Text style={{ color: accentColor, marginLeft: 8 }}>{t.addImages}</Text>
                </TouchableOpacity>
              </View>
              {currentProduct.images.length > 0 && (
                <ScrollView horizontal style={styles.productImagePreviewList}>
                  {currentProduct.images.map((img, idx) => (
                    <View key={idx} style={styles.productImageWrapper}>
                      <Image source={{ uri: img.uri }} style={styles.productImagePreview} />
                      {editable && (
                        <TouchableOpacity style={styles.removeProductImageBtn} onPress={() => removeProductImage(idx)}>
                          <Ionicons name="close-circle" size={20} color="#ff3b30" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={[styles.addProductBtn, { backgroundColor: accentColor, opacity: editable ? 1 : 0.6 }]}
                onPress={addProduct}
                disabled={!editable}
              >
                <Text style={styles.addProductBtnText}>
                  {editingProductIndex !== null ? t.updateProduct : t.addProduct}
                </Text>
              </TouchableOpacity>
            </View>

            {products.length > 0 && (
              <View style={styles.productList}>
                <Text style={[styles.productListTitle, { color: textColor }]}>
                  {t.addedProducts.replace('{count}', products.length)}:
                </Text>
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
                      {editable && (
                        <>
                          <TouchableOpacity onPress={() => editProduct(idx)} style={styles.productItemAction}>
                            <Ionicons name="create-outline" size={22} color={textColor} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeProduct(idx)} style={styles.productItemAction}>
                            <Ionicons name="trash-outline" size={22} color="#ff3b30" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: textColor }]}>{t.step5}</Text>
            <Text style={[styles.stepSubtitle, { color: secondaryText }]}>{t.step5Sub}</Text>
            <TouchableOpacity
              style={[styles.previewButton, { backgroundColor: accentColor, opacity: editable ? 1 : 0.6 }]}
              onPress={() => { if (editable) setShowPreview(true); }}
              disabled={!editable}
            >
              <Text style={styles.previewButtonText}>{t.previewButton}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishButton, { backgroundColor: accentColor, marginTop: 20, opacity: editable ? 1 : 0.6 }]}
              onPress={publishShop}
              disabled={!editable || publishing}
            >
              {publishing ? (
                <View style={styles.publishProgress}>
                  <ArrowUploadLoader color="#fff" size={34} />
                  <Text style={styles.publishButtonText}>{t.publishing.replace('{progress}', progress)}</Text>
                </View>
              ) : (
                <Text style={styles.publishButtonText}>{t.publish}</Text>
              )}
            </TouchableOpacity>

            <Modal visible={showPreview} animationType="slide" transparent>
              <View style={styles.previewModalOverlay}>
                <View style={[styles.previewModalContent, { backgroundColor: cardBg }]}>
                  <View style={styles.previewHeader}>
                    <Text style={[styles.previewTitle, { color: textColor }]}>{t.preview}</Text>
                    <TouchableOpacity onPress={() => setShowPreview(false)}>
                      <Ionicons name="close" size={28} color={textColor} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.previewHeroWrap}>
                      {shopFrontImage ? (
                        <Image source={{ uri: shopFrontImage }} style={styles.previewImage} />
                      ) : (
                        <View style={[styles.previewImage, styles.previewImagePlaceholder, { backgroundColor: borderColor }]}>
                          <Ionicons name="storefront-outline" size={48} color={secondaryText} />
                        </View>
                      )}
                      <View style={styles.previewHeroShade} />
                      <TouchableOpacity style={styles.previewFavoriteButton} accessibilityRole="button" accessibilityLabel="Save shop preview">
                        <Ionicons name="heart-outline" size={22} color="#555" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.previewInfo}>
                      <View style={styles.previewTitleRow}>
                        <View style={styles.previewTitleBlock}>
                          <Text style={[styles.previewName, { color: textColor }]}>{shopName || t.previewName}</Text>
                          <Text style={[styles.previewAddress, { color: secondaryText }]}>
                            <Ionicons name="location" size={14} color={accentColor} /> {mall?.name || 'Shopping mall'}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={24} color={accentColor} />
                      </View>
                      {selectedCategory && (
                        <View style={styles.previewCategory}>
                          <MaterialCommunityIcons
                            name={MALL_SHOP_CATEGORIES.find(c => c.id === selectedCategory)?.icon || 'store'}
                            size={20}
                            color={accentColor}
                          />
                          <Text style={[styles.previewCategoryText, { color: textColor }]}>
                            {MALL_SHOP_CATEGORIES.find(c => c.id === selectedCategory)?.label || 'Category'}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.previewSectionLabel, { color: textColor }]}>Description</Text>
                      <Text style={[styles.previewDescription, { color: secondaryText }]}>
                        {shopDescription || 'No shop description provided.'}
                      </Text>

                      <Text style={[styles.previewSectionLabel, { color: textColor }]}>Facilities</Text>
                      <View style={styles.previewFacilitiesRow}>
                        <View style={styles.previewFacility}>
                          <Ionicons name="location-outline" size={21} color={accentColor} />
                          <Text style={[styles.previewFacilityLabel, { color: secondaryText }]} numberOfLines={1}>{shopNumber || 'Shop number'}</Text>
                        </View>
                        <View style={styles.previewFacility}>
                          <Ionicons name="call-outline" size={21} color={accentColor} />
                          <Text style={[styles.previewFacilityLabel, { color: secondaryText }]} numberOfLines={1}>{phone || t.noPhone}</Text>
                        </View>
                        <View style={styles.previewFacility}>
                          <Ionicons name="cube-outline" size={21} color={accentColor} />
                          <Text style={[styles.previewFacilityLabel, { color: secondaryText }]}>{products.length} products</Text>
                        </View>
                      </View>

                      <Text style={[styles.previewAddress, { color: secondaryText }]}>
                        {floorNumber ? `Floor ${floorNumber} • ` : ''}{shopAddress || 'Address not specified'}
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

                      {products.length > 0 && (
                        <View style={styles.previewProducts}>
                          <Text style={[styles.previewProductsTitle, { color: textColor }]}>
                            Products ({products.length}):
                          </Text>
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
                      <View style={[styles.previewActionFooter, { borderTopColor: borderColor }]}>
                        <View>
                          <Text style={[styles.previewPriceLabel, { color: secondaryText }]}>Shop</Text>
                          <Text style={[styles.previewPrice, { color: textColor }]}>{shopNumber || 'Ready'}</Text>
                        </View>
                        <View style={styles.previewActions}>
                          <TouchableOpacity style={[styles.previewActionBtn, { backgroundColor: accentColor }]}>
                            <Ionicons name="call" size={18} color="#fff" />
                            <Text style={styles.previewActionText}>{t.call}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.previewActionBtn, { backgroundColor: accentColor }]}>
                            <Ionicons name="navigate" size={18} color="#fff" />
                            <Text style={styles.previewActionText}>{t.direction}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        );

      default:
        return null;
    }
  };

  // ----- Themed alert modal (styled like ChatScreen modals) -----
  const renderThemedAlert = () => {
    if (!alertState) return null;
    const { title, message, buttons } = alertState;
    const defaultButtons = [{ text: 'OK', onPress: closeThemedAlert }];
    const btns = buttons && buttons.length > 0 ? buttons : defaultButtons;
    const isDanger = title === t.error;

    return (
      <Modal transparent visible animationType="fade" onRequestClose={closeThemedAlert}>
        <TouchableOpacity
          style={[styles.alertOverlay, { backgroundColor: theme.action }]}
          activeOpacity={1}
          onPress={closeThemedAlert}
        >
          <View style={[styles.alertContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.alertIconContainer}>
              <Ionicons
                name={title === t.success
                  ? 'checkmark-circle'
                  : isDanger
                    ? 'alert-circle'
                    : 'information-circle'}
                size={48}
                color={title === t.success ? '#00bc38' : isDanger ? '#ff3b30' : accentColor}
              />
            </View>
            <Text style={[styles.alertTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>{message}</Text>

            <View style={styles.alertButtonsRow}>
              {btns.map((btn, idx) => {
                const isPrimary = idx === btns.length - 1;
                const isCancel = btn.style === 'cancel';
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.alertButton,
                      isCancel
                        ? [styles.alertCancelButton, { borderColor: theme.border }]
                        : { backgroundColor: isPrimary ? (title === t.success ? '#00bc38' : accentColor) : theme.border, marginLeft: btn.style === 'cancel' ? 0 : 10 },
                      btns.length === 1 && styles.alertButtonFull,
                    ]}
                    onPress={() => {
                      if (btn.onPress) btn.onPress();
                      closeThemedAlert();
                    }}
                  >
                    <Text style={[styles.alertButtonText, { color: isCancel ? theme.textSecondary : '#fff' }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ----- Loading / checking state -----
  if (checkingShop || loadingUser) {
    return <ShaakaLoadingScreen message="Checking your account..." backgroundColor={backgroundColor} textColor={textColor} />;
  }

  // ----- Main render -----
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color={textColor} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: textColor }]}>{t.addShop}</Text>
            {hasExistingShop ? (
              <TouchableOpacity
                onPress={() => showThemedAlert(t.infoTitle, t.infoMessage)}
                style={styles.infoIcon}
              >
                <Ionicons name="information-circle-outline" size={28} color={accentColor} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>

          {renderStepIndicator()}
          <View style={styles.content}>{renderStepContent()}</View>

          <View style={styles.buttonRow}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.backButton, { borderColor: accentColor }]}
                onPress={prevStep}
                disabled={publishing || hasExistingShop}
              >
                <Text style={[styles.buttonText, { color: accentColor }]}>{t.back}</Text>
              </TouchableOpacity>
            )}
            {step < totalSteps ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  {
                    backgroundColor: hasExistingShop ? borderColor : accentColor,
                  },
                ]}
                onPress={() => { if (!hasExistingShop && validateStep()) nextStep(); }}
                disabled={publishing || hasExistingShop}
              >
                <Text style={[styles.nextButtonText, { color: hasExistingShop ? textColor : '#fff' }]}>
                  {t.next}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  {
                    backgroundColor: hasExistingShop ? borderColor : accentColor,
                  },
                ]}
                onPress={publishShop}
                disabled={publishing || hasExistingShop}
              >
                <Text style={[styles.nextButtonText, { color: hasExistingShop ? textColor : '#fff' }]}>
                  {t.publish}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {renderThemedAlert()}
    </SafeAreaView>
  );
}

// ----- Styles -----
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  infoIcon: { padding: 4 },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  stepNumber: { fontSize: 16, fontWeight: 'bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  content: { flex: 1, marginTop: 8 },
  stepContainer: { paddingBottom: 16 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  stepSubtitle: { fontSize: 14, marginBottom: 16 },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mallInfo: { fontSize: 14, marginBottom: 12, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeInput: { width: '48%' },
  categoryRow: { justifyContent: 'space-between', marginBottom: 8 },
  categoryCard: {
    width: (width - 48) / 3,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  imageLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  imageUploadBox: {
    borderWidth: 1,
    borderRadius: 8,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
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
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 },
  button: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { borderWidth: 1, marginRight: 10, backgroundColor: 'transparent' },
  nextButton: { marginLeft: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  previewButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  publishButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  publishButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  publishProgress: { flexDirection: 'row', alignItems: 'center' },
  previewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  previewModalContent: { marginHorizontal: 20, borderRadius: 18, maxHeight: '88%', overflow: 'hidden' },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  previewTitle: { fontSize: 20, fontWeight: 'bold' },
  previewHeroWrap: { height: 220, position: 'relative' },
  previewImage: { width: '100%', height: 220, resizeMode: 'cover' },
  previewImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  previewHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.04)' },
  previewFavoriteButton: { position: 'absolute', right: 14, bottom: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  previewInfo: { padding: 16 },
  previewTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  previewTitleBlock: { flex: 1, paddingRight: 10 },
  previewName: { fontSize: 22, fontWeight: 'bold' },
  previewCategory: { flexDirection: 'row', alignItems: 'center', marginTop: 9, marginBottom: 2 },
  previewCategoryText: { marginLeft: 6, fontSize: 16 },
  previewAddress: { fontSize: 13, marginTop: 5 },
  previewSectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 7 },
  previewDescription: { fontSize: 13, lineHeight: 19 },
  previewFacilitiesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  previewFacility: { alignItems: 'center', flex: 1, paddingHorizontal: 3 },
  previewFacilityLabel: { fontSize: 10, marginTop: 5, textAlign: 'center' },
  previewOwner: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ddd' },
  previewOwnerTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  previewOwnerRow: { flexDirection: 'row', alignItems: 'center' },
  previewOwnerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  previewOwnerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewOwnerAvatarInitials: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  previewOwnerName: { fontSize: 15, fontWeight: '500' },
  previewOwnerPhone: { fontSize: 13 },
  previewProducts: { marginVertical: 8 },
  previewProductsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  previewProductItem: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, paddingVertical: 4 },
  previewProductName: { fontSize: 14 },
  previewProductPrice: { fontSize: 14, fontWeight: '500' },
  previewStatus: { fontSize: 14, fontWeight: '600', marginTop: 14 },
  previewActionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  previewPriceLabel: { fontSize: 11 },
  previewPrice: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  previewActions: { flexDirection: 'row', marginTop: 0 },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
  },
  previewActionText: { color: '#fff', marginLeft: 6, fontWeight: '500' },
  // Themed alert modal styles
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  alertIconContainer: { marginBottom: 12 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  alertButtonsRow: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  alertButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  alertButtonFull: { maxWidth: '100%' },
  alertButtonText: { fontSize: 16, fontWeight: '600' },
});
