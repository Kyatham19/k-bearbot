export type MarketStreamItem = {
  key: string;
  symbol: string;
  label: string;
  group: "index" | "crypto" | "commodity" | "fx";
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  currency: string;
  spark: number[];
  sentiment: "bullish" | "bearish" | "neutral";
};
