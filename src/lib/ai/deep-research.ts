import { fetchGoogleNews, type NewsItem } from "./google-news-rss";
import type { StockAnalysis } from "@/types/stock";

export type ResearchBundle = {
  companyNews: NewsItem[];
  sectorNews: NewsItem[];
  commodityNews: NewsItem[];
  geoNews: NewsItem[];
  peers: string[];
  rawMaterials: string[];
  watchedAngles: string[];
};

// Map sector → core commodities / inputs that move margins
const SECTOR_COMMODITIES: Record<string, string[]> = {
  energy: ["crude oil", "natural gas", "refining margin"],
  oil: ["crude oil", "Brent", "WTI"],
  technology: ["semiconductor", "rare earth", "lithium"],
  "information technology": ["semiconductor", "cloud pricing"],
  pharmaceuticals: ["API price", "rupee dollar"],
  pharma: ["API price", "rupee dollar"],
  automobiles: ["steel price", "aluminium price", "lithium"],
  auto: ["steel price", "lithium", "rupee"],
  banks: ["RBI rate", "credit growth", "NPA"],
  "financial services": ["RBI rate", "bond yields", "credit growth"],
  "consumer cyclical": ["consumer demand India", "rural sales"],
  "consumer staples": ["palm oil", "wheat", "inflation"],
  fmcg: ["palm oil", "crude oil", "rupee"],
  metals: ["iron ore", "coal", "steel price"],
  steel: ["iron ore", "coking coal"],
  cement: ["coal price", "pet coke", "limestone"],
  utilities: ["coal", "power tariff"],
  realestate: ["interest rates", "housing demand"],
  "real estate": ["interest rates", "housing demand"],
  paints: ["crude oil", "titanium dioxide"],
};

// Map sector → peer ticker hints (very light; just nudges the LLM)
const SECTOR_PEERS_IN: Record<string, string[]> = {
  energy: ["RELIANCE", "ONGC", "IOC", "BPCL"],
  technology: ["TCS", "INFY", "WIPRO", "HCLTECH"],
  "information technology": ["TCS", "INFY", "WIPRO", "HCLTECH"],
  banks: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK"],
  pharma: ["SUNPHARMA", "DRREDDY", "CIPLA"],
  auto: ["TATAMOTORS", "M&M", "MARUTI"],
  metals: ["TATASTEEL", "JSWSTEEL", "HINDALCO"],
  fmcg: ["HINDUNILVR", "ITC", "NESTLEIND"],
  cement: ["ULTRACEMCO", "SHREECEM", "AMBUJACEM"],
};

const SECTOR_PEERS_US: Record<string, string[]> = {
  technology: ["AAPL", "MSFT", "GOOGL", "NVDA"],
  energy: ["XOM", "CVX", "COP"],
  banks: ["JPM", "BAC", "WFC"],
  pharma: ["PFE", "MRK", "JNJ"],
};

function sectorKey(sector: string | undefined): string {
  return (sector ?? "").toLowerCase().trim();
}

export function pickPeers(sector: string | undefined, country: string | undefined, currentSymbol: string): string[] {
  const key = sectorKey(sector);
  const isIndia = (country ?? "").toLowerCase().includes("india");
  const table = isIndia ? SECTOR_PEERS_IN : SECTOR_PEERS_US;
  const base = table[key] ?? [];
  return base.filter((p) => p !== currentSymbol.toUpperCase()).slice(0, 4);
}

export function pickCommodities(sector: string | undefined): string[] {
  const key = sectorKey(sector);
  return SECTOR_COMMODITIES[key] ?? [];
}

function deriveAngles(sector: string, country: string): string[] {
  const angles: string[] = [
    "demand outlook",
    "competitive position",
    "margin pressure",
    "regulatory risk",
  ];
  const c = country.toLowerCase();
  if (c.includes("india")) angles.push("rupee impact", "RBI policy");
  if (c.includes("united states")) angles.push("Fed policy", "earnings surprise");
  if (sectorKey(sector).includes("energy")) angles.push("OPEC stance", "geopolitics middle east");
  return angles;
}

