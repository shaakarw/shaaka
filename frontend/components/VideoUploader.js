import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getVideoMetaData } from '../utils/videoCompressor';

const VideoUploader = ({ value, onChange, videoLink, onVideoLinkChange, theme, disabled = false, disabledMessage = 'Video uploads are not allowed for this account. Please contact the admin for support.' }) => {
  const [picking, setPicking] = useState(false);
  const [resizeNotice, setResizeNotice] = useState('');
  const selectVideo = async () => {
    if (disabled) {
      onChange(null, disabledMessage);
      return;
    }
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Please allow gallery access to select a video.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        let uri = asset.uri;
        let dimensions = Platform.OS === 'web'
          ? { width: asset.width, height: asset.height }
          : await getVideoMetaData(uri);
        const sourceHeight = Number(asset.height) || Number(dimensions.height);

        if (!Number.isFinite(sourceHeight)) {
          throw new Error('Unable to read this video\'s dimensions. Please select another video.');
        }
        const extension = String(dimensions.extension || 'mp4').toLowerCase();
        onChange({
          uri,
          type: extension === 'mov' ? 'video/quicktime' : `video/${extension}`,
          name: uri !== asset.uri ? `post_${Date.now()}.${extension}` : asset.fileName || `post_${Date.now()}.mp4`,
          duration: asset.duration ? asset.duration / 1000 : Number(dimensions.duration) || 0,
          size: Number(asset.fileSize) || 0,
          width: Number(dimensions.width) || Number(asset.width),
          height: Number(dimensions.height) || Number(asset.height),
          originalWidth: Number(asset.width) || Number(dimensions.width),
          originalHeight: sourceHeight,
        });
      }
    } catch (error) {
      setResizeNotice('');
      onChange(null, error.message || 'Unable to select video.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { borderColor: theme.border, backgroundColor: disabled ? theme.border : theme.cardBackground, opacity: disabled ? 0.7 : 1 }]}
        onPress={selectVideo}
        disabled={picking || disabled}
      >
        {picking ? <ActivityIndicator color={theme.accent} /> : <Ionicons name="videocam-outline" size={26} color={disabled ? theme.textSecondary : theme.accent} />}
        <Text style={[styles.buttonText, { color: disabled ? theme.textSecondary : theme.text }]}>{value ? 'Change video' : disabled ? 'Video not allowed' : 'Add a video'}</Text>
      </TouchableOpacity>
      {value ? (
        <TouchableOpacity style={styles.remove} onPress={() => { setResizeNotice(''); onChange(null); }}>
          <Ionicons name="close-circle" size={22} color="#d87428" />
          <Text style={{ color: theme.textSecondary }}>Remove video</Text>
        </TouchableOpacity>
      ) : null}
      {resizeNotice ? <Text style={[styles.notice, { color: theme.textSecondary }]}>{resizeNotice}</Text> : null}
      <TextInput
        style={[styles.linkInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
        placeholder="Video link (optional)"
        placeholderTextColor={theme.textSecondary}
        value={videoLink}
        onChangeText={onVideoLinkChange}
        editable={!disabled}
        selectTextOnFocus={!disabled}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 14 },
  button: { minHeight: 54, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  notice: { fontSize: 12, marginTop: 8 },
  linkInput: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginTop: 10 },
});

export default VideoUploader;
