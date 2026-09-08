import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDriveHome, useDriverState } from "@/hooks/use-van";
import { queryKeys } from "@/lib/query-keys";
import type { FleetVan, OpenTrip, TripDay } from "@/lib/van";

/** How long a painted Drive tab counts as current when returning to it. */
const HOME_FRESH_MS = 15_000;

/**
 * The Drive tab.
 *
 * Two states, and the screen commits fully to whichever one is true. With a
 * van out, the answer to "what now" is one dark panel and one button — ending
 * the trip is the only thing that matters and nothing else may compete with
 * it. With no van out, the fleet is the screen: tapping a van is the first of
 * the four or five taps that log a trip.
 *
 * The tab only exists for an APPROVED DriverProfile — driving is a capability,
 * not a role — but the screen guards itself too, because a tab that was
 * rendered a moment ago is not proof of anything.
 */
export default function DriveScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const queryClient = useQueryClient();
  const driver = useDriverState();
  const home = useDriveHome(driver.data?.canDrive === true);

  useFocusEffect(
    useCallback(() => {
      // A trip may have been started or ended on the web since this was last
      // painted, or closed out from under the driver by whoever took the van
      // next. Returning to the tab re-asks rather than trusting the cache —
      // but only if what is on screen has had time to go stale. Without the
      // guard, flicking between tabs fires a request per visit, which is the
      // one thing a driver on one bar in a loading bay cannot afford.
      const updatedAt = queryClient.getQueryState(
        queryKeys.van.home()
      )?.dataUpdatedAt;
      if (updatedAt && Date.now() - updatedAt < HOME_FRESH_MS) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.van.home() });
    }, [queryClient])
  );

  if (driver.data && !driver.data.canDrive) {
    return <NotADriver colors={colors} note={driver.data.statusNote} />;
  }

  const data = home.data;
  const open = data?.openTrip ?? null;
  // `home` stays disabled until the driver gate answers, and a disabled query
  // reports isLoading false — so ask isPending, or the empty-fleet copy flashes
  // over a fleet that is simply not fetched yet.
  const loadingFleet = driver.isPending || (home.isPending && !data);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching && !home.isLoading}
            onRefresh={() => void home.refetch()}
            tintColor={colors.tint}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroLine}>
            <Text style={[styles.heroText, { color: colors.text }]}>
              Kia ora,{" "}
            </Text>
            <Text
              style={[
                styles.heroText,
                styles.heroAccent,
                { color: colors.text },
              ]}
            >
              {data?.firstName ?? "driver"}
            </Text>
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {open
              ? `${open.vehicleName} is with you. End the trip when you are back and the log looks after itself.`
              : "Scan the sticker on the dash, or pick a van below. Photo, reading, what it's for — that's the log."}
          </Text>
        </View>

        {open ? (
          <OpenTripPanel
            trip={open}
            colors={colors}
            onEnd={() => {
              if (Platform.OS === "ios") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.push({
                pathname: "/van/trip/[tripId]",
                params: { tripId: open.id, end: "1" },
              });
            }}
            onOpen={() =>
              router.push({
                pathname: "/van/trip/[tripId]",
                params: { tripId: open.id },
              })
            }
          />
        ) : null}

        <View style={styles.sectionHead}>
          <Eyebrow color={isDark ? Brand.greenLight : Brand.green}>
            {open ? "The rest of the fleet" : "Take a van out"}
          </Eyebrow>
        </View>

        <View style={styles.fleet}>
          {(data?.fleet ?? []).map((van, index) => (
            <VanRow
              key={van.id}
              van={van}
              colors={colors}
              isDark={isDark}
              first={index === 0}
              onPress={() => {
                if (Platform.OS === "ios") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push({
                  pathname: "/van/start/[vanId]",
                  params: { vanId: van.id },
                });
              }}
            />
          ))}
          {loadingFleet && (data?.fleet ?? []).length === 0 ? (
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
              Loading the fleet…
            </Text>
          ) : null}
          {!loadingFleet && (data?.fleet ?? []).length === 0 ? (
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
              No vans are set up yet. The office adds them on the portal.
            </Text>
          ) : null}
        </View>

        <RecentTrips
          days={data?.days ?? []}
          recentKmLabel={data?.recentKmLabel ?? "0 km"}
          colors={colors}
          isDark={isDark}
          onOpenTrip={(tripId) =>
            router.push({ pathname: "/van/trip/[tripId]", params: { tripId } })
          }
          onSeeAll={() => router.push("/van/trips")}
        />

        <View style={styles.footer}>
          <View style={[styles.hairline, { backgroundColor: colors.border }]} />
          <View style={styles.footerEyebrow}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              Ngā mihi · every km counts toward the report
            </Eyebrow>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── The van that is out ───────────────────────────────────── */

