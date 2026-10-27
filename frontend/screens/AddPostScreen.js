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
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
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
import VideoPost from '../components/VideoPost';
import TopBar from '../components/topbar';
import { getVideoMetaData } from '../utils/videoCompressor';
import { getMaxMediaHeight } from '../utils/mediaLimits';

const { width } = Dimensions.get('window');

const MAX_COMPRESSED_BYTES = 150 * 1024;
const MIN_IMAGE_HEIGHT = 300;
const MAX_UPLOAD_MEDIA_HEIGHT = 600;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_S = 90;

const prepareUploadFile = async (image) => {
  if (Platform.OS !== 'web') return image;
  const response = await fetch(image.uri);
  const blob = await response.blob();
  return new File([blob], image.name || `image_${Date.now()}.jpg`, { type: image.type || blob.type || 'image/jpeg' });
};

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
    imageCompressionLimit: 'This image could not be compressed below 100 KB. Please choose another image.',
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
      'Enter a catchy product name (max 20 letters).',
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
    mediaTooTall: 'This media is too tall for your phone. Please crop or resize it to a maximum height of {max} pixels.',
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
    productNameLetterLimit: 'Product name must be 20 letters or less (currently {count})',
    locationLetterLimit: 'Location must be 25 letters or less (currently {count})',
    loginRequiredTitle: 'Login Required',
    loginRequiredMessage: 'You need to login to create a post.',
    login: 'Login',
    cancel: 'Cancel',
    uploadingWait: 'Please wait while uploading',
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
    imageCompressionLimit: 'Iyi foto ntiyashoboye kugabanywa munsi ya 100 KB. Hitamo indi foto.',
    next: 'Ibikurikiye',
    back: 'Subira inyuma',
    post: 'Tangaza',
    posting: 'Gutangaza...',
    fillRequired: 'Nyabuneka andika ibisabwa byose',
    selectImages: 'Nyabuneka hitamo ishusho 1 byibuze',
    selectMedia: 'Nyabuneka hitamo amashusho byibuze',
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
    phoneRequired: 'Nyabuneka shyiraho nimero',
    descriptionLength: 'Ibisobanuro bigomba kuba hagati y\'amagambo 10 na 30',
    minChars: 'Byibuze amgambo 10',
    maxChars: 'Nturenze amagambo 30',
    step2HintTitle: '#Ibisobanuro by’Igicuruzwa#',
    step2HintMessages: [
      'Andika izina ry’igicuruzwa (inyuguti 20 ntarengwa).',
      'Sobanura igicuruzwa cyawe neza mu magambo 10-30.',
      'Ibisobanuro byiza bifasha abaguzi kumva icyo utanga.',
    ],
    step3HintTitle: '#Aho uri & Igiciro#',
    step3HintMessages: [
      'Bwira abaguzi icyo ugurisha aho cyibarizwa!',
      'Shyiraho igiciro cy’igicuruzwa cyawe.',
      'Nimero ya telefone irakenerwa kubaguzi/abagura.',
    ],
    step4HintTitle: '#Iherezo #',
    step4HintMessages: [
      'Genzura igicuruzwa cyawe mbereyo gutangaza.',
      'Menya neza ko nimero zawe ziriho.',
      'Ntushobora  guhindura cyeretse usibije ukongera bundi bushya',
    ],
    loadingLimits: 'Turikureba ibyowemerewe...',
    cooldownPostMessage: 'Ugomba gutegereza amasaha {hours} mbere yo kongera gutangaza.',
    mediaTooTall: 'Iyi foto cyangwa videwo ni ndende cyane. Yigabanye ibe uburebure butarenze {max} pixels.',
    totalLimitReached: 'Ibyo wemerewe byarangiye.',
    totalLimitReachedMessage: 'Ibyo wemerewe byarangiye.',
    upgradePrompt: 'Ongera ugerageze nyuma.',
    upgrade: 'Yego',
    totalImageLimitReached: 'Ibyo wemerewe byarangiye',
    totalImageLimitReachedMessage: 'Ibyo wemerewe byarangiye.',
    limitReached: 'Ibyo wemerewe byarangiye',
    limitReachedMessage: 'Ibyo wemerewe byarangiye.',
    imageDailyLimitReachedTitle: 'Ibyo wemerewe byarangiye',
    imageDailyLimitReachedMessage: 'Ibyo wemerewe byarangiye.',
    imageLimitExceeded: 'Ibyo wemerewe byarengezwe',
    imageLimitMessage: 'Urashobora kongeraho amashusho angana {max} gusa.',
    postsRemaining: 'Inyandiko zisigaye: {remaining} / {max}',
    imagesRemaining: 'Amashusho asigaye: {remaining} / {max}',
    maxImagesPerPost: 'Amashusho ntarengwa kuri buri nyandiko: {max}',
    lifetimePostMessage: 'Inyandiko zakozwe: {used} / {max}',
    uploadingPost: 'Turatangaza inyandiko yawe',
    serverError: 'Ikibazo cya Server. Ongera ugerageze nyuma.',
    unexpectedError: 'Habaye ikibazo cyitateganizwe.',
    pleaseWait: 'Nyabuneka tegereza...',
    productNameLetterLimit: 'Izina rigomba kuba inyuguti 20 cyangwa munsi (ubu {count})',
    locationLetterLimit: 'Ahantu hagomba kuba inyuguti 25 cyangwa munsi (ubu {count})',
    loginRequiredTitle: 'Ugomba kwinjira',
    loginRequiredMessage: 'Ugomba kwinjira kugirango utangaze igicuruzwa.',
    login: 'Injira',
    cancel: 'Oya',
    uploadingWait: 'Nyabuneka tegereza mugihe dutangaza ',
  },
};

