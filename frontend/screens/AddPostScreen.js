// screens/AddPostScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { computeAggregatedLimits, MAX_IMAGES_PER_POST } from '../utils/subscriptionHelpers';
import { normalizeRwandaPhone } from '../utils/phoneNormalizer';
import { useAuth, useUserLimits } from '../context/AuthContext';
import Logo from '../assets/logos.png';
import { useBottomSheet } from '../context/BottomSheetContext';

const { width } = Dimensions.get('window');

// Target size for compression (same as the HTML page)
const MAX_COMPRESSED_BYTES = 100 * 1024; // 100 KB

// Pre‑resize target dimensions
const TARGET_MAX_WIDTH = 600;
const TARGET_MAX_HEIGHT = 500;
const UPSCALE_THRESHOLD_FACTOR = 0.5;
const UPSCALE_FACTOR = 1.5;
const MIN_ACCEPTABLE_QUALITY = 0.42;
const DIMENSION_SCALES = [1.0, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.21, 0.18, 0.15, 0.12, 0.1];
const BINARY_SEARCH_ITERATIONS = 8;

const prepareUploadFile = async (image) => {
  if (Platform.OS !== 'web') return image;
  const response = await fetch(image.uri);
  const blob = await response.blob();
  return new File([blob], image.name || `image_${Date.now()}.jpg`, { type: image.type || blob.type || 'image/jpeg' });
};

// ---------- Translations (unchanged) ----------
const translations = {
  English: {
    title: 'Create New Post',
    subtitle: 'Share your product or service',
    step1: 'Images',
    step2: 'Product Details',
    step3: 'Location & Price',
    step4: '',
    productName: 'Product name:',
    description: 'Description:',
    location: 'Location:',
    price: 'Price (RWF):',
    priceNegotiable: 'Price Negotiable',
    addImages: 'Add Images',
    maxImages: 'Maximum {max} images',
    selectMultiple: 'Select Multiple Images',
    takePhoto: 'Take Photo',
    chooseFromLibrary: 'Choose from Gallery',
    removeImage: 'Remove',
    next: 'Next',
    back: 'Back',
    post: 'Post',
    posting: 'Posting...',
    fillRequired: 'Please fill all required fields',
    selectImages: 'Please select at least 1 image',
    selectMedia: 'Please select at least one image',
    postSuccess: 'Your post has been created successfully!',
    postFailed: 'Failed to post. Please try again.',
    preview: 'Preview',
    edit: 'Edit',
    negotiable: 'Negotiable',
    fixed: 'Fixed',
    postCreated: 'Success!',
    contactNumberCall: 'Phone number (Call):',
    contactNumberWhatsApp: 'WhatsApp number (Optional):',
    phoneError: 'Phone number must start with 072, 073, 078, or 079 and be 10 digits',
    phoneRequired: 'Please provide a call phone number',
    descriptionLength: 'Description must be between 10 and 30 words',
    minChars: 'Minimum 10 words',
    maxChars: 'Maximum 30 words',
    step2HintTitle: '#Product Details#',
    step2HintMessages: [
      'Enter a catchy product name (max 10 letters).',
      'Describe your product clearly in 10-30 words.',
      'A good description helps buyers understand what you offer.',
    ],
    step3HintTitle: '#Location & Price#',
    step3HintMessages: [
      'Tell buyers where you are — location sells!',
      'Set a fair price to attract interest.',
      'A phone number is required for buyers to reach you.',
    ],
    step4HintTitle: '#Final Touch#',
    step4HintMessages: [
      'Review your post before publishing.',
      'Make sure your contact info is correct.',
      'You can always edit later from your profile.',
    ],
    loadingLimits: 'Loading your limits...',
    cooldownPostMessage: 'You must wait {hours} hours before posting again.',
    totalLimitReached: 'Post Limit Reached',
    totalLimitReachedMessage: 'You have reached your total post limit for this app. Please try again later.',
    upgradePrompt: 'Please try again later.',
    upgrade: 'OK',
    totalImageLimitReached: 'Image Limit Reached',
    totalImageLimitReachedMessage: 'You have reached your total image upload limit for this app. Please try again later.',
    limitReached: 'Daily Post Limit Reached',
    limitReachedMessage: 'You have reached your daily post limit. Please try again later.',
    imageDailyLimitReachedTitle: 'Daily Image Limit Reached',
    imageDailyLimitReachedMessage: 'You have reached your daily image upload limit. Please try again later.',
    imageLimitExceeded: 'Image Limit Exceeded',
    imageLimitMessage: 'You can add up to {max} images per post.',
    postsRemaining: 'Posts remaining: {remaining} / {max}',
    imagesRemaining: 'Images remaining: {remaining} / {max}',
    maxImagesPerPost: 'Max images per post: {max}',
    lifetimePostMessage: 'Total posts used: {used} / {max}',
    uploadingPost: 'Uploading your post',
    serverError: 'Server error. Please try again later.',
    unexpectedError: 'An unexpected error occurred.',
    pleaseWait: 'Please wait...',
    productNameLetterLimit: 'Product name must be 10 letters or less (currently {count})',
    locationLetterLimit: 'Location must be 25 letters or less (currently {count})',
    loginRequiredTitle: 'Login Required',
    loginRequiredMessage: 'You need to login to create a post.',
    login: 'Login',
    cancel: 'Cancel',
  },
  Kinyarwanda: {
    title: 'Kora Icyatangazo Gishya',
    subtitle: 'Sangiza ibicuruzwa byawe',
    step1: 'Amashusho',
    step2: 'Ibisobanuro by’Igicuruzwa',
    step3: 'Aho uri & Igiciro',
    step4: '',
    productName: 'Izina ry’Igicuruzwa:',
    description: 'Ibisobanuro:',
    location: 'Aho uri:',
    price: 'Igiciro (FRW):',
    priceNegotiable: 'Igiciro girahamagara',
    addImages: 'Ongeraho Amashusho',
    maxImages: 'Amashusho angana {max} gusa',
    selectMultiple: 'Hitamo Amashusho Menshi',
    takePhoto: 'Fata Ifoto',
    chooseFromLibrary: 'Hitamo mu Bubiko',
    removeImage: 'Kuraho',
    next: 'Urukurikire',
    back: 'Subira inyuma',
    post: 'Tangaza',
    posting: 'Iratangazwa...',
    fillRequired: 'Nyamuneka andika ibisabwa byose',
    selectImages: 'Nyamuneka hitamo amashusho 1 byibuze',
    selectMedia: 'Nyamuneka hitamo amashusho byibuze',
    postSuccess: 'Icyatangazo cyawe cyakozwe neza!',
    postFailed: 'Kutanga byanze. Ongera ugerageze.',
    preview: 'Reba',
    edit: 'Hindura',
    negotiable: 'Biragahamagara',
    fixed: 'Ntabwo bihamagara',
    postCreated: 'Byakunze!',
    contactNumberCall: 'Numero ya Telefone (Guhamura):',
    contactNumberWhatsApp: 'Numero ya WhatsApp (Bishakiye):',
    phoneError: 'Numero igomba gutangira na 072, 073, 078, cyangwa 079 kandi ibe imibare 10',
    phoneRequired: 'Nyamuneka tangiza numero yo guhamura',
    descriptionLength: 'Ibisobanuro bigomba kuba hagati y\'amagambo 10 na 30',
    minChars: 'Ukennye amagambo 10',
    maxChars: 'Urenga amagambo 30',
    step2HintTitle: '#Ibisobanuro by’Igicuruzwa#',
    step2HintMessages: [
      'Andika izina ry’igicuruzwa ryiza (inyuguti 10 ntarengwa).',
      'Sobanura igicuruzwa cyawe neza mu magambo 10-30.',
      'Ibisobanuro byiza bifasha abaguzi kumva icyo utanga.',
    ],
    step3HintTitle: '#Aho uri & Igiciro#',
    step3HintMessages: [
      'Bwira abaguzi aho uri — ahantu hagurisha!',
      'Shyira igiciro cyiza kugirango ube abantu benshi.',
      'Nimero ya telefone irakenerwa kugirango abaguzi bagushe.',
    ],
    step4HintTitle: '#Iherezo ryiza#',
    step4HintMessages: [
      'Reba igicuruzwa cyawe mbere yo kugitangaza.',
      'Menya neza ko nimero zawe ziriho.',
      'Ushobora guhindura nyuma uhereye kuri profile yawe.',
    ],
    loadingLimits: 'Turareba urugero rwawe...',
    cooldownPostMessage: 'Ugomba gutegereza amasaha {hours} mbere yo kongera gutangaza.',
    totalLimitReached: 'Urugero rw’inyandiko zose rugeze ku rugero',
    totalLimitReachedMessage: 'Ugeze ku rugero rw’inyandiko zose kuri iyi app. Ongera ugerageze nyuma.',
    upgradePrompt: 'Ongera ugerageze nyuma.',
    upgrade: 'Yego',
    totalImageLimitReached: 'Urugero rw’amashusho rugeze ku rugero',
    totalImageLimitReachedMessage: 'Wageze ku rugero rw’amashusho kuri iyi app. Ongera ugerageze nyuma.',
    limitReached: 'Urugero rw’inyandiko ku munsi rugeze ku rugero',
    limitReachedMessage: 'Ugeze ku rugero rw’inyandiko ku munsi. Ongera ugerageze nyuma.',
    imageDailyLimitReachedTitle: 'Urugero rw’amashusho ku munsi rugeze ku rugero',
    imageDailyLimitReachedMessage: 'Ugeze ku rugero rw’amashusho ku munsi. Ongera ugerageze nyuma.',
    imageLimitExceeded: 'Urugero rw’amashusho rurenze',
    imageLimitMessage: 'Urashobora kongeraho amashusho angana {max} gusa.',
    postsRemaining: 'Inyandiko zisigaye: {remaining} / {max}',
    imagesRemaining: 'Amashusho asigaye: {remaining} / {max}',
    maxImagesPerPost: 'Amashusho ntarengwa kuri buri nyandiko: {max}',
    lifetimePostMessage: 'Inyandiko zakozwe: {used} / {max}',
    uploadingPost: 'Turatangaza inyandiko yawe',
    serverError: 'Ikibazo cya seriveri. Ongera ugerageze nyuma.',
    unexpectedError: 'Habaye ikibazo kititeganijwe.',
    pleaseWait: 'Nyamuneka tegereza...',
    productNameLetterLimit: 'Izina rigomba kuba inyuguti 10 cyangwa munsi (ubu {count})',
    locationLetterLimit: 'Ahantu hagomba kuba inyuguti 25 cyangwa munsi (ubu {count})',
    loginRequiredTitle: 'Ugomba kwinjira',
    loginRequiredMessage: 'Ugomba kwinjira kugirango utangaze igicuruzwa.',
    login: 'Injira',
    cancel: 'Kureka',
  },
};

