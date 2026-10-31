
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AdminScreenHeader from '../components/AdminScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { showAdminFeedback } from '../utils/adminFeedback';
import { normalizeImageSource } from '../utils/imageUrl';


export default function AdminTutorialScreen({ navigation, language = 'English' }) {
  const { theme } = useTheme();
  const [tutorialImage, setTutorialImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEnglish = language === 'English';

  const getAdminToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('adminToken');
    if (!token) navigation.replace('AdminLogin');
    return token;
  }, [navigation]);

  const loadTutorialImage = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAdminToken();
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/api/admin/tutorial-image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Could not load the tutorial image.');
      }
      setTutorialImage(response.data.tutorialImage || null);
    } catch (requestError) {
      console.error('Could not load admin tutorial image:', requestError);
      if ([401, 403].includes(requestError.response?.status)) {
        await AsyncStorage.removeItem('adminToken');
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(
          isEnglish ? 'Could not load tutorial image' : 'Ntibyashobotse kubona ifoto y’inyigisho',
          requestError.response?.data?.message || requestError.message || 'Could not load the tutorial image.',
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getAdminToken, isEnglish, navigation]);

  useEffect(() => {
    loadTutorialImage();
  }, [loadTutorialImage]);

  const chooseImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        showAdminFeedback(
          isEnglish ? 'Photo access needed' : 'Uruhushya rw’amafoto rurakenewe',
          isEnglish ? 'Allow photo access to choose a tutorial image.' : 'Emera kureba amafoto kugira ngo uhitemo ifoto y’inyigisho.',
          'error'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const extension = (asset.uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
      const mimeTypeByExtension = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
      };
      setSelectedImage({
        uri: asset.uri,
        name: `tutorial-${Date.now()}.${extension}`,
        type: asset.mimeType || mimeTypeByExtension[extension] || 'image/jpeg',
      });
    } catch (pickerError) {
      console.error('Could not select tutorial image:', pickerError);
      showAdminFeedback(
        isEnglish ? 'Image selection failed' : 'Guhitamo ifoto ntibyashobotse',
        pickerError.message || 'Please try again.',
        'error'
      );
    }
  };

  const saveImage = async () => {
    if (!selectedImage || saving) return;
    setSaving(true);
    try {
      const token = await getAdminToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('image', selectedImage);
      const response = await axios.post(`${BASE_URL}/api/settings/tutorial-image`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success || !response.data.tutorialImage?.url) {
        throw new Error(response.data?.message || 'Tutorial image was not saved.');
      }
      setTutorialImage(response.data.tutorialImage);
      setSelectedImage(null);
      showAdminFeedback(
        isEnglish ? 'Saved' : 'Byabitswe',
        isEnglish ? 'Tutorial image saved.' : 'Ifoto y’inyigisho yabitswe.',
        'success'
      );
    } catch (saveError) {
      console.error('Could not save tutorial image:', saveError);
      if ([401, 403].includes(saveError.response?.status)) {
        await AsyncStorage.removeItem('adminToken');
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(
          isEnglish ? 'Could not save tutorial image' : 'Ntibyashobotse kubika ifoto y’inyigisho',
          saveError.response?.data?.message || saveError.message || 'Could not save the tutorial image.',
          'error'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const removeImage = () => {
    Alert.alert(
      isEnglish ? 'Remove tutorial image?' : 'Siba ifoto y’inyigisho?',
      isEnglish ? 'The tutorial page will be empty until another image is added.' : 'Urupapuro rw’inyigisho ruzaba ubusa kugeza wongeyeho indi foto.',
      [
        { text: isEnglish ? 'Cancel' : 'Hagarika', style: 'cancel' },
        {
          text: isEnglish ? 'Remove' : 'Siba',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const token = await getAdminToken();
              if (!token) return;
              const response = await axios.delete(`${BASE_URL}/api/settings/tutorial-image`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!response.data?.success) {
                throw new Error(response.data?.message || 'Tutorial image was not removed.');
              }
              setTutorialImage(null);
              setSelectedImage(null);
              showAdminFeedback(
                isEnglish ? 'Removed' : 'Yasibwe',
                isEnglish ? 'Tutorial image removed.' : 'Ifoto y’inyigisho yasibwe.',
                'success'
              );
            } catch (removeError) {
              console.error('Could not remove tutorial image:', removeError);
              if ([401, 403].includes(removeError.response?.status)) {
                await AsyncStorage.removeItem('adminToken');
                navigation.replace('AdminLogin');
              } else {
                showAdminFeedback(
                  isEnglish ? 'Could not remove tutorial image' : 'Ntibyashobotse gusiba ifoto y’inyigisho',
                  removeError.response?.data?.message || removeError.message || 'Could not remove the tutorial image.',
                  'error'
                );
              }
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const previewUri = selectedImage?.uri || tutorialImage?.url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <AdminScreenHeader
        title={isEnglish ? 'Tutorial image' : 'Ifoto y’inyigisho'}
        theme={theme}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {isEnglish
            ? 'Add one image for the tutorial page. Video uploads are not supported.'
            : 'Ongeraho ifoto imwe ku rupapuro rw’inyigisho. Amashusho y’amavidewo ntiyemewe.'}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : previewUri ? (
          <Image source={normalizeImageSource({ uri: previewUri })} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={[styles.emptyPreview, { borderColor: theme.border }]}>
            <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isEnglish ? 'No tutorial image added' : 'Nta foto y’inyigisho irashyirwaho'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.cardBackground || theme.background, borderColor: theme.border }]}
          onPress={chooseImage}
          disabled={loading || saving}
          accessibilityRole="button"
        >
          <Ionicons name="image-outline" size={20} color={theme.accent} />
          <Text style={[styles.buttonText, { color: theme.text }]}>
            {isEnglish ? 'Choose image' : 'Hitamo ifoto'}
          </Text>
        </TouchableOpacity>

        {selectedImage ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            onPress={saveImage}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{isEnglish ? 'Save image' : 'Bika ifoto'}</Text>}
          </TouchableOpacity>
        ) : null}

        {tutorialImage && !selectedImage ? (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={removeImage}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.removeButtonText}>{isEnglish ? 'Remove image' : 'Siba ifoto'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  loader: { marginVertical: 28 },
  preview: { width: '100%', height: 300, marginBottom: 16 },
  emptyPreview: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyText: { marginTop: 8, fontSize: 14 },
  button: {
    minHeight: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  removeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: '#d64545', fontWeight: '600' },
});
