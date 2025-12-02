import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNovaScraper } from "@/lib/laravel-nova-scraper";
import {
  NovaAuthConfig,
  NovaUserResource,
  NovaEventResource,
  NovaShiftSignupResource,
  NovaField,
  MigrationProgressEvent,
  SignupDataWithPosition,
} from "@/types/nova-migration";
import {
  HistoricalDataTransformer,
  shouldImportSignup,
} from "@/lib/historical-data-transformer";
import { sendProgress as sendProgressUpdate } from "@/lib/sse-utils";

interface BatchImportHistoryRequest {
  userEmails: string[];
  novaConfig: {
    baseUrl: string;
    email: string;
    password: string;
  };
  options?: {
    dryRun?: boolean;
  };
  sessionId?: string;
}

interface BatchImportHistoryResponse {
  success: boolean;
  totalUsers: number;
  usersProcessed: number;
  usersWithHistory: number;
  totalShifts: number;
  totalSignups: number;
  errors: string[];
  duration: number;
  userResults: {
    email: string;
    success: boolean;
    shiftsImported: number;
    signupsImported: number;
    error?: string;
  }[];
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
  const startTime = Date.now();

  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: BatchImportHistoryRequest = await request.json();
    const { userEmails, novaConfig, options = {}, sessionId } = body;

