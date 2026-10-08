import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

export default function BuyLoginSheet({ visible, onClose, onLogin, message }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.iconBadge}>
            <Ionicons name="log-in-outline" size={38} color="#47ae87" />
          </View>

          <Text style={styles.title}>Login Required</Text>
          {message ? <Text style={styles.subtitle}>{message}</Text> : null}

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={onLogin}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    minHeight: height * 0.32,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#cfcfcf',
    alignSelf: 'center',
    marginBottom: 18,
  },
  iconBadge: {
    width: 82,
    height: 82,
    alignSelf: 'center',
    borderRadius: 41,
    backgroundColor: '#edf9f3',
    borderWidth: 1,
    borderColor: '#47ae8733',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  subtitle: {
    color: '#5f6368',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#dfe3e8',
  },
  loginButton: {
    backgroundColor: '#47ae87',
    shadowColor: '#47ae87',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cancelText: { color: '#333', fontWeight: '700', fontSize: 16 },
  loginText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});