import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import {
  addFriendErrorMessage,
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
  useAddFriend,
} from "@/hooks/use-add-friend";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useKeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";
import { goBackOrHome } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Add a friend by the email they signed up with, for volunteers who aren't
 * among the suggestions. There is deliberately no search: listing people by
 * name would let anyone browse the volunteer base, so the volunteer has to
 * already know the address.
 */
export default function AddFriendScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const keyboardScroll = useKeyboardAwareScroll();
  const { sendRequest, isSending } = useAddFriend();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Each field is revealed above the keyboard together with everything below
  // it down to Send, so the button never sits hidden under the keyboard.
  const emailGroupRef = useRef<View>(null);
  const messageGroupRef = useRef<View>(null);
  const emailInputRef = useRef<TextInput>(null);
  const messageInputRef = useRef<TextInput>(null);
  const emailReveal = keyboardScroll.inputProps(emailGroupRef);
  const messageReveal = keyboardScroll.inputProps(messageGroupRef);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError("Enter the full email address, like name@example.com.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      emailInputRef.current?.focus();
      return;
    }

    setEmailError(null);
    try {
      await sendRequest({ email: trimmed, message: message.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      posthog?.capture("friend_request_sent", {
        source: "email",
        has_message: message.trim().length > 0,
      });
      setSentTo(trimmed);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setEmailError(addFriendErrorMessage(err));
    }
  };

  const startAnother = () => {
    setEmail("");
    setMessage("");
    setEmailError(null);
    setSentTo(null);
  };

  const inputSurface = {
    color: colors.text,
    backgroundColor: isDark ? colors.surfaceSunk : colors.card,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        {...keyboardScroll.scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 56,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sentTo ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={styles.sent}
            accessibilityLiveRegion="polite"
          >
            <View
              style={[
                styles.sentBadge,
                {
                  backgroundColor: isDark
                    ? "rgba(155,189,160,0.16)"
                    : Brand.greenLight,
                },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={30}
                color={isDark ? Palette.forest200 : Brand.green}
              />
            </View>
            <ThemedText type="display" style={styles.title}>
              Request <ThemedText type="accent">sent</ThemedText>
            </ThemedText>
            <Text style={[styles.lede, { color: colors.textSecondary }]}>
              We’ve let <Text style={{ color: colors.text }}>{sentTo}</Text>{" "}
              know. You’ll be friends once they accept.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Done"
                onPress={goBackOrHome}
                fullWidth
                testID="add-friend-done"
              />
              <Button
                label="Add another friend"
                variant="ghost"
                onPress={startAnother}
                fullWidth
                testID="add-friend-another"
              />
            </View>
          </Animated.View>
        ) : (
          <>
            <View style={styles.header}>
              <ThemedText type="display" style={styles.title}>
                Add a <ThemedText type="accent">friend</ThemedText>
              </ThemedText>
              <Text style={[styles.lede, { color: colors.textSecondary }]}>
                Volunteering with someone who isn’t in your suggestions? Send
                them a request using the email they signed up with.
              </Text>
            </View>

            <View ref={emailGroupRef}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Email</Text>
                <TextInput
                  ref={emailInputRef}
                  style={[
                    styles.input,
                    inputSurface,
                    {
                      borderColor: emailError
                        ? colors.destructive
                        : colors.border,
                    },
                  ]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError(null);
                  }}
                  onFocus={emailReveal.onFocus}
                  onBlur={emailReveal.onBlur}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => messageInputRef.current?.focus()}
                  editable={!isSending}
                  accessibilityLabel={
                    emailError ? `Email. ${emailError}` : "Email"
                  }
                  testID="add-friend-email"
                />
                {emailError && (
                  <View
                    style={styles.errorRow}
                    accessibilityLiveRegion="polite"
                  >
                    <Ionicons
                      name="alert-circle"
                      size={14}
                      color={colors.destructive}
                      style={styles.errorIcon}
                    />
                    <Text
                      style={[styles.errorText, { color: colors.destructive }]}
                      testID="add-friend-error"
                    >
                      {emailError}
                    </Text>
                  </View>
                )}
              </View>

              <View ref={messageGroupRef}>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Message{" "}
                    <Text
                      style={[styles.labelOptional, { color: colors.textSecondary }]}
                    >
                      (optional)
                    </Text>
                  </Text>
                  <TextInput
                    ref={messageInputRef}
                    style={[
                      styles.input,
                      styles.inputMultiline,
                      inputSurface,
                      { borderColor: colors.border },
                    ]}
                    value={message}
                    onChangeText={setMessage}
                    onFocus={messageReveal.onFocus}
                    onBlur={messageReveal.onBlur}
                    placeholder="Kia ora! Keen to volunteer together sometime."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={FRIEND_REQUEST_MESSAGE_MAX_LENGTH}
                    textAlignVertical="top"
                    editable={!isSending}
                    accessibilityLabel="Message, optional"
                    testID="add-friend-message"
                  />
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    They’ll see this with your request.
                  </Text>
                </View>

                <Button
                  label="Send request"
                  onPress={handleSend}
                  loading={isSending}
                  disabled={email.trim().length === 0}
                  fullWidth
                  style={styles.submit}
                  testID="add-friend-submit"
                />
              </View>
            </View>
          </>
        )}
        <Animated.View style={keyboardScroll.spacerStyle} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  header: {
    gap: 10,
    marginBottom: 28,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  lede: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    gap: 6,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  labelOptional: {
    fontFamily: FontFamily.regular,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  submit: {
    marginTop: 8,
  },
  sent: {
    paddingTop: 24,
    gap: 12,
  },
  sentBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actions: {
    gap: 12,
    marginTop: 20,
  },
});
