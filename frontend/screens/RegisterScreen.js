
// screens/RegisterScreen.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Image,
  Modal,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { normalizeRwandaPhone, normalizeForAuth } from '../utils/phoneNormalizer';
import Logo from '../assets/logos.png';
import SharedBottomNav from '../components/SharedBottomNav';
import ScreenTutorialOverlay from '../components/ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';
import { normalizeImageSource } from '../utils/imageUrl';


const { width } = Dimensions.get('window');

// ---- Tutorial config ---------------------------------------------------------
const REGISTER_TUTORIAL_ID = 'register';
const REGISTER_TUTORIAL_DELAY_MS = 700;

// -----------------------------------------------------------------------------

// ---------- Translations ----------
const translations = {
  English: {
    title: 'Create Account',
    step1: 'Phone & Username',
    step2: 'Password',
    step3: 'Recovery Number',
    step4: 'Agreement',
    phoneLabel: 'Phone number:',
    usernameLabel: 'Username:',
    passwordLabel: 'Password:',
    confirmPasswordLabel: 'Confirm Password:',
    recoveryNumberLabel: 'Recovery number (min 4 digits):',
    termsCheck: 'I agree to the Terms & Conditions and Privacy Policy',
    termsLink: 'Terms & Conditions',
    next: 'Next',
    back: 'Back',
    register: 'Register',
    subtitle: 'Register, discover stores, buy & sell your products.',
    successTitle: 'Success',
    successButton: 'Continue',
    registerFailedTitle: 'Registration failed',
    fillPhone: 'Please enter a valid phone number',
    fillUsername: 'Please enter a username (min 4 characters)',
    fillPassword: 'Please enter a password (min 4 characters, no spaces)',
    fillConfirmPassword: 'Please confirm your password',
    fillRecoveryNumber: 'Please enter a recovery number (at least 4 digits)',
    phoneLengthError: 'Phone number must be 10 digits',
    phoneStartError: 'Phone number must start with 07',
    passwordMismatch: 'Passwords do not match',
    passwordSpaceError: 'Password must not contain spaces',
    passwordMinLength: 'Password must be at least 4 characters',
    termsRequired: 'You must agree to the Terms & Conditions',
    userExists: 'An account with this phone number already exists',
    usernameTaken: 'Username already taken',
    usernameMinLength: 'Username must be at least 4 characters',
    recoveryNumberLengthError: 'Recovery number must be at least 4 digits',
    recoveryNumberTaken: 'This recovery number is already in use',
    registerSuccess: 'Registration successful! You are being signed in...',
    registerFailed: 'Registration failed. Please try again.',
    termsTitle: 'Terms and Conditions',
    termsContent: `1. Acceptance of Terms\nBy registering, you agree to be bound by these terms.\n\n2. User Responsibilities\nYou are responsible for maintaining the confidentiality of your account.\n\n3. Privacy\nWe respect your privacy and will not share your personal data without consent.\n\n4. Prohibited Activities\nYou may not use the app for illegal purposes.\n\n5. Termination\nWe reserve the right to terminate accounts that violate these terms.\n\n6. Changes to Terms\nWe may update these terms at any time.\n\n7. Contact\nFor questions, contact support@shaaka.com.`,
    alreadyAccount: 'Already have an account?',
    login: 'Login',
    checking: 'Checking…',
    valid: 'Available',
    invalid: 'Invalid',
    suggestionsTitle: 'Try one of these:',
    step2HintTitle: 'Set your password',
    step2HintMessages: [
      'Choose a strong password.',
      'Make sure it’s at least 4 characters.',
      'No spaces allowed.',
    ],
    step3HintTitle: 'Recovery number',
    step3HintMessages: [
      'Enter a number to recover your password.',
      'Make sure you remember it.',
      'Almost done — one step left.',
    ],
    step4HintTitle: 'Final step',
    step4HintMessages: [
      'Final step — accept the terms.',
      'You’re almost there.',
      'Complete the agreement to finish.',
    ],
    error: 'Please check your internet',
    // Tutorial
    tStep1PhoneTitle: 'Your phone number',
    tStep1PhoneBody: 'Enter your phone number starting with 07. You will use it to log in.',
    tStep1UserTitle: 'Choose a username',
    tStep1UserBody: 'Pick a username with at least 4 characters. We will check it is available.',
    tStep2PassTitle: 'Create a password',
    tStep2PassBody: 'Pick a password with at least 4 characters. No spaces allowed.',
    tStep2ConfirmTitle: 'Confirm password',
    tStep2ConfirmBody: 'Type the same password again to make sure you remember it.',
    tStep3RecoveryTitle: 'Recovery number',
    tStep3RecoveryBody: 'Enter a number only you know (at least 4 digits). We will use it if you forget your password.',
    tStep4TermsTitle: 'Accept terms',
    tStep4TermsBody: 'Read and check this box to agree to the Terms & Conditions before registering.',
    tStep4RegisterTitle: 'Create account',
    tStep4RegisterBody: 'Tap here to finish creating your account. You will be logged in automatically.',
  },
  Kinyarwanda: {
    title: 'Funguza Konti',
    step1: 'Telefone & Izina',
    step2: 'Ijambo banga',
    step3: 'Numero yo kwibutsa',
    step4: 'Amasezerano',
    phoneLabel: 'Numero ya telefone:',
    usernameLabel: 'Izina ry’ukoresha:',
    passwordLabel: 'Ijambo banga:',
    confirmPasswordLabel: 'Emeza ijambo banga:',
    recoveryNumberLabel: 'Numero yo kwibutsa (min imibare 4):',
    termsCheck: 'Emeza amasezerano n’amategeko ngenderwaho',
    termsLink: 'Amasezerano',
    next: 'Komeza',
    back: 'Subira inyuma',
    register: 'Iyandikishe',
    subtitle: 'Iyandikishe, ushaake amaduka, ugurishe & ugurishe ibicuruzwa byawe',
    successTitle: 'Byakunze',
    successButton: 'Komeza',
    registerFailedTitle: 'Kwiyandikisha byanze',
    fillPhone: 'Nyamuneka andika numero ya telefone',
    fillUsername: 'Nyamuneka andika izina (min inyuguti 4)',
    fillPassword: 'Nyamuneka andika ijambo banga (min 4, nta mwanya)',
    fillConfirmPassword: 'Nyamuneka emeza ijambo banga',
    fillRecoveryNumber: 'Nyamuneka andika numero yo kwibutsa (min imibare 4)',
    phoneLengthError: 'Numero igomba kuba imibare 10',
    phoneStartError: 'Numero igomba gutangira na 07',
    passwordMismatch: 'Amagambo banga ntabwo ahuye',
    passwordSpaceError: 'Ijambo banga ntirigomba kuba rifite umwanya',
    passwordMinLength: 'Ijambo banga rigomba kugira nibura inyuguti 4',
    termsRequired: 'Ugomba kwemera amasezerano',
    userExists: 'Konti ifite iyi numero irahari',
    usernameTaken: 'Izina ryarakoreshejwe',
    usernameMinLength: 'Izina rigomba kugira nibura inyuguti 4',
    recoveryNumberLengthError: 'Numero yo kwibutsa igomba kugira nibura imibare 4',
    recoveryNumberTaken: 'Iyi numero yo kwibutsa irakoreshejwe',
    registerSuccess: 'Kwiyandikisha byakunze! ugiye guhita winjira...',
    registerFailed: 'Kwiyandikisha byanze. Ongera ugerageze.',
    termsTitle: 'Amasezerano',
    termsContent: `1. Ukwemera amasezerano\nIyo winjiye, wemera gufatanya n'aya masezerano.\n\n2. Inshingano z'ukoresha\nUri we ubazwa kubungabunga amakuru ya konti yawe.\n\n3. Ibanga\nTubika amakuruyanyu byizewe kandi dukora uko dushoboye ntajye hanze.\n\n4. Ibikorwa bitemewe\nNtimwemerewe gukoresha iyi porogaramu muburyo butemewe n'amategeko. Cyangwa uyikoresha ibidakwiye\n\n5. Guhagarika\nDufite uburenganzira bwo guhagarika konti utubahiriza aya masezerano.\n\n6. Guhindura amasezerano\nDushobora guhindura aya masezerano igihe cyose.Nituuyahindura tuzabamenye sha.\n\n7. Kuvugana\nNiba ufite ibibazo, twandikire kuri Kumbugankoranyambaga zacu.`,
    alreadyAccount: 'Ufite konti?',
    login: 'Kwinjira',
    checking: 'Igenzura…',
    valid: 'Irahari',
    invalid: 'Ntishoboka',
    suggestionsTitle: 'Gerageza aya mazina:',
    step2HintTitle: 'Shyiraho ijambo banga',
    step2HintMessages: [
      'Hitamo ijambo banga rikomeye.',
      'Menya neza ko rifite nibura inyuguti 4.',
      'Nta mwanya uremewe.',
    ],
    step3HintTitle: 'Numero yo kwibutsa',
    step3HintMessages: [
      'Andika numero yo kwibutsa ijambo banga.',
      'Uramenye ukayibuka.',
      'Birarangiye — hasigaye intambwe imwe.',
    ],
    step4HintTitle: 'Intambwe ya nyuma',
    step4HintMessages: [
      'Intambwe ya nyuma — emeza amasezerano.',
      'Ugeze hafi.',
      'Soza amasezerano urangize.',
    ],
    error: 'Genzura internet yawe',
    // Tutorial
    tStep1PhoneTitle: 'Nimero ya telefone',
    tStep1PhoneBody: 'Andika nimero ya telefone itangira na 07. Uzayikoresha kwinjira.',
    tStep1UserTitle: 'Hitamo izina ry’ukoresha',
    tStep1UserBody: 'Hitamo izina rifite nibura inyuguti 4. Tuzagenzura niba rirahari.',
    tStep2PassTitle: 'Kora ijambo banga',
    tStep2PassBody: 'Hitamo ijambo banga rifite nibura inyuguti 4. Nta mwanya wemewe.',
    tStep2ConfirmTitle: 'Emeza ijambo banga',
    tStep2ConfirmBody: 'Ongera wandike ijambo banga rimwe kugira ngo wibuke neza.',
    tStep3RecoveryTitle: 'Numero yo kwibutsa',
    tStep3RecoveryBody: 'Andika numero wowe gusa uzi (nibura imibare 4). Tuzayikoresha niba wibagiwe ijambo banga.',
    tStep4TermsTitle: 'Emeza amasezerano',
    tStep4TermsBody: 'Soma kandi ushyire akamenyetso kuri aka gasanduku wemere amasezerano mbere yo kwiyandikisha.',
    tStep4RegisterTitle: 'Funguza konti',
    tStep4RegisterBody: 'Kanda hano urangize gufungura konti yawe. Uzahita winjira mu buryo bwikora.',
  },
};

