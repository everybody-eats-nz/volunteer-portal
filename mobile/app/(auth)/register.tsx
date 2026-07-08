import { useMemo, useRef, useState } from "react";
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
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { AgreementGate, AgreementModal } from "@/components/agreement-modal";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  AGREEMENTS,
  type AgreementKey,
  useAgreementPolicies,
} from "@/hooks/use-agreement-policies";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";
import { posthog } from "@/lib/posthog";

const HERO_IMAGE = require("@/assets/photos/ee-kitchen-team.jpg");

// Mirrors web/src/lib/utils/password-validation.ts so client-side checks match
// what the /api/auth/register endpoint enforces.
const PASSWORD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 6, label: "At least 6 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({
  onBackToLogin,
}: {
  onBackToLogin?: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const { registerWithEmail } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeVolunteer, setAgreeVolunteer] = useState(false);
  const [agreeSafety, setAgreeSafety] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OAuth sign-up (also creates the account); new accounts pass through the
  // agreement gate in AuthGate afterwards.
  const { busyProvider, googleReady, handleGoogle, handleApple } =
    useOAuthSignIn();
  const oauthBusy = busyProvider !== null;

  // Which agreement modal is open (null = none).
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(
    null
  );
  const policies = useAgreementPolicies();

  function openAgreement(key: AgreementKey) {
    Haptics.selectionAsync();
    if (!policies.text[key] && !policies.loading[key]) policies.load(key);
    setActiveAgreement(key);
  }

  function acceptAgreement(key: AgreementKey) {
    if (key === "volunteer") setAgreeVolunteer(true);
    else setAgreeSafety(true);
    setActiveAgreement(null);
  }

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((r) => ({ label: r.label, passed: r.test(password) })),
    [password]
  );
  const passwordValid = passwordChecks.every((c) => c.passed);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const canSubmit =
    !!firstName.trim() &&
    !!lastName.trim() &&
    EMAIL_RE.test(email.trim()) &&
    passwordValid &&
    passwordsMatch &&
    agreeVolunteer &&
    agreeSafety &&
    !isSubmitting &&
    !oauthBusy;

  // Card surface tokens shared with the login screen for visual continuity.
  const cardSurface = isDark
    ? "rgba(16, 20, 24, 0.88)"
    : "rgba(255, 253, 247, 0.96)";
  const cardStroke = isDark ? "rgba(255,255,255,0.08)" : "rgba(14,58,35,0.08)";
  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(14,58,35,0.04)";
  const inputStroke = isDark ? "rgba(255,255,255,0.10)" : "rgba(14,58,35,0.12)";
  const mutedText = isDark ? "rgba(229,240,232,0.62)" : "rgba(16,20,24,0.56)";

  const windowHeight = Dimensions.get("window").height;
  const heroHeight = Math.min(Math.max(windowHeight * 0.3, 220), 340);

  async function handleRegister() {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);
    try {
      await registerWithEmail({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        volunteerAgreementAccepted: agreeVolunteer,
        healthSafetyPolicyAccepted: agreeSafety,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // On success the auth store flips isAuthenticated → AuthGate swaps in the
      // app. Surface the verification reminder so the volunteer knows to check
      // their inbox.
      Alert.alert(
        "Welcome to the whānau! 🌱",
        "Your account is ready. We've sent a verification link to your email — confirm it when you can."
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      Alert.alert("Couldn't create your account", message);
      posthog?.capture("register_failed", { method: "email" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#0b0d10" : "#f1eadc" }}>
      <StatusBar style="light" />

      {/* Hero image — shorter than login to leave room for the longer form */}
      <View style={[styles.heroWrapper, { height: heroHeight }]}>
        <Image
          source={HERO_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
        <LinearGradient
          colors={[
            "rgba(14,58,35,0.55)",
            "rgba(14,58,35,0.18)",
            isDark ? "rgba(11,13,16,0.9)" : "rgba(241,234,220,0.98)",
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Back button */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onBackToLogin?.();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          style={[styles.backBtn, { top: insets.top + 12 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#fffdf7" />
        </Pressable>

        <Animated.View
          entering={FadeInDown.duration(700)
            .delay(120)
            .easing(Easing.out(Easing.cubic))}
          style={[styles.greeting, { paddingTop: insets.top + 56 }]}
        >
          <View style={styles.greetingRow}>
            <ThemedText
              style={styles.haereMai}
              lightColor="#fffdf7"
              darkColor="#fffdf7"
            >
              Haere mai
            </ThemedText>
            <View style={styles.accentCurl} />
          </View>
          <ThemedText
            style={styles.tagline}
            lightColor="#fffdf7"
            darkColor="#fffdf7"
          >
            Join the whānau and serve up some manaaki
          </ThemedText>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: heroHeight - 40,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(600)
              .delay(200)
              .easing(Easing.out(Easing.cubic))}
            style={[
              styles.card,
              { backgroundColor: cardSurface, borderColor: cardStroke },
            ]}
          >
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
              Create your account
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: mutedText }]}>
              A few details and you&apos;re ready to volunteer
            </ThemedText>

            {/* Quick sign-up with a provider */}
            <View style={{ marginTop: 20 }}>
              <OAuthButtons
                busyProvider={busyProvider}
                googleReady={googleReady}
                disabled={isSubmitting || oauthBusy}
                onApple={handleApple}
                onGoogle={handleGoogle}
                isDark={isDark}
              />
            </View>

            {/* Divider before the email form */}
            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
              <ThemedText style={[styles.dividerText, { color: mutedText }]}>
                or sign up with email
              </ThemedText>
              <View
                style={[styles.dividerLine, { backgroundColor: inputStroke }]}
              />
            </View>

            <View style={{ marginTop: 4, gap: 12 }}>
              {/* Name row */}
              <View style={styles.nameRow}>
                <View
                  style={[
                    styles.inputShell,
                    styles.nameField,
                    { backgroundColor: inputBg, borderColor: inputStroke },
                  ]}
                >
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
                    placeholderTextColor={mutedText}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                    editable={!isSubmitting}
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
                <View
                  style={[
                    styles.inputShell,
                    styles.nameField,
                    { backgroundColor: inputBg, borderColor: inputStroke },
                  ]}
                >
                  <TextInput
                    ref={lastNameRef}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last name"
                    placeholderTextColor={mutedText}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                    editable={!isSubmitting}
                    onSubmitEditing={() => emailRef.current?.focus()}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Email */}
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
                  ref={emailRef}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={mutedText}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  editable={!isSubmitting}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>

              {/* Password */}
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
                  placeholder="Create a password"
                  placeholderTextColor={mutedText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  passwordRules="minlength: 6; required: lower; required: upper; required: digit;"
                  returnKeyType="next"
                  editable={!isSubmitting}
                  onSubmitEditing={() => confirmRef.current?.focus()}
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

              {/* Live password requirements */}
              {password.length > 0 && (
                <Animated.View
                  entering={FadeInDown.duration(250)}
                  style={styles.requirements}
                >
                  {passwordChecks.map((check) => (
                    <View key={check.label} style={styles.requirementRow}>
                      <Ionicons
                        name={
                          check.passed
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={15}
                        color={check.passed ? Brand.greenHover : mutedText}
                      />
                      <ThemedText
                        style={[
                          styles.requirementText,
                          {
                            color: check.passed ? colors.text : mutedText,
                          },
                        ]}
                      >
                        {check.label}
                      </ThemedText>
                    </View>
                  ))}
                </Animated.View>
              )}

              {/* Confirm password */}
              <View
                style={[
                  styles.inputShell,
                  {
                    backgroundColor: inputBg,
                    borderColor:
                      confirmPassword.length > 0 && !passwordsMatch
                        ? colors.destructive
                        : inputStroke,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={mutedText}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmRef}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor={mutedText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="go"
                  editable={!isSubmitting}
                  onSubmitEditing={handleRegister}
                  style={[styles.input, { color: colors.text }]}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={passwordsMatch ? Brand.greenHover : colors.destructive}
                  />
                )}
              </View>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <ThemedText
                  style={[styles.fieldError, { color: colors.destructive }]}
                >
                  Passwords don&apos;t match
                </ThemedText>
              )}
            </View>

            {/* Agreements — must be opened and read before they can be accepted */}
            <View style={{ marginTop: 18, gap: 10 }}>
              <ThemedText style={[styles.agreementsLabel, { color: mutedText }]}>
                Please read and agree to continue
              </ThemedText>
              <AgreementGate
                title="Volunteer Agreement"
                agreed={agreeVolunteer}
                onPress={() => openAgreement("volunteer")}
                inputBg={inputBg}
                inputStroke={inputStroke}
                mutedText={mutedText}
                textColor={colors.text}
              />
              <AgreementGate
                title="Health & Safety Policy"
                agreed={agreeSafety}
                onPress={() => openAgreement("safety")}
                inputBg={inputBg}
                inputStroke={inputStroke}
                mutedText={mutedText}
                textColor={colors.text}
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleRegister}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: Brand.green,
                  opacity: !canSubmit ? 0.5 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ busy: isSubmitting, disabled: !canSubmit }}
            >
              <ThemedText style={styles.primaryBtnText}>
                {isSubmitting ? "Creating account…" : "Create account"}
              </ThemedText>
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: mutedText }]}>
                Already volunteering?
              </ThemedText>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  Haptics.selectionAsync();
                  onBackToLogin?.();
                }}
              >
                <ThemedText style={styles.footerLink}>Sign in</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Agreement readers — gated on scroll-to-end before they can be accepted */}
      {activeAgreement && (
        <AgreementModal
          visible
          title={AGREEMENTS[activeAgreement].title}
          content={policies.text[activeAgreement]}
          loading={policies.loading[activeAgreement]}
          error={policies.error[activeAgreement]}
          onRetry={() => policies.load(activeAgreement)}
          onClose={() => setActiveAgreement(null)}
          onAgree={() => acceptAgreement(activeAgreement)}
        />
      )}
    </View>
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
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,13,16,0.28)",
    zIndex: 2,
  },
  greeting: {
    paddingHorizontal: 28,
  },
  greetingRow: {
    alignItems: "flex-start",
  },
  haereMai: {
    fontFamily: FontFamily.headingBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.2,
  },
  accentCurl: {
    marginTop: 6,
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.accent,
    opacity: 0.92,
  },
  tagline: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    marginTop: 12,
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
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
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
  requirements: {
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requirementText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
  },
  fieldError: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    paddingHorizontal: 4,
    marginTop: -4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  agreementsLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    paddingHorizontal: 2,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  primaryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: "#fffdf7",
    letterSpacing: 0.2,
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
});
