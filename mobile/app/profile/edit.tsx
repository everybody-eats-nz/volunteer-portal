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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { AgreementGate, AgreementModal } from "@/components/agreement-modal";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import {
  AGREEMENTS,
  type AgreementKey,
  useAgreementPolicies,
} from "@/hooks/use-agreement-policies";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useProfile } from "@/hooks/use-profile";
import { api, ApiError, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { posthog } from "@/lib/posthog";
import { queryKeys } from "@/lib/query-keys";
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
  /** Displayed and edited as DD/MM/YYYY; empty when never provided. */
  dateOfBirth: string;
  volunteerAgreementAccepted: boolean;
  healthSafetyPolicyAccepted: boolean;
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
  friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
  allowFriendRequests: boolean;
  allowFriendSuggestions: boolean;
};

/**
 * Fields a volunteer must fill in before they can sign up for shifts
 * (mirrors isProfileComplete on the server; agreements are handled by the
 * post-login gate and the Agreements section below).
 */
const REQUIRED_FIELDS = [
  "firstName",
  "phone",
  "dateOfBirth",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
type FieldErrors = Partial<Record<RequiredField, string>>;

type VisibilityOption = {
  value: FormData["friendVisibility"];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    value: "PUBLIC",
    label: "Public",
    icon: "people-outline",
    description:
      "Any logged-in volunteer can see your profile, shared shift history, and which shifts you've signed up for.",
  },
  {
    value: "FRIENDS_ONLY",
    label: "Friends only",
    icon: "person-circle-outline",
    description:
      "Only your friends can see your profile, shared shift history, and which shifts you've signed up for.",
  },
  {
    value: "PRIVATE",
    label: "Private",
    icon: "lock-closed-outline",
    description:
      "Your profile is hidden, you won't appear on the browse shifts page, and your shift history is private.",
  },
];

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

// ── Date of birth helpers ──
// Entered as DD/MM/YYYY (NZ convention); stored/sent as ISO YYYY-MM-DD.

function isoToDisplayDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Progressive input mask: digits only, slashes inserted at DD/MM/YYYY. */
function formatDobInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

/**
 * Parse a DD/MM/YYYY string to ISO, or null when invalid. Mirrors the server
 * rule: must be a real calendar date at least 1 year in the past.
 */
