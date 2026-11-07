import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Longest personal message the server accepts with a request. */
export const FRIEND_REQUEST_MESSAGE_MAX_LENGTH = 500;

type SendByEmailInput = { email: string; message?: string };

/**
 * Sends a friend request to whoever signed up with an email address, for
 * adding a volunteer who isn't among the suggestions.
 */
export function useAddFriend() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ email, message }: SendByEmailInput) =>
      api<{ ok: true; requestId: string }>("/api/mobile/friends/requests", {
        method: "POST",
        body: { email, message: message || undefined },
      }),
    onSuccess: () => {
      // The person may have been a suggestion; they drop off the list now
      // that a request is pending.
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.recommended(),
      });
    },
  });

  return {
    sendRequest: mutation.mutateAsync,
    isSending: mutation.isPending,
  };
}

/**
 * Turns a failed request into what to tell the volunteer. The server's own
 * wording is written for the web's generic form, so the common cases get
 * copy that says what to do next.
 */
export function addFriendErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Couldn’t send the request. Check your connection and try again.";
  }
  switch (error.status) {
    case 404:
      return "No volunteer has signed up with that email. Check it’s the one they use for Everybody Eats.";
    case 403:
      return "They aren’t accepting friend requests right now.";
    case 409:
      return /already sent/i.test(error.message)
        ? "You’ve already sent them a request."
        : "You’re already friends, or they’ve sent you a request. Check your friend requests.";
    case 400:
      return /yourself/i.test(error.message)
        ? "That’s your own email."
        : error.message;
    default:
      return error.message || "Couldn’t send the request. Try again.";
  }
}
