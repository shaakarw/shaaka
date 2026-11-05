import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { BASE_URL } from '../constants';
import { normalizeImageSource } from '../utils/imageUrl';

export default function TutorialScreen({ language = 'English' }) {
  const { theme } = useTheme();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageAspectRatios, setImageAspectRatios] = useState({});
  const isEnglish = language === 'English';
  const tutorialImages = sections.flatMap((section, sectionIndex) =>
    (section.images || []).map((image, imageIndex) => ({
      ...image,
      sectionId: section.id || `section-${sectionIndex}`,
      sectionTitle: section.title,
      imageIndex,
    }))
  );

  useEffect(() => {
    let active = true;

    axios.get(`${BASE_URL}/api/settings/tutorial-image`)
      .then((response) => {
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Could not load the tutorial.');
        }
        if (active) {
          if (Array.isArray(response.data.sections)) {
            setSections(response.data.sections);
          } else if (response.data.tutorialImage?.url) {
            setSections([{
              id: 'tutorial',
              title: isEnglish ? 'Tutorial' : 'Inyigisho',
              images: [{ url: response.data.tutorialImage.url }],
            }]);
          }
        }
      })
      .catch((requestError) => {
        console.error('Could not load tutorial:', requestError);
        if (active) setError(isEnglish ? 'Could not load the tutorial. Please try again later.' : 'Ntibyashobotse kubona inyigisho. Ongera ugerageze nyuma.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isEnglish]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      ) : tutorialImages.length ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {tutorialImages.map(image => {
            const imageKey = `${image.sectionId}-${image.storageKey || image.url || image.imageIndex}`;
            const aspectRatio = imageAspectRatios[imageKey];
            return (
              <Image
                key={imageKey}
                source={normalizeImageSource({ uri: image.url })}
                style={[
                  styles.image,
                  aspectRatio ? { aspectRatio, height: undefined } : null,
                  { backgroundColor: theme.cardBackground || theme.background },
                ]}
                resizeMode="contain"
                accessibilityLabel={`${image.sectionTitle}, ${isEnglish ? 'image' : 'ifoto'} ${image.imageIndex + 1}`}
                onLoad={({ nativeEvent }) => {
                  const { width, height } = nativeEvent.source || {};
                  if (width > 0 && height > 0) {
                    setImageAspectRatios(current => {
                      const nextRatio = width / height;
                      return current[imageKey] === nextRatio
                        ? current
                        : { ...current, [imageKey]: nextRatio };
                    });
                  }
                }}
                onError={() => setError(isEnglish ? 'Could not display a tutorial image.' : 'Ntibyashobotse kwerekana ifoto y’inyigisho.')}
              />
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {isEnglish ? 'No tutorial has been added yet.' : 'Nta nyigisho irashyirwaho.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  // 6px free space on top, left, right, and bottom — content centered
  content: {
    alignItems: 'center',        // centers each image horizontally
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 6,
  },
  image: {
    width: '96%',
    height: 400,
    borderRadius: 10,
    marginBottom: 6,             // 6px gap between images
    alignSelf: 'center',         // extra safety for centering
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 15, textAlign: 'center' },
});