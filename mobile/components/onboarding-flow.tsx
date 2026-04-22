import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Colors, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  isCalendarSyncEnabled,
  setCalendarSyncEnabled,
} from '@/lib/calendar-sync';
import { useOnboarding } from '@/lib/onboarding';
import { syncPushTokenWithServer } from '@/lib/push-notifications';
import type { Shift } from '@/lib/dummy-data';

const TERMS_SECTIONS = [
  {
    title: '1. Community Standards',
    body: 'Everybody Eats is a whānau community. We expect all volunteers to treat each other with kindness and respect. Objectionable, offensive, or abusive content is not tolerated and will result in removal from the platform.',
  },
  {
    title: '2. User-Generated Content',
    body: "By using this app you may post comments and interact with other volunteers' activity. You are responsible for the content you post. Content must not be harmful, threatening, hateful, sexually explicit, or otherwise objectionable.",
  },
  {
    title: '3. Reporting & Moderation',
    body: 'You can flag any content or block any user at any time. Reports are reviewed by the Everybody Eats team within 24 hours. Confirmed violations result in content removal and potential account suspension.',
  },
  {
    title: '4. Blocking',
    body: 'You may block any user to immediately remove their content from your feed. The Everybody Eats team is notified of blocks and will investigate where appropriate.',
  },
  {
    title: '5. Privacy',
    body: 'Your data is handled in accordance with our Privacy Policy. Your volunteer activity (shifts, achievements) is visible to friends you approve. You control your visibility settings in your profile.',
  },
  {
    title: '6. Enforcement',
    body: 'Everybody Eats reserves the right to remove content or suspend accounts that violate these terms without prior notice. We are committed to maintaining a safe environment for all volunteers.',
  },
];

type StepKey =
  | 'welcome'
  | 'booking'
  | 'feed'
  | 'calendar'
  | 'notifications'
  | 'terms';

const STEP_ORDER: StepKey[] = [
  'welcome',
  'booking',
  'feed',
  'calendar',
  'notifications',
  'terms',
];

