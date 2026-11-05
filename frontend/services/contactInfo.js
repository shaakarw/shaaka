import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../constants';

export const DEFAULT_CONTACT_INFO = {
  instagram: 'https://www.instagram.com/shaaka_rw/',
  youtube: 'https://www.youtube.com/@shaaka-rw',
  twitter: 'https://x.com/shaaka_rw',
  facebook: 'https://www.facebook.com/profile.php?id=61592686307072',
  email: 'shaakarw@gmail.com',
  whatsapp: '+250799882580',
  website: '',
  other: '',
  other2: '',
  other3: '',
  other4: '',
  other5: '',
};

const CONTACT_LINKS = [
  { key: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
  { key: 'twitter', name: 'X', icon: 'logo-x', color: '#000000' },
  { key: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { key: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { key: 'email', name: 'Email', icon: 'mail-outline', color: '#D44638' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { key: 'website', name: 'Website', icon: 'globe-outline', color: '#3478C8' },
  { key: 'other', name: 'Other 1', icon: 'link-outline', color: '#737373' },
  { key: 'other2', name: 'Other 2', icon: 'link-outline', color: '#737373' },
  { key: 'other3', name: 'Other 3', icon: 'link-outline', color: '#737373' },
  { key: 'other4', name: 'Other 4', icon: 'link-outline', color: '#737373' },
  { key: 'other5', name: 'Other 5', icon: 'link-outline', color: '#737373' },
];

const OTHER_CONTACT_BRANDS = [
  { domains: ['instagram.com'], name: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
  { domains: ['x.com', 'twitter.com'], name: 'X', icon: 'logo-x', color: '#000000' },
  { domains: ['youtube.com', 'youtu.be'], name: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { domains: ['facebook.com', 'fb.com'], name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { domains: ['whatsapp.com', 'wa.me'], name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { domains: ['tiktok.com'], name: 'TikTok', icon: 'logo-tiktok', color: '#000000' },
  { domains: ['linkedin.com'], name: 'LinkedIn', icon: 'linkedin', iconFamily: 'materialCommunity', color: '#0A66C2' },
  { domains: ['snapchat.com'], name: 'Snapchat', icon: 'snapchat', iconFamily: 'materialCommunity', color: '#FFFC00' },
  { domains: ['discord.com', 'discord.gg'], name: 'Discord', icon: 'discord', iconFamily: 'materialCommunity', color: '#5865F2' },
  { domains: ['telegram.org', 't.me'], name: 'Telegram', icon: 'telegram', iconFamily: 'materialCommunity', color: '#26A5E4' },
  { domains: ['pinterest.com'], name: 'Pinterest', icon: 'pinterest', iconFamily: 'materialCommunity', color: '#BD081C' },
  { domains: ['reddit.com'], name: 'Reddit', icon: 'reddit', iconFamily: 'materialCommunity', color: '#FF4500' },
  { domains: ['github.com'], name: 'GitHub', icon: 'github', iconFamily: 'materialCommunity', color: '#24292F' },
  { domains: ['twitch.tv'], name: 'Twitch', icon: 'twitch', iconFamily: 'materialCommunity', color: '#9146FF' },
  { domains: ['spotify.com'], name: 'Spotify', icon: 'spotify', iconFamily: 'materialCommunity', color: '#1DB954' },
];

const withHttps = value => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const buildSocialUrl = (value, defaultHost) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+$/.test(trimmed.replace(/^@/, ''))) {
    return `${defaultHost}${trimmed.replace(/^@/, '')}`;
  }
  return withHttps(trimmed);
};

const getDomain = url => {
  const match = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase().replace(/^www\./, '').split(':')[0] || '';
};

const getOtherContactDetails = (url, fallback) => {
  const domain = getDomain(url);
  const brand = OTHER_CONTACT_BRANDS.find(({ domains }) => domains.some(
    brandDomain => domain === brandDomain || domain.endsWith(`.${brandDomain}`)
  ));
  return brand ? { ...fallback, ...brand } : fallback;
};

export const createContactLinks = contactInfo => CONTACT_LINKS.flatMap(item => {
  const value = String(contactInfo?.[item.key] || '').trim();
  if (!value) return [];

  let url = value;
  if (item.key === 'instagram') url = buildSocialUrl(value, 'https://www.instagram.com/');
  if (item.key === 'youtube') url = buildSocialUrl(value, 'https://www.youtube.com/@');
  if (item.key === 'twitter') url = buildSocialUrl(value, 'https://x.com/');
  if (item.key === 'facebook') url = buildSocialUrl(value, 'https://www.facebook.com/');
  if (item.key === 'email') url = value.toLowerCase().startsWith('mailto:') ? value : `mailto:${value}`;
  if (item.key === 'whatsapp') {
    if (/^https?:\/\//i.test(value)) {
      url = value;
    } else {
      const phone = value.replace(/[^\d]/g, '');
      if (!phone) return [];
      url = `https://wa.me/${phone}`;
    }
  }
  if (item.key === 'website' || item.key.startsWith('other')) url = withHttps(value);

  const contactItem = item.key.startsWith('other')
    ? getOtherContactDetails(url, item)
    : item;
  return [{ ...contactItem, url, fallbackUrl: null }];
});

export const useContactLinks = contactInfo => useMemo(
  () => createContactLinks(contactInfo),
  [contactInfo]
);

export const useContactInfo = () => {
  const [contactInfo, setContactInfo] = useState(DEFAULT_CONTACT_INFO);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      axios.get(`${BASE_URL}/api/settings/contact-info`)
        .then(response => {
          if (isActive && response.data?.success && response.data.contactInfo) {
            setContactInfo({ ...DEFAULT_CONTACT_INFO, ...response.data.contactInfo });
          }
        })
        .catch(error => {
          console.warn('Could not load contact information:', error.message);
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  return contactInfo;
};
