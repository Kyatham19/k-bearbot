"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LivePriceProps {
  value: number | null | undefined;
  className?: string;
  format?: (v: number) => string;
  /** When true, flash green/red on price change. */
  flash?: boolean;
}

type Pulse = { tone: "up" | "down"; id: number } | null;

export function LivePrice({ value, className, format, flash = true }: LivePriceProps) {
  const prevRef = useRef<number | null>(null);
  const counterRef = useRef(0);
  const [pulse, setPulse] = useState<Pulse>(null);

  useEffect(() => {
    if (!flash) return;
    if (value == null) return;
    if (prevRef.current != null && value !== prevRef.current) {
      counterRef.current += 1;
      const tone: "up" | "down" = value > prevRef.current ? "up" : "down";
      setPulse({ tone, id: counterRef.current });
      prevRef.current = value;
      const myId = counterRef.current;
      const t = setTimeout(() => {
        setPulse((p) => (p && p.id === myId ? null : p));
      }, 650);
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value, flash]);

  const display =
    value == null
      ? "—"
      : format
      ? format(value)
      : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <span
      key={pulse?.id ?? "static"}
      className={cn(
        "tabular-nums transition-colors duration-500",
        pulse?.tone === "up" && "text-emerald-400",
        pulse?.tone === "down" && "text-rose-400",
        className
      )}
    >
      {display}
    </span>
  );
}