// ---------- Dancing dots loader ----------
const DancingDots = ({ color = '#ffffff' }) => {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay(320),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.dancingDotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dancingDot,
            { backgroundColor: color },
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
                { scale: dot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
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
const AddPostScreen = ({ navigation, language = 'English', toggleLanguage }) => {
  const { theme, isDarkMode } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const maxMediaHeight = getMaxMediaHeight(windowHeight);
  const { refreshUser } = useAuth();
  const adminLimits = useUserLimits();
  const t = translations[language];
  const { showBottomSheet } = useBottomSheet();
  const route = useRoute();
  const cropFlowPendingRef = useRef(false);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
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
    const editedMediaUri = route.params?.editedMediaUri || route.params?.croppedImageUri;
    if (!editedMediaUri) return;

    const applyEditedMedia = async () => {
      try {
        if (route.params?.editedMediaType === 'video' || route.params?.mediaType === 'video') {
          const editedVideo = route.params?.editedVideo;
          if (!editedVideo) {
            throw new Error('The edited video details could not be restored.');
          }
          setFormData(prev => ({
            ...prev,
            images: [],
            video: { ...editedVideo, uri: editedMediaUri },
          }));
        } else {
          const processedImage = await processImageForUpload(editedMediaUri);
          setFormData(prev => ({ ...prev, images: [processedImage], video: null }));
        }
        setStep(2);
        setError('');
      } catch (err) {
        console.warn('Edited media processing failed:', err);
        showBottomSheet({
          type: 'error',
          title: 'Media Error',
          message: err.code === 'IMAGE_COMPRESSION_LIMIT'
            ? t.imageCompressionLimit
            : err.message || 'Unable to process this media. Please try again.',
          buttonText: 'OK',
        });
      } finally {
        navigation.setParams?.({
          editedMediaUri: undefined,
          editedMediaType: undefined,
          editedVideo: undefined,
          croppedImageUri: undefined,
          mediaType: undefined,
        });
      }
    };
    applyEditedMedia();
  }, [route.params?.editedMediaUri, route.params?.croppedImageUri]);

  useEffect(() => {
    if (!formData.price) {
      setPriceDisplay('');
    } else {
      setPriceDisplay(Number(formData.price).toLocaleString());
    }
  }, [formData.price]);

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

  // Hard block: user has hit a posting limit / cooldown
  const limitReached =
    !limitsLoading &&
    (remainingPosts <= 0 ||
      totalPostsUsed >= maxTotalPosts ||
      postCooldownHours > 0);

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

  const getProcessedImageSize = async (uri) => {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Unable to read the processed image.');
      }
      return (await response.blob()).size;
    }

    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || typeof info.size !== 'number') {
      throw new Error('Unable to get the processed image size.');
    }
    return info.size;
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

  const processImageForUpload = async (sourceUri, exif = null, maxHeight = null) => {
    if (!sourceUri) throw new Error('No image selected');

    const { width: originalWidth, height: originalHeight } = await getImageDimensions(sourceUri);
    const rotation = getExifRotation(exif);
    const orientedWidth = rotation % 180 === 0 ? originalWidth : originalHeight;
    const orientedHeight = rotation % 180 === 0 ? originalHeight : originalWidth;
    const actions = [];
    if (rotation) actions.push({ rotate: rotation });
    if (maxHeight && orientedHeight > maxHeight) {
      actions.push({ resize: { height: maxHeight } });
    }
    for (const quality of [0.8, 0.6, 0.4, 0.25, 0.15, 0.08, 0.05]) {
      const processed = await ImageManipulator.manipulateAsync(
        sourceUri,
        actions,
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      const processedSize = await getProcessedImageSize(processed.uri);
      if (processedSize < MAX_COMPRESSED_BYTES) {
        return {
          uri: processed.uri,
          type: 'image/jpeg',
          name: `post_${Date.now()}.jpg`,
          size: processedSize,
          width: processed.width || (maxHeight && orientedHeight > maxHeight
            ? Math.max(1, Math.round(orientedWidth * maxHeight / orientedHeight))
            : orientedWidth),
          height: processed.height || Math.min(orientedHeight, maxHeight || orientedHeight),
          originalUri: sourceUri,
        };
      }
    }

    const error = new Error('Unable to compress image below 150 KB.');
    error.code = 'IMAGE_COMPRESSION_LIMIT';
    throw error;
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

  const trimVideo = async (uri) => {
    if (Platform.OS === 'web') {
      throw new Error('Automatic video trimming is not supported on web. Please choose a video that is 1 minute 30 seconds or shorter.');
    }

    const outputUri = `${FileSystem.cacheDirectory}trimmed_${Date.now()}.mp4`;
    const session = await FFmpegKit.execute(
      `-i "${uri}" -t ${MAX_VIDEO_DURATION_S} -map 0:v:0 -map 0:a? -c copy -movflags +faststart "${outputUri}"`
    );
    if (!ReturnCode.isSuccess(await session.getReturnCode())) {
      throw new Error('Video trimming failed. Please choose another video.');
    }

    const metadata = await getVideoMetaData(outputUri);
    const duration = Number(metadata.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_DURATION_S) {
      throw new Error('The video could not be trimmed to 1 minute 30 seconds.');
    }
    const fileInfo = await FileSystem.getInfoAsync(outputUri);

    return {
      uri: outputUri,
      type: 'video/mp4',
      name: `post_${Date.now()}.mp4`,
      ...metadata,
      duration,
      size: Number(fileInfo.size) || 0,
    };
  };

  const handleVideoChange = async (video, errorMessage) => {
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    if (video) {
      const videoHeight = Number(video.height);
      const minimumVideoHeight = Math.min(MIN_IMAGE_HEIGHT, maxMediaHeight);
      if (!Number.isFinite(videoHeight) || videoHeight < minimumVideoHeight) {
        setError(t.videoTooShort.replace('{min}', minimumVideoHeight));
        return;
      }

      let videoDuration = Number(video.duration);
      if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
        const metadata = await getVideoMetaData(video.uri);
        videoDuration = Number(metadata.duration);
        video = { ...video, ...metadata, duration: videoDuration };
      }
      if (videoDuration > MAX_VIDEO_DURATION_S) {
        setLoading(true);
        try {
          video = { ...video, ...(await trimVideo(video.uri)) };
        } catch (e) {
          setError(e.message || 'Video trimming failed. Please try another video.');
          return;
        } finally {
          setLoading(false);
        }
      }

      const fileInfo = video.size ? null : await FileSystem.getInfoAsync(video.uri);
      const videoSize = Number(video.size) || Number(fileInfo?.size) || 0;
      if (videoSize > MAX_VIDEO_BYTES) {
        setError('Video exceeds the 50 MB size limit. Please choose a smaller video.');
        return;
      }
    }
    setFormData(prev => ({ ...prev, video, images: video ? [] : prev.images }));
    setError('');
  };

  const handlePriceChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (digits.length > 9) digits = digits.slice(0, 9);
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
        ...(field === 'contactNumberCall' && whatsappSameAsCall ? { contactNumberWhatsApp: '' } : {}),
      }));
      return;
    }
    if (digits[0] !== '0') digits = '0' + digits;
    if (digits.length >= 2 && digits[1] !== '7') digits = digits.slice(0, 1) + '7' + digits.slice(1);
    if (digits.length >= 3) {
      const validThird = ['2', '3', '8', '9'];
      if (!validThird.includes(digits[2])) digits = digits.slice(0, 2) + '8' + digits.slice(3);
    }
    digits = digits.slice(0, 10);

    setFormData(prev => ({
      ...prev,
      [field]: digits,
      ...(field === 'contactNumberCall' && whatsappSameAsCall ? { contactNumberWhatsApp: digits } : {}),
    }));
  };

  const countWords = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length;

  const openMediaEditor = (media) => {
    if (!media?.uri) return;
    cropFlowPendingRef.current = true;
    navigation.navigate('EditScreen', {
      imageUri: media.uri,
      mediaType: media.type?.startsWith('video/') || media.mediaType === 'video' ? 'video' : 'image',
      video: media.type?.startsWith('video/') || media.mediaType === 'video' ? media : undefined,
      language,
    });
  };

  const handlePickedImage = async (asset) => {
    try {
      const processed = await processImageForUpload(asset.uri, asset.exif);
      setFormData(prev => ({ ...prev, images: [processed], video: null }));
    } catch (err) {
      console.warn('Image processing failed:', err);
      showBottomSheet({
        type: 'error',
        title: 'Image Error',
        message: err.code === 'IMAGE_COMPRESSION_LIMIT'
          ? t.imageCompressionLimit
          : 'Unable to process this image. Please try another image.',
        buttonText: 'OK',
      });
    }
  };

  // ---------- Image pickers ----------
  const selectMultipleImages = async () => {
    if (limitReached) {
      showBottomSheet({
        type: 'error',
        title: t.limitReached,
        message: t.limitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
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
    if (limitReached) {
      showBottomSheet({
        type: 'error',
        title: t.limitReached,
        message: t.limitReachedMessage,
        buttonText: 'OK',
      });
      return;
    }
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
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 1, exif: true });
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

  // ---------- Validation ----------
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
        if (nameLength > 20) {
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

  // ---------- Navigation & Post ----------
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

    try {
      for (const image of formData.images) {
        if (image.size && image.size > MAX_COMPRESSED_BYTES) {
          setError('Image exceeds the 150 KB limit.');
          return;
        }
      }
    } catch (validationError) {
      setError(validationError.message || t.mediaTooTall.replace('{max}', maxMediaHeight));
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const token = await getToken();
      if (!token) {
        showBottomSheet({
          type: 'error',
          title: 'Not logged in',
          message: 'Please login to create a post',
          buttonText: 'OK',
        });
        navigation.navigate('Login');
        return;
      }

      const imagesForUpload = await Promise.all(formData.images.map(async (image) => {
        const dimensions = await getImageDimensions(image.uri);
        if (dimensions.height <= MAX_UPLOAD_MEDIA_HEIGHT) return image;

        return processImageForUpload(image.uri, null, MAX_UPLOAD_MEDIA_HEIGHT);
      }));
      let videoForUpload = formData.video;
      if (videoForUpload) {
        let duration = Number(videoForUpload.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          const metadata = await getVideoMetaData(videoForUpload.uri);
          duration = Number(metadata.duration);
          videoForUpload = { ...videoForUpload, ...metadata, duration };
        }
        if (duration > MAX_VIDEO_DURATION_S) {
          videoForUpload = { ...videoForUpload, ...(await trimVideo(videoForUpload.uri)) };
        }

        const fileInfo = videoForUpload.size
          ? null
          : await FileSystem.getInfoAsync(videoForUpload.uri);
        const videoSize = Number(videoForUpload.size) || Number(fileInfo?.size) || 0;
        if (videoSize > MAX_VIDEO_BYTES) {
          throw new Error('Video exceeds the 50 MB size limit. Please choose a smaller video.');
        }
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

      for (let i = 0; i < imagesForUpload.length; i += 1) {
        const img = imagesForUpload[i];
        const uriParts = img.uri.split('/');
        const fileName = img.name || uriParts[uriParts.length - 1] || `image_${i}.jpg`;
        const uploadImage = await prepareUploadFile(img);
        if (!uploadImage) throw new Error('Unable to prepare image for upload');
        fd.append('images', uploadImage, fileName);
      }

      if (videoForUpload) {
        if (!allowVideoUpload || videoUploadLimitPerDay <= 0) {
          throw new Error('Video uploads are not allowed for your account. Please contact the admin for support.');
        }
        if (videosToday >= videoUploadLimitPerDay) {
          throw new Error(`Video upload limit reached. You can upload up to ${videoUploadLimitPerDay} video(s) today.`);
        }
        const videoUpload = await prepareUploadFile(videoForUpload);
        fd.append('video', videoUpload, videoForUpload.name || `video_${Date.now()}.mp4`);
        fd.append('videoDuration', String(videoForUpload.duration || 0));
        if (Platform.OS !== 'web') {
          try {
            const thumbnail = await VideoThumbnails.getThumbnailAsync(videoForUpload.uri, {
              time: 1000,
              quality: 0.7,
            });
            const uploadThumbnail = await prepareUploadFile({
              uri: thumbnail.uri,
              name: 'video-thumbnail.jpg',
              type: 'image/jpeg',
            });
            if (!uploadThumbnail) throw new Error('Unable to prepare the video thumbnail for upload.');
            fd.append('thumbnail', uploadThumbnail, 'video-thumbnail.jpg');
          } catch (thumbnailError) {
            console.warn('Could not generate a video thumbnail for upload:', thumbnailError);
          }
        }
      }
      if (formData.videoLink.trim()) {
        fd.append('videoLink', formData.videoLink.trim());
      }

      const response = await axios.post(`${BASE_URL}/api/posts`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10 * 60 * 1000,
        onUploadProgress: (event) => {
          if (!event.total) return;
          const percent = Math.min(99, Math.floor((event.loaded / event.total) * 100));
          setUploadProgress(prev => Math.max(prev, percent));
        },
      });
      const responseData = response.data;
      setUploadProgress(100);

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
      showBottomSheet({
        type: 'error',
        title: 'Error',
        message: errorMsg,
        buttonText: 'OK',
      });
    } finally {
      setLoading(false);
    }
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

          <TouchableOpacity style={[styles.step4BackButton, { borderColor: theme.border }]} onPress={prevStep}>
            <Ionicons name="arrow-back" size={18} color={theme.accent} />
            <Text style={[styles.step4BackButtonText, { color: theme.accent }]}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ---------- Step content ----------
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

            <View style={styles.step3MediaHeader}>
              <Text style={[styles.step3SectionTitle, { color: theme.text }]}>{t.addImages}</Text>
              <TouchableOpacity
                style={[
                  styles.step3HeaderEditButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                    opacity: formData.images.length || formData.video ? 1 : 0.45,
                  },
                ]}
                onPress={() => openMediaEditor(formData.video || formData.images[0])}
                disabled={!formData.images.length && !formData.video}
                accessibilityRole="button"
                accessibilityLabel="Edit selected media"
              >
                <Ionicons name="create-outline" size={16} color={theme.text} />
                <Text style={[styles.step3HeaderEditText, { color: theme.text }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.step3SectionSubtitle, { color: theme.textSecondary }]}>
              {t.maxImages.replace('{max}', maxImagesPerPost)}
            </Text>
            <View style={styles.step3ImageButtons}>
              <TouchableOpacity
                style={[
                  styles.step3ImageButton,
                  {
                    backgroundColor: isDarkMode ? '#111' : '#ddd',
                    borderColor: theme.border,
                    opacity: limitReached ? 0.45 : 1,
                  },
                ]}
                onPress={() => pickImage(true)}
                disabled={limitReached}
              >
                <Ionicons name="camera-outline" size={32} color={theme.text} />
                <Text style={[styles.step3ImageButtonText, { color: theme.text }]}>{t.takePhoto}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.step3ImageButton,
                  {
                    backgroundColor: isDarkMode ? '#111' : '#ddd',
                    borderColor: theme.border,
                    opacity: limitReached ? 0.45 : 1,
                  },
                ]}
                onPress={selectMultipleImages}
                disabled={limitReached}
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
              disabled={videoUploadDisabled || limitReached}
            />
            {formData.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.step3ImagePreviewContainer}>
                  {formData.images.map((item, index) => (
                    <View key={index} style={styles.step3ImagePreviewWrapper}>
                      <Image source={{ uri: item.uri }} style={styles.step3ImagePreview} />
                      <View style={styles.step3ImageActions}>
                        <TouchableOpacity style={styles.step3EditImageButton} onPress={() => openMediaEditor(item)}>
                          <Ionicons name="create-outline" size={14} color={theme.text} />
                          <Text style={[styles.step3EditImageText, { color: theme.text }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.step3RemoveImageButton} onPress={() => removeImage(index)}>
                          <Ionicons name="close-circle" size={24} color="#d87428" />
                        </TouchableOpacity>
                      </View>
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
                  maxLength={20}
                  returnKeyType="next"
                />
              </View>
              <Text style={[styles.wordHint, { color: theme.textSecondary }]}>
                {formData.productName.trim().length}/20 letters
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Modal
        transparent
        visible={loading}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={[styles.uploadOverlay, { backgroundColor: isDarkMode ? '#111111' : '#dddddd' }]}>
          <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} />
          <View style={styles.uploadOverlayContent}>
            <Text style={[styles.uploadOverlayText, { color: isDarkMode ? '#ffffff' : '#222222' }]}>
              {t.uploadingWait}
            </Text>
            <DancingDots color={theme.accent} />
            <Text style={[styles.uploadProgressText, { color: isDarkMode ? '#ffffff' : '#222222' }]}>
              {uploadProgress}%
            </Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            step === 4 && styles.scrollContentFullWidth,
          ]}
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
    </View>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },

  uploadOverlay: {
    flex: 1,
  },
  uploadOverlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  uploadOverlayText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  uploadProgressText: {
    fontSize: 18,
    fontWeight: '700',
  },
  dancingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 24,
  },
  dancingDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  scrollContentFullWidth: {
    paddingHorizontal: 0,
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
  step3MediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  step3SectionTitle: { fontSize: 18, fontWeight: '600' },
  step3HeaderEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  step3HeaderEditText: { fontSize: 15, fontWeight: '600' },
  step3SectionSubtitle: { fontSize: 12, marginBottom: 16 },
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
  step3ImageButtonText: { fontSize: 12, marginTop: 8 },
  step3ImagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  step3ImagePreviewWrapper: { position: 'relative', marginRight: 10 },
  step3ImagePreview: {
    width: width * 0.38,
    height: width * 0.38,
    borderRadius: 12,
  },
  step3ImageActions: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  step3EditImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#dddd',
  },
  step3EditImageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  step3RemoveImageButton: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  step3ImageCount: { textAlign: 'center', fontSize: 12, marginTop: 8 },

  step4Container: {
    width: '100%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
  step4BackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderWidth: 1.5,
    borderRadius: 26,
    gap: 8,
  },
  step4BackButtonText: { fontSize: 15, fontWeight: '600' },
  step4PostButton: {
    minWidth: 112,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  step4PostButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  simplePreviewContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 0 },
  simplePreviewImage: { width: '100%', height: 200 },
  placeholderBg: { justifyContent: 'center', alignItems: 'center' },
  simplePreviewInfo: { padding: 12 },
  simplePreviewTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  simplePreviewCount: { fontSize: 12 },

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
});

export default AddPostScreen;