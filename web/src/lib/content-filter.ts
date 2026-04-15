import { Filter } from "bad-words";

/**
 * Content filter for user-generated content.
 * Satisfies Apple App Store Guideline 1.2 requirement for a filtering mechanism.
 *
 * Uses the `bad-words` library which handles leet-speak, mixed-case, and
 * unicode variations that a hand-rolled regex list would miss.
 * Human review of ContentReport records remains the primary moderation layer.
 */
const filter = new Filter();

/**
 * Returns an error message if the text is rejected, or null if it passes.
 */
export function filterContent(text: string): string | null {
  if (filter.isProfane(text)) {
    return "Your message contains language that is not allowed. Please keep the conversation respectful.";
  }
  return null;
}
