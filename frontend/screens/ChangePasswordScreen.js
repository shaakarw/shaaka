import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants';
import { useTheme } from '../context/ThemeContext';

export default function ChangePasswordScreen({ navigation, route, language = 'English' }) {
  const { theme } = useTheme();
  const rw = language === 'Kinyarwanda';
  const adminMode = route?.params?.adminMode === true;
  const [step, setStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const getAuthToken = async () => {
    if (adminMode) {
      const adminToken = await AsyncStorage.getItem('adminToken');
      if (adminToken) return adminToken;
    }
    return AsyncStorage.getItem('userToken');
  };

  const verifyCurrentPassword = async () => {
    if (!currentPassword) {
      setError(rw ? 'Andika ijambo banga risanzwe.' : 'Enter your current password.');
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError(rw ? 'Injira ubundi mbere.' : 'Please log in first.');
        return;
      }
      await axios.post(`${BASE_URL}/api/auth/verify-current-password`, { currentPassword }, { headers: { Authorization: `Bearer ${token}` } });
      setError('');
      setStep(2);
    } catch (error) {
      setError(error.response?.status === 401
        ? (rw ? 'Ijambo banga risanzwe si ryo.' : 'Current password is incorrect.')
        : (rw ? 'Kugenzura ijambo banga byanze.' : 'Could not verify your password.'));
    } finally { setLoading(false); }
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError(rw ? 'Andika kandi wemeze ijambo banga rishya.' : 'Enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 4 || /\s/.test(newPassword)) {
      setError(rw ? 'Ijambo banga rigomba kugira inyuguti 4 kandi ntirigire umwanya.' : 'Password must be at least 4 characters without spaces.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(rw ? 'Amagambo banga ntabwo ahuye.' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError(rw ? 'Injira ubundi mbere.' : 'Please log in first.');
        return;
      }
      await axios.put(`${BASE_URL}/api/auth/change-password`, { currentPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert(rw ? 'Byakunze' : 'Success', rw ? 'Ijambo banga ryahinduwe.' : 'Password changed successfully.');
      navigation.goBack();
    } catch (error) {
      setError(error.response?.data?.message || (rw ? 'Guhindura ijambo banga byanze.' : 'Password change failed.'));
    } finally { setLoading(false); }
  };

  const title = rw ? 'Hindura ijambobanga' : 'Change Password';
  const labels = rw ? ['Ijambo banga risanzwe', 'Ijambo banga rishya', 'Emeza ijambo banga rishya'] : ['Current password', 'New password', 'Confirm new password'];
  const renderInput = (value, setter, placeholder, visible, setVisible, ref, onSubmitEditing) => (
    <View style={[styles.inputContainer, { borderColor: error ? '#d87428' : theme.border, backgroundColor: theme.cardBackground }]}>
      <TextInput ref={ref} secureTextEntry={!visible} value={value} onChangeText={text => { setter(text.replace(/\s/g, '')); setError(''); }} placeholder={placeholder} placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} returnKeyType="next" onSubmitEditing={onSubmitEditing} />
      <TouchableOpacity onPress={() => setVisible(current => !current)}><Text style={{ color: theme.accent }}>{visible ? 'Hide' : 'Show'}</Text></TouchableOpacity>
    </View>
  );

  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    <View style={styles.stepIndicator}>{[1, 2].map(item => <View key={item} style={[styles.stepCircle, { backgroundColor: step >= item ? theme.accent : theme.border }]}><Text style={styles.stepNumber}>{item}</Text></View>)}</View>
    <Text style={[styles.stepTitle, { color: theme.textSecondary }]}>{step === 1 ? labels[0] : rw ? 'Ijambo banga rishya' : 'New Password'}</Text>
    {step === 1 ? renderInput(currentPassword, setCurrentPassword, labels[0], showCurrentPassword, setShowCurrentPassword, null, verifyCurrentPassword) : <>
      {renderInput(newPassword, setNewPassword, labels[1], showNewPassword, setShowNewPassword, newPasswordRef, () => confirmPasswordRef.current?.focus())}
      {renderInput(confirmPassword, setConfirmPassword, labels[2], showConfirmPassword, setShowConfirmPassword, confirmPasswordRef, changePassword)}
    </>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <View style={styles.buttons}>
      {step === 2 && <TouchableOpacity onPress={() => { setStep(1); setError(''); }} style={[styles.backButton, { borderColor: theme.accent }]}><Text style={{ color: theme.accent }}>{rw ? 'Subira' : 'Back'}</Text></TouchableOpacity>}
      <TouchableOpacity disabled={loading} onPress={step === 1 ? verifyCurrentPassword : changePassword} style={[styles.button, { backgroundColor: theme.accent }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{step === 1 ? (rw ? 'Ibikurikiye' : 'Next') : (rw ? 'Bika' : 'Save')}</Text>}</TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 24 }, title: { fontSize: 28, fontWeight: '700', marginBottom: 28, textAlign: 'center' }, stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 36, marginBottom: 30 }, stepCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, stepNumber: { color: '#fff', fontSize: 16, fontWeight: '700' }, stepTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 }, inputContainer: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 14 }, input: { flex: 1, fontSize: 16 }, error: { color: '#d87428', fontSize: 13, marginVertical: 8 }, buttons: { flexDirection: 'row', gap: 10, marginTop: 18 }, backButton: { flex: 1, borderWidth: 1, borderRadius: 24, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, button: { flex: 1, borderRadius: 24, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' } });
