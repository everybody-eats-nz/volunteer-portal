import { prisma } from "@/lib/prisma";
import { LaravelNovaScraper } from "./laravel-nova-scraper";
import {
  ScrapedData,
  NovaUser,
  NovaUserLegacy,
  NovaShift,
  NovaShiftSignup,
  NovaEvent,
  TransformationOptions,
  TransformationResult,
  TransformedUserData,
  TransformedShiftData,
  TransformedSignupData,
  NovaField,
  NovaUserResource,
  NovaEventResource,
  SignupDataWithPosition,
  NovaStatusMapping,
} from "@/types/nova-migration";
import { hash } from "bcryptjs";
import { SignupStatus } from "@/generated/client";
import { profilePhotoDownloader } from "./profile-photo-downloader";
import { randomBytes } from "crypto";
import { createNZDate } from "./timezone";

// Helper function to extract user data from NovaUser union type
function extractUserData(novaUser: NovaUser): { email?: string; id: number } {
  // Check if it's a NovaUserResource (has fields property)
  if ("fields" in novaUser && Array.isArray(novaUser.fields)) {
    const userResource = novaUser as NovaUserResource;
    const emailField = userResource.fields.find((f) => f.attribute === "email");
    const userEmail =
      typeof emailField?.value === "string" ? emailField.value : undefined;
    return { email: userEmail, id: userResource.id.value };
  }

  // Otherwise it's a legacy user
  const legacyUser = novaUser as NovaUserLegacy;
  return { email: legacyUser.email, id: legacyUser.id };
}

