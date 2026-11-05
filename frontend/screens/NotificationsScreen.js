import { getAuthToken } from '../utils/authStorage';

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { BASE_URL } from '../constants';
import { normalizeImageSource } from '../utils/imageUrl';
import { getNotifications, isExpoGo } from '../services/notificationsRuntime';
import { offlineDatabase } from '../services/offlineDatabase';


const fallbackImage = require('../assets/profile1.png');
const notificationMemoryCache = new Map();

const copy = {
  English: { title: 'Notifications', markAll: 'Mark as Read', empty: '', error: 'Failed to load notifications', newPost: 'New post added', newShop: 'New shop added', newPlace: 'New place added', newMall: 'New shopping mall added', newMallShop: 'New shop added to shopping mall', mapPlace: 'New place added to the map', password: 'Your password was successfully changed.', name: 'Your account name was successfully changed.' },
  Kinyarwanda: { title: 'Imenyesha', markAll: 'Shyira byose mu byasomwe', empty: '', error: 'Kubona imenyesha byanze', newPost: 'Igicuruzwa gishya cyashyizweho', newShop: 'Iduka rishya ryashyizweho', newPlace: 'Ahantu hashya hashyizweho', newMall: 'Isoko rinini rishya ryashyizweho', newMallShop: 'Iduka rishya ryashyizwe mu isoko', mapPlace: 'Ahantu hashya hashyizwe ku ikarita', password: 'Ijambo banga ryawe ryahinduwe neza.', name: 'Izina rya konti yawe ryahinduwe neza.' },
};

const getTime = value => {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
};

