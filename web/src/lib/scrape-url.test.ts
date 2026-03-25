import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";

import { extractStructuredText, scrapeUrl } from "./scrape-url";

/** Helper: parse an HTML string and run extraction on its body (or main).
 *  Wraps in <html> if needed — linkedom requires it for proper child parsing. */
function extract(html: string): string {
  const wrapped = html.includes("<html") ? html : `<html>${html}</html>`;
  const { document } = parseHTML(wrapped);
  const root = document.querySelector("main") ?? document.body;
  return extractStructuredText(root);
}

describe("extractStructuredText", () => {
  it("extracts plain text from paragraphs", () => {
    const result = extract("<body><p>Hello world</p></body>");
    expect(result).toBe("Hello world");
  });

  it("preserves heading structure with markdown markers", () => {
    const result = extract(`
      <body>
        <h1>Main Title</h1>
        <p>Some content</p>
        <h2>Subtitle</h2>
        <p>More content</p>
      </body>
    `);
    expect(result).toContain("# Main Title");
    expect(result).toContain("## Subtitle");
    expect(result).toContain("Some content");
    expect(result).toContain("More content");
  });

  it("converts list items with dash markers", () => {
    const result = extract(`
      <body>
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      </body>
    `);
    expect(result).toContain("- First item");
    expect(result).toContain("- Second item");
    expect(result).toContain("- Third item");
  });

  it("strips <script> and <style> tags entirely", () => {
    const result = extract(`
      <body>
        <p>Visible content</p>
        <script>alert("hidden")</script>
        <style>.foo { color: red; }</style>
        <p>Also visible</p>
      </body>
    `);
    expect(result).toContain("Visible content");
    expect(result).toContain("Also visible");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("color");
  });

  it("strips <nav> and <footer> tags", () => {
    const result = extract(`
      <body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <main>
          <p>Main content</p>
        </main>
        <footer><p>Copyright 2024</p></footer>
      </body>
    `);
    expect(result).toContain("Main content");
    expect(result).not.toContain("Home");
    expect(result).not.toContain("About");
    expect(result).not.toContain("Copyright");
  });

  it("strips elements with class='nav-wrapper'", () => {
    const result = extract(`
      <body>
        <div class="nav-wrapper">
          <a href="/">Home</a>
          <a href="/menu">Menu</a>
        </div>
        <p>Restaurant info here</p>
      </body>
    `);
    expect(result).toContain("Restaurant info here");
    expect(result).not.toContain("Home");
    expect(result).not.toContain("Menu");
  });

  it("strips elements with class='footer'", () => {
    const result = extract(`
      <body>
        <p>Page content</p>
        <div class="footer">
          <p>Footer links and legal stuff</p>
        </div>
      </body>
    `);
    expect(result).toContain("Page content");
    expect(result).not.toContain("Footer links");
  });

  it("strips class='footer' even when combined with other classes", () => {
    const result = extract(`
      <body>
        <p>Content</p>
        <div class="site-section footer dark-theme">
          <p>Should be removed</p>
        </div>
      </body>
    `);
    expect(result).toContain("Content");
    expect(result).not.toContain("Should be removed");
  });

  it("skips aria-hidden elements", () => {
    const result = extract(`
      <body>
        <p>Visible</p>
        <div aria-hidden="true"><p>Screen reader hidden</p></div>
        <p>Also visible</p>
      </body>
    `);
    expect(result).toContain("Visible");
    expect(result).toContain("Also visible");
    expect(result).not.toContain("Screen reader hidden");
  });

  it("collapses excessive whitespace", () => {
    const result = extract(`
      <body>
        <div></div>
        <div></div>
        <div></div>
        <p>After gaps</p>
      </body>
    `);
    // Should not have more than one blank line in a row
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain("After gaps");
  });

  it("handles a realistic restaurant page structure", () => {
    const result = extract(`
      <body>
        <div class="nav-wrapper">
          <a href="/">Everybody Eats</a>
          <a href="/book">Book</a>
        </div>
        <main>
          <h1>Wellington Eats</h1>
          <section>
            <h2>Location & Hours</h2>
            <p>60 Dixon Street, Te Aro, Wellington</p>
            <p>Sunday - Wednesday: 6pm - 8pm</p>
          </section>
          <section>
            <h2>Today's Menu</h2>
            <h3>Starter</h3>
            <ul>
              <li>Pear, blue cheese & walnut salad</li>
              <li>Pulled jackfruit bao buns</li>
            </ul>
            <h3>Main</h3>
            <ul>
              <li>Slow cooked brisket ragu with pasta</li>
            </ul>
          </section>
        </main>
        <div class="footer">
          <p>Registered charity CC56055</p>
        </div>
      </body>
    `);

    // Content is present
    expect(result).toContain("# Wellington Eats");
    expect(result).toContain("## Location & Hours");
    expect(result).toContain("60 Dixon Street");
    expect(result).toContain("6pm - 8pm");
    expect(result).toContain("## Today's Menu");
    expect(result).toContain("### Starter");
    expect(result).toContain("- Pear, blue cheese & walnut salad");
    expect(result).toContain("- Slow cooked brisket ragu with pasta");

    // Boilerplate is gone
    expect(result).not.toContain("Book");
    expect(result).not.toContain("Registered charity");
  });

  it("keeps inline elements as continuous text (apostrophes, links, bold)", () => {
    const result = extract(`
      <body>
        <p>We couldn<span>'</span>t open our doors without <a href="/volunteers">our volunteers</a>.</p>
      </body>
    `);
    expect(result).toContain("We couldn't open our doors without our volunteers.");
  });

  it("keeps apostrophes in contractions intact across spans", () => {
    const result = extract(`
      <body>
        <p>Don<span>'</span>t forget to join the <a href="/fb">Auckland</a> or <a href="/fb2">Wellington</a> page!</p>
      </body>
    `);
    expect(result).toContain("Don't forget to join the Auckland or Wellington page!");
  });

  it("strips zero-width characters from CMS content", () => {
    const result = extract(`
      <body>
        <p>Some text\u200B\u200D with zero-width\uFEFF chars</p>
      </body>
    `);
    expect(result).toBe("Some text with zero-width chars");
    expect(result).not.toMatch(/[\u200B\u200C\u200D\uFEFF]/);
  });

  it("handles bold and italic inline elements without splitting", () => {
    const result = extract(`
      <body>
        <p>This is <strong>very important</strong> and <em>also italic</em> text.</p>
      </body>
    `);
    expect(result).toBe("This is very important and also italic text.");
  });

  it("handles nested inline elements in paragraphs", () => {
    const result = extract(`
      <body>
        <p>Contact <a href="mailto:jack@ee.nz"><strong>Jack</strong></a> for more info.</p>
      </body>
    `);
    expect(result).toBe("Contact Jack for more info.");
  });

  it("returns empty string for empty body", () => {
    const result = extract("<body></body>");
    expect(result).toBe("");
  });

  it("prefers <main> over full <body>", () => {
    const { document } = parseHTML(`
      <body>
        <header><p>Header text</p></header>
        <main><p>Main content only</p></main>
      </body>
    `);
    const root = document.querySelector("main") ?? document.body;
    const result = extractStructuredText(root);
    expect(result).toContain("Main content only");
    expect(result).not.toContain("Header text");
  });
});

describe("scrapeUrl", () => {
  it("returns null for non-200 responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

    const result = await scrapeUrl("https://example.com/missing");
    expect(result).toBeNull();
  });

  it("returns null for non-HTML content types", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"data": true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await scrapeUrl("https://example.com/api");
    expect(result).toBeNull();
  });

  it("extracts text and title from valid HTML", async () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body><main><h1>Hello</h1><p>World</p></main></body>
      </html>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await scrapeUrl("https://example.com");
    expect(result).not.toBeNull();
    expect(result!.text).toContain("# Hello");
    expect(result!.text).toContain("World");
    expect(result!.title).toBe("Test Page");
  });

  it("prefers og:title over <title>", async () => {
    const html = `
      <html>
        <head>
          <title>Fallback Title</title>
          <meta property="og:title" content="OG Title" />
        </head>
        <body><p>Content</p></body>
      </html>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await scrapeUrl("https://example.com");
    expect(result!.title).toBe("OG Title");
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await scrapeUrl("https://example.com");
    expect(result).toBeNull();
  });
});
