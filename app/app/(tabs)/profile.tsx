import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { DUMMY_PROFILE } from "@/lib/dummy-data";

const GRADE_CONFIG: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  GREEN: { label: "Green", color: "#22c55e", emoji: "🌿" },
  YELLOW: { label: "Yellow", color: "#eab308", emoji: "⭐" },
  PINK: { label: "Pink", color: "#ec4899", emoji: "💖" },
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const user = DUMMY_PROFILE;
  const grade = GRADE_CONFIG[user.volunteerGrade];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user.image ? (
            <Image source={{ uri: user.image }} style={styles.avatarImage} />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: Brand.green }]}
            >
              <Text style={styles.avatarText}>{user.firstName.charAt(0)}</Text>
            </View>
          )}
        </View>
        <ThemedText type="title">
          {user.firstName} {user.lastName}
        </ThemedText>
        <View
          style={[styles.gradeBadge, { backgroundColor: grade.color + "18" }]}
        >
          <Text style={styles.gradeEmoji}>{grade.emoji}</Text>
          <Text style={[styles.gradeText, { color: grade.color }]}>
            {grade.label} Volunteer
          </Text>
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={styles.statEmoji}>🍽️</Text>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {user.totalShifts}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Mahi
          </Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={styles.statEmoji}>📅</Text>
          <Text style={[styles.statNumber, { color: colors.text }]}>
            {format(new Date(user.memberSince), "MMM yy")}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Joined
          </Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={[styles.statNumber, { color: colors.text }]}>3</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Badges
          </Text>
        </View>
      </View>

      {/* ── Personal Info ── */}
      <SectionCard emoji="👤" title="Personal Information" colors={colors}>
        <InfoRow emoji="📧" label="Email" value={user.email} colors={colors} />
        <Divider color={colors.border} />
        <InfoRow emoji="📱" label="Phone" value={user.phone} colors={colors} />
        <Divider color={colors.border} />
        <InfoRow
          emoji="💬"
          label="Pronouns"
          value={user.pronouns}
          colors={colors}
        />
      </SectionCard>

      {/* ── Emergency Contact ── */}
      <SectionCard emoji="🚨" title="Emergency Contact" colors={colors}>
        <InfoRow
          emoji="👤"
          label="Name"
          value={user.emergencyContactName}
          colors={colors}
        />
        <Divider color={colors.border} />
        <InfoRow
          emoji="💚"
          label="Relationship"
          value={user.emergencyContactRelationship}
          colors={colors}
        />
        <Divider color={colors.border} />
        <InfoRow
          emoji="📱"
          label="Phone"
          value={user.emergencyContactPhone}
          colors={colors}
        />
      </SectionCard>

      {/* ── Sign out ── */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => {} },
          ]);
        }}
        style={({ pressed }) => [
          styles.signOutButton,
          { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>
          Sign Out
        </Text>
      </Pressable>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Ngā mihi nui for being part of the whānau 💚
        </Text>
      </View>
    </ScrollView>
  );
}

/* ── Section Card ── */
function SectionCard({
  emoji,
  title,
  colors,
  children,
}: {
  emoji: string;
  title: string;
  colors: (typeof Colors)["light"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {title.toUpperCase()}
        </Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

/* ── Info Row ── */
function InfoRow({
  emoji,
  label,
  value,
  colors,
}: {
  emoji: string;
  label: string;
  value: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Text style={styles.infoEmoji}>{emoji}</Text>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.infoValue, { color: colors.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/* ── Divider ── */
function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    // paddingBottom is set dynamically via insets.bottom in contentContainerStyle
  },

  // Header
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 4,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 36,
    fontFamily: FontFamily.bold,
  },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 2,
  },
  gradeEmoji: {
    fontSize: 14,
  },
  gradeText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: {
    fontSize: 22,
  },
  statNumber: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },

  // Section card
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  sectionEmoji: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Info row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoEmoji: {
    fontSize: 15,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    flex: 1,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
  },

  // Sign out
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },
});
