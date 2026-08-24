import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    minHeight: height * 0.22,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  subtitle: { color: '#666', marginBottom: 18 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginLeft: 10 },
  cancelButton: { backgroundColor: '#eee' },
  loginButton: { backgroundColor: '#007bff' },
  cancelText: { color: '#333' },
  loginText: { color: '#fff', fontWeight: '600' },
});