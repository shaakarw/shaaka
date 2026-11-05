// components/ScreenTutorialOverlay.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function ScreenTutorialOverlay({
  visible,
  steps,
  isDarkMode,
  language = 'English',
  onFinish,
  padding = 8,
  dimOpacity = 0,
  scrollRef,
  scrollDelayMs = 350,
  scrollY = 0,                 // signal to re-check visibility on scroll
  waitForVisibility = false,   // wait for off-screen targets
  shakeOnOutsidePress = true,
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [waitingForScroll, setWaitingForScroll] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  // ---- Shake animation ----
  const shake = useRef(new Animated.Value(0)).current;
  const lastShakeAt = useRef(0);

  const triggerShake = useCallback(() => {
    const now = Date.now();
    if (now - lastShakeAt.current < 650) return;
    lastShakeAt.current = now;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1,  duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1,  duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const shakeStyle = {
    transform: [
      {
        translateX: shake.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-8, 0, 8],
        }),
      },
    ],
  };

  const currentStep = steps[index];

  useEffect(() => {
    if (visible) {
      setIndex(0);
      setRect(null);
      setWaitingForScroll(false);
      opacity.setValue(0);
      shake.setValue(0);
    }
  }, [visible, opacity, shake]);

  useEffect(() => {
    if (!visible || !currentStep) return;
    setRect(null);

    let delay = 80;
    if (scrollRef?.current && currentStep.scroll === 'top') {
      scrollRef.current.scrollTo({ y: 0, animated: true });
      delay = scrollDelayMs;
    } else if (scrollRef?.current && currentStep.scroll === 'end') {
      scrollRef.current.scrollToEnd({ animated: true });
      delay = scrollDelayMs;
    }

    const timer = setTimeout(() => {
      const target = currentStep.getTarget
        ? currentStep.getTarget()
        : currentStep.ref?.current;
      if (!target) {
        setRect({ x: 16, y: Math.max(24, screenH * 0.28), w: screenW - 32, h: 48 });
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        return;
      }

      const measure = target.measureInWindow;
      if (!measure) {
        setRect({ x: 16, y: Math.max(24, screenH * 0.28), w: screenW - 32, h: 48 });
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        return;
      }
      measure.call(target, (x, y, w, h) => {
        if (!w || !h) {
          setRect({ x: 16, y: Math.max(24, screenH * 0.28), w: screenW - 32, h: 48 });
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
          return;
        }

        if (waitForVisibility) {
          const margin = 30;
          const isVisible =
            y + h > margin &&
            y < screenH - margin &&
            x + w > margin &&
            x < screenW - margin;

          if (!isVisible) {
            setWaitingForScroll(true);
            return;
          }
        }

        setWaitingForScroll(false);
        setRect({ x, y, w, h });
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, visible, currentStep, scrollY, scrollRef, scrollDelayMs, screenH, screenW]);

  const advance = () => {
    setWaitingForScroll(false);
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else onFinish();
  };

  if (!visible) return null;
  if (!steps?.length) return null;

  // ---- Waiting for scroll mode ----
  if (waitingForScroll) {
    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={triggerShake}>
        <View style={{ flex: 1 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={triggerShake} />
          <View style={styles.waitingCard}>
            <Ionicons name="arrow-down-circle" size={32} color="#47ae87" />
            <Text style={[styles.waitingText, { color: isDarkMode ? '#f5f5f5' : '#1a1a1a' }]}>
              {language === 'English'
                ? 'Scroll down to see the next element'
                : 'Kanda hasi urebe ikintu gikurikira'}
            </Text>
            <TouchableOpacity onPress={onFinish} style={styles.waitingSkipBtn}>
              <Text style={styles.waitingSkipText}>
                {language === 'English' ? 'Skip tutorial' : 'Simbuka'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const P = padding;
  const TOOLTIP_W = Math.min(300, screenW - 40);
  const TOOLTIP_H = 200;

  let tooltipTop = 0;
  let tooltipLeft = 16;
  if (rect) {
    const below = rect.y + rect.h + P + 14;
    const above = rect.y - P - TOOLTIP_H - 14;
    const preferAbove = rect.y + rect.h > screenH - 180;
    if (preferAbove && above > 20) {
      tooltipTop = above;
    } else {
      tooltipTop = below + TOOLTIP_H < screenH - 20 ? below : Math.max(20, above);
    }
    tooltipLeft = Math.max(
      16,
      Math.min(rect.x + rect.w / 2 - TOOLTIP_W / 2, screenW - TOOLTIP_W - 16)
    );
  }

  const cardBg = theme.background || (isDarkMode ? '#1e1e1e' : '#ffffff');
  const cardText = theme.text || (isDarkMode ? '#f5f5f5' : '#1a1a1a');
  const dotInactive = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
  const accent = theme.login || '#47ae87';
  const dimColor = `rgba(0,0,0,${dimOpacity})`;
  const noDim = dimOpacity <= 0;

  const handleBackdropPress = triggerShake;
  const goBack = () => setIndex((current) => Math.max(0, current - 1));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleBackdropPress}>
      <Animated.View style={{ flex: 1, opacity }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        {rect ? (
          <>
            {!noDim && (
              <>
                <View pointerEvents="none" style={[styles.dim, { backgroundColor: dimColor, top: 0, left: 0, right: 0, height: Math.max(0, rect.y - P) }]} />
                <View pointerEvents="none" style={[styles.dim, { backgroundColor: dimColor, top: rect.y + rect.h + P, left: 0, right: 0, bottom: 0 }]} />
                <View pointerEvents="none" style={[styles.dim, { backgroundColor: dimColor, top: rect.y - P, left: 0, width: Math.max(0, rect.x - P), height: rect.h + 2 * P }]} />
                <View pointerEvents="none" style={[styles.dim, { backgroundColor: dimColor, top: rect.y - P, left: rect.x + rect.w + P, right: 0, height: rect.h + 2 * P }]} />
              </>
            )}

            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: rect.y - P,
                left: rect.x - P,
                width: rect.w + 2 * P,
                height: rect.h + 2 * P,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: accent,
              }}
            />

            {currentStep && (
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    top: tooltipTop,
                    left: tooltipLeft,
                    width: TOOLTIP_W,
                    backgroundColor: cardBg,
                    borderRadius: 14,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 8,
                  },
                  shakeStyle,
                ]}
              >
                <TouchableOpacity
                  onPress={onFinish}
                  style={styles.tooltipSkipButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'English' ? 'Skip tutorial' : 'Simbuka inyigisho'}
                >
                  <Ionicons name="close" size={20} color={cardText} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '700', color: cardText, marginBottom: 6, marginRight: 28 }}>
                  {currentStep.title}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: cardText, opacity: 0.85 }}>
                  {currentStep.body}
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row' }}>
                    {steps.map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 6, height: 6, borderRadius: 3, marginRight: 5,
                          backgroundColor: i === index ? accent : dotInactive,
                        }}
                      />
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: cardText, opacity: 0.65, fontWeight: '600', marginRight: 8 }}>
                      {language === 'English' ? `${index + 1} of ${steps.length}` : `${index + 1} kuri ${steps.length}`}
                    </Text>
                    {index > 0 && (
                      <TouchableOpacity
                        onPress={goBack}
                        style={{ paddingVertical: 6, paddingHorizontal: 10 }}
                      >
                        <Text style={{ color: cardText, fontWeight: '600' }}>
                          {language === 'English' ? 'Back' : 'Subira'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <Animated.View
                      style={[
                        { marginLeft: 6 },
                        shakeStyle,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={advance}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          backgroundColor: accent,
                          borderRadius: 16,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>
                          {index < steps.length - 1
                            ? (language === 'English' ? 'Next' : 'Komeza')
                            : (language === 'English' ? 'Finish' : 'Soza')}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute' },
  tooltipSkipButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingCard: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  waitingSkipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#47ae87',
  },
  waitingSkipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});