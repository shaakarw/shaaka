import { getAuthToken } from '../utils/authStorage';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnlineStatusDot from '../components/OnlineStatusDot';
import useOnlineUsers from '../hooks/useOnlineUsers';
import { normalizeImageSource } from '../utils/imageUrl';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DEFAULT_AVATAR = require('../assets/profile1.png');

const TypingIndicator = ({ theme }) => (
  <View style={[waStyles.typingContainer, { backgroundColor: 'transparent' }]}>
    <View style={[waStyles.typingDot, { backgroundColor: theme.textSecondary }]} />
    <View style={[waStyles.typingDot, { backgroundColor: theme.textSecondary, marginLeft: 6 }]} />
    <View style={[waStyles.typingDot, { backgroundColor: theme.textSecondary, marginLeft: 6 }]} />
  </View>
);

const MessageBubble = React.memo(({ item, isMe, onLongPress, onDoubleTap, theme }) => {
  const containerStyle = isMe ? waStyles.myRow : waStyles.theirRow;
  const bubbleStyle = isMe ? waStyles.myBubble : waStyles.theirBubble;

  return (
    <View style={containerStyle}>
      {!isMe && <Image source={normalizeImageSource(item.senderAvatar ? { uri: item.senderAvatar } : DEFAULT_AVATAR)} style={waStyles.avatarSmall} />}

      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => onLongPress(item)}
        onPress={() => onDoubleTap(item)}
        style={[waStyles.bubble, bubbleStyle]}
      >
        {item.text ? <Text style={[waStyles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>{item.text}</Text> : null}
        {item.imageUrl ? <Image source={normalizeImageSource({ uri: item.imageUrl })} style={waStyles.messageImage} /> : null}

        <View style={waStyles.metaRow}>
          <Text style={[waStyles.timeText, { color: isMe ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          {isMe && (
            <Ionicons
              name={item.seen ? 'checkmark-done' : item.delivered ? 'checkmark' : 'time'}
              size={14}
              color={item.seen ? '#34B7F1' : 'rgba(255,255,255,0.85)'}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
      </TouchableOpacity>

      {isMe && <Image source={normalizeImageSource(item.senderAvatar ? { uri: item.senderAvatar } : DEFAULT_AVATAR)} style={waStyles.avatarSmall} />}
    </View>
  );
});

const WhatsAppChatScreen = ({ route, navigation }) => {
  const { threadId, otherUserId, otherUserName, otherUserAvatar } = route.params || {};
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const flatRef = useRef(null);
  const onlineUsers = useOnlineUsers(otherUserId ? [otherUserId] : []);
  const isOtherUserOnline = Boolean(onlineUsers[String(otherUserId)]);

  useEffect(() => {
    loadMessages();
    const poll = setInterval(() => fetchNewMessages(), 3000);
    return () => clearInterval(poll);
  }, []);

  const loadMessages = async () => {
    setRefreshing(true);
    try {
      const token = await getAuthToken('userToken');
      const url = `${BASE_URL}/api/messages/thread/${threadId}?limit=100`;
      const res = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const fetched = res.data.messages || [];
      // ensure newest first for inverted FlatList
      setMessages(fetched);
    } catch (e) {
      console.warn('load failed', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchNewMessages = async () => {
    try {
      const token = await getAuthToken('userToken');
      const url = `${BASE_URL}/api/messages/thread/${threadId}/latest`;
      const res = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const latest = res.data.messages || [];
      if (latest.length) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMessages(prev => {
          const map = new Map(prev.map(m => [m._id, m]));
          latest.forEach(m => map.set(m._id, m));
          return Array.from(map.values()).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
        });
        flatRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
      if (res.data.typing) setIsOtherTyping(res.data.typing === otherUserId);
    } catch (e) {}
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (!res.canceled && res.assets?.length) setSelectedImage(res.assets[0].uri);
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    const temp = { _id: `t_${Date.now()}`, text: inputText.trim(), imageUrl: selectedImage, senderId: 'me', createdAt: new Date().toISOString(), delivered: false, seen: false };
    setMessages(prev => [temp, ...prev]);
    setInputText('');
    setSelectedImage(null);
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });

    try {
      // upload image if any
      let imageUrl = null;
      if (selectedImage) {
        const token = await getAuthToken('userToken');
        const form = new FormData();
        const filename = selectedImage.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        form.append('images[]', { uri: selectedImage, name: filename, type });
        const uploadRes = await axios.post(`${BASE_URL}/api/messages/upload-image`, form, { headers: { 'Content-Type': 'multipart/form-data', Authorization: token ? `Bearer ${token}` : '' } });
        imageUrl = uploadRes.data.urls?.[0] || null;
      }

      const token = await getAuthToken('userToken');
      const payload = { threadId, text: temp.text, imageUrl, receiverId: otherUserId };
      const res = await axios.post(`${BASE_URL}/api/messages/send`, payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const sent = res.data.message;
      setMessages(prev => prev.map(m => (m._id === temp._id ? sent : m)));
    } catch (e) {
      setMessages(prev => prev.map(m => (m._id === temp._id ? { ...m, delivered: false } : m)));
    }
  };

  const onLongPress = (m) => {
    // reuse action modal UI
    // For brevity, show built-in options via modal
  };

  const onDoubleTap = (m) => {
    setMessages(prev => prev.map(x => (x._id === m._id ? { ...x, liked: !x.liked } : x)));
  };

  const renderItem = useCallback(({ item }) => (
    <MessageBubble item={item} isMe={item.senderId === 'me' || !item.senderId} onLongPress={onLongPress} onDoubleTap={onDoubleTap} theme={theme} />
  ), [theme]);

  return (
    <SafeAreaView style={[waStyles.container, { backgroundColor: theme.background }]}> 
      <View style={[waStyles.header, { borderBottomColor: theme.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={waStyles.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <View style={waStyles.headerAvatarWrap}>
          <Image source={normalizeImageSource(otherUserAvatar ? { uri: otherUserAvatar } : DEFAULT_AVATAR)} style={waStyles.headerAvatar} />
          <OnlineStatusDot visible={isOtherUserOnline} />
        </View>
        <View style={waStyles.headerTextWrap}>
          <Text style={[waStyles.headerTitle, { color: theme.text }]} numberOfLines={1}>{otherUserName}</Text>
          {isOtherTyping && (
            <Text style={[waStyles.headerSubtitle, { color: theme.textSecondary }]}>typing...</Text>
          )}
        </View>
        <View style={waStyles.headerActions}>
          <TouchableOpacity style={waStyles.iconBtn}><Ionicons name="call" size={20} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity style={waStyles.iconBtn}><Ionicons name="videocam" size={20} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity style={waStyles.iconBtn}><MaterialIcons name="more-vert" size={20} color={theme.text} /></TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={waStyles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMessages} />}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
        />

        {isOtherTyping && <View style={waStyles.typingRow}><TypingIndicator theme={theme} /></View>}

        <View style={[waStyles.composer, { borderTopColor: theme.border, backgroundColor: theme.cardBackground }]}> 
          <TouchableOpacity onPress={pickImage} style={waStyles.iconWrap}><Ionicons name="attach" size={22} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity style={waStyles.iconWrap}><Ionicons name="camera" size={22} color={theme.text} /></TouchableOpacity>
          <View style={waStyles.inputWrap}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message"
              placeholderTextColor={theme.textSecondary}
              style={[waStyles.input, { color: theme.text }]}
              multiline
            />
          </View>

          {inputText.trim() ? (
            <TouchableOpacity style={[waStyles.sendBtn, { backgroundColor: '#25D366' }]} onPress={sendMessage}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
          ) : (
            <TouchableOpacity style={waStyles.micBtn}><Ionicons name="mic" size={20} color={theme.text} /></TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const waStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { marginRight: 8 },
  headerAvatarWrap: { position: 'relative', marginRight: 8 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 6 },

  list: { paddingHorizontal: 12, paddingBottom: 8 },
  myRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginVertical: 6 },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start', marginVertical: 6 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, marginHorizontal: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 10, elevation: 1 },
  myBubble: { backgroundColor: '#25D366', borderTopRightRadius: 6, borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#F1F0F0' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  messageImage: { width: 200, height: 140, borderRadius: 12, marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6 },
  timeText: { fontSize: 11 },

  typingContainer: { flexDirection: 'row', alignItems: 'center', padding: 6 },
  typingDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.9 },
  typingRow: { paddingHorizontal: 12, paddingBottom: 6 },

  composer: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  iconWrap: { padding: 6 },
  inputWrap: { flex: 1, marginHorizontal: 8 },
  input: { minHeight: 40, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'transparent' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

export default WhatsAppChatScreen;
