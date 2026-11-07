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

import { ThemedText } from '@/components/themed-text';
import { Brand, FontFamily, Palette } from '@/constants/theme';
import { useAchievementCelebrationStore } from '@/hooks/use-achievement-celebration';
import type { Achievement } from '@/lib/dummy-data';

const CATEGORY_LABEL: Record<Achievement['category'], string> = {
  MILESTONE: 'Milestone',
  DEDICATION: 'Dedication',
  SPECIALIZATION: 'Specialisation',
  IMPACT: 'Impact',
  COMMUNITY: 'Community',
};

/** Brand palette only, so the sheet stays on the forest/sun/cream system. */
const CONFETTI_COLORS = [
  Palette.sun200,
  Palette.cream50,
  '#F4D2BE', // peach
  Palette.forest200,
  Palette.sun100,
];

/** Text and surfaces on the dark forest sheet. */
const ON_FOREST = {
  muted: 'rgba(253,248,239,0.68)',
  card: 'rgba(253,248,239,0.06)',
  cardBorder: 'rgba(253,248,239,0.10)',
  iconWell: 'rgba(253,248,239,0.08)',
};

const PARTICLE_COUNT = 32;

export function AchievementCelebration() {
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
      <View style={[styles.root, { backgroundColor: Palette.forest700 }]}>
        {/* A lighter forest glow at the top lifts the hero off the dark sheet. */}
        <LinearGradient
          colors={[Palette.forest500, Palette.forest700]}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {!reduceMotion ? <Confetti /> : null}

        {/* Handle bar */}
        <View style={styles.handleWrap}>
          <View
            style={[
              styles.handleBar,
              { backgroundColor: 'rgba(253,248,239,0.3)' },
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
              backgroundColor: 'rgba(253,248,239,0.10)',
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <Ionicons name="close" size={18} color={Palette.cream50} />
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
            reduceMotion={reduceMotion}
          />

          <View style={styles.cards}>
            {pending.map((achievement, index) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                index={index}
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
              // Solid, so the list never ghosts through under the button.
              backgroundColor: Palette.forest700,
              borderTopColor: 'rgba(253,248,239,0.14)',
            },
          ]}>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Awesome, close celebration"
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: Brand.accent,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
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
  reduceMotion,
}: {
  count: number;
  totalPoints: number;
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

      <ThemedText
        type="displayLarge"
        style={[styles.heroTitle, { color: Palette.cream50 }]}>
        {count > 1 ? 'Achievements unlocked' : 'Achievement unlocked'}
      </ThemedText>
      <Text style={[styles.heroSubtitle, { color: ON_FOREST.muted }]}>
        Ngā mihi nui for your mahi.
      </Text>

      {totalPoints > 0 ? (
        <View
          style={[styles.pointsPill, { backgroundColor: Brand.accent }]}>
          <Text style={[styles.pointsLabel, { color: Brand.nearBlack }]}>
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
  reduceMotion,
}: {
  achievement: Achievement;
  index: number;
  reduceMotion: boolean;
}) {
  const category = CATEGORY_LABEL[achievement.category];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: ON_FOREST.card,
          borderColor: ON_FOREST.cardBorder,
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
      <View
        style={[styles.cardIconWrap, { backgroundColor: ON_FOREST.iconWell }]}>
        <Text style={styles.cardIcon}>{achievement.icon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[styles.cardTitle, { color: Palette.cream50 }]}
          numberOfLines={2}>
          {achievement.name}
        </Text>

        {achievement.description ? (
          <Text style={[styles.cardDescription, { color: ON_FOREST.muted }]}>
            {achievement.description}
          </Text>
        ) : null}

        <Text style={[styles.cardMeta, { color: ON_FOREST.muted }]}>
          <Text style={[styles.cardPoints, { color: Palette.sun200 }]}>
            +{achievement.points}{' '}
            {achievement.points === 1 ? 'point' : 'points'}
          </Text>
          {category ? `  ·  ${category}` : null}
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
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
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
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
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
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    marginBottom: 2,
  },
  cardDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
  },
  cardPoints: {
    fontFamily: FontFamily.semiBold,
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
    color: Palette.ink,
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
});
