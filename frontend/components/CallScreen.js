// components/CallScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ImageBackground,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';

const { width, height } = Dimensions.get('window');
const DEFAULT_AVATAR = require('../assets/profile.png');
const chatBackground = require('../assets/chartbackground.png');

const RemoteVideoPlaceholder = () => (
  <View style={styles.remoteVideoPlaceholder}>
    <Ionicons name="videocam-outline" size={60} color="#fff" />
  </View>
);

const CallScreen = () => {
  const { theme } = useTheme();
  const {
    callType,
    callerName,
    callerAvatar,
    isMuted,
    isCameraOn,
    isSpeakerOn,
    callDuration,
    endCall,
    minimizeCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    toggleFrontCamera,
    formatDuration,
  } = useCall();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const isVideo = callType === 'video';
  const avatarSource = callerAvatar ? { uri: callerAvatar } : DEFAULT_AVATAR;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ImageBackground source={chatBackground} style={styles.backgroundImage} resizeMode="cover">
        <View style={[styles.overlay, { backgroundColor: theme.background, opacity: 0.7 }]} />

        {/* Header */}
        <SafeAreaView style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={avatarSource} style={styles.headerAvatar} />
            <View style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: theme.text }]}>{callerName}</Text>
              <Text style={[styles.headerStatus, { color: theme.textSecondary }]}>
                {formatDuration(callDuration)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={minimizeCall} style={styles.headerBtn}>
            <Ionicons name="remove-outline" size={28} color={theme.text} />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Main content */}
        <View style={styles.mainContent}>
          {isVideo ? (
            <View style={styles.videoContainer}>
              <View style={styles.remoteVideo}>
                <RemoteVideoPlaceholder />
              </View>
              <View style={styles.localPreview}>
                <View style={[styles.localCamera, { backgroundColor: isCameraOn ? '#333' : '#111' }]}>
                  {isCameraOn ? (
                    <Ionicons name="camera" size={40} color="#fff" />
                  ) : (
                    <Ionicons name="camera-off" size={40} color="#fff" />
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.audioContent}>
              <Image source={avatarSource} style={styles.audioAvatar} />
              <Text style={[styles.audioName, { color: theme.text }]}>{callerName}</Text>
              <Text style={[styles.audioStatus, { color: theme.textSecondary }]}>
                {formatDuration(callDuration)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom controls */}
        <SafeAreaView style={styles.controlsContainer}>
          <View style={[styles.controls, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
            </TouchableOpacity>

            {isVideo && (
              <TouchableOpacity style={styles.controlBtn} onPress={toggleCamera}>
                <Ionicons name={isCameraOn ? 'camera' : 'camera-off'} size={28} color="#fff" />
              </TouchableOpacity>
            )}

            {isVideo && (
              <TouchableOpacity style={styles.controlBtn} onPress={toggleFrontCamera}>
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.controlBtn} onPress={toggleSpeaker}>
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
              <Ionicons name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerInfo: {
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 13,
  },
  headerBtn: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  remoteVideo: {
    flex: 1,
  },
  localPreview: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioContent: {
    alignItems: 'center',
  },
  audioAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  audioName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  audioStatus: {
    fontSize: 16,
  },
  controlsContainer: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 40,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallBtn: {
    backgroundColor: '#ff3b30',
  },
});

export default CallScreen;