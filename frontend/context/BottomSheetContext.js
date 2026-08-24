import React, { createContext, useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

const BottomSheetContext = createContext(null);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
let globalBottomSheetHandler = null;

export const setGlobalBottomSheetHandler = (handler) => {
  globalBottomSheetHandler = handler;
};

export const showGlobalBottomSheet = (config) => {
  if (typeof globalBottomSheetHandler === 'function') {
    globalBottomSheetHandler(config);
    return true;
  }
  return false;
};

const typeHeights = {
  logout: SCREEN_HEIGHT * 0.40,
  login: SCREEN_HEIGHT * 0.45,
  success: SCREEN_HEIGHT * 0.35,
  error: SCREEN_HEIGHT * 0.45,
  info: SCREEN_HEIGHT * 0.50,
  loading: SCREEN_HEIGHT * 0.25,
  social: SCREEN_HEIGHT * 0.40, // height for social media icons sheet
};

const getTypeColors = (type, theme) => {
  switch (type) {
    case 'logout':
      return { accent: '#d87428', secondary: '#d87428', icon: '#d87428' };
    case 'login':
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#47ae87' };
    case 'success':
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#47ae87' };
    case 'error':
      return { accent: '#d87428', secondary: '#d87428', icon: '#d87428' };
    case 'info':
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#47ae87' };
    case 'loading':
      return { accent: theme.accent, secondary: theme.accent, icon: theme.accent };
    case 'social':
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#47ae87' };
    default:
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#d87428' };
  }
};

const defaultConfig = {
  type: 'info',
  title: 'Info',
  message: '',
  icon: 'information-circle-outline',
  buttonText: 'OK',
  buttonAction: null,
  secondaryButtonText: null,
  secondaryAction: null,
  autoDismiss: 0,
  onDismiss: null,
  loading: false,
  socialLinks: [],
};

export const BottomSheet = ({ visible, config, onClose }) => {
  const { theme } = useTheme();
  const resolvedConfig = { ...defaultConfig, ...config };
  const { type, title, message, icon, buttonText, buttonAction, secondaryButtonText, secondaryAction, autoDismiss, onDismiss, loading, socialLinks } = resolvedConfig;
  const colors = useMemo(() => getTypeColors(type, theme), [type, theme]);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onClose?.();
      onDismiss?.();
    });
  }, [onClose, onDismiss, overlayOpacity, slideAnim]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    Animated.parallel([
      Animated.spring(overlayOpacity, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 5 }),
    ]).start();
  }, [visible, overlayOpacity, slideAnim]);

  useEffect(() => {
    if (!visible || !autoDismiss) return;
    const timer = setTimeout(() => {
      closeSheet();
    }, autoDismiss);
    return () => clearTimeout(timer);
  }, [visible, autoDismiss, closeSheet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !loading,
      onMoveShouldSetPanResponder: (_, gs) => !loading && Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (!loading && gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (!loading) {
          if (gs.dy > 70 || gs.vy > 0.5) closeSheet();
          else {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
          }
        }
      },
    })
  ).current;

  if (!visible) return null;

  const handlePrimaryPress = () => {
    if (buttonAction) {
      buttonAction();
    }
    closeSheet();
  };

  const handleSecondaryPress = () => {
    if (secondaryAction) {
      secondaryAction();
    }
    closeSheet();
  };

  const openSocialLink = async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    } catch (error) {
      if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    }
  };

  const sheetHeight = typeHeights[type] || SCREEN_HEIGHT * 0.3;

  return (
    <>
      <TouchableWithoutFeedback onPress={type === 'logout' || loading ? undefined : closeSheet}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: sheetHeight,
            backgroundColor: theme.background,
            borderColor: theme.border,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handle} />

        {type === 'social' ? (
          <View style={styles.socialContent}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <View style={styles.socialIconsRow}>
              {socialLinks.map((item, index) => (
                <TouchableOpacity key={index} onPress={() => openSocialLink(item.url, item.fallbackUrl)}>
                  <View style={[styles.socialIconCircleSmall, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon} size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={closeSheet}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.content}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <View style={styles.content}>
            <Ionicons name={icon || 'information-circle-outline'} size={48} color={colors.icon} />

            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

            {message ? (
              <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
            ) : null}

            {(buttonText || secondaryButtonText) && (
              <View style={styles.buttonsRow}>
                {secondaryButtonText ? (
                  <TouchableOpacity
                    onPress={handleSecondaryPress}
                    style={[
                      styles.button,
                      styles.secondaryButton,
                      { backgroundColor: '#47ae87' },
                    ]}
                  >
                    <Text style={styles.buttonText}>{secondaryButtonText}</Text>
                  </TouchableOpacity>
                ) : null}

                {buttonText ? (
                  <TouchableOpacity
                    onPress={handlePrimaryPress}
                    style={[
                      styles.button,
                      styles.primaryButton,
                      { backgroundColor: '#d87428', flex: secondaryButtonText ? 1 : 1 },
                    ]}
                  >
                    <Text style={styles.buttonText}>{buttonText}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </>
  );
};

export const BottomSheetProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState(null);

  const showBottomSheet = useCallback((nextConfig) => {
    setConfig({ ...defaultConfig, ...nextConfig });
    setVisible(true);
  }, []);

  const closeBottomSheet = useCallback(() => {
    setVisible(false);
    setTimeout(() => setConfig(null), 220);
  }, []);

  useEffect(() => {
    setGlobalBottomSheetHandler(showBottomSheet);
    return () => setGlobalBottomSheetHandler(null);
  }, [showBottomSheet]);

  const value = useMemo(
    () => ({ showBottomSheet, closeBottomSheet }),
    [showBottomSheet, closeBottomSheet]
  );

  return (
    <BottomSheetContext.Provider value={value}>
      {children}
      <BottomSheet visible={visible} config={config} onClose={closeBottomSheet} />
    </BottomSheetContext.Provider>
  );
};

export const useBottomSheet = () => {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error('useBottomSheet must be used inside BottomSheetProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    zIndex: 20,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 85,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    zIndex: 21,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#b4b4b4',
    alignSelf: 'center',
    marginBottom: 18,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 48,
  },
  secondaryButton: {
    minHeight: 48,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Social sheet styles
  socialContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  socialIconCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#d87428',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});