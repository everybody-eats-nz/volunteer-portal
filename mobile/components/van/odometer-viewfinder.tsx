import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { FontFamily, Palette } from "@/constants/theme";
import {
  guideInImage,
  readOdometer,
  settledReading,
  type Box,
} from "@/lib/odometer-reading";
import { pickPictureSize } from "@/lib/picture-size";

import { readText } from "./load-odometer-reader";

/**
 * The live camera the odometer screen opens on.
 *
 * The photo is the first thing a driver does at the van, so the screen lands
 * with the camera already running and one tap on the shutter takes it — no
 * button to open a camera, no system "Use Photo" confirm after it.
 *
 * It also reads the dial. While the camera is up it glances at the scene
 * every few hundred milliseconds — a low-cost still, handed to the on-device
 * text recogniser — and looks for the number in the guide. Two glances in a
 * row that agree is a reading, the way a barcode scanner settles, and at that
 * point the glance *is* the photo: it is kept, handed over with the number,
 * and the driver is on the next screen without having touched the shutter.
 * The shutter stays for a dial the reader cannot make out; that shot is read
 * too, so the number is filled in either way when it can be.
 *
 * This is the only file that imports expo-camera. Never import it directly:
 * go through `load-viewfinder.ts`, which only loads it when the native module
 * is in the binary, so older installs taking an over-the-air update keep the
 * system-camera flow instead of crashing on import.
 */

export type CapturedPhoto = {
  uri: string;
  mimeType: string;
  fileName: string;
  /** What the dial read as, when the reader could make it out. */
  reading: number | null;
};

/** Let the exposure settle before the first glance, then keep glancing. */
const FIRST_GLANCE_DELAY = 600;
const GLANCE_GAP = 250;
/** Long enough to see the number land before the screen moves on. */
const LOCK_DWELL = 450;

