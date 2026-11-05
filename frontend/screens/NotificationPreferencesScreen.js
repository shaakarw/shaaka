import { getAuthToken } from '../utils/authStorage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants';
import { useTheme } from '../context/ThemeContext';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';

const preferenceKeys = [
  'messages',
  'socialActivities',
  'followers',
  'marketplace',
  'orders',
  'business',
  'accountSecurity',
  'promotional',
  'notificationSound',
  'vibration',
  'newPosts',
  'newShops',
  'newPlaces',
  'newShoppingMalls',
  'newMallShops',
  'mapPlacesAdded',
];

const labels = {
  English: {
    title: 'Notification Preferences',
    messages: 'Messages',
    socialActivities: 'Likes and comments',
    followers: 'Followers',
    marketplace: 'Marketplace activities',
    orders: 'Orders',
    business: 'Business notifications',
    accountSecurity: 'Account and security',
    promotional: 'Promotional notifications',
    notificationSound: 'Notification sounds',
    vibration: 'Vibration',
    newPosts: 'New posts',
    newShops: 'New shops',
    newPlaces: 'New places',
    newShoppingMalls: 'New shopping malls',
    newMallShops: 'Shops added to shopping malls',
    mapPlacesAdded: 'Places added to the map',
    error: 'Could not load notification preferences.',
    saveError: 'Could not save your notification preference.',
  },
  Kinyarwanda: {
    title: 'Uko imenyesha rikora',
    messages: 'Ubutumwa',
    socialActivities: 'Abakunze n\'ibitekerezo',
    followers: 'Abagukurikira',
    marketplace: 'Ibikorwa by\'ubucuruzi',
    orders: 'Komande',
    business: 'Amakuru y\'ubucuruzi',
    accountSecurity: 'Konti n\'umutekano',
    promotional: 'Kwamamaza',
    notificationSound: 'Amajwi y\'imenyesha',
    vibration: 'Kunyeganyega',
    newPosts: 'Ibicuruzwa bishya',
    newShops: 'Amaduka mashya',
    newPlaces: 'Ahantu hashya',
    newShoppingMalls: 'Amasoko manini mashya',
    newMallShops: 'Amaduka yashyizwe mu masoko',
    mapPlacesAdded: 'Ahantu hashyizwe ku ikarita',
    error: 'Ntibyashobotse kubona uko imenyesha rikora.',
    saveError: 'Ntibyashobotse kubika uko imenyesha rikora.',
  },
};

export default function NotificationPreferencesScreen({ language = 'English' }) {
  const { theme } = useTheme();
  const t = labels[language] || labels.English;
  const [preferences, setPreferences] = useState(Object.fromEntries(preferenceKeys.map(key => [key, true])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKeys, setSavingKeys] = useState([]);

  const getHeaders = useCallback(async () => {
    const token = await getAuthToken('userToken');
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPreferences = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/notifications/preferences`, {
          headers: await getHeaders(),
        });
        if (active) setPreferences(current => ({ ...current, ...(response.data.preferences || {}) }));
      } catch (loadError) {
        console.error('[Notifications] Could not load preferences:', loadError?.message || loadError);
        if (active) setError(t.error);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPreferences();
    return () => { active = false; };
  }, [getHeaders, t.error]);

  const toggle = async key => {
    const previousValue = preferences[key];
    const nextValue = !previousValue;
    setError('');
    setPreferences(current => ({ ...current, [key]: nextValue }));
    setSavingKeys(current => [...current, key]);
    try {
      await axios.patch(
        `${BASE_URL}/api/notifications/preferences`,
        { [key]: nextValue },
        { headers: await getHeaders() }
      );
    } catch (saveError) {
      console.error('[Notifications] Could not save preference:', saveError?.response?.data?.message || saveError?.message || saveError);
      setPreferences(current => ({ ...current, [key]: previousValue }));
      setError(t.saveError);
    } finally {
      setSavingKeys(current => current.filter(item => item !== key));
    }
  };

  if (loading) return <ShaakaLoadingScreen message={t.title} backgroundColor={theme.background} textColor={theme.text} />;
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>
      {error ? <Text style={[styles.error, { color: theme.danger || '#d9534f' }]}>{error}</Text> : null}
      {preferenceKeys.map(key => (
        <View key={key} style={[styles.row, { borderBottomColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.text }]}>{t[key]}</Text>
          {savingKeys.includes(key) ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Switch
              value={preferences[key] !== false}
              onValueChange={() => toggle(key)}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#fff"
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 25, fontWeight: '700', marginBottom: 18 },
  error: { marginBottom: 12, fontSize: 14 },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 16, flex: 1, paddingRight: 12 },
});
