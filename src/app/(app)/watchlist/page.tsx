'use client';

import { useState, useEffect } from 'react';
import { Star, Plus, TrendingUp, TrendingDown, X } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface WatchlistItem {
  id: string;
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  added_at: string;
}

function WatchlistCard({ item, onRemove }: { item: WatchlistItem; onRemove: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 hover:bg-dark-750 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-amber/10 text-accent-amber">
            <Star className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{item.symbol}</h3>
            <p className="text-sm text-dark-400">{item.name || item.symbol}</p>
          </div>
        </div>
        <Button
          onClick={() => onRemove(item.id)}
          variant="ghost"
          size="sm"
          className="text-accent-red hover:text-accent-red hover:bg-accent-red/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {item.price !== undefined ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-gray-100">
              {formatCurrency(item.price)}
            </p>
            {item.change !== undefined && item.changePercent !== undefined && (
              <p className={cn(
                'text-sm flex items-center gap-1',
                item.change >= 0 ? 'text-accent-green' : 'text-accent-red'
              )}>
                {item.change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {formatCurrency(Math.abs(item.change))} ({formatPercent(item.changePercent)})
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-dark-500">Added</p>
            <p className="text-xs text-dark-400">
              {new Date(item.added_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-sm text-dark-400">
          Price data unavailable
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStock, setAddingStock] = useState(false);
  const [stockInput, setStockInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch('/api/watchlist');
      if (response.ok) {
        const data = await response.json();
        // Fetch current prices for watchlist items
        const itemsWithPrices = await Promise.all(
          (data.watchlist || []).map(async (item: WatchlistItem) => {
            try {
              const priceResponse = await fetch(`/api/stock/quote?symbol=${item.symbol}`);
              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return {
                  ...item,
                  price: priceData.quote?.price,
                  change: priceData.quote?.change,
                  changePercent: priceData.quote?.changePercent,
                };
              }
            } catch {
              // Price fetch failed, continue without price
            }
            return item;
          })
        );
        setWatchlist(itemsWithPrices);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const searchStocks = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results?.slice(0, 5) || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Stock search error:', error);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleAddToWatchlist = async (symbol: string) => {
    setAddingStock(true);
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });

      if (response.ok) {
        setStockInput('');
        setSearchResults([]);
        setShowSuggestions(false);
        fetchWatchlist(); // Refresh the watchlist
      }
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
    } finally {
      setAddingStock(false);
    }
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchWatchlist(); // Refresh the watchlist
      }
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    }
  };

  const handleInputChange = (value: string) => {
    setStockInput(value);
    // Debounced search
    setTimeout(() => searchStocks(value), 300);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-dark-800 rounded-xl"></div>
            ))}
          </div>
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
            <Star className="h-6 w-6 text-accent-amber" />
            Watchlist
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Track stocks you're interested in monitoring
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input
              type="text"
              value={stockInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search stocks to add..."
              className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 placeholder-dark-500 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue w-64"
            />
            {showSuggestions && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.symbol}
                    className="px-4 py-2 hover:bg-dark-700 cursor-pointer border-b border-dark-700/50 last:border-b-0"
                    onClick={() => handleAddToWatchlist(result.symbol)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-100">{result.symbol}</div>
                        <div className="text-sm text-dark-400">{result.name}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={addingStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToWatchlist(result.symbol);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => stockInput && handleAddToWatchlist(stockInput.toUpperCase())}
            disabled={!stockInput || addingStock}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {addingStock ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Watchlist Grid */}
      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-dark-800 p-6 mb-4">
            <Star className="h-12 w-12 text-dark-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100 mb-1">
            Your watchlist is empty
          </h2>
          <p className="text-sm text-dark-400 mb-6">
            Start tracking stocks by searching and adding them above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlist.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              onRemove={handleRemoveFromWatchlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}