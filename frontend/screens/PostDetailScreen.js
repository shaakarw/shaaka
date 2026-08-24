// screens/PostDetailScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
  FlatList,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import SharedBottomNav from '../components/SharedBottomNav';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';

const { width, height } = Dimensions.get('window');

let loadingLogo;
try {
  loadingLogo = require('../assets/logos.png');
} catch {
  loadingLogo = null;
}

const PROFILE_IMAGE = require('../assets/profile1.png');
const FALLBACK_IMAGE = { uri: 'https://via.placeholder.com/400' };
const getImageSource = (img) => {
  if (!img) return PROFILE_IMAGE;
  if (typeof img === 'string') return { uri: img };
  if (typeof img === 'object' && img.uri) return img;
  if (typeof img === 'object' && img.url) return { uri: img.url };
  return PROFILE_IMAGE;
};

const translations = {
  English: {
    loading: 'Getting things ready…',
    contactSeller: 'Contact Seller',
    message: 'Message',
    save: 'Save',
    saved: 'Saved',
    share: 'Share',
    download: 'Download',
    downloading: 'Downloading…',
    downloadSuccess: 'All images saved to gallery',
    downloadError: 'Could not download images',
    pricePrefix: ' ',
    call: 'Call',
    whatsapp: 'WhatsApp',
    sellerPhone: 'Seller Phone',
    notProvided: 'Not provided',
    noPhone: 'No phone number',
    couldNotOpenDialer: 'Could not open phone dialer',
    loginRequired: 'Please login to view post details',
    product: 'Product',
    location: 'Location',
    priceNegotiable: 'Negotiable',
    priceFixed: 'Fixed price',
    loginTitle: 'Login Required',
    login: 'Login',
    postNotAvailable: 'This post is no longer available.',
    error: 'Error',
    couldNotSave: 'Could not save/unsave post',
    removed: 'Removed',
    postRemoved: 'Post removed from saved',
    savedTitle: 'Saved',
    postSaved: 'Post saved',
    whatsappNotInstalled: 'WhatsApp is not installed',
    close: 'Close',
    imageSaved: 'Image saved to gallery',
    saveFailed: 'Could not save image. Please try again.',
    noImages: 'No images to download',
    permissionRequired: 'Permission Required',
    allowPhotos: 'Please allow access to photos to save images.',
  },
  Kinyarwanda: {
    loading: 'Turigutunganya page neza...',
    contactSeller: 'Vugana n’umugurisha',
    message: 'Ubutumwa',
    save: 'Bika',
    saved: 'IByabitswe',
    share: 'Sangiza',
    download: 'Gukuramo',
    downloading: 'Gukurura…',
    downloadSuccess: 'Amashusho yose yabitswe muri galerie',
    downloadError: 'Ntibyashobotse gukuramo amashusho',
    pricePrefix: ' ',
    call: 'Vugisha',
    whatsapp: 'WhatsApp',
    sellerPhone: 'Numero y’umugurisha',
    notProvided: 'Ntabwoyatanzwe',
    noPhone: 'Nta numero ya telefone',
    couldNotOpenDialer: 'Ntibyashobotse gufungura telefone',
    loginRequired: 'Nyamuneka banzawinjire kugira ngo urebe ibyo ushaka',
    product: 'Igicuruzwa',
    location: 'Aho kiri',
    priceNegotiable: 'Igiciro kiraganirwaho',
    priceFixed: 'Igiciro ntahinduka',
    loginTitle: 'Ugomba kwinjira',
    login: 'Injira',
    postNotAvailable: 'Iki gicuruzwa ntagihari.',
    error: 'Harikibazo vugisha nyiri APP (SHAAKA)',
    couldNotSave: 'Ntibyashobotse kubika',
    removed: 'Byakukuweho',
    postRemoved: 'Igicuruzwa cyakukuweho mu byabitswe',
    savedTitle: 'Byabitswe',
    postSaved: 'Igicuruzwa cyabitswe',
    whatsappNotInstalled: 'nyabuneka shyiramo WhatsApp muri telephone yawe',
    close: 'Funga',
    imageSaved: 'Amashusho yabitswe muri galerie',
    saveFailed: 'Ntibyashobotse kubika amashusho. Ongera ugerageze.',
    noImages: 'Nta mashusho yo gukuramo',
    permissionRequired: 'Uruhusha rurakenewe',
    allowPhotos: 'Nyamuneka emera uburenganzira bwo kubika amashusho.',
  },
};