// ---------- Helper: generate username suggestions ----------
const generateSuggestions = (username) => {
  if (!username || username.length < 2) return [];
  const base = username.trim().toLowerCase();
  const digits = base.replace(/\D/g, '');
  const stem = base.replace(/\d/g, '') || base;

  const suffixPool = ['pro', 'musanze', 'kigali', '12', 'official', 'rwanda'];
  let suggestions = [];
  if (digits.length > 0) {
    const num = parseInt(digits, 10) || 1;
    suggestions = [
      `${stem}${num + 1}`,
      `${stem}${num + 2}`,
      `${stem}${num + 3}`,
      `${stem}${num + 4}`,
    ];
  } else {
    suggestions = suffixPool.map(s => `${stem}${s}`);
  }
  suggestions.push(`${stem}${Math.floor(Math.random() * 100) + 1}`);
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 3);
};

// ---------- Component ----------
const RegisterScreen = ({ navigation, language = 'English' }) => {
  const { theme, isDarkMode } = useTheme();
  const isFocused = useIsFocused();
  const { login: authLogin } = useAuth();
  const t = translations[language];

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    phone: '07',
    username: '',
    password: '',
    confirmPassword: '',
    recoveryNumber: '',
    termsAgreed: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Input refs for focus chain
  const phoneRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const recoveryRef = useRef(null);

  // ---- Tutorial refs ----
  const phoneContainerRef = useRef(null);
  const usernameContainerRef = useRef(null);
  const passwordContainerRef = useRef(null);
  const confirmContainerRef = useRef(null);
  const recoveryContainerRef = useRef(null);
  const termsCheckboxRef = useRef(null);
  const registerButtonRef = useRef(null);

  // ---- Tutorial state ----
  const [showTutorial, finishTutorial] = useScreenTutorial(
    REGISTER_TUTORIAL_ID,
    isFocused && !loading,
    REGISTER_TUTORIAL_DELAY_MS,
    step
  );

  // Real‑time validation statuses
  const [phoneStatus, setPhoneStatus] = useState({ checking: false, valid: false, message: '' });
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, valid: false, message: '' });
  const [recoveryStatus, setRecoveryStatus] = useState({ checking: false, valid: false, message: '' });

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (step < 2 || step > 4) {
      setShowHint(false);
      return;
    }

    const hintContent = step === 2
      ? { title: t.step2HintTitle, messages: t.step2HintMessages }
      : step === 3
        ? { title: t.step3HintTitle, messages: t.step3HintMessages }
        : { title: t.step4HintTitle, messages: t.step4HintMessages };

    const messages = hintContent.messages || [];
    if (messages.length < 2) return;

    setHintIndex(0);
    setShowHint(false);

    const showTimer = setTimeout(() => {
      setShowHint(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 1000);

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 20,
        useNativeDriver: true,
      }).start(() => {
        setHintIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, [step, t.step2HintTitle, t.step2HintMessages, t.step3HintTitle, t.step3HintMessages, t.step4HintTitle, t.step4HintMessages, fadeAnim]);

  const checkPhone = async (phone) => {
    if (!phone || phone.length < 10) {
      setPhoneStatus({ checking: false, valid: false, message: t.phoneLengthError });
      return;
    }
    if (!phone.startsWith('07')) {
      setPhoneStatus({ checking: false, valid: false, message: t.phoneStartError });
      return;
    }
    setPhoneStatus({ checking: true, valid: false, message: t.checking });
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/check-phone`, { phone });
      const exists = res?.data?.exists;
      if (exists) {
        setPhoneStatus({ checking: false, valid: false, message: t.userExists });
      } else {
        setPhoneStatus({ checking: false, valid: true, message: t.valid });
      }
    } catch (err) {
      setPhoneStatus({ checking: false, valid: false, message: t.error });
    }
  };

  const checkUsername = async (username) => {
    if (!username || username.length < 4) {
      setUsernameStatus({ checking: false, valid: false, message: t.usernameMinLength });
      setUsernameSuggestions([]);
      return;
    }
    setUsernameStatus({ checking: true, valid: false, message: t.checking });
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/check-username`, { username });
      const exists = res?.data?.exists;
      if (exists) {
        setUsernameStatus({ checking: false, valid: false, message: t.usernameTaken });
        const suggestions = generateSuggestions(username);
        setUsernameSuggestions(suggestions);
      } else {
        setUsernameStatus({ checking: false, valid: true, message: t.valid });
        setUsernameSuggestions([]);
      }
    } catch (err) {
      setUsernameStatus({ checking: false, valid: false, message: t.error });
      setUsernameSuggestions([]);
    }
  };

  const checkRecoveryNumber = async (number) => {
    if (!number || number.length < 4) {
      setRecoveryStatus({ checking: false, valid: false, message: t.recoveryNumberLengthError });
      return;
    }
    setRecoveryStatus({ checking: true, valid: false, message: t.checking });
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/check-id`, { idNumber: number });
      const exists = res?.data?.exists;
      if (exists) {
        setRecoveryStatus({ checking: false, valid: false, message: t.recoveryNumberTaken });
      } else {
        setRecoveryStatus({ checking: false, valid: true, message: t.valid });
      }
    } catch (err) {
      setRecoveryStatus({ checking: false, valid: false, message: t.error });
    }
  };

  const debouncedCheck = (field, value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (field === 'phone') checkPhone(value);
      else if (field === 'username') checkUsername(value);
      else if (field === 'recovery') checkRecoveryNumber(value);
    }, 500);
  };

  const handlePhoneChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (!digits.startsWith('07')) digits = '07';
    if (digits.length > 10) digits = digits.slice(0, 10);
    setFormData({ ...formData, phone: digits });
    setError('');
    debouncedCheck('phone', digits);
  };

  const handleUsernameChange = (text) => {
    setFormData({ ...formData, username: text });
    setError('');
    debouncedCheck('username', text);
  };

  const handlePasswordChange = (text) => {
    const cleaned = text.replace(/\s/g, '');
    setFormData({ ...formData, password: cleaned });
    setError('');
  };

  const handleConfirmPasswordChange = (text) => {
    const cleaned = text.replace(/\s/g, '');
    setFormData({ ...formData, confirmPassword: cleaned });
    setError('');
  };

  const handleRecoveryChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (digits.length > 16) digits = digits.slice(0, 16);
    setFormData({ ...formData, recoveryNumber: digits });
    setError('');
    debouncedCheck('recovery', digits);
  };

  const validateStep = () => {
    if (step === 1) {
      if (!phoneStatus.valid) {
        setError(phoneStatus.message || t.fillPhone);
        return false;
      }
      if (!formData.username || formData.username.length < 4) {
        setError(t.usernameMinLength);
        return false;
      }
      if (!usernameStatus.valid) {
        setError(usernameStatus.message || t.fillUsername);
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!formData.password || formData.password.length < 4) {
        setError(t.passwordMinLength);
        return false;
      }
      if (/\s/.test(formData.password)) {
        setError(t.passwordSpaceError);
        return false;
      }
      if (!formData.confirmPassword) {
        setError(t.fillConfirmPassword);
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t.passwordMismatch);
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (!formData.recoveryNumber || formData.recoveryNumber.length < 4) {
        setError(t.recoveryNumberLengthError);
        return false;
      }
      if (!recoveryStatus.valid) {
        setError(recoveryStatus.message || t.fillRecoveryNumber);
        return false;
      }
      return true;
    }

    if (step === 4) {
      if (!formData.termsAgreed) {
        setError(t.termsRequired);
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      if (step === 1) setUsernameSuggestions([]);
      setStep(step + 1);
    }
  };

  const prevStep = () => setStep(step - 1);

  const handleRegister = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError('');

    const registerPayload = {
      phone: normalizeForAuth(formData.phone) || formData.phone,
      idNumber: formData.recoveryNumber,
      username: formData.username,
      password: formData.password,
    };

    try {
      await axios.post(`${BASE_URL}/api/auth/register`, registerPayload);

      const loginResult = await authLogin(normalizeForAuth(formData.phone) || formData.phone, formData.password);
      if (loginResult.success) {
        navigation.replace('Main');
      } else {
        setError('Account created but automatic login failed. Please log in manually.');
        setSuccessTitle(t.registerFailedTitle);
        setSuccessMessage('Login failed. Please go to the login screen.');
        setSuccessModalVisible(true);
      }
    } catch (err) {
      console.error('Registration error:', err);
      let message = t.registerFailed;
      if (err?.response) {
        const backendMsg = err.response.data?.message;
        if (backendMsg?.includes('phone')) message = t.userExists;
        else if (backendMsg?.includes('username')) message = t.usernameTaken;
        else if (backendMsg?.includes('ID')) message = t.recoveryNumberTaken;
        else message = backendMsg || t.registerFailed;
      } else if (err?.request) {
        message = 'Network error – cannot reach backend. Check the app IP and backend server.';
      }
      setError(message);
      setSuccessTitle(t.registerFailedTitle);
      setSuccessMessage(message);
      setSuccessModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTermsCheck = () => {
    const nextValue = !formData.termsAgreed;
    setFormData({ ...formData, termsAgreed: nextValue });
    if (nextValue) {
      setTermsExpanded(true);
    } else {
      setTermsExpanded(false);
    }
    setError('');
  };

  const renderStatusIcon = (status) => {
    if (status.checking) {
      return <ActivityIndicator size="small" color={theme.textSecondary} />;
    }
    if (status.valid) {
      return <Ionicons name="checkmark-circle" size={22} color="#47ae87" />;
    }
    if (status.message && !status.checking) {
      return <Ionicons name="alert-circle" size={22} color="#d87428" />;
    }
    return null;
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepWrapper}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: step >= s ? theme.accent : theme.border,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                { color: step >= s ? '#fff' : theme.textSecondary },
              ]}
            >
              {s}
            </Text>
          </View>
          {s < 4 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: step > s ? theme.accent : theme.border },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  // ---- Tutorial steps for the current step ----
  const tutorialSteps = useMemo(() => {
    if (loading) return [];
    const steps = [];

    if (step === 1) {
      steps.push(
        {
          getTarget: () => phoneContainerRef.current,
          title: t.tStep1PhoneTitle,
          body: t.tStep1PhoneBody,
        },
        {
          getTarget: () => usernameContainerRef.current,
          title: t.tStep1UserTitle,
          body: t.tStep1UserBody,
        }
      );
    } else if (step === 2) {
      steps.push(
        {
          getTarget: () => passwordContainerRef.current,
          title: t.tStep2PassTitle,
          body: t.tStep2PassBody,
        },
        {
          getTarget: () => confirmContainerRef.current,
          title: t.tStep2ConfirmTitle,
          body: t.tStep2ConfirmBody,
        }
      );
    } else if (step === 3) {
      steps.push({
        getTarget: () => recoveryContainerRef.current,
        title: t.tStep3RecoveryTitle,
        body: t.tStep3RecoveryBody,
      });
    } else if (step === 4) {
      steps.push(
        {
          getTarget: () => termsCheckboxRef.current,
          title: t.tStep4TermsTitle,
          body: t.tStep4TermsBody,
        },
        {
          getTarget: () => registerButtonRef.current,
          title: t.tStep4RegisterTitle,
          body: t.tStep4RegisterBody,
        }
      );
    }

    return steps;
  }, [step, t, loading]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
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
                  value={formData.phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (usernameRef.current) usernameRef.current.focus();
                  }}
                />
                {renderStatusIcon(phoneStatus)}
              </View>
              {phoneStatus.message && !phoneStatus.checking && (
                <Text style={[styles.statusMessage, { color: phoneStatus.valid ? '#47ae87' : '#d87428' }]}>
                  {phoneStatus.message}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.usernameLabel}</Text>
              <View
                ref={usernameContainerRef}
                style={[styles.inputContainer, { borderColor: theme.border }]}
              >
                <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={usernameRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Sego.remy"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (validateStep()) nextStep();
                  }}
                />
                {renderStatusIcon(usernameStatus)}
              </View>
              {usernameStatus.message && !usernameStatus.checking && (
                <Text style={[styles.statusMessage, { color: usernameStatus.valid ? '#47ae87' : '#d87428' }]}>
                  {usernameStatus.message}
                </Text>
              )}
              {usernameSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={[styles.suggestionsTitle, { color: theme.textSecondary }]}>
                    {t.suggestionsTitle}
                  </Text>
                  <View style={styles.suggestionsList}>
                    {usernameSuggestions.map((sug) => (
                      <TouchableOpacity
                        key={sug}
                        onPress={() => {
                          setFormData({ ...formData, username: sug });
                          debouncedCheck('username', sug);
                        }}
                      >
                        <Text style={styles.suggestionText}>* {sug}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        );

      case 2:
        return (
          <>
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
                  value={formData.password}
                  onChangeText={handlePasswordChange}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (confirmRef.current) confirmRef.current.focus();
                  }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.confirmPasswordLabel}</Text>
              <View
                ref={confirmContainerRef}
                style={[styles.inputContainer, { borderColor: theme.border }]}
              >
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={confirmRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  value={formData.confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (validateStep()) nextStep();
                  }}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      case 3:
        return (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>{t.recoveryNumberLabel}</Text>
            <View
              ref={recoveryContainerRef}
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={recoveryRef}
                style={[styles.input, { color: theme.text }]}
                placeholder="8527"
                placeholderTextColor={theme.textSecondary}
                value={formData.recoveryNumber}
                onChangeText={handleRecoveryChange}
                keyboardType="numeric"
                maxLength={16}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (validateStep()) nextStep();
                }}
              />
              {renderStatusIcon(recoveryStatus)}
            </View>
            {recoveryStatus.message && !recoveryStatus.checking && (
              <Text style={[styles.statusMessage, { color: recoveryStatus.valid ? '#47ae87' : '#d87428' }]}>
                {recoveryStatus.message}
              </Text>
            )}
          </View>
        );

      case 4:
        return (
          <View style={styles.agreementContainer}>
            <View ref={termsCheckboxRef}>
              <TouchableOpacity style={styles.checkboxRow} onPress={handleTermsCheck}>
                <Ionicons
                  name={formData.termsAgreed ? 'checkbox-outline' : 'square-outline'}
                  size={24}
                  color={theme.accent}
                />
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                  {t.termsCheck}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setTermsExpanded((prev) => !prev)}>
              <Text style={[styles.termsLink, { color: theme.accent }]}>
                {t.termsLink}
              </Text>
            </TouchableOpacity>
            {termsExpanded && (
              <View style={[styles.termsExpandedBox, { borderColor: theme.border }]}>
                <ScrollView style={styles.termsExpandedScroll} nestedScrollEnabled>
                  <Text style={[styles.termsExpandedText, { color: theme.textSecondary }]}>
                    {t.termsContent}
                  </Text>
                </ScrollView>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top','left','right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Image source={normalizeImageSource(Logo)} style={[styles.logos, { width: 100, height: 95 }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>
            {step === 1 && (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.subtitle}</Text>
            )}
            {(step === 2 || step === 3 || step === 4) && showHint && (
              <Animated.View style={[styles.stepHint, { opacity: fadeAnim }]}>
                <Text style={[styles.stepHintTitle, { color: theme.textSecondary }]}>
                  {step === 2 ? t.step2HintTitle : step === 3 ? t.step3HintTitle : t.step4HintTitle}
                </Text>
                <Text style={[styles.stepHintText, { color: theme.text }]}>
                  {step === 2
                    ? t.step2HintMessages[hintIndex]
                    : step === 3
                      ? t.step3HintMessages[hintIndex]
                      : t.step4HintMessages[hintIndex]}
                </Text>
              </Animated.View>
            )}
          </View>

          {renderStepIndicator()}

          <View style={styles.form}>
            {renderStepContent()}

            {error !== '' && (
              <Text style={[styles.errorText, { color: '#d87428' }]}>{error}</Text>
            )}

            <View style={styles.buttonRow}>
              {step > 1 && (
                <TouchableOpacity
                  style={[styles.button, styles.backButton, { borderColor: theme.accent }]}
                  onPress={prevStep}
                  disabled={loading}
                >
                  <Text style={[styles.buttonText, { color: theme.accent }]}>{t.back}</Text>
                </TouchableOpacity>
              )}

              {step < 4 ? (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton, { backgroundColor: theme.accent }]}
                  onPress={nextStep}
                  disabled={loading}
                >
                  <Text style={styles.nextButtonText}>{t.next}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  ref={registerButtonRef}
                  style={[styles.button, styles.registerButton, { backgroundColor: theme.accent }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.registerButtonText}>{t.register}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.loginRedirect}>
               <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginRedirectText, { color: theme.textSecondary }]}>
                {t.alreadyAccount}
              </Text>
             
                <Text style={[styles.loginLink, { color: theme.text }]}>{t.login}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={successModalVisible}
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{successTitle}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{successMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.accent }]}
              onPress={() => {
                setSuccessModalVisible(false);
                if (successTitle === t.successTitle) {
                  navigation.replace('Main');
                }
              }}
            >
              <Text style={styles.modalButtonText}>{t.successButton}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============ REGISTER STEP TUTORIAL ============ */}
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

// ---------- Styles (unchanged) ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    bottom: 50,
    zIndex: 999,
    elevation: 999,
  },
  logos: { marginTop: 20, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40 },
  subtitle: { fontSize: 14, textAlign: 'center', bottom: 10 },
  stepHint: {
    marginTop: 50,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
    position: 'absolute',
  },
  stepHintTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  stepHintText: { fontSize: 12, textAlign: 'center' },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, left: 40 },
  stepCircle: {
    width: 35, height: 35, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  stepNumber: { fontSize: 16, fontWeight: 'bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  statusMessage: { fontSize: 12, marginTop: 4, marginLeft: 4 },
  suggestionsContainer: { marginTop: 8 },
  suggestionsTitle: { fontSize: 13, marginBottom: 6 },
  suggestionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionText: { color: '#000000', fontSize: 13, fontWeight: '700', marginRight: 10, marginBottom: 6 },
  agreementContainer: { marginVertical: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkboxLabel: { fontSize: 14, marginLeft: 10, flex: 1 },
  termsLink: { fontSize: 14, textAlign: 'center', marginTop: 8, textDecorationLine: 'underline' },
  termsExpandedBox: { marginTop: 5, padding: 10, borderWidth: 1, borderRadius: 22, maxHeight: 220 },
  termsExpandedScroll: { maxHeight: 200 },
  termsExpandedText: { fontSize: 13, lineHeight: 18 },
  errorText: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  button: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { borderWidth: 1, marginRight: 10, backgroundColor: 'transparent' },
  nextButton: { marginLeft: 10 },
  registerButton: { marginLeft: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginRedirect: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 6 },
  loginRedirectText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: { width: width * 0.85, borderRadius: 16, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20 },
  modalButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default RegisterScreen;