import type { TechnicalIndicators } from "@/types/stock";

export type IntelligenceAction = "buy" | "hold" | "sell";
export type Sentiment = "bullish" | "neutral" | "bearish";
export type Momentum = "strong" | "moderate" | "weak";

export interface PortfolioAssetSignal {
  symbol: string;
  name: string;
  pnlPercent: number;
  changePercent: number;
  trend: TechnicalIndicators["trend"];
  rsi: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  currentPrice: number;
}

export interface AssetIntelligenceCard {
  symbol: string;
  name: string;
  action: IntelligenceAction;
  confidence: number;
  momentum: Momentum;
  reason: string;
}

export interface TechnicalSnapshot {
  symbol: string;
  rsi: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  trend: TechnicalIndicators["trend"];
  momentum: Momentum;
}

export interface PortfolioIntelligence {
  healthScore: number;
  sentiment: Sentiment;
  trendMomentum: Momentum;
  marketSummary: string;
  beginnerInsight: string;
  actions: AssetIntelligenceCard[];
  technicals: TechnicalSnapshot[];
}

function toMomentum(score: number): Momentum {
  if (score >= 65) return "strong";
  if (score >= 45) return "moderate";
  return "weak";
}

function actionFromSignal(signalScore: number): IntelligenceAction {
  if (signalScore >= 65) return "buy";
  if (signalScore <= 35) return "sell";
  return "hold";
}

function sentimentFromScore(score: number): Sentiment {
  if (score >= 60) return "bullish";
  if (score <= 40) return "bearish";
  return "neutral";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function scoreAsset(asset: PortfolioAssetSignal): number {
  let score = 50;
  if (asset.trend === "bullish") score += 15;
  if (asset.trend === "bearish") score -= 15;

  if (asset.rsi !== null) {
    if (asset.rsi >= 45 && asset.rsi <= 65) score += 8;
    else if (asset.rsi > 75) score -= 10;
    else if (asset.rsi < 30) score += 4;
  }

  if (asset.macdHistogram !== null) {
    if (asset.macdHistogram > 0) score += 7;
    else if (asset.macdHistogram < 0) score -= 7;
  }

  if (asset.sma20 !== null && asset.currentPrice > asset.sma20) score += 5;
  if (asset.sma50 !== null && asset.currentPrice > asset.sma50) score += 5;
  if (asset.changePercent > 0) score += 5;
  if (asset.changePercent < 0) score -= 5;
  if (asset.pnlPercent > 0) score += 5;
  if (asset.pnlPercent < -10) score -= 8;
  return clamp(score);
}

function buildReason(asset: PortfolioAssetSignal, action: IntelligenceAction): string {
  const momentumText =
    asset.trend === "bullish"
      ? "trend remains bullish"
      : asset.trend === "bearish"
        ? "trend remains bearish"
        : "trend is neutral";
  const rsiText = asset.rsi === null ? "RSI unavailable" : `RSI at ${asset.rsi.toFixed(1)}`;
  const macdText =
    asset.macdHistogram === null
      ? "MACD signal unavailable"
      : asset.macdHistogram >= 0
        ? "MACD momentum positive"
        : "MACD momentum negative";

  if (action === "buy") return `${momentumText}; ${rsiText}; ${macdText}.`;
  if (action === "sell") return `${momentumText}; downside risk elevated; ${macdText}.`;
  return `${momentumText}; mixed signals; monitor support and volume confirmation.`;
}

export function buildPortfolioIntelligence(
  assets: PortfolioAssetSignal[]
): PortfolioIntelligence {
  if (assets.length === 0) {
    return {
      healthScore: 0,
      sentiment: "neutral",
      trendMomentum: "weak",
      marketSummary: "No holdings available. Add assets to start AI portfolio intelligence.",
      beginnerInsight:
        "Start with small allocations across different sectors to reduce concentration risk.",
      actions: [],
      technicals: [],
    };
  }

  const cards: AssetIntelligenceCard[] = assets.map((asset) => {
    const signal = scoreAsset(asset);
    const action = actionFromSignal(signal);
    return {
      symbol: asset.symbol,
      name: asset.name,
      action,
      confidence: signal,
      momentum: toMomentum(signal),
      reason: buildReason(asset, action),
    };
  });

  const avgScore = cards.reduce((sum, c) => sum + c.confidence, 0) / cards.length;
  const sentiment = sentimentFromScore(avgScore);
  const trendMomentum = toMomentum(avgScore);
  const buyCount = cards.filter((c) => c.action === "buy").length;
  const sellCount = cards.filter((c) => c.action === "sell").length;

  let marketSummary =
    "Portfolio is balanced with mixed momentum. Focus on risk-adjusted accumulation.";
  if (buyCount >= Math.ceil(cards.length * 0.5)) {
    marketSummary = "Momentum is constructive across holdings. Bias remains selectively bullish.";
  } else if (sellCount >= Math.ceil(cards.length * 0.4)) {
    marketSummary =
      "Risk pressure increasing across portfolio. Protect capital and tighten exposure.";
  }

  const beginnerInsight =
    sellCount > buyCount
      ? "New investors should avoid averaging down aggressively. Wait for confirmation before re-entry."
      : "New investors should stagger entries using small SIP-style buys instead of one-time lump sums.";

  const technicals: TechnicalSnapshot[] = assets.map((asset) => ({
    symbol: asset.symbol,
    rsi: asset.rsi,
    macdHistogram: asset.macdHistogram,
    sma20: asset.sma20,
    sma50: asset.sma50,
    trend: asset.trend,
    momentum: toMomentum(scoreAsset(asset)),
  }));

  return {
    healthScore: Math.round(avgScore),
    sentiment,
    trendMomentum,
    marketSummary,
    beginnerInsight,
    actions: cards.sort((a, b) => b.confidence - a.confidence),
    technicals,
  };
}
