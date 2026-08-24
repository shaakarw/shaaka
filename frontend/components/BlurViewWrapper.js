import React from 'react';
import { View } from 'react-native';

let ExpoBlurView = View;

try {
  const ExpoBlur = require('expo-blur');
  ExpoBlurView = ExpoBlur.BlurView || View;
} catch (error) {
  // expo-blur is optional; fall back to a plain container when unavailable.
}

const BlurViewWrapper = ({ children, style, ...props }) => {
  return (
    <ExpoBlurView style={style} {...props}>
      {children}
    </ExpoBlurView>
  );
};

export default BlurViewWrapper;
