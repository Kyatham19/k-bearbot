export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

type CacheEntry = { items: NewsItem[]; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function tag(item: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = item.match(re);
  return m ? decodeEntities(stripCdata(m[1])) : "";
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      pubDate: tag(block, "pubDate"),
      source: tag(block, "source") || "Google News",
    });
  }
  return items;
}

export async function fetchGoogleNews(query: string, max: number = 5): Promise<NewsItem[]> {
  if (!query) return [];
  const key = `q:${query.toLowerCase()}:${max}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.items;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 AlphaSightBot" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRss(xml).slice(0, max);
    cache.set(key, { items, expires: Date.now() + TTL_MS });
    return items;
  } catch (err) {
    console.warn("[google-news-rss] failed:", err);
    return [];
  }
}

export function formatNewsItemsForPrompt(items: NewsItem[], header = "Recent news"): string {
  if (items.length === 0) return "";
  const lines = items
    .map((n, i) => `${i + 1}. ${n.title} — ${n.source} (${n.pubDate}) [${n.link}]`)
    .join("\n");
  return `${header}:\n${lines}`;
}
