import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import {
  Brand,
  Colors,
  FontFamily,
  MaxFontScale,
  StatusColors,
  Tones,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, ApiError } from '@/lib/api';
import { getShiftDescription } from '@/lib/shift-description';
import {
  WAITLIST_EXPLAINER,
  WAITLIST_IF_FULL_HINT,
  WAITLIST_IF_FULL_LABEL,
  waitlistSizeSentence,
} from '@/lib/waitlist';

type ConcurrentShift = {
  id: string;
  shiftTypeName: string;
  shiftTypeDescription: string | null;
  spotsRemaining: number;
};

type AutoApprovalStatus = {
  eligible: boolean;
  ruleName?: string;
  loading: boolean;
};

type SignupResult = {
  id: string;
  status: string;
  autoApproved: boolean;
};

type FriendOnPeriod = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** The shift type they're signed up for (may differ from this shift) */
  shiftTypeName: string | null;
  /** True for actual friends; false for users with PUBLIC profile visibility. */
  isFriend: boolean;
};

type ConcurrentResponse = {
  concurrentShifts: ConcurrentShift[];
  friends: FriendOnPeriod[];
};

type ShiftSignupSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (result: SignupResult) => void;
  shift: {
    id: string;
    shiftType: { id: string; name: string; description: string };
    start: string;
    end: string;
    location: string;
    capacity: number;
    signedUp: number;
    notes?: string | null;
  };
  isWaitlist: boolean;
  /**
   * Volunteers already waiting for a place. Shown before someone commits to
   * standby so the choice is informed rather than a guess.
   */
  waitlistCount?: number;
  formatDate: (date: Date, fmt: string) => string;
  /**
   * Known-incomplete profile from the shift eligibility payload, so the sheet
   * can explain what's missing up front instead of only after a failed
   * signup. The server re-checks on submit either way.
   */
  profileIncomplete?: boolean;
  /** Required profile fields still missing, e.g. ["Date of birth"]. */
  missingProfileFields?: string[];
  /**
   * True for volunteers aged 14 and under (from the shift eligibility
   * payload). Shows a required guardian-name field; the server rejects
   * underage signups whose note doesn't name a guardian.
   */
  guardianRequired?: boolean;
};

