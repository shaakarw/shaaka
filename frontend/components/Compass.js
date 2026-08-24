import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Compass({ theme, onHeadingChange, mapBearing = 0 }) {
  const [heading, setHeading] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);
  const rotationAnim = useRef(new Animated.Value(0)).current;

  // Update compass needle based on map bearing
  useEffect(() => {
    Animated.timing(rotationAnim, {
      toValue: mapBearing,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setHeading(mapBearing);
  }, [mapBearing, rotationAnim]);

  useEffect(() => {
    let subscription;
    const startTracking = async () => {
      try {
        const isHeadingAvailable = await Location.hasServicesEnabledAsync();
        if (!isHeadingAvailable) {
          setIsAvailable(false);
          return;
        }

        // Request permission for heading
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          subscription = await Location.watchHeadingAsync((headingData) => {
            if (headingData.magHeading !== undefined) {
              const newHeading = headingData.magHeading;
              // Callback to parent to update map rotation
              if (onHeadingChange) {
                onHeadingChange(newHeading);
              }
            }
          });
        }
      } catch (error) {
        console.log('Compass availability:', error);
        setIsAvailable(false);
      }
    };

    startTracking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [onHeadingChange]);

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // Direction labels
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const angleStep = 45; // 360 / 8 directions

  // Calculate main direction from heading
  const getMainDirection = (h) => {
    const normalized = ((h % 360) + 360) % 360;
    const index = Math.round(normalized / angleStep) % 8;
    return directions[index];
  };

  if (!isAvailable) {
    return (
      <View style={[styles.compassContainer, { borderColor: theme.border }]}>
        <Text style={[styles.noCompassText, { color: theme.textSecondary }]}>N</Text>
      </View>
    );
  }

  const mainDirection = getMainDirection(heading);

  return (
    <View style={[styles.compassContainer, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {/* Compass Rose Background */}
      <View style={styles.compassRoseContainer}>
        {/* Outer circle grid */}
        <View style={[styles.compassGrid, { borderColor: theme.border }]}>
          {/* Inner circle */}
          <View style={[styles.innerCircle, { borderColor: theme.border }]} />
        </View>

        {/* Cardinal direction labels - positioned around the compass */}
        <View style={[styles.directionLabel, styles.northLabel]}>
          <Text style={[styles.directionText, { color: theme.accent }]}>N</Text>
        </View>
        <View style={[styles.directionLabel, styles.southLabel]}>
          <Text style={[styles.directionText, { color: theme.accent }]}>S</Text>
        </View>
        <View style={[styles.directionLabel, styles.eastLabel]}>
          <Text style={[styles.directionText, { color: theme.accent }]}>E</Text>
        </View>
        <View style={[styles.directionLabel, styles.westLabel]}>
          <Text style={[styles.directionText, { color: theme.accent }]}>W</Text>
        </View>

        {/* Intercardinal direction labels */}
        <View style={[styles.directionLabel, styles.neLabel]}>
          <Text style={[styles.intercardinalText, { color: theme.textSecondary }]}>NE</Text>
        </View>
        <View style={[styles.directionLabel, styles.seLabel]}>
          <Text style={[styles.intercardinalText, { color: theme.textSecondary }]}>SE</Text>
        </View>
        <View style={[styles.directionLabel, styles.swLabel]}>
          <Text style={[styles.intercardinalText, { color: theme.textSecondary }]}>SW</Text>
        </View>
        <View style={[styles.directionLabel, styles.nwLabel]}>
          <Text style={[styles.intercardinalText, { color: theme.textSecondary }]}>NW</Text>
        </View>

        {/* Rotating needle arrow pointing north (top of device) */}
        <Animated.View
          style={[
            styles.needle,
            {
              transform: [{ rotate: rotation }],
            },
          ]}
        >
          {/* Upper half (pointing north) - blue */}
          <View style={[styles.needleHalf, styles.needleNorth, { backgroundColor: theme.accent }]} />
          {/* Lower half (pointing south) - light gray */}
          <View style={[styles.needleHalf, styles.needleSouth, { backgroundColor: theme.textSecondary }]} />
        </Animated.View>

        {/* Center dot/indicator */}
        <View style={[styles.centerDot, { backgroundColor: theme.accent }]} />
      </View>

      {/* Heading text below compass */}
      <View style={styles.headingInfo}>
        <Text style={[styles.headingValue, { color: theme.accent }]}>{heading.toFixed(0)}°</Text>
        <Text style={[styles.mainDirectionText, { color: theme.text }]}>{mainDirection}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 140,
    height: 180,
    borderTopRightRadius: 12,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  compassRoseContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compassGrid: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
  },
  directionLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  northLabel: {
    top: 2,
    left: '50%',
    marginLeft: -10,
  },
  southLabel: {
    bottom: 2,
    left: '50%',
    marginLeft: -10,
  },
  eastLabel: {
    right: 2,
    top: '50%',
    marginTop: -10,
  },
  westLabel: {
    left: 2,
    top: '50%',
    marginTop: -10,
  },
  neLabel: {
    top: 8,
    right: 8,
  },
  seLabel: {
    bottom: 8,
    right: 8,
  },
  swLabel: {
    bottom: 8,
    left: 8,
  },
  nwLabel: {
    top: 8,
    left: 8,
  },
  directionText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  intercardinalText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  needle: {
    position: 'absolute',
    width: 3,
    height: 60,
    top: '50%',
    left: '50%',
    marginLeft: -1.5,
    marginTop: -30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  needleHalf: {
    width: 3,
    height: 30,
  },
  needleNorth: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  needleSouth: {
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    opacity: 0.5,
  },
  centerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    top: '50%',
    left: '50%',
    marginLeft: -5,
    marginTop: -5,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  headingInfo: {
    alignItems: 'center',
    paddingTop: 4,
  },
  headingValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mainDirectionText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  noCompassText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
