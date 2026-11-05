import { getAuthToken, removeAuthToken } from '../utils/authStorage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AdminScreenHeader from '../components/AdminScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { showAdminFeedback } from '../utils/adminFeedback';
import { normalizeImageSource } from '../utils/imageUrl';

const MAX_TUTORIAL_IMAGES = 30;
const createSectionId = () => `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AdminTutorialScreen({ navigation, language = 'English' }) {
  const { theme } = useTheme();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEnglish = language === 'English';

  const getAdminToken = useCallback(async () => {
    const token = await getAuthToken('adminToken');
    if (!token) navigation.replace('AdminLogin');
    return token;
  }, [navigation]);

  const loadTutorial = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAdminToken();
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/api/admin/tutorial-image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success || !Array.isArray(response.data.sections)) {
        throw new Error(response.data?.message || 'Could not load tutorial sections.');
      }
      setSections(response.data.sections.map(section => ({
        ...section,
        images: section.images.map(image => ({ ...image })),
      })));
    } catch (requestError) {
      console.error('Could not load admin tutorial:', requestError);
      if (['session_invalidated', 'session_ended'].includes(requestError.response?.data?.reason)) {
        await removeAuthToken('adminToken');
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(
          isEnglish ? 'Could not load tutorial' : 'Ntibyashobotse kubona inyigisho',
          requestError.response?.data?.message || requestError.message || 'Could not load tutorial sections.',
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getAdminToken, isEnglish, navigation]);

  useEffect(() => {
    loadTutorial();
  }, [loadTutorial]);

  const chooseImages = async (sectionId) => {
    try {
      const currentImageCount = sections.reduce((total, section) => total + section.images.length, 0);
      const remainingImageCount = MAX_TUTORIAL_IMAGES - currentImageCount;
      if (remainingImageCount <= 0) {
        showAdminFeedback(
          isEnglish ? 'Image limit reached' : 'Umubare w’amafoto urenze',
          isEnglish ? `A tutorial can contain up to ${MAX_TUTORIAL_IMAGES} images.` : `Inyigisho ishobora kugira amafoto atarenze ${MAX_TUTORIAL_IMAGES}.`,
          'error'
        );
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        showAdminFeedback(
          isEnglish ? 'Photo access needed' : 'Uruhushya rw’amafoto rurakenewe',
          isEnglish ? 'Allow photo access to choose tutorial images.' : 'Emera kureba amafoto kugira ngo uhitemo amafoto y’inyigisho.',
          'error'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingImageCount,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      if (result.assets.length > remainingImageCount) {
        showAdminFeedback(
          isEnglish ? 'Too many images selected' : 'Wahisemo amafoto menshi',
          isEnglish
            ? `You can add ${remainingImageCount} more image${remainingImageCount === 1 ? '' : 's'} (maximum ${MAX_TUTORIAL_IMAGES} per tutorial).`
            : `Ushobora kongeramo amafoto ${remainingImageCount} (ntarenze ${MAX_TUTORIAL_IMAGES} mu nyigisho).`,
          'error'
        );
        return;
      }

      const images = result.assets.map((asset, index) => {
        const extension = (asset.uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
        const mimeTypeByExtension = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          gif: 'image/gif',
        };
        return {
          localId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          uri: asset.uri,
          name: `tutorial-${Date.now()}-${index}.${extension}`,
          type: asset.mimeType || mimeTypeByExtension[extension] || 'image/jpeg',
        };
      });
      setSections(current => current.map(section => (
        section.id === sectionId
          ? { ...section, images: [...section.images, ...images] }
          : section
      )));
    } catch (pickerError) {
      console.error('Could not select tutorial images:', pickerError);
      showAdminFeedback(
        isEnglish ? 'Image selection failed' : 'Guhitamo amafoto ntibyashobotse',
        pickerError.message || 'Please try again.',
        'error'
      );
    }
  };

  const saveTutorial = async () => {
    if (saving) return;
    const totalImageCount = sections.reduce((total, section) => total + section.images.length, 0);
    if (totalImageCount > MAX_TUTORIAL_IMAGES) {
      showAdminFeedback(
        isEnglish ? 'Too many tutorial images' : 'Amafoto y’inyigisho ni menshi',
        isEnglish ? `A tutorial can contain up to ${MAX_TUTORIAL_IMAGES} images.` : `Inyigisho ishobora kugira amafoto atarenze ${MAX_TUTORIAL_IMAGES}.`,
        'error'
      );
      return;
    }
    const untitledSection = sections.find(section => !section.title.trim());
    if (untitledSection) {
      showAdminFeedback(
        isEnglish ? 'Section title required' : 'Andika umutwe w’igice',
        isEnglish ? 'Add a title to every tutorial section before saving.' : 'Andika umutwe kuri buri gice cy’inyigisho mbere yo kubika.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const token = await getAdminToken();
      if (!token) return;

      const formData = new FormData();
      let uploadIndex = 0;
      const submittedSections = sections.map(section => ({
        id: section.id,
        title: section.title.trim(),
        images: section.images.map(image => {
          if (image.storageKey) return { storageKey: image.storageKey };
          const currentIndex = uploadIndex;
          uploadIndex += 1;
          formData.append('images', {
            uri: image.uri,
            name: image.name,
            type: image.type,
          });
          return { uploadIndex: currentIndex };
        }),
      }));
      formData.append('sections', JSON.stringify(submittedSections));

      const response = await axios.post(`${BASE_URL}/api/settings/tutorial-image`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success || !Array.isArray(response.data.sections)) {
        throw new Error(response.data?.message || 'Tutorial sections were not saved.');
      }
      setSections(response.data.sections);
      showAdminFeedback(
        isEnglish ? 'Saved' : 'Byabitswe',
        isEnglish ? 'Tutorial sections saved.' : 'Ibice by’inyigisho byabitswe.',
        'success'
      );
    } catch (saveError) {
      console.error('Could not save tutorial sections:', saveError);
      if (['session_invalidated', 'session_ended'].includes(saveError.response?.data?.reason)) {
        await removeAuthToken('adminToken');
        navigation.replace('AdminLogin');
      } else {
        showAdminFeedback(
          isEnglish ? 'Could not save tutorial' : 'Ntibyashobotse kubika inyigisho',
          saveError.response?.data?.message || saveError.message || 'Could not save tutorial sections.',
          'error'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const updateSectionTitle = (sectionId, title) => {
    setSections(current => current.map(section => (
      section.id === sectionId ? { ...section, title } : section
    )));
  };

  const removeSection = (sectionId) => {
    setSections(current => current.filter(section => section.id !== sectionId));
  };

  const removeImage = (sectionId, imageIndex) => {
    setSections(current => current.map(section => (
      section.id === sectionId
        ? { ...section, images: section.images.filter((_, index) => index !== imageIndex) }
        : section
    )));
  };

  const moveSection = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    setSections(current => {
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  };

  const confirmRemoveSection = (sectionId) => {
    Alert.alert(
      isEnglish ? 'Remove this section?' : 'Siba iki gice?',
      isEnglish ? 'Its images will be removed when you save.' : 'Amafoto yacyo azasibwa nurangiza kubika.',
      [
        { text: isEnglish ? 'Cancel' : 'Hagarika', style: 'cancel' },
        { text: isEnglish ? 'Remove' : 'Siba', style: 'destructive', onPress: () => removeSection(sectionId) },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <AdminScreenHeader
        title={isEnglish ? 'Tutorial sections' : 'Ibice by’inyigisho'}
        theme={theme}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {isEnglish
              ? `Create titled tutorial sections and add images to each (up to ${MAX_TUTORIAL_IMAGES} images total). Save to publish your changes.`
              : `Kora ibice by’inyigisho bifite imitwe wongeremo amafoto (atarenze ${MAX_TUTORIAL_IMAGES} yose). Bika kugira ngo bihite bigaragara.`}
          </Text>

          {sections.map((section, sectionIndex) => (
            <View
              key={section.id}
              style={[styles.sectionCard, { backgroundColor: theme.cardBackground || theme.background, borderColor: theme.border }]}
            >
              <View style={styles.sectionHeading}>
                <Text style={[styles.sectionNumber, { color: theme.accent }]}>
                  {isEnglish ? `Section ${sectionIndex + 1}` : `Igice ${sectionIndex + 1}`}
                </Text>
                <View style={styles.sectionActions}>
                  <TouchableOpacity
                    onPress={() => moveSection(sectionIndex, -1)}
                    disabled={sectionIndex === 0}
                    style={styles.smallAction}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Move section up' : 'Zamura igice'}
                  >
                    <Ionicons name="chevron-up" size={20} color={sectionIndex === 0 ? theme.border : theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveSection(sectionIndex, 1)}
                    disabled={sectionIndex === sections.length - 1}
                    style={styles.smallAction}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Move section down' : 'Manura igice'}
                  >
                    <Ionicons name="chevron-down" size={20} color={sectionIndex === sections.length - 1 ? theme.border : theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmRemoveSection(section.id)}
                    style={styles.smallAction}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Remove section' : 'Siba igice'}
                  >
                    <Ionicons name="trash-outline" size={19} color="#d64545" />
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                value={section.title}
                onChangeText={value => updateSectionTitle(section.id, value)}
                placeholder={isEnglish ? 'Section title, e.g. How to add a product' : 'Umutwe, urugero: Uko wongeramo igicuruzwa'}
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
                style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]}
                accessibilityLabel={isEnglish ? 'Tutorial section title' : 'Umutwe w’igice cy’inyigisho'}
              />
              {section.images.map((image, imageIndex) => (
                <View key={image.localId || image.storageKey || `${section.id}-${imageIndex}`} style={styles.imageRow}>
                  <Image source={normalizeImageSource({ uri: image.uri || image.url })} style={styles.thumbnail} resizeMode="cover" />
                  <Text style={[styles.imageLabel, { color: theme.textSecondary }]}>
                    {isEnglish ? `Image ${imageIndex + 1}` : `Ifoto ${imageIndex + 1}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeImage(section.id, imageIndex)}
                    style={styles.smallAction}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Remove image' : 'Siba ifoto'}
                  >
                    <Ionicons name="close-circle" size={22} color="#d64545" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: theme.border }]}
                onPress={() => chooseImages(section.id)}
                disabled={saving}
                accessibilityRole="button"
              >
                <Ionicons name="images-outline" size={19} color={theme.accent} />
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  {isEnglish ? 'Add images' : 'Ongeramo amafoto'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.outlineButton, styles.addSectionButton, { borderColor: theme.accent }]}
            onPress={() => setSections(current => [...current, {
              id: createSectionId(),
              title: '',
              images: [],
            }])}
            disabled={saving}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={21} color={theme.accent} />
            <Text style={[styles.buttonText, { color: theme.accent }]}>
              {isEnglish ? 'Add tutorial section' : 'Ongeramo igice cy’inyigisho'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.accent }]}
            onPress={saveTutorial}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.saveButtonText}>
                {isEnglish ? 'Save tutorial' : 'Bika inyigisho'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 36 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  sectionCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionNumber: { fontSize: 14, fontWeight: '700' },
  sectionActions: { flexDirection: 'row', alignItems: 'center' },
  smallAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleInput: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 },
  imageRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  thumbnail: { width: 52, height: 52, borderRadius: 6, backgroundColor: '#e5e7eb' },
  imageLabel: { flex: 1, fontSize: 14, marginHorizontal: 12 },
  outlineButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  addSectionButton: { marginTop: 2, marginBottom: 14 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  saveButton: { minHeight: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
