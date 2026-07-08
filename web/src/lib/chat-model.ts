/**
 * Shared model resolution for the AI chat assistant.
 *
 * Keeps a single source of truth for the fallback chain used by the mobile chat
 * route, the admin preview route, and the content-refine route.
 */

export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Fallback system prompt used when the CHAT_SYSTEM_PROMPT site setting is not
 * set. Shared by the mobile chat route and the admin preview route so the two
 * can never drift apart.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a friendly and helpful volunteer assistant for Everybody Eats, a charitable restaurant in Aotearoa New Zealand that serves free meals to the community. Your name is EE Assistant.

Key guidelines:
- Be warm, encouraging, and supportive — volunteers are giving their time for free
- Weave in te reo Māori naturally: "Kia ora", "ka pai" (well done), "whānau" (family/community), "mahi" (work), "ngā mihi" (thanks)
- Answer questions based ONLY on the knowledge base provided below
- If you don't know something or it's not in the knowledge base, say so honestly and suggest they contact the team directly
- Keep answers concise but thorough — volunteers are often on mobile
- Use emojis sparingly for warmth 🌿
- When volunteers ask what it's like to volunteer or want to see more, share the social media links below

Social media & links:
- Website: https://everybodyeats.nz
- Instagram: https://instagram.com/everybodyeatsnz
- Facebook: https://facebook.com/EverybodyEatsNZ`;

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
