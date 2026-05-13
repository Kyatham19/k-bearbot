import { fetchGoogleNews, formatNewsItemsForPrompt } from "./google-news-rss";

function readTavilyApiKey(): string {
  return process.env.TAVILY_API_KEY || "";
}

// Web search remains available (Google News RSS as primary, Tavily fallback).
// validateSerpApiSetup is always-valid now because Google News RSS needs no key.
export function validateSerpApiSetup(): { valid: boolean; error?: string } {
  return { valid: true };
}

async function searchTavily(query: string, numResults: number): Promise<string> {
  const apiKey = readTavilyApiKey();
  if (!apiKey) return "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, max_results: numResults }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return "";
    const data = await response.json();
    const results = (data.results || []) as Array<{ title: string; url: string; content: string }>;
    if (results.length === 0) return "";
    const formatted = results.slice(0, numResults).map((r, i) => {
      return `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}\n`;
    }).join('\n');
    return `Web search results for "${query}":\n\n${formatted}`;
  } catch (err) {
    console.warn("[web-search] Tavily failed:", err);
    return "";
  }
}

export async function searchWeb(query: string, numResults: number = 5): Promise<string> {
  // Primary: Google News RSS (no key required)
  const news = await fetchGoogleNews(query, numResults);
  if (news.length > 0) {
    return formatNewsItemsForPrompt(news, `Web search results for "${query}"`);
  }
  // Fallback: Tavily if configured
  const tavily = await searchTavily(query, numResults);
  if (tavily) return tavily;
  return `Unable to perform web search for "${query}".`;
}