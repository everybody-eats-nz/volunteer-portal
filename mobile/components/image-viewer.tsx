import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  GestureViewer,
  useGestureViewerState,
} from "react-native-gesture-image-viewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily } from "@/constants/theme";

type ImageViewerProps = {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
};

export function ImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
}: ImageViewerProps) {
  return (
    <Modal
      visible={visible && images.length > 0}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <GestureViewer
        data={images}
        initialIndex={initialIndex}
        ListComponent={ScrollView}
        onDismiss={onClose}
        backdropStyle={styles.backdrop}
        renderItem={(uri) => (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}
      />
      <ViewerOverlay images={images} onClose={onClose} />
    </Modal>
  );
}

function ViewerOverlay({
  images,
  onClose,
}: {
  images: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { currentIndex, totalCount } = useGestureViewerState();
  const [busy, setBusy] = useState<null | "share" | "save">(null);

  const currentUri = images[currentIndex] ?? images[0];

  const downloadToCache = useCallback(async (url: string) => {
    const extMatch = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const filename = `shared-${Date.now()}.${ext}`;
    const dest = new FileSystem.File(FileSystem.Paths.cache, filename);
    const file = await FileSystem.File.downloadFileAsync(url, dest);
    return file.uri;
  }, []);

  const handleShare = useCallback(async () => {
    if (busy || !currentUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy("share");
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing isn't supported on this device.");
        return;
      }
      const localUri = await downloadToCache(currentUri);
      await Sharing.shareAsync(localUri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share photo",
        UTI: "public.image",
      });
    } catch {
      Alert.alert("Couldn't share", "Please try again.");
    } finally {
      setBusy(null);
    }
  }, [busy, currentUri, downloadToCache]);

  const handleSave = useCallback(async () => {
    if (busy || !currentUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy("save");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to save this image."
        );
        return;
      }
      const localUri = await downloadToCache(currentUri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Photo saved to your library.");
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setBusy(null);
    }
  }, [busy, currentUri, downloadToCache]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const topInset =
    Platform.OS === "android" ? StatusBar.currentHeight ?? insets.top : insets.top;

  return (
    <>
      <StatusBar barStyle="light-content" />
      <View
        pointerEvents="box-none"
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <Pressable
          onPress={handleClose}
          hitSlop={16}
          style={({ pressed }) => [
            styles.roundButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel="Close photo viewer"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {totalCount > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {totalCount}
            </Text>
          </View>
        )}

        <View style={styles.roundButtonPlaceholder} />
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          onPress={handleShare}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.actionButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel="Share photo"
          accessibilityRole="button"
        >
          {busy === "share" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={Platform.OS === "ios" ? "share-outline" : "share-social"}
              size={24}
              color="#fff"
            />
          )}
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.actionButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel="Save photo to library"
          accessibilityRole="button"
        >
          {busy === "save" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
          <Text style={styles.actionLabel}>Save</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  backdrop: {
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  counter: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: {
    color: "#fff",
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionButton: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
  },
  actionLabel: {
    color: "#fff",
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
});
