import { useCallback, type ReactElement } from "react";
import { Linking, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { Palette } from "@/constants/theme";

/**
 * The Year in mahi player: the web page at /embed/year-in-review in a
 * WebView, opened with the app's bearer token.
 *
 * This is the only file that imports react-native-webview. Never import it
 * directly: go through `load-year-in-review-player.ts`, which only loads it
 * when the native module is in the binary, so older installs taking an
 * over-the-air update don't crash on import.
 */
export function YearInReviewPlayer({
  uri,
  token,
  onLoadFailed,
  renderLoading,
}: {
  uri: string;
  token: string;
  onLoadFailed: () => void;
  renderLoading: () => ReactElement;
}) {
  // Stay on the video page; anything else opens in the browser.
  const onShouldStartLoadWithRequest = useCallback(
    ({ url }: { url: string }) => {
      if (url.startsWith(uri) || url === "about:blank") return true;
      Linking.openURL(url);
      return false;
    },
    [uri]
  );

  return (
    <WebView
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      style={styles.webview}
      containerStyle={styles.webview}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onError={onLoadFailed}
      onHttpError={onLoadFailed}
      startInLoadingState
      renderLoading={renderLoading}
      allowsInlineMediaPlayback
      allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false}
      overScrollMode="never"
      scrollEnabled={false}
      testID="year-in-review-webview"
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: Palette.forest700 },
});
