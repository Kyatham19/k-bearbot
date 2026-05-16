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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    if (!symbolsKey) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { quotes: LiveQuote[] };
          if (aliveRef.current) {
            const next: Record<string, LiveQuote> = {};
            for (const q of data.quotes) next[q.symbol] = q;
            setQuotes((prev) => {
              const prevKeys = Object.keys(prev);
              const nextKeys = Object.keys(next);
              if (prevKeys.length !== nextKeys.length) return next;
              for (const key of nextKeys) {
                const p = prev[key];
                const n = next[key];
                if (!p) return next;
                if (
                  p.price !== n.price ||
                  p.change !== n.change ||
                  p.changePct !== n.changePct ||
                  p.previousClose !== n.previousClose
                ) {
                  return next;
                }
              }
              return prev;
            });
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
      abortRef.current?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [symbolsKey, intervalMs]);

  return quotes;
}
