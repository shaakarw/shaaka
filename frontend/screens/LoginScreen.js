// screens/LoginScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import SharedBottomNav from '../components/SharedBottomNav';
import AppAlert from '../utils/alert';
import { normalizeRwandaPhone, normalizeForAuth } from '../utils/phoneNormalizer';
import Logo from '../assets/logos.png';
import ScreenTutorialOverlay from '../components/ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';

// ---- Tutorial config ---------------------------------------------------------
const LOGIN_TUTORIAL_ID = 'login';
const LOGIN_TUTORIAL_DELAY_MS = 700;

// -----------------------------------------------------------------------------

const LoginScreen = ({ navigation, language = 'English' }) => {
  const { theme, isDarkMode } = useTheme();
  const { login } = useAuth();
  const isFocused = useIsFocused();
  const [phone, setPhone] = useState('07');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Refs for inputs so Enter/Done can move focus or submit
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // ---- Tutorial refs ----
  const phoneContainerRef = useRef(null);
  const passwordContainerRef = useRef(null);
  const eyeButtonRef = useRef(null);
  const loginButtonRef = useRef(null);
  const signUpLinkRef = useRef(null);
  const forgotLinkRef = useRef(null);

  // ---- Tutorial state ----
  const [showTutorial, finishTutorial] = useScreenTutorial(
    LOGIN_TUTORIAL_ID,
    isFocused && !loading,
    LOGIN_TUTORIAL_DELAY_MS
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const dance = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoScale, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(logoScale, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: -1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.timing(logoRotate, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );

    dance.start();
    return () => dance.stop();
  }, [logoRotate, logoScale]);

  const texts = {
    English: {
      welcome: 'Welcome Back',
      subtitle: 'Login to continue',
      phoneLabel: 'Phone Number',
      passwordLabel: 'Password',
      login: 'Login',
      noAccount: "Don't have an account?",
      signUp: 'Sign Up',
      forgot: 'Click here',
      phoneError: 'Please enter a valid phone number (07XXXXXXXX)',
      passwordError: 'Please enter your password',
      invalidCredentials: 'Invalid credentials',
      resetText: 'Forgot your password?',
      // Tutorial
      tPhoneTitle: 'Your phone number',
      tPhoneBody: 'Enter your phone number starting with 07. This is what you registered with.',
      tPasswordTitle: 'Your password',
      tPasswordBody: 'Enter the password you chose when creating your account.',
      tEyeTitle: 'Show or hide password',
      tEyeBody: 'Tap the eye icon to see what you typed, or hide it again.',
      tLoginTitle: 'Log in',
      tLoginBody: 'Tap here to log in to your Shaaka account.',
      tSignUpTitle: 'New here?',
      tSignUpBody: 'Tap Sign Up if you do not have an account yet.',
      tForgotTitle: 'Forgot password',
      tForgotBody: 'Tap here if you do not remember your password — we will help you reset it.',
    },
    Kinyarwanda: {
      welcome: 'Murakaza Neza',
      subtitle: 'Injira ukomeze',
      phoneLabel: 'Nimero ya Telefone',
      passwordLabel: 'Ijambo ryibanga',
      login: 'Injira',
      noAccount: 'Nta konti ufite?',
      signUp: 'Iyandikishe',
      forgot: 'Kanda hano',
      phoneError: 'Shyiramo nimero neza (07XXXXXXXX)',
      passwordError: 'Shyiramo ijambo banga',
      invalidCredentials: 'Amazina n\'ijambo ry\'ibanga si byo',
      resetText: 'Wibagiwe ijambo banga?',
      // Tutorial
      tPhoneTitle: 'Nimero ya telefone',
      tPhoneBody: 'Andika nimero ya telefone itangira na 07. Iyi ni yo wiyandikishije.',
      tPasswordTitle: 'Ijambo ryibanga',
      tPasswordBody: "Andika ijambo ry'ibanga wahisemo igihe wiyandikishaga.",
      tEyeTitle: "Erekana cyangwa uhisha ijambo ry'ibanga",
      tEyeBody: "Kanda ku kamenyetso k'ijisho urebe ibyo wanditse, cyangwa ubihishe.",
      tLoginTitle: 'Injira',
      tLoginBody: 'Kanda hano winjire muri konti yawe ya Shaaka.',
      tSignUpTitle: 'Uri mushya?',
      tSignUpBody: 'Kanda Iyandikishe niba utarafite konti.',
      tForgotTitle: 'Wibagiwe ijambo ryibanga',
      tForgotBody: "Kanda hano niba utibuka ijambo ry'ibanga — tuzagufasha kurihindura.",
    },
  };
  const t = texts[language] || texts.English;

  const handlePhoneChange = (text) => {
    const raw = String(text);
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      let digits = digitsOnly;
      if (digits.length > 0 && !digits.startsWith('07')) {
        digits = '07' + digits.slice(-8);
      }
      if (digits.length > 10) digits = digits.slice(0, 10);
      setPhone(digits);
    } else {
      setPhone(raw.trim());
    }
    setError('');
  };

  const handleLogin = async () => {
    if (!phone || phone.trim().length === 0) {
      setError(t.phoneError);
      return;
    }
    const digitsOnly = phone.replace(/\D/g, '');
    const looksLikePhone = digitsOnly.length > 0;
    if (looksLikePhone) {
      if (digitsOnly.length !== 10 || !digitsOnly.startsWith('07')) {
        setError(t.phoneError);
        return;
      }
    }

    if (!password) {
      setError(t.passwordError);
      return;
    }

    setLoading(true);
    const normalizedPhone = normalizeForAuth(phone);
    const loginIdentifier = normalizedPhone || phone;
    setError('');

    const result = await login(loginIdentifier, password);
    if (result.success) {
      if (result.user?.role === 'admin') {
        navigation.replace('AdminDashboard');
      } else {
        navigation.replace('Main');
      }
    } else {
      const translatedMessage =
        result.message === 'Invalid credentials'
          ? t.invalidCredentials
          : result.message;
      setError(translatedMessage);
      if (result.message.includes('Cannot connect to server') || result.message.includes('Backend not configured')) {
        AppAlert.alert(
          'Connection Error',
          'Backend not reachable. Start the backend and ensure the app has a configured API host.\n\n' +
          'Use the Network Debug UI (top-right) to select your computer\'s LAN IP, or set BASE_URL in environment for development.'
        );
      }
    }
    setLoading(false);
  };

  // ---- Tutorial steps ----
  const tutorialSteps = useMemo(() => [
    {
      getTarget: () => phoneContainerRef.current,
      title: t.tPhoneTitle,
      body: t.tPhoneBody,
    },
    {
      getTarget: () => passwordContainerRef.current,
      title: t.tPasswordTitle,
      body: t.tPasswordBody,
    },
    {
      getTarget: () => eyeButtonRef.current,
      title: t.tEyeTitle,
      body: t.tEyeBody,
    },
    {
      getTarget: () => loginButtonRef.current,
      title: t.tLoginTitle,
      body: t.tLoginBody,
    },
    {
      getTarget: () => signUpLinkRef.current,
      title: t.tSignUpTitle,
      body: t.tSignUpBody,
    },
    {
      getTarget: () => forgotLinkRef.current,
      title: t.tForgotTitle,
      body: t.tForgotBody,
    },
  ], [t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top','left','right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.Image
            source={Logo}
            style={[
              styles.logos,
              { width: 100, height: 95, position: 'relative' },
              {
                transform: [
                  { scale: logoScale },
                  {
                    rotate: logoRotate.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ['-6deg', '0deg', '6deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{t.welcome}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t.subtitle}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.phoneLabel}</Text>
              <View
                ref={phoneContainerRef}
                style={[styles.inputContainer, { borderColor: theme.border }]}
              >
                <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="07XXXXXXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (passwordRef && passwordRef.current && passwordRef.current.focus) {
                      passwordRef.current.focus();
                    }
                  }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.passwordLabel}</Text>
              <View
                ref={passwordContainerRef}
                style={[styles.inputContainer, { borderColor: theme.border }]}
              >
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={async () => {
                    await handleLogin();
                  }}
                />
                <TouchableOpacity
                  ref={eyeButtonRef}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {error !== '' && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#ff3b30" />
                <Text style={[styles.errorText, { color: '#ff3b30' }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              ref={loginButtonRef}
              style={[styles.loginButton, { backgroundColor: theme.accent }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>{t.login}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerContainer}
           
            >
              <Text style={[styles.registerText, { color: theme.textSecondary }]}>
                {t.noAccount}
              </Text>
              <TouchableOpacity
                 ref={signUpLinkRef}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={[styles.registerLink, { color: theme.text }]}> {t.signUp}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.resetContainer}
           >
              <Text style={[styles.resetText, { color: theme.textSecondary }]}>
                {t.resetText}
              </Text>
              <TouchableOpacity
                 ref={forgotLinkRef}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
              
                <Text style={[styles.forgotPassword, { color: theme.text }]}>
                  {t.forgot}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============ LOGIN TUTORIAL ============ */}
      <ScreenTutorialOverlay
        visible={showTutorial}
        steps={tutorialSteps}
        isDarkMode={isDarkMode}
        language={language}
        onFinish={finishTutorial}
        padding={5}
        dimOpacity={0}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logos: {
    marginTop: 20,
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorText: { fontSize: 13, marginLeft: 8, textAlign: 'center' },
  loginButton: { height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  resetContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30, gap: 3 },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: '600' },
  resetText: { fontSize: 14 },
  forgotPassword: { fontSize: 14 },
});

export default LoginScreen;