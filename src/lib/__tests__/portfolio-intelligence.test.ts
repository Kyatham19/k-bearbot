import {
  buildPortfolioIntelligence,
  type PortfolioAssetSignal,
} from "@/lib/portfolio/intelligence";

function makeAsset(overrides: Partial<PortfolioAssetSignal> = {}): PortfolioAssetSignal {
  return {
    symbol: "BTC-USD",
    name: "Bitcoin",
    pnlPercent: 6,
    changePercent: 2,
    trend: "bullish",
    rsi: 58,
    macdHistogram: 0.8,
    sma20: 64000,
    sma50: 60000,
    currentPrice: 65000,
    ...overrides,
  };
}

describe("buildPortfolioIntelligence", () => {
  it("returns empty-safe intelligence for zero assets", () => {
    const result = buildPortfolioIntelligence([]);
    expect(result.healthScore).toBe(0);
    expect(result.actions).toHaveLength(0);
    expect(result.sentiment).toBe("neutral");
  });

  it("marks strong bullish assets as buy leaning", () => {
    const result = buildPortfolioIntelligence([makeAsset()]);
    expect(result.actions[0].action).toBe("buy");
    expect(result.healthScore).toBeGreaterThanOrEqual(60);
    expect(result.sentiment).toBe("bullish");
  });

  it("marks weak bearish assets as sell leaning", () => {
    const result = buildPortfolioIntelligence([
      makeAsset({
        symbol: "SOL-USD",
        trend: "bearish",
        pnlPercent: -18,
        changePercent: -4,
        rsi: 81,
        macdHistogram: -1.5,
        currentPrice: 120,
        sma20: 140,
        sma50: 150,
      }),
    ]);
    expect(result.actions[0].action).toBe("sell");
    expect(result.healthScore).toBeLessThanOrEqual(40);
    expect(result.sentiment).toBe("bearish");
  });
});
