import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
} from "react-native";

import { OdometerCapture } from "@/components/van/odometer-capture";
import { DriveFlowScreen, FlowHeader } from "@/components/van/van-chrome";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTrip } from "@/hooks/use-van";
import { queryKeys } from "@/lib/query-keys";
import { endTrip, setTripNotes, type TripDetail } from "@/lib/van";

/**
 * One trip: the screen a driver lands on after starting, comes back to from a
 * reminder, and ends on.
 *
 * Ending is warn, never block. The plausibility rule lives on the server —
 * shared with the office's exception list, so a reading can never warn the
 * driver here and then look clean to the office — and comes back as a sentence
 * the driver can act on. Confirming past it records the trip and flags it; it
 * never refuses. The one refusal is a reading at or below the start, caught in
 * the field and again on the server.
 */

type Phase = "view" | "ending" | "done";

export default function TripScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === "dark";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tripId, started, end } = useLocalSearchParams<{
    tripId: string;
    started?: string;
    end?: string;
  }>();

  const trip = useTrip(tripId);
  const [phase, setPhase] = useState<Phase>(end === "1" ? "ending" : "view");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{
    text: string;
    distanceLabel: string;
    durationLabel: string;
    odo: number;
    photoUrl: string | null;
  } | null>(null);
  const [done, setDone] = useState<{
    distanceLabel: string;
    durationLabel: string | null;
  } | null>(null);

  async function close(
    odo: number,
    photoUrl: string | null,
    acknowledgedWarning: boolean
  ) {
    if (!tripId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await endTrip(tripId, {
        endOdo: odo,
        endOdoPhotoUrl: photoUrl,
        acknowledgedWarning,
      });

      if (result.needsConfirmation) {
        setWarning({
          text: result.warning,
          distanceLabel: result.distanceLabel,
          durationLabel: result.durationLabel,
          odo,
          photoUrl,
        });
        setSubmitting(false);
        return;
      }

      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setWarning(null);
      setDone({
        distanceLabel: result.distanceLabel,
        durationLabel: result.durationLabel,
      });
      setPhase("done");
      await queryClient.invalidateQueries({ queryKey: queryKeys.van.all });
    } catch (err) {
      setWarning(null);
      setError(err instanceof Error ? err.message : "Could not end the trip.");
      setSubmitting(false);
    }
  }

  if (trip.isLoading || !trip.data) {
    return (
      <DriveFlowScreen>
        <FlowHeader title="Trip" onBack={() => router.back()} />
        <View style={styles.centre}>
          {trip.isError ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {trip.error instanceof Error ? trip.error.message : "Trip not found."}
            </Text>
          ) : (
            <ActivityIndicator color={colors.tint} />
          )}
        </View>
      </DriveFlowScreen>
    );
  }

  const data = trip.data;

  /* ── Logged ─────────────────────────────────────────────── */
  if (phase === "done" && done) {
    return (
      <DriveFlowScreen testID="van-trip-logged">
        <View style={styles.centre}>
          <View style={[styles.tick, { backgroundColor: Brand.green }]}>
            <Ionicons name="checkmark" size={34} color={Palette.cream50} />
          </View>
          <View style={styles.doneEyebrow}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              Trip logged
            </Eyebrow>
          </View>
          <Text style={[styles.doneNumber, { color: colors.text }]}>
            {done.distanceLabel}
          </Text>
          <Text style={[styles.doneMeta, { color: colors.textSecondary }]}>
            {data.vehicleName}
            {done.durationLabel ? ` · ${done.durationLabel}` : ""} · {data.purposeLabel}
          </Text>
        </View>
        <View style={styles.doneActions}>
          <Button
            label="Done"
            onPress={() => router.replace("/(tabs)/drive")}
            size="lg"
            fullWidth
          />
          <Button
            label="See the trip"
            onPress={() => {
              setPhase("view");
              setDone(null);
              void trip.refetch();
            }}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </DriveFlowScreen>
    );
  }

  /* ── Ending ─────────────────────────────────────────────── */
  if (phase === "ending" && data.status === "OPEN") {
    return (
      <DriveFlowScreen testID="van-trip-end">
        <FlowHeader
          title={data.vehicleName}
          subtitle={`Out ${data.sinceLabel} · from ${data.startOdoLabel} km`}
          onBack={() => setPhase("view")}
        />
        <OdometerCapture
          label="Reading at the end"
          knownReadingCaption="Started at"
          knownReadingLabel={`${data.startOdoLabel} km`}
          minimum={data.startOdo}
          submitLabel="End trip"
          submitting={submitting}
          onSubmit={(odo, photoUrl) => void close(odo, photoUrl, false)}
          key={data.id}
        />
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <WarningSheet
          warning={warning}
          colors={colors}
          submitting={submitting}
          onDismiss={() => setWarning(null)}
          onConfirm={() => {
            if (!warning) return;
            void close(warning.odo, warning.photoUrl, true);
          }}
        />
      </DriveFlowScreen>
    );
  }

  /* ── Viewing ────────────────────────────────────────────── */
  return (
    <TripDetailView
      trip={data}
      justStarted={started === "1"}
      colors={colors}
      isDark={isDark}
      onEnd={() => setPhase("ending")}
      onBack={() => router.back()}
      onSaved={() => void trip.refetch()}
    />
  );
}

