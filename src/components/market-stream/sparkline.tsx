"use client";

import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({ data, positive, width = 64, height = 22 }: SparklineProps) {
  const { path, area, last } = useMemo(() => {
    if (!data || data.length < 2) return { path: "", area: "", last: 0 };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return [x, y] as const;
    });

    const path = points
      .map(([x, y], i) => (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`))
      .join(" ");

    const area = `${path} L ${width} ${height} L 0 ${height} Z`;
    const last = points[points.length - 1][1];
    return { path, area, last };
  }, [data, width, height]);

  if (!path) return <div style={{ width, height }} />;

  const stroke = positive ? "rgb(16 185 129)" : "rgb(239 68 68)";
  const fillId = `spark-fill-${positive ? "up" : "dn"}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={last} r="1.6" fill={stroke}>
        <animate attributeName="r" values="1.6;2.6;1.6" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
