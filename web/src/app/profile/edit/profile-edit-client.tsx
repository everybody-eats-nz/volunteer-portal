"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  Shield,
  MapPin,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  PersonalInfoStep,
  EmergencyContactStep,
  MedicalInfoStep,
  AvailabilityStep,
  CommunicationStep,
  UserProfileFormData,
} from "@/components/forms/user-profile-form";
import { MotionPageContainer } from "@/components/motion-page-container";

interface ProfileEditClientProps {
  locationOptions: Array<{ value: string; label: string }>;
  shiftTypes: Array<{ id: string; name: string }>;
}

/**
 * Multi-section profile editing page
 * Uses shared form components to maintain consistency with registration
 */
export default function ProfileEditClient({ locationOptions, shiftTypes }: ProfileEditClientProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(0);
  const [volunteerAgreementOpen, setVolunteerAgreementOpen] = useState(false);
  const [healthSafetyPolicyOpen, setHealthSafetyPolicyOpen] = useState(false);
  const [volunteerAgreementContent, setVolunteerAgreementContent] =
    useState("");
  const [healthSafetyPolicyContent, setHealthSafetyPolicyContent] =
    useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

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
    emailNewsletterSubscription: true,
    notificationPreference: "EMAIL",
    receiveShortageNotifications: true,
    excludedShortageNotificationTypes: [],
    volunteerAgreementAccepted: false,
    healthSafetyPolicyAccepted: false,
  });

  // Load data from API on mount
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const profileData = await response.json();
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
            emailNewsletterSubscription:
              profileData.emailNewsletterSubscription !== false,
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
  }, []); // No dependencies - only run on mount

  const sections = useMemo(() => [
    {
      id: "personal",
      title: "Personal Information",
      description: "Basic personal details and contact information",
      icon: User,
      color: "bg-blue-500",
    },
    {
      id: "emergency",
      title: "Emergency Contact",
      description: "Emergency contact information for safety",
      icon: Phone,
      color: "bg-red-500",
    },
    {
      id: "medical",
      title: "Medical & References",
      description: "Medical conditions and reference willingness",
      icon: Shield,
      color: "bg-green-500",
    },
    {
      id: "availability",
      title: "Availability & Location",
      description: "When and where you can volunteer",
      icon: MapPin,
      color: "bg-purple-500",
    },
    {
      id: "communication",
      title: "Communication & Agreements",
      description: "Notification preferences and policy agreements",
      icon: Bell,
      color: "bg-orange-500",
    },
  ], []);

  // Handle deep linking to specific sections
  useEffect(() => {
    const step = searchParams.get('step');
    if (step) {
      const sectionIndex = sections.findIndex(section => section.id === step);
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
        const processedData: Record<string, string | boolean | string[] | Date | null> = {};
        
        // Handle each field appropriately
        Object.entries(profileData).forEach(([key, value]) => {
          // Special handling for specific fields
          if (key === "pronouns") {
            if (value !== "none" && value !== "") {
              processedData[key] = value;
            }
          } else if (key === "howDidYouHearAboutUs") {
            if (value !== "not_specified" && value !== "") {
              if (value === "other" && formData.customHowDidYouHearAboutUs?.trim()) {
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
            console.error("Validation details:", JSON.stringify(error.details, null, 2));
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
    [toast, router]
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
    setFormData((prev) => ({
      ...prev,
      availableLocations: prev.availableLocations.includes(location)
        ? prev.availableLocations.filter((l) => l !== location)
        : [...prev.availableLocations, location],
    }));
  }, []);

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
          />
        );
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
      <MotionPageContainer className="max-w-6xl mx-auto p-6 space-y-8">
        <PageHeader
          title="Edit Your Profile"
          description="Update your volunteer profile to help us provide you with the best possible experience. Your information is kept secure and confidential."
        >
          <div className="flex justify-start mt-6">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/profile" data-testid="back-to-profile-link">
                <ArrowLeft className="h-4 w-4" />
                Back to Profile
              </Link>
            </Button>
          </div>
        </PageHeader>

        {initialLoading ? (
          <Card className="shadow-lg border-0 bg-card/80 dark:bg-card/90 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-muted-foreground">
                    Loading your profile...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Progress Indicator */}
            <div className="bg-card dark:bg-card rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" data-testid="profile-setup-progress-heading">
                  Profile Setup Progress
                </h2>
                <Badge variant="outline" className="text-xs" data-testid="step-indicator">
                  Step {currentSection + 1} of {sections.length}
                </Badge>
              </div>
              <div className="hidden md:flex items-center space-x-2 mb-4">
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
                            ? `${section.color} text-white dark:text-white shadow-lg`
                            : index < currentSection
                            ? "bg-green-500 text-white dark:text-white hover:bg-green-600 dark:hover:bg-green-600"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        onClick={() => setCurrentSection(index)}
                        title={`Go to ${section.title}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      {index < sections.length - 1 && (
                        <div
                          className={`flex-1 h-1 mx-2 rounded-full transition-all duration-200 ${
                            index < currentSection
                              ? "bg-green-500 dark:bg-green-600"
                              : "bg-muted dark:bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-center mb-4">
                <h3 className="font-medium text-foreground">
                  {sections[currentSection].title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {sections[currentSection].description}
                </p>
              </div>

              {/* Section Navigation Tabs */}
              <div className="flex flex-wrap gap-2 justify-center">
                {sections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentSection(index)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                      index === currentSection
                        ? "bg-primary text-white dark:text-white shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <Card className="shadow-lg border-0 bg-card/80 dark:bg-card/90 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl" data-testid="current-section-title">
                    {React.createElement(sections[currentSection].icon, {
                      className: "h-6 w-6",
                    })}
                    {sections[currentSection].title}
                  </CardTitle>
                  {/* Always visible save button */}
                  <GradientButton
                    onClick={handleSubmit}
                    disabled={loading}
                    size="sm"
                    className="flex items-center gap-2"
                    data-testid="header-save-button"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save"}
                  </GradientButton>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="min-h-[400px]">{renderCurrentSection()}</div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevSection}
                      disabled={currentSection === 0 || loading}
                      className="flex items-center gap-2"
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
                          className="flex items-center gap-2"
                          data-testid="next-section-button"
                        >
                          Next
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Button>
                      ) : (
                        <GradientButton
                          type="submit"
                          disabled={loading}
                          className="flex items-center gap-2"
                          data-testid="save-notification-preferences"
                        >
                          <Save className="h-4 w-4" />
                          {loading ? "Saving..." : "Save Profile"}
                        </GradientButton>
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