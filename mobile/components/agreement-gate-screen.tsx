import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { AgreementGate, AgreementModal } from "@/components/agreement-modal";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth";
import {
  AGREEMENTS,
  type AgreementKey,
  useAgreementPolicies,
} from "@/hooks/use-agreement-policies";

/**
 * Shown after authentication when the account hasn't yet accepted the required
 * agreements — chiefly OAuth sign-ups, which can't capture them at account
 * creation the way email sign-up does. Acceptance is persisted server-side, so
 * it only ever appears once per volunteer.
 */
export function AgreementGateScreen() {
  const isDark = useColorScheme() === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const { user, acceptAgreements, logout } = useAuth();

  const [agreedVolunteer, setAgreedVolunteer] = useState(false);
  const [agreedSafety, setAgreedSafety] = useState(false);
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const policies = useAgreementPolicies();
  const bothAgreed = agreedVolunteer && agreedSafety;

  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(14,58,35,0.04)";
  const inputStroke = isDark ? "rgba(255,255,255,0.10)" : "rgba(14,58,35,0.12)";
  const mutedText = isDark ? colors.textSecondary : "rgba(16,20,24,0.56)";
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";

  function openAgreement(key: AgreementKey) {
    Haptics.selectionAsync();
    if (!policies.text[key] && !policies.loading[key]) policies.load(key);
    setActiveAgreement(key);
  }

  function acceptAgreement(key: AgreementKey) {
    if (key === "volunteer") setAgreedVolunteer(true);
    else setAgreedSafety(true);
    setActiveAgreement(null);
  }

  async function handleContinue() {
    if (!bothAgreed || submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      // On success the user object flips agreementsAccepted → AuthGate swaps in
      // the app and this screen unmounts.
      await acceptAgreements();
    } catch {
      Alert.alert(
        "Couldn't save",
        "We couldn't record your agreement. Please check your connection and try again."
      );
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      "Sign out?",
      "You'll need to accept the agreements to use Everybody Eats.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => logout() },
      ]
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <View
            style={[
              styles.badge,
              { backgroundColor: isDark ? "rgba(248,251,105,0.14)" : Brand.greenLight },
            ]}
          >
            <Ionicons name="shield-checkmark" size={26} color={colors.tint} />
          </View>
          <ThemedText
            type="heading"
            style={styles.title}
            lightColor={Brand.green}
            darkColor={colors.text}
          >
            Welcome, {firstName} 👋
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedText }]}>
            One quick step before you start - please read and agree to our
            volunteer agreements. They keep our whānau and guests safe.
          </ThemedText>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(500).delay(120)}
          style={styles.gates}
        >
          <AgreementGate
            title="Volunteer Agreement"
            agreed={agreedVolunteer}
            onPress={() => openAgreement("volunteer")}
            inputBg={inputBg}
            inputStroke={inputStroke}
            mutedText={mutedText}
            textColor={colors.text}
          />
          <AgreementGate
            title="Health & Safety Policy"
            agreed={agreedSafety}
            onPress={() => openAgreement("safety")}
            inputBg={inputBg}
            inputStroke={inputStroke}
            mutedText={mutedText}
            textColor={colors.text}
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Button
          label={
            submitting
              ? "Saving…"
              : bothAgreed
                ? "Agree & continue"
                : "Read both to continue"
          }
          onPress={handleContinue}
          size="lg"
          fullWidth
          icon={bothAgreed ? "checkmark-circle" : undefined}
          iconLeading
          loading={submitting}
          disabled={!bothAgreed}
          // handleContinue fires its own haptic once the guard passes.
          haptic={false}
          style={styles.continueBtn}
        />

        <Pressable
          onPress={handleSignOut}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Not now, sign out"
          accessibilityState={{ disabled: submitting }}
          android_ripple={{
            color: isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.12)",
            borderless: true,
          }}
          style={styles.signOut}
        >
          <ThemedText style={[styles.signOutText, { color: mutedText }]}>
            Not now - sign out
          </ThemedText>
        </Pressable>
      </ScrollView>

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
  container: {
    flex: 1,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  gates: {
    marginTop: 28,
    gap: 12,
  },
  continueBtn: {
    marginTop: 24,
  },
  signOut: {
    alignSelf: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  signOutText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  },
});
