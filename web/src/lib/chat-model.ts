/**
 * Shared model resolution for the AI chat assistant.
 *
 * Keeps a single source of truth for the fallback chain used by the mobile chat
 * route, the admin preview route, and the content-refine route.
 */

export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4";

/**
 * Resolve the OpenRouter model id from an ordered list of candidate sources.
 * The first non-blank value wins; blank/whitespace values are skipped so they
 * fall through to the next source. Falls back to {@link DEFAULT_CHAT_MODEL}.
 *
 * Typical order: request override → CHAT_MODEL setting → OPENROUTER_MODEL env.
 */
export function resolveChatModel(
  ...sources: (string | null | undefined)[]
): string {
  for (const source of sources) {
    const value = source?.trim();
    if (value) return value;
  }
  return DEFAULT_CHAT_MODEL;
}

/**
 * Permissive validation for an OpenRouter model id. Intentionally loose: it
 * only rejects obviously-wrong input (spaces, empty, absurd length) while
 * allowing provider/model slugs with optional tags, e.g.
 * "anthropic/claude-sonnet-4" or "anthropic/claude-3.5-sonnet:beta".
 */
export function isValidChatModelId(value: string): boolean {
  return /^[\w./:-]+$/.test(value) && value.length <= 100;
}
