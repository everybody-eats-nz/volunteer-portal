import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DriveFlowScreen, FlowHeader } from "@/components/van/van-chrome";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { EmptyState, ErrorState } from "@/components/ui/state-view";
import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTripHistory } from "@/hooks/use-van";
import { loadErrorKind } from "@/lib/load-error";

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
  // Only a pull (or a retry) shows the spinner, not "Load more" or a
  // background refetch.
  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = history;
  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const days = history.data?.pages.flatMap((page) => page.days) ?? [];
  const total = history.data?.pages.reduce((sum, page) => sum + page.pageKm, 0) ?? 0;
  // A failed refetch keeps the trips already shown; only a first load that
  // failed gets the error state. There is no single record to be "not found"
  // here, so a 404 reads as a failed load too.
  const failedKind =
    history.isError && !history.data
      ? loadErrorKind(history.error) === "offline"
        ? "offline"
        : "error"
      : null;

  return (
    <DriveFlowScreen testID="van-trip-history">
      <FlowHeader title="Your trips" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={pullToRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
            progressBackgroundColor={colors.card}
          />
        }
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
            <Eyebrow color={colors.textSecondary}>
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
                android_ripple={{ color: colors.border }}
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

        {failedKind ? (
          <ErrorState
            kind={failedKind}
            onRetry={pullToRefresh}
            retrying={refreshing}
            testID="van-trip-history-error"
          />
        ) : null}

        {!history.isLoading && !failedKind && days.length === 0 ? (
          <EmptyState
            icon="car-outline"
            title="No trips yet"
            body="The first van you take out shows up here."
            testID="van-trip-history-empty"
          />
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
  // flexGrow lets an empty or error state centre in the space under the header.
  scroll: { flexGrow: 1, paddingBottom: 32 },
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
  rowTitle: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  rowMeta: { fontFamily: FontFamily.regular, fontSize: 13 },
  rowKm: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  spinner: { marginTop: 24 },
  more: { marginTop: 8 },
});
