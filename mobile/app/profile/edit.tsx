import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useProfile } from "@/hooks/use-profile";
import { api, apiUpload } from "@/lib/api";
import {
  syncPushTokenWithServer,
  unregisterPushTokenFromServer,
} from "@/lib/push-notifications";

const PUSH_TOKEN_KEY = "push_token";

type FormData = {
  firstName: string;
  lastName: string;
  phone: string;
  pronouns: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  medicalConditions: string;
  notificationPreference: "EMAIL" | "SMS" | "BOTH" | "NONE";
  receiveShortageNotifications: boolean;
  excludedShortageNotificationTypes: string[];
  emailNewsletterSubscription: boolean;
  newsletterLists: string[];
  defaultLocation: string;
};

type ShiftType = { id: string; name: string };
type NewsletterList = {
  id: string;
  name: string;
  campaignMonitorId: string;
  description: string | null;
};

// Map multi-select toggles to/from the database enum
function channelsToPreference(channels: {
  email: boolean;
  sms: boolean;
}): FormData["notificationPreference"] {
  if (channels.email && channels.sms) return "BOTH";
  if (channels.email) return "EMAIL";
  if (channels.sms) return "SMS";
  return "NONE";
}

function preferenceToChannels(pref: FormData["notificationPreference"]): {
  email: boolean;
  sms: boolean;
} {
  return {
    email: pref === "EMAIL" || pref === "BOTH",
    sms: pref === "SMS" || pref === "BOTH",
  };
}

