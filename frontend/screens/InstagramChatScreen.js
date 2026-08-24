import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../constants';

const MESSAGES_KEY = '@user_messages';
const DEFAULT_AVATAR = require('../assets/profile1.png');

const Bubble = ({ item, isMine, theme }) => (
  <View style={[styles.bubbleRow, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
    {!isMine && <Image source={item.senderAvatar ? { uri: item.senderAvatar } : DEFAULT_AVATAR} style={styles.avatar} />}
    <View style={[styles.bubble, isMine ? { backgroundColor: '#0ea44a' } : { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: '#e6e6e6' }]}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.bubbleImage} /> : null}
      {item.text ? <Text style={[styles.bubbleText, isMine ? { color: '#fff' } : { color: theme.text }]}>{item.text}</Text> : null}
      <Text style={[styles.timeText, isMine ? { color: 'rgba(255,255,255,0.8)' } : { color: theme.textSecondary }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>
    {isMine && <Image source={item.senderAvatar ? { uri: item.senderAvatar } : DEFAULT_AVATAR} style={styles.avatar} />}
  </View>
);

const InstagramChatScreen = ({ route, navigation }) => {
  const { sellerId, sellerName, postId, sellerAvatar } = route.params || {};
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const listRef = useRef(null);

  useEffect(() => { loadCurrentUser(); }, []);

  useEffect(() => { if (currentUser) loadMessages(); }, [currentUser]);

  const loadCurrentUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('no token');
      const res = await axios.get(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      setCurrentUser(res.data.user);
    } catch (e) {
      const sessionUser = await AsyncStorage.getItem('sessionUser');
      if (sessionUser) setCurrentUser(JSON.parse(sessionUser));
      else setCurrentUser({ _id: await AsyncStorage.getItem('currentUser') || '+000', username: 'You' });
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      if (!sellerId || !postId) return setLoading(false);
      const token = await AsyncStorage.getItem('userToken');
      const url = `${BASE_URL}/api/messages/${postId}/${currentUser._id}/${sellerId}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      const apiMsgs = (res.data.messages || []).map(m => ({ _id: m._id || m.id, text: m.text, imageUrl: m.imageUrl, senderId: m.senderId, senderAvatar: m.senderAvatar, createdAt: m.createdAt || m.timestamp }));
      // include local messages for offline
      const stored = await AsyncStorage.getItem(MESSAGES_KEY);
      const local = stored ? JSON.parse(stored) : [];
      const relevant = local.filter(msg => String(msg.postId) === String(postId) && (String(msg.senderId) === String(sellerId) || String(msg.receiverId) === String(sellerId) || String(msg.senderId) === String(currentUser._id) || String(msg.receiverId) === String(currentUser._id))).map(m => ({ _id: m.id || m._id, text: m.text, imageUrl: m.imageUrl, senderId: m.senderId, senderAvatar: m.senderAvatar, createdAt: m.timestamp || m.createdAt }));
      const all = [...apiMsgs, ...relevant].sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt));
      setMessages(all);
    } catch (e) {
      console.error('Load messages failed', e);
      Alert.alert('Error', 'Could not load messages');
    } finally { setLoading(false); setTimeout(() => listRef.current?.scrollToEnd(), 300); }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission', 'Photo permission required');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!res.canceled && res.assets?.length) setSelectedImage(res.assets[0].uri);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    const text = (input || '').trim();
    if (!text && !selectedImage) return;
    const userId = currentUser?._id || currentUser?.phone;
    const tempId = `temp_${Date.now()}`;
    const tempMsg = { _id: tempId, text, imageUrl: selectedImage, senderId: userId, senderAvatar: currentUser?.avatar, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setInput(''); setSelectedImage(null);
    listRef.current?.scrollToEnd();

    try {
      const token = await AsyncStorage.getItem('userToken');
      let imageUrlToSend = null;
      if (selectedImage && !selectedImage.startsWith('http')) {
        try {
          const form = new FormData();
          form.append('images', { uri: selectedImage, name: 'photo.jpg', type: 'image/jpeg' });
          const uploadRes = await axios.post(`${BASE_URL}/api/messages/upload-image`, form, { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } });
          if (uploadRes.data && uploadRes.data.urls && uploadRes.data.urls[0]) imageUrlToSend = uploadRes.data.urls[0];
        } catch (uploadErr) {
          console.error('Image upload failed', uploadErr);
        }
      } else {
        imageUrlToSend = selectedImage;
      }

      const messageData = { postId, postTitle: '', postUser: sellerName, senderId: userId, senderName: currentUser?.username, senderAvatar: currentUser?.avatar, receiverId: sellerId, receiverName: sellerName, text, imageUrl: imageUrlToSend };
      const res = await axios.post(`${BASE_URL}/api/messages/send`, messageData, { headers: { Authorization: `Bearer ${token}` } });
      const saved = res.data.message || res.data;
      setMessages(prev => prev.map(m => (m._id === tempId ? { _id: saved._id || saved.id, text: saved.text, imageUrl: saved.imageUrl, senderId: saved.senderId, senderAvatar: saved.senderAvatar, createdAt: saved.createdAt || saved.timestamp } : m)));
    } catch (e) {
      console.error('Send failed', e);
      Alert.alert('Send failed', 'Message will be saved locally');
      // save local for retry
      try {
        const stored = await AsyncStorage.getItem(MESSAGES_KEY);
        const list = stored ? JSON.parse(stored) : [];
        const storeMsg = { id: tempId, postId, postUser: sellerName, senderId: userId, senderAvatar: currentUser?.avatar, receiverId: sellerId, text, imageUrl: selectedImage, timestamp: new Date().toISOString(), read: false };
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify([...list, storeMsg]));
      } catch (err) { console.error('Local save failed', err); }
    }
  };

  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.center}><ActivityIndicator size="large" color={theme.accent} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={sellerAvatar ? { uri: sellerAvatar } : DEFAULT_AVATAR} style={styles.headerAvatar} />
          <Text style={[styles.headerName, { color: theme.text }]}>{sellerName}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <Bubble item={item} isMine={String(item.senderId) === String(currentUser?._id || currentUser?.phone)} theme={theme} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        {selectedImage ? (
          <View style={styles.previewRow}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removeBtn}><Ionicons name="close" size={18} color="#fff" /></TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.composer, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}> 
          <TouchableOpacity onPress={pickImage} style={{ padding: 8 }}>
            <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
          <TextInput value={input} onChangeText={setInput} placeholder="Message" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} multiline />
          <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: input.trim() || selectedImage ? '#0ea44a' : theme.textSecondary }]} disabled={!input.trim() && !selectedImage}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 8 },
  headerName: { fontSize: 16, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 8 },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 16 },
  bubbleText: { fontSize: 16 },
  bubbleImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 6 },
  timeText: { fontSize: 11, marginTop: 6, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, maxHeight: 100 },
  sendBtn: { marginLeft: 8, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  previewRow: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  previewImage: { width: 80, height: 80, borderRadius: 12 },
  removeBtn: { position: 'absolute', right: 12, top: 12, backgroundColor: '#000', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});

export default InstagramChatScreen;