// --- AUTO-SLIDING IMAGE SLIDER ---
const AutoSlidingImageSlider = ({ images, theme, onImagePress }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollTimer = useRef(null);
  const isDragging = useRef(false);

  const onScroll = useCallback((event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideSize);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  const startAutoScroll = useCallback(() => {
    if (!images || images.length <= 1 || isDragging.current) return;
    if (scrollTimer.current) clearInterval(scrollTimer.current);

    scrollTimer.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        let nextIndex = prevIndex + 1;
        if (nextIndex >= images.length) nextIndex = 0;

        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 3500);
  }, [images]);

  const stopAutoScroll = useCallback(() => {
    if (scrollTimer.current) {
      clearInterval(scrollTimer.current);
      scrollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  const onTouchStart = () => {
    isDragging.current = true;
    stopAutoScroll();
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    startAutoScroll();
  };

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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onImagePress && onImagePress(item, index)}
          >
            <Image source={getImageSource(item)} style={styles.houseImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === currentIndex && styles.activeDot]} />
          ))}
        </View>
      )}
    </View>
  );
};

// --- FULL-SCREEN IMAGE VIEWER MODAL ---
const ImageViewerModal = ({ visible, images, initialIndex, onClose, onDownload, isDarkMode }) => {
  if (!visible || !images || images.length === 0) return null;
  const safeIndex = typeof initialIndex === 'number' ? Math.min(Math.max(0, initialIndex), images.length - 1) : 0;
  const [currentIdx, setCurrentIdx] = useState(safeIndex);

  useEffect(() => {
    setCurrentIdx(safeIndex);
  }, [safeIndex, images]);

  const viewerBackground = isDarkMode ? '#111111' : '#DDDDDD';
  const viewerIconColor = isDarkMode ? '#fff' : '#000';
  const viewerDotColor = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const viewerDotActiveColor = isDarkMode ? '#fff' : '#000';

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };
  const goNext = () => {
    if (currentIdx < images.length - 1) setCurrentIdx(currentIdx + 1);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewerContainer, { backgroundColor: viewerBackground }]}>
        {/* Top bar */}
        <View style={styles.viewerTopBar}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={viewerIconColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDownload && onDownload(images[currentIdx])}>
            <Ionicons name="download-outline" size={28} color={viewerIconColor} />
          </TouchableOpacity>
        </View>

        {/* Image area */}
        <View style={styles.viewerImageArea}>
          {currentIdx > 0 && (
            <TouchableOpacity style={styles.viewerSideBtn} onPress={goPrev}>
              <Ionicons name="chevron-back" size={36} color={viewerIconColor} />
            </TouchableOpacity>
          )}

          <View style={styles.viewerImageWrapper}>
            <Image
              source={getImageSource(images[currentIdx])}
              style={styles.viewerImage}
              resizeMode="contain"
              onError={(e) => console.log('ImageViewer image load error:', e.nativeEvent.error)}
            />
          </View>

          {currentIdx < images.length - 1 && (
            <TouchableOpacity style={styles.viewerSideBtn} onPress={goNext}>
              <Ionicons name="chevron-forward" size={36} color={viewerIconColor} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dots */}
        {images.length > 1 && (
          <View style={styles.viewerDots}>
            {images.map((_, idx) => (
              <TouchableOpacity key={idx} onPress={() => setCurrentIdx(idx)}>
                <View style={[
                  styles.viewerDot,
                  { backgroundColor: viewerDotColor },
                  idx === currentIdx && { backgroundColor: viewerDotActiveColor, width: 12, height: 8 }
                ]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

// --- MAIN COMPONENT ---
const PostDetailScreen = ({ route, navigation }) => {
  const params = route.params || {};
  const { house: initialHouse, language = 'English', postId: paramPostId } = params;
  const { theme, isDarkMode } = useTheme();
  const { user: authUser } = useAuth();
  const t = translations[language] || translations.English;

  const [currentUser, setCurrentUser] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [house, setHouse] = useState(null);
  const [postNotFound, setPostNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('Contact');
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading]);

  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    }
  }, [authUser]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    checkLoginStatus();
    const unsubscribe = navigation.addListener('focus', checkLoginStatus);
    return unsubscribe;
  }, [navigation]);

  const checkLoginStatus = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
      if (loggedIn === 'true') {
        await loadPostAndUser();
      } else if (paramPostId) {
        await loadPostById(paramPostId);
      } else if (initialHouse) {
        setHouse(initialHouse);
        setLoading(false);
      } else {
        setPostNotFound(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('checkLoginStatus error:', error);
      setLoading(false);
    }
  };

  const loadPostAndUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        if (initialHouse) setHouse(initialHouse);
        else if (paramPostId) await loadPostById(paramPostId);
        else setPostNotFound(true);
        setLoading(false);
        return;
      }

      const userResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (userResponse.data.success) setCurrentUser(userResponse.data.user);

      let postData = null;
      if (paramPostId) {
        postData = await fetchPostById(paramPostId, token);
      } else if (initialHouse) {
        if (initialHouse._id) postData = await fetchPostById(initialHouse._id, token);
        else postData = { ...initialHouse };
      }

      if (postData) {
        setHouse(postData);
        const savedResponse = await axios.get(`${BASE_URL}/api/posts/saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const savedIds = savedResponse.data.posts.map(p => p._id);
        setIsSaved(savedIds.includes(postData._id));
      } else {
        setPostNotFound(true);
      }
    } catch (error) {
      console.error('Error loading post and user:', error);
      if (initialHouse) setHouse(initialHouse);
      else setPostNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostById = async (postId, token = null) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${BASE_URL}/api/posts/${postId}`, { headers });
      if (response.data.success && response.data.post) {
        const post = response.data.post;
        return {
          ...post,
          _id: post._id,
          amount: post.amount || `RWF ${post.price?.toLocaleString()}`,
          productName: post.productName || post.category || 'Product',
          username: post.username || post.user?.username || 'User',
          userAvatar: post.userAvatar || post.user?.avatar,
          houseImages: post.houseImages || [],
          contactNumber1: post.contactNumbers?.[0] || '',
          contactNumber2: post.contactNumbers?.[1] || '',
          priceNegotiable: post.priceNegotiable || false,
        };
      }
      return null;
    } catch (error) {
      console.error('fetchPostById error:', error);
      return null;
    }
  };

  const loadPostById = async (postId) => {
    const post = await fetchPostById(postId);
    if (post) setHouse(post);
    else setPostNotFound(true);
    setLoading(false);
  };

  const toggleSave = async () => {
    if (!isLoggedIn || !house) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${BASE_URL}/api/posts/save/${house._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setIsSaved(response.data.saved);
        Alert.alert(
          response.data.saved ? t.savedTitle : t.removed,
          response.data.saved ? t.postSaved : t.postRemoved
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t.error, t.couldNotSave);
    }
  };

  const handleShare = async () => {
    if (!house) return;
    try {
      await Share.share({
        message: `${house.productName || 'Product'} - ${house.location}\n${house.description}`,
        title: house.productName || 'Product',
      });
    } catch (error) { console.log(error); }
  };

  const handleCall = () => {
    const phoneNumber = house?.contactNumber1;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => Alert.alert(t.error, t.couldNotOpenDialer));
    } else Alert.alert(t.noPhone, t.notProvided);
  };

  const handleWhatsApp = () => {
    const whatsappNumber = house?.contactNumber2;
    if (whatsappNumber) {
      Linking.openURL(`whatsapp://send?phone=${whatsappNumber}`).catch(() =>
        Alert.alert(t.error, t.whatsappNotInstalled)
      );
    } else Alert.alert(t.noPhone, t.notProvided);
  };

  // --- Helper: Download remote image ---
  const downloadRemoteImage = async (url, filenameHint) => {
    try {
      // Get file extension from URL
      let extension = 'jpg';
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/');
        const filename = pathSegments[pathSegments.length - 1] || 'image.jpg';
        if (filename.includes('.')) {
          extension = filename.split('.').pop().split('?')[0] || 'jpg';
        }
      } catch (e) {
        // If URL parsing fails, use jpg as default
      }

      const localFilename = `${filenameHint}_${Date.now()}.${extension}`;
      const localPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${localFilename}`;
      
      // Download the file
      const result = await FileSystem.downloadAsync(url, localPath);
      
      if (result.status !== 200 || !result.uri) {
        throw new Error('Download failed with status: ' + result.status);
      }
      
      return result.uri;
    } catch (err) {
      console.log('Remote download error:', err);
      
      // Try alternative download method using fetch
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'image/*',
          },
        });
        
        if (!response.ok) {
          throw new Error('Fetch failed with status: ' + response.status);
        }
        
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = reader.result.split(',')[1];
              const localFilename = `${filenameHint}_${Date.now()}.jpg`;
              const localPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${localFilename}`;
              await FileSystem.writeAsStringAsync(localPath, base64, {
                encoding: FileSystem.EncodingType.Base64
              });
              resolve(localPath);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (fallbackErr) {
        console.log('Fallback download error:', fallbackErr);
        return null;
      }
    }
  };

  // --- Helper: Save base64 image ---
  const saveBase64Image = async (base64String, filenameHint) => {
    try {
      const matches = base64String.match(/^data:image\/([^;]+);base64,(.*)$/);
      if (!matches) {
        throw new Error('Invalid base64 data');
      }
      
      const extension = matches[1] || 'jpg';
      const base64 = matches[2];
      const localFilename = `${filenameHint}_${Date.now()}.${extension}`;
      const localPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${localFilename}`;
      
      await FileSystem.writeAsStringAsync(localPath, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      return localPath;
    } catch (err) {
      console.log('Base64 save error:', err);
      return null;
    }
  };

  // --- Helper: save an image to gallery ---
  const saveImageToGallery = async (img, filenameHint = 'shaaka') => {
    if (!img) {
      console.log('No image provided');
      return false;
    }

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') {
        Alert.alert(t.permissionRequired, t.allowPhotos);
        return false;
      }

      let imageUri = null;
      
      // Handle different image types
      if (typeof img === 'string') {
        // String could be URL or base64
        if (img.startsWith('data:image')) {
          // Handle base64
          imageUri = await saveBase64Image(img, filenameHint);
        } else if (img.startsWith('http://') || img.startsWith('https://')) {
          // Handle remote URL
          imageUri = await downloadRemoteImage(img, filenameHint);
        } else if (img.startsWith('file://')) {
          // Local file
          imageUri = img;
        }
      } else if (typeof img === 'object') {
        if (img.uri) {
          if (img.uri.startsWith('http://') || img.uri.startsWith('https://')) {
            imageUri = await downloadRemoteImage(img.uri, filenameHint);
          } else {
            imageUri = img.uri;
          }
        } else if (img.url) {
          if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
            imageUri = await downloadRemoteImage(img.url, filenameHint);
          } else {
            imageUri = img.url;
          }
        }
      } else if (typeof img === 'number') {
        // Handle require() images
        try {
          const asset = await Asset.fromModule(img).downloadAsync();
          imageUri = asset.localUri || asset.uri;
        } catch (err) {
          console.log('Error loading asset:', err);
          return false;
        }
      }

      if (!imageUri) {
        console.log('Could not determine image URI');
        return false;
      }

      // Normalize remote formats such as WebP before adding them to the gallery.
      const normalizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      const asset = await MediaLibrary.createAssetAsync(normalizedImage.uri);
      if (!asset) throw new Error('The image could not be added to the device gallery');
      
      // Add to album
      const albumName = 'Shaaka';
      try {
        const album = await MediaLibrary.getAlbumAsync(albumName);
        if (!album) {
          await MediaLibrary.createAlbumAsync(albumName, asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album.id, false);
        }
      } catch (e) {
        console.log('Could not create/add album:', e);
      }

      return true;
    } catch (err) {
      console.log('saveImageToGallery error:', err);
      return false;
    }
  };

  // --- Download a single image (tapped) ---
  const handleDownloadSingleImage = async (image) => {
    try {
      const ok = await saveImageToGallery(image, 'shaaka_image');
      if (ok) {
        Alert.alert(t.savedTitle, t.imageSaved);
      } else {
        Alert.alert(t.error, t.saveFailed);
      }
    } catch (error) {
      console.log('Single download error:', error);
      Alert.alert(t.error, t.saveFailed);
    }
  };

  // --- Download ALL images (button) ---
  const downloadAllImages = async () => {
    if (!house || !house.houseImages || house.houseImages.length === 0) {
      Alert.alert(t.noImages, '');
      return;
    }

    setDownloadingAll(true);
    let savedCount = 0;
    let errors = [];

    try {
      for (let i = 0; i < house.houseImages.length; i++) {
        const image = house.houseImages[i];
        try {
          const ok = await saveImageToGallery(
            image,
            `shaaka_${(house.productName || 'product').replace(/\s+/g, '_')}_${i + 1}`
          );
          if (ok) {
            savedCount++;
          } else {
            errors.push(`Image ${i + 1}`);
          }
        } catch (e) {
          console.log(`Error saving image ${i + 1}:`, e);
          errors.push(`Image ${i + 1}`);
        }
      }

      if (savedCount > 0) {
        let message = `${savedCount} of ${house.houseImages.length} image(s) ${t.downloadSuccess.toLowerCase()}`;
        if (errors.length > 0) {
          message += `\nFailed to save: ${errors.join(', ')}`;
        }
        Alert.alert(t.downloadSuccess, message);
      } else {
        Alert.alert(t.downloadError, t.saveFailed);
      }
    } catch (error) {
      console.log('Download all error:', error);
      Alert.alert(t.error, t.downloadError);
    } finally {
      setDownloadingAll(false);
    }
  };

  // ---- Image viewer handlers ----
  const openImageViewer = (item, index) => {
    setViewerIndex(index);
    setImageViewerVisible(true);
  };

  const handleViewerDownload = (image) => {
    handleDownloadSingleImage(image);
  };

  const renderLoading = () => {
    if (loadingLogo) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.center}>
            <Animated.Image
              source={loadingLogo}
              style={[styles.loadingImage, { transform: [{ scale: scaleAnim }] }]}
              resizeMode="contain"
            />
            <Text style={[styles.loadingText, { color: theme.text }]}>{t.loading}</Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  };

  useEffect(() => {
    if (postNotFound) {
      Alert.alert(t.error, t.postNotAvailable);
      navigation.goBack();
    }
  }, [postNotFound]);

  if (loading) return renderLoading();

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loginPromptContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={theme.accent} />
          <Text style={[styles.loginPromptTitle, { color: theme.text }]}>{t.loginTitle}</Text>
          <Text style={[styles.loginPromptText, { color: theme.textSecondary }]}>{t.loginRequired}</Text>
          <TouchableOpacity
            style={[styles.loginButton, { borderColor: theme.accent, borderWidth: 1 }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginButtonText, { color: theme.accent }]}>{t.login}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!house) return null;

  const price = house.amount || `${house.price?.toLocaleString()} RWF`;
  const productName = house.productName || 'Product';
  const sellerName = house.username || 'User';
  const sellerAvatar = house.userAvatar;
  const location = house.location;
  const description = house.description;
  const priceNegotiable = house.priceNegotiable;
  const callNumber = house.contactNumber1;
  const whatsappNumber = house.contactNumber2;
  const sellerId = house.user?._id || house.user;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        {/* Image Slider – now opens image viewer on tap */}
        <AutoSlidingImageSlider
          images={house.houseImages}
          theme={theme}
          onImagePress={openImageViewer}
        />

        {/* Fixed Header Area */}
        <View style={[styles.fixedHeaderArea, { backgroundColor: theme.background }]}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.subProductName, { color: theme.textSecondary }]}>{productName}</Text>
              <View style={styles.tagsRow}>
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>Sold by {sellerName}</Text>
                <Text style={[styles.bullet, { color: theme.textSecondary }]}>•</Text>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>{location}</Text>
              </View>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={theme.accent} />
                <Ionicons name="star" size={16} color={theme.accent} />
                <Ionicons name="star" size={16} color={theme.accent} />
                <Ionicons name="star" size={16} color={theme.accent} />
                <Ionicons name="star" size={16} color={theme.border} />
                <Text style={[styles.ratingText, { color: theme.textSecondary }]}>12.5k (User)</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: theme.text }]}>
                {t.pricePrefix}{price}
              </Text>
              {priceNegotiable && (
                <Text style={[styles.negotiable, { color: theme.accent }]}>{t.priceNegotiable}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollableContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Owner Pill */}
          <View style={[styles.ownerPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Image source={getImageSource(sellerAvatar)} style={styles.ownerAvatar} />
            <View>
              <Text style={[styles.ownerName, { color: theme.text }]}>{sellerName}</Text>
              <Text style={[styles.ownerLabel, { color: theme.textSecondary }]}>Product Owner</Text>
            </View>
          </View>

          {/* Tab Bar */}
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'Contact' && styles.activeTabItem, { borderBottomColor: theme.text }]}
              onPress={() => setActiveTab('Contact')}
            >
              <Text style={[styles.tabText, activeTab === 'Contact' ? styles.activeTabText : {}, { color: activeTab === 'Contact' ? theme.text : theme.textSecondary }]}>Contact</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'Description' && styles.activeTabItem, { borderBottomColor: theme.text }]}
              onPress={() => setActiveTab('Description')}
            >
              <Text style={[styles.tabText, activeTab === 'Description' ? styles.activeTabText : {}, { color: activeTab === 'Description' ? theme.text : theme.textSecondary }]}>Description</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'Contact' ? (
            <View style={styles.contactTabSection}>
              <View style={[styles.contactBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.contactLinkRow}>
                  <Ionicons name="call-outline" size={18} color={theme.accent} />
                  <Text style={[styles.contactText, { color: theme.text }]}>Call:</Text>
                  <TouchableOpacity onPress={handleCall}>
                    <Text style={[styles.contactLinkText, { color: theme.accent, fontWeight: '600' }]}>{callNumber || t.notProvided}</Text>
                  </TouchableOpacity>
                </View>
                {whatsappNumber && (
                  <View style={[styles.contactLinkRow, { marginTop: 8 }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#47ae87" />
                    <Text style={[styles.contactText, { color: theme.text }]}>WhatsApp:</Text>
                    <TouchableOpacity onPress={handleWhatsApp}>
                      <Text style={[styles.contactLinkText, { color: theme.more, fontWeight: '600' }]}>{whatsappNumber}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.descriptionSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{productName}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky Bottom Bar – Message + Save + Download + Share */}
        <View style={[styles.stickyBottomContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              // Build replyPost object just like in BuyPostScreen
              const sellerId = house.user?._id || house.user;
              const replyPost = {
                postId: house._id,
                title: house.productName || house.title || 'Product',
                description: house.description || '',
                image: (house.houseImages && house.houseImages.length > 0)
                  ? (typeof house.houseImages[0] === 'string' ? house.houseImages[0] : house.houseImages[0]?.uri || house.houseImages[0])
                  : null,
                price: house.price || null,
                location: house.location || '',
                ownerId: sellerId,
                timestamp: house.createdAt || new Date().toISOString(),
              };
              navigation.navigate('Chat', {
                sellerId: sellerId,
                sellerName: sellerName,
                sellerPhone: callNumber,
                postId: house._id,
                postTitle: productName,
                sellerAvatar: sellerAvatar,
                language: language,
                replyPost: replyPost,
              });
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
            <Text style={styles.messageBtnText}>{t.message}</Text>
          </TouchableOpacity>

          <View style={styles.iconBtnGroup}>
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.buttons }]}
              onPress={toggleSave}
            >
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.buttons }]}
              onPress={downloadAllImages}
              disabled={downloadingAll}
            >
              {downloadingAll ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="download-outline" size={22} color={theme.text} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.buttons }]}
              onPress={handleShare}
            >
              <Ionicons name="share-social-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Full-screen image viewer modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        images={house.houseImages}
        initialIndex={viewerIndex}
        onClose={() => setImageViewerVisible(false)}
        onDownload={handleViewerDownload}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingImage: { width: 150, height: 150 },
  loadingText: { marginTop: 22, fontSize: 16 },

  // Slider
  sliderContainer: { width: '100%', height: 320 },
  houseImage: { width: width, height: 320 },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  activeDot: { backgroundColor: '#ffffff', width: 12, height: 8 },

  // Fixed header area
  fixedHeaderArea: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -40,
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 2,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleContainer: { flex: 1, paddingRight: 12 },
  subProductName: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 },
  tagText: { fontSize: 13 },
  bullet: { marginHorizontal: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 13, marginLeft: 6 },
  priceContainer: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },
  price: { fontSize: 20, fontWeight: '700' },
  negotiable: { fontSize: 12, marginTop: 2 },

  // Scrollable area
  scrollableContent: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingBottom: 20, paddingHorizontal: 0 },

  // Owner Pill
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 0,
    paddingRight: 16,
    borderRadius: 50,
    borderWidth: 0,
    marginBottom: 20,
    marginTop: 8,
  },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  ownerName: { fontSize: 14, fontWeight: '600' },
  ownerLabel: { fontSize: 11 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tabItem: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 8 },
  activeTabItem: { borderBottomWidth: 2 },
  tabText: { fontSize: 15, fontWeight: '500' },
  activeTabText: { fontWeight: '700' },

  // Description
  descriptionSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '500', marginBottom: 8 },
  description: { fontSize: 15, lineHeight: 22 },

  // Contact
  contactTabSection: { paddingHorizontal: 20, marginBottom: 24 },
  contactBox: { borderRadius: 16, borderWidth: 0, padding: 5 },
  contactLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontSize: 14 },
  contactLinkText: { fontSize: 14 },

  // Sticky bottom
  stickyBottomContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  messageBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 14,
    gap: 8,
  },
  messageBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  iconBtnGroup: { flex: 1.5, flexDirection: 'row', gap: 8 },
  iconBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Login prompt
  loginPromptContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loginPromptTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  loginPromptText: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
  loginButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30, borderWidth: 1 },
  loginButtonText: { fontSize: 16, fontWeight: '600' },

  // Image viewer styles
  viewerContainer: {
    flex: 1,
  },
  viewerTopBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  viewerImageArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSideBtn: {
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  viewerImageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '90%',
    height: '80%',
  },
  viewerDots: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 10,
    zIndex: 10,
  },
  viewerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewerDotActive: {
    backgroundColor: '#fff',
    width: 12,
    height: 8,
  },
});

export default PostDetailScreen;