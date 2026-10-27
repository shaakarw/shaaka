import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const MobileNavigation = ({ visible = false }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  if (!visible || insets.bottom <= 0) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.container,
        { height: insets.bottom, backgroundColor: theme.background },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});

export default MobileNavigation;
