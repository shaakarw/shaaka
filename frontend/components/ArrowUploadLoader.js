import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const ArrowUploadLoader = ({ color = '#fff', size = 58 }) => {
  const translateY = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0.2)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -18,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 18,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.2,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.9,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, scale, translateY]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.arrow,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <Text style={[styles.arrowText, { color, fontSize: size * 0.72 }]}>↑</Text>
      </Animated.View>
      <View style={[styles.base, { backgroundColor: color, width: size * 0.5 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  arrowText: {
    fontWeight: '700',
    lineHeight: 48,
  },
  base: {
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
    marginBottom: 6,
  },
});

export default ArrowUploadLoader;
