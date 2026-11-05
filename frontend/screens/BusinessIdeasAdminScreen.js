import { getAuthToken, removeAuthToken } from '../utils/authStorage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import AdminScreenHeader from '../components/AdminScreenHeader';
import { showAdminFeedback } from '../utils/adminFeedback';

const PAGE_SIZE = 20;
const CATEGORIES = ['Food', 'Retail', 'Agriculture', 'Technology', 'Services', 'Other'];
const RISKS = ['Low', 'Medium', 'High'];
const AMOUNT_PATTERN = /^(?:(?:RWF|USD|EUR|UGX|KES|[$€£])\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?(?:\s*(?:-|–|to)\s*(?:(?:RWF|USD|EUR|UGX|KES|[$€£])\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?)?(?:\s*(?:RWF|USD|EUR|UGX|KES))?$/i;
const EMPTY_FORM = {
  name: '', businessCategory: '', description: '', fullDescription: '', cost: '', profit: '',
  risk: '', time: '', steps: [''], targetAudience: '', requiredSkills: '', equipment: '',
  potentialCustomers: '', marketingStrategy: '', challenges: '', location: '',
  additionalInfo: '', published: false,
};
const lines = (value) => Array.isArray(value) ? value.join('\n') : '';

const formFromIdea = (idea) => ({
  ...EMPTY_FORM,
  ...idea,
  fullDescription: idea.fullDescription || idea.description || '',
  steps: Array.isArray(idea.steps) && idea.steps.length ? [...idea.steps] : [''],
  requiredSkills: lines(idea.requiredSkills),
  equipment: lines(idea.equipment),
  potentialCustomers: lines(idea.potentialCustomers),
  challenges: lines(idea.challenges),
  published: idea.published !== false,
});

const ideaPayload = (form, published) => ({
  ...form,
  cost: form.cost.trim(),
  profit: form.profit.trim(),
  steps: form.steps.map((step) => step.trim()).filter(Boolean),
  requiredSkills: form.requiredSkills.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
  equipment: form.equipment.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
  potentialCustomers: form.potentialCustomers.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
  challenges: form.challenges.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
  published,
});

const BusinessIdeasAdminScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const [ideas, setIdeas] = useState([]);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, recent: 0 });
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const latestRequest = useRef(0);

  const tokenOrRedirect = useCallback(async () => {
    const token = await getAuthToken('adminToken');
    if (!token) navigation.replace('AdminLogin');
    return token;
  }, [navigation]);

  const loadIdeas = useCallback(async (nextPage = 1, append = false, pullRefresh = false) => {
    const requestId = ++latestRequest.current;
    if (pullRefresh) setRefreshing(true);
    else if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const token = await tokenOrRedirect();
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/api/admin/business-ideas`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: nextPage, limit: PAGE_SIZE, search: search.trim() || undefined, category: category || undefined, status, sort },
      });
      if (!response.data?.success || !Array.isArray(response.data.businessIdeas)) {
        throw new Error(response.data?.message || 'Invalid response from server');
      }
      if (requestId !== latestRequest.current) return;
      setIdeas((current) => append ? [...current, ...response.data.businessIdeas] : response.data.businessIdeas);
      setPage(nextPage);
      setHasMore(Boolean(response.data.pagination?.hasMore));
      setStats(response.data.stats || { total: 0, published: 0, drafts: 0, recent: 0 });
      setCategories(response.data.categories || []);
    } catch (requestError) {
      if (requestId !== latestRequest.current) return;
      if (['session_invalidated', 'session_ended'].includes(requestError.response?.data?.reason)) {
        await removeAuthToken('adminToken');
        navigation.replace('AdminLogin');
      } else {
        const message = requestError.response?.data?.message || requestError.message || 'Could not load business ideas.';
        setError(message);
        showAdminFeedback('Could not load business ideas', message, 'error');
      }
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [category, navigation, search, sort, status, tokenOrRedirect]);

  useEffect(() => {
    if (!isFocused) return undefined;
    const timeout = setTimeout(() => loadIdeas(1), 350);
    return () => clearTimeout(timeout);
  }, [category, isFocused, loadIdeas, search, sort, status]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, steps: [''] });
    setErrors({});
    setFormVisible(true);
  };

  const openEdit = (idea) => {
    setEditing(idea);
    setForm(formFromIdea(idea));
    setErrors({});
    setFormVisible(true);
  };

  const validate = () => {
    const next = {};
    ['name', 'businessCategory', 'description', 'fullDescription', 'cost', 'profit', 'risk', 'time'].forEach((key) => {
      if (!String(form[key] || '').trim()) next[key] = 'This field is required.';
    });
    if (form.name.trim().length < 2) next.name = 'Enter at least 2 characters.';
    ['cost', 'profit'].forEach((key) => {
      if (form[key] && !AMOUNT_PATTERN.test(form[key].trim())) next[key] = 'Enter a valid non-negative amount.';
    });
    if (!RISKS.includes(form.risk)) next.risk = 'Select a risk level.';
    if (!form.steps.some((stepText) => stepText.trim())) next.steps = 'Add at least one starting step.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (published) => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const token = await tokenOrRedirect();
      if (!token) return;
      const response = await axios({
        method: editing ? 'put' : 'post',
        url: editing ? `${BASE_URL}/api/admin/business-ideas/${editing._id}` : `${BASE_URL}/api/admin/business-ideas`,
        data: ideaPayload(form, published),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Business idea was not saved.');
      setFormVisible(false);
      setEditing(null);
      await loadIdeas(1);
      showAdminFeedback('Saved', editing ? 'Business idea changes were saved.' : published ? 'Business idea published.' : 'Business idea saved as a draft.', 'success');
    } catch (saveError) {
      if (['session_invalidated', 'session_ended'].includes(saveError.response?.data?.reason)) {
        await removeAuthToken('adminToken');
        navigation.replace('AdminLogin');
      } else if (saveError.response?.data?.errors) {
        setErrors(saveError.response.data.errors);
        showAdminFeedback('Could not save', saveError.response?.data?.message || 'Please review the highlighted fields.', 'error');
      } else {
        showAdminFeedback('Could not save', saveError.response?.data?.message || saveError.message || 'Please try again.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (idea) => {
    try {
      const token = await tokenOrRedirect();
      if (!token) return;
      const published = idea.published === false;
      const response = await axios.patch(`${BASE_URL}/api/admin/business-ideas/${idea._id}/status`, { published }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Status could not be changed.');
      await loadIdeas(page);
      showAdminFeedback('Updated', published ? 'Business idea published.' : 'Business idea unpublished.', 'success');
    } catch (statusError) {
      if (['session_invalidated', 'session_ended'].includes(statusError.response?.data?.reason)) {
        await removeAuthToken('adminToken');
        navigation.replace('AdminLogin');
      } else showAdminFeedback('Could not update status', statusError.response?.data?.message || statusError.message, 'error');
    }
  };

  const deleteIdea = (idea) => Alert.alert('Delete business idea?', `“${idea.name}” will be permanently deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try {
        const token = await tokenOrRedirect();
        if (!token) return;
        const response = await axios.delete(`${BASE_URL}/api/admin/business-ideas/${idea._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.data?.success) throw new Error(response.data?.message || 'Idea was not deleted.');
        await loadIdeas(1);
        showAdminFeedback('Deleted', 'Business idea deleted.', 'success');
      } catch (deleteError) {
        if (['session_invalidated', 'session_ended'].includes(deleteError.response?.data?.reason)) {
          await removeAuthToken('adminToken');
          navigation.replace('AdminLogin');
        } else showAdminFeedback('Could not delete', deleteError.response?.data?.message || deleteError.message, 'error');
      }
    } },
  ]);

  const changeStep = (index, direction) => setForm((current) => {
    const next = [...current.steps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, steps: next };
  });

  const filterCategories = [...new Set([...CATEGORIES, ...categories])];
  const Chip = ({ label, selected, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.action, borderColor: selected ? theme.accent : theme.border }]}>
      <Text style={{ color: selected ? '#fff' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
  const Field = ({ label, value, field, multiline = false, keyboardType, placeholder }) => (
    <View style={[styles.field, { borderColor: errors[field] ? '#d94343' : theme.border, backgroundColor: theme.action }]}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => updateField(field, field === 'cost' || field === 'profit' ? text.replace(/[^\d.]/g, '') : text)}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border }, multiline && styles.multiline]}
      />
      {errors[field] ? <Text style={styles.validation}>{errors[field]}</Text> : null}
    </View>
  );

  const renderForm = () => (
    <Modal visible={formVisible} animationType="slide" onRequestClose={() => !saving && setFormVisible(false)}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
        <AdminScreenHeader title={editing ? 'Edit Business Idea' : 'Add Business Idea'} theme={theme} onBack={() => !saving && setFormVisible(false)} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.subtitle, { color: theme.textSecondary, paddingHorizontal: 0 }]}>Enter useful, accurate information for entrepreneurs.</Text>
            <Field field="name" label="Business name *" value={form.name} />
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: theme.text }]}>Business category *</Text>
              <View style={styles.wrapChips}>{filterCategories.map((value) => <Chip key={value} label={value} selected={form.businessCategory === value} onPress={() => updateField('businessCategory', value)} />)}</View>
              {errors.businessCategory ? <Text style={styles.validation}>{errors.businessCategory}</Text> : null}
            </View>
            <Field field="description" label="Short description *" value={form.description} multiline />
            <Field field="fullDescription" label="Full business description *" value={form.fullDescription} multiline />
            <View style={styles.twoColumns}>
              <View style={{ flex: 1 }}><Field field="cost" label="Startup cost *" value={form.cost} keyboardType="decimal-pad" placeholder="e.g. 250000" /></View>
              <View style={{ flex: 1 }}><Field field="profit" label="Monthly profit *" value={form.profit} keyboardType="decimal-pad" placeholder="e.g. 80000" /></View>
            </View>
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: theme.text }]}>Risk level *</Text>
              <View style={styles.wrapChips}>{RISKS.map((value) => <Chip key={value} label={value} selected={form.risk === value} onPress={() => updateField('risk', value)} />)}</View>
              {errors.risk ? <Text style={styles.validation}>{errors.risk}</Text> : null}
            </View>
            <Field field="time" label="Estimated time to launch *" value={form.time} placeholder="e.g. 3-4 weeks" />
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: theme.text }]}>Starting steps *</Text>
              {form.steps.map((stepText, index) => (
                <View key={`step-${index}`} style={styles.stepRow}>
                  <Text style={{ color: theme.textSecondary }}>{index + 1}.</Text>
                  <TextInput value={stepText} onChangeText={(value) => setForm((current) => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? value : step) }))} placeholder="Describe this step" placeholderTextColor={theme.textSecondary} style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border }]} />
                  <TouchableOpacity onPress={() => changeStep(index, -1)}><Ionicons name="arrow-up" size={19} color={theme.text} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => changeStep(index, 1)}><Ionicons name="arrow-down" size={19} color={theme.text} /></TouchableOpacity>
                  <TouchableOpacity disabled={form.steps.length === 1} onPress={() => setForm((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))}><Ionicons name="remove-circle-outline" size={20} color="#d94343" /></TouchableOpacity>
                </View>
              ))}
              {errors.steps ? <Text style={styles.validation}>{errors.steps}</Text> : null}
              <TouchableOpacity onPress={() => setForm((current) => ({ ...current, steps: [...current.steps, ''] }))} style={styles.addStep}>
                <Ionicons name="add-circle-outline" size={18} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: '600' }}>Add a step</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Additional details</Text>
            <Field field="targetAudience" label="Target audience" value={form.targetAudience} />
            <Field field="requiredSkills" label="Required skills (one per line)" value={form.requiredSkills} multiline />
            <Field field="equipment" label="Equipment or materials (one per line)" value={form.equipment} multiline />
            <Field field="potentialCustomers" label="Potential customers (one per line)" value={form.potentialCustomers} multiline />
            <Field field="marketingStrategy" label="Marketing strategy" value={form.marketingStrategy} multiline />
            <Field field="challenges" label="Expected challenges (one per line)" value={form.challenges} multiline />
            <Field field="location" label="Location or market applicability" value={form.location} />
            <Field field="additionalInfo" label="Additional information" value={form.additionalInfo} multiline />
            <View style={[styles.preview, { backgroundColor: theme.action, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Public preview</Text>
              <Text style={[styles.ideaName, { color: theme.text }]}>{form.name || 'Business name'}</Text>
              <Text style={{ color: theme.textSecondary }}>{form.description || 'Short description preview'}</Text>
              <Text style={{ color: theme.accent, marginTop: 7 }}>{form.businessCategory || 'Category'} · {form.risk || 'Risk'} risk</Text>
            </View>
            <View style={[styles.publishRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}><Text style={[styles.label, { color: theme.text }]}>Publish this idea</Text><Text style={{ color: theme.textSecondary, fontSize: 12 }}>Published ideas appear in the public Business Ideas section.</Text></View>
              <Switch value={form.published} onValueChange={(value) => updateField('published', value)} trackColor={{ true: theme.accent }} />
            </View>
            {editing ? (
              <>
                <Button label="Save Changes" loading={saving} disabled={saving} onPress={() => save(form.published)} theme={theme} />
                <Button label={form.published ? 'Save as Draft' : 'Publish'} disabled={saving} secondary onPress={() => save(!form.published)} theme={theme} />
              </>
            ) : (
              <>
                <Button label="Save Draft" loading={saving} disabled={saving} secondary onPress={() => save(false)} theme={theme} />
                <Button label="Publish" loading={saving} disabled={saving} onPress={() => save(true)} theme={theme} />
              </>
            )}
            <TouchableOpacity disabled={saving} onPress={() => setFormVisible(false)} style={styles.cancel}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  const renderIdea = (idea) => (
    <View key={idea._id} style={[styles.ideaCard, { backgroundColor: theme.action, borderColor: theme.border }]}>
      <View style={styles.ideaHead}>
        <View style={{ flex: 1 }}><Text style={[styles.ideaName, { color: theme.text }]}>{idea.name}</Text><Text style={{ color: theme.textSecondary, marginTop: 3 }}>{idea.businessCategory || 'Uncategorized'}</Text></View>
        <Text style={[styles.badgeText, { color: idea.published === false ? theme.textSecondary : theme.accent }]}>{idea.published === false ? 'DRAFT' : 'PUBLISHED'}</Text>
      </View>
      <Text numberOfLines={3} style={[styles.description, { color: theme.textSecondary }]}>{idea.description}</Text>
      <View style={styles.detailsGrid}>
        {[['Startup cost', idea.cost], ['Monthly profit', idea.profit], ['Risk', idea.risk], ['Launch time', idea.time]].map(([label, value]) => (
          <View key={label} style={styles.detailCell}><Text style={{ color: theme.textSecondary, fontSize: 11 }}>{label}</Text><Text style={{ color: theme.text, fontWeight: '600', marginTop: 3 }}>{value || '—'}</Text></View>
        ))}
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 4 }}>{idea.updatedAt || idea.createdAt ? new Date(idea.updatedAt || idea.createdAt).toLocaleDateString() : 'Date unavailable'}</Text>
      <View style={[styles.actions, { borderColor: theme.border }]}>
        <Action icon="eye-outline" label="View" color={theme.text} onPress={() => setDetails(idea)} />
        <Action icon="create-outline" label="Edit" color={theme.text} onPress={() => openEdit(idea)} />
        <Action icon={idea.published === false ? 'cloud-upload-outline' : 'eye-off-outline'} label={idea.published === false ? 'Publish' : 'Unpublish'} color={theme.accent} onPress={() => changeStatus(idea)} />
        <Action icon="trash-outline" label="Delete" color="#d94343" onPress={() => deleteIdea(idea)} />
      </View>
    </View>
  );

  const renderDetails = () => details ? (
    <Modal visible transparent animationType="slide" onRequestClose={() => setDetails(null)}>
      <View style={styles.overlay}><View style={[styles.detailsModal, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => setDetails(null)} style={styles.close}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.ideaName, { color: theme.text, fontSize: 21 }]}>{details.name}</Text>
          <Text style={{ color: theme.accent, marginVertical: 8 }}>{details.businessCategory} · {details.published === false ? 'Draft' : 'Published'}</Text>
          <Text style={{ color: theme.text, lineHeight: 21 }}>{details.fullDescription || details.description}</Text>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Starting steps</Text>
          {(details.steps || []).map((step, index) => <Text key={index} style={{ color: theme.textSecondary, marginBottom: 8 }}>{index + 1}. {step}</Text>)}
          {[
            ['Target audience', details.targetAudience], ['Required skills', lines(details.requiredSkills)],
            ['Equipment or materials', lines(details.equipment)], ['Potential customers', lines(details.potentialCustomers)],
            ['Marketing strategy', details.marketingStrategy], ['Expected challenges', lines(details.challenges)],
            ['Market applicability', details.location], ['Additional information', details.additionalInfo],
          ].filter(([, value]) => value).map(([label, value]) => <View key={label} style={{ marginTop: 12 }}><Text style={[styles.label, { color: theme.text }]}>{label}</Text><Text style={{ color: theme.textSecondary }}>{value}</Text></View>)}
        </ScrollView>
      </View></View>
    </Modal>
  ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <AdminScreenHeader title="Business Ideas Management" theme={theme} onBack={() => navigation.goBack()} actionIcon="add" actionLabel="Add Business Idea" onAction={openCreate} />
      <View style={styles.subtitleRow}>
        <Text style={[styles.subtitle, { color: theme.textSecondary, flex: 1 }]}>Create, manage, and publish business opportunities for the community.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminBusinessAdd')} style={styles.legacyLink}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Jobs & skills</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 92 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadIdeas(1, false, true)} tintColor={theme.accent} />}
      >
        <View style={styles.statsGrid}>
          <Stat label="Total ideas" value={stats.total} icon="bulb-outline" theme={theme} />
          <Stat label="Published" value={stats.published} icon="checkmark-circle-outline" theme={theme} />
          <Stat label="Drafts" value={stats.drafts} icon="document-outline" theme={theme} />
          <Stat label="Added in 7 days" value={stats.recent} icon="time-outline" theme={theme} />
        </View>
        <View style={[styles.searchBox, { backgroundColor: theme.action, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={19} color={theme.textSecondary} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search name or description" placeholderTextColor={theme.textSecondary} style={[styles.searchInput, { color: theme.text }]} />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={theme.textSecondary} /></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Chip label="All categories" selected={!category} onPress={() => setCategory('')} />
          {filterCategories.map((value) => <Chip key={value} label={value} selected={category === value} onPress={() => setCategory(category === value ? '' : value)} />)}
        </ScrollView>
        <View style={styles.chipsRow}>{['all', 'published', 'draft'].map((value) => <Chip key={value} label={value === 'all' ? 'All statuses' : value === 'draft' ? 'Drafts' : 'Published'} selected={status === value} onPress={() => setStatus(value)} />)}</View>
        <View style={styles.sortRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Sort by</Text>
          {['newest', 'oldest', 'name'].map((value) => <TouchableOpacity key={value} onPress={() => setSort(value)} style={[styles.sortButton, { borderColor: sort === value ? theme.accent : theme.border }]}><Text style={{ color: sort === value ? theme.accent : theme.textSecondary, fontSize: 12 }}>{value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}
        </View>
        {!!error && <View style={styles.errorBox}><Button label="Retry" onPress={() => loadIdeas(1)} theme={theme} /></View>}
        {loading && !ideas.length ? <ActivityIndicator size="large" color={theme.accent} style={{ margin: 35 }} /> : null}
        {!loading && !error && !ideas.length ? <View style={styles.empty}><Ionicons name="bulb-outline" size={38} color={theme.textSecondary} /><Text style={{ color: theme.text, fontWeight: '700', marginTop: 8 }}>No business ideas found</Text><Text style={{ color: theme.textSecondary, marginTop: 4 }}>Add an idea or adjust your filters.</Text></View> : null}
        {ideas.map(renderIdea)}
        {hasMore ? <TouchableOpacity disabled={loadingMore} onPress={() => loadIdeas(page + 1, true)} style={styles.loadMore}>{loadingMore ? <ActivityIndicator color={theme.accent} /> : <Text style={{ color: theme.accent, fontWeight: '700' }}>Load more ideas</Text>}</TouchableOpacity> : null}
      </ScrollView>
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.accent }]} onPress={openCreate}><Ionicons name="add" size={23} color="#fff" /><Text style={styles.fabText}>Add Business Idea</Text></TouchableOpacity>
      {renderForm()}
      {renderDetails()}
    </SafeAreaView>
  );
};

const Stat = ({ label, value, icon, theme }) => <View style={[styles.stat, { backgroundColor: theme.action, borderColor: theme.border }]}><Ionicons name={icon} size={17} color={theme.accent} /><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={{ color: theme.textSecondary, fontSize: 10 }}>{label}</Text></View>;
const Action = ({ icon, label, color, onPress }) => <TouchableOpacity onPress={onPress} style={styles.action}><Ionicons name={icon} size={17} color={color} /><Text style={{ color, fontSize: 10, marginTop: 3 }}>{label}</Text></TouchableOpacity>;
const Button = ({ label, onPress, disabled, loading, secondary, theme }) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, secondary && { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border }, disabled && { opacity: 0.6 }]}>{loading ? <ActivityIndicator color={secondary ? theme.accent : '#fff'} /> : <Text style={{ color: secondary ? theme.text : '#fff', fontWeight: '700' }}>{label}</Text>}</TouchableOpacity>;

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { paddingHorizontal: 17, paddingTop: 11, paddingBottom: 4, fontSize: 13, lineHeight: 19 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  legacyLink: { paddingVertical: 8, paddingLeft: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  stat: { width: '48%', minHeight: 77, borderRadius: 14, borderWidth: 1, padding: 10, justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 13, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingHorizontal: 9 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 11, paddingVertical: 7 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 7 },
  sortButton: { borderRadius: 20, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
  ideaCard: { marginHorizontal: 16, marginTop: 6, marginBottom: 6, padding: 14, borderRadius: 15, borderWidth: 1 },
  ideaHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ideaName: { fontSize: 16, fontWeight: '700' },
  badgeText: { borderRadius: 16, overflow: 'hidden', fontSize: 10, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#8882' },
  description: { fontSize: 13, lineHeight: 18, marginTop: 9 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  detailCell: { width: '50%', marginBottom: 9 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 7 },
  action: { minWidth: 52, alignItems: 'center' },
  empty: { alignItems: 'center', padding: 30 },
  errorBox: { margin: 16, gap: 10 },
  loadMore: { alignItems: 'center', padding: 17 },
  fab: { position: 'absolute', right: 17, bottom: 15, borderRadius: 28, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 5 },
  fabText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  formContent: { padding: 16, paddingBottom: 35 },
  field: { borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 11 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, minHeight: 41, fontSize: 14 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  validation: { color: '#d94343', fontSize: 12, marginTop: 5 },
  formSection: { borderWidth: 1, borderColor: '#8885', borderRadius: 12, padding: 12, marginBottom: 11 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  twoColumns: { flexDirection: 'row', gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  addStep: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 10 },
  preview: { borderWidth: 1, borderRadius: 14, padding: 13, marginVertical: 8 },
  publishRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginVertical: 12 },
  button: { backgroundColor: '#272727', borderRadius: 11, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  cancel: { alignItems: 'center', padding: 12 },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 16 },
  detailsModal: { maxHeight: '85%', borderRadius: 17, overflow: 'hidden' },
  close: { position: 'absolute', right: 10, top: 10, zIndex: 1, padding: 5 },
});

export default BusinessIdeasAdminScreen;
