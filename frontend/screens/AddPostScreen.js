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
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { computeAggregatedLimits } from '../utils/subscriptionHelpers';
import { normalizeRwandaPhone } from '../utils/phoneNormalizer';
import { useAuth, useUserLimits } from '../context/AuthContext';
import Logo from '../assets/logos.png';
import { useBottomSheet } from '../context/BottomSheetContext';
import VideoUploader from '../components/VideoUploader';
import ArrowUploadLoader from '../components/ArrowUploadLoader';
import VideoPost from '../components/VideoPost';

const { width } = Dimensions.get('window');

// Target size for compression (same as the HTML page)
const MAX_COMPRESSED_BYTES = 100 * 1024; // 100 KB
const MIN_IMAGE_HEIGHT = 300;
const MAX_IMAGE_HEIGHT = 700;

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
    subtitle: 'Share your product or service',
    step1: '',
    step2: '',
    step3: '',
    step4: '',
    productName: 'Product name:',
    description: 'Description:',
    location: 'Location:',
    price: 'Price (RWF):',
    priceNegotiable: 'Price Negotiable',
    addImages: 'Add Images',
    maxImages: 'Maximum {max} images',
    selectMultiple: 'Choose Image',
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
    imageTooShort: 'This image is too short to upload. Minimum height is {min} px.',
    videoTooShort: 'This video is too short to upload. Minimum height is {min} px.',
    videoTooTall: 'This video is over {max} px high. Crop it to {min}-{max} px in a video editor, then select it again.',
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
    subtitle: 'Sangiza ibicuruzwa byawe',
    step1: '',
    step2: '',
    step3: '',
    step4: '',
    productName: 'Izina ry’Igicuruzwa:',
    description: 'Ibisobanuro:',
    location: 'Aho uri:',
    price: 'Igiciro (FRW):',
    priceNegotiable: 'Igiciro kiganirwaho',
    addImages: 'Shyiraho Amashusho',
    maxImages: 'Amashusho angana {max} gusa',
    selectMultiple: 'Hitamo Ifoto',
    takePhoto: 'Fata Ifoto',
    chooseFromLibrary: 'Koresha ayo ufite',
    removeImage: 'Kuraho',
    next: 'Ibikurikiye',
    back: 'Subira inyuma',
    post: 'Tangaza',
    posting: 'Gutangaza...',
    fillRequired: 'Nyamuneka andika ibisabwa byose',
    selectImages: 'Nyamuneka hitamo ishusho 1 byibuze',
    selectMedia: 'Nyamuneka hitamo amashusho byibuze',
    imageTooShort: 'Iyi foto ni ngufi cyane ku buryo wayishyiraho. Uburebure ntarengwa ni {min} px.',
    videoTooShort: 'Iyi videwo ni ngufi cyane ku buryo wayishyiraho. Uburebure ntarengwa ni {min} px.',
    videoTooTall: 'Iyi videwo irengeje {max} px. Yigabanye ibe hagati ya {min}-{max} px muri porogaramu yo guhindura videwo, wongere uyihitemo.',
    postSuccess: 'Gutangaza byakozwe neza!',
    postFailed: 'Gutangaza byanze. Ongera ugerageze.',
    preview: 'Reba',
    edit: 'Hindura',
    negotiable: 'Cyiraganirwaho',
    fixed: 'Ntabwo cyiganirwaho',
    postCreated: 'Byakunze!',
    contactNumberCall: 'Numero ya Telefone (Guhamura):',
    contactNumberWhatsApp: 'Numero ya WhatsApp (WhatsApp):',
    phoneError: 'Numero igomba gutangira na 072, 073, 078, cyangwa 079 kandi ibe imibare 10',
    phoneRequired: 'Nyamuneka shyiraho nimero',
    descriptionLength: 'Ibisobanuro bigomba kuba hagati y\'amagambo 10 na 30',
    minChars: 'Byibuze amgambo 10',
    maxChars: 'Nturenze amagambo 30',
    step2HintTitle: '#Ibisobanuro by’Igicuruzwa#',
    step2HintMessages: [
      'Andika izina ry’igicuruzwa (inyuguti 10 ntarengwa).',
      'Sobanura igicuruzwa cyawe neza mu magambo 10-30.',
      'Ibisobanuro byiza bifasha abaguzi kumva icyo utanga.',
    ],
    step3HintTitle: '#Aho uri & Igiciro#',
    step3HintMessages: [
      'Bwira abaguzi icyo ugurisha cyibarizwa!',
      'Shyira igiciro cyiza kugirango uboone abaguzi beshi.',
      'Nimero ya telefone irakenerwa kubaguzi/abagura.',
    ],
    step4HintTitle: '#Iherezo ryiza#',
    step4HintMessages: [
      'Genzura igicuruzwa cyawe mbereyo gutangaza.',
      'Menya neza ko nimero zawe ziriho.',
      'Ntusho guhindura cyeretse usibize ikongera bundi bushha',
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
        <Image source={{ uri: images[0].uri }} style={styles.simplePreviewImage} resizeMode="cover" />
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
  const cropFlowPendingRef = useRef(false);

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
    video: null,
    videoLink: '',
    contactNumberCall: '07',
    contactNumberWhatsApp: '',
  });
  const [whatsappSameAsCall, setWhatsappSameAsCall] = useState(false);

  const [priceDisplay, setPriceDisplay] = useState('');

  useEffect(() => {
    const croppedImageUri = route.params?.croppedImageUri;
    if (!croppedImageUri) return;

    const addCroppedImage = async () => {
      try {
        const processedImage = await processImageForUpload(croppedImageUri);
        setFormData(prev => ({ ...prev, images: [processedImage], video: null }));
      } catch (err) {
        console.warn('Cropped image processing failed:', err);
        showBottomSheet({
          type: 'error',
          title: 'Image Error',
          message: 'Unable to process this image. Please try another image.',
          buttonText: 'OK',
        });
      } finally {
        navigation.setParams?.({ croppedImageUri: undefined });
      }
    };
    addCroppedImage();
  }, [route.params?.croppedImageUri]);

  useEffect(() => {
    if (!formData.price) {
      setPriceDisplay('');
    } else {
      setPriceDisplay(Number(formData.price).toLocaleString());
    }
  }, [formData.price]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMessage, setUploadStatusMessage] = useState('');
  const uploadLogoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading) return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(uploadLogoScale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(uploadLogoScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [loading, uploadLogoScale]);

  const [remainingPosts, setRemainingPosts] = useState(1);
  const [remainingPostImages, setRemainingPostImages] = useState(1);
  const [maxPostsPerDay, setMaxPostsPerDay] = useState(1);
  const [maxPostImagesPerDay, setMaxPostImagesPerDay] = useState(2);
  const [maxImagesPerPost] = useState(1);
  const [totalPostsUsed, setTotalPostsUsed] = useState(0);
  const [maxTotalPosts, setMaxTotalPosts] = useState(Infinity);
  const [totalPostImagesUsed, setTotalPostImagesUsed] = useState(0);
  const [maxTotalPostImages, setMaxTotalPostImages] = useState(Infinity);
  const [postCooldownHours, setPostCooldownHours] = useState(0);
  const [allowVideoUpload, setAllowVideoUpload] = useState(false);
  const [videoUploadLimitPerDay, setVideoUploadLimitPerDay] = useState(0);
  const [videosToday, setVideosToday] = useState(0);

  const [limitsLoading, setLimitsLoading] = useState(true);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const videoUploadDisabled =
    limitsLoading ||
    !allowVideoUpload ||
    videoUploadLimitPerDay <= 0 ||
    videosToday >= videoUploadLimitPerDay;

  const productNameRef = useRef(null);
  const descriptionRef = useRef(null);
  const locationRef = useRef(null);
  const priceRef = useRef(null);
  const phoneRef = useRef(null);
  const whatsappRef = useRef(null);

  // ---------- Helper functions for local image processing ----------
  const getImageDimensions = (uri) => {
    return new Promise((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
  };

  const getExifRotation = (exif = null) => {
    if (!exif) return 0;

    const orientation = exif.Orientation ?? exif.orientation ?? exif['Orientation'];
    const normalized = Number(orientation);

    if (Number.isNaN(normalized)) return 0;

    switch (normalized) {
      case 3:
      case 4:
        return 180;
      case 5:
      case 6:
      case 7:
      case 8:
        return 90;
      default:
        return 0;
    }
  };

  const processImageForUpload = async (sourceUri, exif = null) => {
    if (!sourceUri) {
      throw new Error('No image selected');
    }

    const { width: originalWidth, height: originalHeight } = await getImageDimensions(sourceUri);
    const rotation = getExifRotation(exif);
    const orientedWidth = rotation % 180 === 0 ? originalWidth : originalHeight;
    const orientedHeight = rotation % 180 === 0 ? originalHeight : originalWidth;
    const fitScale = Math.min(1, 500 / orientedHeight);
    const targetWidth = Math.max(1, Math.round(orientedWidth * fitScale));
    const targetHeight = Math.max(1, Math.round(orientedHeight * fitScale));

    const qualitySequence = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26, 0.18];
    let bestResult = null;

    for (const quality of qualitySequence) {
      const actions = [];

      if (rotation) {
        actions.push({ rotate: rotation });
      }

      actions.push({
        resize: { width: targetWidth, height: targetHeight },
      });

      const processed = await ImageManipulator.manipulateAsync(
        sourceUri,
        actions,
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );

      const info = await FileSystem.getInfoAsync(processed.uri);
      if (!info.exists || typeof info.size !== 'number') {
        throw new Error('Unable to get the processed image size.');
      }

      const result = {
        uri: processed.uri,
        type: 'image/jpeg',
        name: `post_${Date.now()}.jpg`,
        size: info.size,
      };
      if (!bestResult || result.size < bestResult.size) {
        bestResult = result;
      }

      if (result.size < MAX_COMPRESSED_BYTES) {
        return result;
      }
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
        setAllowVideoUpload(user.allowVideoUpload === true);
        setVideoUploadLimitPerDay(typeof user.videoUploadLimitPerDay === 'number' ? Math.max(0, user.videoUploadLimitPerDay) : 0);
        setVideosToday(typeof user.videosToday === 'number' ? user.videosToday : 0);

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
    video: null,
    videoLink: '',
    contactNumberCall: '07',
    contactNumberWhatsApp: '',
  };

  useFocusEffect(
    React.useCallback(() => {
      const returningFromCrop = cropFlowPendingRef.current;
      cropFlowPendingRef.current = false;
      if (!returningFromCrop) {
        setFormData(initialFormState);
        setPriceDisplay('');
        setStep(1);
        setError('');
        setLoading(false);
        setUploadProgress(0);
        setUploadStatusMessage('');
      }
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
      navigation.navigate('Main', { screen: 'BuyPost', params: { activeTab: 'ushaka' } });
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setError('');
  };

  const handleVideoChange = (video, errorMessage) => {
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    if (video) {
      const videoHeight = Number(video.height);
      if (!Number.isFinite(videoHeight) || videoHeight < MIN_IMAGE_HEIGHT) {
        setError(t.videoTooShort.replace('{min}', MIN_IMAGE_HEIGHT));
        return;
      }
      if (videoHeight > MAX_IMAGE_HEIGHT) {
        setError(t.videoTooTall.replace('{min}', MIN_IMAGE_HEIGHT).replace('{max}', MAX_IMAGE_HEIGHT));
        return;
      }
    }
    setFormData(prev => ({ ...prev, video, images: video ? [] : prev.images }));
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

  const openCropScreen = (uri) => {
    cropFlowPendingRef.current = true;
    navigation.navigate('CropImage', { imageUri: uri, language });
  };

  const handlePickedImage = async (asset) => {
    try {
      const { width: imageWidth, height: imageHeight } = await getImageDimensions(asset.uri);
      const rotation = getExifRotation(asset.exif);
      const orientedHeight = rotation % 180 === 0 ? imageHeight : imageWidth;
      if (orientedHeight < MIN_IMAGE_HEIGHT) {
        setError(t.imageTooShort.replace('{min}', MIN_IMAGE_HEIGHT));
        return;
      }
      if (orientedHeight > MAX_IMAGE_HEIGHT) {
        openCropScreen(asset.uri);
        return;
      }

      const processed = await processImageForUpload(asset.uri, asset.exif);
      setFormData(prev => ({ ...prev, images: [processed], video: null }));
    } catch (err) {
      console.warn('Image processing failed:', err);
      showBottomSheet({
        type: 'error',
        title: 'Image Error',
        message: 'Unable to process this image. Please try another image.',
        buttonText: 'OK',
      });
    }
  };

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
        allowsMultipleSelection: false,
        quality: 1,
        exif: true,
        selectionLimit: 1,
      });
      if (!result.canceled && result.assets?.length > 0) {
        await handlePickedImage(result.assets[0]);
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
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1, exif: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1, exif: true });
      if (!result.canceled && result.assets?.[0]) {
        await handlePickedImage(result.assets[0]);
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
        if (formData.images.length === 0 && !formData.video) {
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

    setLoading(true);
    setUploadProgress(0);
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

      if (formData.video) {
        if (!allowVideoUpload || videoUploadLimitPerDay <= 0) {
          throw new Error('Video uploads are not allowed for your account. Please contact the admin for support.');
        }
        if (videosToday >= videoUploadLimitPerDay) {
          throw new Error(`Video upload limit reached. You can upload up to ${videoUploadLimitPerDay} video(s) today.`);
        }
        const videoUpload = await prepareUploadFile(formData.video);
        fd.append('video', videoUpload, formData.video.name || `video_${Date.now()}.mp4`);
        fd.append('videoDuration', String(formData.video.duration || 0));
      }
      if (formData.videoLink.trim()) {
        fd.append('videoLink', formData.videoLink.trim());
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
            navigation.navigate('Main', { screen: 'BuyPost', params: { activeTab: 'utanga', refresh: true } });
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
    const previewImage = formData.images[0]?.uri;

    return (
      <View style={[styles.step4Container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        {previewImage ? (
          <View style={styles.step4HeroWrap}>
            <Image source={{ uri: previewImage }} style={styles.step4HeroImage} resizeMode="cover" />
            <View style={styles.step4HeroShade} />
            <TouchableOpacity style={styles.step4FavoriteButton} accessibilityRole="button" accessibilityLabel="Save preview">
              <Ionicons name="heart-outline" size={22} color="#555" />
            </TouchableOpacity>
            {formData.images.length > 1 && (
              <View style={styles.step4ImageCountBadge}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.step4ImageCountText}>{formData.images.length}</Text>
              </View>
            )}
          </View>
        ) : (
          formData.video ? (
            <VideoPost videoUrl={formData.video.uri} videoDuration={formData.video.duration} theme={theme} />
          ) : (
            <View style={[styles.step4HeroPlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No images selected</Text>
            </View>
          )
        )}

        <View style={styles.step4Info}>
          <View style={styles.step4TitleRow}>
            <View style={styles.step4TitleBlock}>
              <Text style={[styles.step4ProductName, { color: theme.text }]}>{formData.productName || 'Untitled'}</Text>
              <Text style={[styles.step4Location, { color: theme.textSecondary }]}>
                <Ionicons name="location" size={14} color={theme.accent} /> {formData.location || 'Location not specified'}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
          </View>

          <Text style={[styles.step4SectionLabel, { color: theme.text }]}>Description</Text>
          <Text style={[styles.step4Description, { color: theme.textSecondary }]}>
            {formData.description || 'No description provided.'}
          </Text>

          <Text style={[styles.step4SectionLabel, { color: theme.text }]}>Details</Text>
          <View style={styles.step4FacilitiesRow}>
            <View style={styles.step4Facility}>
              <Ionicons name="cash-outline" size={21} color={theme.accent} />
              <Text style={[styles.step4FacilityLabel, { color: theme.textSecondary }]}>{negotiableText}</Text>
            </View>
            <View style={styles.step4Facility}>
              <Ionicons name="call-outline" size={21} color={theme.accent} />
              <Text style={[styles.step4FacilityLabel, { color: theme.textSecondary }]}>{formData.contactNumberCall || 'No phone'}</Text>
            </View>
            <View style={styles.step4Facility}>
              <Ionicons name="images-outline" size={21} color={theme.accent} />
              <Text style={[styles.step4FacilityLabel, { color: theme.textSecondary }]}>{formData.images.length} image{formData.images.length === 1 ? '' : 's'}</Text>
            </View>
          </View>

          <View style={[styles.step4BottomBar, { borderTopColor: theme.border }]}>
            <View>
              <Text style={[styles.step4PriceLabel, { color: theme.textSecondary }]}>Price</Text>
              <Text style={[styles.step4Price, { color: theme.text }]}>{formattedPrice}</Text>
            </View>
            <TouchableOpacity style={[styles.step4PostButton, { backgroundColor: theme.accent }]} onPress={handlePost} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.step4PostButtonText}>{t.post}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.step4EditButton} onPress={prevStep}>
            <Ionicons name="chevron-back" size={18} color={theme.accent} />
            <Text style={[styles.step4BackButtonText, { color: theme.accent }]}>{t.back}</Text>
          </TouchableOpacity>

          {renderUsageInfo()}
        </View>
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
            <VideoUploader
              value={formData.video}
              onChange={handleVideoChange}
              videoLink={formData.videoLink}
              onVideoLinkChange={(videoLink) => handleChange('videoLink', videoLink)}
              theme={theme}
              disabled={videoUploadDisabled}
            />
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
      {loading && (
        <View style={styles.publishLoadingOverlay}>
          <View style={[styles.publishLoadingCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.publishLoadingBadge}>
              <Animated.Image
                source={Logo}
                style={[styles.publishLoadingLogo, { transform: [{ scale: uploadLogoScale }] }]}
                resizeMode="contain"
              />
            </View>
            <ArrowUploadLoader color={theme.accent} size={58} />
            <Text style={[styles.publishLoadingTitle, { color: theme.text }]}>{t.pleaseWait}</Text>
            <Text style={[styles.publishLoadingMessage, { color: theme.textSecondary }]}>{t.uploadingPost}</Text>
            {uploadProgress > 0 && (
              <View style={styles.publishProgressTrack}>
                <View style={[styles.publishProgressFill, { width: `${uploadProgress}%`, backgroundColor: theme.accent }]} />
              </View>
            )}
          </View>
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

      </KeyboardAvoidingView>

      {renderInfoModal()}
    </View>
  );
};

// ---------- Styles (unchanged) ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  publishLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  publishLoadingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    elevation: 8,
  },
  publishLoadingBadge: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  publishLoadingLogo: { width: 68, height: 68 },
  publishLoadingTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  publishLoadingMessage: { fontSize: 13, textAlign: 'center' },
  publishProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginTop: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  publishProgressFill: { height: '100%', borderRadius: 3 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  logo: { width: 80, height: 80, alignSelf: 'center', marginTop: 12 },
  header: { alignItems: 'center', marginBottom: 20 },
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
    overflow: 'hidden',
    borderWidth: 1,
  },
  step4HeroWrap: { height: 220, position: 'relative' },
  step4HeroImage: { width: '100%', height: '100%' },
  step4HeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.04)' },
  step4FavoriteButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step4ImageCountBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  step4ImageCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  step4HeroPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  step4Info: { padding: 16 },
  step4TitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  step4TitleBlock: { flex: 1, paddingRight: 10 },
  step4ProductName: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  step4Location: { fontSize: 13 },
  step4SectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 7 },
  step4Description: { fontSize: 13, lineHeight: 19 },
  step4FacilitiesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  step4Facility: { alignItems: 'center', flex: 1, paddingHorizontal: 3 },
  step4FacilityLabel: { fontSize: 10, marginTop: 5, textAlign: 'center' },
  step4BottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 18, paddingTop: 14 },
  step4PriceLabel: { fontSize: 11 },
  step4Price: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  step4EditButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 14, padding: 5 },
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
    minWidth: 112,
    paddingVertical: 12,
    paddingHorizontal: 20,
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

  videoDisabledNotice: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoDisabledText: { fontSize: 13, fontWeight: '500' },

  usageInfoContainer: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  usageHeaderText: { fontSize: 16, fontWeight: '600' },
  usageInfoText: { fontSize: 13, textAlign: 'center', marginVertical: 2 },
  upgradeLink: { fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});

export default AddPostScreen;
//npx expo install expo-image-manipulator expo-file-system
