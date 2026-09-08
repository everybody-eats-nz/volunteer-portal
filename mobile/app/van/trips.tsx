import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DriveFlowScreen, FlowHeader } from "@/components/van/van-chrome";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTripHistory } from "@/hooks/use-van";

/**
 * The driver's own trip history.
 *
 * Grouped by NZ day on the server, so a phone whose clock is set overseas
 * cannot file a Wellington trip under the wrong date. Only ever this driver's
 * trips — the fleet-wide view is the office's and lives on the portal.
 */
export default function TripHistoryScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const history = useTripHistory();

  const days = history.data?.pages.flatMap((page) => page.days) ?? [];
  const total = history.data?.pages.reduce((sum, page) => sum + page.pageKm, 0) ?? 0;

  return (
    <DriveFlowScreen testID="van-trip-history">
      <FlowHeader title="Your trips" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {days.length > 0 ? (
          <View style={styles.total}>
            <Text style={[styles.totalNumber, { color: colors.text }]}>
              {total.toLocaleString("en-NZ")} km
            </Text>
            <Text style={[styles.totalCaption, { color: colors.textSecondary }]}>
              across {days.reduce((n, d) => n + d.trips.length, 0)} trips
            </Text>
          </View>
        ) : null}

        {days.map((day) => (
          <View key={day.key} style={styles.day}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              {day.label}
            </Eyebrow>
            {day.trips.map((trip) => (
              <Pressable
                key={trip.id}
                onPress={() =>
                  router.push({
                    pathname: "/van/trip/[tripId]",
                    params: { tripId: trip.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${trip.purposeLabel}, ${trip.subtitle}, ${trip.distanceLabel}`}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <View style={styles.rowBody}>
                  <Text
                    style={[styles.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {trip.purposeLabel}
                  </Text>
                  <Text
                    style={[styles.rowMeta, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {trip.subtitle}
                    {trip.durationLabel ? ` · ${trip.durationLabel}` : ""}
                  </Text>
                </View>
                <Text style={[styles.rowKm, { color: colors.text }]}>
                  {trip.distanceLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        {history.isLoading ? (
          <ActivityIndicator color={colors.tint} style={styles.spinner} />
        ) : null}

        {!history.isLoading && days.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            No trips logged yet. The first van you take out shows up here.
          </Text>
        ) : null}

        {history.hasNextPage ? (
          <Button
            label="Load more"
            onPress={() => void history.fetchNextPage()}
            variant="ghost"
            size="md"
            fullWidth
            loading={history.isFetchingNextPage}
            style={styles.more}
          />
        ) : null}
      </ScrollView>
    </DriveFlowScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  total: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 26 },
  totalNumber: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
  },
  totalCaption: { fontFamily: FontFamily.regular, fontSize: 14 },
  day: { marginBottom: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    marginTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: FontFamily.semiBold, fontSize: 15.5 },
  rowMeta: { fontFamily: FontFamily.regular, fontSize: 13 },
  rowKm: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  spinner: { marginTop: 24 },
  empty: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 20,
  },
  more: { marginTop: 8 },
});
