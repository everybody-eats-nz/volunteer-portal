import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { MigrationRegistrationForm } from "./migration-registration-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

async function getLocationOptions() {
  // Get all unique locations from shifts that are not null
  const shifts = await prisma.shift.findMany({
    select: {
      location: true,
    },
    where: {
      location: {
        not: null,
      },
    },
  });

  // Extract unique locations, clean all whitespace, and sort them
  const uniqueLocations = [
    ...new Set(
      shifts
        .map((shift: { location: string | null }) => shift.location)
        .filter(
          (location: string | null): location is string => location !== null
        )
        .map((location: string) => location.replace(/\s+/g, " ").trim()) // Clean all whitespace
        .filter((location: string) => location.length > 0) // Remove empty strings
    ),
  ].sort();

  // Transform to the format expected by the frontend
  return uniqueLocations.map((location) => ({
    value: location,
    label: location,
  }));
}

async function getShiftTypes() {
  const shiftTypes = await prisma.shiftType.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return shiftTypes;
}

async function validateToken(token: string) {
  if (!token) return null;

  try {
    // Find user by migration invitation token
    const user = await prisma.user.findFirst({
      where: {
        migrationInvitationToken: token,
        migrationTokenExpiresAt: { gt: new Date() }, // Token must not be expired
        profileCompleted: false, // User hasn't completed registration yet
        role: "VOLUNTEER",
        isMigrated: true // Must be a migrated user
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        medicalConditions: true,
        availableDays: true,
        availableLocations: true,
        profilePhotoUrl: true,
        migrationTokenExpiresAt: true, // Include for debugging
      }
    });

    if (!user) {
      // For debugging - check if token exists but doesn't match other criteria
      const tokenExists = await prisma.user.findFirst({
        where: { migrationInvitationToken: token },
        select: { 
          id: true, 
          email: true, 
          profileCompleted: true, 
          migrationTokenExpiresAt: true,
          isMigrated: true,
          role: true 
        }
      });
      
      if (tokenExists) {
        console.log(`Token found but user doesn't match criteria:`, {
          email: tokenExists.email,
          profileCompleted: tokenExists.profileCompleted,
          tokenExpired: tokenExists.migrationTokenExpiresAt ? tokenExists.migrationTokenExpiresAt <= new Date() : 'no expiry',
          isMigrated: tokenExists.isMigrated,
          role: tokenExists.role
        });
      } else {
        console.log(`Token not found in database: ${token}`);
      }
    }

    return user;
  } catch (error) {
    console.error('Error validating migration token:', error);
    return null;
  }
}

export default async function MigrationRegistrationPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  
  // If user is already logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { token } = params;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="no-token-title">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Invalid Registration Link
            </CardTitle>
            <CardDescription>
              The registration link is missing required information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please use the registration link from your invitation email, or contact the volunteer coordinator for assistance.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [user, locationOptions, shiftTypes] = await Promise.all([
    validateToken(token),
    getLocationOptions(),
    getShiftTypes(),
  ]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="error-title">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Invalid or Expired Link
            </CardTitle>
            <CardDescription>
              This registration link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="error-description">
                This registration link may have:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Expired (links are valid for 7 days)</li>
                  <li>Already been used to complete registration</li>
                  <li>Been replaced by a newer invitation</li>
                  <li>Invalid token format</li>
                </ul>
                Please contact the volunteer coordinator for a new invitation.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Everybody Eats!</h1>
            <p className="text-muted-foreground mt-2">
              Complete your registration to access the new volunteer portal
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                We&apos;ve migrated your information from the previous system. Please review and complete your profile setup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading...</div>}>
                <MigrationRegistrationForm 
                  user={user} 
                  token={token} 
                  locationOptions={locationOptions}
                  shiftTypes={shiftTypes}
                />
              </Suspense>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}