const CHANNEL_OPTIONS: {
  key: "email" | "sms" | "push";
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    key: "email",
    label: "Email",
    hint: "Shift confirmations, updates, and reminders",
    icon: "mail-outline",
  },
  {
    key: "sms",
    label: "Text Message",
    hint: "Quick alerts for shift changes and shortages",
    icon: "chatbubble-outline",
  },
  {
    key: "push",
    label: "Push Notifications",
    hint: "Instant alerts on this device",
    icon: "phone-portrait-outline",
  },
];

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, availableLocations, refresh } = useProfile();

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    pronouns: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    medicalConditions: "",
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    emailNewsletterSubscription: true,
    newsletterLists: [],
    defaultLocation: "",
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [newsletterListOptions, setNewsletterListOptions] = useState<
    NewsletterList[]
  >([]);

  // Fetch shift types and newsletter lists
  useEffect(() => {
    api<ShiftType[]>("/api/mobile/shift-types")
      .then(setShiftTypes)
      .catch(() => {});
    api<NewsletterList[]>("/api/newsletter-lists")
      .then(setNewsletterListOptions)
      .catch(() => {});
  }, []);

  // Push toggle mirrors OS permission + whether this device has a registered
  // token. Re-check on focus so flipping it in iOS Settings is reflected
  // immediately when the user comes back.
  const refreshPushStatus = useCallback(async () => {
    const [{ status }, storedToken] = await Promise.all([
      Notifications.getPermissionsAsync(),
      SecureStore.getItemAsync(PUSH_TOKEN_KEY),
    ]);
    setPushEnabled(status === "granted" && !!storedToken);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPushStatus();
    }, [refreshPushStatus])
  );

  const togglePushNotifications = async () => {
    if (pushBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPushBusy(true);
    try {
      if (pushEnabled) {
        const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
        if (token) {
          await unregisterPushTokenFromServer(token);
          await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
        }
        setPushEnabled(false);
        return;
      }

      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status === "denied" && !canAskAgain) {
        Alert.alert(
          "Enable in Settings",
          "Turn on notifications for Everybody Eats in your device Settings to receive push alerts.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const token = await syncPushTokenWithServer();
      if (token) {
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
        setPushEnabled(true);
      } else {
        setPushEnabled(false);
      }
    } catch {
      Alert.alert(
        "Something went wrong",
        "Couldn't update push notifications. Please try again."
      );
    } finally {
      setPushBusy(false);
    }
  };

  // Populate form once when profile first loads
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (profile && !initialized) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        pronouns: profile.pronouns,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactRelationship: profile.emergencyContactRelationship,
        emergencyContactPhone: profile.emergencyContactPhone,
        medicalConditions: profile.medicalConditions,
        notificationPreference: profile.notificationPreference,
        receiveShortageNotifications: profile.receiveShortageNotifications,
        excludedShortageNotificationTypes:
          profile.excludedShortageNotificationTypes,
        emailNewsletterSubscription: profile.emailNewsletterSubscription,
        newsletterLists: profile.newsletterLists,
        defaultLocation: profile.defaultLocation ?? "",
      });
      setLocalImage(profile.image ?? null);
      setInitialized(true);
    }
  }, [profile, initialized]);

  const updateField = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Photo picker ──

  const pickImage = async (source: "camera" | "library") => {
    const common: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.7,
    };

    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera access needed",
          "Please enable camera access in Settings to take a profile photo."
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync(common);
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photos access needed",
          "Please enable photo library access in Settings to choose a profile photo."
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(common);
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? "image/jpeg";
    const fileName =
      asset.fileName ?? `profile-photo.${mimeType.split("/")[1] ?? "jpg"}`;

    const formData = new FormData();
    formData.append("photo", {
      uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    setIsUploadingPhoto(true);
    try {
      const res = await apiUpload<{ image: string }>(
        "/api/mobile/profile/photo",
        formData
      );
      setLocalImage(res.image);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(
        "Upload failed",
        "Couldn't update your photo. Please try again."
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    setIsUploadingPhoto(true);
    try {
      await api("/api/mobile/profile/photo", { method: "DELETE" });
      setLocalImage(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Failed", "Couldn't remove your photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options = localImage
      ? ["Take Photo", "Choose from Library", "Remove Photo", "Cancel"]
      : ["Take Photo", "Choose from Library", "Cancel"];
    const cancelIndex = options.length - 1;
    const destructiveIndex = localImage ? 2 : undefined;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
          title: "Profile Photo",
        },
        (index) => {
          if (index === 0) pickImage("camera");
          else if (index === 1) pickImage("library");
          else if (index === 2 && localImage) removePhoto();
        }
      );
    } else {
      Alert.alert("Profile Photo", undefined, [
        { text: "Take Photo", onPress: () => pickImage("camera") },
        { text: "Choose from Library", onPress: () => pickImage("library") },
        ...(localImage
          ? [
              {
                text: "Remove Photo",
                style: "destructive" as const,
                onPress: removePhoto,
              },
            ]
          : []),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  // ── Save ──

  const handleSave = async () => {
    if (!form.firstName.trim()) {
      Alert.alert("Required", "First name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await api("/api/mobile/profile", {
        method: "PUT",
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          pronouns: form.pronouns.trim(),
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactRelationship:
            form.emergencyContactRelationship.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
          medicalConditions: form.medicalConditions.trim(),
          notificationPreference: form.notificationPreference,
          receiveShortageNotifications: form.receiveShortageNotifications,
          excludedShortageNotificationTypes:
            form.excludedShortageNotificationTypes,
          emailNewsletterSubscription: form.emailNewsletterSubscription,
          newsletterLists: form.emailNewsletterSubscription
            ? form.newsletterLists
            : [],
          defaultLocation: form.defaultLocation || null,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.back();
    } catch {
      Alert.alert(
        "Save failed",
        "Couldn't save your changes. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <View
        style={[
          s.loadingContainer,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              hitSlop={12}
              style={({ pressed }) => ({
                opacity: isSaving ? 0.5 : pressed ? 0.6 : 1,
                padding: 4,
              })}
              accessibilityLabel="Save changes"
            >
              {isSaving ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#86efac" : Brand.green}
                />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={28}
                  color={isDark ? "#86efac" : Brand.green}
                />
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.content,
          {
            paddingTop: insets.top + 56,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ── */}
        <View style={s.avatarSection}>
          <Pressable
            onPress={showPhotoOptions}
            disabled={isUploadingPhoto}
            style={({ pressed }) => [
              s.avatarContainer,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            accessibilityLabel="Change profile photo"
          >
            {localImage ? (
              <Image source={{ uri: localImage }} style={s.avatarImage} />
            ) : (
              <View
                style={[s.avatarFallback, { backgroundColor: Brand.green }]}
              >
                <Text style={s.avatarInitial}>
                  {form.firstName.charAt(0) || "?"}
                </Text>
              </View>
            )}
            {isUploadingPhoto ? (
              <View style={[s.avatarBadge, { backgroundColor: Brand.green }]}>
                <ActivityIndicator size={14} color="#ffffff" />
              </View>
            ) : (
              <View style={[s.avatarBadge, { backgroundColor: Brand.green }]}>
                <Ionicons name="camera" size={14} color="#ffffff" />
              </View>
            )}
          </Pressable>
          <Pressable onPress={showPhotoOptions} disabled={isUploadingPhoto}>
            <Text
              style={[
                s.changePhotoText,
                { color: isDark ? "#86efac" : Brand.green },
              ]}
            >
              {isUploadingPhoto ? "Uploading..." : "Change Photo"}
            </Text>
          </Pressable>
        </View>

        {/* ── Personal Info ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Personal Details
          </Text>

          <FormField
            label="First Name"
            value={form.firstName}
            onChangeText={(v) => updateField("firstName", v)}
            placeholder="Your first name"
            colors={colors}
            isDark={isDark}
            autoCapitalize="words"
            required
          />
          <FormField
            label="Last Name"
            value={form.lastName}
            onChangeText={(v) => updateField("lastName", v)}
            placeholder="Your last name"
            colors={colors}
            isDark={isDark}
            autoCapitalize="words"
          />
          <FormField
            label="Phone"
            value={form.phone}
            onChangeText={(v) => updateField("phone", v)}
            placeholder="e.g. 021 123 4567"
            colors={colors}
            isDark={isDark}
            keyboardType="phone-pad"
          />
          <FormField
            label="Pronouns"
            value={form.pronouns}
            onChangeText={(v) => updateField("pronouns", v)}
            placeholder="e.g. she/her, he/him, they/them"
            colors={colors}
            isDark={isDark}
          />
        </View>

        {/* ── Default Location ── */}
        {availableLocations.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Default Location
            </Text>
            <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
              Your usual restaurant — we&apos;ll show shifts here first when you
              browse.
            </Text>

            <View
              style={[
                s.nestedSection,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "#f8fafc",
                },
              ]}
            >
              {availableLocations.map((location) => {
                const selected = form.defaultLocation === location;
                return (
                  <Pressable
                    key={location}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateField(
                        "defaultLocation",
                        selected ? "" : location
                      );
                    }}
                    style={s.checkRow}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={
                        selected
                          ? isDark
                            ? "#86efac"
                            : Brand.green
                          : colors.textSecondary
                      }
                    />
                    <Text style={[s.checkLabel, { color: colors.text }]}>
                      {location}
                    </Text>
                  </Pressable>
                );
              })}
              {form.defaultLocation !== "" && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateField("defaultLocation", "");
                  }}
                  style={[s.checkRow, { marginTop: 4 }]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={22}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      s.checkLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Clear default
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Emergency Contact ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Emergency Contact
          </Text>
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Someone we can reach if anything happens during a shift.
          </Text>

          <FormField
            label="Contact Name"
            value={form.emergencyContactName}
            onChangeText={(v) => updateField("emergencyContactName", v)}
            placeholder="Full name"
            colors={colors}
            isDark={isDark}
            autoCapitalize="words"
          />
          <FormField
            label="Relationship"
            value={form.emergencyContactRelationship}
            onChangeText={(v) => updateField("emergencyContactRelationship", v)}
            placeholder="e.g. Partner, Parent, Friend"
            colors={colors}
            isDark={isDark}
            autoCapitalize="words"
          />
          <FormField
            label="Contact Phone"
            value={form.emergencyContactPhone}
            onChangeText={(v) => updateField("emergencyContactPhone", v)}
            placeholder="e.g. 021 765 4321"
            colors={colors}
            isDark={isDark}
            keyboardType="phone-pad"
          />
        </View>

        {/* ── Medical ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Medical Information
          </Text>
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Any conditions, allergies, or requirements we should know about.
          </Text>

          <FormField
            label="Medical Conditions"
            value={form.medicalConditions}
            onChangeText={(v) => updateField("medicalConditions", v)}
            placeholder="e.g. Asthma, allergies, dietary needs"
            colors={colors}
            isDark={isDark}
            multiline
          />
        </View>

        {/* ── Notification Preferences ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Notifications
          </Text>
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Choose how you'd like to hear from us.
          </Text>

          {CHANNEL_OPTIONS.map((ch) => {
            const channels = preferenceToChannels(form.notificationPreference);
            const isPush = ch.key === "push";
            const enabled = isPush
              ? pushEnabled
              : channels[ch.key as "email" | "sms"];
            const showSpinner = isPush && pushBusy;

            return (
              <Pressable
                key={ch.key}
                onPress={() => {
                  if (isPush) {
                    togglePushNotifications();
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const k = ch.key as "email" | "sms";
                  const updated = { ...channels, [k]: !channels[k] };
                  updateField(
                    "notificationPreference",
                    channelsToPreference(updated)
                  );
                }}
                disabled={showSpinner}
                style={s.toggleRow}
              >
                <Ionicons
                  name={ch.icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={
                    enabled
                      ? isDark
                        ? "#86efac"
                        : Brand.green
                      : colors.textSecondary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.toggleLabel, { color: colors.text }]}>
                    {ch.label}
                  </Text>
                  <Text style={[s.toggleHint, { color: colors.textSecondary }]}>
                    {ch.hint}
                  </Text>
                </View>
                {showSpinner ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#86efac" : Brand.green}
                  />
                ) : (
                  <Ionicons
                    name={enabled ? "checkbox" : "square-outline"}
                    size={26}
                    color={
                      enabled
                        ? isDark
                          ? "#86efac"
                          : Brand.green
                        : colors.textSecondary
                    }
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Shortage Notifications ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Shift Shortage Alerts
          </Text>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateField(
                "receiveShortageNotifications",
                !form.receiveShortageNotifications
              );
            }}
            style={s.toggleRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: colors.text }]}>
                Receive shortage notifications
              </Text>
              <Text style={[s.toggleHint, { color: colors.textSecondary }]}>
                Get notified when shifts need more volunteers.
              </Text>
            </View>
            <Ionicons
              name={
                form.receiveShortageNotifications
                  ? "checkbox"
                  : "square-outline"
              }
              size={26}
              color={
                form.receiveShortageNotifications
                  ? isDark
                    ? "#86efac"
                    : Brand.green
                  : colors.textSecondary
              }
            />
          </Pressable>

          {form.receiveShortageNotifications && shiftTypes.length > 0 && (
            <View
              style={[
                s.nestedSection,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "#f8fafc",
                },
              ]}
            >
              <Text style={[s.fieldLabel, { color: colors.text }]}>
                Notify me about these shift types:
              </Text>
              {shiftTypes.map((st) => {
                const included =
                  !form.excludedShortageNotificationTypes.includes(st.id);
                return (
                  <Pressable
                    key={st.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateField(
                        "excludedShortageNotificationTypes",
                        included
                          ? [...form.excludedShortageNotificationTypes, st.id]
                          : form.excludedShortageNotificationTypes.filter(
                              (id) => id !== st.id
                            )
                      );
                    }}
                    style={s.checkRow}
                  >
                    <Ionicons
                      name={included ? "checkbox" : "square-outline"}
                      size={22}
                      color={
                        included
                          ? isDark
                            ? "#86efac"
                            : Brand.green
                          : colors.textSecondary
                      }
                    />
                    <Text style={[s.checkLabel, { color: colors.text }]}>
                      {st.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Newsletter ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Newsletter
          </Text>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const newVal = !form.emailNewsletterSubscription;
              updateField("emailNewsletterSubscription", newVal);
              if (!newVal) {
                updateField("newsletterLists", []);
              }
            }}
            style={s.toggleRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: colors.text }]}>
                Subscribe to our newsletter
              </Text>
              <Text style={[s.toggleHint, { color: colors.textSecondary }]}>
                Updates about events, volunteer opportunities, and news.
              </Text>
            </View>
            <Ionicons
              name={
                form.emailNewsletterSubscription ? "checkbox" : "square-outline"
              }
              size={26}
              color={
                form.emailNewsletterSubscription
                  ? isDark
                    ? "#86efac"
                    : Brand.green
                  : colors.textSecondary
              }
            />
          </Pressable>

          {form.emailNewsletterSubscription &&
            newsletterListOptions.length > 0 && (
              <View
                style={[
                  s.nestedSection,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "#f8fafc",
                  },
                ]}
              >
                <Text style={[s.fieldLabel, { color: colors.text }]}>
                  Choose which lists to subscribe to:
                </Text>
                {newsletterListOptions.map((list) => {
                  const subscribed = form.newsletterLists.includes(
                    list.campaignMonitorId
                  );
                  return (
                    <Pressable
                      key={list.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateField(
                          "newsletterLists",
                          subscribed
                            ? form.newsletterLists.filter(
                                (id) => id !== list.campaignMonitorId
                              )
                            : [...form.newsletterLists, list.campaignMonitorId]
                        );
                      }}
                      style={s.checkRow}
                    >
                      <Ionicons
                        name={subscribed ? "checkbox" : "square-outline"}
                        size={22}
                        color={
                          subscribed
                            ? isDark
                              ? "#86efac"
                              : Brand.green
                            : colors.textSecondary
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.checkLabel, { color: colors.text }]}>
                          {list.name}
                        </Text>
                        {list.description && (
                          <Text
                            style={[
                              s.checkHint,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {list.description}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Form Field Component ── */

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  isDark,
  keyboardType,
  autoCapitalize,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={s.fieldContainer}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>
        {label}
        {required && (
          <Text style={{ color: isDark ? "#fca5a5" : "#dc2626" }}> *</Text>
        )}
      </Text>
      <TextInput
        style={[
          s.fieldInput,
          multiline && s.fieldInputMultiline,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 40,
    fontFamily: FontFamily.bold,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  // Sections
  section: {
    marginBottom: 28,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FontFamily.headingBold,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: -6,
  },

  // Fields
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FontFamily.regular,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  toggleHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },

  // Nested checkbox sections
  nestedSection: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  checkHint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    marginTop: 1,
  },

});
