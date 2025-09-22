import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";

export interface BotVerificationResult {
  isBot: boolean;
  confidence?: number;
  [key: string]: unknown;
}

/**
 * Verifies if the request is from a bot using Vercel Bot ID
 * @returns Bot verification result
 */
export async function verifyBotId(): Promise<BotVerificationResult> {
  try {
    const verification = await checkBotId();
    return verification;
  } catch (error) {
    console.warn("Bot ID verification failed:", error);
    // In case of error, assume not a bot to avoid blocking legitimate users
    return { isBot: false };
  }
}

/**
 * Middleware function to check for bots and return appropriate response
 * @param customErrorMessage Optional custom error message for bot detection
 * @returns NextResponse if bot detected, null if legitimate user
 */
export async function checkForBot(
  customErrorMessage?: string
): Promise<NextResponse | null> {
  const verification = await verifyBotId();

  if (verification.isBot) {
    return NextResponse.json(
      {
        error: customErrorMessage || "Bot detected. Access denied.",
        botDetection: {
          confidence: verification.confidence,
          timestamp: new Date().toISOString()
        }
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Higher-order function to wrap API route handlers with bot protection
 * @param handler The original API route handler
 * @param options Configuration options
 * @returns Protected API route handler
 */
export function withBotProtection<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
  options?: {
    errorMessage?: string;
    enableLogging?: boolean;
  }
) {
  return async (...args: T): Promise<NextResponse> => {
    const botResponse = await checkForBot(options?.errorMessage);

    if (botResponse) {
      if (options?.enableLogging) {
        console.log("Bot request blocked:", {
          timestamp: new Date().toISOString(),
        });
      }
      return botResponse;
    }

    return handler(...args);
  };
}