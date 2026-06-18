import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminThreads, clearAdminUnreadCount } from "@/hooks/use-admin";
import { formatRelativeTime, initialOf } from "@/lib/admin-format";
import { queryClient } from "@/lib/query-client";
import type { AdminThreadListItem, ThreadStatus } from "@/lib/admin";

type Filter = ThreadStatus | "ALL";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "ALL", label: "All" },
];

export default function AdminInboxScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>("OPEN");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Light debounce so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isPending, isError, refetch, isRefetching } = useAdminThreads({
    status: filter,
    search,
  });

  // Opening the inbox counts as "seen" for the tab badge until the next poll.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      clearAdminUnreadCount(queryClient);
    }, [refetch])
  );

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const eyebrow = isDark ? Brand.greenLight : Brand.green;

  const renderItem = useCallback(
    ({ item }: { item: AdminThreadListItem }) => (
      <ThreadRow
        item={item}
        colors={colors}
        rule={rule}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/admin/messages/${item.id}` as Href);
        }}
      />
    ),
    [colors, rule, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: rule }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={eyebrow} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Search */}
      <View style={styles.controls}>
        <View style={[styles.searchField, { backgroundColor: colors.surfaceSunk, borderColor: rule }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by name or email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search conversations"
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput("")} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Filter segmented control */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f.key);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? Brand.green : "transparent",
                    borderColor: active ? Brand.green : rule,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? "#FDF8EF" : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* List */}
      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={eyebrow} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn&apos;t load messages</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: eyebrow }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState colors={colors} filter={filter} search={search} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: rule }]} />
          )}
        />
      )}
    </View>
  );
}

/* ─── Thread row ────────────────────────────────────────────── */

const ThreadRow = React.memo(function ThreadRow({
  item,
  colors,
  rule,
  onPress,
}: {
  item: AdminThreadListItem;
  colors: (typeof Colors)["light"];
  rule: string;
  onPress: () => void;
}) {
  const preview =
    item.lastMessage == null
      ? "No messages yet"
      : `${item.lastMessage.senderRole === "ADMIN" ? "You: " : ""}${item.lastMessage.body.replace(/\s+/g, " ").trim()}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${item.volunteer.name}${item.unreadForTeam ? ", unread" : ""}`}
    >
      {item.volunteer.profilePhotoUrl ? (
        <Image source={{ uri: item.volunteer.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarInitial, { color: Brand.green }]}>
            {initialOf(item.volunteer.name)}
          </Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text
            style={[
              styles.rowName,
              { color: colors.text, fontFamily: item.unreadForTeam ? FontFamily.bold : FontFamily.semiBold },
            ]}
            numberOfLines={1}
          >
            {item.volunteer.name}
          </Text>
          <Text style={[styles.rowTime, { color: colors.textSecondary }]}>
            {formatRelativeTime(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.rowBottomLine}>
          <Text
            style={[
              styles.rowPreview,
              {
                color: item.unreadForTeam ? colors.text : colors.textSecondary,
                fontFamily: item.unreadForTeam ? FontFamily.medium : FontFamily.regular,
              },
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {item.status === "RESOLVED" && (
            <View style={[styles.resolvedChip, { borderColor: rule }]}>
              <Ionicons name="checkmark" size={11} color={colors.textSecondary} />
            </View>
          )}
          {item.unreadForTeam && <View style={styles.unreadDot} />}
        </View>
      </View>
    </Pressable>
  );
});

/* ─── Empty state ───────────────────────────────────────────── */

function EmptyState({
  colors,
  filter,
  search,
}: {
  colors: (typeof Colors)["light"];
  filter: Filter;
  search: string;
}) {
  const message = search
    ? "No conversations match your search."
    : filter === "OPEN"
      ? "No open conversations — you're all caught up. Ka pai!"
      : filter === "RESOLVED"
        ? "No resolved conversations yet."
        : "No conversations yet.";
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Inbox zero</Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: 20 },
  controls: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15, paddingVertical: 0 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: { fontFamily: FontFamily.semiBold, fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: FontFamily.bold, fontSize: 18 },
  rowBody: { flex: 1, gap: 3 },
  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { flex: 1, fontSize: 16 },
  rowTime: { fontFamily: FontFamily.regular, fontSize: 12 },
  rowBottomLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowPreview: { flex: 1, fontSize: 14, lineHeight: 19 },
  resolvedChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: Brand.green },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontFamily: FontFamily.headingBold, fontSize: 22, marginBottom: 8, textAlign: "center" },
  emptyBody: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
});
