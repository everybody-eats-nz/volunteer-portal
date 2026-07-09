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
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { isPasskeySupported, signInWithPasskey } from "@/lib/passkey-client";
import { signInWithApple, useGoogleAuth } from "@/lib/oauth";
import { posthog } from "@/lib/posthog";

const HERO_IMAGES = [
  require("@/assets/photos/6721b8345984b5e427f7d246_HOMEPAGE - HERO1-2.jpg"), // guests dining
  require("@/assets/photos/ee-serving-plates.jpg"), // volunteer serving two plates
  require("@/assets/photos/ee-foh-portrait.jpg"), // smiling front-of-house volunteer
  require("@/assets/photos/ee-crew-plates.jpg"), // crew with plates
  require("@/assets/photos/ee-volunteer-team.jpg"), // volunteer team in aprons
];

// Facebook login is disabled — the integration has been broken for a while.
type OAuthProvider = "apple" | "google";

export default function LoginScreen({
  onNavigateToRegister,
}: {
  onNavigateToRegister?: () => void;
} = {}) {
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
  const [googleRequest, googleResponse, promptGoogle] = useGoogleAuth();
  // On native, the Google provider uses the auth-code flow and exchanges the
  // code for tokens in a post-prompt effect — so `promptAsync` resolves before
  // the id_token is available. This ref tracks an in-flight sign-in so the
  // effect below can finish the login once the exchanged response lands.
  const googleInFlight = useRef(false);

  useEffect(() => {
    isPasskeySupported().then(setPasskeyReady);
  }, []);

  useEffect(() => {
    if (!googleResponse || !googleInFlight.current) return;

    if (googleResponse.type !== "success") {
      googleInFlight.current = false;
      setBusyProvider(null);
      return;
    }

    const idToken =
      googleResponse.authentication?.idToken ??
      (googleResponse.params as Record<string, string>)?.id_token;

    // First fire has params.code only; wait for the post-exchange update.
    if (!idToken) return;

    googleInFlight.current = false;

    (async () => {
      try {
        await loginWithOAuth("google", { idToken });
      } catch (error) {
        handleError(error, "Couldn't sign in with Google. Please try again.");
        posthog?.capture("login_failed", { method: "oauth_google" });
      } finally {
        setBusyProvider(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

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
      posthog?.capture("login_failed", { method: "email" });
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
      posthog?.capture("login_failed", { method: "passkey" });
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
    googleInFlight.current = true;
    try {
      // Completion is handled by the useEffect watching googleResponse — on
      // native, the id_token only arrives after a post-prompt code exchange.
      await promptGoogle();
    } catch (error) {
      googleInFlight.current = false;
      handleError(error, "Couldn't sign in with Google. Please try again.");
      posthog?.capture("login_failed", { method: "oauth_google" });
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
      posthog?.capture("login_failed", { method: "oauth_apple" });
    } finally {
      setBusyProvider(null);
    }
  }

  // Card surface: warm cream paper that sits on top of the photo.
  const cardSurface = isDark
    ? "rgba(22, 24, 29, 0.90)"
    : "rgba(253, 248, 239, 0.97)";
  const cardStroke = isDark
    ? "rgba(253,248,239,0.10)"
    : "rgba(29,83,55,0.12)";
  const inputBg = isDark ? "rgba(253,248,239,0.05)" : Palette.cream200;
  const inputStroke = isDark
    ? "rgba(253,248,239,0.12)"
    : "rgba(29,83,55,0.15)";
  const mutedText = isDark ? colors.textSecondary : "rgba(26,20,16,0.56)";

  const windowHeight = Dimensions.get("window").height;
  const heroHeight = Math.min(Math.max(windowHeight * 0.48, 320), 520);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? colors.background : Palette.cream100,
      }}
    >
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
            "rgba(14,42,28,0.58)",
            "rgba(14,42,28,0.15)",
            isDark ? "rgba(15,17,20,0.88)" : "rgba(250,242,228,0.98)",
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Greeting overlay.
            No mount animations anywhere on this screen: it mounts during the
            logout tree-swap and on cold start, where reanimated layout
            animations intermittently hard-crash iOS (Fabric). The hero
            photo's expo-image fade is the screen's only motion. */}
        <View style={[styles.greeting, { paddingTop: insets.top + 48 }]}>
          <Eyebrow color={Palette.cream50} style={styles.heroEyebrow}>
            Everybody Eats · Volunteer portal
          </Eyebrow>
          <View style={styles.greetingRow}>
            <ThemedText
              style={styles.kiaOra}
              lightColor={Palette.cream50}
              darkColor={Palette.cream50}
            >
              Kia ora,
            </ThemedText>
            {/* Accent word with a sun underline anchored to its width */}
            <View style={styles.accentWrap}>
              <ThemedText
                type="accent"
                style={[styles.kiaOraAccent, { color: Palette.cream50 }]}
              >
                whānau
              </ThemedText>
              <View style={styles.accentUnderline} />
            </View>
          </View>
          <ThemedText
            style={styles.tagline}
            lightColor={Palette.cream50}
            darkColor={Palette.cream50}
          >
            Making a difference one plate at a time
          </ThemedText>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
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
          <View
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
                    ? "rgba(253,248,239,0.18)"
                    : "rgba(29,83,55,0.20)",
                },
              ]}
            />

            <ThemedText
              type="display"
              style={styles.cardTitle}
              lightColor={Brand.green}
              darkColor={colors.text}
            >
              Sign in to{" "}
              <ThemedText type="accent" style={styles.cardTitleAccent}>
                volunteer
              </ThemedText>
            </ThemedText>

            {/* Passkey — primary path when supported */}
            {passkeyReady && (
              <View style={{ marginTop: 22 }}>
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
              </View>
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
            <View style={styles.oauthRow}>
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
            </View>

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
            <View style={{ marginTop: 16, gap: 12 }}>
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
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: mutedText }]}>
                New here?
              </ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (onNavigateToRegister) {
                    onNavigateToRegister();
                  } else {
                    // Fallback for any context that renders LoginScreen without
                    // the in-app register flow wired up.
                    openBrowserAsync(
                      "https://volunteers.everybodyeats.nz/register",
                      {
                        presentationStyle:
                          WebBrowserPresentationStyle.AUTOMATIC,
                      }
                    );
                  }
                }}
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
          </View>
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
          bg: isDark ? Palette.cream50 : Palette.ink,
          border: "transparent",
          icon: isDark ? Palette.ink : Palette.cream50,
          label: "Apple",
        }
      : {
          bg: isDark ? "rgba(253,248,239,0.06)" : Palette.cream50,
          border: isDark ? "rgba(253,248,239,0.14)" : "rgba(29,83,55,0.15)",
          icon: Palette.ink,
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
  heroEyebrow: {
    marginBottom: 16,
    opacity: 0.92,
  },
  greetingRow: {
    alignItems: "flex-start",
  },
  kiaOra: {
    fontFamily: FontFamily.display,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1,
  },
  kiaOraAccent: {
    fontSize: 46,
    lineHeight: 50,
  },
  /** Wrapper shrinks to the accent word so the underline matches its width */
  accentWrap: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  /** Sun-yellow highlight under the accent word */
  accentUnderline: {
    alignSelf: "stretch",
    height: 7,
    borderRadius: 3,
    marginTop: -2,
    backgroundColor: Brand.accent,
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
    fontFamily: FontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  cardTitleAccent: {
    fontSize: 28,
    lineHeight: 32,
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
    borderRadius: 999,
    paddingHorizontal: 20,
  },
  signInBtn: {
    marginTop: 6,
  },
  primaryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: Palette.cream50,
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
