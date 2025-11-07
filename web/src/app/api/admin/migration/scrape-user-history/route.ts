import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNovaScraper } from "@/lib/laravel-nova-scraper";
import {
  NovaAuthConfig,
  NovaUser,
  NovaUserResource,
  NovaEventResource,
  NovaField,
  MigrationProgressEvent,
} from "@/types/nova-migration";
import {
  HistoricalDataTransformer,
  shouldImportSignup,
} from "@/lib/historical-data-transformer";
import { sendProgress as sendProgressUpdate } from "@/lib/sse-utils";
import { notifyAdminsMigrationComplete } from "@/lib/notification-helpers";

interface ScrapeUserRequest {
  userEmail: string;
  novaConfig: {
    baseUrl: string;
    email: string;
    password: string;
  };
  options?: {
    dryRun?: boolean;
    includeShifts?: boolean;
    includeSignups?: boolean;
  };
  sessionId?: string;
}

interface ScrapeUserResponse {
  success: boolean;
  userFound: boolean;
  userCreated?: boolean;
  userAlreadyExists: boolean;
  shiftsFound: number;
  shiftsImported: number;
  signupsFound: number;
  signupsImported: number;
  errors: string[];
  details?: {
    userData?: NovaUserResource;
    shifts?: NovaEventResource[];
    signups?: SignupWithDetails[];
  };
}

interface SignupWithDetails {
  id: number;
  eventId?: number;
  eventName?: string | number;
  positionId?: number;
  positionName?: string | number;
  statusId?: number;
  statusName?: string | number;
}