export function OnboardingFlow() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { visible, hasChecked, checkInitial, markComplete } = useOnboarding();
  const user = useAuth((s) => s.user);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);

  const [stepIndex, setStepIndex] = useState(0);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);

  // Kick off the initial AsyncStorage check once the user is authenticated.
  // We intentionally skip when unauthenticated — permission prompts are more
  // meaningful after the user knows they're logged in.
  useEffect(() => {
    if (isAuthenticated && !hasChecked) {
      checkInitial();
    }
  }, [isAuthenticated, hasChecked, checkInitial]);

  // Reset to step 0 whenever the flow opens, and hydrate the permission cards
  // with the current OS state so returning users see accurate status.
  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
    isCalendarSyncEnabled().then(setCalendarEnabled).catch(() => {});
    Notifications.getPermissionsAsync()
      .then((res) => setNotificationsEnabled(res.status === 'granted'))
      .catch(() => {});
  }, [visible]);

  const stepKey = STEP_ORDER[stepIndex];
  const totalSteps = STEP_ORDER.length;
  const progress = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(progress, {
      toValue: (stepIndex + 1) / totalSteps,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [stepIndex, totalSteps, progress]);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stepIndex < totalSteps - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    Haptics.selectionAsync();
    setStepIndex(stepIndex - 1);
  };

  const handleEnableCalendar = async () => {
    if (calendarBusy) return;
    setCalendarBusy(true);
    try {
      let shifts: Shift[] | undefined;
      try {
        const result = await api<{ myShifts: Shift[] }>('/api/mobile/shifts');
        shifts = result.myShifts;
      } catch {
        // Non-fatal — later auto-sync will reconcile.
      }
      const ok = await setCalendarSyncEnabled(true, shifts);
      if (!ok) {
        Alert.alert(
          'Calendar access needed',
          'To sync your shifts, enable Calendar access for Everybody Eats in Settings.',
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCalendarEnabled(true);
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (notificationsBusy) return;
    setNotificationsBusy(true);
    try {
      const token = await syncPushTokenWithServer({ requestIfNeeded: true });
      if (!token) {
        Alert.alert(
          'Notifications blocked',
          "We couldn't turn on notifications. You can enable them later in your device settings under Everybody Eats.",
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotificationsEnabled(true);
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleAcceptTerms = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markComplete();
  };

  const handleDeclineTerms = () => {
    Alert.alert(
      'Terms required',
      'You need to agree to the Terms of Use to access Everybody Eats. These terms help keep our community safe for all volunteers.',
      [{ text: 'Review terms', style: 'cancel' }],
    );
  };

  const firstName = useMemo(
    () => user?.name?.split(' ')[0] ?? 'friend',
    [user?.name],
  );

  if (!visible) return null;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        // Non-skippable — swallowing the hardware back works as designed.
      }}
    >
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* ─── Top chrome: back + progress ─── */}
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + 8, paddingHorizontal: 20 },
          ]}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={goBack}
              disabled={stepIndex === 0}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
              style={({ pressed }) => [
                styles.backBtn,
                {
                  opacity: stepIndex === 0 ? 0 : pressed ? 0.5 : 1,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(14,58,35,0.06)',
                },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.text}
              />
            </Pressable>
            <Text
              style={[
                styles.stepCounter,
                { color: colors.textSecondary, fontFamily: FontFamily.semiBold },
              ]}
            >
              {String(stepIndex + 1).padStart(2, '0')}
              <Text style={{ opacity: 0.5 }}>
                {' / '}
                {String(totalSteps).padStart(2, '0')}
              </Text>
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(14,58,35,0.08)',
              },
            ]}
          >
            <RNAnimated.View
              style={[
                styles.progressFill,
                { width: progressWidth, backgroundColor: Brand.green },
              ]}
            />
          </View>
        </View>

        {/* ─── Step body ─── */}
        <Animated.View
          key={stepKey}
          entering={FadeInRight.duration(260)}
          exiting={FadeOutLeft.duration(160)}
          style={styles.stepShell}
        >
          {stepKey === 'welcome' && (
            <WelcomeStep firstName={firstName} isDark={isDark} colors={colors} />
          )}
          {stepKey === 'booking' && (
            <BookingStep isDark={isDark} colors={colors} />
          )}
          {stepKey === 'feed' && <FeedStep isDark={isDark} colors={colors} />}
          {stepKey === 'calendar' && (
            <CalendarStep
              isDark={isDark}
              colors={colors}
              enabled={calendarEnabled}
              busy={calendarBusy}
              onEnable={handleEnableCalendar}
            />
          )}
          {stepKey === 'notifications' && (
            <NotificationsStep
              isDark={isDark}
              colors={colors}
              enabled={notificationsEnabled}
              busy={notificationsBusy}
              onEnable={handleEnableNotifications}
            />
          )}
          {stepKey === 'terms' && (
            <TermsStep isDark={isDark} colors={colors} />
          )}
        </Animated.View>

        {/* ─── Bottom actions ─── */}
        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom, 16) + 4 },
          ]}
        >
          {stepKey === 'terms' ? (
            <>
              <PrimaryButton
                label="I agree — Join the whānau 💚"
                onPress={handleAcceptTerms}
              />
              <SecondaryButton
                label="Review terms again"
                onPress={handleDeclineTerms}
                color={colors.textSecondary}
              />
            </>
          ) : stepKey === 'calendar' || stepKey === 'notifications' ? (
            <>
              <PrimaryButton
                label={
                  stepKey === 'calendar' && !calendarEnabled
                    ? 'Enable calendar sync'
                    : stepKey === 'notifications' && !notificationsEnabled
                      ? 'Enable notifications'
                      : 'Continue'
                }
                onPress={() => {
                  const alreadyOn =
                    (stepKey === 'calendar' && calendarEnabled) ||
                    (stepKey === 'notifications' && notificationsEnabled);
                  if (alreadyOn) {
                    goNext();
                    return;
                  }
                  if (stepKey === 'calendar') {
                    handleEnableCalendar().then(() => goNext());
                  } else {
                    handleEnableNotifications().then(() => goNext());
                  }
                }}
                busy={
                  (stepKey === 'calendar' && calendarBusy) ||
                  (stepKey === 'notifications' && notificationsBusy)
                }
              />
              <SecondaryButton
                label="Maybe later"
                onPress={goNext}
                color={colors.textSecondary}
              />
            </>
          ) : (
            <PrimaryButton
              label={stepKey === 'welcome' ? "Let's go" : 'Continue'}
              onPress={goNext}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────── Step content ─────────────────────── */

type StepCommon = {
  isDark: boolean;
  colors: (typeof Colors)['light'];
};

function StepHero({
  bg,
  emoji,
  ring,
}: {
  bg: string;
  emoji: string;
  ring: readonly [string, string, ...string[]];
}) {
  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={ring}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroRing}
      >
        <View
          style={[styles.heroInner, { backgroundColor: bg }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.heroEmoji}>{emoji}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

function WelcomeStep({
  firstName,
  isDark,
  colors,
}: StepCommon & { firstName: string }) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHero
        bg={isDark ? 'rgba(248,251,105,0.18)' : Brand.accentSubtle}
        emoji="🌿"
        ring={[Brand.accent, Brand.greenLight]}
      />
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        Kia ora
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Welcome, {firstName} 👋
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        You&apos;re joining Aotearoa&apos;s pay-as-you-feel restaurant
        community. Here&apos;s a quick tour of how the app works — we&apos;ll
        cover booking shifts, your feed, and a couple of permissions.
      </Text>
      <View
        style={[
          styles.quoteBlock,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(14,58,35,0.04)',
            borderColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(14,58,35,0.08)',
          },
        ]}
      >
        <Text
          style={[
            styles.quote,
            { color: colors.text, fontFamily: FontFamily.heading },
          ]}
        >
          Nau te rourou, nāku te rourou, ka ora ai te iwi.
        </Text>
        <Text style={[styles.quoteTranslation, { color: colors.textSecondary }]}>
          With your basket and my basket, the people will thrive.
        </Text>
      </View>
    </ScrollView>
  );
}

