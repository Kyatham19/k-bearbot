'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sun,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { DailyBrief, PortfolioSnapshot } from '@/types/stock';

export function SnapshotCards({ snapshot }: { snapshot: PortfolioSnapshot }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-dark-700 bg-dark-800/80 p-4 backdrop-blur-xl">
        <p className="mb-1 text-xs font-medium text-dark-400">Portfolio Value</p>
        <p className="text-xl font-bold text-gray-100">{formatCurrency(snapshot.totalValue)}</p>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800/80 p-4 backdrop-blur-xl">
        <p className="mb-1 text-xs font-medium text-dark-400">Total P&L</p>
        <p className={cn('text-xl font-bold', getChangeColor(snapshot.totalPnl))}>
          {formatCurrency(snapshot.totalPnl)}
        </p>
        <Badge
          variant={snapshot.totalPnlPercent >= 0 ? 'green' : 'red'}
          className="mt-1"
        >
          {formatPercent(snapshot.totalPnlPercent)}
        </Badge>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800/80 p-4 backdrop-blur-xl">
        <p className="mb-1 text-xs font-medium text-dark-400">Holdings</p>
        <p className="text-xl font-bold text-gray-100">{snapshot.holdings.length}</p>
        <p className="mt-1 text-xs text-dark-400">assets tracked</p>
      </div>
    </div>
  );
}

