'use client';

import { useMemo, useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw, Activity } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { LivePrice } from '@/components/ui/live-price';
import { useLiveQuotes } from '@/lib/hooks/use-live-quotes';
import type { PortfolioHolding } from '@/types/stock';
import { AddHoldingModal } from '@/components/portfolio/add-holding-modal';

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

function PortfolioCard({ holding }: { holding: EnrichedHolding }) {
  const isPositive = holding.livePnl >= 0;

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 hover:bg-dark-750 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-100">{holding.symbol}</h3>
          <p className="text-sm text-dark-400">{holding.name || holding.symbol}</p>
        </div>
        <Badge variant={isPositive ? 'green' : 'red'}>
          {formatPercent(holding.livePnlPct)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-dark-400">Quantity</p>
          <p className="font-medium text-gray-100">{holding.quantity}</p>
        </div>
        <div>
          <p className="text-dark-400">Avg. Buy Price</p>
          <p className="font-medium text-gray-100">{formatCurrency(holding.avg_buy_price)}</p>
        </div>
        <div>
          <p className="text-dark-400">Current Price</p>
          <LivePrice
            value={holding.livePrice}
            className="font-medium text-gray-100"
            format={(v) => formatCurrency(v)}
          />
        </div>
        <div>
          <p className="text-dark-400">P&amp;L</p>
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
      label: 'Holdings',
      value: holdings.length,
      format: (v: number) => v.toString(),
      icon: BarChart3,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {cards.map((card, index) => (
        <div key={index} className={cn('rounded-xl border border-dark-700 p-4', card.bgColor)}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-dark-800', card.color)}>
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

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchHoldings();
  }, []);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const liveQuotes = useLiveQuotes(symbols, 2000);

  const enriched = useMemo(
    () => holdings.map((h) => enrich(h, liveQuotes[h.symbol]?.price ?? null)),
    [holdings, liveQuotes]
  );

  const handleHoldingAdded = () => {
    fetchHoldings();
    setShowAddModal(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-dark-700 bg-dark-800 p-4">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-16 mb-1" />
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent-blue" />
            Portfolio
          </h1>
          <p className="text-sm text-dark-400 mt-1 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
              <span className="absolute inset-0 rounded-full bg-emerald-400" />
            </span>
            <Activity className="h-3 w-3 text-emerald-400" />
            Live · prices refresh every 2s
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={fetchHoldings}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Holding
          </Button>
        </div>
      </div>

      {/* Portfolio Summary */}
      {enriched.length > 0 && <PortfolioSummary holdings={enriched} />}

      {/* Holdings Grid */}
      {enriched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-dark-800 p-6 mb-4">
            <BarChart3 className="h-12 w-12 text-dark-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">
            No holdings yet
          </h2>
          <p className="text-sm text-dark-400 mb-6">
            Start building your portfolio by adding your first stock holding.
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Holding
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enriched.map((holding) => (
            <PortfolioCard key={holding.id} holding={holding} />
          ))}
        </div>
      )}

      {/* Add Holding Modal */}
      <AddHoldingModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={handleHoldingAdded}
      />
    </div>
  );
}
