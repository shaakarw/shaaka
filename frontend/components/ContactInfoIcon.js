import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function ContactInfoIcon({ item, ...iconProps }) {
  const Icon = item.iconFamily === 'materialCommunity' ? MaterialCommunityIcons : Ionicons;
  return <Icon name={item.icon} {...iconProps} />;
}
