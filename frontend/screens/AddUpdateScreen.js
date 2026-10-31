// screens/AddUpdateScreen.js
//
// NOTE ON DEPENDENCIES:
// This redesign uses gradients (matching the reference design), which requires
// expo-linear-gradient. If it isn't already in the project, install it with:
//   npx expo install expo-linear-gradient
//
// NOTE ON THE API:
// Editing a note assumes a PUT endpoint at the same path used for delete, e.g.
//   PUT {BASE_URL}{base}/{noteId}   body: { text }
// If your backend uses PATCH instead of PUT, change the verb in handleSaveNote().

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import ShaakaLoadingScreen from '../components/ShaakaLoadingScreen';
import { showAdminFeedback } from '../utils/adminFeedback';

// ---------- Design tokens (NEUTRAL GRAYSCALE) ----------
// Primary action gradient (gray → dark gray)
const PRIMARY_GRADIENT = ['#9ca3af', '#4b5563'];
// Danger action gradient (dark gray → black)
const DANGER_GRADIENT = ['#6b7280', '#1f2937'];
// Success action gradient (medium gray → dark gray)
const SUCCESS_GRADIENT = ['#6b7280', '#374151'];

// Pastel gradient palette cycled across note cards – now in grayscale
const CARD_GRADIENTS = [
  ['#e5e7eb', '#9ca3af'], // light gray → medium gray
  ['#d1d5db', '#6b7280'], // cool gray → dark gray
  ['#f3f4f6', '#9ca3af'], // very light gray → medium gray
  ['#e5e7eb', '#6b7280'], // light gray → dark gray
  ['#d1d5db', '#4b5563'], // cool gray → nearly black
];

const getGradientForId = (id) => {
  if (!id) return CARD_GRADIENTS[0];
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash + str.charCodeAt(i)) % CARD_GRADIENTS.length;
  }
  return CARD_GRADIENTS[hash];
};

// ---------- Translations (unchanged) ----------
const translations = {
  English: {
    myUpdates: 'My Updates',
    adminUpdates: 'Admin Updates',
    addNote: 'Add Note',
    editNote: 'Edit Note',
    title: 'Title',
    message: 'Message (optional)',
    save: 'Save',
    update: 'Update',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this note?',
    deleteSelectedConfirm: 'Are you sure you want to delete the selected notes?',
    noteSaved: 'Note saved successfully!',
    noteUpdated: 'Note updated successfully!',
    noteDeleted: 'Note deleted successfully!',
    notesDeleted: 'Selected notes deleted successfully!',
    titleRequired: 'Title is required',
    enterTitle: 'Please enter a title for your note.',
    error: 'Error',
    failedToSave: 'Failed to save note. Please try again.',
    failedToUpdate: 'Failed to update note. Please try again.',
    failedToDelete: 'Failed to delete note. Please try again.',
    failedToDeleteSelected: 'Failed to delete selected notes. Please try again.',
    noNotes: 'No notes yet. Tap + to add one.',
    ok: 'OK',
    success: 'Success',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading...',
    select: 'Select',
    cancelSelect: 'Cancel',
    deleteSelected: 'Delete Selected',
    selectedCount: '{count} selected',
    notesCount: '{count} notes',
    appShareLink: 'App Share Link',
    appShareLinkDescription: 'This link is included when users share posts, places, or shops.',
    shareLinkPlaceholder: 'https://example.com/app',
    saveShareLink: 'Save Share Link',
    shareLinkSaved: 'Share link saved successfully',
    shareLinkSaveFailed: 'Unable to save share link',
  },
  Kinyarwanda: {
    myUpdates: 'Amakuru yanjye',
    adminUpdates: 'Amakuru ya Admin',
    addNote: 'Ongeraho ikindi',
    editNote: 'Hindura icyanditswe',
    title: 'Umutwe',
    message: 'Ubutumwa (bishakiwe)',
    save: 'Bika',
    update: 'Vugurura',
    cancel: 'Reka',
    delete: 'Siba',
    deleteConfirm: 'Uri kwizera ko ushaka gusiba iki kindi?',
    deleteSelectedConfirm: 'Uri kwizera ko ushaka gusiba amakuru yatoranijwe?',
    noteSaved: 'Ikindi cyabitswe neza!',
    noteUpdated: 'Ikindi cyahinduwe neza!',
    noteDeleted: 'Ikindi cyasibwe neza!',
    notesDeleted: 'Amakuru yatoranijwe yasibwe neza!',
    titleRequired: 'Umutwe urakenewe',
    enterTitle: 'Nyamuneka andika umutwe w’ikindi.',
    error: 'Ikibazo',
    failedToSave: 'Ntabwo byashobotse kubika. Ongera ugerageze.',
    failedToUpdate: 'Ntabwo byashobotse kuvugurura. Ongera ugerageze.',
    failedToDelete: 'Ntabwo byashobotse gusiba. Ongera ugerageze.',
    failedToDeleteSelected: 'Ntabwo byashobotse gusiba amakuru yatoranijwe. Ongera ugerageze.',
    noNotes: 'Nta kindi kiriho. Kanda + kongeramo.',
    ok: 'Sawa',
    success: 'Byakunze',
    yes: 'Yego',
    no: 'Oya',
    loading: 'Birimo...',
    select: 'Hitamo',
    cancelSelect: 'Reka guhitamo',
    deleteSelected: 'Siba ibyatoranijwe',
    selectedCount: '{count} byatoranijwe',
    notesCount: '{count} amakuru',
    appShareLink: 'Link yo gusangiza porogaramu',
    appShareLinkDescription: 'Iyi link ikoreshwa abakoresha basangiza inyandiko, ahantu cyangwa amaduka.',
    shareLinkPlaceholder: 'https://example.com/app',
    saveShareLink: 'Bika link yo gusangiza',
    shareLinkSaved: 'Link yo gusangiza yabitswe neza',
    shareLinkSaveFailed: 'Ntibishobotse kubika link yo gusangiza',
  },
};

