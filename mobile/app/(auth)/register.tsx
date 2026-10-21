import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
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
import { Button } from "@/components/ui/button";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useKeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";
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

  // The form is taller than the space above the keyboard, so each field is
  // brought clear of it on its own (see useKeyboardAwareScroll). Only the two
  // password fields travel together.
  const keyboardScroll = useKeyboardAwareScroll();
  const revealOnFocus = keyboardScroll.inputProps();
  const passwordsRef = useRef<View>(null);
  const revealPasswords = keyboardScroll.inputProps(passwordsRef);

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

  // Card surface tokens shared with the login screen for visual continuity:
  // cream paper (light) or the dark card (dark) laid over the photo.
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
  const rippleColor = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.12)";

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
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? colors.background : Palette.cream100,
      }}
    >
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
            "rgba(14,42,28,0.55)",
            "rgba(14,42,28,0.18)",
            // Fades into the page background (colors.background / cream100).
            isDark ? "rgba(15,17,20,0.88)" : "rgba(250,242,228,0.98)",
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
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          android_ripple={{ color: "rgba(253,248,239,0.22)", borderless: true }}
          style={[styles.backBtn, { top: insets.top + 12 }]}
        >
          <Ionicons name="chevron-back" size={22} color={Palette.cream50} />
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
              lightColor={Palette.cream50}
              darkColor={Palette.cream50}
            >
              Haere mai
            </ThemedText>
            <View style={styles.accentCurl} />
          </View>
          <ThemedText
            style={styles.tagline}
            lightColor={Palette.cream50}
            darkColor={Palette.cream50}
          >
            Join the whānau and serve up some manaaki
          </ThemedText>
        </Animated.View>
      </View>

      <Animated.ScrollView
        {...keyboardScroll.scrollProps}
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
                  {...revealOnFocus}
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
                  {...revealOnFocus}
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
                {...revealOnFocus}
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            {/* Both passwords and the rules between them are kept clear of the
                keyboard together, so the rules can be read while typing and
                the confirmation field is already in view. */}
            <View ref={passwordsRef} style={styles.passwords}>
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
                  {...revealPasswords}
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                  accessibilityRole="button"
                  android_ripple={{ color: rippleColor, borderless: true }}
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
                        color={check.passed ? colors.tint : mutedText}
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
                  {...revealPasswords}
                  style={[styles.input, { color: colors.text }]}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={passwordsMatch ? colors.tint : colors.destructive}
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
          <Button
            label="Create account"
            onPress={handleRegister}
            size="lg"
            fullWidth
            loading={isSubmitting}
            // canSubmit is false while submitting; keep the spinner at full
            // strength rather than dimmed as disabled.
            disabled={!canSubmit && !isSubmitting}
            // handleRegister fires its own haptic once the guard passes.
            haptic={false}
            accessibilityLabel={
              isSubmitting ? "Creating account" : "Create account"
            }
            style={styles.submitBtn}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: mutedText }]}>
              Already volunteering?
            </ThemedText>
            <Pressable
              hitSlop={12}
              onPress={() => {
                Haptics.selectionAsync();
                onBackToLogin?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              android_ripple={{ color: rippleColor, borderless: true }}
            >
              <ThemedText style={[styles.footerLink, { color: colors.tint }]}>
                Sign in
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View style={keyboardScroll.spacerStyle} />
      </Animated.ScrollView>

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
    // 40pt circle + 4pt hitSlop = a 44pt target.
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
    shadowColor: Palette.forest800,
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
  passwords: {
    gap: 12,
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
  submitBtn: {
    marginTop: 22,
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
  },
});
