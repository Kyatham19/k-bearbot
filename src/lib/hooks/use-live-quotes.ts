"use client";

import { useEffect, useRef, useState } from "react";

export type LiveQuote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
};

export function useLiveQuotes(symbols: string[], intervalMs = 5000) {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const symbolsKey = symbols.slice().sort().join(",");
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    if (!symbolsKey) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { quotes: LiveQuote[] };
          if (aliveRef.current) {
            const next: Record<string, LiveQuote> = {};
            for (const q of data.quotes) next[q.symbol] = q;
            setQuotes(next);
          }
        }
      } catch {
        // ignore — keep last good values
      } finally {
        if (aliveRef.current) timer = setTimeout(tick, intervalMs);
      }
    };

    tick();
    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [symbolsKey, intervalMs]);

  return quotes;
}
