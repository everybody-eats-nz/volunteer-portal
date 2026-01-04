"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  User,
  Phone,
  Shield,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  AccountStep,
  PersonalInfoStep,
  EmergencyContactStep,
  MedicalInfoStep,
  AvailabilityStep,
  CommunicationStep,
  UserProfileFormData,
} from "@/components/forms/user-profile-form";
import { MotionSpinner } from "@/components/motion-spinner";
import { MotionCard } from "@/components/motion-card";
import { safeParseAvailability } from "@/lib/parse-availability";

// Extend the form data to include profile image requirement for migration
interface MigrationFormData extends UserProfileFormData {
  profilePhotoUrl?: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  medicalConditions?: string | null;
  availableDays?: string | null;
  availableLocations?: string | null;
  profilePhotoUrl?: string | null;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
}

interface MigrationRegistrationFormProps {
  user: User;
  token: string;
  locationOptions: Array<{ value: string; label: string }>;
  shiftTypes: Array<{ id: string; name: string }>;
}

/**
 * Migration registration form that reuses components from the main registration flow
 * Eliminates duplication by leveraging existing form steps and validation logic
 */
// OAuth provider helper functions
const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case "google":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "apple":
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      );
    default:
      return null;
  }
};

const getProviderButtonStyle = (providerId: string) => {
  switch (providerId) {
    case "google":
      return "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600";
    case "facebook":
      return "bg-[#1877F2] hover:bg-[#166FE5] text-white";
    case "apple":
      return "bg-black dark:bg-white hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-black";
    default:
      return "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100";
  }
};

// Account step with OAuth options component
function AccountStepWithOAuth({
  formData,
  onInputChange,
  loading,
  token,
}: {
  formData: MigrationFormData;
  onInputChange: (
    field: string,
    value: string | boolean | string[] | number
  ) => void;
  loading: boolean;
  token: string;
}) {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Load OAuth providers
  useEffect(() => {
    const loadProviders = async () => {
      const res = await getProviders();
      if (res) {
        setProviders(res);
      }
    };
    loadProviders();
  }, []);

  const handleOAuthSignIn = async (providerId: string) => {
    setOauthLoading(providerId);

    try {
      // First save the current form data to the migration user
      const processedData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        pronouns: formData.pronouns === "none" ? null : formData.pronouns,
        customPronouns: formData.customPronouns,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactRelationship: formData.emergencyContactRelationship,
        emergencyContactPhone: formData.emergencyContactPhone,
        medicalConditions: formData.medicalConditions,
        willingToProvideReference: formData.willingToProvideReference,
        howDidYouHearAboutUs: "migration",
        availableDays: formData.availableDays,
        availableLocations: formData.availableLocations,
        emailNewsletterSubscription: formData.emailNewsletterSubscription,
        newsletterLists: formData.newsletterLists || [],
        notificationPreference: formData.notificationPreference,
        receiveShortageNotifications: formData.receiveShortageNotifications,
        excludedShortageNotificationTypes:
          formData.excludedShortageNotificationTypes,
        volunteerAgreementAccepted: formData.volunteerAgreementAccepted,
        healthSafetyPolicyAccepted: formData.healthSafetyPolicyAccepted,
        profilePhotoUrl: formData.profilePhotoUrl,
      };

      // Save form data to migration user before OAuth
      const saveResponse = await fetch("/api/auth/save-migration-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          data: processedData,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save migration data");
      }

      // Now proceed with OAuth
      const callbackUrl = `/api/auth/complete-migration?token=${encodeURIComponent(
        token
      )}`;
      await signIn(providerId, {
        callbackUrl,
      });
    } catch (error) {
      console.error("OAuth sign in error:", error);
      setOauthLoading(null);
    }
  };

  // Filter out credentials provider for OAuth buttons
  const oauthProviders = Object.values(providers).filter(
    (provider) => provider.type === "oauth"
  );

  return (
    <div className="space-y-6">
      {/* OAuth Options */}
      {oauthProviders.length > 0 && (
        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 pt-0.5">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Recommended: Use Social Login
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                  We recommend using your Google, Facebook, or Apple account to
                  sign in. This is more secure and convenient than creating a
                  password.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {oauthProviders.map((provider) => (
              <Button
                key={provider.id}
                onClick={(e) => {
                  e.preventDefault(); // Prevent form submission
                  e.stopPropagation(); // Stop event bubbling
                  handleOAuthSignIn(provider.id);
                }}
                disabled={oauthLoading !== null || loading}
                className={`w-full h-11 ${getProviderButtonStyle(provider.id)}`}
                variant="outline"
                data-testid={`oauth-${provider.id}-button`}
                type="button" // Explicitly set as button to prevent form submission
              >
                {oauthLoading === provider.id ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {getProviderIcon(provider.id)}
                    <span className="ml-3">Continue with {provider.name}</span>
                  </>
                )}
              </Button>
            ))}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or set a password
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Traditional Account Step */}
      <AccountStep
        formData={formData}
        onInputChange={onInputChange}
        loading={loading}
        hideEmail={true}
      />
    </div>
  );
}