// ---------- Simple Image Preview (theme aware) ----------
const SimplePostPreview = ({ productName, images, theme }) => {
  const hasImage = images && images.length > 0;
  return (
    <View style={[styles.simplePreviewContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      {hasImage ? (
        <Image source={{ uri: images[0].uri }} style={styles.simplePreviewImage} />
      ) : (
        <View style={[styles.simplePreviewImage, styles.placeholderBg, { backgroundColor: theme.border }]}>
          <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.simplePreviewInfo}>
        <Text style={[styles.simplePreviewTitle, { color: theme.text }]}>{productName || 'Untitled'}</Text>
        <Text style={[styles.simplePreviewCount, { color: theme.textSecondary }]}>
          {images.length} image{images.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
};

// ---------- Main Component ----------
const AddPostScreen = ({ navigation, language = 'English' }) => {
  const { theme, isDarkMode } = useTheme();
  const { refreshUser } = useAuth();
  const adminLimits = useUserLimits();
  const t = translations[language];
  const { showBottomSheet, closeBottomSheet } = useBottomSheet();
  const route = useRoute();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    location: '',
    price: '',
    priceNegotiable: false,
    images: [],
    contactNumberCall: '07',
    contactNumberWhatsApp: '',
  });
  const [whatsappSameAsCall, setWhatsappSameAsCall] = useState(false);

  const [priceDisplay, setPriceDisplay] = useState('');

  useEffect(() => {
    if (!formData.price) {
      setPriceDisplay('');
    } else {
      setPriceDisplay(Number(formData.price).toLocaleString());
    }
  }, [formData.price]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMessage, setUploadStatusMessage] = useState('');

  const [remainingPosts, setRemainingPosts] = useState(1);
  const [remainingPostImages, setRemainingPostImages] = useState(1);
  const [maxPostsPerDay, setMaxPostsPerDay] = useState(1);
  const [maxPostImagesPerDay, setMaxPostImagesPerDay] = useState(2);
  const [maxImagesPerPost] = useState(MAX_IMAGES_PER_POST);
  const [totalPostsUsed, setTotalPostsUsed] = useState(0);
  const [maxTotalPosts, setMaxTotalPosts] = useState(Infinity);
  const [totalPostImagesUsed, setTotalPostImagesUsed] = useState(0);
  const [maxTotalPostImages, setMaxTotalPostImages] = useState(Infinity);
  const [postCooldownHours, setPostCooldownHours] = useState(0);

  const [limitsLoading, setLimitsLoading] = useState(true);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const productNameRef = useRef(null);
  const descriptionRef = useRef(null);
  const locationRef = useRef(null);
  const priceRef = useRef(null);
  const phoneRef = useRef(null);
  const whatsappRef = useRef(null);

  // ---------- Helper functions for compression ----------
  const getImageDimensions = (uri) => {
    return new Promise((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
  };

  const checkWebPSupport = async () => {
    try {
      const testResult = await ImageManipulator.manipulateAsync(
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
        [],
        { format: ImageManipulator.SaveFormat.WEBP, compress: 0.8 }
      );
      return testResult.uri ? true : false;
    } catch (e) {
      return false;
    }
  };

  const compressImageToTarget = async (sourceUri) => {
    const { width: originalWidth, height: originalHeight } = await getImageDimensions(sourceUri);

    // Determine output format (WebP if supported, otherwise JPEG)
    let outputFormat = ImageManipulator.SaveFormat.JPEG;
    const webpSupported = await checkWebPSupport();
    if (webpSupported) {
      outputFormat = ImageManipulator.SaveFormat.WEBP;
    }

    // Compute effective dimensions (pre‑resize + optional upscale)
    const getEffectiveDimensions = (w, h) => {
      let newW = w;
      let newH = h;

      // Upscale small images by 50% if less than half target
      const thresholdW = TARGET_MAX_WIDTH * UPSCALE_THRESHOLD_FACTOR;
      const thresholdH = TARGET_MAX_HEIGHT * UPSCALE_THRESHOLD_FACTOR;
      if (newW < thresholdW || newH < thresholdH) {
        newW = Math.round(newW * UPSCALE_FACTOR);
        newH = Math.round(newH * UPSCALE_FACTOR);
      }

      // Fit within target dimensions
      const scaleW = TARGET_MAX_WIDTH / newW;
      const scaleH = TARGET_MAX_HEIGHT / newH;
      const scale = Math.min(scaleW, scaleH, 1);
      newW = Math.max(1, Math.round(newW * scale));
      newH = Math.max(1, Math.round(newH * scale));

      return { width: newW, height: newH };
    };

    const effective = getEffectiveDimensions(originalWidth, originalHeight);
    const longestSide = Math.max(effective.width, effective.height);
    let startW = effective.width;
    let startH = effective.height;
    if (longestSide > 8192) { // safety cap
      const ratio = 8192 / longestSide;
      startW = Math.round(startW * ratio);
      startH = Math.round(startH * ratio);
    }

    const compressAtDimensions = async (width, height, quality) => {
      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width, height } }],
        { compress: quality, format: outputFormat }
      );
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      return { uri: result.uri, size: fileInfo.size };
    };

    let bestResult = null;

    for (const scale of DIMENSION_SCALES) {
      const w = Math.round(startW * scale);
      const h = Math.round(startH * scale);
      if (w < 16 || h < 16) continue;

      // Quick test at quality 0.1 to see if this size can fit under target
      const tiny = await compressAtDimensions(w, h, 0.1);
      if (tiny.size > MAX_COMPRESSED_BYTES) continue;

      // Binary search for highest quality under target
      let low = 0.1;
      let high = 0.92;
      let bestQuality = 0.1;
      let bestBlob = tiny;

      for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
        const mid = (low + high) / 2;
        const compressed = await compressAtDimensions(w, h, mid);
        if (compressed.size <= MAX_COMPRESSED_BYTES) {
          bestQuality = mid;
          bestBlob = compressed;
          low = mid;
        } else {
          high = mid;
        }
      }

      const candidate = {
        uri: bestBlob.uri,
        size: bestBlob.size,
        width: w,
        height: h,
        quality: bestQuality,
      };

      if (!bestResult ||
          candidate.quality > bestResult.quality ||
          (Math.abs(candidate.quality - bestResult.quality) < 0.02 &&
           candidate.width * candidate.height > bestResult.width * bestResult.height)) {
        bestResult = candidate;
      }

      if (bestQuality >= MIN_ACCEPTABLE_QUALITY) {
        break; // Good enough, stop searching
      }
    }

    if (!bestResult) {
      // Fallback: use original with minimal quality
      const fallback = await compressAtDimensions(startW, startH, 0.1);
      bestResult = {
        uri: fallback.uri,
        size: fallback.size,
        width: startW,
        height: startH,
        quality: 0.1,
      };
    }

    return bestResult;
  };

  // ---------- Fetch limits and usage ----------
  const fetchLimitsAndUsage = async () => {
    try {
      await refreshUser();
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setLimitsLoading(false);
        return;
      }
      const response = await axios.get(`${BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const user = response.data.user;
        const limits = computeAggregatedLimits(user);
        setMaxPostsPerDay(limits.postsPerDay);
        setMaxPostImagesPerDay(limits.totalPostImagesPerDay);
        setMaxTotalPosts(limits.maxTotalPosts);
        setMaxTotalPostImages(limits.maxTotalPostImages || Infinity);

        setRemainingPosts(user.remainingPosts ?? limits.postsPerDay);
        setRemainingPostImages(user.remainingPostImages ?? user.remainingImages ?? limits.totalPostImagesPerDay);
        setTotalPostsUsed(user.totalPostsCount ?? 0);
        setTotalPostImagesUsed(user.totalPostImagesCount ?? 0);
        setPostCooldownHours(user.postCooldownHours ?? 0);
      }
    } catch (err) {
      console.warn('Failed to load limits:', err);
    } finally {
      setLimitsLoading(false);
    }
  };

  const initialFormState = {
    productName: '',
    description: '',
    location: '',
    price: '',
    priceNegotiable: false,
    images: [],
    contactNumberCall: '07',
    contactNumberWhatsApp: '',
  };

  useFocusEffect(
    React.useCallback(() => {
      setFormData(initialFormState);
      setPriceDisplay('');
      setStep(1);
      setError('');
      setLoading(false);
      setUploadProgress(0);
      setUploadStatusMessage('');
      fetchLimitsAndUsage();
      checkLoginAndPrompt();
    }, [])
  );

  const checkLoginAndPrompt = async () => {
    const loggedIn = await AsyncStorage.getItem('isLoggedIn');
    if (loggedIn !== 'true') {
      showBottomSheet({
        type: 'login',
        title: t.loginRequiredTitle,
        icon: 'lock-closed-outline',
        buttonText: t.login,
        secondaryButtonText: t.cancel,
        buttonAction: () => navigation.navigate('Login'),
        secondaryAction: () => navigation.goBack(),
        onDismiss: () => navigation.goBack(),
      });
    }
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (step < 2 || step > 4) {
      setShowHint(false);
      return;
    }
    const messages = (() => {
      if (step === 3) {
        return (t.step3HintMessages || []).map(m => m.replace('{max}', maxImagesPerPost));
      }
      return step === 2 ? t.step2HintMessages : t.step4HintMessages;
    })();
    if (!messages || messages.length < 2) return;
    setHintIndex(0);
    setShowHint(false);
    const showTimer = setTimeout(() => {
      setShowHint(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 1000);
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 20, useNativeDriver: true }).start(() => {
        setHintIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 2000, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, [step, t, fadeAnim, maxImagesPerPost, language]);

  useEffect(() => {
    const backAction = () => {
      navigation.navigate('BuyPost', { activeTab: 'ushaka' });
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setError('');
  };

  const handlePriceChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (digits.length > 9) {
      digits = digits.slice(0, 9);
    }
    setFormData(prev => ({ ...prev, price: digits }));
    const formatted = digits ? Number(digits).toLocaleString() : '';
    setPriceDisplay(formatted);
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.length !== 10) return false;
    return /^07[2389]\d{7}$/.test(phone);
  };

  const handlePhoneChange = (field, text) => {
    let digits = text.replace(/\D/g, '');

    if (digits.length === 0) {
      setFormData(prev => ({
        ...prev,
        [field]: '',
        ...(field === 'contactNumberCall' && whatsappSameAsCall
          ? { contactNumberWhatsApp: '' }
          : {}),
      }));
      return;
    }

    if (digits[0] !== '0') {
      digits = '0' + digits;
    }
    if (digits.length >= 2 && digits[1] !== '7') {
      digits = digits.slice(0, 1) + '7' + digits.slice(1);
    }
    if (digits.length >= 3) {
      const validThird = ['2', '3', '8', '9'];
      if (!validThird.includes(digits[2])) {
        digits = digits.slice(0, 2) + '8' + digits.slice(3);
      }
    }

    digits = digits.slice(0, 10);

    setFormData(prev => ({
      ...prev,
      [field]: digits,
      ...(field === 'contactNumberCall' && whatsappSameAsCall
        ? { contactNumberWhatsApp: digits }
        : {}),
    }));
  };

  const countWords = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length;

  // ---------- Image pickers with compression ----------
  const selectMultipleImages = async () => {
    if (formData.images.length >= maxImagesPerPost) {
      showBottomSheet({
        type: 'error',
        title: t.imageLimitExceeded,
        message: t.imageLimitMessage.replace('{max}', maxImagesPerPost),
        buttonText: 'OK',
      });
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showBottomSheet({
          type: 'error',
          title: 'Permission required',
          message: 'Please allow access to gallery',
          buttonText: 'OK',
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1, // we will compress ourselves
        selectionLimit: maxImagesPerPost - formData.images.length,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const remainingSlots = maxImagesPerPost - formData.images.length;
        const selectedAssets = result.assets.slice(0, remainingSlots);

        // Compress each image sequentially to avoid memory issues
        const compressedImages = [];
        for (const asset of selectedAssets) {
          try {
            const compressed = await compressImageToTarget(asset.uri);
            compressedImages.push({
              uri: compressed.uri,
              type: 'image/jpeg', // or based on format, but fine
              name: `post_${Date.now()}_${Math.random()}.jpg`,
            });
          } catch (err) {
            console.warn('Compression failed for one image, using original', err);
            // Fallback to original if compression fails
            compressedImages.push({
              uri: asset.uri,
              type: 'image/jpeg',
              name: `post_${Date.now()}_${Math.random()}.jpg`,
            });
          }
        }
        setFormData(prev => ({ ...prev, images: [...prev.images, ...compressedImages] }));
      }
    } catch (err) {
      showBottomSheet({
        type: 'error',
        title: 'Error',
        message: 'Failed to pick images',
        buttonText: 'OK',
      });
    }
  };

  const pickImage = async (useCamera = false) => {
    if (formData.images.length >= maxImagesPerPost) {
      showBottomSheet({
        type: 'error',
        title: t.imageLimitExceeded,
        message: t.imageLimitMessage.replace('{max}', maxImagesPerPost),
        buttonText: 'OK',
      });
      return;
    }
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showBottomSheet({
          type: 'error',
          title: 'Permission required',
          message: `Please allow access to ${useCamera ? 'camera' : 'gallery'}`,
          buttonText: 'OK',
        });
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        try {
          const compressed = await compressImageToTarget(asset.uri);
          const newImage = {
            uri: compressed.uri,
            type: 'image/jpeg',
            name: `post_${Date.now()}.jpg`,
          };
          setFormData(prev => ({ ...prev, images: [...prev.images, newImage] }));
        } catch (err) {
          // Fallback to original
          const newImage = {
            uri: asset.uri,
            type: 'image/jpeg',
            name: `post_${Date.now()}.jpg`,
          };
          setFormData(prev => ({ ...prev, images: [...prev.images, newImage] }));
        }
      }
    } catch (err) {
      showBottomSheet({
        type: 'error',
        title: 'Error',
        message: 'Failed to pick image',
        buttonText: 'OK',
      });
    }
  };

  const removeImage = (index) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  // ---------- Validation (unchanged) ----------
  const validateStep = () => {
    switch (step) {
      case 1:
        if (formData.images.length === 0) {
          setError(t.selectMedia);
          return false;
        }
        return true;
      case 2:
        if (!formData.productName.trim()) { setError('Please enter a product name'); return false; }
        if (!formData.description.trim()) { setError('Please provide a description'); return false; }
        const wc = countWords(formData.description);
        if (wc < 10) { setError(`${t.minChars} (${wc}/10 words)`); return false; }
        if (wc > 30) { setError(`${t.maxChars} (${wc}/30 words)`); return false; }
        const nameLength = formData.productName.trim().length;
        if (nameLength > 10) {
          setError(t.productNameLetterLimit.replace('{count}', nameLength));
          return false;
        }
        return true;
      case 3:
        if (!formData.location.trim() || formData.location.trim().length < 3) { setError('Please enter a valid location'); return false; }
        const locationLength = formData.location.trim().length;
        if (locationLength > 20) {
          setError(t.locationLetterLimit.replace('{count}', locationLength));
          return false;
        }
        if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) { setError('Please enter a valid price'); return false; }
        if (!formData.contactNumberCall || formData.contactNumberCall.length !== 10) { setError(t.phoneRequired); return false; }
        if (!validatePhoneNumber(formData.contactNumberCall)) { setError(t.phoneError); return false; }
        if (formData.contactNumberWhatsApp && !validatePhoneNumber(formData.contactNumberWhatsApp)) { setError(t.phoneError); return false; }
        return true;
      default:
        return true;
    }
  };

  // ---------- Navigation & Post (unchanged) ----------
  const nextStep = () => {
    if (limitsLoading) { setError(t.loadingLimits); return; }
    if (postCooldownHours > 0) {
      showBottomSheet({
        type: 'info',
        title: 'Cooldown',
        message: t.cooldownPostMessage.replace('{hours}', postCooldownHours),
        buttonText: 'OK',
      });
      return;
    }
    if (totalPostsUsed >= maxTotalPosts) {
      showBottomSheet({
        type: 'error',
        title: t.totalLimitReached,
        message: t.totalLimitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
    if (remainingPosts <= 0) {
      showBottomSheet({
        type: 'error',
        title: t.limitReached,
        message: t.limitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
    if (validateStep()) {
      setStep(step + 1);
      setError('');
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setError('');
  };

  const getToken = async () => await AsyncStorage.getItem('userToken');

  const handlePost = async () => {
    if (!validateStep()) return;
    if (limitsLoading) { setError(t.loadingLimits); return; }
    if (postCooldownHours > 0) {
      showBottomSheet({
        type: 'info',
        title: 'Cooldown',
        message: t.cooldownPostMessage.replace('{hours}', postCooldownHours),
        buttonText: 'OK',
      });
      return;
    }
    if (totalPostsUsed >= maxTotalPosts) {
      showBottomSheet({
        type: 'error',
        title: t.totalLimitReached,
        message: t.totalLimitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
    const imagesToUpload = formData.images.length;
    if (imagesToUpload > 0 && maxTotalPostImages !== Infinity && totalPostImagesUsed + imagesToUpload > maxTotalPostImages) {
      showBottomSheet({
        type: 'error',
        title: t.totalImageLimitReached,
        message: t.totalImageLimitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
    if (remainingPosts <= 0) {
      showBottomSheet({
        type: 'error',
        title: t.limitReached,
        message: t.limitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
    if (imagesToUpload > maxImagesPerPost) {
      showBottomSheet({
        type: 'error',
        title: t.imageLimitExceeded,
        message: t.imageLimitMessage.replace('{max}', maxImagesPerPost),
        buttonText: 'OK',
      });
      return;
    }

    showBottomSheet({
      type: 'loading',
      title: t.uploadingPost,
    });

    try {
      const token = await getToken();
      if (!token) {
        closeBottomSheet();
        showBottomSheet({
          type: 'error',
          title: 'Not logged in',
          message: 'Please login to create a post',
          buttonText: 'OK',
        });
        navigation.navigate('Login');
        return;
      }

      const fd = new FormData();
      fd.append('productName', formData.productName);
      fd.append('description', formData.description);
      fd.append('location', formData.location);
      fd.append('price', String(Number(formData.price)));
      fd.append('priceNegotiable', String(formData.priceNegotiable));
      fd.append('contactNumber1', normalizeRwandaPhone(formData.contactNumberCall) || formData.contactNumberCall);
      fd.append('contactNumber2', formData.contactNumberWhatsApp ? (normalizeRwandaPhone(formData.contactNumberWhatsApp) || formData.contactNumberWhatsApp) : '');
      fd.append('category', 'other');

      for (let i = 0; i < formData.images.length; i += 1) {
        const img = formData.images[i];
        const uriParts = img.uri.split('/');
        const fileName = img.name || uriParts[uriParts.length - 1] || `image_${i}.jpg`;
        const uploadImage = await prepareUploadFile(img);

        if (!uploadImage) {
          throw new Error('Unable to prepare image for upload');
        }

        fd.append('images', uploadImage, fileName);
      }

      let response;
      let responseData;
      if (Platform.OS === 'web') {
        response = await fetch(`${BASE_URL}/api/posts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });
        responseData = await response.json();
      } else {
        response = await axios.post(`${BASE_URL}/api/posts`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10 * 60 * 1000,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              setUploadProgress(Math.min(percent, 100));
            }
          },
        });
        responseData = response.data;
      }

      if (!response.ok && Platform.OS === 'web') {
        throw new Error(responseData?.message || `Upload failed with status ${response.status}`);
      }

      if (responseData.success) {
        setRemainingPosts(prev => Math.max(prev - 1, 0));
        const imagesUsed = formData.images.length;
        setRemainingPostImages(prev => Math.max(prev - imagesUsed, 0));
        setTotalPostsUsed(prev => prev + 1);
        setTotalPostImagesUsed(prev => prev + imagesUsed);
        setFormData(initialFormState);
        setPriceDisplay('');
        setStep(1);
        fetchLimitsAndUsage();
        closeBottomSheet();
        showBottomSheet({
          type: 'success',
          title: t.postCreated,
          message: t.postSuccess,
          buttonText: 'OK',
          autoDismiss: 3000,
          onDismiss: () => {
            navigation.navigate('BuyPost', { activeTab: 'utanga', refresh: true });
          },
        });
      } else {
        throw new Error(responseData?.message || 'Post failed');
      }
    } catch (error) {
      console.error('Post error:', error);
      let errorMsg = t.postFailed;
      if (error.response) {
        errorMsg = error.response.data?.message || t.serverError;
      } else if (error.request) {
        errorMsg = 'Network error – cannot reach backend. Please check your connection.';
      } else {
        errorMsg = error.message || t.unexpectedError;
      }
      setError(errorMsg);
      closeBottomSheet();
      showBottomSheet({
        type: 'error',
        title: 'Error',
        message: errorMsg,
        buttonText: 'OK',
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setUploadStatusMessage('');
    }
  };

  // ---------- Info Modal ----------
  const renderInfoModal = () => (
    <Modal animationType="fade" transparent visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
      <TouchableWithoutFeedback onPress={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.infoModalContainer, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity style={styles.infoModalClose} onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.infoModalTitle, { color: theme.text }]}>Usage Information</Text>
              <View style={[styles.infoModalDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.infoModalText, { color: theme.text }]}>
                • {t.postsRemaining.replace('{remaining}', remainingPosts).replace('{max}', maxPostsPerDay === Infinity ? '∞' : maxPostsPerDay)}
              </Text>
              <Text style={[styles.infoModalText, { color: theme.text }]}>
                • {t.imagesRemaining.replace('{remaining}', remainingPostImages === Infinity ? '∞' : remainingPostImages).replace('{max}', maxPostImagesPerDay === Infinity ? '∞' : maxPostImagesPerDay)}
              </Text>
              <Text style={[styles.infoModalText, { color: theme.text }]}>
                • {t.maxImagesPerPost.replace('{max}', maxImagesPerPost)}
              </Text>
              {maxTotalPosts !== Infinity && totalPostsUsed >= maxTotalPosts && (
                <Text style={[styles.infoModalText, { color: theme.accent, fontWeight: 'bold' }]}>
                  • {t.lifetimePostMessage.replace('{used}', totalPostsUsed).replace('{max}', maxTotalPosts)}
                </Text>
              )}
              {postCooldownHours > 0 && (
                <Text style={[styles.infoModalText, { color: theme.accent, fontWeight: 'bold' }]}>
                  • {t.cooldownPostMessage.replace('{hours}', postCooldownHours)}
                </Text>
              )}
              <TouchableOpacity style={[styles.infoModalButton, { backgroundColor: theme.accent }]} onPress={() => setInfoModalVisible(false)}>
                <Text style={styles.infoModalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // ---------- Usage info banner ----------
  const renderUsageInfo = () => {
    const postLimitReached = remainingPosts <= 0;
    const totalLimitReached = totalPostsUsed >= maxTotalPosts;
    const totalImageLimitReached = formData.images.length > 0 && maxTotalPostImages !== Infinity && totalPostImagesUsed >= maxTotalPostImages;
    const onCooldown = postCooldownHours > 0;
    const maxTotalDisplay = maxTotalPosts === Infinity ? '∞' : maxTotalPosts;

    return (
      <View style={[styles.usageInfoContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={styles.usageHeader}>
          <Text style={[styles.usageHeaderText, { color: theme.text }]}>Today's Usage</Text>
          <TouchableOpacity onPress={() => setInfoModalVisible(true)}>
            <Ionicons name="information-circle-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
        {maxTotalPosts !== Infinity && totalPostsUsed >= maxTotalPosts && (
          <Text style={[styles.usageInfoText, { color: theme.accent, fontWeight: 'bold' }]}>
            {t.lifetimePostMessage.replace('{used}', totalPostsUsed).replace('{max}', maxTotalDisplay)}
          </Text>
        )}
        {onCooldown && (
          <Text style={[styles.usageInfoText, { color: theme.accent, fontWeight: 'bold' }]}>
            {t.cooldownPostMessage.replace('{hours}', postCooldownHours)}
          </Text>
        )}
        {(postLimitReached || totalLimitReached || totalImageLimitReached) && (
          <Text style={[styles.usageInfoText, { color: theme.textSecondary, marginTop: 4 }]}>
            Please try again later or contact support if the limit is unexpected.
          </Text>
        )}
      </View>
    );
  };

  // ---------- Step indicator ----------
  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {[1, 2, 3, 4].map(s => (
        <View key={s} style={styles.stepWrapper}>
          <View style={[styles.stepCircle, { backgroundColor: step >= s ? theme.accent : theme.border, borderColor: theme.border }]}>
            <Text style={[styles.stepNumber, { color: step >= s ? '#fff' : theme.textSecondary }]}>{s}</Text>
          </View>
          {s < 4 && <View style={[styles.stepLine, { backgroundColor: step > s ? theme.accent : theme.border }]} />}
          <Text style={[styles.stepLabel, { color: step === s ? theme.text : theme.textSecondary }]}>
            {s === 1 ? t.step1 : s === 2 ? t.step2 : s === 3 ? t.step3 : t.step4}
          </Text>
        </View>
      ))}
    </View>
  );

  // ---------- Step 4 content (Preview) ----------
  const renderStep4Content = () => {
    const formattedPrice = formData.price ? `${Number(formData.price).toLocaleString()} RWF` : '0 RWF';
    const negotiableText = formData.priceNegotiable ? t.negotiable : t.fixed;

    return (
      <View style={[styles.step4Container, { 
        backgroundColor: isDarkMode ? '#111' : '#dddddd',
        borderColor: theme.border,
      }]}>
        {formData.images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.step4ImageScroll}>
            {formData.images.map((img, idx) => (
              <Image key={idx} source={{ uri: img.uri }} style={styles.step4Image} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.step4NoImage, { backgroundColor: theme.border }]}>
            <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No images selected</Text>
          </View>
        )}

        <Text style={[styles.step4ProductName, { color: theme.text }]}>{formData.productName || 'Untitled'}</Text>

        {formData.description ? (
          <Text style={[styles.step4Description, { color: theme.textSecondary }]}>{formData.description}</Text>
        ) : null}

        <View style={styles.step4Row}>
          <View style={styles.step4DetailBlock}>
            <Ionicons name="cash-outline" size={18} color={theme.text} style={{ marginRight: 6 }} />
            <Text style={[styles.step4DetailText, { color: theme.text }]}>{formattedPrice}</Text>
            <View style={[styles.negotiableBadge, { backgroundColor: formData.priceNegotiable ? '#e0f2e0' : theme.border }]}>
              <Text style={[styles.negotiableText, { color: formData.priceNegotiable ? '#2e7d32' : theme.textSecondary }]}>
                {negotiableText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.step4Row}>
          <Ionicons name="location-outline" size={18} color={theme.text} style={{ marginRight: 6 }} />
          <Text style={[styles.step4DetailText, { color: theme.text }]}>{formData.location || 'Not specified'}</Text>
        </View>

        <View style={styles.step4Row}>
          <Ionicons name="call-outline" size={18} color={theme.text} style={{ marginRight: 6 }} />
          <Text style={[styles.step4DetailText, { color: theme.text }]}>{formData.contactNumberCall}</Text>
        </View>
        {formData.contactNumberWhatsApp ? (
          <View style={styles.step4Row}>
            <Ionicons name="logo-whatsapp" size={18} color="#47ae87" style={{ marginRight: 6 }} />
            <Text style={[styles.step4DetailText, { color: theme.text }]}>{formData.contactNumberWhatsApp}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.step4BackButton, { borderColor: theme.accent }]}
          onPress={prevStep}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.accent} />
          <Text style={[styles.step4BackButtonText, { color: theme.accent }]}>{t.back}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.step4PostButton, { backgroundColor: theme.accent }]}
          onPress={handlePost}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.step4PostButtonText}>{t.post}</Text>
          )}
        </TouchableOpacity>

        {renderUsageInfo()}
      </View>
    );
  };

  // ---------- Step content (reordered) ----------
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={[styles.step3Container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <SimplePostPreview
              productName={formData.productName}
              images={formData.images}
              theme={theme}
            />

            <Text style={[styles.step3SectionTitle, { color: theme.text }]}>{t.addImages}</Text>
            <Text style={[styles.step3SectionSubtitle, { color: theme.textSecondary }]}>
              {t.maxImages.replace('{max}', maxImagesPerPost)}
            </Text>
            <View style={styles.step3ImageButtons}>
              <TouchableOpacity
                style={[styles.step3ImageButton, { backgroundColor: isDarkMode ? '#111' : '#ddd', borderColor: theme.border }]}
                onPress={() => pickImage(true)}
              >
                <Ionicons name="camera-outline" size={32} color={theme.text} />
                <Text style={[styles.step3ImageButtonText, { color: theme.text }]}>{t.takePhoto}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.step3ImageButton, { backgroundColor: isDarkMode ? '#111' : '#ddd', borderColor: theme.border }]}
                onPress={selectMultipleImages}
              >
                <Ionicons name="images-outline" size={32} color={theme.text} />
                <Text style={[styles.step3ImageButtonText, { color: theme.text }]}>{t.selectMultiple}</Text>
              </TouchableOpacity>
            </View>
            {formData.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.step3ImagePreviewContainer}>
                  {formData.images.map((item, index) => (
                    <View key={index} style={styles.step3ImagePreviewWrapper}>
                      <Image source={{ uri: item.uri }} style={styles.step3ImagePreview} />
                      <TouchableOpacity style={styles.step3RemoveImageButton} onPress={() => removeImage(index)}>
                        <Ionicons name="close-circle" size={24} color="#d87428" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <Text style={[styles.step3ImageCount, { color: theme.textSecondary }]}>
              {formData.images.length}/{maxImagesPerPost} images selected
            </Text>
          </View>
        );
      case 2:
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.productName}</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Ionicons name="pricetag-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={productNameRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g., iPhone 14, Sofa, Land..."
                  placeholderTextColor={theme.textSecondary}
                  value={formData.productName}
                  onChangeText={text => handleChange('productName', text)}
                  onSubmitEditing={() => descriptionRef.current?.focus()}
                  returnKeyType="next"
                />
              </View>
              <Text style={[styles.wordHint, { color: theme.textSecondary }]}>
                {formData.productName.trim().length}/10 letters
              </Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.description}</Text>
              <View style={[styles.textAreaContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <TextInput
                  ref={descriptionRef}
                  style={[styles.textArea, { color: theme.text }]}
                  placeholder="Describe your product (10-30 words)..."
                  placeholderTextColor={theme.textSecondary}
                  value={formData.description}
                  onChangeText={text => handleChange('description', text)}
                  multiline
                  numberOfLines={6}
                  maxLength={1000}
                  onSubmitEditing={nextStep}
                  returnKeyType="done"
                />
              </View>
              <View style={styles.charCounter}>
                <Text style={[styles.charCountText, { color: theme.textSecondary }]}>
                  {countWords(formData.description)}/30 words
                </Text>
                {countWords(formData.description) < 10 && countWords(formData.description) > 0 && (
                  <Text style={[styles.charWarning, { color: '#47ae87' }]}>
                    {10 - countWords(formData.description)} more words needed
                  </Text>
                )}
              </View>
            </View>
          </>
        );
      case 3:
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.location}</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Ionicons name="location-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={locationRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Kigali, Gasabo, KN 5 Rd"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.location}
                  onChangeText={text => handleChange('location', text)}
                  onSubmitEditing={() => priceRef.current?.focus()}
                  returnKeyType="next"
                />
              </View>
              <Text style={[styles.wordHint, { color: theme.textSecondary }]}>
                {formData.location.trim().length}/20 letters
              </Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.price}</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Ionicons name="cash-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={priceRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g., 1,500,000"
                  placeholderTextColor={theme.textSecondary}
                  value={priceDisplay}
                  onChangeText={handlePriceChange}
                  keyboardType="numeric"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  returnKeyType="next"
                />
                <Text style={{ color: theme.textSecondary, marginLeft: 4 }}>RWF</Text>
              </View>
              <Text style={[styles.wordHint, { color: theme.textSecondary }]}>
                Max 9 digits
              </Text>
            </View>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => handleChange('priceNegotiable', !formData.priceNegotiable)}>
              <Ionicons name={formData.priceNegotiable ? 'checkbox-outline' : 'square-outline'} size={24} color={theme.accent} />
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>{t.priceNegotiable}</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.contactNumberCall}</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="07XXXXXXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.contactNumberCall}
                  onChangeText={text => handlePhoneChange('contactNumberCall', text)}
                  keyboardType="phone-pad"
                  maxLength={12}
                  onSubmitEditing={() => whatsappRef.current?.focus()}
                  returnKeyType="next"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.contactNumberWhatsApp}</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Ionicons name="logo-whatsapp" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={whatsappRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="07XXXXXXXX (Optional)"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.contactNumberWhatsApp}
                  onChangeText={text => handlePhoneChange('contactNumberWhatsApp', text)}
                  keyboardType="phone-pad"
                  maxLength={12}
                  onSubmitEditing={nextStep}
                  returnKeyType="done"
                />
              </View>
            </View>
          </>
        );
      case 4:
        return renderStep4Content();
      default:
        return null;
    }
  };

  const hasImageUploads = formData.images.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {step !== 4 && (
        <View style={[styles.topHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t.title}</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={Logo} style={styles.logo} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>
            {step === 1 ? (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.subtitle}</Text>
            ) : (
              showHint && (
                <Animated.View style={[styles.stepHint, { opacity: fadeAnim }]}>
                  <Text style={[styles.stepHintTitle, { color: theme.textSecondary }]}>
                    {step === 2 ? t.step2HintTitle : step === 3 ? t.step3HintTitle : t.step4HintTitle}
                  </Text>
                  <Text style={[styles.stepHintText, { color: theme.text }]}>
                    {step === 2
                      ? t.step2HintMessages[hintIndex]
                      : step === 3
                      ? t.step3HintMessages[hintIndex]
                      : t.step4HintMessages[hintIndex]}
                  </Text>
                </Animated.View>
              )
            )}
          </View>

          {step !== 4 && renderStepIndicator()}

          <View style={styles.form}>
            {limitsLoading && step !== 4 ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              renderStepContent()
            )}
            {error !== '' && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#d87428" />
                <Text style={[styles.errorText, { color: '#d87428' }]}>{error}</Text>
              </View>
            )}
            <View style={{ height: step === 4 ? 0 : 80 }} />
          </View>

          {step < 4 && (
            <View style={styles.buttonRow}>
              {step > 1 && (
                <TouchableOpacity style={[styles.button, styles.backButton, { borderColor: theme.accent }]} onPress={prevStep} disabled={loading}>
                  <Ionicons name="arrow-back-outline" size={20} color={theme.accent} />
                  <Text style={[styles.buttonText, { color: theme.accent, marginLeft: 8 }]}>{t.back}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.nextButton,
                  {
                    backgroundColor:
                      (limitsLoading || remainingPosts <= 0 || totalPostsUsed >= maxTotalPosts ||
                        postCooldownHours > 0)
                        ? '#ccc'
                        : theme.accent,
                  },
                ]}
                onPress={nextStep}
                disabled={
                  loading || limitsLoading || remainingPosts <= 0 ||
                  totalPostsUsed >= maxTotalPosts ||
                  postCooldownHours > 0
                }
              >
                <Text style={styles.nextButtonText}>{t.next}</Text>
                <Ionicons name="arrow-forward-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {step !== 4 && (
          <View style={[styles.fixedBottomBar, { backgroundColor: theme.background, borderTopColor: theme.border }]} />
        )}
      </KeyboardAvoidingView>

      {renderInfoModal()}
    </View>
  );
};

