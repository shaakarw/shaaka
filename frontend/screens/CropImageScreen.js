// screens/CropImageScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  PanResponder,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useBottomSheet } from '../context/BottomSheetContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_IMAGE_HEIGHT = 500; // desired max height
const MIN_CROP_HEIGHT_DISPLAY = 40; // minimum draggable height in display pixels

const translations = {
  English: {
    cropTitle: 'Crop Image',
    noImageProvided: 'No image provided',
    failedLoadDimensions: 'Failed to load image dimensions',
    cropFailed: 'Crop Failed',
    unableToCrop: 'Unable to crop the image. Please try again.',
    ok: 'OK',
    cropHeight: 'Crop Height:',
    withinLimit: 'Within 500px limit',
    aboveLimit: 'Above 500px – please crop to 500px or less',
    cancel: 'Cancel',
    cropUse: 'Crop & Use',
    error: 'Error',
  },
  Kinyarwanda: {
    cropTitle: 'Guca Ifoto',
    noImageProvided: 'Nta foto yatanzwe',
    failedLoadDimensions: 'Ntibyashobotse kubona ibipimo bya foto',
    cropFailed: 'Guca ifoto byanze',
    unableToCrop: 'Ntibyashobotse guca ifoto. Ongera ugerageze.',
    ok: 'Sawa',
    cropHeight: 'Uburebure bwo guca:',
    withinLimit: 'Buri munsi ya 500 px',
    aboveLimit: 'Hejuru ya 500 px – nyamuneka guca kuri 500 px cyangwa munsi',
    cancel: 'Reka',
    cropUse: 'Guca & Koresha',
    error: 'Ikibazo',
  },
};

