// App.js
import React, { useState, useCallback, Component, useEffect } from 'react';
import { NavigationContainer, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { BottomSheetProvider } from './context/BottomSheetContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogBox, View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { TabModeProvider, useTabMode } from './context/TabModeContext';
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
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ChatScreen from './screens/ChatScreen';
import InstagramChatScreen from './screens/InstagramChatScreen';
import WelcomeHomeScreen from './screens/HomeScreen';
import LocateScreen from './screens/LocateScreen';
import AddShopScreen from './screens/AddPlaceScreen';
import ProfileScreen from './screens/ProfileScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import AdminUserScreen from './screens/AdminUserScreen';
import AdminPostsScreen from './screens/AdminPostsScreen';
import AdminReportsScreen from './screens/AdminReportsScreen';
import AdminShopsScreen from './screens/AdminShopsScreen';
import AddPostScreen from './screens/AddPostScreen';
import ViewPlaceScreen from './screens/ViewPlaceScreen';
import ViewShopScreen from './screens/ViewShopScreen';
import AddShoppingMallShopScreen from './screens/AddShoppingMallShopScreen';
import BusinessIdeasScreen from './screens/BusinessIdeasScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import NotificationPreferencesScreen from './screens/NotificationPreferencesScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import { Logo } from './assets';

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

// Tab labels (used in CustomTabBar)
const tabLabels = {
  English: { Home: 'Home', Search: 'Search', BuyPost: 'Buy', Locate: 'Locate', AddShop: 'Add Shop', Message: 'Message', Settings: 'Settings' },
  Kinyarwanda: { Home: 'Ahabanza', Search: 'Shakisha', BuyPost: 'Gura', Locate: 'Shaaka', AddShop: 'Ongerako', Message: 'Ubutumwa', Settings: 'Igenamiterere' },
};

// ==================== CUSTOM HEADER ====================
const CustomHeader = ({ theme, language, toggleLanguage, showBackButton = false }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUri, setAvatarUri] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const checkLoginStatus = async () => {
        try {
          const loggedIn = await AsyncStorage.getItem('isLoggedIn');
          const isLogged = loggedIn === 'true';
          setIsLoggedIn(isLogged);
          if (isLogged) {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
              const user = JSON.parse(userData);
              setAvatarUri(user.avatar || null);
            } else {
              setAvatarUri(null);
            }
          } else {
            setAvatarUri(null);
          }
          if (isLogged) {
            const token = await AsyncStorage.getItem('userToken');
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
    <View style={[styles.headerContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
        {showBackButton && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ flexDirection: 'row' }}>
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

// ==================== CUSTOM TAB BAR ====================
const CustomTabBar = ({ state, descriptors, navigation, language, theme }) => {
  const { tabMode } = useTabMode();
  const currentLabels = tabLabels[language];

  // List of all valid tab screen names
  const allTabNames = ['WelcomeHome', 'Search', 'BuyPost', 'Locate', 'AddShop', 'Message', 'Settings'];
  
  // Get the currently focused route
  const currentRoute = state.routes[state.index];
  
  // Hide the tab bar if we're not on a tab screen
  if (!allTabNames.includes(currentRoute?.name)) {
    return null;
  }

  const alwaysVisible = ['WelcomeHome', 'Message', 'Settings'];
  let conditionalTabs = [];
  if (tabMode === 'shopMode') {
    conditionalTabs = ['Search', 'BuyPost'];
  } else {
    conditionalTabs = ['Locate', 'AddShop'];
  }
  const visibleTabNames = [...alwaysVisible, ...conditionalTabs];
  const visibleRoutes = state.routes.filter(route => visibleTabNames.includes(route.name));

  const getIconAndLabel = (routeName, isFocused) => {
    let iconName, label;
    switch (routeName) {
      case 'WelcomeHome':
        iconName = isFocused ? 'home' : 'home-outline';
        label = currentLabels.Home;
        break;
      case 'Search':
        iconName = isFocused ? 'search' : 'search-outline';
        label = currentLabels.Search;
        break;
      case 'BuyPost':
        iconName = isFocused ? 'cart' : 'cart-outline';
        label = currentLabels.BuyPost;
        break;
      case 'Locate':
        iconName = isFocused ? 'map' : 'map-outline';
        label = currentLabels.Locate;
        break;
      case 'AddShop':
        iconName = isFocused ? 'add-circle' : 'add-circle-outline';
        label = currentLabels.AddShop;
        break;
      case 'Message':
        iconName = isFocused ? 'chatbubble' : 'chatbubble-outline';
        label = currentLabels.Message;
        break;
      case 'Settings':
        iconName = isFocused ? 'settings' : 'settings-outline';
        label = currentLabels.Settings;
        break;
      default:
        iconName = 'ellipse-outline';
        label = routeName;
    }
    return { iconName, label };
  };

  return (
    <View style={[styles.tabBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      {visibleRoutes.map((route, index) => {
        const originalIndex = state.routes.findIndex(r => r.key === route.key);
        const isFocused = state.index === originalIndex;
        const { iconName, label } = getIconAndLabel(route.name, isFocused);
        const onPress = () => {
          try {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          } catch (error) {
            console.error('Tab press error:', error);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={isFocused ? theme.more : theme.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? theme.more : theme.textSecondary }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ==================== MAIN TABS ====================
const MainTabs = ({ language, toggleLanguage, theme }) => {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} language={language} theme={theme} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="WelcomeHome">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <WelcomeHomeScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Search">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <SearchScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="BuyPost">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <BuyPostScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Locate">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <LocateScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="AddShop">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <AddShopScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Message">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
            <MessageScreen {...props} language={language} toggleLanguage={toggleLanguage} />
          </>
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {props => (
          <>
            <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={false} />
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
  const [language, setLanguage] = useState('Kinyarwanda'); // default language
  const toggleLanguage = () => setLanguage(prev => prev === 'English' ? 'Kinyarwanda' : 'English');

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
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        setGlobalOnlineStatus(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // ---------- END ONLINE STATUS ----------

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} hidden={false} translucent={false} />
      <TabModeProvider>
        <NavigationContainer>
          
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main">
              {props => <MainTabs {...props} language={language} toggleLanguage={toggleLanguage} theme={theme} />}
            </Stack.Screen>

            {/* ---------- NEW: How It Works Screen ---------- */}
            <Stack.Screen name="HowItWorks">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <HowItWorksScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            {/* ---------- Business Ideas Screen ---------- */}
            <Stack.Screen name="BusinessIdeas">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <BusinessIdeasScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
<Stack.Screen name="CropImage">
  {props => (
    <>
      <CustomHeader 
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
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AddUpdateScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AddPost">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AddPostScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminReports">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminReportsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
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
                  <CustomHeader
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

            <Stack.Screen name="AdminShops">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminShopsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

           

            <Stack.Screen name="Notifications">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <NotificationsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="NotificationPreferences">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <NotificationPreferencesScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="ChangePassword">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ChangePasswordScreen {...props} language={language} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="Success">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <SuccessScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="Fail">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <FailScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminUser">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminUserScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminPosts">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminPostsScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AddShoppingMallShop">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
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
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ViewShopScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminLogin">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminLoginScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminDashboard">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <AdminDashboardScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>

            {/* ---------- Login / Register / ForgotPassword / Profile / PostDetail ---------- */}
            <Stack.Screen name="Login">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <LoginScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <RegisterScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="ForgotPassword">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ForgotPasswordScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Profile">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <ProfileScreen {...props} language={language} toggleLanguage={toggleLanguage} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="PostDetail">
              {props => (
                <>
                  <CustomHeader theme={theme} language={language} toggleLanguage={toggleLanguage} showBackButton={true} />
                  <PostDetailScreen {...props} language={language} toggleLanguage={toggleLanguage} />
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
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#47ae87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingBottom: 0,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 8,
    marginTop: 0,
    marginBottom: 40,
  },
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