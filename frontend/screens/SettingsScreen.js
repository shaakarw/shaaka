// screens/SettingsScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  RefreshControl,
  Linking,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBottomSheet } from '../context/BottomSheetContext';
import AppAlert from '../utils/alert';
import { OFFLINE_STORAGE_ENABLED_KEY, offlineDatabase, setOfflineStorageEnabled } from '../services/offlineDatabase';
import { offlineStorage } from '../services/offlineStorage';
import { mediaCache } from '../services/mediaCache';
import { reelVideoCache } from '../services/reelVideoCache';
import { startupPrefetch } from '../services/startupPrefetch';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const LOGOUT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.3;
// Reserve space so modal overlays and bottom-sheets don't cover app's bottom navigation
const BOTTOM_NAV_HEIGHT = 34;

// ---------- Translations (unchanged) ----------
const translations = {
  English: {
    settings: 'Settings',
    appearance: 'Appearance',
    offlineData: 'Save data for offline use',
    disableOfflineDataTitle: 'Turn off offline data?',
    disableOfflineDataConfirm: 'Downloaded offline content and cached images will be deleted. Messages waiting to sync will be kept.',
    cancel: 'Cancel',
    offlineDataEnableFailed: 'Could not update offline data settings. Please try again.',
    offlineDataCleared: 'Offline data cleared',
    offlineDataClearFailed: 'Could not clear offline data. Please try again.',
    darkMode: 'Dark Mode',
    account: 'Account',
    personalInfo: 'Personal Information',
    changePassword: 'Change Password',
    notifications: 'Notifications',
    pushNotifications: 'Push Notifications',
    notificationPreferences: 'Notification Preferences',
    supportAbout: 'Support & About',
    howItWorks: 'How the App Works',
    howItWorksDesc: 'SHAAKA helps you buy and sell locally. Post your products, browse shops, and connect with buyers.',
    termsPolicies: 'Terms & Policies',
    appVersion: 'App Version',
    logout: 'Log Out',
    login: 'Log In',
    adminLogin: 'Admin Login',
    logoutConfirmTitle: 'Are you sure you want to log out?',
    logoutConfirmMessage: 'You can sign in again anytime.',
    yes: 'Yes',
    no: 'No',
    language: 'Language',
    english: 'English',
    kinyarwanda: 'Kinyarwanda',
    comingSoon: 'Coming soon',
    editProfile: 'Edit Profile',
    profileInfo: 'Profile Information',
    phone: 'Phone',
    active: 'Active',
    close: 'Close',
    loginRequired: 'Login Required',
    loginToViewSubscriptions: 'Please login to view your subscriptions.',
    guest: 'Guest',

    subscription: 'Account',
    mySubscriptions: 'Account',
    subscriptionDescription: 'View your account and profile information',

    legalPolicies: 'Legal & Policies',
    privacyPolicy: 'Privacy Policy',
    termsConditions: 'Terms & Conditions',
    communityGuidelines: 'Community Guidelines',
    paymentSubscriptionPolicy: 'Account & Safety Policy',
    accountSafetyPolicy: 'Account & Safety Policy',
    mapShopListingPolicy: 'Map & Shop Listing Policy',
   
    privacyPolicyText: 'SHAAKA collects your phone number, username, and your product to provide the service. Your data is stored securely and can never shared . You can request deletion of your account any time.',
    termsConditionsText: 'By using SHAAKA you agree to our terms. You must be at least 18 years old (children can use it with supervision). You are responsible for your account and all content you post.',
    communityGuidelinesText: 'Respect others, share accurate information, use real shop locations, and report harmful content. No hate speech, harassment, threats, violence, terrorism, porn, spam, fake businesses, fraud, scams, illegal products, or impersonation allowed.',
    paymentSubscriptionPolicyText: 'This app does not charge a subscription fee. If you have any issue with your account, contact SHAAKA support directly.',
    accountSafetyPolicyText: 'Keep your password secure, don\'t share account information with others, and avoid bots. We will suspend accounts that violate our policies. Contact us at 0796640462 / 0799882580 or via social media for help.',
    mapShopListingPolicyText: 'Shops must be real and accurately located. Fake or illegal businesses will be removed. Duplicate listings are prohibited.',
   
  
    notProvided: 'N/A',
    statusActive: 'Active',
    statusExpired: 'Expired',
    statusPending: 'Pending',
    statusCancelled: 'Cancelled',

    connectWithUs: 'Connect Us',
    followUs: 'Contact using social media',
  },
 Kinyarwanda: {
    settings: 'Igenamiterere',
    appearance: 'Igaragara rya shaaka',
    offlineData: 'Bika amakuru ',
    disableOfflineDataTitle: 'Uzime kubika amakuru yo gukoresha nta murongo?',
    disableOfflineDataConfirm: 'Amakuru n’amafoto byari byarabitswe bizasibwa. Ubutumwa butaroherezwa buzasigara.',
    cancel: 'Hagarika',
    offlineDataEnableFailed: 'Ntibyashobotse guhindura igenamiterere. Ongera ugerageze.',
    offlineDataCleared: 'Amakuru yabitswe yasibwe',
    offlineDataClearFailed: 'Ntibyashobotse gusiba amakuru yabitswe. Ongera ugerageze.',
    darkMode: 'Kwijima',
    account: 'Konti',
    personalInfo: 'Amakuru bwite',
    changePassword: 'Hindura ijambobanga',
    notifications: 'Imenyesha',
    pushNotifications: 'Kukumenyesha',
    notificationPreferences: 'Uko imenyesha rikora',
    supportAbout: 'Ubufasha n\'amakuru',
    howItWorks: 'Uko shaaka ikora',
    howItWorksDesc: 'SHAAKA igufasha kugura no kugurisha. Tangaza ibicuruzwa byawe, reba amaduka, kandi uvugane n\'abaguzi.',
    termsPolicies: 'Amategeko n\'amabwiriza',
    appVersion: 'Verisiyo',
    logout: 'Sohoka',
    login: 'Kwinjira',
    adminLogin: 'Kwinjira nk\'umuyobozi',
    logoutConfirmTitle: 'Ese urashaka gusohoka?',
    logoutConfirmMessage: 'Ushobora kwinjira igihe icyo aricyo cyose.',
    yes: 'Yego',
    no: 'Oya',
    language: 'Ururimi',
    english: 'Icyongereza',
    kinyarwanda: 'Ikinyarwanda',
    comingSoon: 'Biraza vuba',
    editProfile: 'Hindura imyirondoro',
    profileInfo: 'Imyirondoro',
    phone: 'Telefone',
    active: 'Ikora',
    close: 'Funga',
    loginRequired: 'Ugomba kwinjira',
    loginToViewSubscriptions: 'Kugira ngo urebe iyongererwa bubasha yawe, ugomba kwinjira.',
    guest: 'Umushyitsi',

    subscription: 'Konti',
    mySubscriptions: 'Konti',
    subscriptionDescription: 'Reba amakuru ya konti yawe',

    legalPolicies: 'Amategeko n\'amabwiriza',
    privacyPolicy: 'Amabwiriza yokugira ibanga',
    termsConditions: 'Amategeko n\'amabwiriza',
    communityGuidelines: 'Uko ugomba kwitwara kuri SHAAKA',
    paymentSubscriptionPolicy: 'Amabwiriza y\'umutekano wa konti',
    accountSafetyPolicy: 'Amabwiriza y\'umutekano wa konti yawe',
    mapShopListingPolicy: 'Amabwiriza y\'ikarita n\'amaduka',
   
    privacyPolicyText: 'SHAAKA ikusanya nomero ya telefoni, izina, n\'ibicuruzwa byawe kugira ngo itange serivisi. Amakuru yawe abikwa mu mumutekano kandi ntashyirwa hanze. Ushobora gusaba gusiba konti yawe igihe icyo aricyo cyose.',
    termsConditionsText: 'Mugukoresha SHAAKA ugomba kuba ukurikiza wemera amategeko yacu. Ufite imyaka 18 (numwana yayikoreha).',
    communityGuidelinesText: 'Ugomba guha agaciro abandi, gusangiza amakuru nyayo, koresha ahantu nyayo ku maduka, kandi utangire amakuru kugihe. Nta mvugo z\'urwango, gusebyanya, iterabwoba, ubugizi bwa nabi, ibitero, porono, amaduka y\'impimbano, uburiganya, ibicuruzwa bitemewe.',
    paymentSubscriptionPolicyText: 'Iyi app ntabwo ikoresha amafaranga y\'ishyura. Niba ufite ikibazo na konti yawe, wandikire SHAAKA support.',
    accountSafetyPolicyText: 'Bika ijambo ryibanga ryawe mu mutekano nurisangize buri umwe wese, ntusangize konti yawe ndetse n\'ijambo banga. Konti yawe izahagarikwa ninyuranya namategeko. Hamagara 0796640462 / 0799882580 cyangwa ubandikire kuri social media.',
    mapShopListingPolicyText: 'Amaduka agomba kuba nyayo kandi mu hantu nyayo. Amaduka y\'impimbano cyangwa adasanzwe azakurwaho. Kwandika inshuro nyinshi ntibyemewe.',
   
    notProvided: 'Ntaboneka',
    statusActive: 'Ikora',
    statusExpired: 'Yashize',
    statusPending: 'Iratereganywa',
    statusCancelled: 'Yahagaritswe',

    connectWithUs: 'Twandikire',
    followUs: 'Twandikire ku mbuga ',
  },
};

