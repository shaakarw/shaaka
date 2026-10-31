

// screens/AdminLoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../assets/logos.png';
import MessageBackground from '../assets/message.png';   // ✅ same as MessageScreen
import { showAdminFeedback } from '../utils/adminFeedback';
import { normalizeImageSource } from '../utils/imageUrl';


const translations = {
  English: {
    adminLogin: 'Admin Access',
    subtitle: 'Secure administration panel',
    phone: 'Phone Number',
    password: 'Password',
    login: 'Log In',
    cancel: 'Cancel',
    invalidCredentials: 'Invalid phone or password.',
    serverError: 'Server error. Please try again.',
    loginFailed: 'Login failed. Please try again.',
  },
  Kinyarwanda: {
    adminLogin: 'Kwinjira nk’umuyobozi',
    subtitle: 'Ikibaho cy’ubuyobozi gisigaye',
    phone: 'Numero ya telefoni',
    password: 'Ijambo ry’ibanga',
    login: 'Kwinjira',
    cancel: 'Reka',
    invalidCredentials: 'Numero cyangwa ijambo ry’ibanga si byo.',
    serverError: 'Hari ikibazo kuri server. Ongera ugerageze.',
    loginFailed: 'Kwinjira byanze. Ongera ugerageze.',
  },
};

const AdminLoginScreen = ({ navigation, language }) => {
  const { theme, isDarkMode } = useTheme();
  const t = translations[language] || translations.English;
  const [checkingSession, setCheckingSession] = useState(true);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isActive = true;
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('adminToken');
        if (!token) return;

        const response = await axios.get(`${BASE_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isActive && response.data?.success) {
          navigation.replace('AdminDashboard', { language });
        }
      } catch (error) {
        if ([401, 403].includes(error.response?.status)) {
          await AsyncStorage.removeItem('adminToken');
        }
      } finally {
        if (isActive) setCheckingSession(false);
      }
    };
    checkToken();
    return () => { isActive = false; };
  }, [language, navigation]);

  const handleLogin = async () => {
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();

    if (!trimmedPhone || !trimmedPassword) {
      showAdminFeedback(t.adminLogin, 'Phone and password are required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/admin/login`, {
        phone: trimmedPhone,
        password: trimmedPassword,
      });

      const { success, token, message } = response.data;

      if (success && token) {
        await AsyncStorage.setItem('adminToken', token);
        navigation.replace('AdminDashboard', { language });
      } else {
        showAdminFeedback(t.adminLogin, message || t.invalidCredentials, 'error');
      }
    } catch (error) {
      console.error('Admin login error:', error.response?.data || error.message);
      const msg = error.response?.data?.message || t.serverError;
      showAdminFeedback(t.adminLogin, msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={normalizeImageSource(MessageBackground)}
      style={[styles.container, { backgroundColor: theme.image }]}
      resizeMode="cover"
    >
      {/* Overlay – same as MessageScreen */}
      <View style={[styles.overlay, { backgroundColor: theme.background, opacity: 0.88 }]} />

      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Logo */}
            <Image source={normalizeImageSource(Logo)} style={styles.logo} resizeMode="contain" />

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>{t.adminLogin}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {t.subtitle}
              </Text>
            </View>

            {/* Form */}
              <View style={[styles.form, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>{t.phone}</Text>
                <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="07XXXXXXXX"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>{t.password}</Text>
                <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: theme.accent }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>{t.login}</Text>
                )}
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 0,
    borderRadius: 16,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  loginButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminLoginScreen;