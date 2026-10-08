// components/MapViewFallback.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Web fallback for react-native-maps
 * Since maps don't support web, we provide a placeholder
 */
export const MapView = ({ children, style, ...props }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Map not available on web</Text>
      {children}
    </View>
  );
};

export const Marker = ({ children, ...props }) => {
  return <View>{children}</View>;
};

export const Callout = ({ children, ...props }) => {
  return <View>{children}</View>;
};

export const UrlTile = () => null;

export const Region = null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});
