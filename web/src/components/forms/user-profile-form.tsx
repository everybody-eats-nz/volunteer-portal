"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { PolicyContent } from "@/components/markdown-content";
import { ProfileImageUpload } from "@/components/ui/profile-image-upload";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Shield,
  FileText,
  ExternalLink,
  Bell,
  CalendarIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PasswordRequirements } from "@/components/password-requirements";

// Shared constants
export const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export const pronounOptions = [
  { value: "none", label: "Prefer not to say" },
  { value: "she/her", label: "She/Her" },
  { value: "he/him", label: "He/Him" },
  { value: "they/them", label: "They/Them" },
  { value: "other", label: "Other" },
];

export const notificationOptions = [
  { value: "EMAIL", label: "Email only" },
  { value: "SMS", label: "Text message only" },
  { value: "BOTH", label: "Both email and text" },
  { value: "NONE", label: "No notifications" },
];

export const hearAboutUsOptions = [
  { value: "not_specified", label: "Select an option" },
  { value: "social_media", label: "Social Media" },
  { value: "friend_family", label: "Friend or Family" },
  { value: "website", label: "Website" },
  { value: "search_engine", label: "Search Engine" },
  { value: "community_event", label: "Community Event" },
  { value: "volunteer_center", label: "Volunteer Center" },
  { value: "other", label: "Other" },
];

export interface UserProfileFormData {
  // Basic account info (for registration only)
  email?: string;
  password?: string;
  confirmPassword?: string;

  // Personal information
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  pronouns: string;
  customPronouns?: string;
  profilePhotoUrl?: string;

  // Emergency contact
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;

  // Medical & references
  medicalConditions: string;
  willingToProvideReference: boolean;
  howDidYouHearAboutUs: string;
  customHowDidYouHearAboutUs?: string;

  // Availability
  availableDays: string[];
  availableLocations: string[];

  // Communication & agreements
  emailNewsletterSubscription: boolean;
  notificationPreference: "EMAIL" | "SMS" | "BOTH" | "NONE";
  receiveShortageNotifications: boolean;
  excludedShortageNotificationTypes: string[];
  volunteerAgreementAccepted: boolean;
  healthSafetyPolicyAccepted: boolean;
}