export function GainersLosers({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const sorted = [...snapshot.holdings].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const gainers = sorted.filter((h) => h.pnlPercent > 0).slice(0, 3);
  const losers = sorted.filter((h) => h.pnlPercent < 0).slice(-3).reverse();

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {gainers.length > 0 && (
        <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-accent-green">
            <TrendingUp className="h-4 w-4" />
            Top Gainers
          </h3>
          <div className="space-y-2">
            {gainers.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-100">{h.symbol}</span>
                <span className="text-sm font-semibold text-accent-green">
                  {formatPercent(h.pnlPercent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-accent-red">
            <TrendingDown className="h-4 w-4" />
            Top Losers
          </h3>
          <div className="space-y-2">
            {losers.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-100">{h.symbol}</span>
                <span className="text-sm font-semibold text-accent-red">
                  {formatPercent(h.pnlPercent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SentimentGauge({
  content,
  snapshot,
}: {
  content: string;
  snapshot: PortfolioSnapshot;
}) {
  const portfolioScore =
    snapshot.totalPnlPercent > 5 ? 100 : snapshot.totalPnlPercent > 0 ? 75 : snapshot.totalPnlPercent > -5 ? 50 : 25;

  let marketScore = 50;
  if (snapshot.marketIndices && snapshot.marketIndices.length > 0) {
    const avgChange =
      snapshot.marketIndices.reduce((sum, idx) => sum + idx.changePercent, 0) /
      snapshot.marketIndices.length;
    marketScore = Math.max(0, Math.min(100, 50 + avgChange * 10));
  }

  const lower = content.toLowerCase();
  const bullishKeywords = ['bullish', 'upside', 'growth', 'positive', 'outperform', 'buy', 'strong', 'rally', 'momentum'];
  const bearishKeywords = ['bearish', 'downside', 'risk', 'negative', 'underperform', 'sell', 'weak', 'decline', 'correction'];

  let bullishCount = 0;
  let bearishCount = 0;
  for (const kw of bullishKeywords) bullishCount += (lower.match(new RegExp(kw, 'g')) || []).length;
  for (const kw of bearishKeywords) bearishCount += (lower.match(new RegExp(kw, 'g')) || []).length;

  const contentTotal = bullishCount + bearishCount;
  const contentScore = contentTotal > 0 ? (bullishCount / contentTotal) * 100 : 50;
  const score = Math.round((portfolioScore * 0.4) + (marketScore * 0.4) + (contentScore * 0.2));

  const label = score >= 70 ? 'Bullish' : score >= 40 ? 'Neutral' : 'Bearish';
  const color = score >= 70 ? 'text-accent-green' : score >= 40 ? 'text-accent-amber' : 'text-accent-red';
  const barColor = score >= 70 ? 'bg-accent-green' : score >= 40 ? 'bg-accent-amber' : 'bg-accent-red';

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/85 p-4 backdrop-blur-xl">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-100">
        <Activity className="h-4 w-4 text-accent-amber" />
        Portfolio Sentiment
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-dark-700">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-xs text-accent-red">Bearish</span>
            <span className="text-xs text-accent-green">Bullish</span>
          </div>
        </div>
        <div className="shrink-0 text-center">
          <p className={cn('text-2xl font-bold', color)}>{score}</p>
          <p className={cn('text-xs font-medium', color)}>{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ExecutiveSummary({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const isPositive = snapshot.totalPnl >= 0;
  return (
    <div className="rounded-xl border border-accent-amber/20 bg-gradient-to-r from-accent-amber/5 to-accent-green/5 p-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-100">
        <Activity className="h-5 w-5 text-accent-amber" />
        Executive Summary
      </h2>
      <p className="mb-4 text-sm text-gray-300">
        Your portfolio is valued at <strong>{formatCurrency(snapshot.totalValue)}</strong> with
        a total P&L of{' '}
        <span className={cn('font-semibold', getChangeColor(snapshot.totalPnl))}>
          {formatCurrency(snapshot.totalPnl)} ({formatPercent(snapshot.totalPnlPercent)})
        </span>
        . {snapshot.holdings.length} holdings are being tracked with{' '}
        {isPositive ? 'positive momentum' : 'areas for review'}.
      </p>
      <div className="flex items-center gap-4 text-xs text-dark-400">
        <span>📊 Market Analysis Included</span>
        <span>🎯 Actionable Insights</span>
        <span>⚠️ Risk Assessment</span>
      </div>
    </div>
  );
}

export function MarketOverview({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const indices = snapshot.marketIndices || [];
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/85 p-4 backdrop-blur-xl">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-100">
        <TrendingUp className="h-4 w-4 text-accent-blue" />
        Market Overview
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        {indices.map((idx) => (
          <div key={idx.symbol}>
            <p className="text-xs text-dark-400">{idx.symbol}</p>
            <p className="text-sm font-semibold text-gray-100">{formatCurrency(idx.price)}</p>
            <Badge variant={idx.changePercent >= 0 ? 'green' : 'red'} className="text-xs">
              {idx.changePercent >= 0 ? '+' : ''}
              {idx.changePercent.toFixed(2)}%
            </Badge>
          </div>
        ))}
        {indices.length === 0 && (
          <>
            <div>
              <p className="text-xs text-dark-400">S&P 500</p>
              <p className="text-sm font-semibold text-gray-100">N/A</p>
            </div>
            <div>
              <p className="text-xs text-dark-400">NASDAQ</p>
              <p className="text-sm font-semibold text-gray-100">N/A</p>
            </div>
            <div>
              <p className="text-xs text-dark-400">Dow Jones</p>
              <p className="text-sm font-semibold text-gray-100">N/A</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RiskAssessment({ content }: { content: string }) {
  const lower = content.toLowerCase();
  const riskLevel =
    lower.includes('high risk') || lower.includes('bearish')
      ? 'High'
      : lower.includes('moderate') || lower.includes('neutral')
        ? 'Medium'
        : 'Low';

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/85 p-4 backdrop-blur-xl">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-100">
        <AlertTriangle className="h-4 w-4 text-accent-red" />
        Risk Assessment
      </h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Overall Risk Level</span>
        <Badge variant={riskLevel === 'High' ? 'red' : riskLevel === 'Medium' ? 'amber' : 'green'}>
          {riskLevel}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-dark-400">
        Based on portfolio composition and market conditions.
      </p>
    </div>
  );
}

export function ActionItems() {
  const actions = [
    'Review underperforming holdings',
    'Consider sector diversification',
    'Monitor market volatility',
  ];

  return (
    <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-green">
        <Activity className="h-4 w-4" />
        Action Items
      </h3>
      <ul className="space-y-1">
        {actions.map((action) => (
          <li key={action} className="flex items-start gap-2 text-sm text-gray-300">
            <span className="mt-0.5 text-accent-green">•</span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreviousBriefItem({
  brief,
  expanded,
  onToggle,
}: {
  brief: DailyBrief;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(brief.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="overflow-hidden rounded-xl border border-dark-700 bg-dark-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-dark-850"
      >
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-dark-400" />
          <span className="text-gray-300">{date}</span>
          <Badge variant={brief.portfolio_snapshot.totalPnl >= 0 ? 'green' : 'red'}>
            {formatPercent(brief.portfolio_snapshot.totalPnlPercent)}
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-dark-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-dark-400" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-dark-700/50 px-4 pb-4">
              <div className="prose prose-sm prose-invert mt-3 max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
