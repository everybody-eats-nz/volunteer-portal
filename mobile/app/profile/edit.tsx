import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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

type FormData = {
  firstName: string;
  lastName: string;
  phone: string;
  pronouns: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  medicalConditions: string;
};

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, refresh } = useProfile();

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    pronouns: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    medicalConditions: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [localImage, setLocalImage] = useState<string | null>(null);

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
      });
      setLocalImage(profile.image ?? null);
      setInitialized(true);
    }
  }, [profile, initialized]);

  const updateField = (key: keyof FormData, value: string) => {
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
          "Please enable camera access in Settings to take a profile photo.",
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
          "Please enable photo library access in Settings to choose a profile photo.",
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(common);
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? "image/jpeg";
    const fileName = asset.fileName ?? `profile-photo.${mimeType.split("/")[1] ?? "jpg"}`;

    const formData = new FormData();
    formData.append("photo", {
      uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    setIsUploadingPhoto(true);
    try {
      const res = await apiUpload<{ image: string }>("/api/mobile/profile/photo", formData);
      setLocalImage(res.image);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Upload failed", "Couldn't update your photo. Please try again.");
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
        },
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
          emergencyContactRelationship: form.emergencyContactRelationship.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
          medicalConditions: form.medicalConditions.trim(),
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.back();
    } catch {
      Alert.alert("Save failed", "Couldn't save your changes. Please try again.");
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
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 },
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
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            accessibilityLabel="Change profile photo"
          >
            {localImage ? (
              <Image source={{ uri: localImage }} style={s.avatarImage} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: Brand.green }]}>
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

        {/* ── Emergency Contact ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            🚨 Emergency Contact
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
      </ScrollView>

      {/* ── Footer ── */}
      <View
        style={[
          s.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          disabled={isSaving}
          style={({ pressed }) => [
            s.footerButtonSecondary,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[s.footerButtonSecondaryText, { color: colors.text }]}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [
            s.footerButtonPrimary,
            {
              backgroundColor: isSaving ? colors.textSecondary : Brand.green,
              opacity: pressed ? 0.9 : 1,
              flex: 1,
            },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={s.footerButtonPrimaryText}>Save Changes</Text>
          )}
        </Pressable>
      </View>
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
    paddingTop: 20,
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

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButtonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonSecondaryText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  footerButtonPrimary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  footerButtonPrimaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
});
