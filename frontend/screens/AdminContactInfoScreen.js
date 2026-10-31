import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import AdminScreenHeader from '../components/AdminScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { DEFAULT_CONTACT_INFO } from '../services/contactInfo';
import { showAdminFeedback } from '../utils/adminFeedback';

const CONTACT_FIELDS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'Instagram profile URL or username', keyboardType: 'url' },
  { key: 'twitter', label: 'X / Twitter', placeholder: 'X profile URL or username', keyboardType: 'url' },
  { key: 'youtube', label: 'YouTube', placeholder: 'YouTube channel URL or handle', keyboardType: 'url' },
  { key: 'facebook', label: 'Facebook', placeholder: 'Facebook profile URL', keyboardType: 'url' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'TikTok profile URL or username', keyboardType: 'url' },
  { key: 'email', label: 'Email', placeholder: 'support@example.com', keyboardType: 'email-address' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'Phone number or WhatsApp link', keyboardType: 'phone-pad' },
  { key: 'phone', label: 'Phone', placeholder: '+250...', keyboardType: 'phone-pad' },
  { key: 'alternatePhone', label: 'Alternate phone', placeholder: '+250...', keyboardType: 'phone-pad' },
  { key: 'website', label: 'Website', placeholder: 'https://example.com', keyboardType: 'url' },
  { key: 'other', label: 'Other contact link', placeholder: 'https://example.com/contact', keyboardType: 'url' },
];

export default function AdminContactInfoScreen({ navigation, language = 'English' }) {
  const { theme } = useTheme();
  const [contactInfo, setContactInfo] = useState(DEFAULT_CONTACT_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEnglish = language === 'English';

  const getAdminToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('adminToken');
    if (!token) navigation.replace('AdminLogin');
    return token;
  }, [navigation]);

  const loadContactInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/settings/contact-info`);
      if (!response.data?.success || !response.data.contactInfo) {
        throw new Error(response.data?.message || 'Could not load contact information.');
      }
      setContactInfo({ ...DEFAULT_CONTACT_INFO, ...response.data.contactInfo });
    } catch (error) {
      console.error('Could not load admin contact information:', error);
      showAdminFeedback(
        isEnglish ? 'Could not load contact information' : 'Ntibyashobotse kubona amakuru y’aho twabariza',
        error.response?.data?.message || error.message || 'Could not load contact information.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [isEnglish]);

  useEffect(() => {
    loadContactInfo();
  }, [loadContactInfo]);

  const updateField = (key, value) => {
    setContactInfo(current => ({ ...current, [key]: value }));
  };

  const saveContactInfo = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await getAdminToken();
      if (!token) return;
      const response = await axios.put(
        `${BASE_URL}/api/settings/contact-info`,
        { contactInfo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.data?.success || !response.data.contactInfo) {
        throw new Error(response.data?.message || 'Contact information was not saved.');
      }
      setContactInfo({ ...DEFAULT_CONTACT_INFO, ...response.data.contactInfo });
      showAdminFeedback(
        isEnglish ? 'Saved' : 'Byabitswe',
        isEnglish ? 'Contact information updated across the app.' : 'Amakuru y’aho twabariza yahinduwe muri porogaramu.',
        'success'
      );
    } catch (error) {
      console.error('Could not save admin contact information:', error);
      if ([401, 403].includes(error.response?.status)) {
        await AsyncStorage.removeItem('adminToken');
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(
          isEnglish ? 'Could not save contact information' : 'Ntibyashobotse kubika amakuru y’aho twabariza',
          error.response?.data?.message || error.message || 'Could not save contact information.',
          'error'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <AdminScreenHeader
        title={isEnglish ? 'Contact information' : 'Amakuru y’aho twabariza'}
        theme={theme}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {isEnglish
              ? 'Update the links and phone numbers shown in Settings, the buy-post feed, Messages, and How It Works.'
              : 'Hindura imiyoboro na telefone bigaragara muri Igenamiterere, ku bicuruzwa, mu butumwa no muri Uko bikora.'}
          </Text>
          {CONTACT_FIELDS.map(field => (
            <View key={field.key} style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>{field.label}</Text>
              <TextInput
                value={contactInfo[field.key] || ''}
                onChangeText={value => updateField(field.key, value)}
                placeholder={field.placeholder}
                placeholderTextColor={theme.textSecondary}
                keyboardType={field.keyboardType}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={300}
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.cardBackground || theme.background, borderColor: theme.border },
                ]}
              />
            </View>
          ))}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.accent }]}
            onPress={saveContactInfo}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveButtonText}>{isEnglish ? 'Save contact information' : 'Bika amakuru'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  loader: { marginTop: 32 },
  field: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  saveButton: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
