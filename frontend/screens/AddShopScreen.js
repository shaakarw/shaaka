
// screens/AddShopScreen.js
// A "full mall-selection screen" for the AddShop tab.
// Fetches all shopping malls (places with category 'shoppingmall') and lets the
// user pick one, then navigates to AddShoppingMallShop to add a shop inside it.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAppAlert } from '../context/MessageSheetContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { useFocusEffect } from '@react-navigation/native';
import MobileNavigation from '../components/MobileNavigation';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { normalizeImageSource } from '../utils/imageUrl';


const MALL_CATEGORY = 'shoppingmall';

const translations = {
  English: {
    title: 'Add a Shop',
    subtitle: 'Select a shopping mall to add your shop.',
    loading: 'Loading malls...',
    empty: 'No shopping malls found.',
    emptyHint: 'Malls will appear here once they are added to the map.',
    searchPlaceholder: 'Search malls...',
    noResults: 'No malls match your search.',
    error: 'Error',
    errorMessage: 'Could not load malls. Please try again.',
    retry: 'Retry',
    loginRequired: 'Login Required',
    loginPrompt: 'You need to be logged in to add a shop.',
    login: 'Login',
    cancel: 'Cancel',
    goBack: 'Back',
    selectMall: 'Tap a mall to continue',
    mallAddress: 'Address',
    shopsCount: 'shops',
  },
  Kinyarwanda: {
    title: 'Ongera iduka',
    subtitle: 'Hitamo inyubako y\'amaduka kugira ngo wongereho iduka ryawe.',
    loading: 'Turimo gutwara inyubako...',
    empty: 'Nta nyubako y\'amaduka ibonetse.',
    emptyHint: 'Inyubako zizagaragara igihe zongerewe mu karte.',
    searchPlaceholder: 'Shakisha inyubako...',
    noResults: 'Nta nyubako ihuza n\'icyo ushaka.',
    error: 'Ikibazo',
    errorMessage: 'Ntibyashobotse gutwara inyubako. Ongera ugerageze.',
    retry: 'Ongera',
    loginRequired: 'Ugomba kwinjira',
    loginPrompt: 'Ugomba kuba winjiye kugira ngo wongere iduka.',
    login: 'Injira',
    cancel: 'Reka',
    goBack: 'Subira inyuma',
    selectMall: 'Kanda ku nyubako kugira ngo ukomeze',
    mallAddress: 'Aderesi',
    shopsCount: 'amaduka',
  },
};