export function OdometerViewfinder({
  onCapture,
  onUnavailable,
  style,
  minimum = null,
  expected = null,
}: {
  onCapture: (photo: CapturedPhoto) => void;
  /**
   * No camera to show: access was refused, or it would not start. Either way
   * the reading can still be typed without a photo.
   */
  onUnavailable: (reason: "denied" | "failed") => void;
  style?: StyleProp<ViewStyle>;
  /** Nothing at or below this can be the dial. Ending a trip passes its start. */
  minimum?: number | null;
  /** The last reading we recorded, so the dial can be told from the trip meter. */
  expected?: number | null;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  /** Ask once per visit. Android can report a refusal as askable again. */
  const asked = useRef(false);
  const camera = useRef<CameraView>(null);
  const sized = useRef(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();

  /** What the reader made of the latest glance, and the number it settled on. */
  const [seen, setSeen] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const recent = useRef<(number | null)[]>([]);
  /** The glance in flight, so the shutter waits for it rather than colliding. */
  const inFlight = useRef<Promise<void> | null>(null);
  /**
   * Glancing is over: the shutter has been tapped, or a reading has settled.
   * A ref rather than state so a glance already in flight sees it at once and
   * drops its frame, instead of waiting for a render to switch the loop off.
   */
  const halted = useRef(false);
  const mounted = useRef(true);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Layout the async loop reads, kept in refs so a glance never sees a stale one. */
  const frameBox = useRef<{ width: number; height: number } | null>(null);
  const guideBox = useRef<Box | null>(null);
  const hints = useRef({ minimum, expected });
  hints.current = { minimum, expected };
  const capture = useRef(onCapture);
  capture.current = onCapture;

  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (handoff.current) clearTimeout(handoff.current);
    };
  }, []);

  useEffect(() => {
    if (!permission || permission.granted) return;
    if (permission.canAskAgain && !asked.current) {
      asked.current = true;
      void requestPermission();
      return;
    }
    onUnavailable("denied");
  }, [permission, requestPermission, onUnavailable]);

  async function handleReady() {
    setReady(true);
    if (sized.current) return;
    sized.current = true;
    try {
      const sizes = await camera.current?.getAvailablePictureSizesAsync();
      setPictureSize(pickPictureSize(sizes ?? []));
    } catch {
      // The default size still works; it is only larger than it needs to be.
    }
  }

  const readingIn = useCallback(
    async (uri: string, image: { width: number; height: number }) => {
      if (!readText) return null;
      try {
        const result = await readText(uri);
        const guide =
          guideBox.current && frameBox.current
            ? guideInImage(guideBox.current, frameBox.current, image)
            : null;
        return readOdometer(result, { guide, ...hints.current })?.value ?? null;
      } catch {
        // A frame the reader chokes on is a frame with no number in it.
        return null;
      }
    },
    []
  );

  const glance = useCallback(async () => {
    const view = camera.current;
    if (!view) return;
    let shot: Awaited<ReturnType<CameraView["takePictureAsync"]>>;
    try {
      shot = await view.takePictureAsync({ quality: 0.5, shutterSound: false, exif: false });
    } catch {
      return;
    }
    if (!mounted.current || halted.current) {
      discard(shot.uri);
      return;
    }

    const value = await readingIn(shot.uri, shot);
    if (!mounted.current || halted.current) {
      discard(shot.uri);
      return;
    }

    recent.current = [...recent.current.slice(-2), value];
    setSeen(value);
    const settled = settledReading(recent.current);
    if (settled === null) {
      discard(shot.uri);
      return;
    }

    halted.current = true;
    setLocked(settled);
    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handoff.current = setTimeout(() => {
      capture.current({
        uri: shot.uri,
        mimeType: shot.format === "png" ? "image/png" : "image/jpeg",
        fileName: `odometer.${shot.format ?? "jpg"}`,
        reading: settled,
      });
    }, LOCK_DWELL);
  }, [readingIn]);

  // `failed` is a dependency so a shutter tap that did not take, which halted
  // the glances, starts them again rather than leaving a camera that no longer
  // reads.
  useEffect(() => {
    if (!ready || !readText || locked !== null) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive || halted.current) return;
      inFlight.current = glance();
      await inFlight.current;
      inFlight.current = null;
      if (alive && !halted.current) timer = setTimeout(() => void tick(), GLANCE_GAP);
    };
    timer = setTimeout(() => void tick(), FIRST_GLANCE_DELAY);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, locked, failed, glance]);

  async function snap() {
    if (!ready || capturing || locked !== null || !camera.current) return;
    setCapturing(true);
    setFailed(false);
    halted.current = true;
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    flash.value = withSequence(
      withTiming(0.85, { duration: 40 }),
      withTiming(0, { duration: 260 })
    );
    try {
      if (inFlight.current) await inFlight.current;
      const photo = await camera.current.takePictureAsync({ quality: 0.7 });
      const reading = await readingIn(photo.uri, photo);
      if (!mounted.current) return;
      onCapture({
        uri: photo.uri,
        mimeType: photo.format === "png" ? "image/png" : "image/jpeg",
        fileName: `odometer.${photo.format ?? "jpg"}`,
        // The last glance was at the same dial a moment ago: if this shot
        // will not read, that is still the best number we have.
        reading: reading ?? seen,
      });
    } catch {
      setFailed(true);
      setCapturing(false);
      halted.current = false;
    }
  }

  const granted = permission?.granted === true;
  const reading = locked ?? seen;
  const caption = failed
    ? "That didn't take. Try again."
    : locked !== null
      ? "Got it"
      : seen !== null
        ? "Hold still…"
        : readText
          ? "Point at the dial and hold still"
          : "Fill the frame with the dial";
  const cornerTint = reading !== null ? Palette.sun200 : Palette.cream50;

  return (
    <View
      style={[styles.frame, style]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        frameBox.current = { width, height };
      }}
    >
      {granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
          pictureSize={pictureSize}
          onCameraReady={() => void handleReady()}
          onMountError={() => onUnavailable("failed")}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={Palette.cream50} />
        </View>
      ) : null}

      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      <LinearGradient
        colors={["rgba(9,26,17,0.62)", "rgba(9,26,17,0)"]}
        style={styles.scrimTop}
        pointerEvents="none"
      />
      <Text style={styles.caption} pointerEvents="none">
        {caption}
      </Text>

      <View
        style={styles.guide}
        pointerEvents="none"
        onLayout={(event: LayoutChangeEvent) => {
          guideBox.current = event.nativeEvent.layout;
        }}
      >
        <View style={[styles.corner, styles.cornerTL, { borderColor: cornerTint }]} />
        <View style={[styles.corner, styles.cornerTR, { borderColor: cornerTint }]} />
        <View style={[styles.corner, styles.cornerBL, { borderColor: cornerTint }]} />
        <View style={[styles.corner, styles.cornerBR, { borderColor: cornerTint }]} />

        {reading !== null ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            style={[styles.readout, locked !== null && styles.readoutLocked]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Reads ${reading.toLocaleString("en-NZ")} kilometres${
              locked !== null ? ", got it" : ""
            }`}
            testID="odometer-readout"
          >
            {locked !== null ? (
              <Ionicons name="checkmark-circle" size={18} color={Palette.ink} />
            ) : null}
            <Text
              style={[styles.readoutText, locked !== null && styles.readoutTextLocked]}
              numberOfLines={1}
            >
              {reading.toLocaleString("en-NZ")}
              <Text style={styles.readoutUnit}> km</Text>
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <LinearGradient
        colors={["rgba(9,26,17,0)", "rgba(9,26,17,0.7)"]}
        style={styles.scrimBottom}
        pointerEvents="none"
      />
      <Pressable
        onPress={() => void snap()}
        disabled={!ready || capturing || locked !== null}
        accessibilityRole="button"
        accessibilityLabel="Take the odometer photo"
        accessibilityState={{ disabled: !ready || locked !== null, busy: capturing }}
        hitSlop={8}
        style={[styles.shutter, { opacity: ready && locked === null ? 1 : 0.5 }]}
        testID="odometer-shutter"
      >
        {({ pressed }) => (
          <View
            style={[
              styles.shutterDisc,
              { transform: [{ scale: pressed || capturing ? 0.88 : 1 }] },
            ]}
          >
            {capturing ? <ActivityIndicator color={Palette.forest700} /> : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

/** A glance that did not become the photo is not kept around. */
function discard(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // The cache directory is the OS's to clear; a leftover there costs nothing.
  }
}

const CORNER = 26;
const CORNER_STROKE = 3;

const styles = StyleSheet.create({
  frame: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: Palette.forest800,
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: Palette.cream50 },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: 96 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 150 },
  caption: {
    position: "absolute",
    top: 18,
    left: 20,
    right: 20,
    textAlign: "center",
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Palette.cream50,
  },
  /* Where the digits go: wide and shallow, like the odometer window itself. */
  guide: { width: "78%", aspectRatio: 2.4, marginBottom: 56 },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
    borderBottomRightRadius: 10,
  },
  /* The number the reader sees, hung under the guide like a caption. */
  readout: {
    position: "absolute",
    top: "100%",
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(9,26,17,0.74)",
  },
  readoutLocked: { backgroundColor: Palette.sun200 },
  readoutText: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: Palette.cream50,
    fontVariant: ["tabular-nums"],
  },
  readoutTextLocked: { color: Palette.ink },
  readoutUnit: { fontFamily: FontFamily.medium, fontSize: 14, letterSpacing: 0 },
  shutter: {
    position: "absolute",
    bottom: 22,
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: Palette.cream50,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.cream50,
    alignItems: "center",
    justifyContent: "center",
  },
});
