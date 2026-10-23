import * as Haptics from "expo-haptics";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Button } from "@/components/ui/button";
import { FontFamily, Palette } from "@/constants/theme";
import {
  useYearInReviewVideo,
  type YearInReviewVideo,
} from "@/hooks/use-year-in-review";
import { API_URL } from "@/lib/api";
import { posthog } from "@/lib/posthog";

const EMBED_URL = `${API_URL}/embed/year-in-review`;

/**
 * The volunteer's Year in mahi video.
 *
 * The player is the web page at /embed/year-in-review, opened with the app's
 * bearer token, so the video changes without an app release. The MP4 is
 * rendered on the server: "Save or share" asks for it, shows progress while
 * it renders, then downloads it and opens the share sheet, where Instagram
 * (and Save Video) live.
 */
export default function YearInReviewScreen() {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    SecureStore.getItemAsync("auth_token").then((value) => setToken(value ?? ""));
  }, []);

  // Stay on the video page; anything else opens in the browser.
  const onShouldStartLoadWithRequest = useCallback(
    ({ url }: { url: string }) => {
      if (url.startsWith(EMBED_URL) || url === "about:blank") return true;
      Linking.openURL(url);
      return false;
    },
    []
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.player}>
        {token === null ? (
          <Loading />
        ) : loadFailed ? (
          <View style={styles.centered}>
            <Text style={styles.message}>
              Couldn&apos;t load your year in mahi. Check your connection and
              try again.
            </Text>
            <Button
              label="Try again"
              variant="accent"
              onPress={() => {
                setLoadFailed(false);
                setReloadKey((key) => key + 1);
              }}
            />
          </View>
        ) : (
          <WebView
            key={reloadKey}
            source={{
              uri: EMBED_URL,
              headers: { Authorization: `Bearer ${token}` },
            }}
            style={styles.webview}
            containerStyle={styles.webview}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onError={() => setLoadFailed(true)}
            onHttpError={() => setLoadFailed(true)}
            startInLoadingState
            renderLoading={() => <Loading />}
            allowsInlineMediaPlayback
            allowsBackForwardNavigationGestures={false}
            setSupportMultipleWindows={false}
            overScrollMode="never"
            scrollEnabled={false}
            testID="year-in-review-webview"
          />
        )}
      </View>
      {token ? (
        <ShareBar token={token} bottomInset={insets.bottom} />
      ) : null}
    </View>
  );
}

/** Asks for the MP4, waits for it, then hands it to the share sheet. */
function ShareBar({ token, bottomInset }: { token: string; bottomInset: number }) {
  const { video, working, request } = useYearInReviewVideo();
  const [downloading, setDownloading] = useState(false);
  // Set when they've tapped and are waiting, so the share sheet opens by
  // itself once the video is ready.
  const waitingToShare = useRef(false);

  // Downloads the finished MP4 and opens the share sheet. Returns false when
  // the file has gone (re-rendered since), so the caller can ask again.
  const shareVideo = useCallback(
    async (ready: YearInReviewVideo): Promise<boolean> => {
      if (!ready.fileUrl) return false;
      setDownloading(true);
      try {
        const year = new URLSearchParams(ready.fileUrl.split("?")[1]).get("year");
        const file = new File(Paths.cache, `year-in-mahi-${year}.mp4`);
        if (file.exists) file.delete();
        try {
          await File.downloadFileAsync(`${API_URL}${ready.fileUrl}`, file, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          return false;
        }
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert("Sharing unavailable", "Sharing isn't supported on this device.");
          return true;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        posthog?.capture("year_in_review_shared");
        await Sharing.shareAsync(file.uri, {
          mimeType: "video/mp4",
          UTI: "public.mpeg-4",
          dialogTitle: "Share your year in mahi",
        });
      } catch {
        Alert.alert("Couldn't share the video", "Please try again.");
      } finally {
        setDownloading(false);
      }
      return true;
    },
    [token]
  );

  // The render finished while they waited on this screen.
  useEffect(() => {
    if (video?.status === "READY" && waitingToShare.current) {
      waitingToShare.current = false;
      shareVideo(video);
    }
    if (video?.status === "FAILED") waitingToShare.current = false;
  }, [video, shareVideo]);

  const requestAndShare = async () => {
    waitingToShare.current = true;
    try {
      const requested = await request();
      if (requested.status === "READY") {
        waitingToShare.current = false;
        if (!(await shareVideo(requested))) {
          Alert.alert("Couldn't get the video", "Please try again.");
        }
      }
    } catch {
      waitingToShare.current = false;
      Alert.alert("Couldn't make the video", "Please try again.");
    }
  };

  const onPress = async () => {
    if (video?.status === "READY" && (await shareVideo(video))) return;
    await requestAndShare();
  };

  const status = video?.status;
  const rendering = working || status === "QUEUED" || status === "RENDERING";

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 16) }]}>
      {rendering ? (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <View style={styles.progressRow}>
            <ActivityIndicator color={Palette.sun200} size="small" />
            <Text style={styles.progressLabel}>
              {status === "RENDERING"
                ? `Making your video… ${video?.progress ?? 0}%`
                : video && video.ahead > 0
                  ? `Waiting for ${video.ahead} other ${video.ahead === 1 ? "video" : "videos"}`
                  : "Getting started…"}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${status === "RENDERING" ? (video?.progress ?? 0) : 0}%` },
              ]}
            />
          </View>
          <Text style={styles.hint}>
            About a minute. You can leave this screen and come back.
          </Text>
        </View>
      ) : (
        <>
          <Button
            label={status === "READY" ? "Share video" : "Save or share video"}
            icon="share-outline"
            iconLeading
            variant="accent"
            size="lg"
            fullWidth
            loading={downloading}
            disabled={downloading}
            onPress={onPress}
            testID="year-in-review-share"
          />
          <Text style={styles.hint}>
            {status === "FAILED"
              ? "Something went wrong making your video. Try again."
              : "Sized for Instagram Stories and Reels."}
          </Text>
        </>
      )}
    </View>
  );
}

function Loading() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.centered]}>
      <ActivityIndicator color={Palette.sun200} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.forest700 },
  player: { flex: 1 },
  webview: { flex: 1, backgroundColor: Palette.forest700 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 32,
    backgroundColor: Palette.forest700,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: Palette.cream50,
  },
  bar: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: "rgba(253,248,239,0.75)",
  },
  progress: { gap: 10, minHeight: 82 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: Palette.cream50,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(253,248,239,0.2)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: Palette.sun200 },
});
