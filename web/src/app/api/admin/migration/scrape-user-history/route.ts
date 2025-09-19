import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createNovaScraper } from "@/lib/laravel-nova-scraper";
import {
  NovaAuthConfig,
  NovaUser,
  ScrapeUserHistoryRequest,
  ScrapeUserHistoryResponse,
  NovaUserResource,
  NovaEventResource,
  NovaField,
  MigrationProgressEvent
} from "@/types/nova-migration";
import { HistoricalDataTransformer } from "@/lib/historical-data-transformer";
import { sendProgress as sendProgressUpdate } from "../progress/route";
import { SignupStatus } from "@prisma/client";

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
async function sendProgress(sessionId: string | undefined, data: Partial<MigrationProgressEvent>) {
  if (!sessionId) return;

  try {
    sendProgressUpdate(sessionId, data);
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
        message: "Connecting to Nova...",
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
        message: `Searching for user: ${userEmail}`,
        stage: "fetching",
      });

      let targetNovaUser: NovaUserResource | null = null;
      let userFound = false;

      try {
        // Use Nova's search functionality to find user by email
        const novaResponse = await scraper.novaApiRequest(
          `/users?search=${encodeURIComponent(userEmail)}&perPage=100`
        );

        if (novaResponse.resources && Array.isArray(novaResponse.resources) && novaResponse.resources.length > 0) {
          // Look through search results to find exact email match
          for (const user of novaResponse.resources) {
            // Extract email from Nova's field structure
            const emailField = user.fields.find(
              (field: NovaField) => field.attribute === "email"
            );
            const userEmail_fromNova = emailField?.value;

            if (
              userEmail_fromNova &&
              userEmail_fromNova.toLowerCase() === userEmail.toLowerCase()
            ) {
              targetNovaUser = user;
              userFound = true;
              response.userFound = true;
              console.log(
                `Found user in Nova search results: ${userEmail_fromNova}`
              );
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
                const firstUserEmailField = novaResponse.resources[0].fields.find(
                  (field: NovaField) => field.attribute === "email"
                );
                console.log(`First result email: ${firstUserEmailField?.value}`);
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
          const transformer = new HistoricalDataTransformer({
            dryRun: false,
            markAsMigrated: true,
          });

          if (!targetNovaUser) {
            throw new Error('Target Nova user is null');
          }

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

          // Get user's event applications (shift signups) - need to paginate through all results
          const allSignups: NovaUserResource[] = [];
          let page = 1;
          let hasMorePages = true;

          // Get all user's event applications with pagination
          while (hasMorePages) {
            const signupsResponse = await scraper.novaApiRequest(
              `/event-applications?viaResource=users&viaResourceId=${novaUserId}&viaRelationship=event_applications&perPage=50&page=${page}`
            );

            const resources = Array.isArray(signupsResponse.resources) ? signupsResponse.resources : [];
            
            console.log(`[SINGLE] Page ${page} signups response:`, {
              resourceCount: resources.length,
              hasNextPage: !!signupsResponse.next_page_url,
              currentTotal: allSignups.length,
            });

            if (resources.length > 0) {
              allSignups.push(...resources);

              // Check if there are more pages using next_page_url
              if (
                signupsResponse.next_page_url &&
                resources.length > 0
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
            console.log(`Found ${allSignups.length} signups for user`);
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
                eventName: (eventField?.value && eventField.value !== null && typeof eventField.value !== 'object') ? eventField.value : undefined,
                positionId: positionField?.belongsToId,
                positionName: (positionField?.value && positionField.value !== null && typeof positionField.value !== 'object') ? positionField.value : undefined,
                statusId: statusField?.belongsToId,
                statusName: (statusField?.value && statusField.value !== null && typeof statusField.value !== 'object') ? statusField.value : undefined,
              });
            }

            // Get details for events (shifts)
            const eventDetails: NovaEventResource[] = [];
            for (const eventId of eventIds) {
              try {
                const eventResponse = await scraper.novaApiRequest(
                  `/events/${eventId}`
                );
                if (eventResponse.resource && typeof eventResponse.resource === 'object' && 'id' in eventResponse.resource) {
                  eventDetails.push(eventResponse.resource as NovaEventResource);
                }
              } catch (error) {
                console.error(`Error fetching event ${eventId}:`, error);
              }
            }

            response.shiftsFound = eventDetails.length;

            // Transform and import data if not dry run
            if (!options.dryRun && ourUser) {
              try {
                const transformer = new HistoricalDataTransformer({
                  dryRun: false,
                  skipExistingUsers: true,
                  skipExistingShifts: true,
                });

                // Transform and create shifts/signups
                let shiftsImported = 0;
                let signupsImported = 0;

                for (const eventDetail of eventDetails) {
                  try {
                    // Get signups for this event to determine position/shift type
                    const eventSignups = signupData.filter(
                      (s) => s.eventId === eventDetail.id.value
                    );

                    // Transform event to shift format with signup position data
                    // Convert SignupWithDetails to SignupDataWithPosition format
                    const mappedSignups = eventSignups.map(signup => ({
                      eventId: signup.eventId,
                      positionName: signup.positionName,
                      // Add other required fields as needed
                    }));
                    
                    const shiftData = transformer.transformEvent(
                      eventDetail,
                      mappedSignups as any
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
                          notes: noteParts.join(' • '),
                        },
                      });
                      shiftsImported++;
                    }

                    // Create signup if shift exists and user signup doesn't exist
                    if (shift) {
                      const userSignups = signupData.filter(
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
                          // Manually create signup data since transformSignup doesn't exist yet
                          await prisma.signup.create({
                            data: {
                              userId: ourUser.id,
                              shiftId: shift.id,
                              status: 'CONFIRMED' as SignupStatus,
                              createdAt: new Date(),
                              updatedAt: new Date(),
                            },
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
                shifts: eventDetails,
                signups: signupData,
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
          errors: [`Nova scraping failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`],
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
