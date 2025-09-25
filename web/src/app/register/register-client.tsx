"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, getProviders } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  User,
  Phone,
  Shield,
  MapPin,
  FileText,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
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
import { MotionPageContainer } from "@/components/motion-page-container";
import { MotionCard } from "@/components/motion-card";

interface Provider {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
}

interface RegisterClientProps {
  locationOptions: Array<{ value: string; label: string }>;
  shiftTypes: Array<{ id: string; name: string }>;
}

export default function RegisterClient({ locationOptions, shiftTypes }: RegisterClientProps) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [volunteerAgreementOpen, setVolunteerAgreementOpen] = useState(false);
  const [healthSafetyPolicyOpen, setHealthSafetyPolicyOpen] = useState(false);
  const [volunteerAgreementContent, setVolunteerAgreementContent] = useState("");
  const [healthSafetyPolicyContent, setHealthSafetyPolicyContent] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  // Load policy content and OAuth providers
  useEffect(() => {
    const loadProviders = async () => {
      const res = await getProviders();
      if (res) {
        setProviders(res);
      }
    };

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

    loadProviders();
    loadPolicyContent();
  }, []);

  // Registration form data
  const [formData, setFormData] = useState<UserProfileFormData>({
    // Basic account info
    email: "",
    password: "",
    confirmPassword: "",

    // Personal information
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    pronouns: "none",
    customPronouns: "",

    // Emergency contact
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",

    // Medical & references
    medicalConditions: "",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "not_specified",
    customHowDidYouHearAboutUs: "",

    // Availability
    availableDays: [],
    availableLocations: [],

    // Communication & agreements
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: false,
    healthSafetyPolicyAccepted: false,
  });

  const steps = [
    {
      id: "account",
      title: "Create Account",
      description: "Set up your login credentials",
      icon: UserPlus,
      color: "bg-blue-500",
    },
    {
      id: "personal",
      title: "Personal Information",
      description: "Tell us about yourself",
      icon: User,
      color: "bg-green-500",
    },
    {
      id: "emergency",
      title: "Emergency Contact",
      description: "Safety contact information",
      icon: Phone,
      color: "bg-red-500",
    },
    {
      id: "medical",
      title: "Medical & Background",
      description: "Health information and references",
      icon: Shield,
      color: "bg-orange-500",
    },
    {
      id: "availability",
      title: "Availability",
      description: "When and where you can volunteer",
      icon: MapPin,
      color: "bg-purple-500",
    },
    {
      id: "agreements",
      title: "Final Steps",
      description: "Review and accept policies",
      icon: FileText,
      color: "bg-indigo-500",
    },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate required fields based on current step
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
      // Validate passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Validate required agreements
      if (
        !formData.volunteerAgreementAccepted ||
        !formData.healthSafetyPolicyAccepted
      ) {
        throw new Error("Please accept all required agreements to continue");
      }

      // Process form data
      const processedData = {
        ...formData,
        pronouns: formData.pronouns === "none" ? null : 
                 formData.pronouns === "other" ? formData.customPronouns || null : 
                 formData.pronouns,
        howDidYouHearAboutUs:
          formData.howDidYouHearAboutUs === "not_specified"
            ? null
            : formData.howDidYouHearAboutUs === "other"
            ? formData.customHowDidYouHearAboutUs || null
            : formData.howDidYouHearAboutUs,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(processedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();
      
      if (result.requiresEmailVerification) {
        toast({
          title: "Registration successful!",
          description:
            "Please check your email and click the verification link to complete your registration.",
        });
        // Redirect to login page with email verification message
        router.push("/login?message=verify-email&email=" + encodeURIComponent(formData.email || ""));
      } else {
        toast({
          title: "Registration successful!",
          description:
            "Welcome to Everybody Eats! You can now sign in to your account.",
        });
        // Redirect to login page
        router.push("/login?message=registration-success");
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description:
          error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  async function handleOAuthSignIn(providerId: string) {
    setOauthLoading(providerId);

    try {
      await signIn(providerId, {
        callbackUrl: "/profile/edit?oauth=true", // Redirect to profile completion
      });
    } catch (error) {
      console.error("OAuth sign in error:", error);
      toast({
        title: "Authentication failed",
        description: "Please try again or use email registration.",
        variant: "destructive",
      });
      setOauthLoading(null);
    }
  }

  // Filter out credentials provider for OAuth buttons
  const oauthProviders = Object.values(providers).filter(
    (provider) => provider.type === "oauth"
  );

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
        return "bg-background hover:bg-accent/50 text-foreground border border-border";
      case "facebook":
        return "bg-[#1877F2] hover:bg-[#1565C0] text-white hover:text-white border border-[#1877F2]";
      case "apple":
        return "bg-black hover:bg-gray-900 text-white hover:text-white border border-black";
      default:
        return "bg-muted hover:bg-muted/80 text-foreground border border-border";
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Account
        if (
          !formData.email ||
          !formData.password ||
          !formData.confirmPassword
        ) {
          toast({
            title: "Required fields missing",
            description: "Please fill in all required fields",
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
            title: "Password too weak",
            description: "Password must be at least 6 characters long",
            variant: "destructive",
          });
          return false;
        }
        if (!/[A-Z]/.test(formData.password)) {
          toast({
            title: "Password too weak",
            description: "Password must contain at least one uppercase letter",
            variant: "destructive",
          });
          return false;
        }
        if (!/[a-z]/.test(formData.password)) {
          toast({
            title: "Password too weak",
            description: "Password must contain at least one lowercase letter",
            variant: "destructive",
          });
          return false;
        }
        if (!/[0-9]/.test(formData.password)) {
          toast({
            title: "Password too weak",
            description: "Password must contain at least one number",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 1: // Personal
        if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.phone) {
          toast({
            title: "Required fields missing",
            description: "Please provide your first name, last name, date of birth, and mobile number",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.profilePhotoUrl) {
          toast({
            title: "Profile photo required",
            description: "Please upload a profile photo to continue",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 3: // Medical & Background
        if (!formData.howDidYouHearAboutUs || formData.howDidYouHearAboutUs === "not_specified") {
          toast({
            title: "Required field missing",
            description: "Please tell us how you heard about us",
            variant: "destructive",
          });
          return false;
        }
        if (formData.howDidYouHearAboutUs === "other" && !formData.customHowDidYouHearAboutUs?.trim()) {
          toast({
            title: "Required field missing",
            description: "Please specify how you heard about us",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 5: // Agreements
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
    }
    return true;
  };

  const handleInputChange = (field: string, value: string | boolean | string[] | number) => {
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

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Welcome Message */}
            <div
              className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
              data-testid="welcome-message"
            >
              <div className="flex items-start space-x-3">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Welcome to Everybody Eats!
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Create your volunteer account to start making a difference in
                    your community.
                  </p>
                </div>
              </div>
            </div>

            {/* OAuth Providers */}
            <div className="space-y-4" data-testid="oauth-providers">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Quick registration with your existing account
                </p>
              </div>
              <div className="grid gap-3">
                {oauthProviders.length > 0 ? oauthProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      onClick={() => handleOAuthSignIn(provider.id)}
                      disabled={oauthLoading !== null || loading}
                      className={`w-full h-11 ${getProviderButtonStyle(
                        provider.id
                      )}`}
                      variant="outline"
                      type="button"
                      data-testid={`oauth-${provider.id}-button`}
                    >
                      {oauthLoading === provider.id ? (
                        <MotionSpinner size="sm" />
                      ) : (
                        <>
                          {getProviderIcon(provider.id)}
                          <span className="ml-3">
                            Continue with {provider.name}
                          </span>
                        </>
                      )}
                    </Button>
                  )) : (
                  // Loading skeleton for OAuth buttons
                  <>
                    <div className="h-11 bg-border animate-pulse rounded-md"></div>
                    <div className="h-11 bg-border animate-pulse rounded-md"></div>
                    <div className="h-11 bg-border animate-pulse rounded-md"></div>
                  </>
                )}
              </div>

              <div className="relative my-6" data-testid="oauth-divider">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or create account with email
                  </span>
                </div>
              </div>
            </div>

            <AccountStep
              formData={formData}
              onInputChange={handleInputChange}
              loading={loading || oauthLoading !== null}
            />
          </div>
        );
      case 1:
        return (
          <PersonalInfoStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
            isRegistration={true}
          />
        );
      case 2:
        return (
          <EmergencyContactStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
          />
        );
      case 3:
        return (
          <MedicalInfoStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
          />
        );
      case 4:
        return (
          <AvailabilityStep
            formData={formData}
            onDayToggle={handleDayToggle}
            onLocationToggle={handleLocationToggle}
            loading={loading}
            locationOptions={locationOptions}
          />
        );
      case 5:
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
            shiftTypes={shiftTypes}
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
    <MotionPageContainer className="min-h-screen" data-testid="register-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <PageHeader
          title="Join Everybody Eats"
          description="Create your volunteer account and start making a difference in your community. The registration process takes about 5-10 minutes to complete."
        >
          <div className="flex justify-start mt-6">
            <Button asChild variant="outline" size="sm" className="gap-2" data-testid="login-link">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4" />
                Already have an account? Sign in
              </Link>
            </Button>
          </div>
        </PageHeader>

        {/* Progress Indicator */}
        <div className="hidden md:block bg-card dark:bg-card rounded-xl shadow-sm border border-border p-6" data-testid="progress-indicator">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" data-testid="progress-title">Registration Progress</h2>
            <Badge variant="outline" className="text-xs" data-testid="step-counter">
              Step {currentStep + 1} of {steps.length}
            </Badge>
          </div>

          <div className="flex items-center space-x-2 mb-4" data-testid="progress-steps">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex-1 flex items-center ${
                    index === steps.length - 1 ? "grow-0" : ""
                  }`}
                  data-testid={`progress-step-${index + 1}`}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
                      index === currentStep
                        ? `${step.color} text-white dark:text-white shadow-lg`
                        : index < currentStep
                        ? "bg-green-500 text-white dark:text-white hover:bg-green-600 dark:hover:bg-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-${index + 1}-icon`}
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
                        index < currentStep ? "bg-green-500 dark:bg-green-600" : "bg-muted dark:bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center" data-testid="current-step-info">
            <h3 className="font-medium text-foreground" data-testid="current-step-title">
              {steps[currentStep].title}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="current-step-description">
              {steps[currentStep].description}
            </p>
          </div>
        </div>

        {/* Form Content */}
        <MotionCard className="shadow-lg border-0 bg-card/80 dark:bg-card/90 backdrop-blur-sm" data-testid="registration-form-card">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-xl" data-testid="form-step-title">
              {React.createElement(steps[currentStep].icon, {
                className: "h-6 w-6",
              })}
              {steps[currentStep].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8" data-testid="registration-form">
              <div className="min-h-[400px]" data-testid="form-step-content">{renderCurrentStep()}</div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-border" data-testid="form-navigation">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0 || loading}
                  className="flex items-center gap-2"
                  data-testid="previous-button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Button>

                <GradientButton
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2"
                  data-testid="next-submit-button"
                >
                  {loading ? (
                    <>
                      <MotionSpinner size="sm" color="white" />
                      {currentStep === steps.length - 1
                        ? "Creating Account..."
                        : "Processing..."}
                    </>
                  ) : currentStep === steps.length - 1 ? (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create Account
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
    </MotionPageContainer>
  );
}