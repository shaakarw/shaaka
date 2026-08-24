import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants';
import { useTheme } from '../context/ThemeContext';

const labels = {
  English: { title: 'Notification Preferences', newPosts: 'New Posts', newShops: 'New Shops', newPlaces: 'New Places', newShoppingMalls: 'New Shopping Malls', newMallShops: 'Shops Added to Shopping Malls', mapPlacesAdded: 'Places Added to Map' },
  Kinyarwanda: { title: 'Uko imenyesha rikora', newPosts: 'Ibicuruzwa bishya', newShops: 'Amaduka mashya', newPlaces: 'Ahantu hashya', newShoppingMalls: 'Amasoko manini mashya', newMallShops: 'Amaduka yashyizwe mu masoko', mapPlacesAdded: 'Ahantu hashyizwe ku ikarita' },
};
const keys = ['newPosts', 'newShops', 'newPlaces', 'newShoppingMalls', 'newMallShops', 'mapPlacesAdded'];

export default function NotificationPreferencesScreen({ language = 'English' }) {
  const { theme } = useTheme();
  const t = labels[language] || labels.English;
  const [preferences, setPreferences] = useState(Object.fromEntries(keys.map(key => [key, true])));
  const [loading, setLoading] = useState(true);

  const headers = useCallback(async () => ({ Authorization: `Bearer ${await AsyncStorage.getItem('userToken')}` }), []);
  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/notifications/preferences`, { headers: await headers() });
        setPreferences(current => ({ ...current, ...(response.data.preferences || {}) }));
      } finally { setLoading(false); }
    })();
  }, [headers]);

  const toggle = async key => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    try { await axios.patch(`${BASE_URL}/api/notifications/preferences`, { [key]: next[key] }, { headers: await headers() }); } catch (error) { setPreferences(preferences); }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
  return <View style={[styles.container, { backgroundColor: theme.background }]}><Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>{keys.map(key => <View key={key} style={[styles.row, { borderBottomColor: theme.border }]}><Text style={[styles.label, { color: theme.text }]}>{t[key]}</Text><Switch value={preferences[key]} onValueChange={() => toggle(key)} trackColor={{ false: theme.border, true: theme.accent }} thumbColor="#fff" /></View>)}</View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 16 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, title: { fontSize: 25, fontWeight: '700', marginBottom: 18 }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, label: { fontSize: 16, flex: 1, paddingRight: 12 } });
