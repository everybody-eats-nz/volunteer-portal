import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Brand } from "@/constants/theme";

// expo-auth-session redirects here after Google OAuth on Android (the URL
// uses the app's `scheme` from app.json, not the iOS-style reversed client
// ID). expo-web-browser's auth-session listener resolves the promise in
// parallel — this screen exists purely so expo-router doesn't show
// "unmatched route" while that resolution happens.
export default function OAuthRedirect() {
  useEffect(() => {
    router.replace("/");
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Brand.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Brand.green,
  },
});
