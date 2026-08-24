// screens/AdminBusinessAddScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { normalizeRwandaPhone, isValidRwandaPhone, formatPhoneInput } from '../utils/phoneNormalizer';

// ---------- Full Translations ----------
const translations = {
  English: {
    jobsTab: 'Jobs',
    skillsTab: 'Skills',
    businessTab: 'Business',
    noData: 'No items yet.',
    addNew: 'Add New',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    ok: 'OK',
    back: 'Back',
    refresh: 'Refresh',
    loginRequired: 'Admin login required.',
    failedToFetch: 'Could not load data.',
    failedToSave: 'Failed to save. Please try again.',
    deleteConfirm: 'Delete Item',
    deleteMessage: 'Are you sure you want to delete "{name}"?',
    success: 'Success',
    itemCreated: '{type} created successfully.',
    itemUpdated: '{type} updated successfully.',
    itemDeleted: '{type} deleted.',
    step: 'Step {current} of {total}',
    next: 'Next',
    previous: 'Previous',
    save: 'Save',
    saving: 'Saving...',
    jobTitle: 'Job Title *',
    company: 'Company *',
    district: 'District *',
    salary: 'Salary',
    experience: 'Experience Required',
    education: 'Education Level',
    deadline: 'Application Deadline',
    contactPhone: 'Contact Phone',
    contactWhatsapp: 'WhatsApp Number',
    contactEmail: 'Contact Email',
    website: 'Website Link',
    linkedin: 'LinkedIn Link',
    skillName: 'Skill / Course Name *',
    level: 'Level',
    duration: 'Duration',
    certification: 'Certification',
    courseType: 'Course Type',
    free: 'Free',
    paid: 'Paid',
    businessName: 'Business Idea Name *',
    category: 'Category',
    startupCost: 'Startup Cost',
    estimatedProfit: 'Estimated Profit',
    riskLevel: 'Risk Level',
    timeToLaunch: 'Time to Launch',
    stepsLabel: 'Steps / Notes (one per line)',
    typeJob: 'Job',
    typeSkill: 'Skill',
    typeBusiness: 'Business idea',
  },
  Kinyarwanda: {
    jobsTab: 'Akazi',
    skillsTab: 'Ubumenyi',
    businessTab: 'Ubucuruzi',
    noData: 'Nta makuru ahari.',
    addNew: 'Ongeraho',
    edit: 'Hindura',
    delete: 'Siba',
    cancel: 'Guhagarika',
    ok: 'Sawa',
    back: 'Subira',
    refresh: 'Ongera gukura',
    loginRequired: 'Ugomba kwinjira nka admin.',
    failedToFetch: 'Ntibishoboye gukura amakuru.',
    failedToSave: 'Ntabwo byabitswe. Ongera ugerageze.',
    deleteConfirm: 'Siba Ikintu',
    deleteMessage: 'Urabyemera gusiba "{name}"?',
    success: 'Byakunze',
    itemCreated: '{type} byakozwe neza.',
    itemUpdated: '{type} byavuguruwe neza.',
    itemDeleted: '{type} byasibwe.',
    step: 'Intambwe {current} kuri {total}',
    next: 'Ibikurikira',
    previous: 'Ibyabanjirije',
    save: 'Bika',
    saving: 'Birimo kubika...',
    jobTitle: "Izina ry'akazi *",
    company: 'Isosiyete *',
    district: 'Akarere *',
    salary: 'Umushahara',
    experience: 'Ubunararibonye busabwa',
    education: 'Amashuri',
    deadline: 'Itariki ntarengwa',
    contactPhone: 'Telefone',
    contactWhatsapp: 'WhatsApp',
    contactEmail: 'Imeyili',
    website: 'Urubuga',
    linkedin: 'LinkedIn',
    skillName: "Izina ry'ubumenyi *",
    level: 'Urwego',
    duration: 'Igihe',
    certification: 'Impamyabumenyi',
    courseType: "Ubwoko bw'amasomo",
    free: 'Ubuntu',
    paid: 'Yishyurwa',
    businessName: "Izina ry'igitekerezo *",
    category: 'Icyiciro',
    startupCost: 'Igishoro',
    estimatedProfit: 'Inyungu yitezwe',
    riskLevel: 'Ingorane',
    timeToLaunch: 'Igihe cyo gutangira',
    stepsLabel: 'Intambwe (umurongo umwe kuri buri ntambwe)',
    typeJob: 'Akazi',
    typeSkill: 'Ubumenyi',
    typeBusiness: 'Igitekerezo',
  },
};