// ---------- Styles (unchanged) ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  fixedBottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 30,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  logo: { width: 80, height: 80, alignSelf: 'center', marginTop: 12 },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center' },
  stepHint: { marginTop: 10, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  stepHintTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  stepHintText: { fontSize: 12, textAlign: 'center' },
  stepIndicatorContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingHorizontal: 10 },
  stepWrapper: { flexDirection: 'column', alignItems: 'center', flex: 1 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  stepNumber: { fontSize: 16, fontWeight: 'bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, alignSelf: 'center', marginTop: 18 },
  stepLabel: { fontSize: 10, marginTop: 0, textAlign: 'center' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    height: 52,
  },
  textAreaContainer: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textArea: { fontSize: 16, minHeight: 120, textAlignVertical: 'top' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  wordHint: { fontSize: 12, marginTop: 4, textAlign: 'right' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  checkboxLabel: { fontSize: 14, marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 16 },

  step3Container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
  },
  step3SectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  step3SectionSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  step3ImageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    gap: 12,
  },
  step3ImageButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 1,
    
    flex: 1,
  },
  step3ImageButtonText: {
    fontSize: 12,
    marginTop: 8,
  },
  step3ImagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  step3ImagePreviewWrapper: {
    position: 'relative',
  },
  step3ImagePreview: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: 12,
  },
  step3RemoveImageButton: {
    position: 'absolute',
    top: 0,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  step3ImageCount: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },

  step4Container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
  },
  step4ImageScroll: {
    marginBottom: 16,
  },
  step4Image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  step4NoImage: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
  },
  step4ProductName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  step4Description: {
    fontSize: 14,
    marginBottom: 16,
  },
  step4Row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  step4DetailBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  step4DetailText: {
    fontSize: 14,
    marginRight: 8,
  },
  negotiableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  negotiableText: {
    fontSize: 12,
    fontWeight: '500',
  },
  step4BackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 24,
    gap: 8,
  },
  step4BackButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  step4PostButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  step4PostButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  simplePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
  },
  simplePreviewImage: {
    width: '100%',
    height: 200,
  },
  placeholderBg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  simplePreviewInfo: {
    padding: 12,
  },
  simplePreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  simplePreviewCount: {
    fontSize: 12,
  },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.36)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  infoModalContainer: { marginHorizontal: 24, padding: 20, borderRadius: 16, maxHeight: '80%' },
  infoModalClose: { alignSelf: 'flex-end', padding: 4 },
  infoModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  infoModalDivider: { height: 1, marginBottom: 12 },
  infoModalText: { fontSize: 14, marginVertical: 4, lineHeight: 20 },
  infoModalButton: { marginTop: 16, paddingVertical: 10, borderRadius: 24, alignItems: 'center' },
  infoModalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  errorText: { fontSize: 13, marginLeft: 8 },

  button: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  backButton: { borderWidth: 1, backgroundColor: 'transparent' },
  nextButton: { flexDirection: 'row', gap: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: 8 },

  charCounter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  charCountText: { fontSize: 12 },
  charWarning: { fontSize: 12 },

  usageInfoContainer: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  usageHeaderText: { fontSize: 16, fontWeight: '600' },
  usageInfoText: { fontSize: 13, textAlign: 'center', marginVertical: 2 },
  upgradeLink: { fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});

export default AddPostScreen;
//npx expo install expo-image-manipulator expo-file-system
