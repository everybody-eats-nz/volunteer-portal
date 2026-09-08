import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDriveHome, useDriverState, useVan } from "@/hooks/use-van";
import { API_URL } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { startTrip, type StartOptions, type VanPurpose } from "@/lib/van";

/**
 * Starting a trip. Four or five taps, under twenty seconds.
 *
 * The QR sticker or the fleet row already chose the van and the session
 * already knows the driver, so identity is off the critical path. The photo
 * and the reading come first because they are the record; picking the purpose
 * *is* the submit, with no separate confirm step; and the optional note lives
 * on the trip afterwards rather than in the way of getting the van moving.
 *
 * A van that is already out is a handover, not an error. The reading typed
 * here closes the open trip and opens this one — one observed number, never a
 * stamped one.
 */

type Step = "odo" | "org" | "purpose" | "external";

const STEP_INDEX: Record<Step, number> = { odo: 1, org: 2, purpose: 3, external: 3 };

export default function StartTripScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === "dark";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { vanId } = useLocalSearchParams<{ vanId: string }>();

  const driver = useDriverState();
  const approved = driver.data?.canDrive !== false;
  const home = useDriveHome(approved);
  const van = useVan(approved ? vanId : undefined);

  // The tab already holds the fleet and the pick-lists, so a tap from there
  // paints instantly and the fetch below only confirms it. A cold start from
  // the QR sticker's universal link has neither and waits once.
  const seed = home.data?.fleet.find((v) => v.id === vanId) ?? null;
  const options: StartOptions | null = van.data?.options ?? home.data?.options ?? null;
  const vehicle = van.data?.vehicle ?? seed;
  const openTrip = van.data?.openTrip ?? null;

  const [step, setStep] = useState<Step>("odo");
  const [odo, setOdo] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  /** Kept so stepping back to the dial still shows the shot already taken. */
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [externalUse, setExternalUse] = useState("");
  const [noteFor, setNoteFor] = useState<VanPurpose | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { internal, external, catchAll } = useMemo(() => {
    const orgs = options?.organisations ?? [];
    return {
      internal: orgs.filter((o) => o.isInternal),
      external: orgs.filter((o) => !o.isInternal && !o.isCatchAll),
      catchAll: orgs.find((o) => o.isCatchAll) ?? null,
    };
  }, [options]);

  const [organisationId, setOrganisationId] = useState<string | null>(null);

  async function commit(input: {
    organisationId: string;
    externalOrgName: string | null;
    purposeId: string | null;
    purposeOther: string | null;
  }) {
    if (odo === null || submitting || !vanId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { tripId } = await startTrip({
        vehicleId: vanId,
        startOdo: odo,
        startOdoPhotoUrl: photoUrl,
        ...input,
      });
      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.van.all });
      router.replace({
        pathname: "/van/trip/[tripId]",
        params: { tripId, started: "1" },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start the trip."
      );
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    if (step === "odo") router.back();
    else if (step === "org") setStep("odo");
    else setStep("org");
  }

  /*
   * The QR sticker's URL is claimed as a universal link, so scanning it opens
   * the app for anyone who happens to have it installed — including an outside
   * borrower or a driver the office has not approved yet. The web page behind
   * that sticker works for all of them, so hand it back rather than showing a
   * screen that cannot help.
   */
  if (driver.data && !driver.data.canDrive) {
    return (
      <DriveFlowScreen testID="van-start-not-approved">
        <FlowHeader title="Van log" onBack={() => router.back()} />
        <View style={styles.centre}>
          <Text style={[styles.question, styles.centred, { color: colors.text }]}>
            This van&apos;s page lives on the web
          </Text>
          <Text style={[styles.blurb, { color: colors.textSecondary }]}>
            {driver.data.statusNote ??
              "Logging a trip in the app needs an approved driver account. The page the sticker points at works for everyone."}
          </Text>
          <Button
            label="Open the van's page"
            onPress={() =>
              openBrowserAsync(`${API_URL}/v/${vanId}`, {
                presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
              })
            }
            size="lg"
            fullWidth
            style={styles.bounceAction}
          />
        </View>
      </DriveFlowScreen>
    );
  }

  if (!vehicle || !options) {
    return (
      <DriveFlowScreen>
        <FlowHeader title="Van log" onBack={() => router.back()} />
        <View style={styles.centre}>
          {van.isError ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {van.error instanceof Error
                ? van.error.message
                : "That van is not in the list."}
            </Text>
          ) : (
            <ActivityIndicator color={colors.tint} />
          )}
        </View>
      </DriveFlowScreen>
    );
  }

  const header = (
    <FlowHeader
      title={vehicle.name}
      subtitle={`${vehicle.rego} · from ${vehicle.currentOdoLabel} km`}
      onBack={back}
      step={STEP_INDEX[step]}
      stepCount={3}
    />
  );

  /* ── Step 1: the dial ───────────────────────────────────── */
  if (step === "odo") {
    const handover = openTrip && !openTrip.isMine ? openTrip : null;
    return (
      <DriveFlowScreen testID="van-start-odo">
        {header}
        {handover ? (
          <View
            style={[
              styles.handover,
              {
                backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.tint} />
            <Text style={[styles.handoverText, { color: colors.textSecondary }]}>
              {handover.holderFirstName} has had this van out {handover.sinceLabel}.
              The reading you photograph closes their trip and opens yours.
            </Text>
          </View>
        ) : null}
        <OdometerCapture
          label="Odometer now"
          knownReadingCaption="Last recorded"
          knownReadingLabel={`${vehicle.currentOdoLabel} km`}
          submitLabel="Next"
          initialOdo={odo}
          initialPhotoUri={photoUri}
          initialPhotoUrl={photoUrl}
          onSubmit={(value, url, uri) => {
            setOdo(value);
            setPhotoUrl(url);
            setPhotoUri(uri);
            setStep("org");
          }}
        />
      </DriveFlowScreen>
    );
  }

  /* ── Step 2: who it is for ──────────────────────────────── */
  if (step === "org") {
    return (
      <DriveFlowScreen testID="van-start-org">
        {header}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.question, { color: colors.text }]}>
            Who is the van out for?
          </Text>

          {options.shortcut ? (
            <ChoiceRow
              label="Same as last time"
              caption={`${options.shortcut.organisationName} · ${options.shortcut.purposeLabel}`}
              icon="repeat"
              emphasis
              colors={colors}
              isDark={isDark}
              onPress={() =>
                commit({
                  organisationId: options.shortcut!.organisationId,
                  externalOrgName: null,
                  purposeId: options.shortcut!.purposeId,
                  purposeOther: null,
                })
              }
            />
          ) : null}

          {internal.map((org) => (
            <ChoiceRow
              key={org.id}
              label={org.name}
              colors={colors}
              isDark={isDark}
              onPress={() => {
                setOrganisationId(org.id);
                setStep("purpose");
              }}
            />
          ))}

          {external.length > 0 || catchAll ? (
            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
              BORROWED
            </Text>
          ) : null}

          {external.map((org) => (
            <ChoiceRow
              key={org.id}
              label={org.name}
              colors={colors}
              isDark={isDark}
              onPress={() => {
                setOrganisationId(org.id);
                setStep("external");
              }}
            />
          ))}

          {catchAll ? (
            <ChoiceRow
              label="Someone else"
              caption="Name them on the next screen"
              colors={colors}
              isDark={isDark}
              onPress={() => {
                setOrganisationId(catchAll.id);
                setStep("external");
              }}
            />
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </ScrollView>
      </DriveFlowScreen>
    );
  }

  /* ── Step 3a: what it is doing (internal) ───────────────── */
  if (step === "purpose") {
    if (noteFor) {
      return (
        <DriveFlowScreen testID="van-start-purpose-note">
          {header}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.formBody}
          >
            <Text style={[styles.question, { color: colors.text }]}>
              {noteFor.label} — what is it?
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="A few words is plenty"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              multiline
              accessibilityLabel={`What the ${noteFor.label} trip is for`}
              style={[
                styles.input,
                styles.inputTall,
                {
                  backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <View style={styles.formActions}>
              <Button
                label="Start trip"
                onPress={() =>
                  commit({
                    organisationId: organisationId!,
                    externalOrgName: null,
                    purposeId: noteFor.id,
                    purposeOther: noteText.trim() || null,
                  })
                }
                size="lg"
                fullWidth
                loading={submitting}
                disabled={noteText.trim().length < 3}
              />
            </View>
          </KeyboardAvoidingView>
        </DriveFlowScreen>
      );
    }

    return (
      <DriveFlowScreen testID="van-start-purpose">
        {header}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.question, { color: colors.text }]}>
            What is it doing?
          </Text>
          {/* The order is the office's, not ours: whatever sits first is a
              one-tap trip, and admins reorder that on the portal. */}
          {options.purposes.map((purpose) => (
            <ChoiceRow
              key={purpose.id}
              label={purpose.label}
              caption={purpose.requiresNote ? "Asks for a few words" : undefined}
              colors={colors}
              isDark={isDark}
              busy={submitting}
              onPress={() => {
                if (purpose.requiresNote) {
                  setNoteFor(purpose);
                  return;
                }
                commit({
                  organisationId: organisationId!,
                  externalOrgName: null,
                  purposeId: purpose.id,
                  purposeOther: null,
                });
              }}
            />
          ))}
          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </ScrollView>
      </DriveFlowScreen>
    );
  }

  /* ── Step 3b: a borrowed van ────────────────────────────── */
  const isCatchAll = organisationId === catchAll?.id;
  const canSubmitExternal =
    externalUse.trim().length >= 3 &&
    (!isCatchAll || externalName.trim().length >= 2);

  return (
    <DriveFlowScreen testID="van-start-external">
      {header}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.formBody}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.question, { color: colors.text }]}>
            {isCatchAll ? "Who has it, and what for?" : "What is it doing?"}
          </Text>

          {isCatchAll ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                BORROWER
              </Text>
              <TextInput
                value={externalName}
                onChangeText={setExternalName}
                placeholder="Their organisation or name"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                accessibilityLabel="Who is borrowing the van"
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            </>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            WHAT FOR
          </Text>
          <TextInput
            value={externalUse}
            onChangeText={setExternalUse}
            placeholder="A few words is plenty"
            placeholderTextColor={colors.textSecondary}
            autoFocus={!isCatchAll}
            multiline
            accessibilityLabel="What the van is being used for"
            style={[
              styles.input,
              styles.inputTall,
              {
                backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </ScrollView>

        <View style={styles.formActions}>
          <Button
            label="Start trip"
            onPress={() =>
              commit({
                organisationId: organisationId!,
                externalOrgName: isCatchAll ? externalName.trim() : null,
                purposeId: null,
                purposeOther: externalUse.trim(),
              })
            }
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmitExternal}
          />
        </View>
      </KeyboardAvoidingView>
    </DriveFlowScreen>
  );
}

/* ─── One choice, one tap ───────────────────────────────────── */

function ChoiceRow({
  label,
  caption,
  icon,
  emphasis = false,
  busy = false,
  colors,
  isDark,
  onPress,
}: {
  label: string;
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emphasis?: boolean;
  busy?: boolean;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (busy) return;
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: emphasis
            ? Brand.accent
            : isDark
              ? colors.surfaceSoft
              : Palette.cream100,
          borderColor: emphasis ? "transparent" : colors.border,
          opacity: busy ? 0.5 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={emphasis ? Palette.ink : colors.tint} />
      ) : null}
      <View style={styles.choiceBody}>
        <Text
          style={[
            styles.choiceLabel,
            { color: emphasis ? Palette.ink : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {caption ? (
          <Text
            style={[
              styles.choiceCaption,
              {
                color: emphasis ? "rgba(26,20,16,0.7)" : colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={emphasis ? Palette.ink : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  centred: { textAlign: "center" },
  blurb: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 4,
  },
  bounceAction: { marginTop: 28, alignSelf: "stretch" },
  listContent: { paddingBottom: 32, gap: 10 },
  question: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  groupLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 14,
    marginBottom: 2,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 64,
  },
  choiceBody: { flex: 1, gap: 2 },
  choiceLabel: { fontFamily: FontFamily.semiBold, fontSize: 17 },
  choiceCaption: { fontFamily: FontFamily.regular, fontSize: 13 },

  handover: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 22,
  },
  handoverText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },

  formBody: { flex: 1 },
  formScroll: { paddingBottom: 24 },
  fieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    minHeight: 52,
  },
  inputTall: { minHeight: 104, textAlignVertical: "top" },
  formActions: { marginTop: "auto", paddingTop: 12 },

  error: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
    textAlign: "center",
  },
});