function OpenTripPanel({
  trip,
  colors,
  onEnd,
  onOpen,
}: {
  trip: OpenTrip | null;
  colors: (typeof Colors)["light"];
  onEnd: () => void;
  onOpen: () => void;
}) {
  if (!trip) return null;

  return (
    <View style={[styles.panel, { backgroundColor: colors.panel }]}>
      {/* The warm sun bloom the brand's dark panels carry. A flat circle reads
          as a shape rather than a glow, so it fades out along its own axis. */}
      <LinearGradient
        colors={[colors.accentGlow, "transparent"]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.15, y: 0.15 }}
        style={styles.panelGlow}
        pointerEvents="none"
      />

      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${trip.vehicleName}, out ${trip.sinceLabel}. Open the trip.`}
        style={({ pressed }) => [
          styles.panelHead,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={styles.panelHeadBody}>
          <Eyebrow color={Palette.sun200} rule={false}>
            On a trip
          </Eyebrow>
          <Text style={[styles.panelTitle, { color: colors.panelText }]}>
            {trip.vehicleName}
          </Text>
          <Text style={[styles.panelMeta, { color: colors.panelMuted }]}>
            {trip.purposeLabel} · {trip.sinceLabel}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.panelMuted} />
      </Pressable>

      <View style={styles.panelReading}>
        <Text style={[styles.panelOdo, { color: colors.panelText }]}>
          {trip.startOdoLabel}
        </Text>
        <Text style={[styles.panelOdoUnit, { color: colors.panelMuted }]}>
          km when you left
        </Text>
      </View>

      <Button
        label="End trip"
        onPress={onEnd}
        variant="accent"
        size="lg"
        fullWidth
      />
    </View>
  );
}

/* ─── Fleet ─────────────────────────────────────────────────── */

function VanRow({
  van,
  colors,
  isDark,
  first,
  onPress,
}: {
  van: FleetVan;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  first: boolean;
  onPress: () => void;
}) {
  const out = van.openTrip;
  // "Out with Sam" reads differently when Sam is you — that is the trip you
  // are in the middle of, not a van somebody else has.
  const status = !out
    ? van.homeCity
    : van.isMine
    ? "Out with you"
    : `Out with ${out.holderFirstName}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${van.name}, ${van.rego}. ${status}. ${van.currentOdoLabel} kilometres.`}
      accessibilityHint={
        out && !van.isMine
          ? "Starting a trip closes theirs with the reading you photograph."
          : undefined
      }
      style={({ pressed }) => [
        styles.vanRow,
        !first && styles.vanRowSpacing,
        {
          backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
          borderColor: colors.border,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.vanBadge,
          {
            backgroundColor:
              out && !van.isMine ? colors.surfaceSunk : Brand.accent,
          },
        ]}
      >
        <Ionicons
          name={out && !van.isMine ? "swap-horizontal" : "car-outline"}
          size={20}
          color={out && !van.isMine ? colors.textSecondary : Palette.ink}
        />
      </View>

      <View style={styles.vanBody}>
        <Text
          style={[styles.vanName, { color: colors.text }]}
          numberOfLines={1}
        >
          {van.name}
        </Text>
        <Text
          style={[styles.vanMeta, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {van.rego} · {status}
        </Text>
      </View>

      <View style={styles.vanOdoBlock}>
        <Text style={[styles.vanOdo, { color: colors.text }]}>
          {van.currentOdoLabel}
        </Text>
        <Text style={[styles.vanOdoUnit, { color: colors.textSecondary }]}>
          km
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Recent trips ──────────────────────────────────────────── */

function RecentTrips({
  days,
  recentKmLabel,
  colors,
  isDark,
  onOpenTrip,
  onSeeAll,
}: {
  days: TripDay[];
  recentKmLabel: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onOpenTrip: (tripId: string) => void;
  onSeeAll: () => void;
}) {
  // Capped by trips rather than days: three days of a busy week is an endless
  // scroll on the screen whose job is getting a van out the door.
  const shown: TripDay[] = [];
  let remaining = 5;
  for (const day of days) {
    if (remaining <= 0) break;
    const trips = day.trips.slice(0, remaining);
    remaining -= trips.length;
    shown.push({ ...day, trips });
  }

  return (
    <View style={styles.history}>
      <View style={styles.sectionHead}>
        <Eyebrow color={isDark ? Brand.greenLight : Brand.green}>
          Your driving
        </Eyebrow>
      </View>

      <View style={styles.statLine}>
        <Text style={[styles.statNumber, { color: colors.text }]}>
          {recentKmLabel}
        </Text>
        <Text style={[styles.statCaption, { color: colors.textSecondary }]}>
          in the last 30 days
        </Text>
      </View>

      {shown.length === 0 ? (
        <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
          No trips logged yet. Your first one shows up here.
        </Text>
      ) : (
        shown.map((day) => (
          <View key={day.key} style={styles.day}>
            <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
              {day.label.toUpperCase()}
            </Text>
            {day.trips.map((trip) => (
              <Pressable
                key={trip.id}
                onPress={() => onOpenTrip(trip.id)}
                accessibilityRole="button"
                accessibilityLabel={`${trip.purposeLabel}, ${trip.subtitle}, ${
                  trip.distanceLabel
                }${trip.flagged ? ", flagged for the office" : ""}`}
                style={({ pressed }) => [
                  styles.tripRow,
                  { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <View style={styles.tripBody}>
                  <Text
                    style={[styles.tripTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {trip.purposeLabel}
                  </Text>
                  <Text
                    style={[styles.tripMeta, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {trip.subtitle}
                  </Text>
                </View>
                {trip.flagged ? (
                  <View
                    style={[
                      styles.flagChip,
                      { borderColor: colors.destructive },
                    ]}
                  >
                    <Ionicons
                      name="flag-outline"
                      size={12}
                      color={colors.destructive}
                    />
                    <Text
                      style={[styles.flagText, { color: colors.destructive }]}
                    >
                      Flagged
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.tripKm, { color: colors.text }]}>
                  {trip.distanceLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        ))
      )}

      {days.length > 0 ? (
        <Button
          label="All my trips"
          onPress={onSeeAll}
          variant="ghost"
          size="md"
          icon="arrow-forward"
          style={styles.seeAll}
        />
      ) : null}
    </View>
  );
}

/* ─── Guard ─────────────────────────────────────────────────── */

function NotADriver({
  colors,
  note,
}: {
  colors: (typeof Colors)["light"];
  note: string | null;
}) {
  return (
    <View
      style={[
        styles.container,
        styles.center,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.guard, { color: colors.textSecondary }]}>
        {note ??
          "Driving a van needs an approved driver account. The office sets that up on the portal."}
      </Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  guard: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 24 },
  eyebrow: { marginBottom: 20 },

  hero: { marginBottom: 26 },
  heroLine: { marginBottom: 16 },
  heroText: {
    fontFamily: FontFamily.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroAccent: { fontFamily: FontFamily.displayItalic },
  heroSub: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 340,
  },

  panel: {
    borderRadius: 30,
    padding: 22,
    gap: 18,
    overflow: "hidden",
    marginBottom: 8,
  },
  panelGlow: {
    position: "absolute",
    bottom: -150,
    right: -140,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  panelHeadBody: { flex: 1, gap: 8 },
  panelTitle: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  panelMeta: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  panelReading: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  panelOdo: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  panelOdoUnit: { fontFamily: FontFamily.regular, fontSize: 14 },

  sectionHead: { marginTop: 30, marginBottom: 14 },
  fleet: {},
  vanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 76,
  },
  vanRowSpacing: { marginTop: 10 },
  vanBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  vanBody: { flex: 1, gap: 2 },
  vanName: { fontFamily: FontFamily.semiBold, fontSize: 17 },
  vanMeta: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  vanOdoBlock: { alignItems: "flex-end" },
  vanOdo: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  vanOdoUnit: { fontFamily: FontFamily.regular, fontSize: 11, marginTop: -1 },

  history: {},
  statLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 18,
  },
  statNumber: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  statCaption: { fontFamily: FontFamily.regular, fontSize: 14 },
  day: { marginBottom: 18 },
  dayLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  tripBody: { flex: 1, gap: 2 },
  tripTitle: { fontFamily: FontFamily.semiBold, fontSize: 15.5 },
  tripMeta: { fontFamily: FontFamily.regular, fontSize: 13 },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  flagText: { fontFamily: FontFamily.medium, fontSize: 11 },
  tripKm: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  seeAll: { alignSelf: "flex-start", marginTop: 2 },

  placeholder: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 8,
  },

  footer: { marginTop: 44 },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginBottom: 14,
  },
  footerEyebrow: { alignSelf: "center" },
});
