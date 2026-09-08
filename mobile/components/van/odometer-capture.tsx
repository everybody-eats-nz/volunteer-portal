import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { uploadOdometerPhoto } from "@/lib/van";

/**
 * The odometer. Both ends of a trip come through here.
 *
 * The dial is the point of the whole feature, so it is the whole screen: one
 * large tabular numeral, the photo under it, one button. Nothing else competes.
 *
 * Two rules shape the behaviour:
 *
 * - **The photo never blocks.** It uploads the moment it is taken, in the
 *   background, so the tap that commits the trip has nothing to wait for — and
 *   an upload that fails is reported quietly and the reading still counts. A
 *   driver stopped in a loading bay by an upload error goes back to the paper
 *   book, so nothing here can strand one.
 * - **One hard stop.** A reading at or below where the trip started cannot be
 *   what the dial says, and the driver is looking at both numbers, so it is
 *   refused here and again on the server. Every other doubt is a warning that
 *   comes back from the server, never a refusal.
 */

export type OdometerCaptureProps = {
  /** "Odometer now" / "Reading at the end". */
  label: string;
  /** The last number we know about, shown as a sanity anchor. */
  knownReadingLabel: string;
  knownReadingCaption: string;
  /** Nothing at or below this is accepted. Ending a trip passes its start. */
  minimum?: number | null;
  submitLabel: string;
  submitting?: boolean;
  /**
   * What the driver already gave us, when they are stepping back into this
   * screen. Losing a photo they have already taken to a Back tap is not
   * something a driver standing at a van should have to plan around.
   */
  initialOdo?: number | null;
  initialPhotoUri?: string | null;
  initialPhotoUrl?: string | null;
  onSubmit: (odo: number, photoUrl: string | null, photoUri: string | null) => void;
};

