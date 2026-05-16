import { fetchGoogleNews } from "./google-news-rss";

export type WebSource = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  snippet?: string;
};

export type WebSearchResult = {
  sources: WebSource[];
  formattedForPrompt: string;
};

function readTavilyApiKey(): string {
  return process.env.TAVILY_API_KEY || "";
}

// Always-valid: Google News RSS needs no key, so search is always available.
export function validateSerpApiSetup(): { valid: boolean; error?: string } {
  return { valid: true };
}

export function normalizeSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatPrompt(sources: WebSource[], query: string): string {
  if (sources.length === 0) return "";
  const lines = sources
    .map((s, i) => {
      const date = s.publishedAt ? ` (${s.publishedAt})` : "";
      const snippet = s.snippet ? `\n    ${s.snippet.slice(0, 280)}` : "";
      return `[${i + 1}] ${s.title} — ${s.source}${date}${snippet}\n    ${s.url}`;
    })
    .join("\n\n");
  return `Web search results for "${query}":\n\n${lines}`;
}

async function searchTavily(query: string, numResults: number): Promise<WebSource[]> {
  const apiKey = readTavilyApiKey();
  if (!apiKey) return [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: numResults,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const data = await response.json();
    const results = (data.results || []) as Array<{
      title: string;
      url: string;
      content: string;
      published_date?: string;
    }>;
    return results.slice(0, numResults).map((r) => ({
      title: r.title,
      url: r.url,
      source: normalizeSourceDomain(r.url),
      snippet: r.content,
      publishedAt: r.published_date,
    }));
  } catch (err) {
    console.warn("[web-search] Tavily failed:", err);
    return [];
  }
}

async function searchGoogleNewsRss(query: string, numResults: number): Promise<WebSource[]> {
  const items = await fetchGoogleNews(query, numResults);
  return items.map((n) => ({
    title: n.title,
    url: n.link,
    source: n.source,
    publishedAt: n.pubDate,
  }));
}

export async function searchWeb(query: string, numResults: number = 5): Promise<WebSearchResult> {
  // Primary: Tavily (richer snippets, costs API quota)
  let sources = await searchTavily(query, numResults);

  // Fallback: Google News RSS (free, no key)
  if (sources.length === 0) {
    sources = await searchGoogleNewsRss(query, numResults);
  }

  return {
    sources,
    formattedForPrompt: formatPrompt(sources, query),
  };
}
