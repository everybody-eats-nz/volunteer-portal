import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Share,
  Linking,
  View,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';

import { ThemedText } from '@/components/themed-text';
import { Colors, Brand, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  MY_SHIFTS,
  AVAILABLE_SHIFTS,
  SHIFT_CREW,
  SHIFT_SIGNUPS,
  getShiftThemeByName,
  getConcurrentShifts,
  getLocationShortAddress,
  getLocationMapsUrl,
  getResourcesForShiftType,
  type Shift,
  type Resource,
} from '@/lib/dummy-data';

/* ── Music Queue Type ── */

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

/* ── Duration Helper ── */

function getDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/* ── Main Screen ── */

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

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
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <View style={[s.notFoundIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
            <Ionicons name="search-outline" size={32} color={colors.textSecondary} />
          </View>
          <ThemedText type="subtitle" style={{ marginTop: 12 }}>
            Shift not found
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            This mahi may have been removed
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              s.backButton,
              { backgroundColor: Brand.green, opacity: pressed ? 0.9 : 1 },
            ]}>
            <Text style={s.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;
  const isFull = spotsLeft <= 0;
  const isUrgent = !isFull && spotsLeft <= 2;
  const theme = getShiftThemeByName(shift.shiftType.name);
  const accent = isDark ? theme.colorDark : theme.color;
  const hoursUntil = differenceInHours(date, new Date());
  const fillPercent = Math.min((shift.signedUp / shift.capacity) * 100, 100);
  const duration = getDuration(shift.start, shift.end);

  // Signups for "Who's on this mahi" section
  const signups = SHIFT_SIGNUPS[shift.id] ?? [];
  const friendSignups = signups.filter((su) => su.isFriend);

  // Concurrent shifts (same day, same AM/PM, same location)
  const concurrentShifts = getConcurrentShifts(shift.id);

  // Relevant resources for this shift type
  const relevantResources = getResourcesForShiftType(shift.shiftType.name);

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
    setQueue((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: musicSearch.trim(),
        artist: 'Searching...',
        requestedBy: 'You',
        votes: 0,
      },
    ]);
    setMusicSearch('');
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateStr = format(date, "EEEE d MMMM");
    const timeStr = `${format(date, "h:mm a")} – ${format(endDate, "h:mm a")}`;
    try {
      await Share.share({
        message: `🍽️ Volunteer with Everybody Eats!\n\n${shift.shiftType.name} — ${dateStr}\n🕐 ${timeStr}\n📍 ${shift.location}\n\n${spotsLeft > 0 ? `${spotsLeft} spots left — sign up and join the whānau!` : 'This shift is full, but check back for cancellations.'}\n\nhttps://everybodyeats.nz/shifts`,
      });
    } catch {
      // User cancelled share
    }
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
          title: '',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTransparent: true,
          headerTintColor: '#ffffff',
          headerRight: () => (
            <Pressable
              onPress={handleShare}
              hitSlop={8}
              style={({ pressed }) => [
                s.headerShareButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Share shift"
            >
              <Ionicons name="share-outline" size={22} color="#ffffff" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        {/* ═══ Hero Header ═══ */}
        <View style={[s.hero, { backgroundColor: Brand.green }]}>
          {/* Background image */}
          {theme.heroImage && (
            <Image
              source={{ uri: theme.heroImage }}
              style={s.heroImage}
              contentFit="cover"
            />
          )}

          {/* Gradient overlay — transparent top, rich bottom */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.1)',
              'rgba(14,58,35,0.4)',
              'rgba(14,58,35,0.88)',
              'rgba(14,58,35,0.96)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={s.heroGradient}
          />

          {/* Main content */}
          <View style={s.heroBody}>
            {/* Large emoji */}
            <Text style={s.heroEmoji}>{theme.emoji}</Text>

            {/* Title */}
            <Text style={s.heroTitle}>{shift.shiftType.name}</Text>

            {/* Description */}
            <Text style={s.heroDescription}>{shift.shiftType.description}</Text>

            {/* Frosted info strip */}
            <BlurView intensity={25} tint="dark" style={s.heroInfoStrip}>
              <View style={s.heroInfoStripInner}>
                <View style={s.heroInfoChip}>
                  <Text style={s.heroInfoIcon}>📅</Text>
                  <Text style={s.heroInfoText}>{format(date, 'EEE, d MMM')}</Text>
                </View>
                <View style={s.heroInfoDot} />
                <View style={s.heroInfoChip}>
                  <Text style={s.heroInfoIcon}>🕐</Text>
                  <Text style={s.heroInfoText}>
                    {format(date, 'h:mm')} – {format(endDate, 'h:mm a')}
                  </Text>
                </View>
                <View style={s.heroInfoDot} />
                <Pressable
                  onPress={() => Linking.openURL(getLocationMapsUrl(shift.location))}
                  hitSlop={6}
                  style={({ pressed }) => [s.heroInfoChip, { opacity: pressed ? 0.6 : 1 }]}
                  accessibilityLabel={`Open ${shift.location} in Maps`}
                  accessibilityRole="link"
                >
                  <Text style={s.heroInfoIcon}>📍</Text>
                  <Text style={[s.heroInfoText, s.heroInfoLink]}>
                    {shift.location}
                  </Text>
                </Pressable>
              </View>
            </BlurView>

            {/* Bottom row — changes based on signed-up state */}
            <View style={s.heroBottomRow}>
              {isMyShift ? (
                /* Confirmed: show "you're in" + countdown */
                <>
                  <View style={s.heroConfirmedChip}>
                    <Ionicons name="checkmark-circle" size={14} color="#86efac" />
                    <Text style={s.heroConfirmedText}>You&apos;re signed up</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                </>
              ) : (
                /* Browsing: show capacity bar + spots */
                <View style={s.heroCapacity}>
                  <View style={s.heroCapacityTrack}>
                    <View
                      style={[
                        s.heroCapacityFill,
                        {
                          width: `${fillPercent}%`,
                          backgroundColor: isFull ? '#ef4444' : isUrgent ? '#f59e0b' : '#86efac',
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.heroCapacityText}>
                    {shift.signedUp}/{shift.capacity}
                    {isFull
                      ? ' · Full'
                      : isUrgent
                        ? ` · ${spotsLeft} left!`
                        : ` · ${spotsLeft} open`}
                  </Text>
                </View>
              )}

              <View style={s.heroDurationBadge}>
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroDurationText}>{duration}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ Notes ═══ */}
        {shift.notes && (
          <View style={[s.notesCard, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#fffbeb' }]}>
            <View style={[s.notesIconCircle, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7' }]}>
              <Ionicons name="information-circle" size={18} color={isDark ? '#fbbf24' : '#b45309'} />
            </View>
            <Text style={[s.notesText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
              {shift.notes}
            </Text>
          </View>
        )}

        {/* ═══ Useful Resources ═══ */}
        {relevantResources.length > 0 && !checkedIn && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff' }]}>
                <Ionicons name="document-text" size={16} color={isDark ? '#93c5fd' : '#2563eb'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Before Your Mahi</Text>
                <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
                  Guides and resources for this shift
                </Text>
              </View>
            </View>

            {relevantResources.map((resource) => (
              <Pressable
                key={resource.id}
                onPress={() => Linking.openURL(resource.url)}
                style={({ pressed }) => [
                  s.resourceRow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                accessibilityLabel={`Open ${resource.title}`}
                accessibilityRole="link"
              >
                <View style={[
                  s.resourceIcon,
                  {
                    backgroundColor: resource.type === 'VIDEO'
                      ? isDark ? 'rgba(249,115,22,0.12)' : '#fff7ed'
                      : isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                  },
                ]}>
                  <Ionicons
                    name={resource.type === 'VIDEO' ? 'play-circle' : 'document-text'}
                    size={16}
                    color={resource.type === 'VIDEO'
                      ? isDark ? '#fb923c' : '#ea580c'
                      : isDark ? '#f87171' : '#dc2626'}
                  />
                </View>
                <View style={s.resourceInfo}>
                  <Text style={[s.resourceTitle, { color: colors.text }]} numberOfLines={1}>
                    {resource.title}
                  </Text>
                  {resource.description && (
                    <Text style={[s.resourceDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                      {resource.description}
                    </Text>
                  )}
                </View>
                <View style={s.resourceMeta}>
                  {resource.fileSize && (
                    <Text style={[s.resourceSize, { color: colors.textSecondary }]}>
                      {resource.fileSize}
                    </Text>
                  )}
                  <Ionicons
                    name={resource.type === 'VIDEO' ? 'open-outline' : 'download-outline'}
                    size={14}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* ═══ Who's on this mahi ═══ */}
        {/* Before check-in: only show friends (privacy) */}
        {friendSignups.length > 0 && !checkedIn && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(14,58,35,0.3)' : Brand.greenLight }]}>
                <Ionicons name="people" size={16} color={isDark ? '#86efac' : Brand.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Friends on this mahi</Text>
                <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
                  {friendSignups.length} friend{friendSignups.length !== 1 ? 's' : ''} signed up
                  {signups.length - friendSignups.length > 0
                    ? ` · ${signups.length - friendSignups.length} other${signups.length - friendSignups.length !== 1 ? 's' : ''}`
                    : ''}
                </Text>
              </View>
            </View>

            {/* Friend list */}
            {friendSignups.map((signup) => {
              const initial = signup.name.charAt(0).toUpperCase();
              return (
                <View
                  key={signup.id}
                  style={[
                    s.signupRow,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' },
                  ]}>
                  {signup.profilePhotoUrl ? (
                    <Image
                      source={{ uri: signup.profilePhotoUrl }}
                      style={s.signupAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[s.signupAvatarFallback, { backgroundColor: Brand.greenLight }]}>
                      <Text style={[s.signupInitial, { color: Brand.green }]}>{initial}</Text>
                    </View>
                  )}
                  <Text style={[s.signupName, { color: colors.text }]} numberOfLines={1}>
                    {signup.name}
                  </Text>
                  <View style={[s.friendTag, { backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#dcfce7' }]}>
                    <Ionicons name="heart" size={10} color={isDark ? '#86efac' : '#16a34a'} />
                    <Text style={[s.friendTagText, { color: isDark ? '#86efac' : '#16a34a' }]}>Friend</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══ Check-in CTA ═══ */}
        {isMyShift && shift.status === 'CONFIRMED' && !checkedIn && (
          <Pressable
            onPress={handleCheckIn}
            style={({ pressed }) => [
              s.ctaButton,
              {
                backgroundColor: Brand.green,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            accessibilityLabel="Check in to shift">
            <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
            <Text style={s.ctaText}>Check In</Text>
          </Pressable>
        )}

        {/* ═══ Checked-in banner ═══ */}
        {checkedIn && (
          <View style={[s.successBanner, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : Brand.greenLight }]}>
            <View style={[s.successIcon, { backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={24} color={isDark ? '#86efac' : '#16a34a'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.successTitle, { color: isDark ? '#86efac' : Brand.green }]}>
                Ka pai! You&apos;re checked in
              </Text>
              <Text style={[s.successSubtitle, { color: isDark ? '#86efac' : Brand.green }]}>
                Have a great mahi today
              </Text>
            </View>
          </View>
        )}

        {/* ═══ Crew section (after check-in) ═══ */}
        {checkedIn && (
          <CrewSection shiftId={shift.id} colors={colors} isDark={isDark} />
        )}

        {/* ═══ Other shifts today (after check-in) ═══ */}
        {checkedIn && concurrentShifts.length > 0 && (
          <ConcurrentShiftsSection
            shifts={concurrentShifts}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* ═══ Shift Photos ═══ */}
        {checkedIn && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(168,85,247,0.12)' : '#f5f3ff' }]}>
                <Ionicons name="camera" size={16} color={isDark ? '#c084fc' : '#7c3aed'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Shift Photos</Text>
                <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
                  Share moments from today&apos;s mahi
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.photoScroll}>
              <Pressable
                onPress={handleAddPhoto}
                style={({ pressed }) => [
                  s.addPhotoButton,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Ionicons name="add-circle-outline" size={28} color={accent} />
                <Text style={[s.addPhotoText, { color: accent }]}>Add</Text>
              </Pressable>

              {photos.map((uri, index) => (
                <View key={uri} style={s.photoThumb}>
                  <Image source={{ uri }} style={s.photoImage} contentFit="cover" />
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPhotos((prev) => prev.filter((_, i) => i !== index));
                    }}
                    style={({ pressed }) => [s.photoRemove, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="close-circle" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ═══ Music Queue ═══ */}
        {checkedIn && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(236,72,153,0.12)' : '#fdf2f8' }]}>
                <Ionicons name="musical-notes" size={16} color={isDark ? '#f472b6' : '#db2777'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Music Queue</Text>
                <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
                  Request songs for the BOH speaker
                </Text>
              </View>
            </View>

            {/* Search */}
            <View style={s.musicRow}>
              <View style={[s.musicInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[s.musicInput, { color: colors.text, fontFamily: FontFamily.regular }]}
                  value={musicSearch}
                  onChangeText={setMusicSearch}
                  placeholder="Search for a song..."
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={handleAddSong}
                  returnKeyType="send"
                />
              </View>
              <Pressable
                onPress={handleAddSong}
                disabled={!musicSearch.trim()}
                style={({ pressed }) => [
                  s.addSongButton,
                  {
                    backgroundColor: musicSearch.trim() ? Brand.green : isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                    opacity: pressed && musicSearch.trim() ? 0.8 : 1,
                  },
                ]}>
                <Ionicons name="add" size={22} color={musicSearch.trim() ? '#ffffff' : colors.textSecondary} />
              </Pressable>
            </View>

            {/* Queue list */}
            {queue.map((item, index) => (
              <View
                key={item.id}
                style={[s.queueItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa' }]}>
                <View style={[s.queueRank, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
                  <Text style={[s.queueRankText, { color: colors.textSecondary }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={s.songInfo}>
                  <Text style={[s.songTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[s.songMeta, { color: colors.textSecondary }]}>
                    {item.artist} · {item.requestedBy}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleVote(item.id)}
                  style={({ pressed }) => [
                    s.voteButton,
                    {
                      borderColor: votedSongs.has(item.id) ? accent : isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                      backgroundColor: votedSongs.has(item.id)
                        ? isDark ? theme.bgDark : theme.bgLight
                        : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Ionicons
                    name={votedSongs.has(item.id) ? 'heart' : 'heart-outline'}
                    size={14}
                    color={votedSongs.has(item.id) ? accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      s.voteCount,
                      { color: votedSongs.has(item.id) ? accent : colors.text },
                    ]}>
                    {item.votes}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ═══ Sign up CTA ═══ */}
        {!isMyShift && spotsLeft > 0 && (
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Ka pai! 🎉', "You've signed up for this mahi. See you there!");
            }}
            style={({ pressed }) => [
              s.ctaButton,
              {
                backgroundColor: Brand.green,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            accessibilityLabel="Sign up for shift">
            <Ionicons name="hand-right" size={20} color="#ffffff" />
            <Text style={s.ctaText}>Sign Up for Mahi</Text>
          </Pressable>
        )}

        {!isMyShift && spotsLeft <= 0 && (
          <View style={[s.fullBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2' }]}>
            <Ionicons name="close-circle-outline" size={20} color={isDark ? '#fca5a5' : '#dc2626'} />
            <Text style={[s.fullText, { color: isDark ? '#fca5a5' : '#dc2626' }]}>
              This mahi is full — check back later for cancellations
            </Text>
          </View>
        )}
      </ScrollView>
    </>
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
  isDark,
}: {
  shiftId: string;
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const crew = SHIFT_CREW[shiftId];
  if (!crew || crew.length === 0) return null;

  // Cross-reference signups to know who is a friend
  const signups = SHIFT_SIGNUPS[shiftId] ?? [];
  const friendIds = new Set(signups.filter((su) => su.isFriend).map((su) => su.id));

  const checkedInCount = crew.filter((m) => m.checkedIn).length;

  /** Show full name for friends + yourself, first name only for non-friends (privacy) */
  function getDisplayName(member: (typeof crew)[0]): string {
    if (member.isYou) return member.name;
    if (friendIds.has(member.id)) return member.name;
    return member.name.split(' ')[0]; // first name only
  }

  return (
    <View style={[s.section, { backgroundColor: colors.card }]}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(14,58,35,0.3)' : Brand.greenLight }]}>
          <Ionicons name="people" size={16} color={isDark ? '#86efac' : Brand.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Shift Whānau</Text>
          <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
            {checkedInCount} of {crew.length} checked in
          </Text>
        </View>
        <View style={[s.crewBadge, { backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : Brand.greenLight }]}>
          <Text style={[s.crewBadgeText, { color: isDark ? '#86efac' : Brand.green }]}>
            {checkedInCount}/{crew.length}
          </Text>
        </View>
      </View>

      {crew.map((member) => {
        const gradeColor = GRADE_COLORS[member.grade];
        const isFriend = friendIds.has(member.id);
        const displayName = getDisplayName(member);
        return (
          <View
            key={member.id}
            style={[
              s.memberRow,
              {
                backgroundColor: member.checkedIn
                  ? isDark ? 'rgba(34,197,94,0.06)' : '#f0fdf4'
                  : isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
              },
            ]}>
            <View style={[s.memberAvatar, { backgroundColor: gradeColor + '18' }]}>
              <Text style={[s.memberInitial, { color: gradeColor }]}>
                {member.name.charAt(0)}
              </Text>
              <View style={[s.gradeRing, { borderColor: gradeColor }]} />
            </View>
            <View style={s.memberInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.memberName, { color: colors.text }]}>
                  {displayName}
                  {member.isYou && (
                    <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.regular }}> (you)</Text>
                  )}
                </Text>
                {isFriend && !member.isYou && (
                  <View style={[s.friendTag, { backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#dcfce7' }]}>
                    <Ionicons name="heart" size={8} color={isDark ? '#86efac' : '#16a34a'} />
                  </View>
                )}
              </View>
              <Text style={[s.memberRole, { color: colors.textSecondary }]}>{member.role}</Text>
            </View>
            {member.checkedIn ? (
              <View style={[s.checkedInDot, { backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7' }]}>
                <Ionicons name="checkmark" size={12} color={isDark ? '#86efac' : '#16a34a'} />
              </View>
            ) : (
              <View style={[s.awaitingDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }]}>
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ── Concurrent Shifts Section ── */

function ConcurrentShiftsSection({
  shifts,
  colors,
  isDark,
}: {
  shifts: Shift[];
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const totalPeople = shifts.reduce((sum, sh) => {
    const crew = SHIFT_CREW[sh.id];
    return sum + (crew ? crew.length : sh.signedUp);
  }, 0);

  return (
    <View style={[s.section, { backgroundColor: colors.card }]}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconCircle, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff' }]}>
          <Ionicons name="people-circle" size={18} color={isDark ? '#93c5fd' : '#2563eb'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Also Working Today</Text>
          <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
            {totalPeople} people across {shifts.length} other mahi
          </Text>
        </View>
      </View>

      {shifts.map((concurrentShift) => {
        const theme = getShiftThemeByName(concurrentShift.shiftType.name);
        const accent = isDark ? theme.colorDark : theme.color;
        const crew = SHIFT_CREW[concurrentShift.id] ?? [];
        const signups = SHIFT_SIGNUPS[concurrentShift.id] ?? [];
        const friendIds = new Set(signups.filter((su) => su.isFriend).map((su) => su.id));
        const checkedInCount = crew.filter((m) => m.checkedIn).length;

        return (
          <View key={concurrentShift.id} style={s.concurrentShiftGroup}>
            {/* Shift type header */}
            <View style={[s.concurrentShiftHeader, { backgroundColor: isDark ? theme.bgDark : theme.bgLight }]}>
              <Text style={s.concurrentShiftEmoji}>{theme.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.concurrentShiftName, { color: colors.text }]}>
                  {concurrentShift.shiftType.name}
                </Text>
                <Text style={[s.concurrentShiftMeta, { color: colors.textSecondary }]}>
                  {checkedInCount} of {crew.length || concurrentShift.signedUp} checked in
                </Text>
              </View>
              <View style={[s.crewBadge, { backgroundColor: isDark ? `${accent}18` : `${accent}18` }]}>
                <Text style={[s.crewBadgeText, { color: accent }]}>
                  {checkedInCount}/{crew.length || concurrentShift.signedUp}
                </Text>
              </View>
            </View>

            {/* Crew members */}
            {crew.map((member) => {
              const gradeColor = GRADE_COLORS[member.grade];
              const isFriend = friendIds.has(member.id);
              // First name only for non-friends (privacy)
              const displayName = isFriend ? member.name : member.name.split(' ')[0];

              return (
                <View
                  key={member.id}
                  style={[
                    s.memberRow,
                    {
                      backgroundColor: member.checkedIn
                        ? isDark ? 'rgba(34,197,94,0.06)' : '#f0fdf4'
                        : isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
                    },
                  ]}>
                  <View style={[s.memberAvatar, { backgroundColor: gradeColor + '18' }]}>
                    <Text style={[s.memberInitial, { color: gradeColor }]}>
                      {member.name.charAt(0)}
                    </Text>
                    <View style={[s.gradeRing, { borderColor: gradeColor }]} />
                  </View>
                  <View style={s.memberInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.memberName, { color: colors.text }]}>
                        {displayName}
                      </Text>
                      {isFriend && (
                        <View style={[s.friendTag, { backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : '#dcfce7' }]}>
                          <Ionicons name="heart" size={8} color={isDark ? '#86efac' : '#16a34a'} />
                        </View>
                      )}
                    </View>
                    <Text style={[s.memberRole, { color: colors.textSecondary }]}>{member.role}</Text>
                  </View>
                  {member.checkedIn ? (
                    <View style={[s.checkedInDot, { backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7' }]}>
                      <Ionicons name="checkmark" size={12} color={isDark ? '#86efac' : '#16a34a'} />
                    </View>
                  ) : (
                    <View style={[s.awaitingDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }]}>
                      <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40, gap: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 20,
  },
  notFoundIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#ffffff',
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  // Header
  headerShareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    paddingTop: 130,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBody: {
    position: 'relative',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: 2,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: FontFamily.headingBold,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  heroDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroDurationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  heroInfoStrip: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  heroInfoStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroInfoIcon: {
    fontSize: 13,
  },
  heroInfoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  heroInfoLink: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.4)',
  },
  heroInfoDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  heroCapacity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCapacityTrack: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  heroCapacityFill: {
    height: '100%',
    borderRadius: 2,
  },
  heroCapacityText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  heroConfirmedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroConfirmedText: {
    color: '#86efac',
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

  // Resources
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceInfo: {
    flex: 1,
    gap: 2,
  },
  resourceTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  resourceDescription: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resourceSize: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
  },

  // Notes card
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
  },
  notesIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  notesText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    flex: 1,
    lineHeight: 20,
  },

  // CTA button
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    minHeight: 56,
  },
  ctaText: {
    color: '#ffffff',
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },

  // Success banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
  successSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },

  // Sections
  section: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  sectionCaption: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },

  // Signup rows
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  signupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  signupAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupInitial: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  signupName: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
  },
  friendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  friendTagText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },

  // Crew
  crewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  crewBadgeText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },
  gradeRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.3,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  checkedInDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  awaitingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Concurrent shifts
  concurrentShiftGroup: {
    gap: 8,
  },
  concurrentShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  concurrentShiftEmoji: {
    fontSize: 18,
  },
  concurrentShiftName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  concurrentShiftMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },

  // Photos
  photoScroll: { gap: 10, paddingVertical: 2 },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4 },

  // Music
  musicRow: {
    flexDirection: 'row',
    gap: 8,
  },
  musicInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  musicInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  addSongButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  queueRank: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRankText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },
  songInfo: { flex: 1, gap: 2 },
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
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
  },
  voteCount: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

  // Full banner
  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
  },
  fullText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },
});
