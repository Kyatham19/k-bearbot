'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  RefreshCw,
  Activity,
  BrainCircuit,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { LivePrice } from '@/components/ui/live-price';
import { useLiveQuotes } from '@/lib/hooks/use-live-quotes';
import type { PortfolioHolding } from '@/types/stock';
import { AddHoldingModal } from '@/components/portfolio/add-holding-modal';
import type {
  AssetIntelligenceCard,
  PortfolioIntelligence,
  TechnicalSnapshot,
} from '@/lib/portfolio/intelligence';

type EnrichedHolding = PortfolioHolding & {
  livePrice: number | null;
  liveValue: number;
  livePnl: number;
  livePnlPct: number;
};

function enrich(h: PortfolioHolding, livePrice: number | null): EnrichedHolding {
  const price = livePrice ?? h.currentPrice ?? 0;
  const liveValue = price * h.quantity;
  const invested = h.avg_buy_price * h.quantity;
  const livePnl = liveValue - invested;
  const livePnlPct = invested > 0 ? (livePnl / invested) * 100 : 0;
  return { ...h, livePrice, liveValue, livePnl, livePnlPct };
}

function sentimentStyle(sentiment: PortfolioIntelligence['sentiment']) {
  if (sentiment === 'bullish') return 'text-accent-green';
  if (sentiment === 'bearish') return 'text-accent-red';
  return 'text-accent-amber';
}

function actionBadge(action: AssetIntelligenceCard['action']) {
  if (action === 'buy') return 'green' as const;
  if (action === 'sell') return 'red' as const;
  return 'gray' as const;
}

function momentumBadge(momentum: 'strong' | 'moderate' | 'weak') {
  if (momentum === 'strong') return 'green' as const;
  if (momentum === 'weak') return 'red' as const;
  return 'amber' as const;
}

