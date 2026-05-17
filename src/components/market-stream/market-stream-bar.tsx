"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { TickerItem } from "./ticker-item";
import type { MarketStreamItem } from "./types";

const POLL_MS = 2_000;
const SCROLL_SPEED = 38; // px / sec — slower = more premium

export function MarketStreamBar() {
  const [items, setItems] = useState<MarketStreamItem[] | null>(null);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market-stream", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (!alive) return;
        setItems(data.items);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Hide loading state if nothing came back yet
  const hasData = items && items.length > 0;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group relative -z-10 w-full overflow-hidden border-y border-white/[0.06] bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-zinc-950 backdrop-blur-xl"
      style={{ height: 38 }}
    >
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-16 bg-gradient-to-r from-zinc-950 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-0 h-full w-16 bg-gradient-to-l from-zinc-950 to-transparent" />

      {/* Brand badge — left fixed */}
      <div className="absolute left-0 top-0 z-10 flex h-full items-center gap-1.5 border-r border-white/[0.06] bg-zinc-950/80 pl-3 pr-3 backdrop-blur-xl">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
          <span className="absolute inset-0 rounded-full bg-emerald-400" />
        </span>
        <Activity className="h-3 w-3 text-emerald-300" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
          Live · AI Stream
        </span>
      </div>

      {/* Stream */}
      <div className="absolute inset-y-0 left-0 right-0 pl-[150px]">
        {!hasData && !error && (
          <div className="flex h-full items-center gap-2 pl-2 text-[11px] text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting to markets…
          </div>
        )}
        {error && !hasData && (
          <div className="flex h-full items-center pl-2 text-[11px] text-rose-400/70">
            Market feed unavailable. Retrying…
          </div>
        )}

        {hasData && <ScrollingStream items={items!} paused={paused} />}
      </div>
    </div>
  );
}

function ScrollingStream({ items, paused }: { items: MarketStreamItem[]; paused: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const trackWidthRef = useRef(0);

  // Re-measure on items change
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // measure half (one copy) so we can loop
    trackWidthRef.current = el.scrollWidth / 2;
  }, [items]);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (!paused) {
        xRef.current -= SCROLL_SPEED * dt;
        const half = trackWidthRef.current;
        if (half > 0 && -xRef.current >= half) {
          xRef.current += half;
        }
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${xRef.current}px,0,0)`;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
  }, [paused]);

  return (
    <div ref={trackRef} className="flex h-full items-center will-change-transform">
      {items.map((it) => (
        <TickerItem key={`a-${it.key}`} item={it} />
      ))}
      {items.map((it) => (
        <TickerItem key={`b-${it.key}`} item={it} />
      ))}
    </div>
  );
}