    if (!userEmails || userEmails.length === 0) {
      return NextResponse.json(
        { error: "No user emails provided" },
        { status: 400 }
      );
    }

    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      return NextResponse.json(
        { error: "Missing required Nova configuration" },
        { status: 400 }
      );
    }

    const { dryRun = false } = options;

    const response: BatchImportHistoryResponse = {
      success: false,
      totalUsers: userEmails.length,
      usersProcessed: 0,
      usersWithHistory: 0,
      totalShifts: 0,
      totalSignups: 0,
      errors: [],
      duration: 0,
      userResults: [],
    };

    console.log(
      `[BATCH HISTORY] Starting batch historical data import for ${userEmails.length} users${dryRun ? " (DRY RUN)" : ""}`
    );

    await sendProgress(sessionId, {
      type: "status",
      message: `Starting batch historical data import for ${userEmails.length} users${dryRun ? " (DRY RUN)" : ""}...`,
      stage: "connecting",
    });

    try {
      // Create Nova scraper instance and authenticate
      await sendProgress(sessionId, {
        type: "status",
        message: `🔐 Authenticating with Nova at ${novaConfig.baseUrl}...`,
        stage: "connecting",
      });

      const scraper = await createNovaScraper({
        baseUrl: novaConfig.baseUrl,
        email: novaConfig.email,
        password: novaConfig.password,
      } as NovaAuthConfig);

      const transformer = new HistoricalDataTransformer({
        dryRun: dryRun,
        skipExistingUsers: true,
        markAsMigrated: true,
      });

      // Process each user
      for (const userEmail of userEmails) {
        response.usersProcessed++;

        await sendProgress(sessionId, {
          type: "progress",
          message: `🔄 Processing user ${response.usersProcessed}/${response.totalUsers}: ${userEmail}`,
          stage: "processing",
          currentUser: userEmail,
          usersProcessed: response.usersProcessed,
          totalUsers: response.totalUsers,
        });

        const userResult: {
          email: string;
          success: boolean;
          shiftsImported: number;
          signupsImported: number;
          error?: string;
        } = {
          email: userEmail,
          success: false,
          shiftsImported: 0,
          signupsImported: 0,
        };

        try {
          // Find user in our system
          const ourUser = await prisma.user.findUnique({
            where: { email: userEmail.toLowerCase() },
          });

          if (!ourUser) {
            userResult.error = "User not found in local database";
            response.errors.push(`User ${userEmail} not found in local database`);
            response.userResults.push(userResult);
            continue;
          }

          // Find user in Nova
          await sendProgress(sessionId, {
            type: "status",
            message: `🔍 Searching Nova for ${userEmail}...`,
            stage: "processing",
          });

          const novaResponse = await scraper.novaApiRequest(
            `/users?search=${encodeURIComponent(userEmail)}&perPage=100`
          );

          let targetNovaUser: NovaUserResource | null = null;

          if (
            novaResponse.resources &&
            Array.isArray(novaResponse.resources) &&
            novaResponse.resources.length > 0
          ) {
            for (const user of novaResponse.resources) {
              const emailField = user.fields.find(
                (field: NovaField) => field.attribute === "email"
              );
              const userEmailFromNova = emailField?.value;

              if (
                userEmailFromNova &&
                typeof userEmailFromNova === "string" &&
                userEmailFromNova.toLowerCase() === userEmail.toLowerCase()
              ) {
                targetNovaUser = user;
                break;
              }
            }
          }

          if (!targetNovaUser) {
            userResult.error = "User not found in Nova";
            response.errors.push(`User ${userEmail} not found in Nova`);
            response.userResults.push(userResult);
            continue;
          }

          const novaUserId = targetNovaUser.id.value;

          await sendProgress(sessionId, {
            type: "status",
            message: `📊 Fetching historical data for ${userEmail}...`,
            stage: "processing",
          });

          // Get user's event applications with pagination
          const allSignups: NovaShiftSignupResource[] = [];
          let page = 1;
          let hasMorePages = true;

          while (hasMorePages) {
            if (page > 1) {
              await sendProgress(sessionId, {
                type: "status",
                message: `📑 Fetching signups page ${page} for ${userEmail}...`,
                stage: "processing",
              });
            }

            const signupsResponse = await scraper.novaApiRequest(
              `/event-applications?viaResource=users&viaResourceId=${novaUserId}&viaRelationship=event_applications&perPage=50&page=${page}`
            );

            const resources = Array.isArray(signupsResponse.resources)
              ? signupsResponse.resources
              : [];

            if (resources.length > 0) {
              allSignups.push(...resources);

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
            await sendProgress(sessionId, {
              type: "status",
              message: `✅ Found ${allSignups.length} signups for ${userEmail}`,
              stage: "processing",
            });

            // Extract event IDs
            const eventIds = new Set<number>();
            for (const signup of allSignups) {
              const eventField = signup.fields.find(
                (f: NovaField) => f.attribute === "event"
              );
              if (eventField?.belongsToId) {
                eventIds.add(eventField.belongsToId);
              }
            }

            // Import shifts and signups
            let shiftsImported = 0;
            let signupsImported = 0;

            await sendProgress(sessionId, {
              type: "status",
              message: `🎯 Processing ${eventIds.size} events for ${userEmail}...`,
              stage: "processing",
            });

            let processedEvents = 0;
            for (const eventId of eventIds) {
              processedEvents++;

              try {
                // Only send progress updates every 5 events to avoid overwhelming SSE
                if (
                  processedEvents % 5 === 1 ||
                  processedEvents === eventIds.size ||
                  eventIds.size <= 5
                ) {
                  await sendProgress(sessionId, {
                    type: "status",
                    message: `📅 Processing event ${processedEvents}/${eventIds.size} for ${userEmail}...`,
                    stage: "processing",
                  });
                }

                // Get event details
                const eventResponse = await scraper.novaApiRequest(
                  `/events/${eventId}`
                );

                if (
                  !eventResponse.resource ||
                  typeof eventResponse.resource !== "object" ||
                  Object.keys(eventResponse.resource).length === 0
                ) {
                  continue;
                }

                const eventResource = eventResponse.resource as NovaEventResource;
                const dateField = eventResource.fields?.find(
                  (f: NovaField) => f.attribute === "date"
                );
                const eventDate = dateField?.value
                  ? new Date(dateField.value as string)
                  : null;

                if (!eventDate) {
                  console.log(
                    `[BATCH HISTORY] Skipping event ${eventId}: no date found`
                  );
                  continue;
                }

                // Get signups for this event
                const eventSignups = allSignups.filter((s: NovaUserResource) => {
                  const eventField = s.fields.find(
                    (f: NovaField) => f.attribute === "event"
                  );
                  return eventField?.belongsToId === eventId;
                });

                // Filter signups based on applicationStatus and event date
                const filteredEventSignups = eventSignups.filter(
                  (signup: NovaUserResource) => {
                    const statusField = signup.fields.find(
                      (f: NovaField) => f.attribute === "applicationStatus"
                    );
                    const statusId = statusField?.belongsToId;
                    const statusName =
                      statusField?.value &&
                      statusField.value !== null &&
                      typeof statusField.value !== "object"
                        ? String(statusField.value)
                        : undefined;

                    return shouldImportSignup(eventDate, statusId, statusName);
                  }
                );

                // Skip this event if no valid signups remain after filtering
                if (filteredEventSignups.length === 0) {
                  continue;
                }

                // Extract signup data with positions
                const signupData: SignupDataWithPosition[] =
                  filteredEventSignups.map((signup: NovaUserResource) => ({
                    positionName:
                      (signup.fields.find(
                        (f: NovaField) => f.attribute === "position"
                      )?.value as string) || "General Volunteering",
                  }));

                // Transform event to shift with signup position data
                const shiftData = transformer.transformEvent(
                  eventResource,
                  signupData
                );

                // Create or find shift type
                let shiftType;
                if (dryRun) {
                  shiftType = {
                    id: `dry-run-shift-type-${Date.now()}`,
                    name: shiftData.shiftTypeName,
                  };
                } else {
                  shiftType = await prisma.shiftType.findUnique({
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
                }

                // Check if shift already exists by Nova Event ID (same logic as single user import)
                let shift;
                if (dryRun) {
                  shift = {
                    id: `dry-run-shift-${eventId}`,
                    shiftTypeId: shiftType.id,
                  };
                  shiftsImported++;
                } else {
                  const existingShift = await prisma.shift.findFirst({
                    where: {
                      notes: {
                        contains: `Nova ID: ${eventResource.id.value}`,
                      },
                    },
                  });

                  shift = existingShift;
                  if (!existingShift) {
                    const noteParts = [];
                    if (shiftData.notes && shiftData.notes.trim()) {
                      noteParts.push(shiftData.notes.trim());
                    }
                    noteParts.push(`Nova ID: ${eventResource.id.value}`);

                    shift = await prisma.shift.create({
                      data: {
                        shiftTypeId: shiftType.id,
                        start: shiftData.start,
                        end: shiftData.end,
                        location: shiftData.location,
                        capacity: shiftData.capacity,
                        notes: noteParts.join(" • "),
                        createdAt: shiftData.createdAt,
                        updatedAt: shiftData.updatedAt,
                      },
                    });
                    shiftsImported++;
                  }
                }

                // Create signups for this shift
                if (shift) {
                  for (const signupInfo of filteredEventSignups) {
                    if (dryRun) {
                      signupsImported++;
                    } else {
                      const existingSignup = await prisma.signup.findUnique({
                        where: {
                          userId_shiftId: {
                            userId: ourUser.id,
                            shiftId: shift.id,
                          },
                        },
                      });

                      if (!existingSignup) {
                        // Extract status from fields (same pattern as single user import)
                        const statusField = signupInfo.fields.find(
                          (f: NovaField) => f.attribute === "applicationStatus"
                        );
                        const statusId = statusField?.belongsToId;
                        const statusName =
                          statusField?.value &&
                          statusField.value !== null &&
                          typeof statusField.value !== "object"
                            ? String(statusField.value)
                            : undefined;

                        // Construct NovaShiftSignupResource for transformer (same as single user import)
                        const novaSignupLike: NovaShiftSignupResource = {
                          id: { value: signupInfo.id.value },
                          fields: [],
                          statusId: statusId,
                          statusName: statusName,
                          status: undefined,
                          canceled_at: undefined,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        };

                        await prisma.signup.create({
                          data: transformer.transformSignup(
                            novaSignupLike,
                            ourUser.id,
                            shift.id
                          ),
                        });
                        signupsImported++;
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(
                  `[BATCH HISTORY] Error processing event ${eventId}:`,
                  error
                );
              }
            }

            userResult.shiftsImported = shiftsImported;
            userResult.signupsImported = signupsImported;
            userResult.success = true;

            response.totalShifts += shiftsImported;
            response.totalSignups += signupsImported;

            if (shiftsImported > 0 || signupsImported > 0) {
              response.usersWithHistory++;
            }

            await sendProgress(sessionId, {
              type: "status",
              message: `✅ Completed ${userEmail}: ${shiftsImported} events, ${signupsImported} signups`,
              stage: "processing",
            });
          } else {
            userResult.success = true;
            await sendProgress(sessionId, {
              type: "status",
              message: `ℹ️ No historical data found for ${userEmail}`,
              stage: "processing",
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          userResult.error = errorMessage;
          response.errors.push(`Error processing ${userEmail}: ${errorMessage}`);
        }

        response.userResults.push(userResult);
      }

      response.success = true;
      response.duration = Date.now() - startTime;

      console.log(`[BATCH HISTORY] Batch import completed in ${response.duration}ms`);
      console.log(`[BATCH HISTORY] Results:`, {
        totalUsers: response.totalUsers,
        usersWithHistory: response.usersWithHistory,
        totalShifts: response.totalShifts,
        totalSignups: response.totalSignups,
        errors: response.errors.length,
      });

      await sendProgress(sessionId, {
        type: "complete",
        message: `Batch import completed! ${response.usersWithHistory} users with historical data imported`,
        stage: "complete",
      });

      return NextResponse.json(response);
    } catch (error) {
      console.error("Batch historical import error:", error);
      response.errors.push(
        `Batch import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      response.duration = Date.now() - startTime;
      return NextResponse.json(response, { status: 500 });
    }
  } catch (error) {
    console.error("Request processing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