function displayDateToIso(display: string): string | null {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!isRealDate || year < 1900) return null;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (date > oneYearAgo) return null;
  return `${yyyy}-${mm}-${dd}`;
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
  const deleteAccount = useAuth((state) => state.deleteAccount);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    pronouns: "",
    dateOfBirth: "",
    volunteerAgreementAccepted: false,
    healthSafetyPolicyAccepted: false,
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
    friendVisibility: "FRIENDS_ONLY",
    allowFriendRequests: true,
    allowFriendSuggestions: true,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
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
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);

  // ── Agreements ──
  // Normally accepted at the post-login gate, but surfaced here too so a
  // volunteer with an unaccepted agreement can read and accept it in place.
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(
    null
  );
  const policies = useAgreementPolicies();

  const openAgreement = (key: AgreementKey) => {
    Haptics.selectionAsync();
    if (!policies.text[key] && !policies.loading[key]) policies.load(key);
    setActiveAgreement(key);
  };
  useEffect(() => {
    if (profile && !initialized) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        pronouns: profile.pronouns,
        dateOfBirth: isoToDisplayDate(profile.dateOfBirth),
        volunteerAgreementAccepted: profile.volunteerAgreementAccepted,
        healthSafetyPolicyAccepted: profile.healthSafetyPolicyAccepted,
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
        friendVisibility: profile.friendVisibility,
        allowFriendRequests: profile.allowFriendRequests,
        allowFriendSuggestions: profile.allowFriendSuggestions,
      });
      setLocalImage(profile.image ?? null);
      setInitialized(true);
    }
  }, [profile, initialized]);

  // ── Required-field validation ──
  // DOB is exempt once locked (already set server-side, shown read-only).
  const dobLocked = Boolean(profile?.dateOfBirth);

  const validateField = (
    key: RequiredField,
    value: string
  ): string | undefined => {
    const trimmed = value.trim();
    switch (key) {
      case "firstName":
        return trimmed ? undefined : "Enter your first name.";
      case "phone":
        return trimmed ? undefined : "Enter a phone number.";
      case "dateOfBirth":
        if (dobLocked) return undefined;
        if (!trimmed) return "Enter your date of birth.";
        return displayDateToIso(trimmed)
          ? undefined
          : "Enter a real past date as DD/MM/YYYY.";
      case "emergencyContactName":
        return trimmed ? undefined : "Enter an emergency contact name.";
      case "emergencyContactPhone":
        return trimmed ? undefined : "Enter their phone number.";
    }
  };

  const updateField = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Reward early: once a field shows an error, re-validate as the user
    // types so the message clears the moment it's fixed.
    if (
      typeof value === "string" &&
      errors[key as RequiredField] !== undefined &&
      (REQUIRED_FIELDS as readonly string[]).includes(key)
    ) {
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key as RequiredField, value),
      }));
    }
  };

  // Punish late: format problems (a half-typed DOB) surface on blur, but
  // required-empty errors wait for the save attempt.
  const handleDobBlur = () => {
    if (!form.dateOfBirth.trim()) return;
    setErrors((prev) => ({
      ...prev,
      dateOfBirth: validateField("dateOfBirth", form.dateOfBirth),
    }));
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
      // Uses the system photo picker (Android Photo Picker / iOS PHPicker),
      // which requires no media-library permission.
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
    // Validate every required field up front and show the problems inline,
    // so it's clear exactly what still needs filling in.
    const validationErrors: FieldErrors = {};
    for (const key of REQUIRED_FIELDS) {
      const error = validateField(key, form[key]);
      if (error) validationErrors[key] = error;
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "A few details still needed",
        "Fill in the highlighted fields — they're required before you can sign up for shifts."
      );
      return;
    }
    setErrors({});

    // DOB is set-once (admins change it after that), so only send it while
    // still unset. Format is already validated above.
    const dateOfBirthIso =
      !dobLocked && form.dateOfBirth.trim()
        ? displayDateToIso(form.dateOfBirth.trim()) ?? undefined
        : undefined;

    setIsSaving(true);
    try {
      await api("/api/mobile/profile", {
        method: "PUT",
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          pronouns: form.pronouns.trim(),
          ...(dateOfBirthIso ? { dateOfBirth: dateOfBirthIso } : {}),
          // One-way: only ever send acceptance, never revoke.
          ...(form.volunteerAgreementAccepted
            ? { volunteerAgreementAccepted: true }
            : {}),
          ...(form.healthSafetyPolicyAccepted
            ? { healthSafetyPolicyAccepted: true }
            : {}),
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
          friendVisibility: form.friendVisibility,
          allowFriendRequests: form.allowFriendRequests,
          allowFriendSuggestions: form.allowFriendSuggestions,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      posthog?.capture("profile_updated", {
        notification_preference: form.notificationPreference,
        has_emergency_contact: !!form.emergencyContactName.trim(),
        has_date_of_birth: dobLocked || !!dateOfBirthIso,
        newsletter_subscribed: form.emailNewsletterSubscription,
      });
      await refresh();
      // Signup eligibility on shift screens depends on profile completion —
      // refetch so a just-completed profile unlocks the signup CTA.
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
      router.back();
    } catch (err) {
      Alert.alert(
        "Save failed",
        err instanceof ApiError
          ? err.message
          : "Couldn't save your changes. Please try again."
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
                  color={isDark ? Palette.forest200 : Brand.green}
                />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={28}
                  color={isDark ? Palette.forest200 : Brand.green}
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
                <ActivityIndicator size={14} color={Palette.cream50} />
              </View>
            ) : (
              <View style={[s.avatarBadge, { backgroundColor: Brand.green }]}>
                <Ionicons name="camera" size={14} color={Palette.cream50} />
              </View>
            )}
          </Pressable>
          <Pressable onPress={showPhotoOptions} disabled={isUploadingPhoto}>
            <Text
              style={[
                s.changePhotoText,
                { color: isDark ? Palette.forest200 : Brand.green },
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
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Fields marked * are needed before you can sign up for shifts.
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
            error={errors.firstName}
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
            required
            error={errors.phone}
          />
          {profile.dateOfBirth ? (
            <View style={s.fieldContainer}>
              <Text style={[s.fieldLabel, { color: colors.text }]}>
                Date of Birth
              </Text>
              <View
                style={[
                  s.fieldInput,
                  s.lockedField,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark
                      ? colors.surfaceSunk
                      : colors.surfaceSoft,
                  },
                ]}
                accessibilityLabel={`Date of birth: ${isoToDisplayDate(
                  profile.dateOfBirth
                )}. Contact the team to change it.`}
              >
                <Text
                  style={[s.lockedFieldText, { color: colors.textSecondary }]}
                >
                  {isoToDisplayDate(profile.dateOfBirth)}
                </Text>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[s.fieldHint, { color: colors.textSecondary }]}>
                Contact the Everybody Eats team if this needs changing.
              </Text>
            </View>
          ) : (
            <View style={s.fieldContainer}>
              <FormField
                label="Date of Birth"
                value={form.dateOfBirth}
                onChangeText={(v) =>
                  updateField("dateOfBirth", formatDobInput(v))
                }
                onBlur={handleDobBlur}
                placeholder="DD/MM/YYYY"
                colors={colors}
                isDark={isDark}
                keyboardType="number-pad"
                required
                error={errors.dateOfBirth}
              />
              <Text style={[s.fieldHint, { color: colors.textSecondary }]}>
                We ask so we can look after volunteers under 16. It can only be
                set once.
              </Text>
            </View>
          )}
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

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setLocationSheetVisible(true);
              }}
              style={({ pressed }) => [
                s.locationSelector,
                {
                  backgroundColor: isDark ? colors.surfaceSunk : colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                form.defaultLocation
                  ? `Default location: ${form.defaultLocation}. Tap to change.`
                  : "No default location. Tap to choose."
              }
            >
              <Ionicons
                name={form.defaultLocation ? "location" : "location-outline"}
                size={18}
                color={
                  form.defaultLocation
                    ? isDark
                      ? Palette.forest200
                      : Brand.green
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  s.locationSelectorText,
                  {
                    color: form.defaultLocation
                      ? colors.text
                      : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {form.defaultLocation || "No default set"}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
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
            required
            error={errors.emergencyContactName}
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
            required
            error={errors.emergencyContactPhone}
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
            Choose how you’d like to hear from us.
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
                        ? Palette.forest200
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
                    color={isDark ? Palette.forest200 : Brand.green}
                  />
                ) : (
                  <Ionicons
                    name={enabled ? "checkbox" : "square-outline"}
                    size={26}
                    color={
                      enabled
                        ? isDark
                          ? Palette.forest200
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
                    ? Palette.forest200
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
                  backgroundColor: isDark ? colors.surfaceSunk : colors.surfaceSoft,
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
                            ? Palette.forest200
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
                    ? Palette.forest200
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
                    backgroundColor: isDark ? colors.surfaceSunk : colors.surfaceSoft,
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
                              ? Palette.forest200
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

        {/* ── Privacy ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Privacy</Text>
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Control who can see your profile and shift activity.
          </Text>

          <Text style={[s.fieldLabel, { color: colors.text }]}>
            Who can see your volunteer activity?
          </Text>
          <View style={{ gap: 8 }}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = form.friendVisibility === opt.value;
              const activeColor = isDark ? Palette.forest200 : Brand.green;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    updateField("friendVisibility", opt.value);
                  }}
                  style={({ pressed }) => [
                    s.visibilityOption,
                    {
                      borderColor: active ? activeColor : colors.border,
                      backgroundColor: active
                        ? isDark
                          ? "rgba(155,189,160,0.10)"
                          : colors.primaryLight
                        : pressed
                        ? isDark
                          ? colors.surfaceSoft
                          : colors.surfaceSoft
                        : isDark
                        ? colors.surfaceSunk
                        : colors.card,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label}. ${opt.description}`}
                >
                  <View style={s.visibilityHeader}>
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={active ? activeColor : colors.textSecondary}
                    />
                    <Text
                      style={[
                        s.visibilityLabel,
                        {
                          color: active ? activeColor : colors.text,
                          fontFamily: active
                            ? FontFamily.semiBold
                            : FontFamily.medium,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={active ? activeColor : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      s.visibilityDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {opt.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateField("allowFriendRequests", !form.allowFriendRequests);
            }}
            style={s.toggleRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: colors.text }]}>
                Allow friend requests
              </Text>
              <Text style={[s.toggleHint, { color: colors.textSecondary }]}>
                Other volunteers can send you friend requests.
              </Text>
            </View>
            <Ionicons
              name={form.allowFriendRequests ? "checkbox" : "square-outline"}
              size={26}
              color={
                form.allowFriendRequests
                  ? isDark
                    ? Palette.forest200
                    : Brand.green
                  : colors.textSecondary
              }
            />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateField(
                "allowFriendSuggestions",
                !form.allowFriendSuggestions
              );
            }}
            style={s.toggleRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: colors.text }]}>
                Appear in friend suggestions
              </Text>
              <Text style={[s.toggleHint, { color: colors.textSecondary }]}>
                Show up as a suggested friend for volunteers you&apos;ve
                recently worked with.
              </Text>
            </View>
            <Ionicons
              name={form.allowFriendSuggestions ? "checkbox" : "square-outline"}
              size={26}
              color={
                form.allowFriendSuggestions
                  ? isDark
                    ? Palette.forest200
                    : Brand.green
                  : colors.textSecondary
              }
            />
          </Pressable>
        </View>

        {/* ── Agreements ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Agreements
          </Text>
          <Text style={[s.sectionHint, { color: colors.textSecondary }]}>
            Both are required before you can sign up for shifts. Tap one to
            read it{form.volunteerAgreementAccepted &&
            form.healthSafetyPolicyAccepted
              ? " again"
              : " and agree"}
            .
          </Text>

          <AgreementGate
            title="Volunteer Agreement"
            agreed={form.volunteerAgreementAccepted}
            onPress={() => openAgreement("volunteer")}
            inputBg={isDark ? "rgba(255,255,255,0.06)" : "rgba(14,58,35,0.04)"}
            inputStroke={
              isDark ? "rgba(255,255,255,0.10)" : "rgba(14,58,35,0.12)"
            }
            mutedText={colors.textSecondary}
            textColor={colors.text}
          />
          <AgreementGate
            title="Health & Safety Policy"
            agreed={form.healthSafetyPolicyAccepted}
            onPress={() => openAgreement("safety")}
            inputBg={isDark ? "rgba(255,255,255,0.06)" : "rgba(14,58,35,0.04)"}
            inputStroke={
              isDark ? "rgba(255,255,255,0.10)" : "rgba(14,58,35,0.12)"
            }
            mutedText={colors.textSecondary}
            textColor={colors.text}
          />
        </View>

        {/* ── Danger zone ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.destructive }]}>
            Danger zone
          </Text>
          <View
            style={[
              s.dangerCard,
              {
                borderColor: colors.destructive,
                backgroundColor: isDark
                  ? "rgba(239,68,68,0.06)"
                  : "rgba(220,38,38,0.04)",
              },
            ]}
          >
            <View style={s.dangerHeader}>
              <Ionicons
                name="warning-outline"
                size={20}
                color={colors.destructive}
              />
              <Text style={[s.dangerTitle, { color: colors.text }]}>
                Delete account
              </Text>
            </View>
            <Text style={[s.dangerBody, { color: colors.textSecondary }]}>
              Permanently delete your account, shift history, achievements, and
              friendships. This can’t be undone.
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  "Delete your account?",
                  "This will permanently delete your account, your shift history, achievements, friendships, and all other data. This can't be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete account",
                      style: "destructive",
                      onPress: () => {
                        Alert.alert(
                          "Are you absolutely sure?",
                          "Your account and all your data will be removed immediately. There's no way to recover it.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete forever",
                              style: "destructive",
                              onPress: async () => {
                                try {
                                  await deleteAccount();
                                } catch (error) {
                                  const message =
                                    error instanceof ApiError
                                      ? error.message
                                      : "Something went wrong. Please try again or email us for help.";
                                  Alert.alert(
                                    "Couldn't delete account",
                                    message
                                  );
                                }
                              },
                            },
                          ]
                        );
                      },
                    },
                  ]
                );
              }}
              style={({ pressed }) => [
                s.dangerButton,
                {
                  borderColor: colors.destructive,
                  backgroundColor: pressed
                    ? isDark
                      ? "rgba(239,68,68,0.16)"
                      : "rgba(220,38,38,0.1)"
                    : "transparent",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.destructive}
              />
              <Text
                style={[s.dangerButtonText, { color: colors.destructive }]}
              >
                Delete my account
              </Text>
            </Pressable>
          </View>
        </View>
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
          onAgree={() => {
            updateField(
              activeAgreement === "volunteer"
                ? "volunteerAgreementAccepted"
                : "healthSafetyPolicyAccepted",
              true
            );
            setActiveAgreement(null);
          }}
        />
      )}

      <DefaultLocationSheet
        visible={locationSheetVisible}
        locations={availableLocations}
        selected={form.defaultLocation}
        onSelect={(value) => {
          Haptics.selectionAsync();
          updateField("defaultLocation", value);
          setLocationSheetVisible(false);
        }}
        onClose={() => setLocationSheetVisible(false)}
        isDark={isDark}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

/* ── Default Location Picker Sheet ── */

function DefaultLocationSheet({
  visible,
  locations,
  selected,
  onSelect,
  onClose,
  isDark,
  colors,
}: {
  visible: boolean;
  locations: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  isDark: boolean;
  colors: (typeof Colors)["light"];
}) {
  const insets = useSafeAreaInsets();
  const items: {
    key: string;
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "none", label: "No default", value: "", icon: "close-circle-outline" },
    ...locations.map((loc) => ({
      key: loc,
      label: loc,
      value: loc,
      icon: "location" as const,
    })),
  ];

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          s.sheetPage,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={s.sheetHandleWrap}>
          <View
            style={[
              s.sheetHandle,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.15)",
              },
            ]}
          />
        </View>

        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sheetTitle, { color: colors.text }]}>
              Default location
            </Text>
            <Text
              style={[s.sheetSubtitle, { color: colors.textSecondary }]}
            >
              Pick your usual restaurant
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close"
            accessibilityRole="button"
            style={({ pressed }) => [
              s.sheetClose,
              {
                backgroundColor: isDark
                  ? "rgba(253,248,239,0.08)"
                  : colors.surfaceSunk,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const active = item.value === selected;
            const activeColor = isDark ? Palette.forest200 : Brand.green;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.value)}
                style={({ pressed }) => [
                  s.sheetItem,
                  {
                    backgroundColor: active
                      ? isDark
                        ? "rgba(155,189,160,0.12)"
                        : colors.primaryLight
                      : pressed
                      ? isDark
                        ? colors.surfaceSoft
                        : colors.surfaceSoft
                      : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? activeColor : colors.textSecondary}
                />
                <Text
                  style={[
                    s.sheetItemText,
                    {
                      color: active ? activeColor : colors.text,
                      fontFamily: active
                        ? FontFamily.semiBold
                        : FontFamily.regular,
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {active && (
                  <Ionicons name="checkmark" size={18} color={activeColor} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Form Field Component ── */

function FormField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  colors,
  isDark,
  keyboardType,
  autoCapitalize,
  multiline,
  required,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean;
  required?: boolean;
  /** Validation message shown below the input; also tints the border. */
  error?: string;
}) {
  return (
    <View style={s.fieldContainer}>
      <Text style={[s.fieldLabel, { color: colors.text }]}>
        {label}
        {required && (
          <Text style={{ color: colors.destructive }}> *</Text>
        )}
      </Text>
      <TextInput
        style={[
          s.fieldInput,
          multiline && s.fieldInputMultiline,
          {
            color: colors.text,
            borderColor: error ? colors.destructive : colors.border,
            backgroundColor: isDark ? colors.surfaceSunk : colors.card,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        accessibilityLabel={
          error ? `${label}. ${error}` : required ? `${label}, required` : label
        }
      />
      {error && (
        <View style={s.fieldErrorRow} accessibilityLiveRegion="polite">
          <Ionicons
            name="alert-circle"
            size={13}
            color={colors.destructive}
          />
          <Text style={[s.fieldErrorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      )}
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
    color: Palette.cream50,
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
    borderColor: Palette.cream50,
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
    fontSize: 19,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
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
  fieldHint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  fieldErrorText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FontFamily.medium,
    lineHeight: 17,
  },
  lockedField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  lockedFieldText: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
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

  // Default location selector
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationSelectorText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
  },

  // Default location sheet
  sheetPage: { flex: 1 },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.2,
    lineHeight: 26,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetList: {
    paddingHorizontal: 12,
    gap: 2,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
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

  // Privacy
  visibilityOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  visibilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  visibilityLabel: {
    flex: 1,
    fontSize: 15,
  },
  visibilityDescription: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    paddingLeft: 30,
  },

  // Danger zone
  dangerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dangerTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  dangerBody: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    marginTop: 4,
  },
  dangerButtonText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

});