export default function NotificationsScreen({ navigation, language = 'English' }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const t = copy[language] || copy.English;
  const cacheKey = user?._id || user?.id || user?.phone;
  const memoryCachedItems = cacheKey ? notificationMemoryCache.get(String(cacheKey)) : null;
  const [items, setItems] = useState(() => (Array.isArray(memoryCachedItems) ? memoryCachedItems : []));
  const [loading, setLoading] = useState(!Array.isArray(memoryCachedItems));
  const [error, setError] = useState(false);

  const persistItems = useCallback(async notifications => {
    if (!cacheKey) return;
    notificationMemoryCache.set(String(cacheKey), notifications);
    try {
      await offlineDatabase.putRecord('notifications', String(cacheKey), notifications, { priority: 'high' });
    } catch (cacheError) {
      console.warn('Could not cache notifications:', cacheError.message);
    }
  }, [cacheKey]);

  const load = useCallback(async () => {
    let cachedContentAvailable = false;
    const token = await getAuthToken('userToken');
    if (!token) {
      setItems([]);
      setError(false);
      setLoading(false);
      return;
    }
    try {
      if (cacheKey) {
        try {
          const cachedItems = await offlineDatabase.getRecord('notifications', String(cacheKey));
          if (Array.isArray(cachedItems)) {
            notificationMemoryCache.set(String(cacheKey), cachedItems);
            setItems(cachedItems);
            setError(false);
            setLoading(false);
            cachedContentAvailable = true;
          }
        } catch (cacheError) {
          console.warn('Could not read cached notifications:', cacheError.message);
        }
      }

      setError(false);
      const response = await axios.get(`${BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const notifications = response.data.notifications || [];
      setItems(notifications);
      persistItems(notifications);
    } catch (err) {
      if (!cachedContentAvailable) setError(true);
    } finally { setLoading(false); }
  }, [cacheKey, persistItems]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async item => {
    if (!item.isRead) {
      const token = await getAuthToken('userToken');
      const response = await axios.patch(`${BASE_URL}/api/notifications/${item._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (!isExpoGo && (Platform.OS === 'ios' || Platform.OS === 'android')) {
        const Notifications = getNotifications();
        if (Notifications) {
          Notifications.setBadgeCountAsync(response.data.unreadCount || 0).catch(error => {
            console.error('[Notifications] Could not update app badge:', error?.message || error);
          });
        }
      }
      const updatedItems = items.map(entry => entry._id === item._id ? { ...entry, isRead: true } : entry);
      setItems(updatedItems);
      persistItems(updatedItems);
    }
    try {
      const token = await getAuthToken('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      if (item.destination === 'Chat') {
        navigation.navigate('Chat', item.destinationParams || {});
      } else if (item.destination === 'PostDetail' && (item.destinationParams?.postId || item.postId)) {
        navigation.navigate('PostDetail', { postId: item.destinationParams?.postId || item.postId });
      } else if (item.destination === 'ViewShop' && (item.destinationParams?.shopId || item.mallShopId)) {
        navigation.navigate('ViewShop', { shopId: item.destinationParams?.shopId || item.mallShopId });
      } else if (item.postId) {
        navigation.navigate('PostDetail', { postId: item.postId });
      } else if (item.shopId || item.placeId || item.shoppingMallId) {
        const id = item.shopId || item.placeId || item.shoppingMallId;
        const response = await axios.get(`${BASE_URL}/api/places/${id}`, { headers });
        navigation.navigate('ViewPlace', { place: response.data.place });
      } else if (item.mallShopId) {
        const response = await axios.get(`${BASE_URL}/api/mall-shops/${item.mallShopId}`, { headers });
        navigation.navigate('ViewShop', { shopId: response.data.shop?._id || item.mallShopId });
      }
    } catch (error) {
      // Keep the notification readable even if the related item was deleted.
    }
  };

  const markAll = async () => {
    const token = await getAuthToken('userToken');
    await axios.patch(`${BASE_URL}/api/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${token}` } });
    if (!isExpoGo && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      const Notifications = getNotifications();
      if (Notifications) {
        Notifications.setBadgeCountAsync(0).catch(error => {
          console.error('[Notifications] Could not clear app badge:', error?.message || error);
        });
      }
    }
    const updatedItems = items.map(item => ({ ...item, isRead: true }));
    setItems(updatedItems);
    persistItems(updatedItems);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.item, { backgroundColor: item.isRead ? theme.background : theme.cardBackground, borderColor: theme.border }]} onPress={() => markRead(item)}>
      {item.image ? <Image source={normalizeImageSource({ uri: item.image })} style={styles.image} /> : <View style={[styles.icon, { backgroundColor: theme.accent }]}><Ionicons name={item.type.includes('PASSWORD') ? 'lock-closed-outline' : item.type.includes('NAME') ? 'person-outline' : 'notifications-outline'} size={22} color="#fff" /></View>}
      <View style={styles.copy}><Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.itemMessage, { color: theme.textSecondary }]}>{item.message}</Text><Text style={[styles.time, { color: theme.textSecondary }]}>{getTime(item.createdAt)}</Text></View>
      {!item.isRead && <View style={styles.unread} />}
    </TouchableOpacity>
  );

  if (loading) return <ShaakaLoadingScreen message={copy[language]?.loading || 'Loading notifications...'} backgroundColor={theme.background} textColor={theme.text} />;
  return <View style={[styles.container, { backgroundColor: theme.background }]}><View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>{items.some(item => !item.isRead) && <TouchableOpacity onPress={markAll}><Text style={[styles.markAll, { color: theme.accent }]}>{t.markAll}</Text></TouchableOpacity>}</View>{error ? <Text style={[styles.empty, { color: theme.textSecondary }]}>{t.error}</Text> : <FlatList data={items} keyExtractor={item => item._id} renderItem={renderItem} ListEmptyComponent={<Text style={[styles.empty, { color: theme.textSecondary }]}>{t.empty}</Text>} contentContainerStyle={items.length ? styles.list : styles.emptyList} />}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1, paddingHorizontal: 12 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }, title: { fontSize: 26, fontWeight: '700' }, markAll: { fontSize: 13, fontWeight: '700' }, list: { paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: 'center' }, empty: { textAlign: 'center', fontSize: 16 }, item: { flexDirection: 'row', alignItems: 'center', minHeight: 82, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth }, image: { width: 56, height: 56, borderRadius: 8 }, icon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' }, copy: { flex: 1, marginLeft: 12 }, itemTitle: { fontSize: 15, fontWeight: '700' }, itemMessage: { fontSize: 13, marginTop: 3 }, time: { fontSize: 11, marginTop: 5 }, unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d87428', marginLeft: 8 }, });
