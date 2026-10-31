import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { BASE_URL } from '../constants';

export const DEFAULT_CONTACT_INFO = {
  instagram: 'https://www.instagram.com/shaaka_rw/',
  youtube: 'https://www.youtube.com/@shaaka-rw',
  twitter: 'https://x.com/shaaka_rw',
  facebook: 'https://www.facebook.com/profile.php?id=61592686307072',
  tiktok: '',
  email: 'shaakarw@gmail.com',
  whatsapp: '+250799882580',
  phone: '+250796640462',
  alternatePhone: '+250799882580',
  website: '',
  other: '',
};

const CONTACT_LINKS = [
  { key: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
  { key: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { key: 'twitter', name: 'X', icon: 'logo-x', color: '#000000' },
  { key: 'facebook', name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { key: 'tiktok', name: 'TikTok', icon: 'musical-notes-outline', color: '#111111' },
  { key: 'email', name: 'Email', icon: 'mail-outline', color: '#D44638' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { key: 'phone', name: 'Phone', icon: 'call-outline', color: '#2E8B57' },
  { key: 'alternatePhone', name: 'Phone', icon: 'call-outline', color: '#2E8B57' },
  { key: 'website', name: 'Website', icon: 'globe-outline', color: '#3478C8' },
  { key: 'other', name: 'Other', icon: 'link-outline', color: '#737373' },
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

export const createContactLinks = contactInfo => CONTACT_LINKS.flatMap(item => {
  const value = String(contactInfo?.[item.key] || '').trim();
  if (!value) return [];

  let url = value;
  if (item.key === 'instagram') url = buildSocialUrl(value, 'https://www.instagram.com/');
  if (item.key === 'youtube') url = buildSocialUrl(value, 'https://www.youtube.com/@');
  if (item.key === 'twitter') url = buildSocialUrl(value, 'https://x.com/');
  if (item.key === 'facebook') url = buildSocialUrl(value, 'https://www.facebook.com/');
  if (item.key === 'tiktok') url = buildSocialUrl(value, 'https://www.tiktok.com/@');
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
  if (item.key === 'phone' || item.key === 'alternatePhone') {
    const phone = value.replace(/[^\d+]/g, '');
    if (!phone) return [];
    url = `tel:${phone}`;
  }
  if (item.key === 'website' || item.key === 'other') url = withHttps(value);

  return [{ ...item, url, fallbackUrl: null }];
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
