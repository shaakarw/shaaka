// App.js
import React, { useState, useCallback, Component, useEffect } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { BottomSheetProvider } from './context/BottomSheetContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogBox, View, Text, TouchableOpacity, StyleSheet, AppState, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { TabModeProvider } from './context/TabModeContext';
import axios from 'axios';
import { BASE_URL } from './constants';
import AddUpdateScreen from './screens/AddUpdateScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';

// Import Screens
import HomeScreen from './screens/HomeScreen';
import CropImageScreen from './screens/CropImageScreen';
import SettingsScreen from './screens/SettingsScreen';
import SearchScreen from './screens/SearchScreen';
import MessageScreen from './screens/MessageScreen';
import BuyPostScreen from './screens/BuyPostScreen';
import FeedScreen from './screens/FeedScreen';
import MyPostsScreen from './screens/MyPostsScreen';
import VideosScreen from './screens/VideosScreen';
import SavedPostsScreen from './screens/SavedPostsScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ChatScreen from './screens/ChatScreen';
import InstagramChatScreen from './screens/InstagramChatScreen';
import WelcomeHomeScreen from './screens/HomeScreen';
import LocateScreen from './screens/LocateScreen';
import MapScreen from './screens/MapScreen';
import AddShopScreen from './screens/AddPlaceScreen';
import ProfileScreen from './screens/ProfileScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import AdminUserScreen from './screens/AdminUserScreen';
import AdminPostsScreen from './screens/AdminPostsScreen';
import AdminReportsScreen from './screens/AdminReportsScreen';
import AdminShopsScreen from './screens/AdminShopsScreen';
import AdminBusinessAddScreen from './screens/AdminBusinessAddScreen';
import BusinessIdeasAdminScreen from './screens/BusinessIdeasAdminScreen';
import AddPostScreen from './screens/AddPostScreen';
import ViewPlaceScreen from './screens/ViewPlaceScreen';
import ViewShopScreen from './screens/ViewShopScreen';
import AddShoppingMallShopScreen from './screens/AddShoppingMallShopScreen';
import BusinessIdeasScreen from './screens/BusinessIdeasScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import NotificationPreferencesScreen from './screens/NotificationPreferencesScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import PreviewScreen from './screens/PreviewScreen';
import ShaakaLoadingScreen from './components/ShaakaLoadingScreen';
import TopBar from './components/topbar';
import BottomBar from './components/bottombar';
import MobileNavigation from './components/MobileNavigation';
import OfflineBanner from './components/OfflineBanner';
import { networkStatus } from './services/networkStatus';
import { syncManager } from './services/syncManager';
import { startupPrefetch } from './services/startupPrefetch';
import { installOfflineApiCache } from './services/offlineApiCache';

installOfflineApiCache();

// Payment

// NEW: How It Works Screen
import HowItWorksScreen from './screens/HowItWorksScreen';

// ==================== DISABLE WARNINGS & YELLOW BOXES ====================
if (__DEV__) {
  LogBox.ignoreAllLogs(true);
  LogBox.ignoreLogs([
    'Warning: ...',
    'VirtualizedLists should never be nested',
    'ReactNativeFiberHostComponent',
    'Require cycle:',
    'Non-serializable values were found in the navigation state',
  ]);
}

// ==================== GLOBAL ERROR BOUNDARY ====================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== GLOBAL ERROR CAUGHT ===');
    console.error('Error message:', error?.message || 'Unknown error');
    console.error('Error stack:', error?.stack || 'No stack trace');
    console.error('Component stack:', errorInfo?.componentStack || 'No component stack');
    console.error('===========================');
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallbackContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#ff6b6b" />
          <Text style={styles.errorFallbackTitle}>Something went wrong</Text>
          <Text style={styles.errorFallbackText}>
            The app encountered an unexpected issue. Please restart the app.
          </Text>
          <TouchableOpacity 
            style={styles.errorFallbackButton}
            onPress={() => {
              this.setState({ hasError: false, error: null });
            }}
          >
            <Text style={styles.errorFallbackButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// ==================== GLOBAL UNHANDLED REJECTION HANDLER ====================
if (typeof ErrorUtils !== 'undefined') {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('=== UNHANDLED ERROR ===');
    console.error('Is Fatal:', isFatal);
    console.error('Error:', error?.message || 'Unknown error');
    console.error('Stack:', error?.stack || 'No stack');
    console.error('=======================');
    defaultHandler(error, isFatal);
  });
}

if (typeof global !== 'undefined') {
  const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
  if (originalHandler) {
    global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
      console.error('=== UNHANDLED PROMISE REJECTION ===');
      console.error('Error:', error?.message || 'Unknown error');
      console.error('Stack:', error?.stack || 'No stack');
      console.error('==================================');
      originalHandler(error, isFatal);
    });
  }
}

