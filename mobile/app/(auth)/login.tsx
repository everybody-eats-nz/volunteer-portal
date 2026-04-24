import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { isPasskeySupported, signInWithPasskey } from "@/lib/passkey-client";
import { signInWithApple, useGoogleAuth } from "@/lib/oauth";

const HERO_IMAGES = [
  require("@/assets/photos/6721b8345984b5e427f7d246_HOMEPAGE - HERO1-2.jpg"),
  require("@/assets/photos/66da3c585f61f1e0ba83fbcc_03.png"),
];

type OAuthProvider = "apple" | "google";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const { loginWithEmail, loginWithOAuth, loginWithPasskey } = useAuth();

  const heroImage = useMemo(
    () => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)],
    []
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyProvider, setBusyProvider] = useState<
    OAuthProvider | "passkey" | null
  >(null);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const [googleRequest, , promptGoogle] = useGoogleAuth();

  useEffect(() => {
    isPasskeySupported().then(setPasskeyReady);
  }, []);

  const anyBusy = isSubmitting || busyProvider !== null;

  function handleError(error: unknown, fallback: string) {
    const message = error instanceof ApiError ? error.message : fallback;
    Alert.alert("Sign in failed", message);
  }

  async function handleEmailLogin() {
    if (!email.trim() || !password.trim() || anyBusy) return;
    Haptics.selectionAsync();
    setIsSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (error) {
      handleError(error, "Please check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasskey() {
    if (anyBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyProvider("passkey");
    try {
      const response = await signInWithPasskey();
      if (!response) return; // user cancelled
      await loginWithPasskey(response);
    } catch (error) {
      handleError(
        error,
        "Couldn't sign in with passkey. Please try another method."
      );
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleGoogle() {
    if (anyBusy) return;
    if (!googleRequest) {
      Alert.alert(
        "Sign in failed",
        "Google sign-in isn't ready yet — try again in a moment."
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyProvider("google");
    try {
      const result = await promptGoogle();
      if (result.type !== "success") return; // cancelled / dismissed
      const idToken =
        result.authentication?.idToken ??
        (result.params as Record<string, string>)?.id_token;
      if (!idToken) throw new Error("Google did not return an id_token.");
      await loginWithOAuth("google", { idToken });
    } catch (error) {
      handleError(error, "Couldn't sign in with Google. Please try again.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleApple() {
    if (anyBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyProvider("apple");
    try {
      const token = await signInWithApple();
      if (!token) return; // cancelled
      await loginWithOAuth("apple", token);
    } catch (error) {
      handleError(error, "Couldn't sign in with Apple. Please try again.");
    } finally {
      setBusyProvider(null);
    }
  }

  // Card surface: warm white that sits on top of the photo.
  const cardSurface = isDark
    ? "rgba(16, 20, 24, 0.88)"
    : "rgba(255, 253, 247, 0.96)";
  const cardStroke = isDark ? "rgba(255,255,255,0.08)" : "rgba(14,58,35,0.08)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(14,58,35,0.04)";
  const inputStroke = isDark ? "rgba(255,255,255,0.10)" : "rgba(14,58,35,0.12)";
  const mutedText = isDark ? "rgba(229,240,232,0.62)" : "rgba(16,20,24,0.56)";

  const windowHeight = Dimensions.get("window").height;
  const heroHeight = Math.min(Math.max(windowHeight * 0.48, 320), 520);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#0b0d10" : "#f1eadc" }}>
      <StatusBar style="light" />

      {/* Hero image — full-bleed, absolutely positioned so the form can overlap */}
      <View style={[styles.heroWrapper, { height: heroHeight }]}>
        <Image
          source={heroImage}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={600}
        />
        {/* Dim + warm tint the photo so typography pops */}
        <LinearGradient
          colors={[
            "rgba(14,58,35,0.55)",
            "rgba(14,58,35,0.15)",
            isDark ? "rgba(11,13,16,0.85)" : "rgba(241,234,220,0.98)",
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Greeting overlay */}
        <Animated.View
          entering={FadeInDown.duration(700)
            .delay(150)
            .easing(Easing.out(Easing.cubic))}
          style={[styles.greeting, { paddingTop: insets.top + 48 }]}
        >
          <View style={styles.greetingRow}>
            <ThemedText
              style={styles.kiaOra}
              lightColor="#fffdf7"
              darkColor="#fffdf7"
            >
              Kia ora
            </ThemedText>
            {/* Lime accent curl under the greeting */}
            <View style={styles.accentCurl} />
          </View>
          <ThemedText
            style={styles.tagline}
            lightColor="#fffdf7"
            darkColor="#fffdf7"
          >
            Making a difference one plate at a time
          </ThemedText>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: heroHeight - 40, // overlap with hero
            paddingBottom: insets.bottom + 24,
            minHeight: windowHeight,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(600)
              .delay(250)
              .easing(Easing.out(Easing.cubic))}
            style={[
              styles.card,
              {
                backgroundColor: cardSurface,
                borderColor: cardStroke,
              },
            ]}
          >
            {/* Little grab handle to reinforce the "sheet rising" metaphor */}
            <View
              style={[
                styles.grabHandle,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(14,58,35,0.18)",
                },
              ]}
            />

            <ThemedText
              type="heading"
              style={styles.cardTitle}
              lightColor={Brand.green}
              darkColor={colors.text}
            >
              Sign in to volunteer
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: mutedText }]}>
              One step closer to your next shift
            </ThemedText>

            {/* Passkey — primary path when supported */}
            {passkeyReady && (
              <Animated.View
                entering={FadeInUp.duration(400).delay(350)}
                style={{ marginTop: 22 }}
              >
                <Pressable
                  onPress={handlePasskey}
                  disabled={anyBusy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: Brand.green,
                      opacity: pressed || anyBusy ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with passkey"
                  accessibilityState={{ busy: busyProvider === "passkey" }}
                >
                  <Ionicons
                    name="finger-print"
                    size={22}
                    color={Brand.accent}
                  />
                  <ThemedText style={styles.primaryBtnText}>
                    {busyProvider === "passkey"
                      ? "Authenticating…"
                      : "Sign in with passkey"}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            )}

            {/* Divider: "or continue with" */}
            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
              <ThemedText style={[styles.dividerText, { color: mutedText }]}>
                {passkeyReady ? "or continue with" : "continue with"}
              </ThemedText>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
            </View>

            {/* OAuth row — icon-only circles */}
            <Animated.View
              entering={FadeInUp.duration(400).delay(400)}
              style={styles.oauthRow}
            >
              {Platform.OS === "ios" && (
                <OAuthCircle
                  provider="apple"
                  isBusy={busyProvider === "apple"}
                  disabled={anyBusy}
                  onPress={handleApple}
                  isDark={isDark}
                />
              )}
              <OAuthCircle
                provider="google"
                isBusy={busyProvider === "google"}
                disabled={anyBusy || !googleRequest}
                onPress={handleGoogle}
                isDark={isDark}
              />
            </Animated.View>

            {/* Divider before email */}
            <View style={[styles.divider, { marginTop: 22 }]}>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
              <ThemedText style={[styles.dividerText, { color: mutedText }]}>
                or use email
              </ThemedText>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
            </View>

            {/* Email + password form */}
            <Animated.View
              entering={FadeInUp.duration(400).delay(450)}
              style={{ marginTop: 16, gap: 12 }}
            >
              <View
                style={[
                  styles.inputShell,
                  { backgroundColor: inputBg, borderColor: inputStroke },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={mutedText}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={mutedText}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  editable={!anyBusy}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>

              <View
                style={[
                  styles.inputShell,
                  { backgroundColor: inputBg, borderColor: inputStroke },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={mutedText}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={mutedText}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  passwordRules="minlength: 8;"
                  returnKeyType="go"
                  editable={!anyBusy}
                  onSubmitEditing={handleEmailLogin}
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={mutedText}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={handleEmailLogin}
                disabled={anyBusy || !email.trim() || !password.trim()}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.signInBtn,
                  {
                    backgroundColor: Brand.greenHover,
                    opacity:
                      anyBusy || !email.trim() || !password.trim()
                        ? 0.5
                        : pressed
                        ? 0.9
                        : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmitting, disabled: anyBusy }}
              >
                <ThemedText style={styles.primaryBtnText}>
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </ThemedText>
              </Pressable>
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: mutedText }]}>
                New here?
              </ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  openBrowserAsync(
                    "https://volunteers.everybodyeats.nz/register",
                    {
                      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
                    }
                  )
                }
              >
                <ThemedText style={styles.footerLink}>
                  Join our whānau
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText
              style={[styles.ngaMihi, { color: mutedText }]}
              accessible={false}
            >
              Ngā mihi
            </ThemedText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OAuthCircle({
  provider,
  isBusy,
  disabled,
  onPress,
  isDark,
}: {
  provider: OAuthProvider;
  isBusy: boolean;
  disabled: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const style =
    provider === "apple"
      ? {
          bg: isDark ? "#f5f5f7" : "#0b0d10",
          border: "transparent",
          icon: isDark ? "#0b0d10" : "#ffffff",
          label: "Apple",
        }
      : {
          bg: "#ffffff",
          border: "rgba(0,0,0,0.08)",
          icon: "#0b0d10",
          label: "Google",
        };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Sign in with ${style.label}`}
      accessibilityState={{ busy: isBusy, disabled }}
      style={({ pressed }) => [
        styles.oauthCircle,
        {
          backgroundColor: style.bg,
          borderColor: style.border,
          opacity: disabled && !isBusy ? 0.6 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {isBusy ? (
        <Ionicons name="ellipsis-horizontal" size={22} color={style.icon} />
      ) : provider === "apple" ? (
        <Ionicons name="logo-apple" size={26} color={style.icon} />
      ) : (
        <Ionicons name="logo-google" size={26} color="#4285F4" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    width: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  greeting: {
    paddingHorizontal: 28,
  },
  greetingRow: {
    alignItems: "flex-start",
  },
  kiaOra: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.5,
  },
  accentCurl: {
    marginTop: 6,
    width: 72,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.accent,
    opacity: 0.92,
  },
  tagline: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    marginTop: 14,
    letterSpacing: 0.2,
    opacity: 0.92,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
    // Soft elevation to lift card off the photo
    shadowColor: "#0b0d10",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  grabHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 18,
  },
  cardTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    lineHeight: 30,
  },
  cardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  signInBtn: {
    marginTop: 6,
  },
  primaryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: "#fffdf7",
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  oauthRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 18,
  },
  oauthCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputIcon: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    paddingVertical: 14,
  },
  footer: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
  },
  footerLink: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Brand.green,
  },
  ngaMihi: {
    marginTop: 18,
    alignSelf: "center",
    fontFamily: FontFamily.heading,
    fontSize: 13,
    opacity: 0.6,
    letterSpacing: 0.5,
  },
});
