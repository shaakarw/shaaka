import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const SharedBottomNav = ({ onMenuPress = () => {}, leftActionText = 'Menu', style }) => {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={onMenuPress} style={styles.button}>
        <Text style={styles.text}>{leftActionText}</Text>
      </TouchableOpacity>
      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
});

export default SharedBottomNav;