if (typeof process !== 'undefined' && process.listeners) {
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED PROMISE REJECTION ===');
    console.error('Reason:', reason?.message || reason || 'Unknown reason');
    console.error('Promise:', promise);
    console.error('==================================');
  });
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/*
// ==================== CUSTOM HEADER ====================
const LegacyCustomHeader = ({ theme, language, toggleLanguage, showBackButton = false }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: authUser, refreshUser } = useAuth();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    setIsLoggedIn(!!authUser);
    setAvatarUri(authUser?.avatar || null);
  }, [authUser]);

  useFocusEffect(
    useCallback(() => {
      const checkLoginStatus = async () => {
        try {
          const loggedIn = await AsyncStorage.getItem('isLoggedIn');
          const isLogged = loggedIn === 'true';
          let currentUser = authUser;

          if (isLogged) {
            currentUser = (await refreshUser()) || currentUser;
          }

          if (!currentUser && isLogged) {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
              currentUser = JSON.parse(userData);
            }
          }

          setIsLoggedIn(!!currentUser);
          setAvatarUri(currentUser?.avatar || null);

          if (currentUser) {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
              setUnreadNotifications(0);
              return;
            }
            const response = await axios.get(`${BASE_URL}/api/notifications`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setUnreadNotifications(response.data.unreadCount || 0);
          } else {
            setUnreadNotifications(0);
          }
        } catch (error) {
          console.error('Header login check error:', error);
        }
      };
      checkLoginStatus();
    }, [])
  );

  const handleAvatarPress = () => {
    try {
      if (route.name === 'Login' || route.name === 'Register' || route.name === 'ForgotPassword') return;
      if (isLoggedIn) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('Avatar press error:', error);
    }
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
      <View style={styles.headerLeft}>
        {showBackButton && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { refreshKey: Date.now() })}
          style={{ flexDirection: 'row' }}
        >
          <Text style={[styles.appName, { color: theme.text }]}>Shaaka</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ flexDirection: 'row' }}>
          <Image source={Logo} style={{ width: 40, height: 38, left: 10 }} />
          {unreadNotifications > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.headerRight}>
        {isLoggedIn && (
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarButton}>
            <Image
              source={avatarUri ? { uri: avatarUri } : require('./assets/avator.png')}
              style={styles.avatar}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
          <Ionicons name="language" size={22} color={theme.text} />
          <Text style={{ marginLeft: 5, color: theme.text, fontWeight: '600' }}>
            {language === 'English' ? 'EN' : 'RW'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==================== CUSTOM TAB BAR (flat, single line with +) ====================
// The bottom bar is only rendered on these screens.
const BAR_ROUTES = ['WelcomeHome', 'Search', 'BuyPost', 'Locate', 'Message'];

const CustomTabBar = ({ state, navigation, theme }) => {
  const { tabMode } = useTabMode();
  const insets = useSafeAreaInsets();

  const currentRoute = state.routes[state.index];
  const currentBuyPostTab =
    currentRoute?.name === 'BuyPost'
      ? currentRoute?.params?.activeTab || 'ushaka'
      : null;

  // --- Visibility rules -------------------------------------------------
  // 1. Only show on the whitelisted screens.
  if (!currentRoute || !BAR_ROUTES.includes(currentRoute.name)) return null;
  // 2. BuyPost only shows the bar on the feed (ushaka) and videos tabs.
  const allowedBuyPostTabs = ['ushaka', 'videos'];
  if (
    currentRoute.name === 'BuyPost' &&
    !allowedBuyPostTabs.includes(currentBuyPostTab)
  ) {
    return null;
  }
  // ----------------------------------------------------------------------

  // Which tabs are visible (same logic as before, driven by TabModeContext)
  const alwaysVisible = ['WelcomeHome', 'Message'];
  const conditionalTabs =
    tabMode === 'shopMode' ? ['Search', 'BuyPost'] : ['Locate', 'AddShop'];
  const visibleTabNames = [...alwaysVisible, ...conditionalTabs];

  const order = [
    'WelcomeHome',
    'Search',
    'BuyPost',
    'Locate',
    'AddShop',
    'Message',
  ];

  const visibleRoutes = order
    .filter(name => visibleTabNames.includes(name))
    .map(name => state.routes.find(r => r.name === name))
    .filter(Boolean);

  const getIcon = (routeName, isFocused) => {
    switch (routeName) {
      case 'WelcomeHome':
        return isFocused ? 'home' : 'home-outline';
      case 'Search':
        return isFocused ? 'search' : 'search-outline';
      case 'BuyPost':
        return isFocused ? 'cart' : 'cart-outline';
      case 'Locate':
        return isFocused ? 'map' : 'map-outline';
      case 'AddShop':
        return isFocused ? 'add-circle' : 'add-circle-outline';
      case 'Message':
        return isFocused ? 'chatbubble' : 'chatbubble-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const renderTab = route => {
    const originalIndex = state.routes.findIndex(r => r.key === route.key);
    const isFocused = state.index === originalIndex;

    const onPress = () => {
      try {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      } catch (error) {
        console.error('Tab press error:', error);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
      >
        <Ionicons
          name={getIcon(route.name, isFocused)}
          size={24}
          color={isFocused ? theme.more : theme.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  const handleCreatePress = () => {
    try {
      // Reuses the existing create-post route (Stack.Screen name="AddPost").
      navigation.navigate('AddPost');
    } catch (error) {
      console.error('Create press error:', error);
    }
  };

  // Insert the "+" icon exactly in the middle of the visible tabs
  const midIndex = Math.floor(visibleRoutes.length / 2);
  const leftRoutes = visibleRoutes.slice(0, midIndex);
  const rightRoutes = visibleRoutes.slice(midIndex);

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {leftRoutes.map(renderTab)}

      <TouchableOpacity
        onPress={handleCreatePress}
        activeOpacity={0.7}
        style={styles.tabItem}
        accessibilityRole="button"
        accessibilityLabel="Create post"
      >
        <Ionicons name="add" size={26} color={theme.more} />
      </TouchableOpacity>

      {rightRoutes.map(renderTab)}
    </View>
  );
};

*/