export function ShiftSignupSheet({
  visible,
  onClose,
  onSuccess,
  shift,
  isWaitlist,
  waitlistCount = 0,
  formatDate,
  profileIncomplete: knownProfileIncomplete,
  missingProfileFields: knownMissingFields,
  guardianRequired = false,
}: ShiftSignupSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const forestTone = Tones[colorScheme].forest;
  const orangeTone = Tones[colorScheme].orange;
  const danger = StatusColors[colorScheme].destructive;
  const rowRipple = isDark ? 'rgba(253,248,239,0.12)' : 'rgba(29,83,55,0.12)';

  const [note, setNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [backupShiftIds, setBackupShiftIds] = useState<string[]>([]);
  const [concurrentShifts, setConcurrentShifts] = useState<ConcurrentShift[]>([]);
  const [periodFriends, setPeriodFriends] = useState<FriendOnPeriod[]>([]);
  const [autoApproval, setAutoApproval] = useState<AutoApprovalStatus>({
    eligible: false,
    loading: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  // Asked for signups that need approval: if the shift fills first, wait for
  // a place or not? Unticked by default so nobody is waitlisted unasked.
  const [waitlistIfFull, setWaitlistIfFull] = useState(false);
  // The shift filled between opening the sheet and submitting. The server's
  // fresh counts replace the stale ones so the waitlist view reads true.
  const [filledWhileOpen, setFilledWhileOpen] = useState<{
    signedUp: number;
    capacity: number;
    waitlistCount: number;
  } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const waitlistMode = isWaitlist || filledWhileOpen !== null;
  const signedUp = filledWhileOpen?.signedUp ?? shift.signedUp;
  const currentWaitlistCount = filledWhileOpen?.waitlistCount ?? waitlistCount;
  const capacity = filledWhileOpen?.capacity ?? shift.capacity;
  const spotsLeft = Math.max(0, capacity - signedUp);
  // Only when an admin will review it. An instant signup can't be overtaken.
  const askWaitlistIfFull =
    !waitlistMode && !autoApproval.loading && !autoApproval.eligible;
  const date = new Date(shift.start);
  const endDate = new Date(shift.end);

  // Reset state when sheet opens. Seed the profile warning from the shift
  // eligibility payload so the volunteer sees what's missing before trying.
  useEffect(() => {
    if (visible) {
      setNote('');
      setShowNoteField(false);
      setGuardianName('');
      setBackupShiftIds([]);
      setError(null);
      setWaitlistIfFull(false);
      setFilledWhileOpen(null);
      // Only block up front when the server told us what is missing. An
      // empty list with the flag set used to render "your profile is
      // incomplete" over a disabled button and no way to find out why.
      const missing = knownMissingFields ?? [];
      setProfileIncomplete(Boolean(knownProfileIncomplete) && missing.length > 0);
      setMissingFields(missing);
      setAutoApproval({ eligible: false, loading: true });
    }
  }, [visible, knownProfileIncomplete, knownMissingFields]);

  // The "just filled up" notice renders at the top of the sheet; bring it
  // into view, since the volunteer is usually scrolled down to the button.
  useEffect(() => {
    if (filledWhileOpen) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [filledWhileOpen]);

  // Fetch auto-approval eligibility + concurrent shifts when sheet opens
  useEffect(() => {
    if (!visible) return;

    // Auto-approval check (skip for waitlist)
    if (!isWaitlist) {
      api<{ eligible: boolean; ruleName?: string }>(
        `/api/mobile/shifts/${shift.id}/auto-approval-check`,
      )
        .then((data) =>
          setAutoApproval({ eligible: data.eligible, ruleName: data.ruleName, loading: false }),
        )
        .catch(() => setAutoApproval({ eligible: false, loading: false }));
    } else {
      setAutoApproval({ eligible: false, loading: false });
    }

    // Concurrent shifts + friends on this period
    api<ConcurrentResponse>(`/api/mobile/shifts/${shift.id}/concurrent`)
      .then((data) => {
        setConcurrentShifts(data.concurrentShifts ?? []);
        setPeriodFriends(data.friends ?? []);
      })
      .catch(() => {
        setConcurrentShifts([]);
        setPeriodFriends([]);
      });
  }, [visible, shift.id, isWaitlist]);

  const toggleBackupShift = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBackupShiftIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setProfileIncomplete(false);

    if (guardianRequired && !guardianName.trim()) {
      setError(
        "Please enter your parent or guardian's name. It's required for volunteers aged 14 and under.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (waitlistMode) body.waitlist = true;
      if (askWaitlistIfFull) body.waitlistIfFull = waitlistIfFull;

      // The guardian name travels in the signup note (same convention as
      // the web dialog), which the server validates for underage volunteers.
      let finalNote = note.trim();
      if (guardianRequired && guardianName.trim()) {
        finalNote = finalNote
          ? `${finalNote}\n\nGuardian: ${guardianName.trim()}`
          : `Guardian: ${guardianName.trim()}`;
      }
      if (finalNote) body.note = finalNote;
      if (backupShiftIds.length > 0) body.backupShiftIds = backupShiftIds;

      const result = await api<SignupResult>(
        `/api/mobile/shifts/${shift.id}/signup`,
        { method: 'POST', body: Object.keys(body).length > 0 ? body : undefined },
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(result);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.data?.waitlistAvailable === true) {
          // Never waitlist them silently: switch to the waitlist view and
          // let them decide.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const liveCapacity =
            typeof err.data.capacity === 'number' ? err.data.capacity : shift.capacity;
          setFilledWhileOpen({
            capacity: liveCapacity,
            signedUp:
              typeof err.data.confirmedCount === 'number'
                ? err.data.confirmedCount
                : liveCapacity,
            waitlistCount:
              typeof err.data.waitlistCount === 'number'
                ? err.data.waitlistCount
                : waitlistCount,
          });
        } else if (err.message === 'Profile incomplete') {
          setProfileIncomplete(true);
          const serverMissing = err.data?.missingFields;
          if (Array.isArray(serverMissing)) {
            setMissingFields(serverMissing.filter((f) => typeof f === 'string'));
          }
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    shift.id,
    shift.capacity,
    waitlistMode,
    askWaitlistIfFull,
    waitlistIfFull,
    waitlistCount,
    note,
    guardianRequired,
    guardianName,
    backupShiftIds,
    onSuccess,
    onClose,
  ]);

  const handleGoToProfile = useCallback(() => {
    onClose();
    router.push('/profile/edit');
  }, [onClose]);

  const title = waitlistMode
    ? '📋 Join Waitlist'
    : autoApproval.eligible && !autoApproval.loading
      ? '🚀 Instant Signup'
      : '✨ Confirm Signup';

  const subtitle = waitlistMode
    ? waitlistSizeSentence(currentWaitlistCount)
    : autoApproval.eligible && !autoApproval.loading
      ? "You're eligible for instant approval!"
      : 'Your signup will be reviewed by an admin.';

  const buttonLabel = waitlistMode
    ? '📋 Join Waitlist'
    : autoApproval.eligible && !autoApproval.loading
      ? '🚀 Sign Up (Auto-Approved)'
      : '✨ Confirm Signup';

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Handle bar */}
        <View style={ss.handleWrap}>
          <View
            style={[
              ss.handleBar,
              { backgroundColor: isDark ? 'rgba(253,248,239,0.22)' : 'rgba(29,83,55,0.18)' },
            ]}
          />
        </View>

        {/* Header */}
        <View style={ss.header}>
          <View style={{ flex: 1 }}>
            <Text style={[ss.title, { color: colors.text }]}>{title}</Text>
            <Text style={[ss.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
          <Pressable
            onPress={onClose}
            // 32pt circle + 6pt slop each side = a 44pt target.
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Close"
            android_ripple={{ color: rowRipple, borderless: true, radius: 22 }}
            style={({ pressed }) => [
              ss.closeButton,
              {
                backgroundColor: isDark ? 'rgba(253,248,239,0.08)' : colors.surfaceSunk,
                opacity: pressed && Platform.OS === 'ios' ? 0.6 : 1,
              },
            ]}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[ss.body, { paddingBottom: 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {filledWhileOpen && (
            <View
              style={[ss.infoBox, { backgroundColor: orangeTone.bg }]}
              accessibilityRole="alert">
              <Text style={ss.infoEmoji}>⏳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ss.infoTitle, { color: orangeTone.fg }]}>
                  This shift just filled up
                </Text>
                <Text style={[ss.infoText, { color: orangeTone.fg }]}>
                  The last place went while you were signing up. You can join the waitlist
                  instead, or close this to look for another shift.
                </Text>
              </View>
            </View>
          )}

          {/* Shift details card */}
          <View style={[ss.card, { backgroundColor: colors.surfaceSoft }]}>
            <Text style={[ss.cardTitle, { color: colors.text }]}>{shift.shiftType.name}</Text>
            {getShiftDescription(shift.notes, shift.shiftType.description) ? (
              <Text style={[ss.cardDescription, { color: colors.textSecondary }]}>
                {getShiftDescription(shift.notes, shift.shiftType.description)}
              </Text>
            ) : null}
            <View style={ss.cardDetails}>
              <View style={ss.cardRow}>
                <Text style={ss.cardIcon}>📅</Text>
                <Text style={[ss.cardValue, { color: colors.text }]}>
                  {formatDate(date, 'EEEE, d MMMM yyyy')}
                </Text>
              </View>
              <View style={ss.cardRow}>
                <Text style={ss.cardIcon}>🕐</Text>
                <Text style={[ss.cardValue, { color: colors.text }]}>
                  {formatDate(date, 'h:mm a')} – {formatDate(endDate, 'h:mm a')}
                </Text>
              </View>
              <View style={ss.cardRow}>
                <Text style={ss.cardIcon}>📍</Text>
                <Text style={[ss.cardValue, { color: colors.text }]}>{shift.location}</Text>
              </View>
              <View style={ss.cardRow}>
                <Text style={ss.cardIcon}>👥</Text>
                <Text style={[ss.cardValue, { color: colors.text }]}>
                  {signedUp}/{capacity} confirmed
                  {!waitlistMode && spotsLeft > 0 && (
                    <Text style={{ color: colors.tint }}> ({spotsLeft} spots left)</Text>
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Volunteers signed up for this period (friends + public profiles) */}
          {periodFriends.length > 0 && (
            <View style={[ss.friendsSection, { backgroundColor: isDark ? 'rgba(14,42,28,0.45)' : Brand.greenLight }]}>
              <View style={ss.friendsHeader}>
                <Ionicons name="people" size={16} color={colors.tint} />
                <Text style={[ss.friendsTitle, { color: colors.tint }]}>
                  {periodFriends.length} volunteer{periodFriends.length !== 1 ? 's' : ''} going
                </Text>
              </View>
              <View style={ss.friendsList}>
                {periodFriends.map((friend) => {
                  const initial = friend.name.charAt(0).toUpperCase();
                  const onDifferentRole = friend.shiftTypeName && friend.shiftTypeName !== shift.shiftType.name;
                  return (
                    <View key={friend.id} style={ss.friendChip}>
                      {friend.profilePhotoUrl ? (
                        <Image
                          source={{ uri: friend.profilePhotoUrl }}
                          style={ss.friendAvatar}
                        />
                      ) : (
                        <View style={[ss.friendAvatarFallback, { backgroundColor: isDark ? 'rgba(253,248,239,0.12)' : colors.card }]}>
                          <Text
                            style={[ss.friendInitial, { color: colors.tint }]}
                            maxFontSizeMultiplier={MaxFontScale.compact}>
                            {initial}
                          </Text>
                        </View>
                      )}
                      <View style={{ flexShrink: 1 }}>
                        <Text
                          style={[ss.friendName, { color: isDark ? colors.text : Brand.nearBlack }]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={MaxFontScale.compact}>
                          {friend.name}
                        </Text>
                        {onDifferentRole && (
                          <Text
                            style={[ss.friendRole, { color: colors.textSecondary }]}
                            numberOfLines={1}
                            maxFontSizeMultiplier={MaxFontScale.compact}>
                            {friend.shiftTypeName}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Auto-approval indicator */}
          {autoApproval.loading ? (
            <View style={[ss.infoBox, { backgroundColor: colors.surfaceSoft }]}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[ss.infoText, { color: colors.textSecondary }]}>
                Checking eligibility...
              </Text>
            </View>
          ) : autoApproval.eligible && !waitlistMode ? (
            <View style={[ss.infoBox, { backgroundColor: forestTone.bg }]}>
              <Text style={ss.infoEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ss.infoTitle, { color: forestTone.fg }]}>
                  Instant Approval Available!
                </Text>
                <Text style={[ss.infoText, { color: forestTone.fg }]}>
                  You’ll be automatically confirmed based on your volunteer history.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[ss.infoBox, { backgroundColor: colors.surfaceSoft }]}>
              <Text style={ss.infoEmoji}>{waitlistMode ? '📋' : 'ℹ️'}</Text>
              <Text style={[ss.infoText, { color: colors.textSecondary, flex: 1 }]}>
                {waitlistMode
                  ? WAITLIST_EXPLAINER
                  : "Your signup will be reviewed by an administrator. You'll be notified once confirmed."}
              </Text>
            </View>
          )}

          {/* If the shift fills before an admin gets to them: wait or not? */}
          {askWaitlistIfFull && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setWaitlistIfFull((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: waitlistIfFull }}
              accessibilityLabel={WAITLIST_IF_FULL_LABEL}
              accessibilityHint={WAITLIST_IF_FULL_HINT}
              testID="waitlist-if-full-toggle"
              android_ripple={{ color: rowRipple }}
              style={({ pressed }) => [
                ss.backupRow,
                ss.optInRow,
                {
                  borderColor: waitlistIfFull ? colors.tint : colors.border,
                  backgroundColor: waitlistIfFull ? forestTone.bg : 'transparent',
                  opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                },
              ]}>
              <View style={ss.backupCheck}>
                {waitlistIfFull ? (
                  <Ionicons name="checkbox" size={22} color={colors.tint} />
                ) : (
                  <Ionicons name="square-outline" size={22} color={colors.textSecondary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ss.backupName, { color: colors.text }]}>
                  {WAITLIST_IF_FULL_LABEL}
                </Text>
                <Text style={[ss.optInHint, { color: colors.textSecondary }]}>
                  {WAITLIST_IF_FULL_HINT}
                </Text>
              </View>
            </Pressable>
          )}

          {/* Note field */}
          {!showNoteField ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowNoteField(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a note"
              android_ripple={{ color: rowRipple }}
              style={({ pressed }) => [
                ss.addNoteButton,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? 'rgba(253,248,239,0.03)' : colors.surfaceSunk,
                  opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
              <Text style={[ss.addNoteText, { color: colors.textSecondary }]}>Add a note</Text>
            </Pressable>
          ) : (
            <View style={ss.noteSection}>
              <Text style={[ss.fieldLabel, { color: colors.text }]}>Note (optional)</Text>
              <TextInput
                style={[
                  ss.noteInput,
                  {
                    backgroundColor: isDark ? 'rgba(253,248,239,0.05)' : colors.surfaceSunk,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={note}
                onChangeText={setNote}
                placeholder="Message for the shift coordinator..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={[ss.charCount, { color: colors.textSecondary }]}>
                {note.length}/500
              </Text>
            </View>
          )}

          {/* Guardian name, required for volunteers aged 14 and under */}
          {guardianRequired && (
            <View style={ss.noteSection}>
              <Text style={[ss.fieldLabel, { color: colors.text }]}>
                Guardian name{' '}
                <Text style={{ color: danger.fg }}>*</Text>
              </Text>
              <Text style={[ss.fieldHint, { color: colors.textSecondary }]}>
                Required for volunteers aged 14 and under.
              </Text>
              <TextInput
                style={[
                  ss.guardianInput,
                  {
                    backgroundColor: isDark ? 'rgba(253,248,239,0.05)' : colors.surfaceSunk,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={guardianName}
                onChangeText={setGuardianName}
                placeholder="Your parent or guardian's full name"
                placeholderTextColor={colors.textSecondary}
                maxLength={100}
                autoComplete="name"
                textContentType="name"
                accessibilityLabel="Guardian name, required"
              />
            </View>
          )}

          {/* Backup shift options */}
          {concurrentShifts.length > 0 && (
            <View style={[ss.backupSection, { backgroundColor: colors.surfaceSoft }]}>
              <Text style={[ss.fieldLabel, { color: colors.text }]}>
                Flexible with shift changes?
              </Text>
              <Text style={[ss.fieldHint, { color: colors.textSecondary }]}>
                If we need to move you, which shifts would you also be OK with?
              </Text>
              {concurrentShifts.map((cs) => {
                const selected = backupShiftIds.includes(cs.id);
                const spotsText =
                  cs.spotsRemaining > 0
                    ? `${cs.spotsRemaining} spot${cs.spotsRemaining !== 1 ? 's' : ''} available`
                    : 'Full – waitlist available';
                return (
                  <Pressable
                    key={cs.id}
                    onPress={() => toggleBackupShift(cs.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${cs.shiftTypeName}, ${spotsText}`}
                    accessibilityHint="Also OK to be moved to this shift"
                    android_ripple={{ color: rowRipple }}
                    style={({ pressed }) => [
                      ss.backupRow,
                      {
                        borderColor: selected ? colors.tint : colors.border,
                        backgroundColor: selected ? forestTone.bg : 'transparent',
                        opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                      },
                    ]}>
                    <View style={ss.backupCheck}>
                      {selected ? (
                        <Ionicons name="checkbox" size={22} color={colors.tint} />
                      ) : (
                        <Ionicons name="square-outline" size={22} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.backupName, { color: colors.text }]}>
                        {cs.shiftTypeName}
                      </Text>
                      {cs.shiftTypeDescription ? (
                        <Text style={[ss.backupDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                          {cs.shiftTypeDescription}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          ss.backupSpots,
                          { color: cs.spotsRemaining > 0 ? colors.tint : orangeTone.fg },
                        ]}>
                        {spotsText}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Profile incomplete — actionable CTA to /profile/edit */}
          {profileIncomplete && (
            <View
              style={[
                ss.profileIncompleteBox,
                { backgroundColor: danger.bg },
              ]}>
              <View style={ss.profileIncompleteHeader}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={danger.fg}
                />
                <Text
                  style={[
                    ss.profileIncompleteTitle,
                    { color: danger.fg },
                  ]}>
                  Complete your profile to sign up
                </Text>
              </View>
              <Text
                style={[
                  ss.profileIncompleteBody,
                  { color: danger.fg },
                ]}>
                {missingFields.length > 0
                  ? 'Your profile still needs:'
                  : "Your profile is missing some required information. Finish filling it in and we'll get you signed up."}
              </Text>
              {missingFields.length > 0 && (
                <View style={ss.missingFieldsList}>
                  {missingFields.map((field) => (
                    <View key={field} style={ss.missingFieldRow}>
                      <Ionicons
                        name="ellipse"
                        size={5}
                        color={danger.fg}
                      />
                      <Text
                        style={[
                          ss.missingFieldText,
                          { color: danger.fg },
                        ]}>
                        {field}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Pressable
                onPress={handleGoToProfile}
                accessibilityRole="button"
                accessibilityLabel="Complete profile"
                android_ripple={{ color: rowRipple }}
                style={({ pressed }) => [
                  ss.profileIncompleteButton,
                  {
                    borderColor: danger.fg,
                    opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
                  },
                ]}>
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={danger.fg}
                />
                <Text
                  style={[
                    ss.profileIncompleteButtonText,
                    { color: danger.fg },
                  ]}>
                  Complete Profile
                </Text>
              </Pressable>
            </View>
          )}

          {/* Error message */}
          {error && (
            <View style={[ss.errorBox, { backgroundColor: danger.bg }]} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={danger.fg} />
              <Text style={[ss.errorText, { color: danger.fg }]}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={[
            ss.footer,
            {
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onClose}
            disabled={isSubmitting}
            haptic={false}
            style={ss.footerButton}
          />

          {/* While the profile is incomplete the signup would only 403, so
              the sheet's "Complete Profile" button is the real action -
              disable the confirm CTA rather than letting it dead-end. It
              re-enables live once the refetched eligibility clears the flag. */}
          <Button
            label={buttonLabel}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={profileIncomplete}
            haptic={false}
            style={[ss.footerButton, ss.footerButtonPrimary]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ss = StyleSheet.create({
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: FontFamily.display,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    marginTop: 4,
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // Shift details card
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  cardDetails: {
    gap: 8,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    fontSize: 14,
    width: 22,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    flex: 1,
  },

  // Friends section
  friendsSection: {
    borderRadius: 24,
    padding: 14,
    gap: 10,
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendsTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    paddingLeft: 3,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(253,248,239,0.5)',
  },
  friendAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  friendAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitial: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  friendName: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    maxWidth: 100,
  },
  friendRole: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  infoEmoji: {
    fontSize: 18,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Note field
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    overflow: 'hidden',
  },
  addNoteText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  noteSection: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  fieldHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginBottom: 4,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    minHeight: 80,
  },
  charCount: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    textAlign: 'right',
  },
  guardianInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    minHeight: 48,
  },

  // Backup shifts
  backupSection: {
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    // Clips the Android ripple to the row.
    overflow: 'hidden',
  },
  backupCheck: {
    width: 24,
    alignItems: 'center',
  },
  optInRow: {
    alignItems: 'flex-start',
  },
  optInHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  backupName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  backupDesc: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  backupSpots: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },
  profileIncompleteBox: {
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  profileIncompleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileIncompleteTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  profileIncompleteBody: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  missingFieldsList: {
    gap: 4,
    marginTop: -4,
    paddingLeft: 4,
  },
  missingFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missingFieldText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 19,
  },
  profileIncompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    overflow: 'hidden',
  },
  profileIncompleteButtonText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Both stretch to the taller of the two when a long label wraps.
  footerButton: {
    alignSelf: 'stretch',
  },
  footerButtonPrimary: {
    flex: 1,
  },
});
