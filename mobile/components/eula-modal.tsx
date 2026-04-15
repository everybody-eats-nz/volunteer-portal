import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const EULA_STORAGE_KEY = "eula_accepted_v1";

const TERMS_SECTIONS = [
  {
    title: "1. Community Standards",
    body: "Everybody Eats is a whānau community. We expect all volunteers to treat each other with kindness and respect. Objectionable, offensive, or abusive content is not tolerated and will result in removal from the platform.",
  },
  {
    title: "2. User-Generated Content",
    body: "By using this app you may post comments and interact with other volunteers' activity. You are responsible for the content you post. Content must not be harmful, threatening, hateful, sexually explicit, or otherwise objectionable.",
  },
  {
    title: "3. Reporting & Moderation",
    body: "You can flag any content or block any user at any time. Reports are reviewed by the Everybody Eats team within 24 hours. Confirmed violations result in content removal and potential account suspension.",
  },
  {
    title: "4. Blocking",
    body: "You may block any user to immediately remove their content from your feed. The Everybody Eats team is notified of blocks and will investigate where appropriate.",
  },
  {
    title: "5. Privacy",
    body: "Your data is handled in accordance with our Privacy Policy. Your volunteer activity (shifts, achievements) is visible to friends you approve. You control your visibility settings in your profile.",
  },
  {
    title: "6. Enforcement",
    body: "Everybody Eats reserves the right to remove content or suspend accounts that violate these terms without prior notice. We are committed to maintaining a safe environment for all volunteers.",
  },
];

interface EulaModalProps {
  onAccepted: () => void;
}

export function EulaModal({ onAccepted }: EulaModalProps) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  useEffect(() => {
    SecureStore.getItemAsync(EULA_STORAGE_KEY)
      .then((value) => {
        if (value === "true") {
          onAccepted();
        } else {
          setVisible(true);
        }
      })
      .catch(() => {
        // On error, show the modal to be safe
        setVisible(true);
      })
      .finally(() => setChecking(false));
  }, [onAccepted]);

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await SecureStore.setItemAsync(EULA_STORAGE_KEY, "true").catch(() => {});
    setVisible(false);
    onAccepted();
  };

  const handleDecline = () => {
    Alert.alert(
      "Terms Required",
      "You need to agree to the Terms of Use to access Everybody Eats. These terms help keep our community safe for all volunteers.",
      [
        { text: "Review Terms", style: "cancel" },
      ]
    );
  };

  if (checking || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDecline}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: Platform.OS === "ios" ? insets.top + 8 : 24,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.logoCircle,
              { backgroundColor: isDark ? Brand.greenDark : Brand.greenLight },
            ]}
          >
            <Text style={styles.logoEmoji}>🌿</Text>
          </View>
          <Text
            style={[
              styles.title,
              { color: colors.text, fontFamily: FontFamily.headingBold },
            ]}
          >
            Before you join the whānau
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary, fontFamily: FontFamily.regular },
            ]}
          >
            Please read and agree to our Terms of Use to access the Everybody
            Eats volunteer community.
          </Text>
        </View>

        {/* Terms content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.termsBox,
              {
                backgroundColor: isDark ? "#1a1d21" : "#f8faf8",
                borderColor: colors.border,
              },
            ]}
          >
            {TERMS_SECTIONS.map((section, i) => (
              <View
                key={section.title}
                style={[
                  styles.section,
                  i < TERMS_SECTIONS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.text,
                      fontFamily: FontFamily.semiBold,
                    },
                  ]}
                >
                  {section.title}
                </Text>
                <Text
                  style={[
                    styles.sectionBody,
                    {
                      color: colors.textSecondary,
                      fontFamily: FontFamily.regular,
                    },
                  ]}
                >
                  {section.body}
                </Text>
              </View>
            ))}
          </View>

          <Text
            style={[
              styles.zeroTolerance,
              { color: isDark ? "#fbbf24" : "#92400e", fontFamily: FontFamily.semiBold },
            ]}
          >
            Zero tolerance for objectionable content or abusive behaviour.
          </Text>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleAccept}
            style={({ pressed }) => [
              styles.acceptBtn,
              { backgroundColor: Brand.green, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityLabel="Agree to Terms of Use"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.acceptBtnText,
                { fontFamily: FontFamily.semiBold },
              ]}
            >
              I Agree — Join the Whānau 💚
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDecline}
            style={({ pressed }) => [
              styles.declineBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityLabel="Decline Terms of Use"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.declineBtnText,
                {
                  color: colors.textSecondary,
                  fontFamily: FontFamily.regular,
                },
              ]}
            >
              Not now
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 12,
  },
  termsBox: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  section: {
    padding: 14,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  zeroTolerance: {
    textAlign: "center",
    fontSize: 13,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actions: {
    gap: 10,
    paddingTop: 16,
  },
  acceptBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  acceptBtnText: {
    color: "#ffffff",
    fontSize: 16,
  },
  declineBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  declineBtnText: {
    fontSize: 14,
  },
});