export function MigrationRegistrationForm({
  user,
  token,
  locationOptions,
}: MigrationRegistrationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [volunteerAgreementContent, setVolunteerAgreementContent] =
    useState("");
  const [healthSafetyPolicyContent, setHealthSafetyPolicyContent] =
    useState("");
  const [volunteerAgreementOpen, setVolunteerAgreementOpen] = useState(false);
  const [healthSafetyPolicyOpen, setHealthSafetyPolicyOpen] = useState(false);

  // Initialize form data with migrated user information
  const [formData, setFormData] = useState<MigrationFormData>({
    // Account info - email is pre-filled and password needs to be set
    email: user.email,
    password: "",
    confirmPassword: "",

    // Personal information - pre-filled from migrated data
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
    dateOfBirth: user.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().split("T")[0]
      : "",
    pronouns: "none",

    // Emergency contact - pre-filled if available
    emergencyContactName: user.emergencyContactName || "",
    emergencyContactRelationship: user.emergencyContactRelationship || "",
    emergencyContactPhone: user.emergencyContactPhone || "",

    // Medical & references - pre-filled if available
    medicalConditions: user.medicalConditions || "",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "not_specified", // Will be set to "migration" on submit
    customHowDidYouHearAboutUs: "",

    // Availability - safely parse from JSON or text format
    availableDays: user.availableDays
      ? safeParseAvailability(user.availableDays)
      : [],
    availableLocations: user.availableLocations
      ? safeParseAvailability(user.availableLocations)
      : [],

    // Communication & agreements
    emailNewsletterSubscription: true,
    newsletterLists: [],
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: false,
    healthSafetyPolicyAccepted: false,

    // Profile image (pre-populate with migrated photo if available)
    profilePhotoUrl: user.profilePhotoUrl || undefined,
  });

  // Load policy content
  useEffect(() => {
    const loadPolicyContent = async () => {
      try {
        const [volunteerResponse, healthSafetyResponse] = await Promise.all([
          fetch("/content/volunteer-agreement.md"),
          fetch("/content/health-safety-policy.md"),
        ]);

        if (volunteerResponse.ok) {
          const volunteerText = await volunteerResponse.text();
          setVolunteerAgreementContent(volunteerText);
        }

        if (healthSafetyResponse.ok) {
          const healthSafetyText = await healthSafetyResponse.text();
          setHealthSafetyPolicyContent(healthSafetyText);
        }
      } catch (error) {
        console.error("Failed to load policy content:", error);
      }
    };

    loadPolicyContent();
  }, []);

  // Define steps with migration-specific configuration
  const steps = [
    {
      id: "personal",
      title: "Review Your Information",
      description: "Verify your migrated details",
      icon: User,
      color: "bg-blue-500",
    },
    {
      id: "emergency",
      title: "Emergency Contact",
      description: "Confirm emergency contact",
      icon: Phone,
      color: "bg-red-500",
    },
    {
      id: "medical",
      title: "Medical & Availability",
      description: "Update health info and schedule",
      icon: Shield,
      color: "bg-orange-500",
    },
    {
      id: "agreements",
      title: "Review Policies",
      description: "Review and accept policies",
      icon: FileText,
      color: "bg-indigo-500",
    },
    {
      id: "account",
      title: "Set Password",
      description: "Create your account password",
      icon: UserPlus,
      color: "bg-green-500",
    },
  ];

  const handleInputChange = (
    field: string,
    value: string | boolean | string[] | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const handleLocationToggle = (location: string) => {
    setFormData((prev) => ({
      ...prev,
      availableLocations: prev.availableLocations.includes(location)
        ? prev.availableLocations.filter((l) => l !== location)
        : [...prev.availableLocations, location],
    }));
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Personal info
        if (!formData.firstName || !formData.lastName) {
          toast({
            title: "Required fields missing",
            description: "Please provide your first and last name",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 1: // Emergency contact
        if (
          !formData.emergencyContactName ||
          !formData.emergencyContactRelationship ||
          !formData.emergencyContactPhone
        ) {
          toast({
            title: "Required fields missing",
            description:
              "Please provide complete emergency contact information",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 3: // Agreements
        if (
          !formData.volunteerAgreementAccepted ||
          !formData.healthSafetyPolicyAccepted
        ) {
          toast({
            title: "Agreements required",
            description: "Please accept all required agreements to continue",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 4: // Account setup
        if (!formData.password || !formData.confirmPassword) {
          toast({
            title: "Required fields missing",
            description: "Please set a password for your account",
            variant: "destructive",
          });
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Passwords don't match",
            description: "Please ensure both password fields match",
            variant: "destructive",
          });
          return false;
        }
        if (formData.password.length < 6) {
          toast({
            title: "Password too short",
            description: "Password must be at least 6 characters long",
            variant: "destructive",
          });
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate current step
    if (!validateCurrentStep()) {
      return;
    }

    // If not on final step, move to next step
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Final submission
    setLoading(true);

    try {
      // Prepare data for submission
      const processedData = {
        ...formData,
        pronouns: formData.pronouns === "none" ? null : formData.pronouns,
        howDidYouHearAboutUs: "migration", // Mark as migration user
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        migrationToken: token, // Include migration token
      };

      // Use the unified registration endpoint with migration flag
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...processedData,
          isMigration: true,
          userId: user.id, // Include user ID for update instead of create
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      toast({
        title: "Registration completed!",
        description:
          "Your account has been successfully migrated. Signing you in...",
      });

      // Auto sign-in after successful migration
      const signInResult = await signIn("credentials", {
        email: user.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/dashboard");
      } else {
        router.push("/login?message=migration-complete");
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to complete registration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: // Personal info
        return (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                We&apos;ve pre-filled your information from the previous system.
                Please review and update as needed.
              </AlertDescription>
            </Alert>
            <PersonalInfoStep
              formData={formData}
              onInputChange={handleInputChange}
              loading={loading}
              isRegistration={true}
            />
          </div>
        );
      case 1: // Emergency contact
        return (
          <EmergencyContactStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
          />
        );
      case 2: // Medical & Availability
        return (
          <div className="space-y-8">
            <MedicalInfoStep
              formData={formData}
              onInputChange={handleInputChange}
              loading={loading}
            />
            <div className="border-t pt-8">
              <AvailabilityStep
                formData={formData}
                onDayToggle={handleDayToggle}
                onLocationToggle={handleLocationToggle}
                loading={loading}
                locationOptions={locationOptions}
              />
            </div>
          </div>
        );
      case 3: // Agreements
        return (
          <CommunicationStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
            volunteerAgreementContent={volunteerAgreementContent}
            healthSafetyPolicyContent={healthSafetyPolicyContent}
            volunteerAgreementOpen={volunteerAgreementOpen}
            setVolunteerAgreementOpen={setVolunteerAgreementOpen}
            healthSafetyPolicyOpen={healthSafetyPolicyOpen}
            setHealthSafetyPolicyOpen={setHealthSafetyPolicyOpen}
          />
        );
      case 4: // Account setup (Password)
        return (
          <AccountStepWithOAuth
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
            token={token}
          />
        );
      default:
        return null;
    }
  };

  // Handle form changes for SelectField components
  useEffect(() => {
    const handleSelectChange = (name: string, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFormData = (e: CustomEvent) => {
      handleSelectChange(e.detail.name, e.detail.value);
    };

    window.addEventListener(
      "selectFieldChange",
      handleFormData as EventListener
    );
    return () =>
      window.removeEventListener(
        "selectFieldChange",
        handleFormData as EventListener
      );
  }, []);

  return (
    <div className="space-y-8" data-testid="migration-registration-form">
      {/* Progress Indicator */}
      <div className="hidden md:block bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Migration Progress</h2>
          <Badge
            variant="outline"
            className="text-xs"
            data-testid="step-indicator"
          >
            Step {currentStep + 1} of {steps.length}
          </Badge>
        </div>

        <div className="flex items-center space-x-2 mb-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex-1 flex items-center ${
                  index === steps.length - 1 ? "grow-0" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
                    index === currentStep
                      ? `${step.color} text-white shadow-lg`
                      : index < currentStep
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded-full transition-all duration-200 ${
                      index < currentStep ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <h3 className="font-medium text-foreground" data-testid="step-title">
            {steps[currentStep].title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </div>
      </div>

      {/* Form Content */}
      <MotionCard className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3 sm:pb-6 px-3 sm:px-6 pt-4 sm:pt-6">
          <CardTitle
            className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl"
            data-testid="step-card-title"
          >
            {React.createElement(steps[currentStep].icon, {
              className: "h-5 w-5 sm:h-6 sm:w-6",
            })}
            {steps[currentStep].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8">
            <div className="min-h-[300px] sm:min-h-[400px]">{renderCurrentStep()}</div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0 || loading}
                className="flex items-center gap-2"
                data-testid="previous-step-button"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              <GradientButton
                type="submit"
                disabled={loading}
                className="flex items-center gap-2"
                data-testid="next-step-button"
              >
                {loading ? (
                  <>
                    <MotionSpinner size="sm" color="white" />
                    {currentStep === steps.length - 1
                      ? "Completing Migration..."
                      : "Processing..."}
                  </>
                ) : currentStep === steps.length - 1 ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Complete Migration
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </GradientButton>
            </div>
          </form>
        </CardContent>
      </MotionCard>
    </div>
  );
}
