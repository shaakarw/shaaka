import React from 'react';
import {
  View,
  Text,
  FlatList,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../assets/logos.png';   // same logo as RegisterScreen

const { width, height } = Dimensions.get('window');

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const UpdateListScreen = ({ navigation, route }) => {
  const { updates } = route.params;   // passed from BuyPostScreen

  const renderUpdate = ({ item }) => (
    <View style={styles.glassCard}>
      <Ionicons
        name={
          item.type === 'new_post' ? 'add-circle-outline' :
          item.type === 'price_drop' ? 'trending-down-outline' :
          item.type === 'message' ? 'chatbubble-outline' :
          item.type === 'saved' ? 'bookmark-outline' :
          item.type === 'review' ? 'star-outline' :
          'notifications-outline'
        }
        size={22}
        color="#00bc38"
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.updateTitle}>{item.title}</Text>
        <Text style={styles.updateMessage} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.updateTime}>{formatTime(item.timestamp)}</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(item.title, item.fullDetails)
          }
        >
          <Text style={styles.viewMore}>View details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground source={Logo} style={styles.background} imageStyle={{ opacity: 0.05 }}>
        {/* Glass overlay */}
        <View style={styles.glassOverlay} />
        <FlatList
          data={updates}
          keyExtractor={(item) => item.id}
          renderItem={renderUpdate}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.header}>Updates</Text>
          }
        />
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, width: '100%', height: '100%' },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.4)',   // semi‑transparent glass
    backdropFilter: 'blur(10px)',               // web only, but gives the idea
  },
  listContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 50 },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  glassCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  updateTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  updateMessage: { fontSize: 14, color: '#555', marginBottom: 6 },
  updateTime: { fontSize: 11, color: '#999', marginBottom: 4 },
  viewMore: { fontSize: 13, color: '#00bc38', fontWeight: '600' },
});

export default UpdateListScreen;