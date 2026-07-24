"use client";

import React, { useState, useEffect } from "react";
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
import { calculateAge } from "@/lib/utils";
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
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PasswordRequirements } from "@/components/password-requirements";
import {
  type LocationOption,
  getDefaultLocationCandidates,
} from "@/lib/location-utils";

// Import and re-export shared constants from central location
import {
  daysOfWeek,
  pronounOptions,
  notificationOptions,
  hearAboutUsOptions,
} from "@/lib/form-constants";

export { daysOfWeek, pronounOptions, notificationOptions, hearAboutUsOptions };

/* Brand form styling — matches the login page's treatment of inputs and
   labels (rounded inputs with forest hairlines, quiet forest labels).
   Shared across registration and profile editing. */
const inputStyles =
  "h-11 rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15";
const labelStyles =
  "text-sm font-medium text-forest-700/80 dark:text-cream-50/80";
const helperTextStyles = "text-xs text-forest-700/60 dark:text-cream-50/60";
/* Quiet checkbox panel */
const panelStyles =
  "p-4 rounded-2xl border border-forest-500/15 bg-forest-500/[0.04] dark:border-cream-50/15 dark:bg-cream-50/[0.04]";
/* Sun-yellow notice panel — the brand's highlight surface */
const noticePanelStyles = "grain rounded-2xl bg-sun-100 p-4 dark:bg-sun-200/10";
/* Selectable toggle cards (days, locations, default location) */
const toggleCardBase =
  "p-3.5 rounded-2xl border cursor-pointer transition-colors";
const toggleCardOn =
  "border-forest-500 bg-forest-500/10 dark:border-sun-200/60 dark:bg-sun-200/10";
const toggleCardOff =
  "border-forest-500/15 bg-transparent hover:bg-forest-500/5 dark:border-cream-50/15 dark:hover:bg-cream-50/5";
