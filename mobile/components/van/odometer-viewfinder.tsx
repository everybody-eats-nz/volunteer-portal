import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { FontFamily, Palette } from "@/constants/theme";
import { pickPictureSize } from "@/lib/picture-size";

/**
 * The live camera the odometer screen opens on.
 *
 * The photo is the first thing a driver does at the van, so the screen lands
 * with the camera already running and one tap on the shutter takes it — no
 * button to open a camera, no system "Use Photo" confirm after it.
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
};

export function OdometerViewfinder({
  onCapture,
  onUnavailable,
  style,
}: {
  onCapture: (photo: CapturedPhoto) => void;
  /**
   * No camera to show: access was refused, or it would not start. Either way
   * the reading can still be typed without a photo.
   */
  onUnavailable: (reason: "denied" | "failed") => void;
  style?: StyleProp<ViewStyle>;
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

  async function snap() {
    if (!ready || capturing || !camera.current) return;
    setCapturing(true);
    setFailed(false);
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7 });
      onCapture({
        uri: photo.uri,
        mimeType: photo.format === "png" ? "image/png" : "image/jpeg",
        fileName: `odometer.${photo.format ?? "jpg"}`,
      });
    } catch {
      setFailed(true);
      setCapturing(false);
    }
  }

  const granted = permission?.granted === true;

  return (
    <View style={[styles.frame, style]}>
      {granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter
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

      <LinearGradient
        colors={["rgba(9,26,17,0.62)", "rgba(9,26,17,0)"]}
        style={styles.scrimTop}
        pointerEvents="none"
      />
      <Text style={styles.caption} pointerEvents="none">
        {failed ? "That didn't take. Try again." : "Fill the frame with the dial"}
      </Text>

      <View style={styles.guide} pointerEvents="none">
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <LinearGradient
        colors={["rgba(9,26,17,0)", "rgba(9,26,17,0.7)"]}
        style={styles.scrimBottom}
        pointerEvents="none"
      />
      <Pressable
        onPress={() => void snap()}
        disabled={!ready || capturing}
        accessibilityRole="button"
        accessibilityLabel="Take the odometer photo"
        accessibilityState={{ disabled: !ready, busy: capturing }}
        hitSlop={8}
        style={[styles.shutter, { opacity: ready ? 1 : 0.5 }]}
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
    borderColor: Palette.sun200,
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
