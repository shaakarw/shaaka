import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { networkStatus } from '../services/networkStatus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const loadingLogo = require('../assets/logos.png');

export default function ShaakaLoadingScreen({
  message = 'Loading...',
  textColor,
  backgroundColor,
  hideText = false,
  compact = false,
  inline = false,
}) {
  const { isDarkMode } = useTheme();
  const [isOnline, setIsOnline] = React.useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let unsubscribe;

    networkStatus.start().then(status => {
      if (!active) return;
      setIsOnline(status.isOnline);
      unsubscribe = networkStatus.subscribe(nextStatus => setIsOnline(nextStatus.isOnline));
    }).catch(() => {
      if (active) setIsOnline(false);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      scaleAnim.setValue(1);
      rotateAnim.setValue(0);
      return undefined;
    }

    const dance = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.timing(rotateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );

    dance.start();

    return () => {
      dance.stop();
    };
  }, [isOnline, rotateAnim, scaleAnim]);

  // Solid background colors for the main container
  const resolvedBackground =
    backgroundColor || (isDarkMode ? '#111111' : '#dddddd');
  const resolvedTextColor =
    textColor || (isDarkMode ? '#ffffff' : '#111111');

  return (
    <View
      style={[
        styles.container,
        inline && styles.inlineContainer,
        compact && styles.compactContainer,
        { backgroundColor: resolvedBackground },
      ]}
    >
      <Animated.Image
        source={loadingLogo}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            transform: [
              { scale: scaleAnim },
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: ['-6deg', '0deg', '6deg'],
                }),
              },
            ],
          },
        ]}
      />

      {!hideText && (
        <Text style={[styles.message, { color: resolvedTextColor }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  compactContainer: {
    paddingVertical: 16,
  },
  inlineContainer: {
    position: 'relative',
    width: '100%',
  },
  logo: {
    width: Math.min(120, SCREEN_WIDTH * 0.28),
    height: Math.min(120, SCREEN_WIDTH * 0.28),
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
});