import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';

const VideoProgressBar = ({ progress = 0, onSeek, color = '#fff' }) => {
  const widthRef = useRef(0);
  const seekFromEvent = (event) => {
    if (!widthRef.current || !onSeek) return;
    const position = Math.max(0, Math.min(1, event.nativeEvent.locationX / widthRef.current));
    onSeek(position);
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gestureState) => onSeek?.(Math.max(0, Math.min(1, gestureState.x0 / Math.max(widthRef.current, 1)))),
    onPanResponderMove: (_, gestureState) => {
      if (!widthRef.current || !onSeek) return;
      onSeek(Math.max(0, Math.min(1, gestureState.moveX / widthRef.current)));
    },
  })).current;

  return (
    <View
      style={styles.track}
      onLayout={(event) => { widthRef.current = event.nativeEvent.layout.width; }}
      onTouchEnd={seekFromEvent}
      {...panResponder.panHandlers}
    >
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { height: 14, justifyContent: 'center', width: '100%' },
  fill: { height: 2, minWidth: 2 },
});

export default VideoProgressBar;
