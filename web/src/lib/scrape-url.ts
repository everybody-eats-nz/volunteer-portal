import { parseHTML } from "linkedom";

/** Tags whose entire subtree should be removed before extraction. */
const REMOVE_TAGS = new Set([
  "script", "style", "noscript", "iframe", "svg", "canvas",
  "nav", "footer", "header",
]);

/** CSS classes whose elements (and children) should be stripped. */
const REMOVE_CLASSES = new Set([
  "nav-wrapper", "footer",
]);

/** Inline elements — should NOT cause line breaks. */
const INLINE_TAGS = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data",
  "dfn", "em", "i", "kbd", "mark", "q", "rp", "rt", "ruby",
  "s", "samp", "small", "span", "strong", "sub", "sup", "time",
  "u", "var", "wbr",
]);

/** Block elements that get line separators. */
const BLOCK_RE = /^(div|section|article|main|aside|p|h[1-6]|ul|ol|li|table|tr|blockquote|figure|figcaption|details|summary|address|dl|dt|dd)$/;

/**
 * Returns true if the element should be skipped entirely (tag or class match).
 */
function shouldRemove(el: Element): boolean {
  const tag = el.tagName?.toLowerCase();
  if (REMOVE_TAGS.has(tag)) return true;

  const className = el.getAttribute?.("class") ?? "";
  if (className) {
    const classes = className.split(/\s+/);
    if (classes.some((c) => REMOVE_CLASSES.has(c))) return true;
  }

  return false;
}

/**
 * Check if a node's subtree contains any block-level children.
 * If not, we can safely use textContent to preserve inline flow.
 */
function hasBlockChildren(el: Element): boolean {
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      const childEl = child as Element;
      const childTag = childEl.tagName?.toLowerCase();
      if (BLOCK_RE.test(childTag) || childTag === "br") return true;
      if (hasBlockChildren(childEl)) return true;
    }
  }
  return false;
}

/**
 * Collect inline text from an element, flattening all inline children
 * into a single string. This prevents apostrophes, links, bold text etc.
 * from being split onto separate lines.
 */
function collectInlineText(node: ChildNode): string {
  if (node.nodeType === 3) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== 1) return "";

  const el = node as Element;
  const tag = el.tagName?.toLowerCase();

  if (shouldRemove(el)) return "";
  if (el.getAttribute?.("aria-hidden") === "true") return "";
  if (tag === "br") return "\n";

  let result = "";
  for (const child of el.childNodes) {
    result += collectInlineText(child);
  }
  return result;
}

/**
 * Clean a collected text string: strip zero-width chars, collapse whitespace.
 */
function cleanText(text: string): string {
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/[ \t]+/g, " ")                      // collapse horizontal whitespace
    .trim();
}

/**
 * Walk the DOM tree depth-first, stripping boilerplate elements and
 * collecting the remaining text with basic structural markers (headings,
 * list items, block separators).
 *
 * Inline elements (spans, links, bold, etc.) are collected as continuous
 * text to avoid splitting words around markup boundaries.
 */
export function extractStructuredText(root: Element): string {
  const lines: string[] = [];

  function walk(node: ChildNode) {
    if (node.nodeType !== 1 /* ELEMENT */ && node.nodeType !== 3 /* TEXT */) {
      return;
    }

    // Text node — only reached for direct children of block elements
    if (node.nodeType === 3) {
      const text = cleanText(node.textContent ?? "");
      if (text) lines.push(text);
      return;
    }

    const el = node as Element;
    const tag = el.tagName?.toLowerCase();

    // Remove boilerplate subtrees
    if (shouldRemove(el)) return;

    // Skip hidden elements
    if (el.getAttribute?.("aria-hidden") === "true") return;

    const isBlock = BLOCK_RE.test(tag);

    if (isBlock) lines.push("");

    // Headings: collect all inline text as one string
    const headingMatch = tag?.match(/^h([1-6])$/);
    if (headingMatch) {
      const text = cleanText(el.textContent ?? "");
      if (text) {
        lines.push("");
        lines.push("#".repeat(Number(headingMatch[1])) + " " + text);
        lines.push("");
        return;
      }
    }

    // List items: collect all inline text as one string
    if (tag === "li") {
      const text = cleanText(el.textContent ?? "");
      if (text) {
        lines.push("- " + text);
        return;
      }
    }

    // For block elements without block children (e.g. <p> with inline spans),
    // collect all text as one continuous string
    if (isBlock && !hasBlockChildren(el)) {
      const text = cleanText(collectInlineText(el));
      if (text) lines.push(text);
      if (isBlock) lines.push("");
      return;
    }

    // Otherwise walk children (block elements containing other blocks)
    for (const child of el.childNodes) {
      walk(child);
    }

    if (isBlock) lines.push("");
  }

  walk(root);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ \n/g, "\n")
    .trim();
}

/**
 * Fetch a URL and extract its readable text content.
 * Returns `{ text, title }` on success, or `null` on failure.
 */
export async function scrapeUrl(url: string): Promise<{ text: string; title: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "EverybodyEats-ChatBot/1.0 (content extraction for AI context)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) return null;

    const html = await response.text();
    const { document } = parseHTML(html);
    const main = document.querySelector("main") ?? document.body;
    if (!main) return null;

    const text = extractStructuredText(main);
    if (!text) return null;

    const parsedUrl = new URL(url);
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const title = ogTitle || document.title || parsedUrl.hostname;

    return { text: text.slice(0, 50000), title };
  } catch {
    return null;
  }
}