// Helper function to extract signup data from Nova resource and format for transformer
export function extractSignupDataFromNovaResource(
  novaResource: NovaUserResource
): NovaShiftSignup {
  // Extract status from fields
  const statusField = novaResource.fields.find(
    (f: NovaField) => f.attribute === "applicationStatus"
  );
  const statusId = statusField?.belongsToId;
  const statusName =
    statusField?.value &&
    statusField.value !== null &&
    typeof statusField.value !== "object"
      ? statusField.value
      : undefined;

  // Return formatted NovaShiftSignup object for transformer
  return {
    id: { value: novaResource.id.value },
    fields: [],
    statusId: statusId,
    statusName: typeof statusName === "string" ? statusName : undefined,
    status: undefined,
    canceled_at: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Types are now imported from @/types/nova-migration

export class HistoricalDataTransformer {
  private options: TransformationOptions;
  private result: TransformationResult;

  constructor(options: TransformationOptions = {}) {
    this.options = {
      dryRun: false,
      skipExistingUsers: true,
      skipExistingShifts: true,
      defaultPassword: "temp_password_123",
      markAsMigrated: true,
      ...options,
    };

    this.result = {
      success: true,
      stats: {
        usersProcessed: 0,
        usersCreated: 0,
        usersSkipped: 0,
        shiftTypesCreated: 0,
        shiftsProcessed: 0,
        shiftsCreated: 0,
        shiftsSkipped: 0,
        signupsProcessed: 0,
        signupsCreated: 0,
        signupsSkipped: 0,
      },
      errors: [],
    };
  }

  /**
   * Transform and import all scraped data
   */
  async transformAndImport(
    scrapedData: ScrapedData
  ): Promise<TransformationResult> {
    console.log("Starting historical data transformation...");
    console.log(
      `Processing ${scrapedData.users.length} users, ${scrapedData.events.length} events, ${scrapedData.signups.length} signups`
    );

    try {
      // Step 1: Process users first
      await this.processUsers(scrapedData.users);

      // Step 2: Process shift types and shifts
      await this.processShifts(scrapedData.events);

      // Step 3: Process signups
      await this.processSignups(scrapedData.signups, scrapedData.users);

      console.log("Historical data transformation completed successfully");
      return this.result;
    } catch (error) {
      console.error("Transformation failed:", error);
      this.result.success = false;
      return this.result;
    }
  }

  /**
   * Process and create users from Nova data
   */
  private async processUsers(novaUsers: NovaUser[]): Promise<void> {
    console.log("Processing users...");

    for (const novaUser of novaUsers) {
      this.result.stats.usersProcessed++;

      try {
        // Check if user already exists
        if (this.options.skipExistingUsers) {
          const userData = extractUserData(novaUser);
          if (!userData.email) {
            continue; // Skip users without email
          }
          const existingUser = await prisma.user.findUnique({
            where: { email: userData.email.toLowerCase() },
          });

          if (existingUser) {
            this.result.stats.usersSkipped++;
            continue;
          }
        }

        if (!this.options.dryRun) {
          // Transform Nova user to Prisma user format
          const userData = await this.transformUser(novaUser);

          const createdUser = await prisma.user.create({
            data: userData,
          });

          console.log(`Created user: ${createdUser.email}`);
        }

        this.result.stats.usersCreated++;
      } catch (error) {
        const userData = extractUserData(novaUser);
        this.result.errors.push({
          type: "user",
          id: userData.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`Failed to process user ${userData.id}:`, error);
      }
    }

    console.log(
      `Users processed: ${this.result.stats.usersCreated} created, ${this.result.stats.usersSkipped} skipped`
    );
  }

  /**
   * Process and create shifts from Nova data
   */
  private async processShifts(novaEvents: NovaEvent[]): Promise<void> {
    console.log("Processing shifts...");

    // First, ensure shift types exist
    const shiftTypeMap = await this.ensureShiftTypes(novaEvents);

    for (const novaEvent of novaEvents) {
      this.result.stats.shiftsProcessed++;

      try {
        // Skip if shift already exists (based on start time, end time, and shift type)
        if (this.options.skipExistingShifts) {
          // For events, we need to extract data from the fields structure
          const eventData = this.transformEvent(novaEvent);

          // Get the shift type ID for matching
          const shiftTypeForMatch = await prisma.shiftType.findUnique({
            where: { name: eventData.shiftTypeName },
          });

          if (shiftTypeForMatch) {
            const existingShift = await prisma.shift.findFirst({
              where: {
                start: eventData.start,
                end: eventData.end,
                shiftTypeId: shiftTypeForMatch.id,
              },
            });

            if (existingShift) {
              console.log(
                `Skipping existing shift: ${
                  eventData.shiftTypeName
                } on ${eventData.start.toISOString()}`
              );
              this.result.stats.shiftsSkipped++;
              continue;
            }
          }
        }

        if (!this.options.dryRun) {
          const shiftData = this.transformEvent(novaEvent);
          const shiftTypeId = shiftTypeMap.get(shiftData.shiftTypeName);

          // Remove non-Prisma properties before database operation
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { shiftTypeName, ...prismaShiftData } = shiftData;

          const createdShift = await prisma.shift.create({
            data: {
              ...prismaShiftData,
              shiftTypeId: shiftTypeId || "default-shift-type-id", // Handle undefined case
            },
            include: { shiftType: true },
          });

          console.log(
            `Created shift: ${
              createdShift.shiftType.name
            } on ${createdShift.start.toISOString()}`
          );
        }

        this.result.stats.shiftsCreated++;
      } catch (error) {
        this.result.errors.push({
          type: "shift",
          id: novaEvent.id.value,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`Failed to process event ${novaEvent.id.value}:`, error);
      }
    }

    console.log(
      `Shifts processed: ${this.result.stats.shiftsCreated} created, ${this.result.stats.shiftsSkipped} skipped`
    );
  }

  /**
   * Process and create signups from Nova data
   */
  private async processSignups(
    novaSignups: NovaShiftSignup[],
    novaUsers: NovaUser[]
  ): Promise<void> {
    console.log("Processing signups...");

    // Create maps for efficient lookup
    const userEmailMap = new Map(
      novaUsers.map((user) => {
        const { email, id } = extractUserData(user);
        return [id, email];
      })
    );

    for (const novaSignup of novaSignups) {
      this.result.stats.signupsProcessed++;

      try {
        // Extract user ID from Nova's field structure
        const userField = novaSignup.fields.find(
          (f: NovaField) => f.attribute === "user"
        );
        const userId = userField?.belongsToId;
        const userEmail = userId ? userEmailMap.get(userId) : undefined;
        if (!userEmail) {
          throw new Error(`User not found for signup ${novaSignup.id.value}`);
        }

        // Find corresponding user and shift in new system
        const user = await prisma.user.findUnique({
          where: { email: userEmail.toLowerCase() },
        });

        if (!user) {
          this.result.stats.signupsSkipped++;
          continue;
        }

        // Find corresponding shift - match by Nova event ID, shift type, to handle
        // multiple shifts per event (day+location)
        const eventField = novaSignup.fields.find(
          (f: NovaField) => f.attribute === "event"
        );
        const eventId = eventField?.belongsToId;

        // Extract position to determine shift type (same logic as transformEvent)
        const positionField = novaSignup.fields.find(
          (f: NovaField) => f.attribute === "position"
        );
        const shiftTypeName =
          typeof positionField?.value === "string"
            ? positionField.value
            : "General Volunteering";

        // Find shift type
        const shiftType = await prisma.shiftType.findUnique({
          where: { name: shiftTypeName },
        });

        if (!shiftType) {
          this.result.stats.signupsSkipped++;
          continue;
        }

        // Find shift matching Nova event ID and shift type
        const shift = await prisma.shift.findFirst({
          where: {
            notes: {
              contains: `Nova ID: ${eventId}`,
            },
            shiftTypeId: shiftType.id,
          },
        });

        if (!shift) {
          this.result.stats.signupsSkipped++;
          continue;
        }

        // Check if signup already exists
        const existingSignup = await prisma.signup.findUnique({
          where: {
            userId_shiftId: {
              userId: user.id,
              shiftId: shift.id,
            },
          },
        });

        if (existingSignup) {
          this.result.stats.signupsSkipped++;
          continue;
        }

        if (!this.options.dryRun) {
          const signupData = this.transformSignup(
            novaSignup,
            user.id,
            shift.id
          );

          const createdSignup = await prisma.signup.create({
            data: signupData,
            include: {
              user: { select: { email: true } },
              shift: { include: { shiftType: true } },
            },
          });

          console.log(
            `Created signup: ${createdSignup.user.email} -> ${createdSignup.shift.shiftType.name}`
          );
        }

        this.result.stats.signupsCreated++;
      } catch (error) {
        this.result.errors.push({
          type: "signup",
          id: novaSignup.id.value,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(
          `Failed to process signup ${novaSignup.id.value}:`,
          error
        );
      }
    }

    console.log(
      `Signups processed: ${this.result.stats.signupsCreated} created, ${this.result.stats.signupsSkipped} skipped`
    );
  }

  /**
   * Transform Nova user to Prisma user format (public method for API usage)
   */
  async transformUser(
    novaUser: NovaUser,
    scraper?: LaravelNovaScraper
  ): Promise<TransformedUserData> {
    // Generate cryptographically secure random password for migrated users (they'll reset it during invitation flow)
    const randomPassword = randomBytes(32).toString("hex");
    const hashedPassword = await hash(randomPassword, 12);

    // Handle both old flat structure and new Nova field structure
    let email: string | undefined,
      firstName: string | undefined,
      lastName: string | undefined,
      phone: string | undefined,
      profilePhoto: string | undefined,
      approvedAt: string | undefined;

    if ("fields" in novaUser && novaUser.fields) {
      // New Nova field structure
      const novaUserResource = novaUser as NovaUserResource;
      email = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "email"
      )?.value as string;
      firstName = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "first_name"
      )?.value as string;
      lastName = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "last_name"
      )?.value as string;
      phone = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "phone"
      )?.value as string;
      approvedAt = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "approved_at"
      )?.value as string;

      // Debug: log all available fields to see what's actually there
      console.log(
        `[DEBUG] Available fields for ${email}:`,
        novaUserResource.fields.map((f: NovaField) => f.attribute)
      );
      console.log(`[DEBUG] Found approved_at value for ${email}:`, approvedAt);

      // Look for profile photo field - Nova uses 'avatar' with advanced media library
      const photoField = novaUserResource.fields.find(
        (f: NovaField) => f.attribute === "avatar"
      );

      if (
        photoField &&
        photoField.value &&
        Array.isArray(photoField.value) &&
        photoField.value.length > 0
      ) {
        // Extract URL from advanced media library structure
        const mediaItem = photoField.value[0];
        if (
          mediaItem &&
          typeof mediaItem === "object" &&
          "__media_urls__" in mediaItem
        ) {
          const mediaUrls = mediaItem.__media_urls__;
          if (mediaUrls) {
            // Use the original image URL for best quality
            profilePhoto =
              mediaUrls.__original__ ||
              mediaUrls.detailView ||
              mediaUrls.form ||
              mediaUrls.preview;
          }
        }
      }
    } else {
      // Old flat structure (backward compatibility)
      const legacyUser = novaUser as NovaUserLegacy; // Type assertion for legacy format
      email = legacyUser.email;
      firstName = legacyUser.first_name;
      lastName = legacyUser.last_name;
      phone = legacyUser.phone;
      profilePhoto =
        "profile_photo" in legacyUser
          ? legacyUser.profile_photo
          : "photo" in legacyUser
          ? legacyUser.photo
          : "avatar" in legacyUser
          ? legacyUser.avatar
          : undefined;
      approvedAt =
        "approved_at" in legacyUser ? legacyUser.approved_at : undefined;
    }

    const name = `${firstName || ""} ${lastName || ""}`.trim() || email;

    // Handle profile photo download and storage
    let profilePhotoUrl = null;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      email &&
      scraper &&
      !this.options.dryRun
    ) {
      try {
        console.log(
          `[PHOTO] Found profile photo for ${email}: ${profilePhoto}`
        );

        // Download and save the profile photo
        const photoResult = await profilePhotoDownloader.downloadNovaPhoto(
          profilePhoto,
          email,
          scraper.getCookies()
        );

        if (photoResult.success && photoResult.base64Data) {
          profilePhotoUrl = photoResult.base64Data;
          console.log(
            `[PHOTO] Successfully downloaded and converted profile photo to base64 (${photoResult.base64Data.length} chars)`
          );
        } else {
          console.error(
            `[PHOTO] Failed to download profile photo for ${email}:`,
            photoResult.error
          );
        }
      } catch (error) {
        console.error(
          `[PHOTO] Error processing profile photo for ${email}:`,
          error
        );
      }
    } else if (profilePhoto && typeof profilePhoto === "string") {
      // Fallback: Just store the URL if no scraper provided or in dry run mode
      if (profilePhoto.startsWith("/")) {
        const baseUrl =
          process.env.NOVA_BASE_URL || "https://app.everybodyeats.nz";
        profilePhotoUrl = `${baseUrl}${profilePhoto}`;
      } else if (profilePhoto.startsWith("http")) {
        profilePhotoUrl = profilePhoto;
      }
      console.log(
        `[PHOTO] Profile photo URL stored (not downloaded): ${profilePhotoUrl}`
      );
    }

    // Parse approved_at date or fallback to current time
    let createdAtDate = new Date(); // Default fallback
    if (approvedAt) {
      try {
        createdAtDate = new Date(approvedAt);
        // Validate the date
        if (isNaN(createdAtDate.getTime())) {
          console.warn(
            `[USER] Invalid approved_at date for ${email}: ${approvedAt}, using current time`
          );
          createdAtDate = new Date();
        } else {
          console.log(
            `[USER] Using approved_at date for ${email}: ${createdAtDate.toISOString()}`
          );
        }
      } catch {
        console.warn(
          `[USER] Error parsing approved_at date for ${email}: ${approvedAt}, using current time`
        );
        createdAtDate = new Date();
      }
    } else {
      console.log(
        `[USER] No approved_at date found for ${
          email || "unknown user"
        }, using current time`
      );
    }

    if (!email) {
      throw new Error("Email is required but was not found in Nova user data");
    }

    return {
      email: email.toLowerCase(),
      name,
      firstName,
      lastName,
      phone,
      profilePhotoUrl,
      dateOfBirth: null, // Nova doesn't seem to have this in the current structure
      emergencyContactName: null, // Not available in current Nova structure
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      medicalConditions: null,
      hashedPassword,
      profileCompleted: false, // Let users complete profile through invitation flow
      isMigrated: this.options.markAsMigrated || false,
      createdAt: createdAtDate, // Use approved_at from Nova or fallback to current time
      updatedAt: new Date(),
    };
  }

  /**
   * Transform Nova shift to Prisma shift format
   */
  private transformShift(
    novaShift: NovaShift,
    shiftTypeMap: Map<string, string>
  ): TransformedShiftData {
    const shiftType =
      "shift_type" in novaShift ? novaShift.shift_type : "default";
    const shiftTypeId = shiftTypeMap.get(shiftType);

    if (!shiftTypeId) {
      throw new Error(`Shift type not found: ${shiftType}`);
    }

    return {
      shiftTypeId,
      shiftTypeName: shiftType,
      start: new Date(
        "start_time" in novaShift ? novaShift.start_time : new Date()
      ),
      end: new Date("end_time" in novaShift ? novaShift.end_time : new Date()),
      location:
        "location" in novaShift ? novaShift.location : "Unknown Location",
      capacity: "capacity" in novaShift ? novaShift.capacity : 10,
      notes: ("notes" in novaShift ? novaShift.notes : "") || "",
      createdAt: new Date(novaShift.created_at ?? new Date()),
      updatedAt: new Date(novaShift.updated_at ?? new Date()),
    };
  }

  /**
   * Transform Nova event to Prisma shift format
   */
  transformEvent(
    novaEvent: NovaEventResource,
    signupData?: SignupDataWithPosition[]
  ): TransformedShiftData {
    // Extract event details from Nova's field structure
    const eventName =
      (novaEvent.fields?.find((f: NovaField) => f.attribute === "name")
        ?.value as string) || "Unknown Event";
    const eventDate = novaEvent.fields?.find(
      (f: NovaField) => f.attribute === "date"
    )?.value as string;
    const location =
      (novaEvent.fields?.find((f: NovaField) => f.attribute === "location")
        ?.value as string) || "Unknown Location";
    const capacity =
      (novaEvent.fields?.find((f: NovaField) => f.attribute === "capacity")
        ?.value as number) || 10;

    // Determine shift type from signup position data if available
    let shiftTypeName = "General Volunteering";
    if (signupData && signupData.length > 0) {
      // Use the first signup's position as the shift type
      const firstSignup = signupData[0];
      if (firstSignup.positionName) {
        shiftTypeName = firstSignup.positionName;
      }
    } else {
      // Fallback to parsing event name if no signup data
      if (eventName.includes("WGTN")) {
        shiftTypeName = "Wellington Event";
      } else if (eventName.includes("AKL")) {
        shiftTypeName = "Auckland Event";
      }
    }

    // Hardcoded shift times based on seed data templates
    const getShiftTimes = (
      shiftType: string
    ): {
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
    } => {
      const normalizedType = shiftType.toLowerCase();

      // Match patterns from seed data
      if (normalizedType.includes("dishwasher")) {
        return { startHour: 17, startMinute: 30, endHour: 21, endMinute: 0 }; // 5:30pm-9:00pm
      } else if (normalizedType.includes("front of house setup")) {
        return { startHour: 16, startMinute: 30, endHour: 21, endMinute: 0 }; // 4:30pm-9:00pm
      } else if (normalizedType.includes("front of house")) {
        return { startHour: 17, startMinute: 30, endHour: 21, endMinute: 0 }; // 5:30pm-9:00pm
      } else if (normalizedType.includes("kitchen prep")) {
        return { startHour: 12, startMinute: 0, endHour: 16, endMinute: 0 }; // 12:00pm-4:00pm
      } else if (
        normalizedType.includes("kitchen service") ||
        normalizedType.includes("kitchen pack")
      ) {
        return { startHour: 17, startMinute: 30, endHour: 21, endMinute: 0 }; // 5:30pm-9:00pm
      } else if (normalizedType.includes("media")) {
        return { startHour: 17, startMinute: 0, endHour: 19, endMinute: 0 }; // 5:00pm-7:00pm
      } else if (normalizedType.includes("flexible")) {
        return { startHour: 16, startMinute: 0, endHour: 21, endMinute: 0 }; // 4:00pm-9:00pm
      } else {
        // Default times for unknown shift types
        return { startHour: 17, startMinute: 30, endHour: 21, endMinute: 0 }; // 5:30pm-9:00pm
      }
    };

    // Parse base date from event
    let dateString: string | null = null;
    if (eventDate) {
      // Extract just the date part (YYYY-MM-DD) from the date string
      dateString = eventDate.split("T")[0];
    } else if (eventName.includes("Sunday")) {
      // Try to parse date from event name
      const match = eventName.match(/(\d+)(?:st|nd|rd|th)\s+(\w+)/);
      if (match) {
        const [, day, month] = match;
        const year = new Date().getFullYear();
        const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
        // Format as YYYY-MM-DD
        dateString = `${year}-${String(monthIndex + 1).padStart(
          2,
          "0"
        )}-${String(day).padStart(2, "0")}`;
      }
    }

    // If no date could be parsed, fallback to today
    if (!dateString) {
      const today = new Date();
      dateString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }

    // Apply hardcoded times based on shift type - create dates in NZ timezone
    const times = getShiftTimes(shiftTypeName);
    const startDate = createNZDate(
      dateString,
      times.startHour,
      times.startMinute,
      0
    );
    const endDate = createNZDate(dateString, times.endHour, times.endMinute, 0);

    console.log(
      `[SHIFT_TIMES] ${shiftTypeName} on ${dateString}: ${startDate.toISOString()} - ${endDate.toISOString()} (NZ time: ${startDate.toLocaleString(
        "en-NZ",
        { timeZone: "Pacific/Auckland" }
      )} - ${endDate.toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
      })})`
    );

    // Generate clean notes - only include meaningful event name
    let notes = "";
    if (eventName && eventName !== "Unknown Event") {
      notes = `Event: ${eventName}`;
    }

    return {
      shiftTypeId: null, // Will be resolved when creating the shift
      start: startDate,
      end: endDate,
      location: location,
      capacity: parseInt(capacity.toString()) || 10,
      notes: notes,
      createdAt: this.parseDate(novaEvent.created_at),
      updatedAt: this.parseDate(novaEvent.updated_at),
      shiftTypeName, // Helper field for creating shift type
    };
  }

  /**
   * Safely parse date values, returning current date if invalid
   */
  private parseDate(dateValue: string | undefined): Date {
    if (!dateValue) return new Date();
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Transform Nova signup to Prisma signup format
   */
  transformSignup(
    novaSignup: NovaShiftSignup,
    userId: string,
    shiftId: string
  ): TransformedSignupData {
    // Map Nova status to Prisma SignupStatus
    // Nova uses numeric IDs: 1=Requested, 2=Draft, 3=Confirmed, 4=Waitlist, 5=Attended, 6=Cancelled, 7=Not Needed, 8=Unavailable, 9=No Show
    const statusMap: NovaStatusMapping = {
      // Numeric IDs from Nova
      "1": SignupStatus.PENDING, // Requested
      "2": SignupStatus.PENDING, // Draft
      "3": SignupStatus.CONFIRMED, // Confirmed
      "4": SignupStatus.WAITLISTED, // Waitlist
      "5": SignupStatus.CONFIRMED, // Attended (treat as confirmed)
      "6": SignupStatus.CANCELED, // Cancelled
      "7": SignupStatus.NOT_NEEDED, // Not Needed
      "8": SignupStatus.UNAVAILABLE, // Unavailable
      "9": SignupStatus.NO_SHOW, // No Show

      // String fallbacks for backward compatibility
      requested: SignupStatus.PENDING,
      draft: SignupStatus.PENDING,
      confirmed: SignupStatus.CONFIRMED,
      waitlist: SignupStatus.WAITLISTED,
      waitlisted: SignupStatus.WAITLISTED,
      attended: SignupStatus.CONFIRMED,
      cancelled: SignupStatus.CANCELED,
      canceled: SignupStatus.CANCELED,
      "not needed": SignupStatus.NOT_NEEDED,
      unavailable: SignupStatus.UNAVAILABLE,
      "no show": SignupStatus.NO_SHOW,
      no_show: SignupStatus.NO_SHOW,
    };

    // Try to get status from statusId (numeric) first, then fall back to status name
    const statusId = novaSignup.statusId?.toString();
    const statusName = novaSignup.statusName?.toLowerCase();
    const rawStatus = novaSignup.status?.toLowerCase();

    const status =
      (statusId && statusMap[statusId]) ||
      (statusName && statusMap[statusName]) ||
      (rawStatus && statusMap[rawStatus]) ||
      SignupStatus.PENDING;

    console.log(
      `[SIGNUP] Mapping status for signup - statusId: ${statusId}, statusName: ${statusName}, rawStatus: ${rawStatus} -> ${status}`
    );

    return {
      userId,
      shiftId,
      status,
      canceledAt: novaSignup.canceled_at
        ? this.parseDate(novaSignup.canceled_at)
        : null,
      createdAt: this.parseDate(novaSignup.created_at),
      updatedAt: this.parseDate(novaSignup.updated_at),
    };
  }

  /**
   * Ensure all shift types exist, create if necessary
   */
  private async ensureShiftTypes(
    novaEvents: NovaEvent[]
  ): Promise<Map<string, string>> {
    // Extract shift types from events by transforming them
    const uniqueShiftTypes = [
      ...new Set(
        novaEvents.map((event) => {
          const eventData = this.transformEvent(event);
          return eventData.shiftTypeName;
        })
      ),
    ];
    const shiftTypeMap = new Map<string, string>();

    for (const shiftTypeName of uniqueShiftTypes) {
      try {
        let shiftType = await prisma.shiftType.findUnique({
          where: { name: shiftTypeName },
        });

        if (!shiftType && !this.options.dryRun) {
          shiftType = await prisma.shiftType.create({
            data: {
              name: shiftTypeName,
              description: `Migrated from legacy system - ${shiftTypeName}`,
            },
          });
          this.result.stats.shiftTypesCreated++;
          console.log(`Created shift type: ${shiftTypeName}`);
        }

        if (shiftType) {
          shiftTypeMap.set(shiftTypeName, shiftType.id);
        }
      } catch (error) {
        console.error(`Failed to create shift type ${shiftTypeName}:`, error);
      }
    }

    return shiftTypeMap;
  }

  /**
   * Get transformation statistics
   */
  getStats(): TransformationResult["stats"] {
    return this.result.stats;
  }

  /**
   * Get transformation errors
   */
  getErrors(): TransformationResult["errors"] {
    return this.result.errors;
  }
}

/**
 * Utility function to run a complete historical data import
 */
export async function importHistoricalData(
  scrapedData: ScrapedData,
  options: TransformationOptions = {}
): Promise<TransformationResult> {
  const transformer = new HistoricalDataTransformer(options);
  return await transformer.transformAndImport(scrapedData);
}

export type { TransformationResult, TransformationOptions };

/**
 * Helper function to determine if a signup should be imported based on applicationStatus and event date
 * Rules:
 * - Past events: Only import "Attended" (statusId = 5)
 * - Future events: Only import "Request" (statusId = 1) or "Confirmed" (statusId = 3)
 * - Ignore all other statuses
 */
export function shouldImportSignup(
  eventDate: Date,
  statusId: number | string | undefined,
  statusName: string | undefined
): boolean {
  const now = new Date();
  const isPastEvent = eventDate < now;

  // Convert statusId to number if it's a string
  const numericStatusId =
    typeof statusId === "string" ? parseInt(statusId, 10) : statusId;

  // Normalize status name for string-based matching
  const normalizedStatusName = statusName?.toLowerCase().trim();

  if (isPastEvent) {
    // Past events: Only import "Attended" (statusId = 5)
    return (
      numericStatusId === 5 ||
      normalizedStatusName === "attended" ||
      normalizedStatusName === "5"
    );
  } else {
    // Future events: Only import "Request" (statusId = 1) or "Confirmed" (statusId = 3)
    return (
      numericStatusId === 1 ||
      numericStatusId === 3 ||
      normalizedStatusName === "requested" ||
      normalizedStatusName === "request" ||
      normalizedStatusName === "confirmed" ||
      normalizedStatusName === "1" ||
      normalizedStatusName === "3"
    );
  }
}
