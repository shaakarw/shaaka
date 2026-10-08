import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BlurView from '../components/BlurViewWrapper';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 1, 680);
const CARD_WIDTH = PANEL_WIDTH;

const translations = {
  English: { swipeHint: 'Swipe to see more' },
  Kinyarwanda: { swipeHint: 'Siga ujye ku kindi' },
};

const getImageSource = (img) => {
  if (!img) return null;
  if (typeof img === 'string') return { uri: img };
  if (typeof img === 'object' && img.uri) return img;
  if (typeof img === 'object' && img.url) return { uri: img.url };
  return img;
};

const ZoomableImage = ({ source }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const startDistance = React.useRef(0);
  const startScale = React.useRef(1);

  const getDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const [firstTouch, secondTouch] = touches;
    const dx = firstTouch.pageX - secondTouch.pageX;
    const dy = firstTouch.pageY - secondTouch.pageY;
    return Math.sqrt((dx * dx) + (dy * dy));
  };

  const resetZoom = () => {
    startDistance.current = 0;
    startScale.current = 1;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
      onPanResponderGrant: (event) => {
        const distance = getDistance(event.nativeEvent.touches);
        if (!distance) return;
        startDistance.current = distance;
        startScale.current = scale.__getValue ? scale.__getValue() : 1;
      },
      onPanResponderMove: (event) => {
        const distance = getDistance(event.nativeEvent.touches);
        if (!startDistance.current || !distance) return;

        const nextScale = Math.min(2, Math.max(1, startScale.current * (distance / startDistance.current)));
        scale.setValue(nextScale);
      },
      onPanResponderRelease: () => {
        if ((scale.__getValue ? scale.__getValue() : 1) < 1.01) {
          resetZoom();
          return;
        }

        const currentScale = Math.min(2, Math.max(1, scale.__getValue ? scale.__getValue() : 1));
        startDistance.current = 0;
        Animated.spring(scale, {
          toValue: currentScale,
          useNativeDriver: true,
          friction: 7,
          tension: 80,
        }).start();
      },
      onPanResponderTerminate: () => {
        resetZoom();
      },
    })
  ).current;

  return (
    <Animated.Image
      source={source}
      style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}
      resizeMode="contain"
      {...panResponder.panHandlers}
    />
  );
};

const PreviewImageScreen = ({
  visible,
  images = [],
  onClose,
  isDarkMode,
  productName,
  description,
  language = 'English',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = React.useRef(null);
  const t = translations[language] || translations.English;

  React.useEffect(() => {
    setCurrentIndex(0);
  }, [visible, images]);

  const goToImage = (index) => {
    if (index < 0 || index >= images.length) return;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  if (!visible || images.length === 0) return null;

  const colors = {
    text: '#FFFFFF',
    secondaryText: '#D0D0D0',
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <View
            pointerEvents="none"
            style={styles.overlayBackground}
          />
          <TouchableWithoutFeedback onPress={(event) => event.stopPropagation()}>
            <View style={styles.panel}>
              <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                snapToInterval={CARD_WIDTH + 10}
                snapToAlignment="start"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, index) => `${index}`}
                onScroll={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + 10));
                  if (index !== currentIndex) setCurrentIndex(index);
                }}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + 10));
                  setCurrentIndex(index);
                }}
                contentContainerStyle={styles.imageGrid}
                renderItem={({ item }) => (
                  <View style={styles.imageCard}>
                    <Image
                      source={getImageSource(item)}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      blurRadius={10}
                    />
                    <BlurView
                      tint={isDarkMode ? 'dark' : 'light'}
                      intensity={10}
                      style={StyleSheet.absoluteFill}
                    />
                    <ZoomableImage source={getImageSource(item)} />

                    <View style={styles.textOverlay}>
                      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                        {productName || 'Product'}
                      </Text>
                      {!!description && (
                        <Text style={[styles.description, { color: colors.secondaryText }]} numberOfLines={2}>
                          {description}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      accessibilityLabel="Close image preview"
                      style={styles.closeButton}
                      onPress={onClose}
                    >
                      <Ionicons name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    {images.length > 1 && (
                      <>
                        <Text style={styles.swipeHint}>{t.swipeHint}</Text>
                        <View style={styles.dotsContainer}>
                          {images.map((_, dotIndex) => (
                            <View
                              key={dotIndex}
                              style={[styles.dot, dotIndex === currentIndex && styles.activeDot]}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
              />

              {images.length > 1 && currentIndex === 0 && (
                <TouchableOpacity
                  accessibilityLabel="Next image"
                  style={[styles.slideButton, styles.slideButtonLeft]}
                  onPress={() => goToImage(currentIndex + 1)}
                >
                  <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {images.length > 1 && currentIndex === images.length - 1 && (
                <TouchableOpacity
                  accessibilityLabel="Previous image"
                  style={[styles.slideButton, styles.slideButtonRight]}
                  onPress={() => goToImage(currentIndex - 1)}
                >
                  <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.60,
    backgroundColor: 'transparent',
  },
  panel: {
    width: PANEL_WIDTH,
    height: SCREEN_HEIGHT * 0.70,
    marginBottom: SCREEN_HEIGHT * 0,
    overflow: 'hidden',
    justifyContent: 'center',

  },
  imageGrid: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  imageCard: {
    width: CARD_WIDTH,
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: '#000',
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  slideButton: {
    position: 'absolute',
    top: '50%',
    width: 42,
    height: 42,
    marginTop: -21,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  slideButtonLeft: {
    left: 12,
  },
  slideButtonRight: {
    right: 12,
  },
  swipeHint: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  activeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});

export default PreviewImageScreen;
