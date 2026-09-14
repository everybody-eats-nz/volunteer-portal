import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import type { OcrResult } from "@/lib/odometer-reading";

/**
 * The on-device text recogniser the viewfinder reads the dial with, or null
 * when this binary does not carry one.
 *
 * It is `expo-mlkit-ocr`: Apple Vision on iOS, Google ML Kit on Android, both
 * entirely on the phone. Like the camera in `load-viewfinder.ts` it is native,
 * and installs built before it was added still take over-the-air updates, so
 * the module is looked up rather than imported. Without it the viewfinder is
 * just a camera and the driver types the number, which is what it was before.
 */
type ReaderModule = {
  isSupported(): boolean;
  recognizeText(uri: string): Promise<OcrResult>;
};

const native =
  Platform.OS !== "web" ? requireOptionalNativeModule<ReaderModule>("ExpoMlkitOcr") : null;

export const readText: ((uri: string) => Promise<OcrResult>) | null =
  native && native.isSupported() ? (uri) => native.recognizeText(uri) : null;
