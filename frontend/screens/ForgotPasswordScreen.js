
// screens/ForgotPasswordScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { isValidRwandaPhone } from '../utils/phoneNormalizer';
import axios from 'axios';
import { BASE_URL } from '../constants';
import Logo from '../assets/logos.png';
import ScreenTutorialOverlay from '../components/ScreenTutorialOverlay';
import useScreenTutorial from '../hooks/useScreenTutorial';
import { normalizeImageSource } from '../utils/imageUrl';


const { width } = Dimensions.get('window');

// ---- Tutorial config ---------------------------------------------------------
const FORGOT_TUTORIAL_ID = 'forgotpassword';
const FORGOT_TUTORIAL_DELAY_MS = 700;

// -----------------------------------------------------------------------------

const translations = {
  English: {
    title: 'Reset Password',
    subtitle: 'Enter your phone and recovery number to continue',
    step1: 'Verify identity',
    step2: 'New Password',
    phoneLabel: 'Phone number:',
    recoveryLabel: 'Recovery number (the one you set during registration):',
    newPasswordLabel: 'New password:',
    confirmPasswordLabel: 'Confirm new password:',
    next: 'Next',
    back: 'Back',
    reset: 'Reset Password',
    fillPhoneRecovery: 'Please enter a valid phone number and recovery number',
    phoneLengthError: 'Phone number must be 10 digits starting with 07',
    recoveryLengthError: 'Recovery number must be at least 4 digits',
    fillPasswords: 'Please enter new password and confirmation',
    passwordMinLength: 'Password must be at least 4 characters',
    passwordMismatch: 'Passwords do not match',
    userNotFound: 'No account found with the provided information',
    resetSuccess: 'Password reset successful! Please login with your new password.',
    resetFailed: 'Failed to reset password. Please try again.',
    reusePasswordError: 'Please choose a password you have not used before.',
    successTitle: 'Success',
    successButton: 'Go to Login',
    rememberPassword: 'I remember my password?',
    login: 'Login',
    register: 'Register',
    checking: 'Verifying…',
    step2HintTitle: 'New password',
    step2HintMessages: [
      'Choose a fresh password.',
      'Make it strong and something you will remember.',
      'Almost done — reset your access!',
    ],
    // Tutorial
    tStep1PhoneTitle: 'Your phone number',
    tStep1PhoneBody: 'Enter the phone number you registered with (starts with 07).',
    tStep2RecoveryTitle: 'Recovery number',
    tStep2RecoveryBody: 'Enter the recovery number you set during registration. This proves the account is yours.',
    tStep2PassTitle: 'New password',
    tStep2PassBody: 'Choose a new password with at least 4 characters. Make it strong.',
    tStep2ConfirmTitle: 'Confirm password',
    tStep2ConfirmBody: 'Type the new password again so we can make sure it matches.',
  },
  Kinyarwanda: {
    title: 'Iyibutsa Ijambo banga',
    subtitle: 'Andika numero ya telefone na numero yo kwibutsa kugira ngo ukomeze',
    step1: 'Emeza amakuru',
    step2: 'Ijambo banga rishya',
    phoneLabel: 'Numero ya telefone:',
    recoveryLabel: 'Numero yo kwibutsa (wasize uyandikisha):',
    newPasswordLabel: 'Ijambo banga rishya:',
    confirmPasswordLabel: 'Emeza ijambo banga rishya:',
    next: 'Ibikurikiye',
    back: 'Subira inyuma',
    reset: 'Hindura',
    fillPhoneRecovery: 'Nyamuneka andika numero ya telefone na numero yo kwibutsa',
    phoneLengthError: 'Nimero igomba kuba imibare 10 itangirana na 07',
    recoveryLengthError: 'Numero yo kwibutsa igomba kugira nibura imibare 4',
    fillPasswords: 'Nyamuneka andika ijambo banga rishya kandi uryemeze',
    passwordMinLength: 'Ijambo banga rigomba kugira nibura inyuguti 4',
    passwordMismatch: 'Amagambo banga ntabwo ahuye',
    userNotFound: 'Nta konti iboneka hamwe n’amakuru watanze',
    resetSuccess: 'Ijambo banga ryahinduwe! Injira ukoreshe ijambo banga rishya.',
    resetFailed: 'Guhindura ijambo banga byanze. Ongera ugerageze.',
    reusePasswordError: 'Hitamo ijambo banga utarakoresha mbere.',
    successTitle: 'Byakunze',
    successButton: 'Kwinjira',
    rememberPassword: 'Nibuka ijambo banga ryanjye?',
    login: 'Injira',
    register: 'Iyandikishe',
    checking: 'Igenzura…',
    step2HintTitle: 'Ijambo banga rishya',
    step2HintMessages: [
      'Shyiramo ijambo banga rishya.',
      'Rigire rikomeye kandi wibuke.',
      'Birarangiye — tangira gukoresha!',
    ],
    // Tutorial
    tStep1PhoneTitle: 'Nimero ya telefone',
    tStep1PhoneBody: 'Andika nimero ya telefone wiyandikishije (itangira na 07).',
    tStep2RecoveryTitle: 'Numero yo kwibutsa',
    tStep2RecoveryBody: 'Andika numero yo kwibutsa wasize wiyandikisha. Iri ni igihamya ko iyi konti ni iyawe.',
    tStep2PassTitle: 'Ijambo banga rishya',
    tStep2PassBody: 'Hitamo ijambo banga rishya rifite nibura inyuguti 4. Rigire rikomeye.',
    tStep2ConfirmTitle: 'Emeza ijambo banga',
    tStep2ConfirmBody: 'Ongera wandike ijambo banga rishya kugira ngo turebe ko bihuye.',
  },
};

