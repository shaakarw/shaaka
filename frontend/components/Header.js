// components/Header.js
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Header = ({ language, toggleLanguage, showBackButton = false }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const sessionUser = await AsyncStorage.getItem('sessionUser');
        if (sessionUser) {
          setUser(JSON.parse(sessionUser));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleProfilePress = () => {
    if (user) {
      navigation.navigate('Profile');
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
        {!loading && user ? (
          <TouchableOpacity onPress={handleProfilePress} style={styles.profileContainer}>
            <Image source={require('../assets/avator.png')} style={styles.profileImage} />
          </TouchableOpacity>
        ) : (
          <Image source={require('../assets/logo1.png')} style={styles.logo} resizeMode="contain" />
        )}
        <Text style={[styles.appName, { color: theme.text }]}>Shaaka</Text>
      </View>
      <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
        <Ionicons name="language" size={22} color={theme.text} />
        <Text style={{ marginLeft: 5, color: theme.text, fontWeight: '600' }}>
          {language === 'English' ? 'EN' : 'RW'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 12 },
  logo: { width: 36, height: 36, marginRight: 10 },
  profileContainer: { marginRight: 10 },
  profileImage: { width: 36, height: 36, borderRadius: 18 },
  appName: { fontSize: 20, fontWeight: 'bold', fontFamily: 'Irish Grover' },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default Header;