// ---------- Social Media Data ----------
const socialLinks = [
  {
    name: 'Instagram',
    icon: 'logo-instagram',
    color: '#E4405F',
    url: 'instagram://user?username=shaaka_rw',
    fallbackUrl: 'https://www.instagram.com/shaaka_rw/',
  },
  {
    name: 'YouTube',
    icon: 'logo-youtube',
    color: '#FF0000',
    url: 'youtube://www.youtube.com/@shaaka-rw',
    fallbackUrl: 'https://www.youtube.com/@shaaka-rw',
  },
  {
    name: 'X',
    icon: 'logo-x',
    color: '#000000',
    url: 'https://x.com/shaaka_rw',
    fallbackUrl: 'https://x.com/shaaka_rw',
  },
  {
    name: 'Facebook',
    icon: 'logo-facebook',
    color: '#1877F2',
    url: 'fb://profile/61592686307072',
    fallbackUrl: 'https://www.facebook.com/profile.php?id=61592686307072',
  },
  {
    name: 'Email',
    icon: 'mail-outline',
    color: '#D44638',
    url: 'mailto:shaakarw@gmail.com',
    fallbackUrl: null,
  },
  {
    name: 'WhatsApp',
    icon: 'logo-whatsapp',
    color: '#25D366',
    url: 'whatsapp://send?phone=+250799882580',
    fallbackUrl: 'https://wa.me/250799882580',
  },
];

