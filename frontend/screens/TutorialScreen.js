
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { normalizeImageSource } from '../utils/imageUrl';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TutorialScreen({ navigation, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const emptyBackground = isDarkMode ? '#dddddd' : '#111111';

  useEffect(() => {
    let active = true;

    axios.get(`${BASE_URL}/api/settings/tutorial-image`)
      .then((response) => {
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Could not load the tutorial image.');
        }
        if (active) setImageUrl(response.data.tutorialImage?.url || null);
      })
      .catch((requestError) => {
        console.error('Could not load tutorial image:', requestError);
        if (active) setError('Could not load the tutorial. Please try again later.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: imageUrl ? theme.background : emptyBackground }]}
      edges={['top', 'bottom']}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel={language === 'English' ? 'Go back' : 'Subira inyuma'}
      >
        <Ionicons
          name="chevron-back"
          size={26}
          color={imageUrl ? theme.text : isDarkMode ? '#111111' : '#ffffff'}
        />
      </TouchableOpacity>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : error ? (
          <Text style={[styles.error, { color: isDarkMode ? '#111111' : '#ffffff' }]}>{error}</Text>
        ) : imageUrl ? (
          <ScrollView style={styles.imageScroll} contentContainerStyle={styles.imageContent}>
            <Image
              source={normalizeImageSource({ uri: imageUrl })}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Shaaka tutorial"
              onError={() => setError('Could not display the tutorial image.')}
            />
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageScroll: { flex: 1, width: '100%' },
  imageContent: { paddingVertical: 2 },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.82,
  },
  error: {
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