export interface UserProfileFormProps {
  formData: UserProfileFormData;
  onInputChange: (
    field: string,
    value: string | boolean | string[] | number
  ) => void;
  onDayToggle: (day: string) => void;
  onLocationToggle: (location: string) => void;
  loading: boolean;
  isRegistration?: boolean;
  locationOptions: Array<{ value: string; label: string }>;
  toast?: (options: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

/**
 * Account creation step for registration
 */
export function AccountStep({
  formData,
  onInputChange,
  loading,
  hideEmail = false,
}: {
  formData: UserProfileFormData;
  onInputChange: (field: string, value: string | boolean) => void;
  loading: boolean;
  hideEmail?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  return (
    <div className="space-y-6" data-testid="account-step">
      {!hideEmail && (
        <div className="space-y-2" data-testid="email-field">
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => onInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            disabled={loading}
            className="h-11"
            required
            data-testid="email-input"
          />
        </div>
      )}

      <div className="space-y-2" data-testid="password-field">
        <Label htmlFor="password" className="text-sm font-medium">
          Password *
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={formData.password || ""}
            onChange={(e) => onInputChange("password", e.target.value)}
            placeholder="Create a secure password"
            disabled={loading}
            className="h-11 pr-10"
            required
            data-testid="password-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="toggle-password-visibility"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <PasswordRequirements password={formData.password || ""} />
      </div>

      <div className="space-y-2" data-testid="confirm-password-field">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm Password *
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={formData.confirmPassword || ""}
            onChange={(e) => onInputChange("confirmPassword", e.target.value)}
            placeholder="Confirm your password"
            disabled={loading}
            className="h-11 pr-10"
            required
            data-testid="confirm-password-input"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="toggle-confirm-password-visibility"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {formData.confirmPassword && formData.password && (
          <div
            className="flex items-center gap-2 text-xs"
            data-testid="password-match-check"
          >
            {formData.password === formData.confirmPassword ? (
              <svg className="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span
              className={
                formData.password === formData.confirmPassword
                  ? "text-green-600"
                  : "text-red-500"
              }
            >
              {formData.password === formData.confirmPassword
                ? "Passwords match"
                : "Passwords do not match"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Personal information step
 */
export function PersonalInfoStep({
  formData,
  onInputChange,
  loading,
  isRegistration = false,
  toast,
}: {
  formData: UserProfileFormData;
  onInputChange: (field: string, value: string | boolean) => void;
  loading: boolean;
  isRegistration?: boolean;
  toast?: (options: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}) {
  const dateOfBirth = formData.dateOfBirth
    ? new Date(formData.dateOfBirth)
    : undefined;
  const [dobOpen, setDobOpen] = React.useState(false);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-medium">
            First Name *
          </Label>
          <Input
            id="firstName"
            data-testid="first-name-input"
            value={formData.firstName}
            onChange={(e) => onInputChange("firstName", e.target.value)}
            placeholder="Your first name"
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-sm font-medium">
            Last Name *
          </Label>
          <Input
            id="lastName"
            data-testid="last-name-input"
            value={formData.lastName}
            onChange={(e) => onInputChange("lastName", e.target.value)}
            placeholder="Your last name"
            disabled={loading}
            required
          />
        </div>
      </div>

      {!isRegistration && (
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => onInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            disabled={loading}
            data-testid="pronouns-select"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium">
          Mobile Number *
        </Label>
        <Input
          id="phone"
          data-testid="phone-input"
          type="tel"
          value={formData.phone}
          onChange={(e) => onInputChange("phone", e.target.value)}
          placeholder="0211234567"
          disabled={loading}
          className="h-11"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className="text-sm font-medium">
            Date of Birth *
          </Label>
          <Popover open={dobOpen} onOpenChange={setDobOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-11",
                  !dateOfBirth && "text-muted-foreground"
                )}
                disabled={loading}
                data-testid="date-of-birth-input"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateOfBirth ? (
                  format(dateOfBirth, "PPP")
                ) : (
                  <span>Select your date of birth</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfBirth}
                onSelect={(date) => {
                  onInputChange(
                    "dateOfBirth",
                    date ? format(date, "yyyy-MM-dd") : ""
                  );
                  setDobOpen(false);
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date >= today || loading;
                }}
                captionLayout="dropdown"
                fromYear={1900}
                toYear={new Date().getFullYear()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pronouns" className="text-sm font-medium">
            Pronouns
          </Label>
          <SelectField
            name="pronouns"
            id="pronouns"
            options={pronounOptions}
            defaultValue={formData.pronouns}
            disabled={loading}
            data-testid="pronouns-select"
          />
          {formData.pronouns === "other" && (
            <div className="mt-2">
              <Input
                id="customPronouns"
                value={formData.customPronouns || ""}
                onChange={(e) =>
                  onInputChange("customPronouns", e.target.value)
                }
                placeholder="Please specify your pronouns"
                disabled={loading}
                data-testid="custom-pronouns-input"
              />
            </div>
          )}
        </div>
      </div>

      {/* Parental Consent for Minors */}
      {isRegistration &&
        dateOfBirth &&
        (() => {
          const today = new Date();
          const age = today.getFullYear() - dateOfBirth.getFullYear();
          const hasHadBirthdayThisYear =
            today.getMonth() > dateOfBirth.getMonth() ||
            (today.getMonth() === dateOfBirth.getMonth() &&
              today.getDate() >= dateOfBirth.getDate());
          const actualAge = hasHadBirthdayThisYear ? age : age - 1;

          if (actualAge < 18) {
            return (
              <div
                className="space-y-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                data-testid="parental-consent-notice"
              >
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Parental Consent Required
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      Since you are under 18, we require a signed parental
                      consent form before you can volunteer.
                    </p>
                  </div>
                </div>
                <div className="ml-8 space-y-3">
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                      onClick={() => {
                        window.open("/parental-consent-form.pdf", "_blank");
                      }}
                      data-testid="download-consent-form-button"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download Consent Form
                    </Button>
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    <p className="font-medium mb-2">
                      You can continue registering now - parental consent can be
                      submitted separately:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Complete your registration below</li>
                      <li>Download the parental consent form above</li>
                      <li>
                        Print and have your parent/guardian complete and sign it
                      </li>
                      <li>
                        Email the signed form to:{" "}
                        <strong>volunteers@everybodyeats.nz</strong>
                      </li>
                      <li>
                        We&apos;ll approve your profile once we receive the
                        consent form
                      </li>
                      <li>Please allow up to 10 days for approval</li>
                    </ol>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

      <div className="space-y-2">
        <Label htmlFor="profilePhoto" className="text-sm font-medium">
          Profile Photo {isRegistration ? "*" : ""}
        </Label>
        <ProfileImageUpload
          currentImage={formData.profilePhotoUrl}
          onImageChange={(url: string | null) =>
            onInputChange("profilePhotoUrl", url || "")
          }
          disabled={loading}
          toast={toast}
          fallbackText={
            formData.firstName && formData.lastName
              ? `${formData.firstName.charAt(0)}${formData.lastName.charAt(
                  0
                )}`.toUpperCase()
              : "?"
          }
          required={isRegistration}
        />
        {isRegistration && (
          <p className="text-xs text-muted-foreground">
            A profile photo is required for all volunteer accounts
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Emergency contact step
 */
export function EmergencyContactStep({
  formData,
  onInputChange,
  loading,
}: {
  formData: UserProfileFormData;
  onInputChange: (field: string, value: string | boolean) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">Important</h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This information is kept confidential and used only in case of
              emergencies during volunteer activities.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactName" className="text-sm font-medium">
          Emergency Contact Name
        </Label>
        <Input
          id="emergencyContactName"
          data-testid="emergency-contact-name-input"
          value={formData.emergencyContactName}
          onChange={(e) =>
            onInputChange("emergencyContactName", e.target.value)
          }
          placeholder="Full name of emergency contact"
          disabled={loading}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="emergencyContactRelationship"
          className="text-sm font-medium"
        >
          Relationship
        </Label>
        <Input
          id="emergencyContactRelationship"
          data-testid="emergency-contact-relationship-input"
          value={formData.emergencyContactRelationship}
          onChange={(e) =>
            onInputChange("emergencyContactRelationship", e.target.value)
          }
          placeholder="e.g., Parent, Spouse, Sibling, Friend"
          disabled={loading}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactPhone" className="text-sm font-medium">
          Emergency Contact Mobile
        </Label>
        <Input
          id="emergencyContactPhone"
          data-testid="emergency-contact-phone-input"
          type="tel"
          value={formData.emergencyContactPhone}
          onChange={(e) =>
            onInputChange("emergencyContactPhone", e.target.value)
          }
          placeholder="0211234567"
          disabled={loading}
          className="h-11"
        />
      </div>
    </div>
  );
}

/**
 * Medical information and references step
 */
export function MedicalInfoStep({
  formData,
  onInputChange,
  loading,
}: {
  formData: UserProfileFormData;
  onInputChange: (field: string, value: string | boolean) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="medicalConditions" className="text-sm font-medium">
          Medical Conditions & Allergies
        </Label>
        <Textarea
          id="medicalConditions"
          data-testid="medical-conditions-textarea"
          value={formData.medicalConditions}
          onChange={(e) => onInputChange("medicalConditions", e.target.value)}
          placeholder="Please list any medical conditions, allergies, or dietary restrictions that may be relevant to your volunteer work. Leave blank if none."
          disabled={loading}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          This information helps us ensure your safety and accommodate any
          special needs.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-lg border border-border bg-muted/20">
          <Label className="flex items-start space-x-3 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={formData.willingToProvideReference}
              onCheckedChange={(checked) =>
                onInputChange("willingToProvideReference", checked)
              }
              disabled={loading}
              className="mt-1"
            />
            <div>
              <span>I am willing to provide references if requested</span>
              <p className="text-xs text-muted-foreground mt-1 font-normal">
                References may be requested for certain volunteer positions or
                activities.
              </p>
            </div>
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="howDidYouHearAboutUs" className="text-sm font-medium">
          How did you hear about us? *
        </Label>
        <SelectField
          name="howDidYouHearAboutUs"
          id="howDidYouHearAboutUs"
          options={hearAboutUsOptions}
          defaultValue={formData.howDidYouHearAboutUs}
          disabled={loading}
          className="h-11"
          data-testid="how-did-you-hear-select"
        />
        
        {formData.howDidYouHearAboutUs === "other" && (
          <div className="mt-3">
            <Input
              id="customHowDidYouHearAboutUs"
              data-testid="custom-how-did-you-hear-input"
              value={formData.customHowDidYouHearAboutUs || ""}
              onChange={(e) => onInputChange("customHowDidYouHearAboutUs", e.target.value)}
              placeholder="Please specify how you heard about us"
              disabled={loading}
              className="h-11"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Availability selection step
 */
export function AvailabilityStep({
  formData,
  onDayToggle,
  onLocationToggle,
  loading,
  locationOptions,
}: {
  formData: UserProfileFormData;
  onDayToggle: (day: string) => void;
  onLocationToggle: (location: string) => void;
  loading: boolean;
  locationOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Days you&apos;re typically available
          </Label>
          <p className="text-xs text-muted-foreground mb-4">
            Select the days you&apos;re generally available to volunteer. This
            helps us match you with suitable shifts.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {daysOfWeek.map((day) => (
            <div
              key={day.value}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.availableDays.includes(day.value)
                  ? "bg-primary/10 border-primary"
                  : "bg-background border-border hover:bg-muted/50"
              }`}
            >
              <Label
                data-testid={`available-day-${day.value}-label`}
                className="flex items-center space-x-3 text-sm font-medium cursor-pointer"
              >
                <Checkbox
                  checked={formData.availableDays.includes(day.value)}
                  onCheckedChange={() => onDayToggle(day.value)}
                  disabled={loading}
                  data-testid={`available-day-${day.value}`}
                />
                <span>{day.label}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Locations where you can volunteer
          </Label>
          <p className="text-xs text-muted-foreground mb-4">
            Choose the locations where you can volunteer. You can select
            multiple options.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {locationOptions.map((location) => (
            <div
              key={location.value}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.availableLocations.includes(location.value)
                  ? "bg-primary/10 border-primary"
                  : "bg-background border-border hover:bg-muted/50"
              }`}
            >
              <Label
                data-testid={`available-location-${location.value.toLowerCase()}-label`}
                className="flex items-center space-x-3 text-sm font-medium cursor-pointer"
              >
                <Checkbox
                  checked={formData.availableLocations.includes(location.value)}
                  onCheckedChange={() => onLocationToggle(location.value)}
                  disabled={loading}
                  data-testid={`available-location-${location.value.toLowerCase()}`}
                />
                <span>{location.label}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Communication preferences and agreements step
 */
export function CommunicationStep({
  formData,
  onInputChange,
  loading,
  volunteerAgreementContent,
  healthSafetyPolicyContent,
  volunteerAgreementOpen,
  setVolunteerAgreementOpen,
  healthSafetyPolicyOpen,
  setHealthSafetyPolicyOpen,
  shiftTypes = [],
}: {
  formData: UserProfileFormData;
  onInputChange: (
    field: string,
    value: string | boolean | string[] | number
  ) => void;
  loading: boolean;
  volunteerAgreementContent: string;
  healthSafetyPolicyContent: string;
  volunteerAgreementOpen: boolean;
  setVolunteerAgreementOpen: (open: boolean) => void;
  healthSafetyPolicyOpen: boolean;
  setHealthSafetyPolicyOpen: (open: boolean) => void;
  shiftTypes?: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-6" data-testid="notification-preferences-form">
      <div className="space-y-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Shortage Notifications
        </h3>

        <div className="p-4 rounded-lg border border-border bg-muted/20">
          <Label className="flex items-start space-x-3 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={formData.receiveShortageNotifications}
              onCheckedChange={(checked) =>
                onInputChange("receiveShortageNotifications", checked)
              }
              disabled={loading}
              className="mt-1"
              data-testid="receive-notifications-toggle"
            />
            <div>
              <span>Receive shift shortage notifications</span>
              <p className="text-xs text-muted-foreground mt-1 font-normal">
                Get notified when shifts need more volunteers. You can customize
                which types of shifts you&apos;d like to hear about.
              </p>
            </div>
          </Label>
        </div>

        {formData.receiveShortageNotifications && (
          <>
            <div className="space-y-2 ml-6">
              <Label className="text-sm font-medium">
                Shift types you&apos;d like notifications for
              </Label>
              <div className="space-y-2">
                {shiftTypes.length > 0 ? (
                  shiftTypes.map((shiftType) => (
                    <Label
                      key={shiftType.id}
                      className="flex items-center space-x-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={
                          // UI shows what they WANT notifications for
                          // If empty array (no excluded types), they want ALL types - so check all
                          // If has excluded types, they want all EXCEPT those - so check if this type is NOT excluded
                          formData.excludedShortageNotificationTypes.length ===
                            0 ||
                          !formData.excludedShortageNotificationTypes.includes(
                            shiftType.id
                          )
                        }
                        onCheckedChange={(checked) => {
                          const currentExcluded =
                            formData.excludedShortageNotificationTypes;
                          if (checked) {
                            // User wants this type, so REMOVE it from excluded list
                            onInputChange(
                              "excludedShortageNotificationTypes",
                              currentExcluded.filter((t) => t !== shiftType.id)
                            );
                          } else {
                            // User doesn't want this type, so ADD it to excluded list
                            if (!currentExcluded.includes(shiftType.id)) {
                              onInputChange(
                                "excludedShortageNotificationTypes",
                                [...currentExcluded, shiftType.id]
                              );
                            }
                          }
                        }}
                        disabled={loading}
                      />
                      <span>{shiftType.name}</span>
                    </Label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Loading shift types...
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 pt-6 border-t border-border">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Required Agreements
        </h3>
        <div className="space-y-4">
          <ResponsiveDialog
            open={volunteerAgreementOpen}
            onOpenChange={setVolunteerAgreementOpen}
          >
            <ResponsiveDialogTrigger asChild>
              <div className="p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    data-testid="volunteer-agreement-checkbox"
                    checked={formData.volunteerAgreementAccepted}
                    disabled={true}
                    className="mt-1 pointer-events-none"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        I have read and agree with the Volunteer Agreement *
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.volunteerAgreementAccepted
                        ? "You have read and agreed to this agreement"
                        : "Click here to read and agree to the agreement"}
                    </p>
                  </div>
                </div>
              </div>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="max-w-2xl">
              <PolicyContent
                content={volunteerAgreementContent}
                showAgreeButton={true}
                onAgree={() => {
                  onInputChange("volunteerAgreementAccepted", true);
                  // Use setTimeout to ensure dialog closes after state update
                  setTimeout(() => {
                    setVolunteerAgreementOpen(false);
                  }, 0);
                }}
              />
            </ResponsiveDialogContent>
          </ResponsiveDialog>

          <ResponsiveDialog
            open={healthSafetyPolicyOpen}
            onOpenChange={setHealthSafetyPolicyOpen}
          >
            <ResponsiveDialogTrigger asChild>
              <div className="p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    data-testid="health-safety-policy-checkbox"
                    checked={formData.healthSafetyPolicyAccepted}
                    disabled={true}
                    className="mt-1 pointer-events-none"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        I have read and agree with the Health and Safety Policy
                        *
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.healthSafetyPolicyAccepted
                        ? "You have read and agreed to this policy"
                        : "Click here to read and agree to the policy"}
                    </p>
                  </div>
                </div>
              </div>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="max-w-2xl">
              <PolicyContent
                content={healthSafetyPolicyContent}
                showAgreeButton={true}
                onAgree={() => {
                  onInputChange("healthSafetyPolicyAccepted", true);
                  // Use setTimeout to ensure dialog closes after state update
                  setTimeout(() => {
                    setHealthSafetyPolicyOpen(false);
                  }, 0);
                }}
              />
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>
    </div>
  );
}
