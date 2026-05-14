"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "./sparkline";
import type { MarketStreamItem } from "./types";

interface Props {
  item: MarketStreamItem;
}

function formatPrice(p: number | null, group: MarketStreamItem["group"]) {
  if (p == null) return "—";
  if (group === "fx") return p.toFixed(2);
  if (group === "crypto" && p > 100) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (group === "crypto") return p.toFixed(2);
  if (group === "commodity") return p.toFixed(2);
  return p.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatPct(p: number | null) {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

function sentimentLabel(s: MarketStreamItem["sentiment"], pct: number | null) {
  if (s === "bullish") return `AI detects bullish momentum${pct ? ` (${pct.toFixed(2)}%)` : ""}.`;
  if (s === "bearish") return `AI detects bearish pressure${pct ? ` (${pct.toFixed(2)}%)` : ""}.`;
  return "AI sees consolidation. Range-bound near prev close.";
}

export const TickerItem = memo(function TickerItem({ item }: Props) {
  const positive = (item.changePct ?? 0) >= 0;
  const isZero = (item.changePct ?? 0) === 0 || item.changePct == null;

  const [flash, setFlash] = useState<{ tone: "up" | "down"; id: number } | null>(null);
  const prevPrice = useRef<number | null>(item.price);
  const counterRef = useRef(0);

  useEffect(() => {
    if (prevPrice.current != null && item.price != null && item.price !== prevPrice.current) {
      counterRef.current += 1;
      const tone: "up" | "down" = item.price > prevPrice.current ? "up" : "down";
      const myId = counterRef.current;
      setFlash({ tone, id: myId });
      prevPrice.current = item.price;
      const t = setTimeout(() => {
        setFlash((f) => (f && f.id === myId ? null : f));
      }, 700);
      return () => clearTimeout(t);
    }
    prevPrice.current = item.price;
  }, [item.price]);

  const dotColor = isZero
    ? "bg-zinc-400/60"
    : positive
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
    : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]";

  const priceTone = isZero
    ? "text-zinc-300"
    : positive
    ? "text-emerald-300"
    : "text-rose-300";

  const arrow = isZero ? (
    <Minus className="h-3 w-3 text-zinc-400" />
  ) : positive ? (
    <ArrowUpRight className="h-3 w-3" />
  ) : (
    <ArrowDownRight className="h-3 w-3" />
  );

  return (
    <div className="group relative inline-flex shrink-0 items-center gap-3 px-5 py-1.5 select-none">
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={`pointer-events-none absolute inset-0 rounded-md ${
              flash.tone === "up" ? "bg-emerald-500/20" : "bg-rose-500/20"
            }`}
          />
        )}
      </AnimatePresence>

      {/* AI sentiment dot */}
      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
        <span className={`absolute inset-0 rounded-full ${dotColor}`} />
        {!isZero && (
          <span
            className={`absolute inset-0 animate-ping rounded-full ${
              positive ? "bg-emerald-400/50" : "bg-rose-400/50"
            }`}
          />
        )}
      </span>

      {/* Label */}
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-300 group-hover:text-white transition-colors">
        {item.label}
      </span>

      {/* Price */}
      <span className={`font-mono text-[12.5px] font-semibold tabular-nums ${priceTone}`}>
        {formatPrice(item.price, item.group)}
      </span>

      {/* Change pct */}
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
          isZero
            ? "bg-zinc-700/40 text-zinc-300"
            : positive
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-rose-500/10 text-rose-300"
        }`}
      >
        {arrow}
        {formatPct(item.changePct)}
      </span>

      {/* Sparkline */}
      <Sparkline data={item.spark} positive={positive} />

      {/* Hover tooltip */}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 group-hover:block">
        <div className="rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-2xl backdrop-blur-xl whitespace-nowrap">
          <div className="mb-0.5 font-semibold text-white">{item.label}</div>
          <div className="text-[11px] text-zinc-400">{sentimentLabel(item.sentiment, item.changePct)}</div>
          {item.previousClose != null && (
            <div className="mt-1 text-[10px] text-zinc-500">Prev close · {formatPrice(item.previousClose, item.group)}</div>
          )}
        </div>
      </div>

      {/* Separator dot */}
      <span className="ml-2 h-1 w-1 rounded-full bg-white/10" />
    </div>
  );
});
