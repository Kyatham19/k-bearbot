import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuote, fetchHistory } from "@/lib/stock/data";
import { analyzeTechnicals } from "@/lib/stock/technicals";
import {
  buildPortfolioIntelligence,
  type PortfolioAssetSignal,
} from "@/lib/portfolio/intelligence";

const MAX_ANALYZED_ASSETS = 12;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: holdings, error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .select("symbol, quantity, avg_buy_price")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAX_ANALYZED_ASSETS);

    if (holdingsError) {
      return NextResponse.json(
        { error: "Failed to fetch holdings" },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        intelligence: buildPortfolioIntelligence([]),
        analyzedAssets: 0,
      });
    }

    const results = await Promise.allSettled(
      holdings.map(async (holding) => {
        const [quote, history] = await Promise.all([
          fetchQuote(holding.symbol),
          fetchHistory(holding.symbol, 1),
        ]);

        if (!quote) return null;
        const technicals = analyzeTechnicals(history, quote.price);
        const invested = holding.avg_buy_price * holding.quantity;
        const currentValue = quote.price * holding.quantity;
        const pnlPercent = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;

        const signal: PortfolioAssetSignal = {
          symbol: quote.symbol,
          name: quote.name || quote.symbol,
          pnlPercent,
          changePercent: quote.changePercent,
          trend: technicals.trend,
          rsi: technicals.rsi,
          macdHistogram: technicals.macd.histogram,
          sma20: technicals.sma20,
          sma50: technicals.sma50,
          currentPrice: quote.price,
        };
        return signal;
      })
    );

    const assets: PortfolioAssetSignal[] = results
      .filter(
        (r): r is PromiseFulfilledResult<PortfolioAssetSignal | null> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .filter((v): v is PortfolioAssetSignal => v !== null);

    const intelligence = buildPortfolioIntelligence(assets);
    return NextResponse.json({
      intelligence,
      analyzedAssets: assets.length,
      totalHoldings: holdings.length,
    });
  } catch (error) {
    console.error("GET /api/portfolio/intelligence error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