const CropImageScreen = ({ language = 'English' }) => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { imageUri } = route.params || {};
  const { showBottomSheet, closeBottomSheet } = useBottomSheet();

  // Resolve final language from route params or prop
  const finalLanguage = route.params?.language || language;
  const t = translations[finalLanguage] || translations.English;

  // State
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [isCropping, setIsCropping] = useState(false);

  const topHandleRef = useRef(null);
  const bottomHandleRef = useRef(null);
  const moveHandleRef = useRef(null);

  const cropHeightOriginal = useMemo(() => {
    if (displaySize.height === 0 || imageSize.height === 0) return 0;
    const cropHeightDisplay = cropBottom - cropTop;
    return Math.round((cropHeightDisplay / displaySize.height) * imageSize.height);
  }, [cropTop, cropBottom, displaySize, imageSize]);

  const heightColor = cropHeightOriginal <= MAX_IMAGE_HEIGHT ? '#2ecc71' : '#e67e22';

  useEffect(() => {
    if (!imageUri) {
      Alert.alert(t.error, t.noImageProvided);
      navigation.goBack();
      return;
    }
    Image.getSize(
      imageUri,
      (width, height) => {
        setImageSize({ width, height });
        const maxWidth = SCREEN_WIDTH - 32;
        const maxHeight = SCREEN_HEIGHT * 0.6;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        const dispWidth = width * ratio;
        const dispHeight = height * ratio;
        setDisplaySize({ width: dispWidth, height: dispHeight });
        const initialCropHeightDisplay =
          height <= MAX_IMAGE_HEIGHT
            ? dispHeight
            : (MAX_IMAGE_HEIGHT / height) * dispHeight;
        const initialCropTop = (dispHeight - initialCropHeightDisplay) / 2;
        const initialCropBottom = initialCropTop + initialCropHeightDisplay;
        setCropTop(initialCropTop);
        setCropBottom(initialCropBottom);
      },
      (error) => {
        Alert.alert(t.error, t.failedLoadDimensions);
        navigation.goBack();
      }
    );
  }, [imageUri, t]);

  const topPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const newTop = Math.max(0, cropTop + gesture.dy);
          const minBottom = newTop + MIN_CROP_HEIGHT_DISPLAY;
          if (minBottom > displaySize.height) return;
          setCropTop(newTop);
          setCropBottom(Math.max(cropBottom, minBottom));
        },
      }),
    [cropTop, cropBottom, displaySize]
  );

  const bottomPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const newBottom = Math.min(displaySize.height, cropBottom + gesture.dy);
          const maxTop = newBottom - MIN_CROP_HEIGHT_DISPLAY;
          if (maxTop < 0) return;
          setCropBottom(newBottom);
          setCropTop(Math.min(cropTop, maxTop));
        },
      }),
    [cropTop, cropBottom, displaySize]
  );

  const movePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          const cropHeight = cropBottom - cropTop;
          let newTop = cropTop + gesture.dy;
          newTop = Math.max(0, newTop);
          newTop = Math.min(displaySize.height - cropHeight, newTop);
          setCropTop(newTop);
          setCropBottom(newTop + cropHeight);
        },
      }),
    [cropTop, cropBottom, displaySize]
  );

  const handleCrop = async () => {
    if (cropHeightOriginal <= 0 || isCropping) return;
    setIsCropping(true);
    try {
      const cropData = {
        crop: {
          originX: 0,
          originY: Math.round((cropTop / displaySize.height) * imageSize.height),
          width: imageSize.width,
          height: cropHeightOriginal,
        },
      };
      const result = await ImageManipulator.manipulateAsync(imageUri, [cropData], {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      navigation.navigate('AddPost', { croppedImageUri: result.uri });
    } catch (error) {
      console.error('Crop error:', error);
      showBottomSheet({
        type: 'error',
        title: t.cropFailed,
        message: t.unableToCrop,
        buttonText: t.ok,
      });
    } finally {
      setIsCropping(false);
    }
  };

  if (!imageUri || imageSize.width === 0 || displaySize.width === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
       
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t.cropTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
          resizeMode="contain"
        />

        <View
          style={[
            styles.cropOverlay,
            {
              top: cropTop,
              height: cropBottom - cropTop,
              width: displaySize.width,
            },
          ]}
          {...movePanResponder.panHandlers}
        >
          <View
            style={[styles.cropHandle, styles.topHandle, { backgroundColor: theme.accent }]}
            {...topPanResponder.panHandlers}
          >
            <View style={styles.handleBar} />
          </View>
          <View
            style={[styles.cropHandle, styles.bottomHandle, { backgroundColor: theme.accent }]}
            {...bottomPanResponder.panHandlers}
          >
            <View style={styles.handleBar} />
          </View>
        </View>

        <View style={[styles.dimArea, { top: 0, height: cropTop, width: displaySize.width }]} />
        <View
          style={[
            styles.dimArea,
            {
              top: cropBottom,
              height: displaySize.height - cropBottom,
              width: displaySize.width,
            },
          ]}
        />
      </View>

      <View style={styles.heightInfoContainer}>
        <Text style={[styles.heightLabel, { color: theme.textSecondary }]}>
          {t.cropHeight}
        </Text>
        <Text style={[styles.heightValue, { color: theme.more }]}>
          {cropHeightOriginal} px
        </Text>
        <Text style={[styles.heightHint, { color: theme.textSecondary }]}>
          {cropHeightOriginal <= MAX_IMAGE_HEIGHT
            ? t.withinLimit
            : t.aboveLimit}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>{t.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.cropButton,
            { backgroundColor: theme.accent },
            cropHeightOriginal > MAX_IMAGE_HEIGHT && { opacity: 0.7 },
          ]}
          onPress={handleCrop}
          disabled={isCropping || cropHeightOriginal > MAX_IMAGE_HEIGHT}
        >
          {isCropping ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={[styles.buttonText, styles.cropButtonText]}>{t.cropUse}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... styles remain exactly the same
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cropOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 2,
  },
  cropHandle: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topHandle: {
    top: -10,
  },
  bottomHandle: {
    bottom: -10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  dimArea: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heightInfoContainer: {
    padding: 16,
    alignItems: 'center',
  },
  heightLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  heightValue: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  heightHint: {
    fontSize: 12,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cropButton: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cropButtonText: {
    color: '#fff',
  },
});

export default CropImageScreen;