/* ─── The trip, at rest ─────────────────────────────────────── */

function TripDetailView({
  trip,
  justStarted,
  colors,
  isDark,
  onEnd,
  onBack,
  onSaved,
}: {
  trip: TripDetail;
  justStarted: boolean;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onEnd: () => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(trip.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const open = trip.status === "OPEN";

  async function saveNote() {
    setSavingNote(true);
    setNoteSaved(false);
    try {
      await setTripNotes(trip.id, note);
      setNoteSaved(true);
      onSaved();
    } catch {
      // The note is the one part of a trip that can wait. Failing to save it
      // must never look like failing to log the trip.
      setNoteSaved(false);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <DriveFlowScreen testID="van-trip-detail">
      <FlowHeader
        title={trip.vehicleName}
        subtitle={`${trip.vehicleRego} · ${trip.dayLabel}`}
        onBack={onBack}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.detailScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailEyebrow}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              {open
                ? justStarted
                  ? "Trip started"
                  : "On a trip"
                : trip.flagged
                  ? "Logged · flagged for the office"
                  : "Logged"}
            </Eyebrow>
          </View>

          <Text style={[styles.detailNumber, { color: colors.text }]}>
            {open ? `${trip.startOdoLabel} km` : trip.distanceLabel}
          </Text>
          <Text style={[styles.detailCaption, { color: colors.textSecondary }]}>
            {open
              ? `on the dial when you left, ${trip.sinceLabel}`
              : `${trip.startOdoLabel} → ${trip.endOdoLabel} km${
                  trip.durationLabel ? ` · ${trip.durationLabel}` : ""
                }`}
          </Text>

          <View
            style={[
              styles.factCard,
              {
                backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                borderColor: colors.border,
              },
            ]}
          >
            <Fact label="For" value={trip.orgLabel} colors={colors} />
            <Fact label="Doing" value={trip.purposeLabel} colors={colors} />
            <Fact
              label="Started"
              value={`${trip.dayLabel}, ${trip.startedAtLabel}`}
              colors={colors}
            />
            {trip.endedAtLabel ? (
              <Fact label="Ended" value={trip.endedAtLabel} colors={colors} last />
            ) : null}
          </View>

          {trip.flagged && !trip.isMine ? (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              You closed this trip on your way into the van. Its end time is when
              the van went out again, so the office checks it.
            </Text>
          ) : null}

          <Photos trip={trip} colors={colors} isDark={isDark} />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            NOTE FOR THE OFFICE — OPTIONAL
          </Text>
          <TextInput
            value={note}
            onChangeText={(value) => {
              setNote(value);
              setNoteSaved(false);
            }}
            onBlur={() => {
              if (note.trim() !== (trip.notes ?? "").trim()) void saveNote();
            }}
            placeholder="Anything worth knowing — a warning light, a detour"
            placeholderTextColor={colors.textSecondary}
            multiline
            accessibilityLabel="Note for the office"
            style={[
              styles.input,
              {
                backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          {savingNote ? (
            <Text style={[styles.noteState, { color: colors.textSecondary }]}>
              Saving…
            </Text>
          ) : noteSaved ? (
            <Text style={[styles.noteState, { color: colors.textSecondary }]}>
              Note saved
            </Text>
          ) : null}
        </ScrollView>

        {open ? (
          <View style={styles.detailActions}>
            <Button label="End trip" onPress={onEnd} size="lg" fullWidth />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </DriveFlowScreen>
  );
}

function Fact({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)["light"];
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.fact,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.factLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Photos({
  trip,
  colors,
  isDark,
}: {
  trip: TripDetail;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const shots = [
    { key: "start", label: "Start", url: trip.startOdoPhotoUrl },
    { key: "end", label: "End", url: trip.endOdoPhotoUrl },
  ].filter((s) => s.url || trip.status !== "OPEN");

  if (shots.length === 0) return null;

  return (
    <View style={styles.photos}>
      {shots.map((shot) => (
        <View key={shot.key} style={styles.photoCell}>
          <Text style={[styles.factLabel, { color: colors.textSecondary }]}>
            {shot.label}
          </Text>
          {shot.url ? (
            <Image
              source={{ uri: shot.url }}
              style={[styles.photo, { backgroundColor: colors.surfaceSunk }]}
              contentFit="cover"
              accessibilityLabel={`${shot.label} odometer photo`}
            />
          ) : (
            <View
              style={[
                styles.photo,
                styles.photoEmpty,
                {
                  backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.photoEmptyText, { color: colors.textSecondary }]}>
                No photo
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/* ─── The warning ───────────────────────────────────────────── */

function WarningSheet({
  warning,
  colors,
  submitting,
  onDismiss,
  onConfirm,
}: {
  warning: {
    text: string;
    distanceLabel: string;
    durationLabel: string;
  } | null;
  colors: (typeof Colors)["light"];
  submitting: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={Boolean(warning)}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Go back and check the reading"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <View style={styles.sheetGrip} />
        <View style={styles.sheetIcon}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.destructive} />
        </View>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>
          {warning?.distanceLabel} in {warning?.durationLabel}
        </Text>
        <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
          {warning?.text}
        </Text>
        <View style={styles.sheetActions}>
          <Button
            label="Check the reading"
            onPress={onDismiss}
            size="lg"
            fullWidth
            disabled={submitting}
          />
          <Button
            label="It's right — log it"
            onPress={onConfirm}
            variant="ghost"
            size="md"
            fullWidth
            loading={submitting}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },

  tick: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  doneEyebrow: { marginTop: 24 },
  doneNumber: {
    fontFamily: FontFamily.display,
    fontSize: 62,
    lineHeight: 70,
    letterSpacing: -2,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  doneMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    textAlign: "center",
  },
  doneActions: { gap: 10, paddingBottom: 4 },

  detailScroll: { paddingBottom: 28 },
  detailEyebrow: { marginBottom: 10 },
  detailNumber: {
    fontFamily: FontFamily.display,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1.6,
    fontVariant: ["tabular-nums"],
  },
  detailCaption: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 4,
  },

  factCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    marginTop: 24,
  },
  fact: { paddingVertical: 14, gap: 3 },
  factLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  factValue: { fontFamily: FontFamily.regular, fontSize: 15.5, lineHeight: 21 },

  note: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 16,
  },

  photos: { flexDirection: "row", gap: 12, marginTop: 24 },
  photoCell: { flex: 1, gap: 8 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 18 },
  photoEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  photoEmptyText: { fontFamily: FontFamily.regular, fontSize: 13 },

  fieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 26,
    marginBottom: 8,
  },
  input: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: "top",
  },
  noteState: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    marginTop: 8,
  },
  detailActions: { paddingTop: 12 },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,26,17,0.55)" },
  sheet: {
    marginTop: "auto",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    alignItems: "center",
  },
  sheetGrip: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(128,128,128,0.35)",
    marginBottom: 18,
  },
  sheetIcon: { marginBottom: 10 },
  sheetTitle: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  sheetBody: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },
  sheetActions: { alignSelf: "stretch", gap: 10, marginTop: 24 },

  error: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    textAlign: "center",
  },
});
