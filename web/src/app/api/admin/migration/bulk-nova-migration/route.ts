import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNovaScraper } from "@/lib/laravel-nova-scraper";
import {
  NovaAuthConfig,
  NovaUser,
  NovaUserResource,
  NovaUserLegacy,
  NovaShiftSignupResource,
  NovaEventResource,
  BulkMigrationRequest,
  BulkMigrationResponse,
  NovaField,
  MigrationProgressEvent,
  SignupDataWithPosition,
} from "@/types/nova-migration";
import { HistoricalDataTransformer } from "@/lib/historical-data-transformer";
import { sendProgress as sendProgressUpdate } from "@/lib/sse-utils";
import { randomBytes } from "crypto";

// Types are now imported from @/types/nova-migration

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

// Helper function to send progress updates
async function sendProgress(
  sessionId: string | undefined,
  data: Partial<MigrationProgressEvent>
) {
  if (!sessionId) {
    console.log("[SSE] No sessionId provided for progress update");
    return;
  }

  try {
    console.log(
      `[SSE] Sending progress update for session ${sessionId}:`,
      data.message || data.type
    );
    sendProgressUpdate(sessionId, data);
  } catch (error) {
    console.error("[SSE] Failed to send progress update:", error);
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

    const body: BulkMigrationRequest = await request.json();
    const { novaConfig, options = {}, sessionId } = body;

    if (!novaConfig.baseUrl || !novaConfig.email || !novaConfig.password) {
      return NextResponse.json(
        { error: "Missing required Nova configuration" },
        { status: 400 }
      );
    }

    const {
      skipExistingUsers = true,
      includeHistoricalData = true,
      batchSize = 50,
      dryRun = false,
    } = options;

    const response: BulkMigrationResponse = {
      success: false,
      totalUsers: 0,
      usersProcessed: 0,
      usersCreated: 0,
      usersSkipped: 0,
      usersWithHistory: 0,
      totalShifts: 0,
      totalSignups: 0,
      errors: [],
      duration: 0,
      dryRun: dryRun,
    };

    console.log(
      `[BULK] Starting bulk Nova migration${dryRun ? " (DRY RUN)" : ""}`
    );

    await sendProgress(sessionId, {
      type: "status",
      message: `Starting bulk migration${dryRun ? " (DRY RUN)" : ""}...`,
      stage: "connecting",
    });

    try {
      // Create Nova scraper instance and authenticate
      await sendProgress(sessionId, {
        type: "status",
        message: "Authenticating with Nova...",
        stage: "connecting",
      });

      const scraper = await createNovaScraper({
        baseUrl: novaConfig.baseUrl,
        email: novaConfig.email,
        password: novaConfig.password,
      } as NovaAuthConfig);

      // Step 1: Scrape users from Nova (limited for dev)
      console.log(
        `[BULK] Step 1: Scraping users from Nova (limited to ${batchSize} for dev)...`
      );
      await sendProgress(sessionId, {
        type: "status",
        message: "Fetching users from Nova...",
        stage: "fetching",
      });

      // For actual migration, respect batch size limit
      const allNovaUsers = await scraper.scrapeUsers(batchSize);
      response.totalUsers = allNovaUsers.length;
      console.log(`[BULK] Found ${allNovaUsers.length} users to process`);

      await sendProgress(sessionId, {
        type: "status",
        message: `Found ${allNovaUsers.length} users to migrate`,
        stage: "processing",
        totalUsers: allNovaUsers.length,
      });

      // Step 2: Process users in batches
      const transformer = new HistoricalDataTransformer({
        dryRun: dryRun,
        skipExistingUsers,
        markAsMigrated: true,
      });

      for (let i = 0; i < allNovaUsers.length; i += batchSize) {
        const batch = allNovaUsers.slice(i, i + batchSize);
        console.log(
          `[BULK] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            allNovaUsers.length / batchSize
          )} (${batch.length} users)`
        );

        for (const novaUser of batch) {
          try {
            response.usersProcessed++;

            // Extract email from Nova user structure
            const userData = extractUserData(novaUser);
            const userEmail = userData.email;

            if (!userEmail) {
              response.errors.push(`User ${userData.id} has no email address`);
              continue;
            }

            // Send progress update for current user
            await sendProgress(sessionId, {
              type: "progress",
              message: `Processing user: ${userEmail}`,
              stage: "processing",
              currentUser: userEmail,
              usersProcessed: response.usersProcessed,
              totalUsers: response.totalUsers,
              usersCreated: response.usersCreated,
              usersSkipped: response.usersSkipped,
            });

            // Check if user already exists
            if (skipExistingUsers) {
              const existingUser = await prisma.user.findUnique({
                where: { email: userEmail.toLowerCase() },
              });

              if (existingUser) {
                response.usersSkipped++;
                console.log(`[BULK] Skipping existing user: ${userEmail}`);
                continue;
              }
            }

            // Fetch full user details to get all fields including approved_at
            const userId = userData.id;

            await sendProgress(sessionId, {
              type: "status",
              message: `Fetching full details for ${userEmail}...`,
              stage: "processing",
            });

            const fullUserResponse = await scraper.novaApiRequest(
              `/users/${userId}`
            );
            const fullUserData =
              fullUserResponse.resource || fullUserResponse.data || novaUser;

            // Ensure we have valid user data
            if (
              !fullUserData ||
              (typeof fullUserData === "object" &&
                Object.keys(fullUserData).length === 0)
            ) {
              throw new Error(`No valid user data found for user ${userId}`);
            }

            // Create user in our system (pass scraper for photo downloads) or simulate
            const transformedUserData = await transformer.transformUser(
              fullUserData as NovaUser,
              scraper
            );
            let newUser;

            if (dryRun) {
              // In dry run, just simulate user creation with fake ID
              newUser = {
                ...transformedUserData,
                id: `dry-run-${Date.now()}-${randomBytes(8).toString("hex")}`,
              };
              console.log(
                `[BULK] [DRY RUN] Would create user: ${newUser.email}`
              );
            } else {
              newUser = await prisma.user.create({
                data: transformedUserData,
              });
              console.log(`[BULK] Created user: ${newUser.email}`);
            }

            response.usersCreated++;

            // Step 3: Import historical data if requested
            if (includeHistoricalData) {
              try {
                const novaUserId = userData.id;

                await sendProgress(sessionId, {
                  type: "status",
                  message: `Importing historical data for ${userEmail}...`,
                  stage: "processing",
                });

                // Get user's event applications with pagination
                const allSignups: NovaShiftSignupResource[] = [];
                let page = 1;
                let hasMorePages = true;

                // Get all user's event applications with pagination
                while (hasMorePages) {
                  const signupsResponse = await scraper.novaApiRequest(
                    `/event-applications?viaResource=users&viaResourceId=${novaUserId}&viaRelationship=event_applications&perPage=50&page=${page}`
                  );

                  console.log(`[BULK] Page ${page} signups response:`, {
                    resourceCount: Array.isArray(signupsResponse.resources)
                      ? signupsResponse.resources.length
                      : 0,
                    hasNextPage: !!signupsResponse.next_page_url,
                    currentTotal: allSignups.length,
                  });

                  if (
                    signupsResponse.resources &&
                    Array.isArray(signupsResponse.resources) &&
                    signupsResponse.resources.length > 0
                  ) {
                    allSignups.push(...signupsResponse.resources);

                    // Check if there are more pages using next_page_url
                    if (
                      signupsResponse.next_page_url &&
                      signupsResponse.resources.length > 0
                    ) {
                      page++;
                    } else {
                      hasMorePages = false;
                    }
                  } else {
                    hasMorePages = false;
                  }
                }

                if (allSignups.length > 0) {
                  console.log(
                    `[BULK] Found ${allSignups.length} signups for user`
                  );

                  await sendProgress(sessionId, {
                    type: "status",
                    message: `Found ${allSignups.length} shifts for ${userEmail}, processing...`,
                    stage: "processing",
                  });
                }

                if (allSignups.length > 0) {
                  response.usersWithHistory++;

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
                    message: `Processing ${eventIds.size} unique shifts for ${userEmail}...`,
                    stage: "processing",
                  });

                  let processedEvents = 0;
                  for (const eventId of eventIds) {
                    processedEvents++;
                    try {
                      // Only send progress updates every 5 shifts to avoid overwhelming SSE
                      if (
                        processedEvents % 5 === 1 ||
                        processedEvents === eventIds.size ||
                        eventIds.size <= 5
                      ) {
                        await sendProgress(sessionId, {
                          type: "status",
                          message: `Processing shift ${processedEvents}/${eventIds.size} for ${userEmail}...`,
                          stage: "processing",
                        });
                      }

                      // Get event details
                      const eventResponse = await scraper.novaApiRequest(
                        `/events/${eventId}`
                      );
                      if (
                        eventResponse.resource &&
                        typeof eventResponse.resource === "object" &&
                        Object.keys(eventResponse.resource).length > 0
                      ) {
                        // Get signups for this event to determine position/shift type
                        const eventSignups = allSignups.filter(
                          (s: NovaUserResource) => {
                            const eventField = s.fields.find(
                              (f: NovaField) => f.attribute === "event"
                            );
                            return eventField?.belongsToId === eventId;
                          }
                        );

                        // Extract signup data with positions
                        const signupData: SignupDataWithPosition[] =
                          eventSignups.map((signup: NovaUserResource) => ({
                            positionName:
                              (signup.fields.find(
                                (f: NovaField) => f.attribute === "position"
                              )?.value as string) || "General Volunteering",
                          }));

                        // Transform event to shift with signup position data
                        const shiftData = transformer.transformEvent(
                          eventResponse.resource as NovaEventResource,
                          signupData
                        );

                        // Create or find shift type (or simulate in dry run)
                        let shiftType;
                        if (dryRun) {
                          // In dry run, simulate shift type
                          shiftType = {
                            id: `dry-run-shift-type-${Date.now()}`,
                            name: shiftData.shiftTypeName,
                            description: `Migrated from Nova - ${shiftData.shiftTypeName}`,
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

                        // Check if shift already exists (or simulate in dry run)
                        let shift;
                        if (dryRun) {
                          // In dry run, simulate shift creation
                          // Generate clean notes - include meaningful info only
                          const noteParts = [];
                          if (shiftData.notes && shiftData.notes.trim()) {
                            noteParts.push(shiftData.notes.trim());
                          }
                          noteParts.push(`Nova ID: ${eventId}`);

                          const { notes: _, ...shiftDataWithoutNotes } =
                            shiftData;
                          shift = {
                            id: `dry-run-shift-${eventId}`,
                            shiftTypeId: shiftType.id,
                            notes: noteParts.join(" • "),
                            ...shiftDataWithoutNotes,
                          };
                          shiftsImported++;
                        } else {
                          const existingShift = await prisma.shift.findFirst({
                            where: {
                              notes: { contains: `Nova ID: ${eventId}` },
                            },
                          });

                          shift = existingShift;
                          if (!existingShift) {
                            const { shiftTypeName, ...shiftCreateData } =
                              shiftData;

                            // Generate clean notes - include meaningful info only
                            const noteParts = [];
                            if (shiftData.notes && shiftData.notes.trim()) {
                              noteParts.push(shiftData.notes.trim());
                            }
                            noteParts.push(`Nova ID: ${eventId}`);

                            shift = await prisma.shift.create({
                              data: {
                                ...shiftCreateData,
                                shiftTypeId: shiftType.id,
                                notes: noteParts.join(" • "),
                              },
                            });
                            shiftsImported++;
                          }
                        }

                        // Create signups for this shift
                        if (shift) {
                          const userSignups = allSignups.filter(
                            (s: NovaUserResource) => {
                              const eventField = s.fields.find(
                                (f: NovaField) => f.attribute === "event"
                              );
                              return eventField?.belongsToId === eventId;
                            }
                          );

                          for (const signupInfo of userSignups) {
                            if (dryRun) {
                              // In dry run, just simulate signup creation
                              signupsImported++;
                            } else {
                              const existingSignup =
                                await prisma.signup.findUnique({
                                  where: {
                                    userId_shiftId: {
                                      userId: newUser.id,
                                      shiftId: shift.id,
                                    },
                                  },
                                });

                              if (!existingSignup) {
                                await prisma.signup.create({
                                  data: transformer.transformSignup(
                                    signupInfo,
                                    newUser.id,
                                    shift.id
                                  ),
                                });
                                signupsImported++;
                              }
                            }
                          }
                        }
                      }
                    } catch (error) {
                      response.errors.push(
                        `Error processing event ${eventId} for user ${userEmail}: ${
                          error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`
                      );
                    }
                  }

                  response.totalShifts += shiftsImported;
                  response.totalSignups += signupsImported;

                  console.log(
                    `[BULK] Imported ${shiftsImported} shifts and ${signupsImported} signups for ${userEmail}`
                  );

                  await sendProgress(sessionId, {
                    type: "status",
                    message: `✅ Completed ${userEmail}: ${shiftsImported} shifts, ${signupsImported} signups imported`,
                    stage: "processing",
                  });
                }
              } catch (error) {
                response.errors.push(
                  `Error importing historical data for ${userEmail}: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                );
              }
            }
          } catch (error) {
            const userData = extractUserData(novaUser);
            const userEmail = userData.email || "unknown";
            response.errors.push(
              `Error processing user ${userEmail}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }

        // Add small delay between batches to avoid overwhelming the system
        if (i + batchSize < allNovaUsers.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      response.success = true;
      response.duration = Date.now() - startTime;

      console.log(`[BULK] Migration completed in ${response.duration}ms`);
      console.log(`[BULK] Results:`, {
        totalUsers: response.totalUsers,
        usersCreated: response.usersCreated,
        usersSkipped: response.usersSkipped,
        usersWithHistory: response.usersWithHistory,
        totalShifts: response.totalShifts,
        totalSignups: response.totalSignups,
        errors: response.errors.length,
      });

      // Send completion update
      await sendProgress(sessionId, {
        type: "complete",
        message: `Migration completed! ${response.usersCreated} users were migrated`,
        stage: "complete",
        ...response,
      });

      return NextResponse.json(response);
    } catch (error) {
      console.error("Bulk Nova migration error:", error);
      response.errors.push(
        `Migration failed: ${
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
