import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuoteSnap = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 1_500;
const cache = new Map<string, { ts: number; data: QuoteSnap }>();
const inflight = new Map<string, Promise<QuoteSnap>>();

async function fetchOne(symbol: string): Promise<QuoteSnap> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const existing = inflight.get(symbol);
  if (existing) return existing;

  const p = (async (): Promise<QuoteSnap> => {
    const empty: QuoteSnap = {
      symbol,
      price: null,
      previousClose: null,
      change: null,
      changePct: null,
      currency: "USD",
    };
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (!res.ok) return empty;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return empty;

      const price = (meta.regularMarketPrice as number) ?? null;
      const prev = (meta.chartPreviousClose as number) ?? (meta.previousClose as number) ?? null;
      const change = price != null && prev != null ? price - prev : null;
      const changePct = price != null && prev ? ((price - prev) / prev) * 100 : null;

      const snap: QuoteSnap = {
        symbol,
        price,
        previousClose: prev,
        change,
        changePct,
        currency: (meta.currency as string) || "USD",
      };
      cache.set(symbol, { ts: Date.now(), data: snap });
      return snap;
    } catch {
      return empty;
    }
  })();

  inflight.set(symbol, p);
  try {
    return await p;
  } finally {
    inflight.delete(symbol);
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  const quotes = await Promise.all(symbols.map(fetchOne));
  return NextResponse.json({ quotes, ts: Date.now() });
}
