import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  View,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { ThemedText } from '@/components/themed-text';
import { Colors, Brand, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MY_SHIFTS, AVAILABLE_SHIFTS, SHIFT_CREW } from '@/lib/dummy-data';

type QueueItem = {
  id: string;
  title: string;
  artist: string;
  requestedBy: string;
  votes: number;
};

const PLACEHOLDER_QUEUE: QueueItem[] = [
  { id: '1', title: 'Here Comes the Sun', artist: 'The Beatles', requestedBy: 'Sarah', votes: 3 },
  { id: '2', title: 'Three Little Birds', artist: 'Bob Marley', requestedBy: 'James', votes: 2 },
  { id: '3', title: "Don't Stop Me Now", artist: 'Queen', requestedBy: 'Mia', votes: 1 },
];

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const shift = [...MY_SHIFTS, ...AVAILABLE_SHIFTS].find((s) => s.id === id);
  const isMyShift = MY_SHIFTS.some((s) => s.id === id);
  const [checkedIn, setCheckedIn] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>(PLACEHOLDER_QUEUE);
  const [photos, setPhotos] = useState<string[]>([]);
  const [votedSongs, setVotedSongs] = useState<Set<string>>(new Set());

  if (!shift) {
    return (
      <>
        <Stack.Screen options={{ title: 'Shift' }} />
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={styles.notFoundEmoji}>🔍</Text>
          <ThemedText type="subtitle" style={{ marginTop: 8 }}>
            Shift not found
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            This mahi may have been removed
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backLink,
              { backgroundColor: Brand.green, opacity: pressed ? 0.9 : 1 },
            ]}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;

  const handleCheckIn = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCheckedIn(true);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to share shift photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take shift photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleAddPhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddSong = () => {
    if (!musicSearch.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: musicSearch.trim(),
      artist: 'Searching...',
      requestedBy: 'You',
      votes: 0,
    };
    setQueue((prev) => [...prev, newItem]);
    setMusicSearch('');
  };

  const handleVote = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setQueue((q) => q.map((i) => (i.id === itemId ? { ...i, votes: i.votes - 1 } : i)));
      } else {
        next.add(itemId);
        setQueue((q) => q.map((i) => (i.id === itemId ? { ...i, votes: i.votes + 1 } : i)));
      }
      return next;
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: shift.shiftType.name,
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>🍽️ Mahi details</Text>
            </View>
            {shift.status && <StatusBadge status={shift.status} />}
          </View>

          <Text style={styles.heroTitle}>{shift.shiftType.name}</Text>
          <Text style={styles.heroDescription}>{shift.shiftType.description}</Text>

          {/* Details with emojis */}
          <View style={styles.heroDetails}>
            <View style={styles.heroDetail}>
              <Text style={styles.heroEmoji}>📍</Text>
              <Text style={styles.heroDetailText}>{shift.location}</Text>
            </View>
            <View style={styles.heroDetail}>
              <Text style={styles.heroEmoji}>📅</Text>
              <Text style={styles.heroDetailText}>{format(date, 'EEEE, d MMMM yyyy')}</Text>
            </View>
            <View style={styles.heroDetail}>
              <Text style={styles.heroEmoji}>🕐</Text>
              <Text style={styles.heroDetailText}>
                {format(date, 'h:mm a')} – {format(endDate, 'h:mm a')}
              </Text>
            </View>
            <View style={styles.heroDetail}>
              <Text style={styles.heroEmoji}>👥</Text>
              <Text style={styles.heroDetailText}>
                {shift.signedUp}/{shift.capacity} whānau
                {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : ' · Full'}
              </Text>
            </View>
          </View>

          {/* Capacity bar */}
          <View style={styles.heroCapacity}>
            <View style={styles.heroCapacityBar}>
              <View
                style={[
                  styles.heroCapacityFill,
                  {
                    width: `${Math.min((shift.signedUp / shift.capacity) * 100, 100)}%`,
                    backgroundColor: spotsLeft <= 0 ? '#ef4444' : 'rgba(255,255,255,0.6)',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ── Notes banner ── */}
        {shift.notes && (
          <View style={[styles.notesBanner, { backgroundColor: '#fef9c3' }]}>
            <Text style={styles.notesEmoji}>💡</Text>
            <Text style={styles.notesText}>{shift.notes}</Text>
          </View>
        )}

        {/* ── Check-in button ── */}
        {isMyShift && shift.status === 'CONFIRMED' && !checkedIn && (
          <Pressable
            onPress={handleCheckIn}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: Brand.green, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityLabel="Check in to shift">
            <Text style={styles.primaryButtonText}>Check In ✅</Text>
          </Pressable>
        )}

        {/* ── Checked-in banner ── */}
        {checkedIn && (
          <View style={[styles.checkedInBanner, { backgroundColor: Brand.greenLight }]}>
            <Text style={styles.checkedInEmoji}>🙌</Text>
            <View>
              <Text style={[styles.checkedInTitle, { color: Brand.green }]}>
                Ka pai! You&apos;re checked in
              </Text>
              <Text style={[styles.checkedInSubtitle, { color: Brand.green }]}>
                Have a great mahi today
              </Text>
            </View>
          </View>
        )}

        {/* ── Crew list — visible after check-in ── */}
        {checkedIn && (
          <CrewSection shiftId={shift.id} colors={colors} />
        )}

        {/* ── Shift Photos — visible after check-in ── */}
        {checkedIn && (
          <View style={[styles.sectionCard, { borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>📸</Text>
              <ThemedText type="subtitle">Shift Photos</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: colors.textSecondary }}>
              Share moments from today&apos;s mahi
            </ThemedText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoScroll}>
              {/* Add photo button */}
              <Pressable
                onPress={handleAddPhoto}
                style={({ pressed }) => [
                  styles.addPhotoButton,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={styles.addPhotoEmoji}>📷</Text>
                <Text style={[styles.addPhotoText, { color: Brand.green }]}>
                  Add Photo
                </Text>
              </Pressable>

              {/* Photo thumbnails */}
              {photos.map((uri, index) => (
                <View key={uri} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPhotos((prev) => prev.filter((_, i) => i !== index));
                    }}
                    style={({ pressed }) => [
                      styles.photoRemove,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <Ionicons name="close-circle" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Music Queue — visible after check-in ── */}
        {checkedIn && (
          <View style={[styles.sectionCard, { borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>🎵</Text>
              <ThemedText type="subtitle">Music Queue</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: colors.textSecondary }}>
              Request songs for the BOH speaker
            </ThemedText>

            <View style={styles.musicSearchRow}>
              <TextInput
                style={[
                  styles.musicInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                    fontFamily: FontFamily.regular,
                  },
                ]}
                value={musicSearch}
                onChangeText={setMusicSearch}
                placeholder="Search for a song..."
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleAddSong}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleAddSong}
                disabled={!musicSearch.trim()}
                style={({ pressed }) => [
                  styles.addSongButton,
                  {
                    backgroundColor: musicSearch.trim() ? Brand.green : colors.border,
                    opacity: pressed && musicSearch.trim() ? 0.8 : 1,
                  },
                ]}>
                <Ionicons name="add" size={24} color="#ffffff" />
              </Pressable>
            </View>

            {queue.map((item, index) => (
              <View
                key={item.id}
                style={[styles.queueItem, { borderColor: colors.border }]}>
                <View style={[styles.queueRankBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.queueRankText, { color: Brand.green }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.songInfo}>
                  <Text style={[styles.songTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.songMeta, { color: colors.textSecondary }]}>
                    {item.artist} · {item.requestedBy}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleVote(item.id)}
                  style={({ pressed }) => [
                    styles.voteButton,
                    {
                      borderColor: votedSongs.has(item.id) ? Brand.green : colors.border,
                      backgroundColor: votedSongs.has(item.id) ? Brand.greenLight : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text style={styles.voteEmoji}>{votedSongs.has(item.id) ? '🔥' : '👍'}</Text>
                  <Text style={[styles.voteCount, { color: votedSongs.has(item.id) ? Brand.green : colors.text }]}>
                    {item.votes}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ── Sign up button (for available shifts) ── */}
        {!isMyShift && spotsLeft > 0 && (
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Ka pai! 🎉', 'You\'ve signed up for this mahi. See you there!');
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: Brand.green, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityLabel="Sign up for shift">
            <Text style={styles.primaryButtonText}>✋ Sign Up for Mahi</Text>
          </Pressable>
        )}

        {!isMyShift && spotsLeft <= 0 && (
          <View style={[styles.fullBanner, { backgroundColor: colors.border }]}>
            <Text style={styles.fullEmoji}>😔</Text>
            <ThemedText type="caption" style={{ color: colors.textSecondary }}>
              This mahi is full — check back later for cancellations
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
    CONFIRMED: { bg: 'rgba(255,255,255,0.2)', text: '#ffffff', label: 'Confirmed', emoji: '✅' },
    PENDING: { bg: 'rgba(255,255,255,0.2)', text: '#ffffff', label: 'Pending', emoji: '⏳' },
    WAITLISTED: { bg: 'rgba(255,255,255,0.2)', text: '#ffffff', label: 'Waitlisted', emoji: '📋' },
  };
  const c = config[status] ?? config.PENDING;

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.text }]}>
        {c.emoji} {c.label}
      </Text>
    </View>
  );
}

/* ── Crew Section ── */
const GRADE_COLORS: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  PINK: '#ec4899',
};

function CrewSection({
  shiftId,
  colors,
}: {
  shiftId: string;
  colors: (typeof Colors)['light'];
}) {
  const crew = SHIFT_CREW[shiftId];
  if (!crew || crew.length === 0) return null;

  const checkedInCount = crew.filter((m) => m.checkedIn).length;

  return (
    <View style={[styles.sectionCard, { borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>👥</Text>
        <ThemedText type="subtitle">Shift Whānau</ThemedText>
        <View style={[styles.crewCountBadge, { backgroundColor: Brand.greenLight }]}>
          <Text style={[styles.crewCountText, { color: Brand.green }]}>
            {checkedInCount}/{crew.length} here
          </Text>
        </View>
      </View>

      {crew.map((member) => (
        <View
          key={member.id}
          style={[styles.memberRow, { borderColor: colors.border }]}>
          <View style={[styles.memberAvatar, { backgroundColor: GRADE_COLORS[member.grade] + '20' }]}>
            <Text style={[styles.memberInitial, { color: GRADE_COLORS[member.grade] }]}>
              {member.name.charAt(0)}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: colors.text }]}>
                {member.name}
                {member.isYou ? ' (you)' : ''}
              </Text>
              {member.checkedIn && <Text style={styles.checkedEmoji}>✅</Text>}
            </View>
            <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
              {member.role}
            </Text>
          </View>
          <View style={[styles.gradeDot, { backgroundColor: GRADE_COLORS[member.grade] }]} />
        </View>
      ))}
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 20,
  },
  notFoundEmoji: {
    fontSize: 48,
  },
  backLink: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backLinkText: {
    color: '#ffffff',
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  // Hero card
  heroCard: {
    backgroundColor: Brand.green,
    borderRadius: 20,
    padding: 22,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: FontFamily.headingBold,
    marginTop: 2,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  heroDetails: {
    gap: 8,
    marginTop: 4,
  },
  heroDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroEmoji: {
    fontSize: 15,
  },
  heroDetailText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  heroCapacity: {
    marginTop: 6,
  },
  heroCapacityBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  heroCapacityFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Status badge (inside hero)
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  // Notes banner
  notesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
  notesEmoji: {
    fontSize: 18,
  },
  notesText: {
    color: '#92400e',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    flex: 1,
    lineHeight: 20,
  },

  // Primary action button
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },

  // Checked-in banner
  checkedInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
  },
  checkedInEmoji: {
    fontSize: 28,
  },
  checkedInTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
  checkedInSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    opacity: 0.8,
  },

  // Section card
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionEmoji: {
    fontSize: 20,
  },

  // Crew section
  crewCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  crewCountText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  checkedEmoji: {
    fontSize: 12,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  gradeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Photo section
  photoScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  addPhotoButton: {
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addPhotoEmoji: {
    fontSize: 28,
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Music section
  musicSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  musicInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 44,
  },
  addSongButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  queueRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRankText: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
  },
  songInfo: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  songMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 36,
  },
  voteEmoji: {
    fontSize: 14,
  },
  voteCount: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

  // Full shift banner
  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
  },
  fullEmoji: {
    fontSize: 22,
  },
});
