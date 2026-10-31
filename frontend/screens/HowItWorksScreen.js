// screens/HowItWorksScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import SharedBottomNav from '../components/SharedBottomNav';
import { useContactInfo, useContactLinks } from '../services/contactInfo';


const { width } = Dimensions.get('window');

// Translations – same as in Settings
const translations = {
  English: {
    howItWorks: 'How the App Works',
    howItWorksDesc: 'SHAAKA helps you buy and sell locally. Post your products, browse shops, and connect with buyers.',
    followUs: 'Talk to us on social media',
  },
  Kinyarwanda: {
    howItWorks: 'Uko shaaka ikora',
    howItWorksDesc: 'SHAAKA igufasha kugura no kugurisha. Tangaza ibicuruzwa byawe, reba amaduka, kandi uvugane n\'abaguzi.',
    followUs: 'Twandikire ku mbuga nkoranyambaga',
  },
};

export default function HowItWorksScreen({ navigation, language = 'English' }) {
  const { theme, isDarkMode } = useTheme();
  const contactInfo = useContactInfo();
  const socialLinks = useContactLinks(contactInfo);
  const t = translations[language] || translations.English;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['']}>
      {/* ---- Hero Gradient Header ---- */}
      <LinearGradient
        colors={isDarkMode ? [theme.background, theme.textSecondary, theme.text] : ['#e5e7eb', '#9ca3af', '#4b5563']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroHeader}
      >
        <View style={styles.heroDecorCircleLg} />
        <View style={styles.heroDecorCircleSm} />
       
        <Text style={styles.heroTitle}>{t.howItWorks}</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Description Card ---- */}
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border, borderLeftWidth: 0 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={28} color={theme.accent} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{t.howItWorks}</Text>
          </View>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {t.howItWorksDesc}
          </Text>
        </View>

        {/* ---- Social Links Card ---- */}
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border, borderTopWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="share-social-outline" size={28} color={theme.accent} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{t.followUs}</Text>
          </View>
          <View style={styles.socialGrid}>
            {socialLinks.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.socialItem}
                onPress={() => openSocialLink(item.url, item.fallbackUrl)}
                activeOpacity={0.7}
              >
                <View style={[styles.socialCircle, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={32} color="#fff" />
                </View>
                <Text style={[styles.socialName, { color: theme.textSecondary }]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero Header
  heroHeader: {
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  heroDecorCircleLg: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  heroDecorCircleSm: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -20,
  },
  backButton: {
    padding: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
    marginLeft: 4,
  },

  content: {
    paddingHorizontal: 6,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Cards
  card: {
    borderRadius: 16,
    padding: 5,

    marginBottom: 20,
    shadowColor: '#00000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 0,
  },

  // Social Grid
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  socialItem: {
    width: (width - 32) / 5 - 12, // 3 columns with spacing
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 6,
  },
  socialCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  socialName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
});