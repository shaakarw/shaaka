import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getVideoMetaData } from '../utils/videoCompressor';
import { requestVideoBackground } from '../services/videoBackgroundService';

const UNSUPPORTED_VIDEO_MESSAGE = 'Unsupported video. Please select a valid video with a readable duration.';
const MAX_POST_VIDEO_DURATION_SECONDS = 120;

const readBrowserVideoMetadata = uri => new Promise((resolve, reject) => {
  const video = document.createElement('video');
  let timeout;
  const cleanup = () => {
    clearTimeout(timeout);
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
  };
  video.onloadedmetadata = () => {
    const metadata = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
    cleanup();
    resolve(metadata);
  };
  video.onerror = () => {
    cleanup();
    reject(new Error(UNSUPPORTED_VIDEO_MESSAGE));
  };
  timeout = setTimeout(() => {
    cleanup();
    reject(new Error(UNSUPPORTED_VIDEO_MESSAGE));
  }, 15000);
  video.preload = 'metadata';
  video.src = uri;
  video.load();
});

export const readSelectedVideoMetadata = async uri => {
  let metadata;
  try {
    metadata = Platform.OS === 'web'
      ? await readBrowserVideoMetadata(uri)
      : await getVideoMetaData(uri);
  } catch {
    throw new Error(UNSUPPORTED_VIDEO_MESSAGE);
  }
  const duration = Number(metadata.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(UNSUPPORTED_VIDEO_MESSAGE);
  }
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Unable to read this video\'s dimensions. Please select another video.');
  }
  return { ...metadata, duration, width, height };
};

const VideoUploader = ({ value, onChange, onValidationChange, videoLink, onVideoLinkChange, theme, disabled = false, disabledMessage = 'Video uploads are not allowed for this account. Please contact the admin for support.' }) => {
  const [picking, setPicking] = useState(false);
  const [resizeNotice, setResizeNotice] = useState('');
  const selectVideo = async () => {
    if (disabled) {
      onChange(null, disabledMessage);
      return;
    }
    setPicking(true);
    onValidationChange?.(true);
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
        const uri = asset.uri;
        const dimensions = await readSelectedVideoMetadata(uri);
        const extension = String(dimensions.extension || 'mp4').toLowerCase();
        const selectedVideo = {
          uri,
          type: asset.mimeType || (extension === 'mov' ? 'video/quicktime' : `video/${extension}`),
          name: uri !== asset.uri ? `post_${Date.now()}.${extension}` : asset.fileName || `post_${Date.now()}.mp4`,
          duration: dimensions.duration,
          size: Number(asset.fileSize) || 0,
          width: dimensions.width,
          height: dimensions.height,
          originalWidth: dimensions.width,
          originalHeight: dimensions.height,
        };
        setResizeNotice(
          selectedVideo.duration > MAX_POST_VIDEO_DURATION_SECONDS
            ? 'Only the first 2 minutes of this video will be posted.'
            : ''
        );
        await onChange(selectedVideo);
        if (selectedVideo.duration > 0) {
          requestVideoBackground({
            uri: selectedVideo.uri,
            duration: selectedVideo.duration,
            width: selectedVideo.width,
            height: selectedVideo.height,
            size: selectedVideo.size,
          }).catch(error => {
            console.warn('Could not prepare the selected video background:', error.name || 'Unknown error');
          });
        }
      }
    } catch (error) {
      setResizeNotice('');
      onChange(null, error.message || UNSUPPORTED_VIDEO_MESSAGE);
    } finally {
      setPicking(false);
      onValidationChange?.(false);
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
