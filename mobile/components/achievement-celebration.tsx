import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Colors, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAchievementCelebrationStore } from '@/hooks/use-achievement-celebration';
import type { Achievement } from '@/lib/dummy-data';

const CATEGORY_ACCENT: Record<Achievement['category'], string> = {
  MILESTONE: '#f59e0b',
  DEDICATION: '#3b82f6',
  SPECIALIZATION: '#10b981',
  IMPACT: '#ef4444',
  COMMUNITY: '#a855f7',
};

const CONFETTI_COLORS = [
  Brand.accent,
  Brand.green,
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#a855f7',
  '#10b981',
];

const PARTICLE_COUNT = 32;

export function AchievementCelebration() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const pending = useAchievementCelebrationStore((s) => s.pending);
  const dismiss = useAchievementCelebrationStore((s) => s.dismiss);

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Fire haptics once each time a new celebration appears.
  useEffect(() => {
    if (pending.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }, [pending.length]);

  const visible = pending.length > 0;

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void dismiss();
  }, [dismiss]);

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Soft tinted gradient backdrop sets a warm celebratory tone without
            competing with the content. */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(248,251,105,0.08)', 'rgba(14,58,35,0)']
              : ['rgba(248,251,105,0.45)', 'rgba(255,253,247,0)']
          }
          locations={[0, 0.7]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {!reduceMotion ? <Confetti /> : null}

        {/* Handle bar */}
        <View style={styles.handleWrap}>
          <View
            style={[
              styles.handleBar,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(0,0,0,0.15)',
              },
            ]}
          />
        </View>

        {/* Close in top-right — pageSheet swipe-down also dismisses. */}
        <Pressable
          onPress={handleClose}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Dismiss celebration"
          style={({ pressed }) => [
            styles.closeButton,
            {
              top: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 96 },
          ]}
          showsVerticalScrollIndicator={false}>
          <Hero
            count={pending.length}
            totalPoints={pending.reduce((sum, a) => sum + a.points, 0)}
            colors={colors}
            isDark={isDark}
            reduceMotion={reduceMotion}
          />

          <View style={styles.cards}>
            {pending.map((achievement, index) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                index={index}
                colors={colors}
                isDark={isDark}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
        </ScrollView>

        {/* Floating dismiss button so it stays reachable on long lists. */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: isDark
                ? 'rgba(15,17,20,0.9)'
                : 'rgba(255,253,247,0.9)',
              borderTopColor: colors.border,
            },
          ]}>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Awesome, close celebration"
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: Brand.green,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={styles.ctaLabel}>Ka pai! 🙌</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Hero({
  count,
  totalPoints,
  colors,
  isDark,
  reduceMotion,
}: {
  count: number;
  totalPoints: number;
  colors: (typeof Colors)['light'];
  isDark: boolean;
  reduceMotion: boolean;
}) {
  return (
    <View style={styles.hero}>
      <Animated.Text
        style={[
          styles.heroEmoji,
          !reduceMotion && {
            animationName: {
              '0%': { transform: [{ scale: 0.7 }, { rotate: '0deg' }] },
              '40%': { transform: [{ scale: 1.15 }, { rotate: '-12deg' }] },
              '70%': { transform: [{ scale: 1.05 }, { rotate: '10deg' }] },
              '100%': { transform: [{ scale: 1 }, { rotate: '0deg' }] },
            },
            animationDuration: '900ms',
            animationIterationCount: 1,
          },
        ]}>
        🎉
      </Animated.Text>

      <Text style={[styles.heroEyebrow, { color: colors.textSecondary }]}>
        Ngā mihi nui
      </Text>
      <Text style={[styles.heroTitle, { color: colors.text }]}>
        {count > 1 ? 'Achievements unlocked!' : 'Achievement unlocked!'}
      </Text>

      {totalPoints > 0 ? (
        <View
          style={[
            styles.pointsPill,
            {
              backgroundColor: isDark
                ? 'rgba(248,251,105,0.18)'
                : Brand.accent,
            },
          ]}>
          <Text
            style={[
              styles.pointsLabel,
              { color: isDark ? Brand.accent : Brand.nearBlack },
            ]}>
            +{totalPoints} {totalPoints === 1 ? 'point' : 'points'} earned
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function AchievementCard({
  achievement,
  index,
  colors,
  isDark,
  reduceMotion,
}: {
  achievement: Achievement;
  index: number;
  colors: (typeof Colors)['light'];
  isDark: boolean;
  reduceMotion: boolean;
}) {
  const accent = CATEGORY_ACCENT[achievement.category] ?? Brand.green;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        !reduceMotion && {
          animationName: {
            '0%': { opacity: 0, transform: [{ translateY: 16 }] },
            '100%': { opacity: 1, transform: [{ translateY: 0 }] },
          },
          animationDuration: '450ms',
          animationDelay: `${300 + index * 90}ms`,
          animationIterationCount: 1,
          animationFillMode: 'both' as const,
        },
      ]}>
      <View style={[styles.cardIconWrap, { backgroundColor: `${accent}1A` }]}>
        <Text style={styles.cardIcon}>{achievement.icon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.cardHeader}>
          <Text
            style={[styles.cardTitle, { color: colors.text }]}
            numberOfLines={2}>
            {achievement.name}
          </Text>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: `${accent}1A`, borderColor: `${accent}55` },
            ]}>
            <Text style={[styles.categoryText, { color: accent }]}>
              {achievement.category}
            </Text>
          </View>
        </View>

        {achievement.description ? (
          <Text
            style={[styles.cardDescription, { color: colors.textSecondary }]}>
            {achievement.description}
          </Text>
        ) : null}

        <Text style={[styles.cardPoints, { color: accent }]}>
          +{achievement.points} {achievement.points === 1 ? 'point' : 'points'}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Lightweight CSS-keyframe confetti — no extra dependency. */
function Confetti() {
  const { width } = useWindowDimensions();

  // Stable particle data per mount so they don't re-randomise on rerenders.
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const isSquare = i % 3 === 0;
        const size = 6 + Math.random() * 7;
        const startX = Math.random() * width;
        const drift = (Math.random() - 0.5) * 140;
        const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540);
        return {
          id: i,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size,
          startX,
          drift,
          spin,
          delay: Math.random() * 600,
          duration: 1800 + Math.random() * 1400,
          radius: isSquare ? 1 : size / 2,
        };
      }),
    [width],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            top: -20,
            left: p.startX,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.radius,
            opacity: 0,
            animationName: {
              '0%': {
                opacity: 1,
                transform: [
                  { translateY: 0 },
                  { translateX: 0 },
                  { rotate: '0deg' },
                ],
              },
              '85%': { opacity: 1 },
              '100%': {
                opacity: 0,
                transform: [
                  { translateY: 900 },
                  { translateX: p.drift },
                  { rotate: `${p.spin}deg` },
                ],
              },
            },
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
            animationIterationCount: 1,
            animationFillMode: 'forwards',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
  },
  heroEmoji: {
    fontSize: 72,
    lineHeight: 80,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 14,
  },
  pointsPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pointsLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
  },
  cards: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 28,
    lineHeight: 32,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cardDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardPoints: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cta: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#ffffff',
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
});