const AddUpdateScreen = ({ navigation, language }) => {
  const { theme } = useTheme();
  const route = useRoute();
  const isAdmin = route.params?.isAdmin || false;
  const t = translations[language] || translations.English;

  // ---------- State (unchanged) ----------
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState([]);

  // Add / Edit form modal (shared)
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formLink, setFormLink] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null); // null => add mode
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal state (single)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Batch delete confirmation
  const [batchDeleteModalVisible, setBatchDeleteModalVisible] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Success/Error modal (themed)
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusTitle, setStatusTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const notify = useCallback((title, message, type = 'error') => {
    if (isAdmin) {
      showAdminFeedback(title, message, type);
    } else if (type === 'success') {
      setStatusTitle(title);
      setStatusMessage(message);
      setStatusModalVisible(true);
    } else {
      Alert.alert(title, message);
    }
  }, [isAdmin]);

  // ---------- Token & endpoint helpers (unchanged) ----------
  const getToken = async () => {
    if (isAdmin) {
      return await AsyncStorage.getItem('adminToken');
    } else {
      return await AsyncStorage.getItem('userToken');
    }
  };

  const getApiBase = () => {
    return isAdmin ? '/api/notes' : '/api/user/notes';
  };

  // ---------- Fetch notes (unchanged) ----------
  const fetchNotes = useCallback(async () => {
    try {
      const token = await getToken();
      const base = getApiBase();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(`${BASE_URL}${base}`, { headers });
      if (response.data.success) {
        setNotes(response.data.notes || []);
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error('Fetch notes error:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        if (isAdmin) {
          await AsyncStorage.removeItem('adminToken');
          navigation.replace('AdminLogin');
        } else {
          await AsyncStorage.removeItem('userToken');
          navigation.replace('Login');
        }
      }
      notify(t.error, t.failedToSave, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, navigation, notify, t]);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
      fetchShareLink();
    }, [fetchNotes, fetchShareLink])
  );

  // ---------- Add / Edit form modal helpers (unchanged) ----------
  const fetchShareLink = useCallback(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/settings/share-link`);
      if (response.data.success) {
        setShareLink(response.data.shareLink || '');
      }
    } catch (error) {
      console.error('Failed to load share link:', error.message);
    }
  }, []);

  const saveShareLink = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        notify(t.error, isAdmin ? 'Please login as admin.' : 'Please login first.', 'error');
        return;
      }

      setShareLinkLoading(true);
      const response = await axios.put(
        `${BASE_URL}/api/settings/share-link`,
        { shareLink: shareLink.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setShareLink(response.data.shareLink || '');
        notify(t.success, t.shareLinkSaved, 'success');
      } else {
        notify(t.error, response.data.message || t.shareLinkSaveFailed, 'error');
      }
    } catch (error) {
      console.error('Save share link error:', error.response?.data || error.message);
      notify(t.error, t.shareLinkSaveFailed, 'error');
    } finally {
      setShareLinkLoading(false);
    }
  }, [shareLink, getToken, t, isAdmin, notify]);

  const openAddModal = () => {
    setFormTitle('');
    setFormMessage('');
    setFormLink('');
    setEditingNoteId(null);
    setFormModalVisible(true);
  };

  const openEditModal = (note) => {
    const parts = (note.text || '').split('\n');
    const titlePart = parts[0] || '';
    const messagePart = parts.slice(1).join('\n');
    setFormTitle(titlePart);
    setFormMessage(messagePart);
    setFormLink(note.link || '');
    setEditingNoteId(note._id);
    setFormModalVisible(true);
  };

  const closeFormModal = () => {
    setFormModalVisible(false);
    setFormLink('');
  };

  // ---------- Save note (handles both add + edit) (unchanged) ----------
  const handleSaveNote = async () => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      notify(t.titleRequired, t.enterTitle, 'error');
      return;
    }

    const isEditing = !!editingNoteId;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        notify(t.error, isAdmin ? 'Please login as admin.' : 'Please login first.', 'error');
        setSaving(false);
        return;
      }

      const fullText = trimmedTitle + (formMessage.trim() ? '\n' + formMessage.trim() : '');
      const base = getApiBase();
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        text: fullText,
        link: formLink.trim(),
      };

      const response = isEditing
        ? await axios.put(`${BASE_URL}${base}/${editingNoteId}`, payload, { headers })
        : await axios.post(`${BASE_URL}${base}`, payload, { headers });

      if (response.data.success) {
        notify(t.success, isEditing ? t.noteUpdated : t.noteSaved, 'success');
        setFormModalVisible(false);
        setFormTitle('');
        setFormMessage('');
        setFormLink('');
        setEditingNoteId(null);
        fetchNotes();
      } else {
        notify(t.error, response.data.message || (isEditing ? t.failedToUpdate : t.failedToSave), 'error');
      }
    } catch (error) {
      console.error('Save note error:', error.response?.data || error.message);
      notify(t.error, isEditing ? t.failedToUpdate : t.failedToSave, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete single note (unchanged) ----------
  const confirmDelete = (noteId) => {
    setSelectedNoteId(noteId);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) {
        notify(t.error, isAdmin ? 'Please login as admin.' : 'Please login first.', 'error');
        setDeleting(false);
        return;
      }

      const base = getApiBase();
      const response = await axios.delete(`${BASE_URL}${base}/${selectedNoteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setDeleteModalVisible(false);
        setSelectedNoteId(null);
        notify(t.success, t.noteDeleted, 'success');
        fetchNotes();
      } else {
        notify(t.error, response.data.message || t.failedToDelete, 'error');
      }
    } catch (error) {
      console.error('Delete note error:', error.response?.data || error.message);
      notify(t.error, t.failedToDelete, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ---------- Batch delete (unchanged) ----------
  const confirmBatchDelete = () => {
    if (selectedNotes.length === 0) return;
    setBatchDeleteModalVisible(true);
  };

  const handleBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      const token = await getToken();
      if (!token) {
        notify(t.error, isAdmin ? 'Please login as admin.' : 'Please login first.', 'error');
        setBatchDeleting(false);
        return;
      }

      const base = getApiBase();
      const deletePromises = selectedNotes.map((noteId) =>
        axios.delete(`${BASE_URL}${base}/${noteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      await Promise.all(deletePromises);

      setBatchDeleteModalVisible(false);
      setSelectedNotes([]);
      setSelectionMode(false);
      notify(t.success, t.notesDeleted, 'success');
      fetchNotes();
    } catch (error) {
      console.error('Batch delete error:', error.response?.data || error.message);
      notify(t.error, t.failedToDeleteSelected, 'error');
    } finally {
      setBatchDeleting(false);
    }
  };

  // ---------- Selection toggle (unchanged) ----------
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedNotes([]);
    } else {
      setSelectionMode(true);
      setSelectedNotes([]);
    }
  };

  const toggleNoteSelection = (noteId) => {
    if (selectedNotes.includes(noteId)) {
      setSelectedNotes(selectedNotes.filter((id) => id !== noteId));
    } else {
      setSelectedNotes([...selectedNotes, noteId]);
    }
  };

  // ---------- Render note card (gradient "stacked collection" style) ----------
  const renderNoteCard = ({ item }) => {
    const title = item.text?.split('\n')[0] || 'Note';
    const preview = item.text?.split('\n').slice(1).join('\n') || '';
    const isSelected = selectedNotes.includes(item._id);
    const gradientColors = getGradientForId(item._id);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.stackWrapper}
        onPress={() => {
          if (selectionMode) toggleNoteSelection(item._id);
        }}
      >
        {/* Peeking layers behind the front card, for the "stack" depth effect */}
        <View style={[styles.stackLayer, styles.stackLayerBack, { backgroundColor: gradientColors[1] }]} />
        <View style={[styles.stackLayer, styles.stackLayerMid, { backgroundColor: gradientColors[0] }]} />

        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.stackFront, isSelected && styles.stackFrontSelected]}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardIconBadge}>
              <Ionicons name="document-text" size={16} color="#fff" />
            </View>

            {selectionMode ? (
              <TouchableOpacity
                style={styles.cardIconBtn}
                onPress={() => toggleNoteSelection(item._id)}
              >
                <Ionicons name={isSelected ? 'checkbox' : 'checkbox-outline'} size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.cardActionsRow}>
                <TouchableOpacity style={styles.cardIconBtn} onPress={() => openEditModal(item)}>
                  <Ionicons name="pencil" size={15} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardIconBtn, { marginLeft: 8 }]}
                  onPress={() => confirmDelete(item._id)}
                >
                  <Ionicons name="trash-outline" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          {preview ? (
            <Text style={styles.cardPreview} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}

          {item.link ? (
            <TouchableOpacity
              style={styles.cardLinkRow}
              onPress={() => Linking.openURL(item.link).catch(() => notify('Invalid link', 'Unable to open this link.', 'error'))}
            >
              <Ionicons name="link" size={14} color="#fff" />
              <Text style={styles.cardLinkText} numberOfLines={1}>
                {item.link.replace(/^https?:\/\//, '')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.cardDatePill}>
            <Text style={styles.cardDateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderShareLinkSection = () => (
    <View style={[styles.shareLinkSection, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={styles.shareLinkHeader}>
        <LinearGradient colors={PRIMARY_GRADIENT} style={styles.shareLinkIconBadge}>
          <Ionicons name="share-social-outline" size={18} color="#fff" />
        </LinearGradient>
        <Text style={[styles.shareLinkTitle, { color: theme.text }]}>{t.appShareLink}</Text>
      </View>
      <Text style={[styles.shareLinkDescription, { color: theme.textSecondary }]}>
        {t.appShareLinkDescription}
      </Text>
      <TextInput
        style={[
          styles.shareLinkInput,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
        ]}
        placeholder={t.shareLinkPlaceholder}
        placeholderTextColor={theme.textSecondary}
        value={shareLink}
        onChangeText={setShareLink}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
      />
      <TouchableOpacity
        style={styles.fullGradientWrapper}
        onPress={saveShareLink}
        disabled={shareLinkLoading}
      >
        <LinearGradient
          colors={PRIMARY_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fullGradientButton}
        >
          {shareLinkLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.gradientButtonText}>{t.saveShareLink}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ---------- Status modal (themed) ----------
  const renderStatusModal = () => (
    <Modal
      transparent
      visible={statusModalVisible}
      animationType="fade"
      onRequestClose={() => setStatusModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <LinearGradient colors={SUCCESS_GRADIENT} style={styles.iconBadge}>
            <Ionicons name="checkmark" size={26} color="#fff" />
          </LinearGradient>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{statusTitle}</Text>
          <Text style={[styles.modalText, { color: theme.textSecondary }]}>{statusMessage}</Text>
          <TouchableOpacity style={styles.fullGradientWrapper} onPress={() => setStatusModalVisible(false)}>
            <LinearGradient colors={PRIMARY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fullGradientButton}>
              <Text style={styles.gradientButtonText}>{t.ok}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ---------- Delete confirmation modal (single) ----------
  const renderDeleteModal = () => (
    <Modal
      transparent
      visible={deleteModalVisible}
      animationType="fade"
      onRequestClose={() => setDeleteModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <LinearGradient colors={DANGER_GRADIENT} style={styles.iconBadge}>
            <Ionicons name="trash" size={22} color="#fff" />
          </LinearGradient>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{t.delete}</Text>
          <Text style={[styles.modalText, { color: theme.textSecondary }]}>{t.deleteConfirm}</Text>
          <View style={styles.confirmButtonsRow}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setDeleteModalVisible(false)}
            >
              <Text style={[styles.confirmButtonText, { color: theme.textSecondary }]}>{t.no}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gradientButtonWrapper} onPress={handleDelete} disabled={deleting}>
              <LinearGradient colors={DANGER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.gradientButtonText}>{t.yes}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ---------- Batch delete confirmation modal ----------
  const renderBatchDeleteModal = () => (
    <Modal
      transparent
      visible={batchDeleteModalVisible}
      animationType="fade"
      onRequestClose={() => setBatchDeleteModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <LinearGradient colors={DANGER_GRADIENT} style={styles.iconBadge}>
            <Ionicons name="trash" size={22} color="#fff" />
          </LinearGradient>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{t.delete}</Text>
          <Text style={[styles.modalText, { color: theme.textSecondary }]}>
            {t.deleteSelectedConfirm.replace('{count}', selectedNotes.length)}
          </Text>
          <View style={styles.confirmButtonsRow}>
            <TouchableOpacity
              style={[styles.confirmButton, styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setBatchDeleteModalVisible(false)}
            >
              <Text style={[styles.confirmButtonText, { color: theme.textSecondary }]}>{t.no}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gradientButtonWrapper} onPress={handleBatchDelete} disabled={batchDeleting}>
              <LinearGradient colors={DANGER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                {batchDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.gradientButtonText}>{t.yes}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ---------- Add / Edit form modal ----------
  const renderFormModal = () => {
    const isEditing = !!editingNoteId;
    const combinedCount = (formTitle + formMessage).length;

    return (
      <Modal transparent visible={formModalVisible} animationType="slide" onRequestClose={closeFormModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formBadgeRow}>
                <LinearGradient colors={PRIMARY_GRADIENT} style={styles.formBadgeIcon}>
                  <Ionicons name={isEditing ? 'create' : 'sparkles'} size={13} color="#fff" />
                </LinearGradient>
                <Text style={[styles.formBadgeLabel, { color: theme.text }]}>
                  {(isEditing ? t.editNote : t.addNote).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.formCounter, { color: theme.textSecondary }]}>{combinedCount}/300</Text>
            </View>

            <TextInput
              style={[styles.formTitleInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder={t.title}
              placeholderTextColor={theme.textSecondary}
              value={formTitle}
              onChangeText={setFormTitle}
              maxLength={80}
            />

            <TextInput
              style={[
                styles.formMessageInput,
                { color: theme.text, backgroundColor: theme.cardBackground, borderColor: theme.border },
              ]}
              placeholder={t.message}
              placeholderTextColor={theme.textSecondary}
              value={formMessage}
              onChangeText={setFormMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />

            <TextInput
              style={[
                styles.formTitleInput,
                { color: theme.text, borderBottomColor: theme.border, marginTop: 12 },
              ]}
              placeholder="Optional link"
              placeholderTextColor={theme.textSecondary}
              value={formLink}
              onChangeText={setFormLink}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="done"
            />

            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton, { borderColor: theme.border }]}
                onPress={closeFormModal}
              >
                <Text style={[styles.confirmButtonText, { color: theme.textSecondary }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gradientButtonWrapper} onPress={handleSaveNote} disabled={saving}>
                <LinearGradient colors={PRIMARY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name={isEditing ? 'checkmark' : 'add'} size={17} color="#fff" />
                      <Text style={styles.gradientButtonText}>{isEditing ? t.update : t.save}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ---------- Loading state ----------
  if (loading) {
    return <ShaakaLoadingScreen message={t.loading} backgroundColor={theme.background} textColor={theme.textSecondary} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerIconBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        >
          <Ionicons name="arrow-back" size={19} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {isAdmin ? t.adminUpdates : t.myUpdates}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {t.notesCount.replace('{count}', notes.length)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={toggleSelectionMode}
          style={[styles.headerIconBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        >
          <Ionicons
            name={selectionMode ? 'close' : 'checkbox-outline'}
            size={19}
            color={selectionMode ? '#ff3b30' : theme.text}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={openAddModal} style={styles.headerAddBtnWrapper}>
          <LinearGradient colors={PRIMARY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerAddBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Notes List */}
      <FlatList
        data={notes}
        keyExtractor={(item, index) => (item._id ? String(item._id) : String(index))}
        renderItem={renderNoteCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={isAdmin ? renderShareLinkSection : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchNotes} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LinearGradient colors={CARD_GRADIENTS[1]} style={styles.emptyIconWrapper}>
              <Ionicons name="document-text-outline" size={40} color="#fff" />
            </LinearGradient>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noNotes}</Text>
          </View>
        }
      />

      {/* Floating bottom bar for batch delete (only in selection mode) */}
      {selectionMode && selectedNotes.length > 0 && (
        <View style={styles.bottomBarWrapper}>
          <View style={[styles.bottomBar, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Text style={[styles.selectedCount, { color: theme.text }]}>
              {t.selectedCount.replace('{count}', selectedNotes.length)}
            </Text>
            <TouchableOpacity onPress={confirmBatchDelete}>
              <LinearGradient colors={DANGER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.batchDeleteButton}>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.batchDeleteText}>{t.deleteSelected}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals */}
      {renderFormModal()}
      {renderDeleteModal()}
      {renderBatchDeleteModal()}
      {renderStatusModal()}
    </SafeAreaView>
  );
};

// ---------- Styles (only colors changed to grayscale) ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },

  // ----- Header -----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitleWrap: { flex: 1, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  headerAddBtnWrapper: {
    shadowColor: '#4b5563', // dark gray shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    borderRadius: 19,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ----- List -----
  listContent: { padding: 16, paddingTop: 4, paddingBottom: 90 },
  shareLinkSection: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  shareLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareLinkIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  shareLinkTitle: { fontSize: 16, fontWeight: '800' },
  shareLinkDescription: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  shareLinkInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 12,
  },

  // ----- Stacked gradient note card (grayscale) -----
  stackWrapper: { marginBottom: 24, paddingTop: 16 },
  stackLayer: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 116,
    borderRadius: 22,
  },
  stackLayerBack: { top: 0, opacity: 0.4 },
  stackLayerMid: { top: 8, left: 7, right: 7, opacity: 0.7 },
  stackFront: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    minHeight: 116,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  stackFrontSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionsRow: { flexDirection: 'row' },
  cardIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' }, // dark gray (unchanged – works on light gradients)
  cardPreview: { fontSize: 13, color: 'rgba(31,41,55,0.75)', marginBottom: 10, lineHeight: 18 },
  cardDatePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardDateText: { fontSize: 11, fontWeight: '600', color: '#1f2937' },

  // ----- Empty state -----
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 90,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },

  // ----- Bottom batch-delete bar -----
  bottomBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  selectedCount: { fontSize: 15, fontWeight: '600' },
  batchDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  batchDeleteText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },

  // ----- Modals (shared) -----
  modalOverlay: {
    flex: 1,
    marginTop: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 0.5,
    alignItems: 'center',
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  fullGradientWrapper: {
    width: '100%',
    borderRadius: 14,
    shadowColor: '#4b5563',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fullGradientButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // ----- Add / Edit form modal -----
  formCard: {
    width: '88%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 0.5,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  formBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  formBadgeLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  formCounter: { fontSize: 12, fontWeight: '500' },
  formTitleInput: {
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 14,
  },
  cardLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLinkText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#fff',
    maxWidth: 180,
  },
  formMessageInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    height: 110,
    marginBottom: 18,
  },

  // ----- Shared confirm-row + gradient buttons -----
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  gradientButtonWrapper: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    shadowColor: '#4b5563',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 6,
  },
});

export default AddUpdateScreen;