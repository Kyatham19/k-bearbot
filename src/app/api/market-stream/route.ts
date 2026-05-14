import { NextResponse } from "next/server";
import { yahoo } from "@/lib/stock/yahoo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Asset = {
  key: string;
  symbol: string;
  label: string;
  group: "index" | "crypto" | "commodity" | "fx";
};

const ASSETS: Asset[] = [
  { key: "nifty50",     symbol: "^NSEI",     label: "NIFTY 50",     group: "index" },
  { key: "banknifty",   symbol: "^NSEBANK",  label: "BANK NIFTY",   group: "index" },
  { key: "sensex",      symbol: "^BSESN",    label: "SENSEX",       group: "index" },
  { key: "finnifty",    symbol: "NIFTY_FIN_SERVICE.NS", label: "FINNIFTY", group: "index" },
  { key: "niftyit",     symbol: "^CNXIT",    label: "NIFTY IT",     group: "index" },
  { key: "niftyauto",   symbol: "^CNXAUTO",  label: "NIFTY AUTO",   group: "index" },
  { key: "niftyfmcg",   symbol: "^CNXFMCG",  label: "NIFTY FMCG",   group: "index" },
  { key: "midcap",      symbol: "NIFTY_MIDCAP_100.NS", label: "MIDCAP NIFTY",   group: "index" },
  { key: "smallcap",    symbol: "^CNXSC",    label: "SMALLCAP NIFTY", group: "index" },
  { key: "vix",         symbol: "^INDIAVIX", label: "INDIA VIX",    group: "index" },
  { key: "btc",         symbol: "BTC-USD",   label: "Bitcoin",      group: "crypto" },
  { key: "eth",         symbol: "ETH-USD",   label: "Ethereum",     group: "crypto" },
  { key: "gold",        symbol: "GC=F",      label: "Gold",         group: "commodity" },
  { key: "silver",      symbol: "SI=F",      label: "Silver",       group: "commodity" },
  { key: "crude",       symbol: "CL=F",      label: "Crude Oil",    group: "commodity" },
  { key: "usdinr",      symbol: "INR=X",     label: "USD/INR",      group: "fx" },
];

export type MarketStreamItem = {
  key: string;
  symbol: string;
  label: string;
  group: Asset["group"];
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  currency: string;
  spark: number[];
  sentiment: "bullish" | "bearish" | "neutral";
};

let cache: { ts: number; payload: MarketStreamItem[] } | null = null;
let inflight: Promise<MarketStreamItem[]> | null = null;
const CACHE_TTL_MS = 1_500;

async function fetchOne(asset: Asset): Promise<MarketStreamItem> {
  const empty: MarketStreamItem = {
    key: asset.key,
    symbol: asset.symbol,
    label: asset.label,
    group: asset.group,
    price: null,
    change: null,
    changePct: null,
    previousClose: null,
    currency: "USD",
    spark: [],
    sentiment: "neutral",
  };

  try {
    const now = new Date();
    const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?period1=${Math.floor(start.getTime() / 1000)}&period2=${Math.floor(now.getTime() / 1000)}&interval=15m&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return empty;

    const meta = result.meta || {};
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const clean = closes.filter((c): c is number => typeof c === "number");

    const price = (meta.regularMarketPrice as number) ?? clean[clean.length - 1] ?? null;
    const prev = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? null;
    const change = price != null && prev != null ? price - prev : null;
    const changePct = price != null && prev ? ((price - prev) / prev) * 100 : null;

    const spark = clean.slice(-48);
    const sentiment: MarketStreamItem["sentiment"] =
      changePct == null ? "neutral" : changePct > 0.15 ? "bullish" : changePct < -0.15 ? "bearish" : "neutral";

    return {
      ...empty,
      price,
      previousClose: prev,
      change,
      changePct,
      currency: (meta.currency as string) || empty.currency,
      spark,
      sentiment,
    };
  } catch {
    return empty;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ items: cache.payload, cached: true, ts: cache.ts });
  }
  if (inflight) {
    const items = await inflight;
    return NextResponse.json({ items, cached: true, ts: cache?.ts ?? Date.now() });
  }

  inflight = Promise.all(ASSETS.map(fetchOne));
  try {
    const items = await inflight;
    cache = { ts: Date.now(), payload: items };
    return NextResponse.json({ items, cached: false, ts: cache.ts });
  } finally {
    inflight = null;
  }
}
