// context/BottomSheetContext.js
import React, { createContext, useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ContactInfoIcon from '../components/ContactInfoIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

const BottomSheetContext = createContext(null);
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

// Maximum heights per sheet type (used as a cap; the sheet shrinks to
// fit its content when it's smaller than this).
const getTypeMaxHeights = (screenHeight) => ({
  logout: Math.min(screenHeight * 0.42, 340),
  login: Math.min(screenHeight * 0.46, 380),
  success: Math.min(screenHeight * 0.36, 300),
  error: Math.min(screenHeight * 0.46, 380),
  info: Math.min(screenHeight * 0.50, 420),
  loading: Math.min(screenHeight * 0.22, 180),
  social: Math.min(screenHeight * 0.38, 320),
});

const getTypeColors = (type, theme) => {
  switch (type) {
    case 'logout':
    case 'error':
      return { accent: '#d87428', secondary: '#d87428', icon: '#d87428' };
    case 'login':
    case 'success':
    case 'info':
    case 'social':
      return { accent: '#47ae87', secondary: '#47ae87', icon: '#47ae87' };
    case 'loading':
      return { accent: theme.accent, secondary: theme.accent, icon: theme.accent };
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

const getTypeAccent = (type) => {
  switch (type) {
    case 'logout':
    case 'error':
      return '#d87428';
    case 'login':
    case 'success':
    case 'info':
    default:
      return '#47ae87';
  }
};

export const BottomSheet = ({ visible, config, onClose }) => {
  // ⬇️ We now also pull `isDarkMode` so the main icon can theme-adapt.
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const resolvedConfig = { ...defaultConfig, ...config };
  const {
    type,
    title,
    message,
    icon,
    buttonText,
    buttonAction,
    secondaryButtonText,
    secondaryAction,
    autoDismiss,
    onDismiss,
    loading,
    socialLinks,
  } = resolvedConfig;

  const colors = useMemo(() => getTypeColors(type, theme), [type, theme]);

  // ⬇️ Main-icon colour is now purely theme-driven.
  //    Dark mode → light grey (#dddddd). Light mode → near-black (#111111).
  const iconColor = isDarkMode ? '#dddddd' : '#111111';

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: screenHeight, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onClose?.();
      onDismiss?.();
    });
  }, [onClose, onDismiss, overlayOpacity, slideAnim, screenHeight]);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(overlayOpacity, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 5 }),
    ]).start();
  }, [visible, overlayOpacity, slideAnim]);

  useEffect(() => {
    if (!visible || !autoDismiss) return;
    const timer = setTimeout(() => closeSheet(), autoDismiss);
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
        if (loading) return;
        if (gs.dy > 70 || gs.vy > 0.5) closeSheet();
        else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 12 }).start();
      },
    })
  ).current;

  if (!visible) return null;

  const handlePrimaryPress = () => {
    buttonAction?.();
    closeSheet();
  };

  const handleSecondaryPress = () => {
    secondaryAction?.();
    closeSheet();
  };

  const openSocialLink = async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    } catch {
      if (fallbackUrl) await Linking.openURL(fallbackUrl);
      else Alert.alert('Error', 'Unable to open link');
    }
  };

  // Cap only — the sheet shrinks to fit its content when smaller.
  const maxHeights = getTypeMaxHeights(screenHeight);
  const maxHeight = maxHeights[type] || Math.min(screenHeight * 0.4, 340);
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <>
      <TouchableWithoutFeedback onPress={type === 'logout' || loading ? undefined : closeSheet}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            maxHeight,
            backgroundColor: theme.background,
            borderColor: theme.border,
            transform: [{ translateY: slideAnim }],
            paddingBottom: bottomPad,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handle} />

        {/* Content is scrollable so long text never clips when the sheet
            is capped by maxHeight. Small sheets shrink naturally. */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPad > 0 ? 8 : 0 },
          ]}
        >
          {type === 'social' ? (
            <View style={styles.socialContent}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                {title}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialIconsRow}>
                {socialLinks.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => openSocialLink(item.url, item.fallbackUrl)}
                  >
                    {/* Social icons keep their brand colours — untouched */}
                    <View style={[styles.socialIconCircleSmall, { backgroundColor: item.color }]}>
                      <ContactInfoIcon item={item} size={18} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
              {/* ── Main icon: theme-adaptive, no background / border ── */}
              <View style={styles.iconBadge}>
                <Ionicons
                  name={icon || 'information-circle-outline'}
                  size={32}
                  color={iconColor}
                />
              </View>

              <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
                {title}
              </Text>

              {message ? (
                <Text style={[styles.message, { color: theme.textSecondary }]} numberOfLines={6}>
                  {message}
                </Text>
              ) : null}

              {(buttonText || secondaryButtonText) && (
                <View style={styles.buttonsRow}>
                  {secondaryButtonText ? (
                    <TouchableOpacity
                      onPress={handleSecondaryPress}
                      style={[
                        styles.button,
                        styles.secondaryButton,
                        {
                          backgroundColor: 'transparent',
                          borderColor: colors.accent,
                          borderWidth: 1,
                          flex: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.accent }]} numberOfLines={1}>
                        {secondaryButtonText}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {buttonText ? (
                    <TouchableOpacity
                      onPress={handlePrimaryPress}
                      style={[
                        styles.button,
                        styles.primaryButton,
                        { backgroundColor: colors.accent, flex: 1 },
                      ]}
                    >
                      <Text style={styles.buttonText} numberOfLines={1}>
                        {buttonText}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </ScrollView>
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
  if (!context) throw new Error('useBottomSheet must be used inside BottomSheetProvider');
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
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    overflow: 'hidden',
    zIndex: 21,
    // no fixed height — height is driven by content + maxHeight
  },
  scrollContent: {
    flexGrow: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#b4b4b4',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  // ── Icon wrapper: no background, no border, no shadow ─────────────────
  //    Only centering + spacing remains so the layout is unchanged.
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  // Social sheet
  socialContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  socialIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  socialIconCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#d87428',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 34,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});