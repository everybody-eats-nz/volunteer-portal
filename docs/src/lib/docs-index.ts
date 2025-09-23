import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface DocEntry {
  title: string;
  content: string;
  slug: string;
  url: string;
  summary: string;
}

let docsIndex: DocEntry[] | null = null;
let lastIndexTime = 0;
const INDEX_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Get all documentation files and create searchable index
 */
async function createDocsIndex(): Promise<DocEntry[]> {
  const docsDir = path.join(process.cwd(), "src/content/docs");
  const docs: DocEntry[] = [];

  async function processDirectory(dirPath: string, basePath = "") {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath, path.join(basePath, entry.name));
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const { data: frontmatter, content: markdown } = matter(content);

          // Create slug from file path
          const relativePath = path.relative(docsDir, fullPath);
          const slug = relativePath
            .replace(/\.(md|mdx)$/, "")
            .replace(/\\/g, "/");

          // Get title from frontmatter or filename
          const title =
            frontmatter.title ||
            frontmatter.label ||
            entry.name.replace(/\.(md|mdx)$/, "").replace(/[-_]/g, " ");

          // Clean up markdown content for indexing
          const cleanContent = markdown
            .replace(/```[\s\S]*?```/g, "") // Remove code blocks
            .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
            .replace(/#+ /g, "") // Remove heading markers
            .replace(/\n+/g, " ") // Normalize whitespace
            .trim();

          // Generate summary using AI (optional, can be expensive)
          let summary = cleanContent.slice(0, 200) + "...";
          try {
            if (process.env.STAR_SUPPORT_GENERATE_SUMMARIES === "true") {
              // Ensure API key is set in process.env for SDK
              if (
                !process.env.ANTHROPIC_API_KEY &&
                import.meta?.env?.ANTHROPIC_API_KEY
              ) {
                process.env.ANTHROPIC_API_KEY =
                  import.meta.env.ANTHROPIC_API_KEY;
              }

              const result = await generateText({
                model: anthropic("claude-3-haiku-20240307"),
                prompt: `Summarize this documentation content in 1-2 sentences: ${cleanContent.slice(
                  0,
                  1000
                )}`,
                temperature: 0.3,
                maxTokens: 100,
              });
              summary = result.text;
            }
          } catch (error) {
            console.warn("Failed to generate summary for", slug, error);
          }

          docs.push({
            title,
            content: cleanContent,
            slug,
            url: `/${slug}`,
            summary,
          });
        } catch (error) {
          console.error("Error processing", fullPath, error);
        }
      }
    }
  }

  await processDirectory(docsDir);
  return docs;
}

/**
 * Get the docs index, creating it if necessary
 */
async function getDocsIndex(): Promise<DocEntry[]> {
  const now = Date.now();

  if (!docsIndex || now - lastIndexTime > INDEX_CACHE_TTL) {
    console.log("Creating/refreshing docs index...");
    docsIndex = await createDocsIndex();
    lastIndexTime = now;
    console.log(`Indexed ${docsIndex.length} documents`);
  }

  return docsIndex;
}

/**
 * Simple text similarity scoring
 */
function calculateSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textWords = text.toLowerCase().split(/\s+/);

  let score = 0;
  let totalWords = queryWords.length;

  for (const queryWord of queryWords) {
    if (queryWord.length < 3) continue; // Skip very short words

    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        score += 1;
        break;
      }
    }
  }

  // Bonus for exact phrase matches
  if (text.toLowerCase().includes(query.toLowerCase())) {
    score += queryWords.length;
  }

  return score / totalWords;
}

/**
 * Use AI to select the most relevant documents
 */
async function selectRelevantDocsWithAI(
  query: string,
  candidates: DocEntry[]
): Promise<DocEntry[]> {
  if (candidates.length === 0) return [];

  try {
    // Ensure API key is set in process.env for SDK
    if (
      !process.env.ANTHROPIC_API_KEY &&
      import.meta?.env?.ANTHROPIC_API_KEY
    ) {
      process.env.ANTHROPIC_API_KEY = import.meta.env.ANTHROPIC_API_KEY;
    }
    
    const docsContext = candidates
      .map((doc, index) => `${index}: ${doc.title} - ${doc.summary}`)
      .join("\n");

    const prompt = `Given this user question: "${query}"

And these available documentation sections:
${docsContext}

Select the 2-3 most relevant document numbers (just the numbers, separated by commas) that would help answer this question. If none are particularly relevant, respond with "none".

Numbers only:`;

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      prompt,
      temperature: 0.1,
      maxTokens: 50,
    });

    const selectedNumbers = result.text
      .split(",")
      .map((n) => parseInt(n.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n < candidates.length);

    return selectedNumbers.map((i) => candidates[i]);
  } catch (error) {
    console.error(
      "AI selection failed, falling back to text similarity:",
      error
    );
    // Fallback to simple similarity
    return candidates.slice(0, 3);
  }
}

/**
 * Get relevant documentation for a user query
 */
export async function getRelevantDocs(
  query: string,
  maxResults = 3
): Promise<DocEntry[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const docs = await getDocsIndex();

  // First, filter and score documents by similarity
  const scoredDocs = docs
    .map((doc) => ({
      ...doc,
      score: Math.max(
        calculateSimilarity(query, doc.title) * 2, // Title matches are more important
        calculateSimilarity(query, doc.content),
        calculateSimilarity(query, doc.summary)
      ),
    }))
    .filter((doc) => doc.score > 0.1) // Only keep docs with some relevance
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Get top 8 for AI to choose from

  // Use AI to select the best ones
  const selectedDocs = await selectRelevantDocsWithAI(query, scoredDocs);

  return selectedDocs.slice(0, maxResults);
}

/**
 * Build the search index (can be called as a build step)
 */
export async function buildSearchIndex(): Promise<void> {
  console.log("Building documentation search index...");
  docsIndex = await createDocsIndex();
  lastIndexTime = Date.now();
  console.log(`Built index with ${docsIndex.length} documents`);

  // Optionally save to file for faster startup
  if (process.env.STAR_SUPPORT_SAVE_INDEX === "true") {
    const indexPath = path.join(process.cwd(), ".docs-index.json");
    await fs.writeFile(indexPath, JSON.stringify(docsIndex, null, 2));
    console.log(`Saved index to ${indexPath}`);
  }
}
