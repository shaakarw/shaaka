import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AdminScreenHeader = ({
  title,
  theme,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
}) => (
  <View style={[styles.container, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
    <TouchableOpacity
      style={[styles.iconButton, { backgroundColor: theme.cardBackground }]}
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back-outline" size={21} color={theme.text} />
    </TouchableOpacity>
    <View style={styles.heading}>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>ADMINISTRATION</Text>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
    </View>
    {actionIcon && onAction ? (
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: theme.cardBackground }]}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Ionicons name={actionIcon} size={21} color={theme.accent} />
      </TouchableOpacity>
    ) : <View style={styles.iconButton} />}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, marginHorizontal: 12 },
  eyebrow: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700' },
});

export default AdminScreenHeader;