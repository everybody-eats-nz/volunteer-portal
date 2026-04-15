/**
 * Basic content filter for user-generated content.
 * Satisfies Apple App Store Guideline 1.2 requirement for a filtering mechanism.
 *
 * This checks for a list of commonly objectionable terms. It is not exhaustive —
 * human review of ContentReport records is the primary moderation layer.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  /\bf+u+c+k+\b/gi,
  /\bs+h+i+t+\b/gi,
  /\bc+u+n+t+\b/gi,
  /\bn+i+g+g+e+r+\b/gi,
  /\bn+i+g+g+a+\b/gi,
  /\bf+a+g+g+o+t+\b/gi,
  /\bc+h+i+n+k+\b/gi,
  /\bk+i+k+e+\b/gi,
  /\bs+p+i+c+\b/gi,
  /\bc+o+o+n+\b/gi,
  /\bw+h+o+r+e+\b/gi,
  /\bs+l+u+t+\b/gi,
  /\ba+s+s+h+o+l+e+\b/gi,
  /\bb+i+t+c+h+\b/gi,
  /\bd+i+c+k+\b/gi,
  /\bc+o+c+k+\b/gi,
  /\bp+u+s+s+y+\b/gi,
  /\bt+w+a+t+\b/gi,
  /\bc+r+a+c+k+e+r+\b/gi,
  /\bm+o+t+h+e+r+f+u+c+k+e+r+\b/gi,
];

/**
 * Returns true if the text contains blocked content.
 */
export function containsBlockedContent(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns an error message if the text is rejected, or null if it passes.
 */
export function filterContent(text: string): string | null {
  if (containsBlockedContent(text)) {
    return "Your message contains language that is not allowed. Please keep the conversation respectful.";
  }
  return null;
}