const ForgotPasswordScreen = ({ navigation, language = 'English' }) => {
  const { theme, isDarkMode } = useTheme();
  const isFocused = useIsFocused();
  const t = translations[language];

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    phone: '07',
    recoveryNumber: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneStatus, setPhoneStatus] = useState({ checking: false, valid: false, message: '' });
  const [recoveryStatus, setRecoveryStatus] = useState({ checking: false, valid: false, message: '' });
  const [verifiedUserId, setVerifiedUserId] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Input refs
  const phoneRef = useRef(null);
  const recoveryRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmRef = useRef(null);

  // ---- Tutorial refs ----
  const phoneContainerRef = useRef(null);
  const recoveryContainerRef = useRef(null);
  const newPasswordContainerRef = useRef(null);
  const confirmContainerRef = useRef(null);

  // ---- Tutorial state ----
  const [showTutorial, finishTutorial] = useScreenTutorial(
    FORGOT_TUTORIAL_ID,
    isFocused && !loading,
    FORGOT_TUTORIAL_DELAY_MS,
    step
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (step !== 2) {
      setShowHint(false);
      return;
    }

    const messages = t.step2HintMessages;
    if (!messages || messages.length < 2) return;

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
  }, [step, t.step2HintMessages, fadeAnim]);

  const validatePhone = () => {
    const valid = formData.phone && isValidRwandaPhone(formData.phone);
    if (!valid) {
      setPhoneStatus({ checking: false, valid: false, message: t.phoneLengthError });
      return false;
    }
    setPhoneStatus({ checking: false, valid: true, message: '' });
    return true;
  };

  const validateRecovery = () => {
    const valid = formData.recoveryNumber && formData.recoveryNumber.length >= 4;
    if (!valid) {
      setRecoveryStatus({ checking: false, valid: false, message: t.recoveryLengthError });
      return false;
    }
    setRecoveryStatus({ checking: false, valid: true, message: '' });
    return true;
  };

  const handlePhoneChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (!digits.startsWith('07')) digits = '07';
    if (digits.length > 10) digits = digits.slice(0, 10);
    setFormData({ ...formData, phone: digits });
    setError('');
    setPhoneStatus({ checking: false, valid: false, message: '' });
  };

  const handleRecoveryChange = (text) => {
    let digits = text.replace(/\D/g, '');
    if (digits.length > 16) digits = digits.slice(0, 16);
    setFormData({ ...formData, recoveryNumber: digits });
    setError('');
    setRecoveryStatus({ checking: false, valid: false, message: '' });
  };

  const verifyIdentity = async () => {
    const phoneValid = validatePhone();
    const recoveryValid = validateRecovery();
    if (!phoneValid || !recoveryValid) {
      setError(t.fillPhoneRecovery);
      return false;
    }
    setLoading(true);
    setError('');
    try {
      const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-user`, {
        phone: formData.phone,
        idNumber: formData.recoveryNumber,
      });
      const userId = verifyRes.data.userId;
      setVerifiedUserId(userId);
      setLoading(false);
      return true;
    } catch (err) {
      setError(t.userNotFound);
      setLoading(false);
      return false;
    }
  };

  const resetPassword = async () => {
    if (!formData.newPassword || !formData.confirmPassword) {
      setError(t.fillPasswords);
      return false;
    }
    if (formData.newPassword.length < 4) {
      setError(t.passwordMinLength);
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t.passwordMismatch);
      return false;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE_URL}/api/auth/reset-password`, {
        userId: verifiedUserId,
        newPassword: formData.newPassword,
      });
      setSuccessModalVisible(true);
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || t.resetFailed;
      setError(msg === 'Password already used' ? t.reusePasswordError : msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (step === 1) {
      const verified = await verifyIdentity();
      if (verified) setStep(2);
    }
  };

  const prevStep = () => {
    setStep(1);
    setError('');
  };

  const handleReset = async () => {
    await resetPassword();
  };

  const renderStatusIcon = (status) => {
    if (status.checking) {
      return <ActivityIndicator size="small" color={theme.textSecondary} />;
    }
    if (status.valid) {
      return <Ionicons name="checkmark-circle" size={22} color="#58bc76" />;
    }
    if (status.message && !status.checking) {
      return <Ionicons name="alert-circle" size={22} color="#d87428" />;
    }
    return null;
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {[1, 2].map(s => (
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
            <Text style={[styles.stepNumber, { color: step >= s ? '#fff' : theme.textSecondary }]}>
              {s}
            </Text>
          </View>
          {s < 2 && (
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
          getTarget: () => recoveryContainerRef.current,
          title: t.tStep2RecoveryTitle,
          body: t.tStep2RecoveryBody,
        }
      );
    } else if (step === 2) {
      steps.push(
        {
          getTarget: () => newPasswordContainerRef.current,
          title: t.tStep2PassTitle,
          body: t.tStep2PassBody,
        },
        {
          getTarget: () => confirmContainerRef.current,
          title: t.tStep2ConfirmTitle,
          body: t.tStep2ConfirmBody,
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
                style={[styles.inputContainer, { borderColor: phoneStatus.message && !phoneStatus.valid ? '#d87428' : theme.border }]}
              >
                <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="07XXXXXXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.phone}
                  onChangeText={handlePhoneChange}
                  onBlur={validatePhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => recoveryRef.current?.focus()}
                />
                {renderStatusIcon(phoneStatus)}
              </View>
              {phoneStatus.message && !phoneStatus.valid && (
                <Text style={[styles.statusMessage, { color: '#d87428' }]}>{phoneStatus.message}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.recoveryLabel}</Text>
              <View
                ref={recoveryContainerRef}
                style={[styles.inputContainer, { borderColor: recoveryStatus.message && !recoveryStatus.valid ? '#d87428' : theme.border }]}
              >
                <Ionicons name="keypad-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={recoveryRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="1234"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.recoveryNumber}
                  onChangeText={handleRecoveryChange}
                  onBlur={validateRecovery}
                  keyboardType="numeric"
                  maxLength={16}
                  returnKeyType="done"
                  onSubmitEditing={nextStep}
                />
                {renderStatusIcon(recoveryStatus)}
              </View>
              {recoveryStatus.message && !recoveryStatus.valid && (
                <Text style={[styles.statusMessage, { color: '#d87428' }]}>{recoveryStatus.message}</Text>
              )}
            </View>
          </>
        );

      case 2:
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>{t.newPasswordLabel}</Text>
              <View
                ref={newPasswordContainerRef}
                style={[styles.inputContainer, { borderColor: theme.border }]}
              >
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={newPasswordRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showNewPassword}
                  value={formData.newPassword}
                  onChangeText={(text) => setFormData({ ...formData, newPassword: text.replace(/\s/g, '') })}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
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
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text.replace(/\s/g, '') })}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top','left','right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Image source={normalizeImageSource(Logo)} style={[styles.logos, { width: 100, height: 95 }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{t.title}</Text>
            {step === 1 ? (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.subtitle}</Text>
            ) : showHint ? (
              <Animated.View style={[styles.stepHint, { opacity: fadeAnim }]}>
                <Text style={[styles.stepHintTitle, { color: theme.text }]}>
                  {t.step2HintTitle}
                </Text>
                <Text style={[styles.stepHintText, { color: theme.textSecondary }]}>
                  {t.step2HintMessages[hintIndex]}
                </Text>
              </Animated.View>
            ) : null}
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
              {step < 2 ? (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton, { backgroundColor: theme.accent }]}
                  onPress={nextStep}
                  disabled={loading}
                >
                  <Text style={styles.nextButtonText}>{t.next}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.resetButton, { backgroundColor: theme.accent }]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetButtonText}>{t.reset}</Text>}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.linkText, { color: theme.accent }]}>
                  {t.rememberPassword} <Text style={[{ fontWeight: '600' },{ color: theme.text }]}>{t.login}</Text>
                </Text>
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.successTitle}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{t.resetSuccess}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.accent }]}
              onPress={() => {
                setSuccessModalVisible(false);
                navigation.replace('Login');
              }}
            >
              <Text style={styles.modalButtonText}>{t.successButton}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============ FORGOT PASSWORD STEP TUTORIAL ============ */}
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logos: { marginTop: 10, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  stepHint: { marginTop: 50, alignItems: 'center', paddingHorizontal: 8, position: 'absolute' },
  stepHintTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  stepHintText: { fontSize: 12, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 50 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, left: 50 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  stepNumber: { fontSize: 16, fontWeight: 'bold' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  statusMessage: { fontSize: 12, marginTop: 4, marginLeft: 4 },
  errorText: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  button: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  backButton: { borderWidth: 1, marginRight: 10, backgroundColor: 'transparent' },
  nextButton: { marginLeft: 10 },
  resetButton: { marginLeft: 10 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linksContainer: { marginTop: 32, alignItems: 'center', gap: 10 },
  linkText: { fontSize: 14 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: { width: width * 0.85, borderRadius: 16, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  modalButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ForgotPasswordScreen;