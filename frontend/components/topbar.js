import React, { useState, useCallback, useEffect } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../constants';
import { Logo } from '../assets';

const TopBar = ({ theme, language, toggleLanguage, showBackButton = false }) => {
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
          if (isLogged) currentUser = (await refreshUser()) || currentUser;
          if (!currentUser && isLogged) {
            const userData = await AsyncStorage.getItem('user');
            if (userData) currentUser = JSON.parse(userData);
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
      navigation.navigate(isLoggedIn ? 'Profile' : 'Login');
    } catch (error) {
      console.error('Avatar press error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.left}>
        {showBackButton && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.navigate('Main', { refreshKey: Date.now() })} style={{ flexDirection: 'row' }}>
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
      <View style={styles.right}>
        {isLoggedIn && (
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarButton}>
            <Image source={avatarUri ? { uri: avatarUri } : require('../assets/avator.png')} style={styles.avatar} resizeMode="cover" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
          <Ionicons name="language" size={22} color={theme.text} />
          <Text style={{ marginLeft: 5, color: theme.text, fontWeight: '600' }}>{language === 'English' ? 'EN' : 'RW'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 5, borderBottomWidth: 0 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarButton: { marginRight: 8 },
  right: { flexDirection: 'row', alignItems: 'center' },
  appName: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Irish Grover', flexShrink: 1 },
  langButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  notificationBadge: { position: 'absolute', top: -3, right: -20, minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 16, backgroundColor: '#47ae87', alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default TopBar;