// Helper function to send progress updates
async function sendProgress(
  sessionId: string | undefined,
  data: Partial<MigrationProgressEvent>
) {
  if (!sessionId) return;

  try {
    await sendProgressUpdate(sessionId, data);
  } catch (error) {
    console.log("Failed to send progress update:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: ScrapeUserRequest = await request.json();
    const { userEmail, novaConfig, options = {}, sessionId } = body;

    if (
      !userEmail ||
      !novaConfig.baseUrl ||
      !novaConfig.email ||
      !novaConfig.password
    ) {
      return NextResponse.json(
        { error: "Missing required fields: userEmail, novaConfig" },
        { status: 400 }
      );
    }

    try {
      // Check if user already exists in our system
      const existingUser = await prisma.user.findUnique({
        where: { email: userEmail.toLowerCase() },
      });

      const response: ScrapeUserResponse = {
        success: false,
        userFound: false,
        userAlreadyExists: !!existingUser,
        shiftsFound: 0,
        shiftsImported: 0,
        signupsFound: 0,
        signupsImported: 0,
        errors: [],
      };

      await sendProgress(sessionId, {
        type: "status",
        message: `🔐 Authenticating with Nova at ${novaConfig.baseUrl}...`,
        stage: "connecting",
      });

      // Create Nova scraper instance
      const scraper = await createNovaScraper({
        baseUrl: novaConfig.baseUrl,
        email: novaConfig.email,
        password: novaConfig.password,
      } as NovaAuthConfig);

      // First, find the user in Nova system using search parameter
      console.log(`Looking for user: ${userEmail} in Nova...`);

      await sendProgress(sessionId, {
        type: "status",
        message: `🔍 Searching Nova database for: ${userEmail}`,
        stage: "fetching",
      });

      let targetNovaUser: NovaUserResource | null = null;
      let userFound = false;

      try {
        // Use Nova's search functionality to find user by email
        await sendProgress(sessionId, {
          type: "status",
          message: `📡 Querying Nova API for user data...`,
          stage: "fetching",
        });

        const novaResponse = await scraper.novaApiRequest(
          `/users?search=${encodeURIComponent(userEmail)}&perPage=100`
        );

        if (
          novaResponse.resources &&
          Array.isArray(novaResponse.resources) &&
          novaResponse.resources.length > 0
        ) {
          // Look through search results to find exact email match
          for (const user of novaResponse.resources) {
            // Extract email from Nova's field structure
            const emailField = user.fields.find(
              (field: NovaField) => field.attribute === "email"
            );
            const userEmail_fromNova = emailField?.value;

            if (
              userEmail_fromNova &&
              typeof userEmail_fromNova === "string" &&
              userEmail_fromNova.toLowerCase() === userEmail.toLowerCase()
            ) {
              targetNovaUser = user;
              userFound = true;
              response.userFound = true;
              console.log(
                `Found user in Nova search results: ${userEmail_fromNova}`
              );
              await sendProgress(sessionId, {
                type: "status",
                message: `✅ User found in Nova: ${userEmail_fromNova}`,
                stage: "fetching",
              });
              break;
            }
          }

          if (!userFound) {
            console.log(
              `User ${userEmail} found in search results but no exact email match`
            );
            if (Array.isArray(novaResponse.resources)) {
              console.log(
                `Search returned ${novaResponse.resources.length} results`
              );
              // Log first user's email for debugging
              if (novaResponse.resources[0]?.fields) {
                const firstUserEmailField =
                  novaResponse.resources[0].fields.find(
                    (field: NovaField) => field.attribute === "email"
                  );
                console.log(
                  `First result email: ${firstUserEmailField?.value}`
                );
              }
            }
          }
        } else {
          console.log(`No users found in Nova search for: ${userEmail}`);
          console.log(`Nova response structure:`, Object.keys(novaResponse));
        }
      } catch (error) {
        console.error(`Error searching Nova users:`, error);
        response.errors.push(
          `Error searching Nova users: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      if (!userFound) {
        await sendProgress(sessionId, {
          type: "status",
          message: `❌ User not found in Nova: ${userEmail}`,
          stage: "complete",
        });
        return NextResponse.json({
          ...response,
          success: true,
          userFound: false,
        });
      }

      console.log(`Found user in Nova:`, targetNovaUser);

      // If user doesn't exist in our system and we're not in dry run mode, create them
      let ourUser = existingUser;
      if (!existingUser && !options.dryRun) {
        try {
          await sendProgress(sessionId, {
            type: "status",
            message: `👤 Creating user account for ${userEmail}...`,
            stage: "processing",
          });
          const transformer = new HistoricalDataTransformer({
            dryRun: false,
            markAsMigrated: true,
          });

          if (!targetNovaUser) {
            throw new Error("Target Nova user is null");
          }

          await sendProgress(sessionId, {
            type: "status",
            message: `📥 Fetching complete user profile from Nova...`,
            stage: "processing",
          });

          const fullUserResponse = await scraper.novaApiRequest(
            `/users/${targetNovaUser.id.value}`
          );
          const fullUserData = fullUserResponse.resource || targetNovaUser;

          const userData = await transformer.transformUser(
            fullUserData as NovaUser,
            scraper
          );
          ourUser = await prisma.user.create({
            data: userData,
          });

          response.userCreated = true;
          console.log(`Created user in our system: ${ourUser.email}`);
          await sendProgress(sessionId, {
            type: "status",
            message: `✅ User account created: ${ourUser.email}`,
            stage: "processing",
          });
        } catch (error) {
          response.errors.push(
            `Error creating user: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Now scrape historical shifts for this user if requested
      if (options.includeShifts !== false && targetNovaUser) {
        try {
          // Extract user ID from Nova structure
          const novaUserId = targetNovaUser.id?.value || targetNovaUser.id;
          console.log(`Scraping event applications for user ${novaUserId}...`);
          await sendProgress(sessionId, {
            type: "status",
            message: `📊 Fetching historical shift data for user...`,
            stage: "processing",
          });

          // Get user's event applications (shift signups) - need to paginate through all results
          const allSignups: NovaUserResource[] = [];
          let page = 1;
          let hasMorePages = true;

          // Get all user's event applications with pagination
          while (hasMorePages) {
            if (page > 1) {
              await sendProgress(sessionId, {
                type: "status",
                message: `📑 Fetching event applications page ${page}...`,
                stage: "processing",
              });
            }

            const signupsResponse = await scraper.novaApiRequest(
              `/event-applications?viaResource=users&viaResourceId=${novaUserId}&viaRelationship=event_applications&perPage=50&page=${page}`
            );

            const resources = Array.isArray(signupsResponse.resources)
              ? signupsResponse.resources
              : [];

            console.log(`[SINGLE] Page ${page} signups response:`, {
              resourceCount: resources.length,
              hasNextPage: !!signupsResponse.next_page_url,
              currentTotal: allSignups.length,
            });

            if (resources.length > 0) {
              allSignups.push(...resources);

              // Check if there are more pages using next_page_url
              if (signupsResponse.next_page_url && resources.length > 0) {
                page++;
              } else {
                hasMorePages = false;
              }
            } else {
              hasMorePages = false;
            }
          }

          if (allSignups.length > 0) {
            console.log(`Found ${allSignups.length} signups for user`);
            await sendProgress(sessionId, {
              type: "status",
              message: `✅ Found ${allSignups.length} historical shift signups`,
              stage: "processing",
            });
          }

          if (allSignups.length > 0) {
            response.signupsFound = allSignups.length;

            // Extract event IDs and application data
            const eventIds = new Set<number>();
            const signupData: SignupWithDetails[] = [];

            for (const signup of allSignups) {
              const eventField = signup.fields.find(
                (f: NovaField) => f.attribute === "event"
              );
              const positionField = signup.fields.find(
                (f: NovaField) => f.attribute === "position"
              );
              const statusField = signup.fields.find(
                (f: NovaField) => f.attribute === "applicationStatus"
              );

              if (eventField && eventField.belongsToId) {
                eventIds.add(eventField.belongsToId);
              }

              signupData.push({
                id: signup.id.value,
                eventId: eventField?.belongsToId,
                eventName:
                  eventField?.value &&
                  eventField.value !== null &&
                  typeof eventField.value !== "object"
                    ? eventField.value
                    : undefined,
                positionId: positionField?.belongsToId,
                positionName:
                  positionField?.value &&
                  positionField.value !== null &&
                  typeof positionField.value !== "object"
                    ? positionField.value
                    : undefined,
                statusId: statusField?.belongsToId,
                statusName:
                  statusField?.value &&
                  statusField.value !== null &&
                  typeof statusField.value !== "object"
                    ? statusField.value
                    : undefined,
              });
            }

            // Get details for events (shifts)
            const eventDetails: NovaEventResource[] = [];

            await sendProgress(sessionId, {
              type: "status",
              message: `🎯 Processing ${eventIds.size} unique events...`,
              stage: "processing",
            });

            let eventCount = 0;
            for (const eventId of eventIds) {
              eventCount++;
              try {
                await sendProgress(sessionId, {
                  type: "status",
                  message: `📥 Fetching event ${eventCount}/${eventIds.size} (ID: ${eventId})...`,
                  stage: "processing",
                });

                const eventResponse = await scraper.novaApiRequest(
                  `/events/${eventId}`
                );
                if (
                  eventResponse.resource &&
                  typeof eventResponse.resource === "object" &&
                  "id" in eventResponse.resource
                ) {
                  eventDetails.push(
                    eventResponse.resource as NovaEventResource
                  );
                }
              } catch (error) {
                console.error(`Error fetching event ${eventId}:`, error);
              }
            }

            response.shiftsFound = eventDetails.length;

            // Filter signups based on applicationStatus and event date
            console.log(
              `[SINGLE] Filtering ${signupData.length} signups based on status and event date...`
            );
            await sendProgress(sessionId, {
              type: "status",
              message: `🔍 Filtering signups based on status rules...`,
              stage: "processing",
            });

            // Create a map of eventId to event date for quick lookup
            const eventDateMap = new Map<number, Date>();
            for (const event of eventDetails) {
              const dateField = event.fields?.find(
                (f: NovaField) => f.attribute === "date"
              );
              if (dateField?.value && typeof dateField.value === "string") {
                eventDateMap.set(event.id.value, new Date(dateField.value));
              }
            }

            // Filter signups based on event date and status
            const filteredSignupData = signupData.filter((signup) => {
              const eventDate = signup.eventId
                ? eventDateMap.get(signup.eventId)
                : undefined;
              if (!eventDate) {
                console.log(
                  `[SINGLE] Skipping signup ${signup.id}: no event date found`
                );
                return false;
              }

              const shouldImport = shouldImportSignup(
                eventDate,
                signup.statusId,
                typeof signup.statusName === "string"
                  ? signup.statusName
                  : undefined
              );

              if (!shouldImport) {
                console.log(
                  `[SINGLE] Filtering out signup ${signup.id} (event ${signup.eventId}): status ${signup.statusId}/${signup.statusName}, event date ${eventDate.toISOString()}`
                );
              }

              return shouldImport;
            });

            console.log(
              `[SINGLE] Filtered signups: ${signupData.length} -> ${filteredSignupData.length} (removed ${signupData.length - filteredSignupData.length})`
            );
            await sendProgress(sessionId, {
              type: "status",
              message: `✅ Filtered to ${filteredSignupData.length} valid signups (removed ${signupData.length - filteredSignupData.length} based on status)`,
              stage: "processing",
            });

            // Update response with filtered counts
            response.signupsFound = filteredSignupData.length;

            // Also filter eventDetails to only include events with valid signups
            const validEventIds = new Set(
              filteredSignupData.map((s) => s.eventId).filter((id) => id)
            );
            const filteredEventDetails = eventDetails.filter((event) =>
              validEventIds.has(event.id.value)
            );
            response.shiftsFound = filteredEventDetails.length;

            // Transform and import data if not dry run
            if (!options.dryRun && ourUser) {
              try {
                await sendProgress(sessionId, {
                  type: "status",
                  message: `🔄 Starting data import for ${ourUser.email}...`,
                  stage: "processing",
                });
                const transformer = new HistoricalDataTransformer({
                  dryRun: false,
                  skipExistingUsers: true,
                  skipExistingShifts: true,
                });

                // Transform and create shifts/signups
                let shiftsImported = 0;
                let signupsImported = 0;

                let processedEventCount = 0;
                for (const eventDetail of filteredEventDetails) {
                  processedEventCount++;
                  await sendProgress(sessionId, {
                    type: "status",
                    message: `💾 Importing event ${processedEventCount}/${filteredEventDetails.length}...`,
                    stage: "processing",
                  });
                  try {
                    // Get signups for this event to determine position/shift type
                    const eventSignups = filteredSignupData.filter(
                      (s) => s.eventId === eventDetail.id.value
                    );

                    // Transform event to shift format with signup position data
                    // Convert SignupWithDetails to SignupDataWithPosition format
                    const mappedSignups = eventSignups.map((signup) => ({
                      positionName:
                        typeof signup.positionName === "string"
                          ? signup.positionName
                          : "Unknown Position",
                    }));

                    const shiftData = transformer.transformEvent(
                      eventDetail,
                      mappedSignups
                    );

                    // Ensure shift type exists
                    let shiftType = await prisma.shiftType.findUnique({
                      where: { name: shiftData.shiftTypeName },
                    });

                    if (!shiftType) {
                      shiftType = await prisma.shiftType.create({
                        data: {
                          name: shiftData.shiftTypeName,
                          description: `Migrated from Nova - ${shiftData.shiftTypeName}`,
                        },
                      });
                    }

                    // Check if shift already exists
                    const existingShift = await prisma.shift.findFirst({
                      where: {
                        // Match based on event name and date
                        notes: {
                          contains: `Nova Event ID: ${eventDetail.id.value}`,
                        },
                      },
                    });

                    let shift = existingShift;
                    if (!existingShift) {
                      const { shiftTypeName, ...shiftCreateData } = shiftData;

                      // Generate clean notes - include meaningful info only
                      const noteParts = [];
                      if (shiftData.notes && shiftData.notes.trim()) {
                        noteParts.push(shiftData.notes.trim());
                      }
                      noteParts.push(`Nova ID: ${eventDetail.id.value}`);

                      shift = await prisma.shift.create({
                        data: {
                          ...shiftCreateData,
                          shiftTypeId: shiftType.id,
                          notes: noteParts.join(" • "),
                        },
                      });
                      shiftsImported++;
                    }

                    // Create signup if shift exists and user signup doesn't exist
                    if (shift) {
                      const userSignups = filteredSignupData.filter(
                        (s) => s.eventId === eventDetail.id.value
                      );

                      for (const signupInfo of userSignups) {
                        const existingSignup = await prisma.signup.findUnique({
                          where: {
                            userId_shiftId: {
                              userId: ourUser.id,
                              shiftId: shift.id,
                            },
                          },
                        });

                        if (!existingSignup) {
                          // Use transformer to properly map Nova status to our SignupStatus
                          // We need to construct a NovaShiftSignup-like object for the transformer
                          const novaSignupLike = {
                            id: { value: signupInfo.id },
                            fields: [],
                            statusId: signupInfo.statusId,
                            statusName:
                              typeof signupInfo.statusName === "string"
                                ? signupInfo.statusName
                                : undefined,
                            status: undefined,
                            canceled_at: undefined,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          };

                          const signupData = transformer.transformSignup(
                            novaSignupLike as any,
                            ourUser.id,
                            shift.id
                          );

                          await prisma.signup.create({
                            data: signupData,
                          });
                          signupsImported++;
                        }
                      }
                    }
                  } catch (error) {
                    response.errors.push(
                      `Error processing event ${eventDetail.id.value}: ${
                        error instanceof Error ? error.message : "Unknown error"
                      }`
                    );
                  }
                }

                response.shiftsImported = shiftsImported;
                response.signupsImported = signupsImported;

                await sendProgress(sessionId, {
                  type: "status",
                  message: `✅ Import complete: ${shiftsImported} events, ${signupsImported} signups created`,
                  stage: "complete",
                });
              } catch (error) {
                response.errors.push(
                  `Error transforming data: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                );
              }
            }

            // Include details if requested
            if (options.dryRun) {
              response.details = {
                userData: targetNovaUser,
                shifts: filteredEventDetails,
                signups: filteredSignupData,
              };
            }
          }
        } catch (error) {
          response.errors.push(
            `Error scraping user shifts: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      response.success = true;

      // Notify admins about single user migration completion if user was created
      if (response.userCreated && !options.dryRun) {
        try {
          await notifyAdminsMigrationComplete({
            type: "single",
            usersProcessed: 1,
            usersCreated: 1,
            errors: response.errors.length,
            duration: 0, // Single user migration is fast
          });
        } catch (notifyError) {
          console.error("Failed to send admin notification:", notifyError);
          // Don't fail the migration if notification fails
        }
      }

      return NextResponse.json(response);
    } catch (error) {
      console.error("Nova scraping error:", error);
      return NextResponse.json(
        {
          success: false,
          userFound: false,
          userAlreadyExists: false,
          shiftsFound: 0,
          shiftsImported: 0,
          signupsFound: 0,
          signupsImported: 0,
          errors: [
            `Nova scraping failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          ],
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Request processing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