/**
 * Run a parallel deep-research pass: company news, sector news, commodity
 * news, geopolitical news, peer hints. Returns a structured bundle suitable
 * for injection into the stock-analysis system prompt.
 */
export async function runDeepResearch(analysis: StockAnalysis): Promise<ResearchBundle> {
  const sector = analysis.companyInfo?.sector ?? "";
  const country = analysis.companyInfo?.country ?? "";
  const name = analysis.quote.name;
  const symbol = analysis.quote.symbol;

  const commodities = pickCommodities(sector);
  const peers = pickPeers(sector, country, symbol);

  const companyQuery = `${name} stock`;
  const sectorQuery = `${sector} sector India 2026 outlook`;
  const geoQuery = country ? `${country} economy market 2026` : "global markets 2026";

  const tasks: Promise<NewsItem[]>[] = [
    fetchGoogleNews(companyQuery, 5),
    fetchGoogleNews(sectorQuery, 4),
    ...commodities.slice(0, 2).map((c) => fetchGoogleNews(`${c} price 2026`, 3)),
    fetchGoogleNews(geoQuery, 3),
  ];

  const settled = await Promise.allSettled(tasks);
  const ok = (i: number): NewsItem[] =>
    settled[i]?.status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<NewsItem[]>).value : [];

  const companyNews = ok(0);
  const sectorNews = ok(1);
  let commodityNews: NewsItem[] = [];
  for (let i = 0; i < Math.min(2, commodities.length); i++) {
    commodityNews = commodityNews.concat(ok(2 + i));
  }
  const geoNews = ok(2 + Math.min(2, commodities.length));

  return {
    companyNews,
    sectorNews,
    commodityNews,
    geoNews,
    peers,
    rawMaterials: commodities,
    watchedAngles: deriveAngles(sector, country),
  };
}

function fmtNews(items: NewsItem[], cap: number): string {
  return items
    .slice(0, cap)
    .map((n, i) => `${i + 1}. ${n.title} — ${n.source} [${n.link}]`)
    .join("\n");
}

export function formatResearchBundle(bundle: ResearchBundle): string {
  const blocks: string[] = [
    "Thinking:\n- Conducting deep research for comprehensive analysis\n- Searching for company-specific news and developments\n- Gathering sector and industry updates\n- Monitoring key commodity and input cost movements\n- Analyzing geopolitical and macro-economic factors\n- Identifying peer companies for performance comparison\n\nDEEP RESEARCH CONTEXT"
  ];

  if (bundle.peers.length > 0) {
    blocks.push(`Peer companies to compare against: ${bundle.peers.join(", ")}`);
  }
  if (bundle.rawMaterials.length > 0) {
    blocks.push(`Key raw materials / inputs driving margins: ${bundle.rawMaterials.join(", ")}`);
  }
  if (bundle.watchedAngles.length > 0) {
    blocks.push(`Angles to address: ${bundle.watchedAngles.join(", ")}`);
  }
  if (bundle.companyNews.length > 0) {
    blocks.push(`Company-specific news (latest):\n${fmtNews(bundle.companyNews, 5)}`);
  }
  if (bundle.sectorNews.length > 0) {
    blocks.push(`Sector / industry news:\n${fmtNews(bundle.sectorNews, 4)}`);
  }
  if (bundle.commodityNews.length > 0) {
    blocks.push(`Commodity / input cost news:\n${fmtNews(bundle.commodityNews, 4)}`);
  }
  if (bundle.geoNews.length > 0) {
    blocks.push(`Macro / geopolitical news:\n${fmtNews(bundle.geoNews, 3)}`);
  }

  blocks.push(
    "Synthesis rules: Connect company performance to the news above. Cite specific URLs from this block. Do not invent sources. If a data point is missing, say so briefly rather than guessing."
  );

  return blocks.join("\n\n");
}
