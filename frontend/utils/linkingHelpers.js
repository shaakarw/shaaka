import { Alert, Linking, Platform } from 'react-native';

const STORE_URLS = {
  instagram: {
    android: 'market://details?id=com.instagram.android',
    ios: 'https://apps.apple.com/app/instagram/id389801252',
  },
  twitter: {
    android: 'market://details?id=com.twitter.android',
    ios: 'https://apps.apple.com/app/twitter/id333903271',
  },
  facebook: {
    android: 'market://details?id=com.facebook.katana',
    ios: 'https://apps.apple.com/app/facebook/id284882215',
  },
  whatsapp: {
    android: 'market://details?id=com.whatsapp',
    ios: 'https://apps.apple.com/app/whatsapp-messenger/id310633997',
  },
  youtube: {
    android: 'market://details?id=com.google.android.youtube',
    ios: 'https://apps.apple.com/app/youtube-watch-listen-stream/id544007664',
  },
};

const getStoreUrlForDeepLink = (url) => {
  if (!url) return null;
  if (url.startsWith('instagram://')) return STORE_URLS.instagram?.[Platform.OS];
  if (url.startsWith('twitter://')) return STORE_URLS.twitter?.[Platform.OS];
  if (url.startsWith('fb://') || url.startsWith('facebook://')) return STORE_URLS.facebook?.[Platform.OS];
  if (url.startsWith('whatsapp://')) return STORE_URLS.whatsapp?.[Platform.OS];
  if (url.startsWith('vnd.youtube://') || url.includes('youtube.com')) return STORE_URLS.youtube?.[Platform.OS];
  return null;
};

export const openSocialLink = async (url, fallbackUrl = null) => {
  if (!url) {
    if (fallbackUrl) {
      return Linking.openURL(fallbackUrl);
    }
    return Alert.alert('Error', 'Unable to open link.');
  }

  const storeUrl = getStoreUrlForDeepLink(url);

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
  } catch (error) {
    // Continue to fallback handling below.
  }

  if (storeUrl) {
    try {
      await Linking.openURL(storeUrl);
      return;
    } catch (error) {
      // If store link fails, continue to fallback below.
    }
  }

  if (fallbackUrl) {
    try {
      await Linking.openURL(fallbackUrl);
      return;
    } catch (error) {
      // Last resort fallback failed.
    }
  }

  Alert.alert('Error', 'Unable to open link.');
};