const API_ENDPOINTS = {
  jobs: '/api/business-ideas/admin/jobs',
  skills: '/api/business-ideas/admin/skills',
  business: '/api/business-ideas/admin/business-ideas',
};

const AdminBusinessAddScreen = ({ navigation, language = 'English' }) => {
  const { theme } = useTheme();
  const t = translations[language] || translations.English;

  const [activeTab, setActiveTab] = useState('jobs');
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const getToken = async () => AsyncStorage.getItem('adminToken');

  const fetchItems = useCallback(async () => {
    setLoadingList(true);
    try {
      const token = await getToken();
      if (!token) {
        navigation.replace('AdminLogin', { language });
        return;
      }

      // Public read endpoints for list retrieval
      let readUrl = `${BASE_URL}`;
      if (activeTab === 'jobs') readUrl += '/api/business-ideas/job-openings';
      else if (activeTab === 'skills') readUrl += '/api/business-ideas/skill-courses';
      else readUrl += '/api/business-ideas'; // business ideas

      const response = await axios.get(readUrl);

      // Normalize many possible backend shapes
      let data = [];
      if (Array.isArray(response.data)) data = response.data;
      else if (Array.isArray(response.data?.data)) data = response.data.data;
      else if (Array.isArray(response.data?.items)) data = response.data.items;
      else if (Array.isArray(response.data?.jobs)) data = response.data.jobs;
      else if (Array.isArray(response.data?.skills)) data = response.data.skills;
      else if (Array.isArray(response.data?.businessIdeas)) data = response.data.businessIdeas;
      else if (Array.isArray(response.data?.results)) data = response.data.results;
      else if (response.data?.success && Array.isArray(response.data?.payload)) data = response.data.payload;
      else if (response.data) {
        const firstArray = Object.values(response.data).find((v) => Array.isArray(v));
        if (firstArray) data = firstArray;
      }

      setItems(data);
    } catch (error) {
      console.error('Fetch error:', error?.response?.data || error?.message || error);
      if (error.response?.status === 401) {
        Alert.alert(t.loginRequired);
        navigation.replace('AdminLogin', { language });
      } else {
        Alert.alert(t.failedToFetch);
      }
    } finally {
      setLoadingList(false);
    }
  }, [activeTab, language]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Refresh when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchItems();
    });
    return unsubscribe;
  }, [navigation, fetchItems]);

  const resetForm = () => { setForm({}); setStep(1); setEditingItem(null); };
  const openNewForm = () => { resetForm(); setShowForm(true); };

  const openEditForm = (item) => {
    setEditingItem(item);
    if (activeTab === 'jobs') {
      setForm({
        title: item.title || '', company: item.company || '', district: item.district || '',
        salary: item.salary || '', experience: item.exp || '', education: item.edu || '',
        deadline: item.deadline || '', contactPhone: item.phone || '',
        contactWhatsapp: item.whatsapp || '', contactEmail: item.email || '',
        website: item.website || '', linkedin: item.linkedin || '',
      });
    } else if (activeTab === 'skills') {
      setForm({
        name: item.name || '', level: item.level || '', duration: item.duration || '',
        certification: item.cert === 'Yes' ? 'Yes' : 'No', courseType: item.type || 'Free',
        contactPhone: item.contactPhone || '', contactWhatsapp: item.contactWhatsapp || '',
        contactEmail: item.email || '', website: item.website || '',
      });
    } else {
      setForm({
        name: item.name || '', category: item.category || '',
        startupCost: item.cost || '', estimatedProfit: item.profit || '',
        riskLevel: item.risk || '', timeToLaunch: item.time || '',
        steps: (item.steps || []).join('\n'),
      });
    }
    setStep(1);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); resetForm(); };
  const handleFormChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const totalSteps = () => (activeTab === 'jobs' || activeTab === 'skills' || activeTab === 'business') ? 3 : 3;

  const canGoNext = () => {
    if (activeTab === 'jobs') {
      if (step === 1) return form.title?.trim() && form.company?.trim() && form.district?.trim();
      if (step === 2) return form.salary?.trim() && form.experience?.trim() && form.education?.trim();
      return true;
    }
    if (activeTab === 'skills') {
      if (step === 1) return form.name?.trim();
      return true;
    }
    if (activeTab === 'business') {
      if (step === 1) return form.name?.trim();
      return true;
    }
    return true;
  };

  const nextStep = () => { if (step < totalSteps()) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const handleSave = async () => {
    if (activeTab === 'jobs' && !form.title?.trim()) { Alert.alert(t.jobTitle); return; }
    if (activeTab === 'skills' && !form.name?.trim()) { Alert.alert(t.skillName); return; }
    if (activeTab === 'business' && !form.name?.trim()) { Alert.alert(t.businessName); return; }

    const token = await getToken();
    if (!token) {
      Alert.alert(t.loginRequired, t.loginRequired, [
        { text: t.ok, onPress: () => navigation.replace('AdminLogin', { language }) },
      ]);
      return;
    }

    setSaving(true);
    try {
      const endpoint = API_ENDPOINTS[activeTab];
      let payload = {};

      if (activeTab === 'jobs') {
        payload = {
          title: form.title, company: form.company, district: form.district,
          salary: form.salary, exp: form.experience, edu: form.education,
          deadline: form.deadline,
          phone: form.contactPhone ? (normalizeRwandaPhone(form.contactPhone) || form.contactPhone) : '',
          whatsapp: form.contactWhatsapp ? (normalizeRwandaPhone(form.contactWhatsapp) || form.contactWhatsapp) : '',
          email: form.contactEmail, website: form.website || '', linkedin: form.linkedin || '',
        };
      } else if (activeTab === 'skills') {
        payload = {
          name: form.name, level: form.level, duration: form.duration,
          cert: form.certification, type: form.courseType,
          contactPhone: form.contactPhone ? (normalizeRwandaPhone(form.contactPhone) || form.contactPhone) : '',
          contactWhatsapp: form.contactWhatsapp ? (normalizeRwandaPhone(form.contactWhatsapp) || form.contactWhatsapp) : '',
          email: form.contactEmail, website: form.website || '',
        };
      } else {
        const stepsArray = (form.steps || '').split('\n').map(line => line.trim()).filter(Boolean);
        payload = {
          name: form.name, category: form.category, cost: form.startupCost,
          profit: form.estimatedProfit, risk: form.riskLevel, time: form.timeToLaunch,
          steps: stepsArray,
        };
      }

      let response;
      if (editingItem) {
        const itemId = editingItem._id || editingItem.id;
        response = await axios.put(`${BASE_URL}${endpoint}/${itemId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        response = await axios.post(`${BASE_URL}${endpoint}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (response.data?.success) {
        const typeName = activeTab === 'jobs' ? t.typeJob : activeTab === 'skills' ? t.typeSkill : t.typeBusiness;
        const message = editingItem ? t.itemUpdated.replace('{type}', typeName) : t.itemCreated.replace('{type}', typeName);
        Alert.alert(t.success, message, [{ text: t.ok }]);
        closeForm();
        fetchItems(); // Refresh list from DB
      } else {
        Alert.alert(t.failedToSave, response.data?.message || '');
      }
    } catch (error) {
      console.error('Save error:', error?.response?.data || error?.message);
      Alert.alert(t.failedToSave, t.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    const name = item.title || item.name || 'this item';
    Alert.alert(t.deleteConfirm, t.deleteMessage.replace('{name}', name), [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => confirmDelete(item) },
    ]);
  };

  const confirmDelete = async (item) => {
    const token = await getToken();
    if (!token) return;
    try {
      const endpoint = API_ENDPOINTS[activeTab];
      const itemId = item._id || item.id;
      const response = await axios.delete(`${BASE_URL}${endpoint}/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data?.success) {
        const typeName = activeTab === 'jobs' ? t.typeJob : activeTab === 'skills' ? t.typeSkill : t.typeBusiness;
        Alert.alert(t.success, t.itemDeleted.replace('{type}', typeName));
        fetchItems();
      }
    } catch (error) {
      Alert.alert(t.failedToSave, t.failedToSave);
    }
  };

  const renderItem = ({ item }) => {
    const title = item.title || item.name || 'Untitled';
    const subtitle =
      activeTab === 'jobs'
        ? `${item.company || ''} • ${item.district || ''} • ${item.salary || ''}`
        : activeTab === 'skills'
        ? `${item.level || ''} • ${item.duration || ''} • ${item.type || ''}`
        : `${item.category || ''} • Cost: ${item.cost || '?'} • Profit: ${item.profit || '?'}`;
    return (
      <View style={[styles.itemCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => openEditForm(item)} style={styles.iconBtn}>
            <Ionicons name="create-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {Array.from({ length: totalSteps() }, (_, i) => i + 1).map((s) => (
        <View key={s} style={styles.stepDotWrapper}>
          <View style={[styles.stepDot, step >= s && styles.stepDotActive]} />
          {s < totalSteps() && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
        </View>
      ))}
    </View>
  );

  const renderFormContent = () => {
    if (activeTab === 'jobs') {
      if (step === 1) return (
        <>
          <FormField label={t.jobTitle} value={form.title} onChangeText={(v) => handleFormChange('title', v)} theme={theme} />
          <FormField label={t.company} value={form.company} onChangeText={(v) => handleFormChange('company', v)} theme={theme} />
          <FormField label={t.district} value={form.district} onChangeText={(v) => handleFormChange('district', v)} theme={theme} />
        </>
      );
      if (step === 2) return (
        <>
          <FormField label={t.salary} value={form.salary} onChangeText={(v) => handleFormChange('salary', v)} theme={theme} />
          <FormField label={t.experience} value={form.experience} onChangeText={(v) => handleFormChange('experience', v)} theme={theme} />
          <FormField label={t.education} value={form.education} onChangeText={(v) => handleFormChange('education', v)} theme={theme} />
          <FormField label={t.deadline} value={form.deadline} onChangeText={(v) => handleFormChange('deadline', v)} theme={theme} placeholder="YYYY-MM-DD" />
        </>
      );
      if (step === 3) return (
        <>
          <FormField label={t.contactPhone} value={form.contactPhone} onChangeText={(v) => handleFormChange('contactPhone', v)} theme={theme} keyboardType="phone-pad" />
          <FormField label={t.contactWhatsapp} value={form.contactWhatsapp} onChangeText={(v) => handleFormChange('contactWhatsapp', v)} theme={theme} keyboardType="phone-pad" />
          <FormField label={t.contactEmail} value={form.contactEmail} onChangeText={(v) => handleFormChange('contactEmail', v)} theme={theme} keyboardType="email-address" />
          <FormField label={t.website} value={form.website} onChangeText={(v) => handleFormChange('website', v)} theme={theme} />
          <FormField label={t.linkedin} value={form.linkedin} onChangeText={(v) => handleFormChange('linkedin', v)} theme={theme} />
        </>
      );
    } else if (activeTab === 'skills') {
      if (step === 1) return (
        <>
          <FormField label={t.skillName} value={form.name} onChangeText={(v) => handleFormChange('name', v)} theme={theme} />
          <FormField label={t.level} value={form.level} onChangeText={(v) => handleFormChange('level', v)} theme={theme} />
          <FormField label={t.duration} value={form.duration} onChangeText={(v) => handleFormChange('duration', v)} theme={theme} />
        </>
      );
      if (step === 2) return (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{t.certification}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleOption, form.certification === 'Yes' && styles.toggleOptionActive]} onPress={() => handleFormChange('certification', 'Yes')}>
              <Text style={form.certification === 'Yes' ? styles.toggleTextActive : styles.toggleText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleOption, form.certification === 'No' && styles.toggleOptionActive]} onPress={() => handleFormChange('certification', 'No')}>
              <Text style={form.certification === 'No' ? styles.toggleTextActive : styles.toggleText}>No</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 16 }} />
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{t.courseType}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleOption, form.courseType === 'Free' && styles.toggleOptionActive]} onPress={() => handleFormChange('courseType', 'Free')}>
              <Text style={form.courseType === 'Free' ? styles.toggleTextActive : styles.toggleText}>{t.free}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleOption, form.courseType === 'Paid' && styles.toggleOptionActive]} onPress={() => handleFormChange('courseType', 'Paid')}>
              <Text style={form.courseType === 'Paid' ? styles.toggleTextActive : styles.toggleText}>{t.paid}</Text>
            </TouchableOpacity>
          </View>
        </>
      );
      if (step === 3) return (
        <>
          <FormField label={t.contactPhone} value={form.contactPhone} onChangeText={(v) => handleFormChange('contactPhone', v)} theme={theme} keyboardType="phone-pad" />
          <FormField label={t.contactWhatsapp} value={form.contactWhatsapp} onChangeText={(v) => handleFormChange('contactWhatsapp', v)} theme={theme} keyboardType="phone-pad" />
          <FormField label={t.contactEmail} value={form.contactEmail} onChangeText={(v) => handleFormChange('contactEmail', v)} theme={theme} keyboardType="email-address" />
          <FormField label={t.website} value={form.website} onChangeText={(v) => handleFormChange('website', v)} theme={theme} />
        </>
      );
    } else if (activeTab === 'business') {
      if (step === 1) return (
        <>
          <FormField label={t.businessName} value={form.name} onChangeText={(v) => handleFormChange('name', v)} theme={theme} />
          <FormField label={t.category} value={form.category} onChangeText={(v) => handleFormChange('category', v)} theme={theme} />
        </>
      );
      if (step === 2) return (
        <>
          <FormField label={t.startupCost} value={form.startupCost} onChangeText={(v) => handleFormChange('startupCost', v)} theme={theme} />
          <FormField label={t.estimatedProfit} value={form.estimatedProfit} onChangeText={(v) => handleFormChange('estimatedProfit', v)} theme={theme} />
          <FormField label={t.riskLevel} value={form.riskLevel} onChangeText={(v) => handleFormChange('riskLevel', v)} theme={theme} />
          <FormField label={t.timeToLaunch} value={form.timeToLaunch} onChangeText={(v) => handleFormChange('timeToLaunch', v)} theme={theme} />
        </>
      );
      if (step === 3) return (
        <View style={[styles.textAreaField, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{t.stepsLabel}</Text>
          <TextInput
            style={[styles.textAreaInput, { color: theme.text }]}
            multiline numberOfLines={6} textAlignVertical="top"
            value={form.steps}
            onChangeText={(v) => handleFormChange('steps', v)}
            placeholder="1. Research market\n2. Secure location\n..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.tabBar}>
        {['jobs', 'skills', 'business'].map((tab) => {
          const label = tab === 'jobs' ? t.jobsTab : tab === 'skills' ? t.skillsTab : t.businessTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => { setActiveTab(tab); setShowForm(false); resetForm(); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!showForm ? (
        <>
          <View style={styles.listHeader}>
            <Text style={[styles.heading, { color: theme.text }]}>
              {activeTab === 'jobs' ? t.jobsTab : activeTab === 'skills' ? t.skillsTab : t.businessTab}
            </Text>
            <TouchableOpacity onPress={fetchItems} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          {loadingList ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
          ) : items.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.noData}</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => (item._id || item.id).toString()}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          <TouchableOpacity style={[styles.fab, { backgroundColor: theme.accent }]} onPress={openNewForm}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={closeForm}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {editingItem ? t.edit : t.addNew}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {renderStepIndicator()}
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
            {t.step.replace('{current}', step).replace('{total}', totalSteps())}
          </Text>

          {renderFormContent()}

          <View style={styles.navButtons}>
            {step > 1 ? (
              <TouchableOpacity style={[styles.navBtn, { borderColor: theme.accent }]} onPress={prevStep}>
                <Text style={[styles.navBtnText, { color: theme.accent }]}>{t.previous}</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            {step < totalSteps() ? (
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: canGoNext() ? theme.accent : '#ccc' }]}
                onPress={nextStep} disabled={!canGoNext()}
              >
                <Text style={styles.navBtnTextWhite}>{t.next}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: theme.accent }]}
                onPress={handleSave} disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.navBtnTextWhite}>{t.save}</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// Reusable Form Field Component
const FormField = ({ label, value, onChangeText, theme, ...props }) => (
  <View style={[styles.fieldContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
    <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, { color: theme.text }]}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={theme.textSecondary}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: '#f0f0f0', borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  activeTabText: { color: '#111' },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginVertical: 12,
  },
  heading: { fontSize: 20, fontWeight: '700' },
  refreshBtn: { padding: 4 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10,
    borderRadius: 14, borderWidth: 1,
  },
  itemTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSubtitle: { fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 16, marginLeft: 12 },
  iconBtn: { padding: 4 },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  formContainer: { padding: 16, paddingBottom: 40 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  stepDotWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ddd' },
  stepDotActive: { backgroundColor: '#111' },
  stepLine: { width: 30, height: 2, backgroundColor: '#ddd', marginHorizontal: 2 },
  stepLineActive: { backgroundColor: '#111' },
  stepLabel: { textAlign: 'center', marginBottom: 20, fontSize: 14 },
  fieldContainer: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  fieldInput: { fontSize: 16, padding: 0, minHeight: 40 },
  textAreaField: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  textAreaInput: { fontSize: 16, minHeight: 120, padding: 0 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  toggleOptionActive: { backgroundColor: '#111', borderColor: '#111' },
  toggleText: { fontSize: 14, color: '#444' },
  toggleTextActive: { color: '#fff' },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  navBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 16, fontWeight: '600' },
  navBtnTextWhite: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default AdminBusinessAddScreen;