"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  Shield,
  MapPin,
  Bell,
  Key,
} from "lucide-react";
import { ProfileEditPageHeader } from "@/components/profile-edit-page-header";
import {
  PersonalInfoStep,
  EmergencyContactStep,
  MedicalInfoStep,
  AvailabilityStep,
  CommunicationStep,
  UserProfileFormData,
} from "@/components/forms/user-profile-form";
import { MotionPageContainer } from "@/components/motion-page-container";
import { PasskeyManagement } from "@/components/passkey-management";
import {
  type LocationOption,
  getDefaultLocationCandidates,
} from "@/lib/location-utils";

interface ProfileEditClientProps {
  locationOptions: LocationOption[];
  shiftTypes: Array<{ id: string; name: string }>;
}

/**
 * Multi-section profile editing page
 * Uses shared form components to maintain consistency with registration
 */
export default function ProfileEditClient({
  locationOptions,
  shiftTypes,
}: ProfileEditClientProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(0);
  const [volunteerAgreementOpen, setVolunteerAgreementOpen] = useState(false);
  const [healthSafetyPolicyOpen, setHealthSafetyPolicyOpen] = useState(false);
  const [volunteerAgreementContent, setVolunteerAgreementContent] =
    useState("");
  const [healthSafetyPolicyContent, setHealthSafetyPolicyContent] =
    useState("");
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [initialEmail, setInitialEmail] = useState<string | undefined>(
    undefined
  );
  const [initialDateOfBirth, setInitialDateOfBirth] = useState<
    string | undefined
  >(undefined);
  const [newsletterLists, setNewsletterLists] = useState<
    Array<{ id: string; name: string; campaignMonitorId: string; description: string | null }>
  >([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const hasLoadedData = useRef(false);

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

  // Load newsletter lists
  useEffect(() => {
    const loadNewsletterLists = async () => {
      try {
        const response = await fetch("/api/newsletter-lists");
        if (response.ok) {
          const lists = await response.json();
          setNewsletterLists(lists);
        }
      } catch (error) {
        console.error("Failed to load newsletter lists:", error);
      }
    };

    loadNewsletterLists();
  }, []);

  // Profile form data - same interface as registration but without account fields
  const [formData, setFormData] = useState<UserProfileFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    pronouns: "none",
    profilePhotoUrl: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    medicalConditions: "",
    willingToProvideReference: false,
    howDidYouHearAboutUs: "not_specified",
    customHowDidYouHearAboutUs: "",
    availableDays: [],
    availableLocations: [],
    defaultLocation: "",
    emailNewsletterSubscription: true,
    newsletterLists: [],
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: false,
    healthSafetyPolicyAccepted: false,
  });

  // Load data from API on mount (only once)
  useEffect(() => {
    // Prevent re-loading if data has already been loaded
    if (hasLoadedData.current) {
      return;
    }

    const loadProfileData = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const profileData = await response.json();

          // Store initial values for locked field detection
          setUserRole(profileData.role);
          setInitialEmail(profileData.email || undefined);
          setInitialDateOfBirth(
            profileData.dateOfBirth
              ? new Date(profileData.dateOfBirth).toISOString().split("T")[0]
              : undefined
          );

          setFormData({
            firstName: profileData.firstName || "",
            lastName: profileData.lastName || "",
            email: profileData.email || "",
            phone: profileData.phone || "",
            dateOfBirth: profileData.dateOfBirth
              ? new Date(profileData.dateOfBirth).toISOString().split("T")[0]
              : "",
            pronouns: profileData.pronouns || "none",
            profilePhotoUrl: profileData.profilePhotoUrl || "",
            emergencyContactName: profileData.emergencyContactName || "",
            emergencyContactRelationship:
              profileData.emergencyContactRelationship || "",
            emergencyContactPhone: profileData.emergencyContactPhone || "",
            medicalConditions: profileData.medicalConditions || "",
            willingToProvideReference:
              profileData.willingToProvideReference || false,
            howDidYouHearAboutUs:
              profileData.howDidYouHearAboutUs || "not_specified",
            customHowDidYouHearAboutUs:
              profileData.customHowDidYouHearAboutUs || "",
            availableDays: profileData.availableDays || [],
            availableLocations: profileData.availableLocations || [],
            defaultLocation: profileData.defaultLocation || "",
            emailNewsletterSubscription:
              profileData.emailNewsletterSubscription !== false,
            newsletterLists: profileData.newsletterLists || [],
            notificationPreference:
              profileData.notificationPreference || "EMAIL",
            receiveShortageNotifications:
              profileData.receiveShortageNotifications !== false,
            excludedShortageNotificationTypes:
              profileData.excludedShortageNotificationTypes || [],
            volunteerAgreementAccepted:
              profileData.volunteerAgreementAccepted || false,
            healthSafetyPolicyAccepted:
              profileData.healthSafetyPolicyAccepted || false,
          });

          // Mark as loaded to prevent re-loading
          hasLoadedData.current = true;
        }
      } catch (error) {
        console.error("Failed to load profile data:", error);
        toast({
          title: "Error loading profile",
          description:
            "Failed to load your profile data. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  const sections = useMemo(
    () => [
      {
        id: "personal",
        title: "Personal Information",
        description: "Basic personal details and contact information",
        icon: User,
      },
      {
        id: "emergency",
        title: "Emergency Contact",
        description: "Emergency contact information for safety",
        icon: Phone,
      },
      {
        id: "medical",
        title: "Medical & References",
        description: "Medical conditions and reference willingness",
        icon: Shield,
      },
      {
        id: "availability",
        title: "Availability & Location",
        description: "When and where you can volunteer",
        icon: MapPin,
      },
      {
        id: "communication",
        title: "Communication & Agreements",
        description: "Notification preferences and policy agreements",
        icon: Bell,
      },
      {
        id: "security",
        title: "Security",
        description: "Manage passkeys and account security",
        icon: Key,
      },
    ],
    []
  );

  // Handle deep linking to specific sections
  useEffect(() => {
    const step = searchParams.get("step");
    if (step) {
      const sectionIndex = sections.findIndex((section) => section.id === step);
      if (sectionIndex !== -1) {
        setCurrentSection(sectionIndex);
      }
    }
  }, [searchParams, sections]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      setLoading(true);

      try {
        // Process form data to handle special placeholder values
        // Remove fields that aren't part of profile updates
        const { ...profileData } = formData;

        // Process the data for sending
        const processedData: Record<
          string,
          string | boolean | string[] | Date | null
        > = {};

        // Handle each field appropriately
        Object.entries(profileData).forEach(([key, value]) => {
          // Special handling for specific fields
          if (key === "pronouns") {
            if (value !== "none" && value !== "") {
              processedData[key] = value;
            }
          } else if (key === "howDidYouHearAboutUs") {
            if (value !== "not_specified" && value !== "") {
              if (
                value === "other" &&
                formData.customHowDidYouHearAboutUs?.trim()
              ) {
                processedData[key] = formData.customHowDidYouHearAboutUs;
              } else if (value !== "other") {
                processedData[key] = value;
              }
            }
          } else if (typeof value === "string") {
            // For string fields, only include non-empty values
            if (value !== "") {
              processedData[key] = value;
            }
          } else {
            // For arrays, booleans, etc., include as-is
            processedData[key] = value;
          }
        });

        console.log("Sending profile data:", processedData);

        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(processedData),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Profile update failed:", error);
          if (error.details) {
            console.error(
              "Validation details:",
              JSON.stringify(error.details, null, 2)
            );
          }
          throw new Error(error.error || "Failed to update profile");
        }

        toast({
          title: "Profile saved successfully!",
          description: "Your changes have been saved.",
        });

        router.push("/profile");
      } catch (error) {
        toast({
          title: "Error updating profile",
          description:
            error instanceof Error ? error.message : "Failed to update profile",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [formData, toast, router]
  );

  const handleInputChange = useCallback(
    (field: string, value: string | boolean | string[] | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleDayToggle = useCallback((day: string) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  }, []);

  const handleLocationToggle = useCallback((location: string) => {
    setFormData((prev) => {
      const nextLocations = prev.availableLocations.includes(location)
        ? prev.availableLocations.filter((l) => l !== location)
        : [...prev.availableLocations, location];

      const candidates = getDefaultLocationCandidates(
        nextLocations,
        locationOptions
      );
      let nextDefault = prev.defaultLocation;
      if (nextDefault && !candidates.includes(nextDefault)) {
        nextDefault = "";
      }
      if (!nextDefault && candidates.length === 1) {
        nextDefault = candidates[0];
      }

      return {
        ...prev,
        availableLocations: nextLocations,
        defaultLocation: nextDefault,
      };
    });
  }, [locationOptions]);

  const nextSection = useCallback(() => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  }, [currentSection, sections.length]);

  const prevSection = useCallback(() => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  }, [currentSection]);

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0: // Personal Information
        return (
          <PersonalInfoStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
            isRegistration={false}
            userRole={userRole}
            initialEmail={initialEmail}
            initialDateOfBirth={initialDateOfBirth}
          />
        );
      case 1: // Emergency Contact
        return (
          <EmergencyContactStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
          />
        );
      case 2: // Medical & References
        return (
          <MedicalInfoStep
            formData={formData}
            onInputChange={handleInputChange}
            loading={loading}
          />
        );
      case 3: // Availability & Preferences
        return (
          <AvailabilityStep
            formData={formData}
            onInputChange={handleInputChange}
            onDayToggle={handleDayToggle}
            onLocationToggle={handleLocationToggle}
            loading={loading}
            locationOptions={locationOptions}
          />
        );
      case 4: // Communication & Agreements
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
            newsletterLists={newsletterLists}
          />
        );
      case 5: // Security
        return <PasskeyManagement />;
      default:
        return null;
    }
  };

  // Handle form changes for SelectField components
  const handleSelectChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  useEffect(() => {
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
  }, [handleSelectChange]);

  return (
    <div className="min-h-screen">
      <MotionPageContainer className="space-y-8">
        <ProfileEditPageHeader />

        {initialLoading ? (
          <div className="grain rounded-[2rem] border border-forest-500/10 bg-card dark:border-cream-50/10">
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest-500 border-t-transparent dark:border-cream-50 dark:border-t-transparent"></div>
                <p className="text-forest-700/70 dark:text-cream-50/70">
                  Loading your profile...
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Indicator */}
            <div className="grain rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2
                  className="display display-medium text-xl tracking-tight text-forest-700 sm:text-2xl dark:text-cream-50"
                  data-testid="profile-setup-progress-heading"
                >
                  Profile Setup Progress
                </h2>
                <span
                  className="shrink-0 rounded-full border border-forest-500/20 px-3 py-1 text-xs font-medium text-forest-700/70 dark:border-cream-50/20 dark:text-cream-50/70"
                  data-testid="step-indicator"
                >
                  Step {currentSection + 1} of {sections.length}
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-2 mb-5">
                {sections.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <div
                      key={section.id}
                      className={`flex-1 flex items-center ${
                        index === sections.length - 1 ? "grow-0" : ""
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 cursor-pointer hover:scale-105 ${
                          index === currentSection
                            ? "bg-forest-500 text-cream-50 shadow-lg"
                            : index < currentSection
                            ? "bg-sun-200 text-forest-700 hover:bg-sun-300"
                            : "bg-forest-500/10 text-forest-500/60 hover:bg-forest-500/20 dark:bg-cream-50/10 dark:text-cream-50/50 dark:hover:bg-cream-50/20"
                        }`}
                        onClick={() => setCurrentSection(index)}
                        title={`Go to ${section.title}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      {index < sections.length - 1 && (
                        <div
                          className={`flex-1 h-[3px] mx-2 rounded-full transition-all duration-200 ${
                            index < currentSection
                              ? "bg-sun-300/80 dark:bg-sun-200/60"
                              : "bg-forest-500/10 dark:bg-cream-50/10"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-center mb-5">
                <h3 className="font-accent text-lg font-medium text-forest-700 dark:text-cream-50">
                  {sections[currentSection].title}
                </h3>
                <p className="mt-0.5 text-sm text-forest-700/60 dark:text-cream-50/60">
                  {sections[currentSection].description}
                </p>
              </div>

              {/* Section Navigation Tabs */}
              <div className="flex flex-wrap gap-2 justify-center">
                {sections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentSection(index)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                      index === currentSection
                        ? "bg-forest-500 text-cream-50 shadow-sm"
                        : "border border-forest-500/15 text-forest-700/70 hover:bg-forest-500/10 hover:text-forest-700 dark:border-cream-50/15 dark:text-cream-50/70 dark:hover:bg-cream-50/10 dark:hover:text-cream-50"
                    }`}
                    role="button"
                    data-testid={`${section.id}-tab-button`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Content */}
            <Card className="rounded-[2rem] border-forest-500/10 bg-card py-8 shadow-none dark:border-cream-50/10">
              <CardHeader className="pb-6 px-6 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle
                    className="flex items-center gap-3"
                    data-testid="current-section-title"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-500/10 text-forest-500 dark:bg-cream-50/10 dark:text-cream-50">
                      {React.createElement(sections[currentSection].icon, {
                        className: "h-5 w-5",
                      })}
                    </span>
                    <span className="display display-medium text-2xl tracking-tight text-forest-700 dark:text-cream-50">
                      {sections[currentSection].title}
                    </span>
                  </CardTitle>
                  {/* Always visible save button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    size="sm"
                    className="flex items-center gap-2 px-4"
                    data-testid="header-save-button"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="min-h-[400px]">{renderCurrentSection()}</div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevSection}
                      disabled={currentSection === 0 || loading}
                      className="flex items-center gap-2 border-forest-500/20 px-5 text-forest-700 hover:bg-forest-500/10 hover:text-forest-700 dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50/10 dark:hover:text-cream-50"
                      data-testid="previous-section-button"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex gap-3">
                      {currentSection < sections.length - 1 ? (
                        <Button
                          type="button"
                          onClick={nextSection}
                          disabled={loading}
                          className="flex items-center gap-2 px-5"
                          data-testid="next-section-button"
                        >
                          Next
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={loading}
                          className="flex items-center gap-2 px-5"
                          data-testid="save-notification-preferences"
                        >
                          <Save className="h-4 w-4" />
                          {loading ? "Saving..." : "Save Profile"}
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </MotionPageContainer>
    </div>
  );
}