/* Uppercase kicker used for in-form group headings */
const groupHeadingStyles =
  "eyebrow flex items-center gap-2 text-forest-500/80 dark:text-cream-50/60";

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
  defaultLocation: string;

  // Communication & agreements
  emailNewsletterSubscription: boolean;
  newsletterLists: string[];
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
  locationOptions: LocationOption[];
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
          <Label htmlFor="email" className={labelStyles}>
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => onInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            disabled={loading}
            className={inputStyles}
            required
            data-testid="email-input"
          />
        </div>
      )}

      <div className="space-y-2" data-testid="password-field">
        <Label htmlFor="password" className={labelStyles}>
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
            className={cn(inputStyles, "pr-10")}
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
        <Label htmlFor="confirmPassword" className={labelStyles}>
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
            className={cn(inputStyles, "pr-10")}
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
              <svg
                className="h-3 w-3 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-3 w-3 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
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
  userRole,
  initialEmail,
  initialDateOfBirth,
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
  userRole?: string;
  initialEmail?: string;
  initialDateOfBirth?: string;
}) {
  const dateOfBirth = formData.dateOfBirth
    ? new Date(formData.dateOfBirth)
    : undefined;
  const [dobOpen, setDobOpen] = React.useState(false);
  const [consentFormUrl, setConsentFormUrl] = useState(
    "/parental-consent-form.pdf"
  );

  // Fetch the parental consent form URL from settings
  useEffect(() => {
    fetch("/api/site-settings?key=PARENTAL_CONSENT_FORM_URL")
      .then((res) => res.json())
      .then((data) => {
        if (data.value) setConsentFormUrl(data.value);
      })
      .catch((err) => console.error("Failed to fetch consent form URL:", err));
  }, []);

  // Check if fields are locked (can be set initially but locked afterwards for non-admins)
  const isAdmin = userRole === "ADMIN";
  const isEmailLocked = !isRegistration && !isAdmin && !!initialEmail;
  const isDateOfBirthLocked =
    !isRegistration && !isAdmin && !!initialDateOfBirth;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName" className={labelStyles}>
            First Name *
          </Label>
          <Input
            id="firstName"
            data-testid="first-name-input"
            value={formData.firstName}
            onChange={(e) => onInputChange("firstName", e.target.value)}
            placeholder="Your first name"
            disabled={loading}
            className={inputStyles}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className={labelStyles}>
            Last Name *
          </Label>
          <Input
            id="lastName"
            data-testid="last-name-input"
            value={formData.lastName}
            onChange={(e) => onInputChange("lastName", e.target.value)}
            placeholder="Your last name"
            disabled={loading}
            className={inputStyles}
            required
          />
        </div>
      </div>

      {!isRegistration && (
        <div className="space-y-2">
          <Label htmlFor="email" className={labelStyles}>
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => onInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            disabled={loading || isEmailLocked}
            className={inputStyles}
            data-testid="email-input"
          />
          {isEmailLocked && (
            <p className={helperTextStyles}>
              Email address cannot be changed. Contact an administrator if you
              need to update it.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone" className={labelStyles}>
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
          className={inputStyles}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className={labelStyles}>
            Date of Birth *
          </Label>
          {/* Hidden input for test purposes - using absolute positioning to keep it fillable */}
          <input
            type="date"
            data-testid="date-of-birth-hidden-input"
            className="absolute opacity-0 pointer-events-none h-0"
            tabIndex={-1}
            aria-hidden="true"
            value={formData.dateOfBirth || ""}
            onChange={(e) => onInputChange("dateOfBirth", e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
          <Popover open={dobOpen} onOpenChange={setDobOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  inputStyles,
                  "w-full justify-start bg-transparent px-3 text-left font-normal shadow-xs hover:bg-forest-500/5 hover:text-current dark:bg-transparent dark:hover:bg-cream-50/5",
                  !dateOfBirth && "text-muted-foreground"
                )}
                disabled={loading || isDateOfBirthLocked}
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
                startMonth={new Date(1900, 0)}
                endMonth={new Date(new Date().getFullYear(), 11)}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          {isDateOfBirthLocked && (
            <p className={helperTextStyles}>
              Date of birth cannot be changed. Contact an administrator if you
              need to update it.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pronouns" className={labelStyles}>
            Pronouns
          </Label>
          <SelectField
            name="pronouns"
            id="pronouns"
            options={pronounOptions}
            defaultValue={formData.pronouns}
            disabled={loading}
            className={cn(inputStyles, "w-full")}
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
                className={inputStyles}
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
          const actualAge = calculateAge(dateOfBirth);

          if (actualAge < 16) {
            return (
              <div
                className={cn(noticePanelStyles, "space-y-4")}
                data-testid="parental-consent-notice"
              >
                <div className="flex items-start space-x-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-forest-500 dark:text-sun-200" />
                  <div>
                    <h4 className="text-sm font-semibold text-forest-700 dark:text-sun-100">
                      Parental Consent Required
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-forest-700/75 dark:text-cream-50/70">
                      Since you are under 16, we require a signed parental
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
                      className="border-forest-500/30 bg-transparent px-4 text-forest-700 hover:bg-forest-500 hover:text-cream-50 dark:border-cream-50/30 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
                      onClick={() => {
                        window.open(consentFormUrl, "_blank");
                      }}
                      data-testid="download-consent-form-button"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download Consent Form
                    </Button>
                  </div>
                  <div className="text-sm text-forest-700/80 dark:text-cream-50/75">
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
                        <strong>volunteer@everybodyeats.nz</strong>
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
        <Label htmlFor="profilePhoto" className={labelStyles}>
          Profile Photo
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
          required={false}
        />
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
      <div className={cn(noticePanelStyles, "mb-6")}>
        <div className="flex items-start space-x-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-forest-500 dark:text-sun-200" />
          <div>
            <h4 className="text-sm font-semibold text-forest-700 dark:text-sun-100">
              Important
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-forest-700/75 dark:text-cream-50/70">
              This information is kept confidential and used only in case of
              emergencies during volunteer activities.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactName" className={labelStyles}>
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
          className={inputStyles}
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="emergencyContactRelationship"
          className={labelStyles}
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
          className={inputStyles}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactPhone" className={labelStyles}>
          Emergency Contact Phone
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
          className={inputStyles}
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
        <Label htmlFor="medicalConditions" className={labelStyles}>
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
          className="resize-none rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15"
        />
        <p className={helperTextStyles}>
          This information helps us ensure your safety and accommodate any
          special needs.
        </p>
      </div>

      <div className="space-y-4">
        <div className={panelStyles}>
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
              <p className={cn(helperTextStyles, "mt-1 font-normal")}>
                References may be requested for certain volunteer positions or
                activities.
              </p>
            </div>
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="howDidYouHearAboutUs" className={labelStyles}>
          How did you hear about us? *
        </Label>
        <SelectField
          name="howDidYouHearAboutUs"
          id="howDidYouHearAboutUs"
          options={hearAboutUsOptions}
          defaultValue={formData.howDidYouHearAboutUs}
          disabled={loading}
          className={cn(inputStyles, "w-full")}
          data-testid="how-did-you-hear-select"
        />

        {formData.howDidYouHearAboutUs === "other" && (
          <div className="mt-3">
            <Input
              id="customHowDidYouHearAboutUs"
              data-testid="custom-how-did-you-hear-input"
              value={formData.customHowDidYouHearAboutUs || ""}
              onChange={(e) =>
                onInputChange("customHowDidYouHearAboutUs", e.target.value)
              }
              placeholder="Please specify how you heard about us"
              disabled={loading}
              className={inputStyles}
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
  onInputChange,
  onDayToggle,
  onLocationToggle,
  loading,
  locationOptions,
}: {
  formData: UserProfileFormData;
  onInputChange: (
    field: string,
    value: string | boolean | string[] | number
  ) => void;
  onDayToggle: (day: string) => void;
  onLocationToggle: (location: string) => void;
  loading: boolean;
  locationOptions: LocationOption[];
}) {
  const defaultLocationCandidates = getDefaultLocationCandidates(
    formData.availableLocations,
    locationOptions
  );
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className={cn(labelStyles, "mb-3 block")}>
            Days you&apos;re typically available
          </Label>
          <p className={cn(helperTextStyles, "mb-4")}>
            Select the days you&apos;re available to volunteer. This helps us
            match you with suitable shifts.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {daysOfWeek.map((day) => (
            <div
              key={day.value}
              className={cn(
                toggleCardBase,
                formData.availableDays.includes(day.value)
                  ? toggleCardOn
                  : toggleCardOff
              )}
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
          <Label className={cn(labelStyles, "mb-3 block")}>
            Locations where you can volunteer
          </Label>
          <p className={cn(helperTextStyles, "mb-4")}>
            Choose the locations where you can volunteer. You can select
            multiple options.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {locationOptions.map((location) => (
            <div
              key={location.value}
              className={cn(
                toggleCardBase,
                formData.availableLocations.includes(location.value)
                  ? toggleCardOn
                  : toggleCardOff
              )}
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

      {defaultLocationCandidates.length > 0 && (
        <div className="space-y-4">
          <div>
            <Label className={cn(labelStyles, "mb-3 block")}>
              Default location
            </Label>
            <p className={cn(helperTextStyles, "mb-4")}>
              Which location should we show you first when browsing shifts?
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {defaultLocationCandidates.map((location) => {
              const isSelected = formData.defaultLocation === location;
              return (
                <div
                  key={location}
                  className={cn(
                    toggleCardBase,
                    isSelected ? toggleCardOn : toggleCardOff
                  )}
                >
                  <Label
                    data-testid={`default-location-${location.toLowerCase().replace(/\s+/g, "-")}-label`}
                    className="flex items-center space-x-3 text-sm font-medium cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="defaultLocation"
                      value={location}
                      checked={isSelected}
                      onChange={() => onInputChange("defaultLocation", location)}
                      disabled={loading}
                      className="h-4 w-4 accent-primary"
                      data-testid={`default-location-${location.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                    <span>{location}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  newsletterLists = [],
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
  newsletterLists?: Array<{
    id: string;
    name: string;
    campaignMonitorId: string;
    description: string | null;
  }>;
}) {
  return (
    <div className="space-y-6" data-testid="notification-preferences-form">
      <div className="space-y-4">
        <h3 className={groupHeadingStyles}>
          <Bell className="h-3.5 w-3.5" />
          Shortage Notifications
        </h3>

        <div className={panelStyles}>
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
              <p className={cn(helperTextStyles, "mt-1 font-normal")}>
                Get notified when shifts need more volunteers. You can customize
                which types of shifts you&apos;d like to hear about.
              </p>
            </div>
          </Label>
        </div>

        {formData.receiveShortageNotifications && (
          <>
            <div className="space-y-2 ml-6">
              <Label className={labelStyles}>
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

      {/* Newsletter Subscription Section */}
      <div className="space-y-4 border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
        <h3 className={groupHeadingStyles}>
          <Mail className="h-3.5 w-3.5" />
          Newsletter Subscription
        </h3>

        <div className={panelStyles}>
          <Label className="flex items-start space-x-3 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={formData.emailNewsletterSubscription}
              onCheckedChange={(checked) => {
                onInputChange("emailNewsletterSubscription", checked);
                if (!checked) {
                  // Clear newsletter lists when unsubscribing
                  onInputChange("newsletterLists", []);
                }
              }}
              disabled={loading}
              className="mt-1"
              data-testid="newsletter-subscription-toggle"
            />
            <div>
              <span>Subscribe to our newsletter</span>
              <p className={cn(helperTextStyles, "mt-1 font-normal")}>
                Receive updates about events, volunteer opportunities, and
                organization news.
              </p>
            </div>
          </Label>
        </div>

        {formData.emailNewsletterSubscription && newsletterLists.length > 0 && (
          <div className="space-y-2 ml-6">
            <Label className={labelStyles}>Select newsletters</Label>
            <div className="space-y-2">
              {newsletterLists.map((list) => (
                <Label
                  key={list.id}
                  className="flex items-center space-x-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={
                      formData.newsletterLists?.includes(
                        list.campaignMonitorId
                      ) || false
                    }
                    onCheckedChange={(checked) => {
                      const currentLists = formData.newsletterLists || [];
                      onInputChange(
                        "newsletterLists",
                        checked
                          ? [...currentLists, list.campaignMonitorId]
                          : currentLists.filter(
                              (id) => id !== list.campaignMonitorId
                            )
                      );
                    }}
                    disabled={loading}
                    data-testid={`newsletter-${list.name
                      .toLowerCase()
                      .replace(/\s+/g, "-")}-checkbox`}
                  />
                  <div>
                    <span>{list.name}</span>
                    {list.description && (
                      <p className={helperTextStyles}>
                        {list.description}
                      </p>
                    )}
                  </div>
                </Label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
        <h3 className={groupHeadingStyles}>
          <FileText className="h-3.5 w-3.5" />
          Required Agreements
        </h3>
        <div className="space-y-4">
          <ResponsiveDialog
            open={volunteerAgreementOpen}
            onOpenChange={setVolunteerAgreementOpen}
          >
            <ResponsiveDialogTrigger asChild>
              <div
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-colors",
                  formData.volunteerAgreementAccepted
                    ? "border-forest-500/40 bg-forest-500/5 dark:border-sun-200/40 dark:bg-sun-200/5"
                    : "border-forest-500/15 hover:bg-forest-500/5 dark:border-cream-50/15 dark:hover:bg-cream-50/5"
                )}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    data-testid="volunteer-agreement-checkbox"
                    checked={formData.volunteerAgreementAccepted}
                    disabled={true}
                    className="mt-1 pointer-events-none"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={labelStyles}>
                        I have read and agree with the Volunteer Agreement *
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                    <p className={cn(helperTextStyles, "mt-1")}>
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
              <div
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-colors",
                  formData.healthSafetyPolicyAccepted
                    ? "border-forest-500/40 bg-forest-500/5 dark:border-sun-200/40 dark:bg-sun-200/5"
                    : "border-forest-500/15 hover:bg-forest-500/5 dark:border-cream-50/15 dark:hover:bg-cream-50/5"
                )}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    data-testid="health-safety-policy-checkbox"
                    checked={formData.healthSafetyPolicyAccepted}
                    disabled={true}
                    className="mt-1 pointer-events-none"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={labelStyles}>
                        I have read and agree with the Health and Safety Policy
                        *
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                    <p className={cn(helperTextStyles, "mt-1")}>
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