export default function AddShopScreen({ navigation, route, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const { user: currentUser } = useAuth();
  const t = translations[language] || translations.English;

  const [malls, setMalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const backgroundColor = theme.background;
  const textColor = theme.text;
  const secondaryText = theme.textSecondary;
  const borderColor = theme.border;
  const cardBg = theme.cardBackground || theme.background;
  const accentColor = theme.accent;

  const getToken = async () => {
    let token = await AsyncStorage.getItem('userToken');
    if (!token) token = await AsyncStorage.getItem('adminToken');
    return token;
  };

  const fetchMalls = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${BASE_URL}/api/places`, { headers });
      const places = response.data?.places || [];
      const mallPlaces = places.filter(p =>
        p.category === MALL_CATEGORY || p.category === 'shopping_mall'
      );
      setMalls(mallPlaces);
    } catch (error) {
      console.error('Fetch malls error:', error);
      setMalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkAccess = async () => {
        const token = await getToken();
        if (!token || !isActive) return;

        fetchMalls();
      };

      const requestLogin = async () => {
        const token = await getToken();
        if (token || !isActive) return;

        showAppAlert(
          t.loginRequired,
          t.loginPrompt,
          [
            { text: t.cancel, style: 'cancel' },
            { text: t.login, onPress: () => navigation.navigate('Login') },
          ]
        );
      };

      requestLogin();
      checkAccess();

      return () => {
        isActive = false;
      };
    }, [fetchMalls, navigation, t])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMalls();
  };

  const requireAuth = async () => {
    const token = await getToken();
    if (!token) {
      showAppAlert(
        t.loginRequired,
        t.loginPrompt,
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.login, onPress: () => navigation.navigate('Login') },
        ]
      );
      return false;
    }
    return true;
  };

  const handleSelectMall = async (mall) => {
    const authed = await requireAuth();
    if (!authed) return;

    const token = await getToken();
    if (!token) return;

    // One-type-only check: if user already has a normal place/shop, block mall shop creation
    try {
      const placesRes = await axios.get(`${BASE_URL}/api/places`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allPlaces = placesRes.data.places || [];
      const userPlaces = allPlaces.filter(p => p.userId === (currentUser?._id || currentUser?.id));
      if (userPlaces.length > 0) {
        showAppAlert(
          'Limit Reached',
          'You already have a Shop/Place. You cannot add a Shopping Mall Shop.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (e) {
      console.warn('Could not verify shop ownership:', e);
    }

    navigation.navigate('AddShoppingMallShop', { mall });
  };

  const closeAddShopScreen = () => {
    navigation.navigate('Main', { screen: 'Locate' });
  };

  const getMallImage = (mall) => {
    return mall?.images?.street || mall?.images?.streetImage || null;
  };

  const getAddress = (mall) => {
    if (!mall) return '';
    if (typeof mall.address === 'string') return mall.address;
    if (mall.address && typeof mall.address === 'object') {
      if (mall.address.full) return mall.address.full;
      const parts = [];
      if (mall.address.district) parts.push(mall.address.district);
      if (mall.address.sector) parts.push(mall.address.sector);
      if (mall.address.cell) parts.push(mall.address.cell);
      if (parts.length > 0) return parts.join(', ');
    }
    return '';
  };

  const filteredMalls = searchQuery.trim()
    ? malls.filter(m => {
        const name = (m.name || '').toLowerCase();
        return name.includes(searchQuery.trim().toLowerCase());
      })
    : malls;

  const renderMallItem = ({ item }) => {
    const image = getMallImage(item);
    const address = getAddress(item);
    return (
      <TouchableOpacity
        style={[styles.mallCard, { backgroundColor: cardBg, borderColor: borderColor }]}
        activeOpacity={0.8}
        onPress={() => handleSelectMall(item)}
      >
        {image ? (
          <Image source={normalizeImageSource({ uri: image })} style={styles.mallImage} resizeMode="cover" />
        ) : (
          <View style={[styles.mallImagePlaceholder, { backgroundColor: borderColor }]}>
            <MaterialCommunityIcons name="shopping" size={40} color={secondaryText} />
          </View>
        )}
        <View style={styles.mallInfo}>
          <Text style={[styles.mallName, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          {address ? (
            <Text style={[styles.mallAddress, { color: secondaryText }]} numberOfLines={1}>
              <Ionicons name="location-outline" size={13} color={secondaryText} /> {address}
            </Text>
          ) : null}
          <View style={styles.mallActionRow}>
            <Text style={{ color: accentColor, fontSize: 13, fontWeight: '600' }}>
              {t.selectMall}
            </Text>
            <Ionicons name="arrow-forward-circle" size={20} color={accentColor} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={closeAddShopScreen} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t.goBack}>
          <Ionicons name="arrow-back" size={26} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerTexts}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t.title}</Text>
          <Text style={[styles.headerSubtitle, { color: secondaryText }]}>{t.subtitle}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: cardBg, borderColor: borderColor }]}>
        <Ionicons name="search" size={20} color={secondaryText} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={secondaryText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={20} color={secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <ShaakaLoadingScreen message={t.loading} backgroundColor={backgroundColor} textColor={secondaryText} />
      ) : filteredMalls.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="shopping-outline" size={60} color={secondaryText} />
          <Text style={[styles.centerText, { color: secondaryText }]}>
            {searchQuery ? t.noResults : t.empty}
          </Text>
          {!searchQuery && (
            <Text style={[styles.centerSubText, { color: secondaryText }]}>{t.emptyHint}</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredMalls}
          renderItem={renderMallItem}
          keyExtractor={(item) => item._id || item.id || item.uuid || String(item.name)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={accentColor}
            />
          }
        />
      )}
      <MobileNavigation visible />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  backButton: { marginRight: 12 },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  clearBtn: { padding: 4 },
  listContainer: { padding: 16, paddingBottom: 40 },
  mallCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  mallImage: { width: 80, height: 80 },
  mallImagePlaceholder: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  mallInfo: { flex: 1, padding: 12, justifyContent: 'center' },
  mallName: { fontSize: 16, fontWeight: '700' },
  mallAddress: { fontSize: 13, marginTop: 3 },
  mallActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { fontSize: 15, textAlign: 'center', marginTop: 12 },
  centerSubText: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  loginModalContent: { width: '82%', borderRadius: 16, padding: 22, borderWidth: 0.5 },
  loginModalTitle: { fontSize: 19, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  loginButtonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  loginButton: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  loginCancelButton: { borderWidth: 1, backgroundColor: 'transparent' },
  loginConfirmButton: { borderWidth: 0 },
  loginButtonText: { fontSize: 16, fontWeight: '600' },
});