export function OdometerCapture({
  label,
  knownReadingLabel,
  knownReadingCaption,
  minimum = null,
  submitLabel,
  submitting = false,
  initialOdo = null,
  initialPhotoUri = null,
  initialPhotoUrl = null,
  onSubmit,
}: OdometerCaptureProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === "dark";

  const [text, setText] = useState(initialOdo === null ? "" : String(initialOdo));
  const [photoUri, setPhotoUri] = useState<string | null>(initialPhotoUri);
  const [photoState, setPhotoState] = useState<
    "none" | "uploading" | "stored" | "failed"
  >(initialPhotoUrl ? "stored" : initialPhotoUri ? "failed" : "none");
  /** Held in a ref, not state: the submit tap reads it, nothing renders it. */
  const photoUrl = useRef<string | null>(initialPhotoUrl);
  /** Which shot is current, so a slow first upload cannot clobber a retake. */
  const shot = useRef(0);
  /** Measured from the mirror below, so "km" sits beside the number. */
  const [fieldWidth, setFieldWidth] = useState(0);

  const digits = text.replace(/[^0-9]/g, "");
  const odo = digits.length > 0 ? Number(digits) : null;
  const belowStart = odo !== null && minimum !== null && odo <= minimum;
  const canSubmit = odo !== null && !belowStart && !submitting;

  /*
   * Android is edge-to-edge from Expo SDK 55, so the window no longer resizes
   * for the keyboard and the iOS-only KeyboardAvoidingView padding never runs
   * there. The number pad opens on this screen automatically, and the button
   * under it is the one that commits the trip — so grow the action row's
   * bottom padding with the live IME inset rather than letting the keyboard
   * bury it.
   */
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  const lift = useAnimatedStyle(() => ({
    paddingBottom:
      Platform.OS === "android"
        ? Math.max(keyboard.height.value - insets.bottom, 0)
        : 0,
  }));

  const takePhoto = useCallback(async () => {
    // The camera, not the library: an odometer photo is evidence behind a
    // funding report, and it is taken at the dial.
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera access needed",
        "Enable camera access for Everybody Eats in Settings to photograph the odometer. You can still record the reading without a photo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const attempt = ++shot.current;
    setPhotoUri(asset.uri);
    setPhotoState("uploading");
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Deliberately not awaited by the submit path. By the time the driver has
    // typed the number this has usually finished; if it has not, or if it
    // fails outright, the trip records without it.
    const url = await uploadOdometerPhoto(asset);
    // A retake started while this was in flight owns the reading now.
    if (attempt !== shot.current) return;
    photoUrl.current = url;
    setPhotoState(url ? "stored" : "failed");
  }, []);

  const submit = () => {
    if (!canSubmit || odo === null) return;
    onSubmit(odo, photoUrl.current, photoUri);
  };

  const fieldTint = belowStart ? colors.destructive : colors.text;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={styles.readingBlock}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label.toUpperCase()}
        </Text>
        <View style={styles.fieldRow}>
          {/*
            A mirror of the value, measured but never seen, so the field is
            exactly as wide as the number in it — otherwise a flexed input
            strands "km" against the far edge of the screen, away from the
            figure it belongs to. It sits directly in the full-width row rather
            than inside the field's own wrapper: measuring it against a box
            whose width it is being used to decide is a loop, and the loop
            settles too narrow, clipping the leading digits.
          */}
          <Text
            style={[styles.field, styles.fieldMirror]}
            onLayout={(event) => setFieldWidth(event.nativeEvent.layout.width)}
            numberOfLines={1}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {text || "0"}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            autoFocus
            maxLength={7}
            placeholder="0"
            placeholderTextColor={
              isDark ? "rgba(229,240,232,0.25)" : "rgba(14,42,28,0.22)"
            }
            selectionColor={colors.tint}
            accessibilityLabel={label}
            style={[
              styles.field,
              { color: fieldTint, width: Math.max(fieldWidth + 3, 30) },
            ]}
          />
          <Text style={[styles.unit, { color: colors.textSecondary }]}>km</Text>
        </View>

        {belowStart ? (
          <Text style={[styles.hint, { color: colors.destructive }]}>
            Has to be more than {minimum?.toLocaleString("en-NZ")} km, the reading
            this trip started with.
          </Text>
        ) : (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {knownReadingCaption} {knownReadingLabel}
          </Text>
        )}
      </View>

      <PhotoWell
        uri={photoUri}
        state={photoState}
        onPress={takePhoto}
        colors={colors}
        isDark={isDark}
      />

      <Animated.View style={[styles.actions, lift]}>
        <Button
          label={submitLabel}
          onPress={submit}
          size="lg"
          fullWidth
          disabled={!canSubmit}
          loading={submitting}
          icon="arrow-forward"
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function PhotoWell({
  uri,
  state,
  onPress,
  colors,
  isDark,
}: {
  uri: string | null;
  state: "none" | "uploading" | "stored" | "failed";
  onPress: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const caption =
    state === "uploading"
      ? "Saving the photo…"
      : state === "stored"
        ? "Photo saved with the reading"
        : state === "failed"
          ? "Photo didn't save — the reading still counts"
          : "Photograph the dial so the number is auditable";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        uri ? "Retake the odometer photo" : "Photograph the odometer"
      }
      accessibilityHint="Optional. The reading is recorded either way."
      style={({ pressed }) => [
        styles.photoWell,
        {
          backgroundColor: isDark ? colors.surfaceSoft : Palette.cream100,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.photoThumb,
          { backgroundColor: isDark ? colors.surfaceSunk : Palette.cream200 },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
        ) : (
          <Ionicons name="camera" size={22} color={colors.tint} />
        )}
        {state === "uploading" && (
          <View style={styles.photoSpinner}>
            <ActivityIndicator size="small" color={Palette.cream50} />
          </View>
        )}
      </View>

      <View style={styles.photoBody}>
        <Text style={[styles.photoTitle, { color: colors.text }]}>
          {uri ? "Retake photo" : "Add odometer photo"}
        </Text>
        <Text
          style={[
            styles.photoCaption,
            { color: state === "failed" ? colors.destructive : colors.textSecondary },
          ]}
          numberOfLines={2}
        >
          {caption}
        </Text>
      </View>

      {state === "stored" && (
        <Ionicons name="checkmark-circle" size={20} color={Brand.green} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 22 },
  readingBlock: { gap: 6 },
  fieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 2,
  },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  fieldMirror: { position: "absolute", left: 0, bottom: 0, opacity: 0 },
  field: {
    fontFamily: FontFamily.display,
    fontSize: 60,
    lineHeight: 70,
    letterSpacing: -1.5,
    padding: 0,
    // Tabular figures: the number must not shuffle sideways as digits land.
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontFamily: FontFamily.medium,
    fontSize: 18,
    paddingBottom: 14,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  photoWell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 76,
  },
  photoThumb: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  photoSpinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,42,28,0.45)",
  },
  photoBody: { flex: 1, gap: 2 },
  photoTitle: { fontFamily: FontFamily.semiBold, fontSize: 15.5 },
  photoCaption: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: "auto" },
});
