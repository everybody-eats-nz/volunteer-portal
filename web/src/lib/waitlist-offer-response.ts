/**
 * The accept/decline half of a waitlist offer, shared by the web and mobile
 * routes so both behave identically. Authorization is the caller's job; this
 * only needs to know which user is answering.
 */

import {
  acceptWaitlistOffer,
  declineWaitlistOffer,
  WaitlistOfferError,
} from "@/lib/waitlist-offers.server";

export type WaitlistOfferAction = "accept" | "decline";

export function parseWaitlistOfferAction(
  value: unknown
): WaitlistOfferAction | null {
  return value === "accept" || value === "decline" ? value : null;
}

export interface WaitlistOfferResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Applies the volunteer's answer and turns any expected failure into the
 * response the client should get. Unexpected failures are left to throw.
 */
export async function respondToWaitlistOffer(
  signupId: string,
  userId: string,
  action: WaitlistOfferAction
): Promise<WaitlistOfferResponse> {
  try {
    if (action === "accept") {
      const { signup } = await acceptWaitlistOffer(signupId, userId);
      return {
        status: 200,
        body: {
          id: signup.id,
          status: signup.status,
          message: "You're confirmed for this shift. Ngā mihi!",
        },
      };
    }

    const { signup } = await declineWaitlistOffer(signupId, userId);
    return {
      status: 200,
      body: {
        id: signup.id,
        status: signup.status,
        message: "No worries - we've passed the place to the next person.",
      },
    };
  } catch (err) {
    if (err instanceof WaitlistOfferError) {
      return { status: err.status, body: { error: err.message } };
    }
    throw err;
  }
}