function BookingStep({ isDark, colors }: StepCommon) {
  const steps = [
    {
      icon: 'search-outline' as const,
      title: 'Browse open shifts',
      body: 'Tap the Shifts tab to see what\'s coming up across all restaurants.',
    },
    {
      icon: 'reader-outline' as const,
      title: 'Check the details',
      body: 'Tap any shift to see the role, location, time, and who else is going.',
    },
    {
      icon: 'checkmark-circle-outline' as const,
      title: 'Confirm your spot',
      body: "Hit Sign up and we'll lock you in. You'll get a confirmation and a reminder closer to the day.",
    },
  ];
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHero
        bg={isDark ? 'rgba(134,239,172,0.08)' : Brand.greenLight}
        emoji="🍽️"
        ring={[Brand.green, Brand.greenLight]}
      />
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        Step by step
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Booking a shift
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Three taps and you&apos;re on the roster.
      </Text>
      <View style={styles.list}>
        {steps.map((s, i) => (
          <Animated.View
            key={s.title}
            entering={FadeInDown.delay(120 + i * 90).duration(360)}
            style={[
              styles.listRow,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : '#ffffff',
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.listIcon,
                {
                  backgroundColor: isDark
                    ? 'rgba(134,239,172,0.10)'
                    : Brand.greenLight,
                },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={20}
                color={isDark ? '#86efac' : Brand.green}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.listTitle, { color: colors.text }]}>
                {i + 1}. {s.title}
              </Text>
              <Text
                style={[styles.listBody, { color: colors.textSecondary }]}
              >
                {s.body}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function FeedStep({ isDark, colors }: StepCommon) {
  const samples: {
    icon: string;
    label: string;
    text: string;
    tint: { bg: string; bgDark: string; fg: string; fgDark: string };
  }[] = [
    {
      icon: '🆕',
      label: 'New shift',
      text: 'Fresh shifts dropped for Wellington this week.',
      tint: {
        bg: '#f0fdf4',
        bgDark: 'rgba(22,163,74,0.16)',
        fg: '#16a34a',
        fgDark: '#86efac',
      },
    },
    {
      icon: '🏆',
      label: 'Achievement',
      text: 'Whaea unlocked the 10-shift milestone.',
      tint: {
        bg: '#f5f3ff',
        bgDark: 'rgba(124,58,237,0.18)',
        fg: '#7c3aed',
        fgDark: '#c4b5fd',
      },
    },
    {
      icon: '🔥',
      label: 'Streak',
      text: 'Kōwhai is on a 4-month volunteering streak.',
      tint: {
        bg: '#fff7ed',
        bgDark: 'rgba(234,88,12,0.18)',
        fg: '#ea580c',
        fgDark: '#fdba74',
      },
    },
  ];
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHero
        bg={isDark ? 'rgba(134,239,172,0.08)' : Brand.greenLight}
        emoji="📢"
        ring={[Brand.green, Brand.greenLight]}
      />
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        Your Home tab
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Stay in the loop
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        The feed is where your whānau shows up — new shifts, milestones, and
        celebrations as they happen.
      </Text>
      <View style={styles.list}>
        {samples.map((s, i) => (
          <Animated.View
            key={s.label}
            entering={FadeInDown.delay(120 + i * 90).duration(360)}
            style={[
              styles.feedCard,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : '#ffffff',
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.feedEmoji,
                {
                  backgroundColor: isDark ? s.tint.bgDark : s.tint.bg,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{s.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.feedLabel,
                  { color: isDark ? s.tint.fgDark : s.tint.fg },
                ]}
              >
                {s.label}
              </Text>
              <Text
                style={[styles.feedText, { color: colors.text }]}
                numberOfLines={2}
              >
                {s.text}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function CalendarStep({
  isDark,
  colors,
  enabled,
  busy,
  onEnable,
}: StepCommon & {
  enabled: boolean;
  busy: boolean;
  onEnable: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHero
        bg={isDark ? 'rgba(134,239,172,0.08)' : Brand.greenLight}
        emoji="📅"
        ring={[Brand.green, Brand.accent]}
      />
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        Stay on schedule
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Never miss a shift
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Add your upcoming shifts to your device calendar automatically.
        They&apos;ll sync when you sign up — and disappear if you cancel.
      </Text>
      <PermissionStatusCard
        isDark={isDark}
        colors={colors}
        enabled={enabled}
        busy={busy}
        enabledLabel="Calendar sync is on"
        enabledHint="Your confirmed shifts are being added."
        disabledLabel="Calendar sync is off"
        disabledHint="Tap below to grant access."
        onEnable={onEnable}
        permissionBtnLabel="Enable calendar sync"
      />
    </ScrollView>
  );
}

function NotificationsStep({
  isDark,
  colors,
  enabled,
  busy,
  onEnable,
}: StepCommon & {
  enabled: boolean;
  busy: boolean;
  onEnable: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <StepHero
        bg={isDark ? 'rgba(134,239,172,0.08)' : Brand.greenLight}
        emoji="🔔"
        ring={[Brand.green, Brand.accent]}
      />
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        Tap on the shoulder
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        Get the important pings
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Shift reminders, friend requests, and urgent coverage asks — nothing
        spammy. You can fine-tune what you get in Settings later.
      </Text>
      <PermissionStatusCard
        isDark={isDark}
        colors={colors}
        enabled={enabled}
        busy={busy}
        enabledLabel="Notifications are on"
        enabledHint="You'll hear from us when it matters."
        disabledLabel="Notifications are off"
        disabledHint="Tap below to allow notifications."
        onEnable={onEnable}
        permissionBtnLabel="Enable notifications"
      />
    </ScrollView>
  );
}

function TermsStep({ isDark, colors }: StepCommon) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.stepContent, { paddingBottom: 8 }]}>
        <StepHero
          bg={isDark ? 'rgba(248,251,105,0.18)' : Brand.accentSubtle}
          emoji="💚"
          ring={[Brand.accent, Brand.greenLight]}
        />
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
          One last thing
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Before you join the whānau
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Please read and agree to our Terms of Use. They help keep the
          community safe for every volunteer.
        </Text>
      </View>
      <ScrollView
        style={styles.termsScroll}
        contentContainerStyle={styles.termsContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.termsBox,
            {
              backgroundColor: isDark ? '#1a1d21' : '#f8faf8',
              borderColor: colors.border,
            },
          ]}
        >
          {TERMS_SECTIONS.map((section, i) => (
            <View
              key={section.title}
              style={[
                styles.termsSection,
                i < TERMS_SECTIONS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.termsSectionTitle,
                  { color: colors.text, fontFamily: FontFamily.semiBold },
                ]}
              >
                {section.title}
              </Text>
              <Text
                style={[
                  styles.termsSectionBody,
                  {
                    color: colors.textSecondary,
                    fontFamily: FontFamily.regular,
                  },
                ]}
              >
                {section.body}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={[
            styles.zeroTolerance,
            { color: isDark ? '#fbbf24' : '#92400e', fontFamily: FontFamily.semiBold },
          ]}
        >
          Zero tolerance for objectionable content or abusive behaviour.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────── Shared pieces ─────────────────────── */

function PermissionStatusCard({
  isDark,
  colors,
  enabled,
  busy,
  enabledLabel,
  enabledHint,
  disabledLabel,
  disabledHint,
}: StepCommon & {
  enabled: boolean;
  busy: boolean;
  enabledLabel: string;
  enabledHint: string;
  disabledLabel: string;
  disabledHint: string;
  onEnable: () => void;
  permissionBtnLabel: string;
}) {
  return (
    <View
      style={[
        styles.statusCard,
        {
          backgroundColor: enabled
            ? isDark
              ? 'rgba(134,239,172,0.08)'
              : Brand.greenLight
            : isDark
              ? 'rgba(255,255,255,0.04)'
              : '#ffffff',
          borderColor: enabled
            ? isDark
              ? 'rgba(134,239,172,0.22)'
              : Brand.green
            : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: enabled
              ? Brand.green
              : isDark
                ? 'rgba(255,255,255,0.18)'
                : '#cbd5e1',
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons
            name={enabled ? 'checkmark' : 'ellipsis-horizontal'}
            size={18}
            color="#ffffff"
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusLabel, { color: colors.text }]}>
          {enabled ? enabledLabel : disabledLabel}
        </Text>
        <Text
          style={[styles.statusHint, { color: colors.textSecondary }]}
        >
          {enabled ? enabledHint : disabledHint}
        </Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: Brand.green,
          opacity: busy ? 0.7 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.secondaryBtn,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text
        style={[
          styles.secondaryBtnText,
          { color, fontFamily: FontFamily.medium },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    gap: 14,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCounter: {
    fontSize: 13,
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepShell: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  heroRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    width: '100%',
    height: '100%',
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 52,
  },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
    alignSelf: 'center',
  },
  quoteBlock: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  quote: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  quoteTranslation: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  listBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedEmoji: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  feedText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
  },
  statusDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    marginBottom: 2,
  },
  statusHint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  termsScroll: {
    flex: 1,
  },
  termsContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  termsBox: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  termsSection: {
    padding: 14,
    gap: 6,
  },
  termsSectionTitle: {
    fontSize: 13,
  },
  termsSectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  zeroTolerance: {
    textAlign: 'center',
    fontSize: 13,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actions: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
  },
});

