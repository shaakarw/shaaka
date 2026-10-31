import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { Logo } from '../assets';
import { getImageUri, normalizeImageUrl } from '../utils/imageUrl';
import ScreenTutorialOverlay from './ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';

const DEFAULT_AVATAR = require('../assets/avator.png');
const AUTH_ROUTES = ['Login', 'Register', 'ForgotPassword'];
const NOTIF_FETCH_THROTTLE_MS = 30_000;

// ---- Tutorial config ---------------------------------------------------------
const TUTORIAL_DELAY_MS = 600;
const TUTORIAL_PADDING = 8;
// -----------------------------------------------------------------------------

const TopBar = ({ theme, language, toggleLanguage, showBackButton = false }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user: authUser, refreshUser, isAuthenticated } = useAuth();
  const { isDarkMode } = useTheme();
  const [showTutorial, finishTutorial] = useScreenTutorial(
    `topbar-${route.name}`,
    isFocused && route.name === 'WelcomeHome' && !AUTH_ROUTES.includes(route.name),
    TUTORIAL_DELAY_MS
  );

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const backButtonRef = useRef(null);
  const notificationsRef = useRef(null);
  const avatarRef = useRef(null);
  const langRef = useRef(null);

  const lastNotifFetchRef = useRef(0);

  // Decide whether the icon behaves as "back" (←) or "home" (→).
  // Back is only allowed when the parent asked for it AND the navigator
  // actually has a previous screen.
  const canActuallyGoBack = useMemo(() => {
    try {
      return showBackButton && navigation.canGoBack();
    } catch {
      return false;
    }
  }, [showBackButton, route.name, navigation]);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated || !!authUser);
    setAvatarUri(getImageUri(authUser?.avatar));
  }, [authUser, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const checkLoginStatus = async () => {
        try {
          const loggedIn = await AsyncStorage.getItem('isLoggedIn');
          const isLogged = isAuthenticated || loggedIn === 'true';

          let currentUser = authUser;
          if (isLogged) currentUser = (await refreshUser()) || currentUser;
          if (!currentUser && isLogged) {
            const userData = await AsyncStorage.getItem('user');
            if (userData) currentUser = JSON.parse(userData);
          }

          if (!isMounted) return;
          setIsLoggedIn(isLogged && (isAuthenticated || !!currentUser));
          setAvatarUri(getImageUri(currentUser?.avatar));

          if (currentUser) {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
              if (isMounted) setUnreadNotifications(0);
              return;
            }
            const now = Date.now();
            if (now - lastNotifFetchRef.current < NOTIF_FETCH_THROTTLE_MS) return;
            lastNotifFetchRef.current = now;

            const response = await axios.get(`${BASE_URL}/api/notifications`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (isMounted) setUnreadNotifications(response.data?.unreadCount || 0);
          } else {
            if (isMounted) setUnreadNotifications(0);
          }
        } catch (error) {
          console.error('Header login check error:', error);
        }
      };

      checkLoginStatus();
      return () => { isMounted = false; };
    }, [authUser, isAuthenticated, refreshUser])
  );

  // ---- Tutorial steps — back step always included, copy classifies function ----
  const tutorialSteps = useMemo(() => {
    const en = language === 'English';
    const steps = [];

    // Step 1 — Back / Home icon (always shown, but classified)
    steps.push({
      ref: backButtonRef,
      title: canActuallyGoBack
        ? (en ? 'Back button' : 'Akamenyetso ko gusubira')
        : (en ? 'Home button' : "Akamenyetso k'ibanze"),
      body: canActuallyGoBack
        ? (en
            ? 'Function: goes back to the previous screen. Use it to exit this page without losing your place.'
            : "Icyo gikora: kigenda ku rupapuro rwabanje. Koresha ubu bwo gusohoka kuri iyi paji utabuze aho wari ugeze.")
        : (en
            ? 'Function: you are on a main screen, so there is no previous page. Tap here to go to Home.'
            : "Icyo gikora: uri ku rupapuro rw'ibanze, nta rupapuro rwabanje ruhari. Kanda hano ujye Ahabanza."),
    });

    // Step 2 — Notifications
    steps.push({
      ref: notificationsRef,
      title: en ? 'Notifications' : 'Amatangazo',
      body: en
        ? 'Function: opens your notifications. The green badge shows how many are unread.'
        : "Icyo gikora: gifungura amatangazo yawe. Akabendera gato k'icyatsi kangana n'umubare utarasomye.",
    });

    // Step 3 — Avatar (only when logged in)
    if (isLoggedIn) {
      steps.push({
        ref: avatarRef,
        title: en ? 'Profile' : 'Umwirondoro wawe',
        body: en
          ? 'Function: opens your profile page where you can edit your details and view your posts.'
          : "Icyo gikora: gifungura urupapuro rw'umwirondoro wawe aho uhindura ibikuranga ukareba ibicuruzwa byawe.",
      });
    }

    // Step 4 — Language
    steps.push({
      ref: langRef,
      title: en ? 'Language' : 'Ururimi',
      body: en
        ? 'Function: switches the app between English and Kinyarwanda at any time.'
        : "Icyo gikora: gihindura ururimi rwa porogaramu hagati y'Icyongereza n'Ikinyarwanda igihe icyo ari cyo cyose.",
    });

    return steps;
  }, [language, isLoggedIn, canActuallyGoBack]);

  const handleBackPress = useCallback(() => {
    try {
      if (canActuallyGoBack) {
        navigation.goBack();
      } else {
        // Icon points forward → go to Home instead
        navigation.navigate('Main', { screen: 'WelcomeHome' });
      }
    } catch (error) {
      console.error('Back press error:', error);
    }
  }, [canActuallyGoBack, navigation]);

  const handleAvatarPress = () => {
    try {
      if (AUTH_ROUTES.includes(route.name)) return;
      navigation.navigate(isLoggedIn ? 'Profile' : 'Login');
    } catch (error) {
      console.error('Avatar press error:', error);
    }
  };

  const badgeText = unreadNotifications > 99 ? '99+' : String(unreadNotifications);
  const normalizedAvatarUri = avatarUri ? normalizeImageUrl(avatarUri) : null;

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View style={styles.left}>
          {/* Back/Home icon — always visible */}
          <TouchableOpacity
            ref={backButtonRef}
            onPress={handleBackPress}
            style={[styles.backButton, { backgroundColor: theme.background }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={canActuallyGoBack ? 'Go back' : 'Go home'}
          >
            <Ionicons
              name={canActuallyGoBack ? 'chevron-back' : 'chevron-forward'}
              size={24}
              color={canActuallyGoBack ? theme.text : theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Main', { refreshKey: Date.now() })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
              Shaaka
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            ref={notificationsRef}
            onPress={() => navigation.navigate('Notifications')}
            style={styles.notifButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Image
              source={Logo}
              style={[styles.logo, { tintColor: theme.text }]}
              resizeMode="contain"
            />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{badgeText}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.right}>
          {isLoggedIn && (
            <TouchableOpacity
              ref={avatarRef}
              onPress={handleAvatarPress}
              style={styles.avatarButton}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Image
                source={normalizedAvatarUri ? { uri: normalizedAvatarUri } : DEFAULT_AVATAR}
                style={styles.avatar}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            ref={langRef}
            onPress={toggleLanguage}
            style={styles.langButton}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="language" size={22} color={theme.text} />
            <Text style={[styles.langText, { color: theme.text }]}>
              {language === 'English' ? 'EN' : 'RW'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScreenTutorialOverlay
        visible={showTutorial}
        steps={tutorialSteps}
        isDarkMode={isDarkMode}
        language={language}
        onFinish={finishTutorial}
        padding={TUTORIAL_PADDING}
        dimOpacity={0}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  backButton: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  appName: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Irish Grover', flexShrink: 1 },
  notifButton: { marginLeft: 10, position: 'relative' },
  logo: { width: 40, height: 38 },
  right: { flexDirection: 'row', alignItems: 'center' },
  avatarButton: { marginRight: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  langButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)',
  },
  langText: { marginLeft: 5, fontWeight: '600' },
  notificationBadge: {
    position: 'absolute', top: -4, right: -8,
    minWidth: 24, height: 24, paddingHorizontal: 4,
    borderRadius: 12, backgroundColor: '#47ae87',
    alignItems: 'center', justifyContent: 'center',
  },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default TopBar;