export default function SettingsScreen({ navigation, route, language = 'English', toggleLanguage }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const { showBottomSheet } = useBottomSheet();
  const [refreshing, setRefreshing] = useState(false);
  const [offlineDataEnabled, setOfflineDataEnabled] = useState(true);
  const [updatingOfflineData, setUpdatingOfflineData] = useState(false);
  const t = translations[language] || translations.English;

  // Screen-local swipe sheet state removed; all dialogs now use the shared global sheet.

  const [pushNotifications, setPushNotifications] = useState(true);
  const [adminSession, setAdminSession] = useState(false);

  useEffect(() => {
    const checkAdminSession = async () => {
      const token = await AsyncStorage.getItem('adminToken');
      setAdminSession(Boolean(token));
    };

    checkAdminSession();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(OFFLINE_STORAGE_ENABLED_KEY)
      .then(value => setOfflineDataEnabled(value !== 'false'))
      .catch(() => setOfflineDataEnabled(true));
  }, []);

  // Collapsible sections
  const [showAccount, setShowAccount] = useState(false);
  const [showLegalPolicies, setShowLegalPolicies] = useState(false);
  const [showSupportAbout, setShowSupportAbout] = useState(false);

  const navigateTo = (screen, params = {}) => {
    if (navigation) navigation.navigate(screen, params);
    else openBottomSheet(t.comingSoon, `${screen} ${t.comingSoon}`);
  };

  const openBottomSheet = (title, content) => {
    showBottomSheet({
      type: 'info',
      title,
      message: content,
      icon: 'information-circle-outline',
      buttonText: 'Close',
      buttonAction: () => {},
    });
  };

  const openSocialSheet = () => {
    showBottomSheet({
      type: 'social',
      title: t.followUs,
      message: `${t.connectWithUs}\n${socialLinks.map(item => item.name).join(', ')}`,
      icon: 'people-outline',
      buttonText: 'Close',
      socialLinks: socialLinks,
      buttonAction: () => {},
    });
    
  };

  const handleLogout = () => {
    showBottomSheet({
      type: 'logout',
      title: t.logoutConfirmTitle,
      message: t.logoutConfirmMessage,
      icon: 'log-out-outline',
      buttonText: t.yes,
      secondaryButtonText: t.no,
      buttonAction: async () => {
        await logout();
        if (navigation && navigation.reset) {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      },
      secondaryAction: () => {},
    });
  };

  const toggleLanguageHandler = () => {
    if (toggleLanguage) toggleLanguage();
    else openBottomSheet(t.language, t.comingSoon);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const updateOfflineDataPreference = async enabled => {
    setUpdatingOfflineData(true);
    try {
      await setOfflineStorageEnabled(enabled);
      setOfflineDataEnabled(enabled);
      if (enabled) {
        await startupPrefetch.run('settings-enabled');
        return;
      }
      await mediaCache.clearCachedFiles();
      await reelVideoCache.clear();
      await Promise.all([
        offlineDatabase.clearCachedData(),
        offlineStorage.clear(),
      ]);
      AppAlert.alert(t.offlineDataCleared, '');
    } catch (error) {
      AppAlert.alert('Error', t.offlineDataEnableFailed);
    } finally {
      setUpdatingOfflineData(false);
    }
  };

  const handleOfflineDataToggle = enabled => {
    if (enabled) {
      updateOfflineDataPreference(true);
      return;
    }
    AppAlert.confirm(t.disableOfflineDataTitle, t.disableOfflineDataConfirm, [
      { text: t.yes, onPress: () => updateOfflineDataPreference(false) },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const openSocialLink = async (url, fallbackUrl) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        AppAlert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
      } else {
        AppAlert.alert('Error', 'Unable to open link');
      }
    }
  };

  // Reusable social icons component
  const renderSocialIcons = () => (
    <View style={styles.socialIconsFooter}>
      <Text style={[styles.followText, { color: theme.textSecondary }]}>{t.followUs}</Text>
      <View style={styles.socialIconsRow}>
        {socialLinks.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.socialIconSmall}
            onPress={() => openSocialLink(item.url, item.fallbackUrl)}
            activeOpacity={0.7}
          >
            <View style={[styles.socialIconCircleSmall, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const policyItems = [
    { key: 'privacyPolicy', title: t.privacyPolicy, content: t.privacyPolicyText },
    { key: 'termsConditions', title: t.termsConditions, content: t.termsConditionsText },
    { key: 'communityGuidelines', title: t.communityGuidelines, content: t.communityGuidelinesText },
    { key: 'paymentSubscriptionPolicy', title: t.paymentSubscriptionPolicy, content: t.paymentSubscriptionPolicyText },
    { key: 'accountSafetyPolicy', title: t.accountSafetyPolicy, content: t.accountSafetyPolicyText },
    { key: 'mapShopListingPolicy', title: t.mapShopListingPolicy, content: t.mapShopListingPolicyText },
  ];

  const defaultAvatar = require('../assets/profile1.png');

  const profileImageSource = user?.avatar ? { uri: user.avatar } : defaultAvatar;
  const isAdmin = user?.role === 'admin';
  const hasAdminAccess = isAdmin || adminSession;
  const subscriptionLabel = user ? t.mySubscriptions : t.login;

  // ---------- Handlers with login checks ----------
  const handleSubscriptionPress = () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    navigateTo('Profile');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleAdminLogin = () => {
    navigation.navigate('AdminLogin');
  };

  const handleProfilePress = () => {
    if (!user) {
      handleLogin();
      return;
    }
    navigateTo('Profile');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['']}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Ionicons name="settings-outline" size={32} color={theme.text} />
          <Text style={[styles.title, { color: theme.text }]}>{t.settings}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          <Image source={profileImageSource} style={styles.profileAvatar} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user?.username || t.guest}
            </Text>
            <Text style={[styles.profilePhone, { color: theme.textSecondary }]}>
              {user?.phone || t.phone}
            </Text>
            {user && (
              <Text style={[styles.profileEdit, { color: theme.accent }]}>{t.editProfile}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* SUBSCRIPTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}></Text>
          
          {hasAdminAccess && (
            <TouchableOpacity onPress={handleAdminLogin}>
              <View style={[styles.settingRow, { borderBottomColor: theme.border }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={22} color={theme.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.settingText, { color: theme.text }]}>{t.adminLogin}</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* APPEARANCE */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{t.appearance}</Text>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.settingText, { color: theme.text }]}>{t.darkMode}</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: theme.accent }}
              thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.settingText, { color: theme.text }]}>{t.language}</Text>
            <TouchableOpacity onPress={toggleLanguageHandler} style={styles.languageToggle}>
              <Text style={[styles.languageText, { color: theme.accent }]}>
                {language === 'English' ? t.english : t.kinyarwanda}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* OFFLINE DATA */}
        <View style={styles.section}>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.settingText1, { color: theme.text }]}>{t.offlineData}</Text>
            <Switch
              value={offlineDataEnabled}
              onValueChange={handleOfflineDataToggle}
              disabled={updatingOfflineData}
              trackColor={{ false: '#767577', true: theme.accent }}
              thumbColor={offlineDataEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          {updatingOfflineData && <ActivityIndicator color={theme.accent} />}
        </View>

        {/* ACCOUNT (collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setShowAccount(!showAccount)}
            style={[styles.settingRow, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, flex: 1, marginBottom: 0 }]}>{t.account}</Text>
            <Ionicons
              name={showAccount ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {showAccount && (
            <>
              <TouchableOpacity onPress={() => navigateTo('ProfileEdit')}>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>{t.personalInfo}</Text>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo('ChangePassword', { adminMode: hasAdminAccess })}>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>{t.changePassword}</Text>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* NOTIFICATIONS */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{t.notifications}</Text>
          <TouchableOpacity onPress={() => navigateTo('Notifications')}>
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.settingText, { color: theme.text }]}>{t.notifications}</Text>
              <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('NotificationPreferences')}>
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.settingText, { color: theme.text }]}>{t.notificationPreferences}</Text>
              <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* LEGAL & POLICIES (collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setShowLegalPolicies(!showLegalPolicies)}
            style={[styles.settingRow, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, flex: 1, marginBottom: 0 }]}>{t.legalPolicies}</Text>
            <Ionicons
              name={showLegalPolicies ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {showLegalPolicies &&
            policyItems.map((item) => (
              <TouchableOpacity key={item.key} onPress={() => openBottomSheet(item.title, item.content)}>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>

        {/* SUPPORT & ABOUT (collapsible) */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setShowSupportAbout(!showSupportAbout)}
            style={[styles.settingRow, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, flex: 1, marginBottom: 0 }]}>{t.supportAbout}</Text>
            <Ionicons
              name={showSupportAbout ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {showSupportAbout && (
            <>
              <TouchableOpacity onPress={() => openBottomSheet(t.howItWorks, t.howItWorksDesc)}>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>{t.howItWorks}</Text>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={openSocialSheet}>
                <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.settingText, { color: theme.text }]}>{t.connectWithUs}</Text>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.settingText, { color: theme.text }]}>{t.appVersion}</Text>
                <Text style={[styles.versionText, { color: theme.textSecondary }]}>1.0.0</Text>
              </View>
            </>
          )}
        </View>

        {/* LOGOUT / LOGIN */}
        <View style={[styles.logoutContainer, { borderTopColor: theme.border }]}>
          <TouchableOpacity onPress={user ? handleLogout : handleLogin}>
            <Text style={[styles.logoutText, { color: user ? '#d87428' : '#47ae87' }]}>
              {user ? t.logout : t.login}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// ---------- Updated Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, paddingTop: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', marginLeft: 12, flex: 1 },
  refreshBtn: { padding: 4 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 0, marginBottom: 24 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: 14 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profilePhone: { fontSize: 14, marginTop: 2 },
  profileEdit: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0 },
  settingText: { fontSize: 16 },
  settingText1:{
fontSize: 15 
  },
  chevron: { fontSize: 20, fontWeight: '300', marginRight: 4 },
  versionText: { fontSize: 14 },
  languageToggle: { flexDirection: 'row', alignItems: 'center' },
  languageText: { fontSize: 16, fontWeight: '600', marginRight: 4 },
  logoutContainer: { marginTop: 20, paddingVertical: 16, alignItems: 'start', borderTopWidth: 0 },
  logoutText: { fontSize: 16, fontWeight: '600' },
  
  // Bottom sheet overlay
  sheetOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    zIndex: 100
  },
  
  // Bottom sheet container
  bottomSheetContainer: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    borderTopWidth: 1, 
    paddingHorizontal: 20, 
    paddingTop: 8, 
    paddingBottom: 20,
    zIndex: 101,
  },
  
  bottomSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 8 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bottomSheetTitle: { fontSize: 20, fontWeight: 'bold' },
  bottomSheetClose: { padding: 4 },
  bottomSheetContent: { flex: 1 },
  bottomSheetText: { fontSize: 16, lineHeight: 24 },
  
  // Logout confirm styles
  logoutConfirmMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
    lineHeight: 22,
  },
  logoutConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  logoutButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noButton: { marginRight: 6 },
  yesButton: { marginLeft: 6 },
  logoutButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  
  // Social icons
  socialIconsFooter: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingTop: 12,
  },
  followText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialIconSmall: {
    alignItems: 'center',
  },
  socialIconCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});