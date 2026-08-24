// components/FloatingCallWidget.js
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  PanResponder,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WIDGET_SIZE = 80;
const DEFAULT_AVATAR = require('../assets/profile.png');

const FloatingCallWidget = () => {
  const { theme } = useTheme();
  const {
    isCallActive,
    isCallMinimized,
    callType,
    callerName,
    callerAvatar,
    isMuted,
    isCameraOn,
    callDuration,
    restoreCall,
    endCall,
    formatDuration,
  } = useCall();

  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - WIDGET_SIZE - 16, y: SCREEN_HEIGHT - WIDGET_SIZE - 160 })).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setIsDragging(true),
      onPanResponderMove: (_, gesture) => {
        let newX = gesture.dx + pan.x._value;
        let newY = gesture.dy + pan.y._value;
        newX = Math.max(0, Math.min(SCREEN_WIDTH - WIDGET_SIZE, newX));
        newY = Math.max(0, Math.min(SCREEN_HEIGHT - WIDGET_SIZE - 50, newY));
        pan.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: () => setIsDragging(false),
    })
  ).current;

  useEffect(() => {
    pan.setValue({ x: SCREEN_WIDTH - WIDGET_SIZE - 16, y: SCREEN_HEIGHT - WIDGET_SIZE - 160 });
  }, []);

  if (!isCallActive || !isCallMinimized) return null;

  const isVideo = callType === 'video';
  const avatarSource = callerAvatar ? { uri: callerAvatar } : DEFAULT_AVATAR;

  return (
    <Animated.View
      style={[
        styles.widgetContainer,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.widgetTouchable}
        onPress={restoreCall}
        activeOpacity={0.8}
      >
        {isVideo ? (
          <View style={styles.videoPreview}>
            <View style={[styles.videoPlaceholder, { backgroundColor: isCameraOn ? '#333' : '#111' }]}>
              {isCameraOn ? (
                <Ionicons name="camera" size={30} color="#fff" />
              ) : (
                <Ionicons name="camera-off" size={30} color="#fff" />
              )}
            </View>
          </View>
        ) : (
          <Image source={avatarSource} style={styles.avatar} />
        )}

        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {callerName}
          </Text>
          <Text style={[styles.duration, { color: theme.textSecondary }]}>
            {formatDuration(callDuration)}
          </Text>
        </View>

        <View style={styles.statusIcons}>
          {isMuted && <Ionicons name="mic-off" size={14} color="#ff3b30" />}
          {isVideo && !isCameraOn && <Ionicons name="camera-off" size={14} color="#ff3b30" />}
        </View>

        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <Ionicons name="call" size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  widgetContainer: {
    position: 'absolute',
    width: WIDGET_SIZE,
    height: WIDGET_SIZE + 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99999,
  },
  widgetTouchable: {
    flex: 1,
    alignItems: 'center',
    padding: 4,
  },
  videoPreview: {
    width: WIDGET_SIZE - 8,
    height: WIDGET_SIZE - 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: WIDGET_SIZE - 8,
    height: WIDGET_SIZE - 8,
    borderRadius: 36,
  },
  info: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
  },
  duration: {
    fontSize: 9,
  },
  statusIcons: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
  },
  endBtn: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    backgroundColor: '#ff3b30',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FloatingCallWidget;