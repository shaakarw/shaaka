import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTabMode } from '../context/TabModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Assets
const map1flag = require('../assets/map1.png');
const logo = require('../assets/logos.png');
const user1 = require('../assets/user1.png');
const user2 = require('../assets/user2.png');
const countryFlag = require('../assets/flga1.webp');

const { width, height } = Dimensions.get('window');

const translations = {
  English: {
    welcome: 'Welcome to Shaaka',
    tagline: 'Find Shops,Buy,Sell anywhere you are',
    locate: 'Shaaka',
    description: 'Helps you to discover shops near you , sell and buy across the country, quickly, easily.',
    locateShop: 'Map',
    buySell: 'Buy',
    businessIdeas: 'Business',
    login: 'Login',
    register: 'Register',
    users: ' 10,000⁺   Users ',
    howItWorks: 'How Shaaka works',
    searchPlaceholder: 'Search shops, products, or places',
    searchMap: 'Map',
    searchPosts: 'Posts',
    searchProductsHint: 'Find products and listings',
    searchMapHint: 'Find shops and places on the map',
  },
  Kinyarwanda: {
    welcome: 'Murakaza neza kuri Shaaka',
    tagline: 'Shaaka Amaduka,Ugure,Unagurishe aho ari hose',
    locate: 'Shaaka',
    description: 'Igufasha kubona amaduka akwegere aho uri hose, kugura no  kugurisha byihuse, byoroshye.',
    locateShop: 'Ikarita',
    buySell: 'Gurisha',
    businessIdeas: 'Imishinga',
    login: 'Injira',
    register: 'Iyandikishe',
    users: ' 10,000⁺  Byabayikoresha ',
    howItWorks: 'Uko Shaaka ikora',
    searchPlaceholder: 'Shakisha amaduka, ibicuruzwa, cyangwa ahantu',
    searchMap: 'Ikarita',
    searchPosts: 'Ibicuruzwa',
    searchProductsHint: 'Shakisha ibicuruzwa n’amatangazo',
    searchMapHint: 'Shakisha amaduka n’ahantu ku ikarita',
  },
};

const WelcomeHomeScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const { setTabMode } = useTabMode();
  const [activeCard, setActiveCard] = useState('buySell');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Animated search
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchWidthAnim = useRef(new Animated.Value(0)).current;
  const EXPANDED_SEARCH_WIDTH = width * 0.8;

  const toggleSearch = () => {
    const toValue = searchExpanded ? 0 : 1;
    Animated.timing(searchWidthAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start(() => setSearchExpanded(!searchExpanded));
  };

  const searchContainerWidth = searchWidthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [46, EXPANDED_SEARCH_WIDTH],
  });

  const t = translations[language];

  // ---------- grayscale palette (light & dark) ----------
  const colors = {
    background: isDarkMode ? '#111' : '#ffffff',
    cardBackground: isDarkMode ? '#1e1e1e' : '#f8f8f8',
    border: isDarkMode ? '#333' : '#e0e0e0',
    textPrimary: isDarkMode ? '#f5f5f5' : '#1a1a1a',
    textSecondary: isDarkMode ? '#b0b0b0' : '#555555',
    textTertiary: isDarkMode ? '#888' : '#999',
    accent: isDarkMode ? '#dddddd' : '#333333',
    activeCardBg: isDarkMode ? '#444' : '#222',
    activeText: isDarkMode ? '#fff' : '#fff',
    inactiveCardBg: isDarkMode ? '#2a2a2a' : '#f0f0f0',
    curveBg: isDarkMode ? '#222' : '#eaeaea',
    shadowColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
    authButtonBg: isDarkMode ? '#3a3a3a' : '#e8e8e8',
    howItWorksBg: isDarkMode ? '#2a2a2a' : '#ffffff',
  };

  useEffect(() => {
    checkLoginStatus();
    const unsubscribe = navigation.addListener('focus', checkLoginStatus);
    return unsubscribe;
  }, [navigation]);

  const checkLoginStatus = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(loggedIn === 'true');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCardPress = (cardType, action) => {
    setActiveCard(cardType);
    action();
  };

  const navigateToSearch = (target) => {
    const query = searchQuery.trim();
    if (target === 'map') {
      setTabMode('locateMode');
      navigation.navigate('Locate', { searchQuery: query });
    } else {
      setTabMode('shopMode');
      navigation.navigate('Search', { searchQuery: query });
    }
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Background decorative curve */}
      <View style={[styles.curve, { backgroundColor: colors.curveBg }]} />

      <View style={styles.mainContainer}>
        {/* Scrollable area: welcome, tagline, search, and map image (now top-aligned) */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topContent}>
            <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>{t.welcome}</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t.tagline}</Text>

            {/* Animated Search Section - right-aligned */}
            <Animated.View style={[styles.searchWrapper, { width: searchContainerWidth }]}>
              {!searchExpanded ? (
                <TouchableOpacity
                  onPress={toggleSearch}
                  style={[
                    styles.searchIconButton,
                    { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }
                  ]}
                >
                  <Ionicons name="search" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.expandedSearchContainer,
                    { backgroundColor: isDarkMode ? '#222' : '#eaeaea', borderColor: colors.border }
                  ]}
                >
                  <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    placeholder={t.searchPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => navigateToSearch('posts')}
                    autoFocus={true}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={toggleSearch} style={styles.closeSearchBtn}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* Dropdown – only when expanded and query exists */}
            {searchExpanded && searchQuery.trim().length > 0 && (
              <View style={[styles.searchDropdown, { borderTopColor: colors.border }]}>
                <Text style={[styles.searchDropdownLabel, { color: colors.textTertiary }]}>Search in</Text>
                <TouchableOpacity style={styles.searchDropdownItem} onPress={() => navigateToSearch('posts')}>
                  <View style={[styles.searchDropdownIcon, { backgroundColor: colors.activeCardBg }]}>
                    <Ionicons name="cart-outline" size={18} color={colors.activeText} />
                  </View>
                  <View style={styles.searchDropdownCopy}>
                    <Text style={[styles.searchDropdownTitle, { color: colors.textPrimary }]}>{t.searchPosts}</Text>
                    <Text style={[styles.searchDropdownHint, { color: colors.textSecondary }]}>
                      {t.searchProductsHint}: “{searchQuery.trim()}”
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.searchDropdownItem} onPress={() => navigateToSearch('map')}>
                  <View style={[styles.searchDropdownIcon, { backgroundColor: colors.inactiveCardBg }]}>
                    <Ionicons name="location-outline" size={18} color={colors.textPrimary} />
                  </View>
                  <View style={styles.searchDropdownCopy}>
                    <Text style={[styles.searchDropdownTitle, { color: colors.textPrimary }]}>{t.searchMap}</Text>
                    <Text style={[styles.searchDropdownHint, { color: colors.textSecondary }]}>
                      {t.searchMapHint}: “{searchQuery.trim()}”
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Map image – hidden when search is expanded */}
            {!searchExpanded && (
              <View style={styles.imageCenteredContainer}>
                <Image source={map1flag} style={styles.mapImage} resizeMode="contain" />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed bottom content: logo, Shaaka, description, avatars (always visible) */}
        <View style={styles.bottomContentContainer}>
          <View style={styles.locationRow}>
            <Image source={logo} style={[styles.locationIcon, { tintColor: colors.textPrimary }]} />
            <Text style={[styles.locationText, { color: colors.textPrimary }]}>{t.locate}</Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>{t.description}</Text>

          <View style={styles.avatarRow}>
            <Image source={user2} style={[styles.avatar, { backgroundColor: '#ccc' }]} />
            <Image source={user1} style={[styles.avatar, styles.avatarOverlap, { backgroundColor: '#ccc' }]} />
            <Image source={countryFlag} style={[styles.avatar, styles.avatarOverlap2]} />
            <Text style={[styles.communityText, { color: colors.textPrimary }]}>{t.users}</Text>
          </View>
        </View>

        {/* Fixed bottom area: selection cards + auth buttons */}
        <View style={styles.footer}>
          <View style={styles.selectionContainer}>
            {/* Locate card */}
            <TouchableOpacity
              style={[
                styles.selectionCard,
                {
                  backgroundColor:
                    activeCard === 'locate' ? colors.activeCardBg : colors.inactiveCardBg,
                  borderColor:
                    activeCard === 'locate' ? colors.activeCardBg : colors.border,
                },
              ]}
              onPress={() =>
                handleCardPress('locate', () => {
                  setTabMode('locateMode');
                  navigation.navigate('Locate');
                })
              }
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={activeCard === 'locate' ? colors.activeText : colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectionTitle,
                  { color: activeCard === 'locate' ? colors.activeText : colors.textPrimary },
                ]}
              >
                {t.locateShop}
              </Text>
            </TouchableOpacity>

            {/* Buy/Sell card */}
            <TouchableOpacity
              style={[
                styles.selectionCard,
                {
                  backgroundColor:
                    activeCard === 'buySell' ? colors.activeCardBg : colors.inactiveCardBg,
                  borderColor:
                    activeCard === 'buySell' ? colors.activeCardBg : colors.border,
                },
              ]}
              onPress={() =>
                handleCardPress('buySell', () => {
                  setTabMode('shopMode');
                  navigation.navigate('Search');
                })
              }
            >
              <Ionicons
                name="cart-outline"
                size={18}
                color={activeCard === 'buySell' ? colors.activeText : colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectionTitle,
                  { color: activeCard === 'buySell' ? colors.activeText : colors.textPrimary },
                ]}
              >
                {t.buySell}
              </Text>
            </TouchableOpacity>

            {/* Business ideas card */}
            <TouchableOpacity
              style={[
                styles.selectionCard,
                {
                  backgroundColor:
                    activeCard === 'business' ? colors.activeCardBg : colors.inactiveCardBg,
                  borderColor:
                    activeCard === 'business' ? colors.activeCardBg : colors.border,
                },
              ]}
              onPress={() =>
                handleCardPress('business', () => {
                  navigation.navigate('BusinessIdeas');
                })
              }
            >
              <Ionicons
                name="bulb-outline"
                size={18}
                color={activeCard === 'business' ? colors.activeText : colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectionTitle,
                  { color: activeCard === 'business' ? colors.activeText : colors.textPrimary },
                ]}
              >
                {t.businessIdeas}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login / Register buttons (only when unauthenticated) */}
          {!isLoggedIn && (
            <View style={styles.authButtonsContainer}>
              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: colors.authButtonBg }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>
                  {t.login}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: colors.authButtonBg }]}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={[styles.authButtonText, { color: colors.textPrimary }]}>
                  {t.register}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  curve: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: width * 0.9,
    top: 0,
    left: 0,
    zIndex: -1,
  },
  mainContainer: {
    flex: 1,
    paddingTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  // Changed from scrollContentCenter to scrollContent with top alignment
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',  // Align content to top
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 20,                // Extra top padding for breathing room
  },
  topContent: {
    alignItems: 'center',
    width: '100%',
  },

  // Bottom fixed content (logo, Shaaka, description, avatars)
  bottomContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingLeft: 8,
  },
  locationIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  locationText: {
    fontSize: Math.min(width * 0.05, 20),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  description: {
    fontSize: Math.min(width * 0.035, 14),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: Math.min(width * 0.06, 24),
    paddingHorizontal: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  avatar: {
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarOverlap: {
    marginLeft: -width * 0.03,
  },
  avatarOverlap2: {
    marginLeft: -width * 0.03,
  },
  communityText: {
    marginLeft: width * 0.03,
    fontSize: Math.min(width * 0.035, 14),
    fontFamily: 'Inter',
  },

  // Search styles
  searchWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    overflow: 'hidden',
    marginBottom: 8,
    alignSelf: 'flex-end',   // right-aligned
  },
  searchIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00000001',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  expandedSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 5,
  },
  closeSearchBtn: { marginLeft: 8, padding: 4 },
  searchDropdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
    width: '100%',
  },
  searchDropdownLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  searchDropdownIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  searchDropdownCopy: {
    flex: 1,
  },
  searchDropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchDropdownHint: {
    fontSize: 11,
    marginTop: 2,
  },

  // Welcome & tagline
  welcomeText: {
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: 'bold',
    fontFamily: 'Irish Grover',
    textAlign: 'center',
    marginBottom: height * 0.008,
  },
  tagline: {
    fontSize: Math.min(width * 0.04, 16),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  // Map image
  imageCenteredContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  mapImage: {
    width: width * 0.95,
    height: width * 0.5,
    alignSelf: 'center',
  },

  // Footer (selection cards + auth)
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  selectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectionCard: {
    flexDirection: 'row',
    width: '32%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  authButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 10,
    marginBottom: 0,
  },
  authButton: {
    flex: 1,
    paddingVertical: 12,
    top:-8,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WelcomeHomeScreen;