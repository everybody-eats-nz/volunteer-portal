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
 * Walk the DOM tree depth-first, stripping boilerplate elements and
 * collecting the remaining text with basic structural markers (headings,
 * list items, block separators).
 */
export function extractStructuredText(root: Element): string {
  const lines: string[] = [];

  function walk(node: ChildNode) {
    if (node.nodeType !== 1 /* ELEMENT */ && node.nodeType !== 3 /* TEXT */) {
      return;
    }

    // Text node
    if (node.nodeType === 3) {
      const text = (node.textContent ?? "").trim();
      if (text) lines.push(text);
      return;
    }

    const el = node as Element;
    const tag = el.tagName?.toLowerCase();

    // Remove boilerplate subtrees
    if (shouldRemove(el)) return;

    // Skip hidden elements
    if (el.getAttribute?.("aria-hidden") === "true") return;

    const isBlock = /^(div|section|article|main|aside|p|h[1-6]|ul|ol|li|table|tr|blockquote|figure|figcaption|details|summary|address|dl|dt|dd)$/.test(tag);

    if (isBlock) lines.push("");

    // Heading markers
    const headingMatch = tag?.match(/^h([1-6])$/);
    if (headingMatch) {
      const text = (el.textContent ?? "").trim();
      if (text) {
        lines.push("");
        lines.push("#".repeat(Number(headingMatch[1])) + " " + text);
        lines.push("");
        return;
      }
    }

    // List item markers
    if (tag === "li") {
      const text = (el.textContent ?? "").trim();
      if (text) {
        lines.push("- " + text);
        return;
      }
    }

    for (const child of el.childNodes) {
      walk(child);
    }

    if (isBlock) lines.push("");
  }

  walk(root);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
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
