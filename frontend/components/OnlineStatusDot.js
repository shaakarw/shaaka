import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function OnlineStatusDot({ visible, size = 12 }) {
  if (!visible) return null;

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          right: -2,
          bottom: -2,
          borderWidth: Math.max(2, Math.round(size / 6)),
        },
      ]}
      accessibilityLabel="Online"
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    backgroundColor: '#47ae87',
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