// ==================== MAIN TABS ====================
const MainTabs = ({ language, toggleLanguage, theme, route, isLoading }) => {
  const refreshKey = route?.params?.refreshKey || 0;

  return (
    <Tab.Navigator
      key={refreshKey}
      initialRouteName="WelcomeHome"
      tabBar={props => <BottomBar {...props} theme={theme} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="WelcomeHome">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            {isLoading ? (
              <ShaakaLoadingScreen
                message="Loading..."
                backgroundColor={theme.background}
                textColor={theme.text}
              />
            ) : (
              <WelcomeHomeScreen {...props} language={language} toggleLanguage={toggleLanguage} />
            )}
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Search">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <SearchScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="BuyPost">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <BuyPostScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Locate">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <LocateScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="AddShop">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <AddShopScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Message">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <MessageScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {props => (
          <>
            <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <SettingsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

// ==================== APP CONTENT ====================
function AppContent() {
  const { theme, isDarkMode, isLoading } = useTheme();
  const baseNavigationTheme = isDarkMode ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
    colors: {
      ...baseNavigationTheme.colors,
      background: theme.background,
      card: theme.background,
    },
  };
  const navigationRef = useNavigationContainerRef();
  const [language, setLanguage] = useState('Kinyarwanda'); // default language
  const [isOnline, setIsOnline] = useState(networkStatus.get().isOnline);
  const [navigationReady, setNavigationReady] = useState(false);
  const [showMobileNavigation, setShowMobileNavigation] = useState(false);
  const toggleLanguage = () => setLanguage(prev => prev === 'English' ? 'Kinyarwanda' : 'English');

  useEffect(() => {
    let previousOnline = false;
    let unsubscribe;
    networkStatus.start().then(status => {
      previousOnline = status.isOnline;
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        syncManager.run('app-start');
        startupPrefetch.run('app-start');
      }
      unsubscribe = networkStatus.subscribe(nextStatus => {
        setIsOnline(nextStatus.isOnline);
        if (nextStatus.isOnline && !previousOnline) {
          syncManager.run('connection-restored');
          startupPrefetch.run('connection-restored');
        }
        previousOnline = nextStatus.isOnline;
      });
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!isOnline && navigationReady && navigationRef.isReady()) {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [isOnline, navigationReady, navigationRef]);

  // ---------- GLOBAL ONLINE STATUS (unchanged) ----------
  const setGlobalOnlineStatus = useCallback(async (online) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await axios.post(
        `${BASE_URL}/api/user/online`,
        { isOnline: online },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const checkAndSetOnline = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        setGlobalOnlineStatus(true);
      }
    };
    checkAndSetOnline();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setGlobalOnlineStatus(true);
        syncManager.run('foreground');
        startupPrefetch.run('foreground');
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        setGlobalOnlineStatus(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // ---------- END ONLINE STATUS ----------

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} hidden={false} translucent={false} />
      <TabModeProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={() => setNavigationReady(true)}
          onStateChange={state => {
            const activeRoute = state?.routes?.[state.index];
            setShowMobileNavigation(
              activeRoute?.name !== 'Main' && activeRoute?.name !== 'AddPost'
            );
          }}
        >
          <OfflineBanner />
          
          <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main">
              {props => <MainTabs {...props} language={language} toggleLanguage={toggleLanguage} theme={theme} isLoading={isLoading} />}
            </Stack.Screen>
            <Stack.Screen name="Preview">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <PreviewScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="BuyPost">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <BuyPostScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                  <BottomBar {...props} theme={theme} stackRouteName="BuyPost" />
                </>
              )}
            </Stack.Screen>

            {/* ---------- NEW: How It Works Screen ---------- */}
            <Stack.Screen name="HowItWorks">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <HowItWorksScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            {/* ---------- Business Ideas Screen ---------- */}
            <Stack.Screen name="BusinessIdeas">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <BusinessIdeasScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="CropImage">
              {props => (
                <>
                  <TopBar
                    theme={theme}
                    language={language}
                    toggleLanguage={toggleLanguage}
                    showBackButton={true}
                  />
                  <CropImageScreen
                    {...props}
                    language={language}
                    toggleLanguage={toggleLanguage}
                  />
                </>
              )}
            </Stack.Screen>

            {/* ---------- Screens that use a custom header ---------- */}
            <Stack.Screen name="AddUpdate">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AddUpdateScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AddPost">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AddPostScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                  <BottomBar {...props} theme={theme} stackRouteName="AddPost" />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminReports" options={{ headerShown: false }}>
              {props => <AdminReportsScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

            <Stack.Screen
              name="ViewPlace"
              options={{
                presentation: "transparentModal",
                headerShown: false,
              }}
            >
              {props => (
                <>
                  <TopBar
                    theme={theme}
                    language={language}
                    toggleLanguage={toggleLanguage}
                    showBackButton={true}
                  />
                  <ViewPlaceScreen
                    {...props}
                    language={language}
                    toggleLanguage={toggleLanguage}
                  />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminShops" options={{ headerShown: false }}>
              {props => <AdminShopsScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

            <Stack.Screen name="AdminBusinessAdd" options={{ headerShown: false }}>
              {props => <AdminBusinessAddScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>
            <Stack.Screen name="BusinessIdeasAdmin" options={{ headerShown: false }}>
              {props => <BusinessIdeasAdminScreen {...props} language={language} />}
            </Stack.Screen>

            <Stack.Screen name="Notifications">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <NotificationsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="NotificationPreferences">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <NotificationPreferencesScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="ChangePassword">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ChangePasswordScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="Success">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <SuccessScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="Fail">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <FailScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminUser" options={{ headerShown: false }}>
              {props => <AdminUserScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

            <Stack.Screen name="AdminPosts" options={{ headerShown: false }}>
              {props => <AdminPostsScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

            <Stack.Screen name="AddShoppingMallShop">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AddShoppingMallShopScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="ViewShop"
              options={{
                presentation: "transparentModal",
                headerShown: false,
              }}>
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ViewShopScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminLogin" options={{ headerShown: false }}>
              {props => <AdminLoginScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

            <Stack.Screen name="AdminDashboard" options={{ headerShown: false }}>
              {props => <AdminDashboardScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>
            <Stack.Screen name="AdminLiveChat" options={{ headerShown: false }}>
              {props => <MessageScreen {...props} language={language} adminMode />}
            </Stack.Screen>

            {/* ---------- Login / Register / ForgotPassword / Profile / PostDetail ---------- */}
            <Stack.Screen name="Login">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <LoginScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <RegisterScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="ForgotPassword">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ForgotPasswordScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Profile">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ProfileScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="PostDetail">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <PostDetailScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Feed">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <FeedScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Map">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <MapScreen {...props} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="MyPosts">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <MyPostsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Videos">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <VideosScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="SavedPosts">
              {props => (
                <>
                  <TopBar theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <SavedPostsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            {/* ---------- Chat screens (no custom header, but still pass language props) ---------- */}
            <Stack.Screen name="Chat">
              {props => <ChatScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>
            <Stack.Screen name="InstagramChat">
              {props => <InstagramChatScreen {...props} language={language} toggleLanguage={toggleLanguage} />}
            </Stack.Screen>

          </Stack.Navigator>
          <MobileNavigation visible={showMobileNavigation} />
        </NavigationContainer>
      </TabModeProvider>
    </>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <BottomSheetProvider>
              <AppContent />
            </BottomSheetProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  offlineInteractionBlocker: {
    backgroundColor: 'transparent',
    zIndex: 10000,
    elevation: 10000,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 5,
    borderBottomWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  backButton: {
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarButton: {
    marginRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Irish Grover',
    flexShrink: 1,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -20,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#47ae87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // ---------- Flat bottom navigation ----------
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    // Android shadow
    elevation: 8,
    zIndex: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // comfortable touch target
  },

  // ---------- Error fallback ----------
  errorFallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorFallbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorFallbackText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorFallbackButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  errorFallbackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});