function PortfolioCard({ holding }: { holding: EnrichedHolding }) {
  const isPositive = holding.livePnl >= 0;
  const glow = isPositive ? 'from-accent-green/15' : 'from-accent-red/15';

  return (
    <div
      className={cn(
        'rounded-2xl border border-dark-700/70 bg-dark-800/85 backdrop-blur-xl',
        'bg-gradient-to-br to-transparent p-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)]',
        glow
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-100">{holding.symbol}</h3>
          <p className="text-xs text-dark-400">{holding.name || holding.symbol}</p>
        </div>
        <Badge variant={isPositive ? 'green' : 'red'}>
          {formatPercent(holding.livePnlPct)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-dark-400">Quantity</p>
          <p className="font-medium text-gray-100">{holding.quantity}</p>
        </div>
        <div>
          <p className="text-dark-400">Avg Buy</p>
          <p className="font-medium text-gray-100">{formatCurrency(holding.avg_buy_price)}</p>
        </div>
        <div>
          <p className="text-dark-400">Current</p>
          <LivePrice
            value={holding.livePrice}
            className="font-medium text-gray-100"
            format={(v) => formatCurrency(v)}
          />
        </div>
        <div>
          <p className="text-dark-400">P&L</p>
          <LivePrice
            value={holding.livePnl}
            flash={false}
            format={(v) => formatCurrency(Math.abs(v))}
            className={cn('font-medium', isPositive ? 'text-accent-green' : 'text-accent-red')}
          />
        </div>
      </div>
    </div>
  );
}

function PortfolioSummary({ holdings }: { holdings: EnrichedHolding[] }) {
  const totalValue = holdings.reduce((sum, h) => sum + h.liveValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avg_buy_price, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const cards = [
    {
      label: 'Total Value',
      value: totalValue,
      format: (v: number) => formatCurrency(v),
      icon: DollarSign,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
    },
    {
      label: 'Total P&L',
      value: totalPnl,
      format: (v: number) => `${formatCurrency(Math.abs(v))} (${formatPercent(totalPnlPercent)})`,
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red',
      bgColor: totalPnl >= 0 ? 'bg-accent-green/10' : 'bg-accent-red/10',
    },
    {
      label: 'Tracked Assets',
      value: holdings.length,
      format: (v: number) => v.toString(),
      icon: BarChart3,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card, index) => (
        <div
          key={index}
          className={cn(
            'rounded-2xl border border-dark-700/70 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.2)]',
            'bg-gradient-to-br from-dark-800/90 to-dark-900/70 backdrop-blur-xl',
            card.bgColor
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg bg-dark-800 p-2', card.color)}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-dark-400">{card.label}</p>
              <LivePrice
                value={card.value}
                format={card.format}
                flash={index !== 2}
                className="text-xl font-bold text-gray-100"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AIIntelligencePanel({ intelligence }: { intelligence: PortfolioIntelligence }) {
  return (
    <div className="mb-8 rounded-2xl border border-dark-700/70 bg-gradient-to-br from-dark-800/95 via-dark-850/85 to-dark-900/80 p-6 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <BrainCircuit className="h-5 w-5 text-accent-brand" />
            AI Portfolio Intelligence
          </h2>
          <p className="mt-1 text-sm text-dark-400">
            Real-time confidence signals, momentum mapping, and beginner-safe guidance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={momentumBadge(intelligence.trendMomentum)}>
            Momentum: {intelligence.trendMomentum}
          </Badge>
          <Badge variant={actionBadge(intelligence.sentiment === 'bullish' ? 'buy' : intelligence.sentiment === 'bearish' ? 'sell' : 'hold')}>
            Sentiment: {intelligence.sentiment}
          </Badge>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-dark-700 bg-dark-900/45 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-dark-400">Portfolio Health Score</p>
          <div className="flex items-center gap-3">
            <Gauge className={cn('h-5 w-5', sentimentStyle(intelligence.sentiment))} />
            <span className={cn('text-2xl font-bold', sentimentStyle(intelligence.sentiment))}>
              {intelligence.healthScore}/100
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-dark-700">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                intelligence.sentiment === 'bullish'
                  ? 'bg-accent-green'
                  : intelligence.sentiment === 'bearish'
                    ? 'bg-accent-red'
                    : 'bg-accent-amber'
              )}
              style={{ width: `${intelligence.healthScore}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-dark-700 bg-dark-900/45 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-dark-400">AI Market Summary</p>
          <p className="text-sm text-gray-200">{intelligence.marketSummary}</p>
          <p className="mt-2 text-xs text-dark-400">{intelligence.beginnerInsight}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {intelligence.actions.slice(0, 6).map((card) => (
          <div key={card.symbol} className="rounded-xl border border-dark-700 bg-dark-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-100">{card.symbol}</p>
                <p className="text-xs text-dark-400">{card.name}</p>
              </div>
              <Badge variant={actionBadge(card.action)}>{card.action.toUpperCase()}</Badge>
            </div>
            <div className="mb-2 flex items-center justify-between text-xs text-dark-400">
              <span>Confidence</span>
              <span>{card.confidence}%</span>
            </div>
            <div className="mb-2 h-1.5 w-full rounded-full bg-dark-700">
              <div
                className={cn(
                  'h-full rounded-full',
                  card.action === 'buy'
                    ? 'bg-accent-green'
                    : card.action === 'sell'
                      ? 'bg-accent-red'
                      : 'bg-accent-amber'
                )}
                style={{ width: `${card.confidence}%` }}
              />
            </div>
            <p className="text-xs text-gray-300">{card.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicalAnalyticsPanel({ technicals }: { technicals: TechnicalSnapshot[] }) {
  if (technicals.length === 0) return null;
  return (
    <div className="mb-8 rounded-2xl border border-dark-700/70 bg-dark-800/80 p-6 shadow-[0_10px_32px_rgba(0,0,0,0.2)]">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-100">
        <Sparkles className="h-5 w-5 text-accent-blue" />
        Advanced Technical Analytics
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {technicals.slice(0, 9).map((t) => (
          <div key={t.symbol} className="rounded-xl border border-dark-700 bg-dark-900/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-gray-100">{t.symbol}</p>
              <Badge variant={momentumBadge(t.momentum)}>{t.momentum}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-dark-400">RSI</p>
                <p className="text-gray-200">{t.rsi === null ? 'N/A' : t.rsi.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-dark-400">MACD Hist</p>
                <p className="text-gray-200">
                  {t.macdHistogram === null ? 'N/A' : t.macdHistogram.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-dark-400">SMA 20</p>
                <p className="text-gray-200">{t.sma20 === null ? 'N/A' : t.sma20.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-dark-400">SMA 50</p>
                <p className="text-gray-200">{t.sma50 === null ? 'N/A' : t.sma50.toFixed(2)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-dark-400">Trend: {t.trend}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [intelligence, setIntelligence] = useState<PortfolioIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchHoldings = async () => {
    try {
      const response = await fetch('/api/portfolio', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntelligence = async () => {
    setIntelLoading(true);
    try {
      const response = await fetch('/api/portfolio/intelligence', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setIntelligence(data.intelligence || null);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio intelligence:', error);
    } finally {
      setIntelLoading(false);
    }
  };

  useEffect(() => {
    void fetchHoldings();
    void fetchIntelligence();
  }, []);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const liveQuotes = useLiveQuotes(symbols, 2000);

  const enriched = useMemo(
    () => holdings.map((h) => enrich(h, liveQuotes[h.symbol]?.price ?? null)),
    [holdings, liveQuotes]
  );

  const handleHoldingAdded = () => {
    void fetchHoldings();
    void fetchIntelligence();
    setShowAddModal(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-dark-700 bg-dark-800 p-4">
              <Skeleton className="mb-2 h-6 w-24" />
              <Skeleton className="mb-4 h-4 w-32" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j}>
                    <Skeleton className="mb-1 h-3 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-100">
            <BarChart3 className="h-6 w-6 text-accent-blue" />
            Portfolio Intelligence
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-dark-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
              <span className="absolute inset-0 rounded-full bg-emerald-400" />
            </span>
            <Activity className="h-3 w-3 text-emerald-400" />
            Live · real-time analytics refresh every 2s
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              void fetchHoldings();
              void fetchIntelligence();
            }}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {enriched.length > 0 && <PortfolioSummary holdings={enriched} />}

      {!intelLoading && intelligence && <AIIntelligencePanel intelligence={intelligence} />}
      {!intelLoading && intelligence && intelligence.technicals.length > 0 && (
        <TechnicalAnalyticsPanel technicals={intelligence.technicals} />
      )}

      {intelLoading && (
        <div className="mb-8 rounded-xl border border-dark-700 bg-dark-800 p-6">
          <div className="mb-3 flex items-center gap-2 text-sm text-dark-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading AI portfolio intelligence...
          </div>
          <Skeleton className="mb-2 h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}

      {enriched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-dark-800 p-6">
            <BarChart3 className="h-12 w-12 text-dark-500" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-gray-100">No assets yet</h2>
          <p className="mb-6 text-sm text-dark-400">
            Add your first holding to unlock AI scoring, sentiment, and technical analytics.
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {enriched.map((holding) => (
            <PortfolioCard key={holding.id} holding={holding} />
          ))}
        </div>
      )}

      <AddHoldingModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={handleHoldingAdded}
      />
    </div>
  );
}
