import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Image } from 'react-native';
import { normalizeImageSource } from '../utils/imageUrl';


const AnimatedFrame = ({ uri, active, duration = 3 }) => {
  const scale = useRef(new Animated.Value(1.04)).current;

  useEffect(() => {
    if (!active) {
      scale.stopAnimation();
      scale.setValue(1.04);
      return undefined;
    }

    const halfCycle = Math.max(1500, Math.min(12000, Number(duration) * 500));
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: halfCycle,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.04,
          duration: halfCycle,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, duration, scale]);

  if (!uri) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ scale }] }]}>
      <Image
        source={normalizeImageSource({ uri })}
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
};

const VideoBackground = ({ frameUri, duration, active }) => (
  <View pointerEvents="none" style={styles.container}>
    <AnimatedFrame uri={frameUri} duration={duration} active={active} />
    <View style={styles.shade} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#222',
    zIndex: 0,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
});

export default VideoBackground;
