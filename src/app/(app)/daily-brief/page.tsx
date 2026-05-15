'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Sun,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
  Settings,
  Clock,
  Mail,
  Plus,
  Trash2,
  Pencil,
  Power,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import type { DailyBrief, PortfolioSnapshot } from '@/types/stock';

export function DailyBriefView() {
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<any[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const fetchBriefs = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-brief');
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.briefs || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScheduledReports = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled-reports');
      if (res.ok) {
        const data = await res.json();
        setScheduledReports(data.reports || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchBriefs();
  }, [fetchBriefs]);

  useEffect(() => {
    if (showSettings) {
      fetchScheduledReports();
    }
  }, [showSettings, fetchScheduledReports]);

  async function handleGenerate() {
    setGenerating(true);
    toast.info('Generating your brief...');
    try {
      const res = await fetch('/api/daily-brief', { method: 'POST' });
      if (res.ok) {
        toast.success('Brief ready');
        await fetchBriefs();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to generate brief');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setGenerating(false);
    }
  }

  const latestBrief = briefs.length > 0 ? briefs[0] : null;
  const previousBriefs = briefs.slice(1);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-gray-50 dark:bg-dark-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Sun className="h-6 w-6 text-accent-amber" />
              Daily Portfolio Brief
            </h1>
            <p className="text-sm text-dark-400 mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {today}
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            loading={generating}
            size="md"
          >
            <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
            Generate New Brief
          </Button>
        </div>

        {/* Settings Panel */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: showSettings ? 1 : 0,
            height: showSettings ? 'auto' : 0
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-6 mb-6">
            <DailyBriefSettings
              reports={scheduledReports}
              onReportsChange={setScheduledReports}
              loading={settingsLoading}
              setLoading={setSettingsLoading}
            />
          </div>
        </motion.div>

        {/* Toggle Settings Button */}
        <div className="flex justify-center mb-6">
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            {showSettings ? 'Hide' : 'Show'} Daily Brief Settings
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="rounded-xl border border-dark-700 bg-dark-800 p-6 space-y-4">
              <SkeletonLine className="w-1/3 h-6" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-1/3 h-6 mt-4" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-3/4" />
            </div>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-8 text-center mb-6"
          >
            <RefreshCw className="h-8 w-8 text-accent-green animate-spin mx-auto mb-3" />
            <p className="text-gray-100 font-medium">
              Generating your daily brief...
            </p>
            <p className="text-sm text-dark-400 mt-1">
              Analyzing portfolio, market data, and macro risks.
            </p>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && !generating && briefs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-dark-800 p-6 mb-4">
              <Sun className="h-10 w-10 text-dark-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              No briefs yet
            </h2>
            <p className="text-sm text-dark-400 mb-6">
              Generate your first daily brief to get portfolio insights.
            </p>
            <Button onClick={handleGenerate} loading={generating}>
              <RefreshCw className="h-4 w-4" />
              Generate Your First Brief
            </Button>
          </motion.div>
        )}

        {/* Latest brief */}
        {!loading && latestBrief && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Executive Summary */}
            <ExecutiveSummary snapshot={latestBrief.portfolio_snapshot} />

            {/* Market Overview */}
            <MarketOverview snapshot={latestBrief.portfolio_snapshot} />

            {/* Snapshot cards */}
            <SnapshotCards snapshot={latestBrief.portfolio_snapshot} />

            {/* Top gainers and losers */}
            <GainersLosers snapshot={latestBrief.portfolio_snapshot} />

            {/* Risk Assessment */}
            <RiskAssessment content={latestBrief.content} />

            {/* Sentiment gauge */}
            <SentimentGauge content={latestBrief.content} snapshot={latestBrief.portfolio_snapshot} />

            {/* Action Items */}
            <ActionItems content={latestBrief.content} />

            {/* Brief content */}
            <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-accent-green" />
                  Comprehensive Analysis
                </h2>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {latestBrief.content}
                </ReactMarkdown>
              </div>
              <div className="mt-4 pt-4 border-t border-dark-700/50 flex items-center justify-between">
                <p className="text-xs text-dark-500">
                  Generated{' '}
                  {new Date(latestBrief.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <Badge variant="gray">Professional Grade</Badge>
              </div>
            </div>

            {/* Previous briefs */}
            {previousBriefs.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-100 mb-3">
                  Previous Briefs
                </h2>
                <div className="space-y-2">
                  {previousBriefs.map((brief) => (
                    <PreviousBriefItem
                      key={brief.id}
                      brief={brief}
                      expanded={expandedBriefId === brief.id}
                      onToggle={() =>
                        setExpandedBriefId(
                          expandedBriefId === brief.id ? null : brief.id
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function DailyBriefSettings({
  reports,
  onReportsChange,
  loading,
  setLoading
}: {
  reports: any[];
  onReportsChange: (reports: any[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/scheduled-reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onReportsChange(reports.filter(r => r.id !== id));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (report: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduled-reports/${report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !report.is_active }),
      });
      if (res.ok) {
        const data = await res.json();
        onReportsChange(reports.map(r => r.id === report.id ? data.report : r));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const formatLastSent = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-blue" />
            Automated Daily Briefs
          </h2>
          <p className="text-sm text-dark-400 mt-1">
            Set up automatic email delivery of your stock reports
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CreateScheduleForm
              onSuccess={(newReport) => {
                onReportsChange([...reports, newReport]);
                setShowCreateForm(false);
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Reports */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No scheduled reports yet</p>
            <p className="text-sm">Create your first automated brief above</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="rounded-lg border border-dark-700 bg-dark-850">
              {editingId === report.id ? (
                <div className="p-2">
                  <CreateScheduleForm
                    initialData={report}
                    reportId={report.id}
                    onSuccess={(updated) => {
                      onReportsChange(reports.map(r => r.id === report.id ? updated : r));
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-accent-blue" />
                      <span className="text-sm font-medium text-gray-100">{report.schedule_time}</span>
                      <span className="text-xs text-dark-400">({report.timezone})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-dark-400" />
                      <span className="text-sm text-gray-300">{report.email}</span>
                    </div>
                    <Badge variant={report.is_active ? 'green' : 'gray'}>
                      {report.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs text-dark-400">
                      {report.stocks.length} stocks · last sent {formatLastSent(report.last_sent_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleToggleActive(report)}
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      title={report.is_active ? 'Pause' : 'Resume'}
                    >
                      <Power className={cn('h-4 w-4', report.is_active ? 'text-accent-green' : 'text-dark-400')} />
                    </Button>
                    <Button
                      onClick={() => setEditingId(report.id)}
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-accent-blue" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(report.id)}
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      className="text-accent-red hover:text-accent-red hover:bg-accent-red/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateScheduleForm({
  onSuccess,
  onCancel,
  initialData,
  reportId,
}: {
  onSuccess: (report: any) => void;
  onCancel: () => void;
  initialData?: { email: string; stocks: string[]; schedule_time: string; timezone: string; is_active: boolean };
  reportId?: string;
}) {
  const isEdit = !!reportId;
  const [formData, setFormData] = useState({
    email: initialData?.email ?? '',
    stocks: (initialData?.stocks ?? []) as string[],
    schedule_time: initialData?.schedule_time ?? '07:00',
    timezone: initialData?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_active: initialData?.is_active ?? true,
  });
  const [stockInput, setStockInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; exchange: string; type: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const searchStocks = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Stock search error:', error);
      setSearchResults([]);
      setShowSuggestions(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle input changes with debouncing
  const handleStockInputChange = useCallback((value: string) => {
    setStockInput(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchStocks(value);
    }, 300);
  }, [searchStocks]);

  const handleAddStock = (symbol?: string) => {
    const stockSymbol = symbol || stockInput.trim().toUpperCase();
    if (stockSymbol && !formData.stocks.includes(stockSymbol)) {
      setFormData(prev => ({
        ...prev,
        stocks: [...prev.stocks, stockSymbol]
      }));
      setStockInput('');
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: { symbol: string; name: string; exchange: string; type: string }) => {
    handleAddStock(suggestion.symbol);
  };

  const handleRemoveStock = (symbol: string) => {
    setFormData(prev => ({
      ...prev,
      stocks: prev.stocks.filter(s => s !== symbol)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.email || formData.stocks.length === 0) return;

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/scheduled-reports/${reportId}` : '/api/scheduled-reports';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.report);
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-dark-700 rounded-lg p-4 bg-dark-850 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-100 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-gray-100 placeholder-dark-500 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-100 mb-2">
            Schedule Time (HH:MM)
          </label>
          <input
            type="time"
            value={formData.schedule_time}
            onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-gray-100 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
          />
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-100 mb-2">
          Stocks to Track
        </label>
        <div className="flex gap-2 mb-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={stockInput}
              onChange={(e) => handleStockInputChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (showSuggestions && searchResults.length > 0) {
                    handleSelectSuggestion(searchResults[0]);
                  } else {
                    handleAddStock();
                  }
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow click selection
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-gray-100 placeholder-dark-500 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
              placeholder="Search for stocks (e.g., Apple, Tesla, Google)..."
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-accent-blue border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
          <Button onClick={() => handleAddStock()} size="sm" variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Autocomplete Suggestions */}
        {showSuggestions && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-dark-800 border border-dark-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <div
                key={`${result.symbol}-${index}`}
                className="px-3 py-2 hover:bg-dark-700 cursor-pointer border-b border-dark-700/50 last:border-b-0"
                onClick={() => handleSelectSuggestion(result)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{result.symbol}</span>
                      <Badge variant="gray" className="text-xs">
                        {result.exchange}
                      </Badge>
                    </div>
                    <div className="text-sm text-dark-400 truncate">
                      {result.name}
                    </div>
                  </div>
                  <Badge variant="blue" className="text-xs ml-2">
                    {result.type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Stocks */}
        <div className="flex flex-wrap gap-2 mt-3">
          {formData.stocks.map((stock) => (
            <Badge
              key={stock}
              variant="blue"
              className="cursor-pointer hover:bg-accent-blue/20"
              onClick={() => handleRemoveStock(stock)}
            >
              {stock} ×
            </Badge>
          ))}
        </div>

        {formData.stocks.length === 0 && (
          <p className="text-xs text-dark-400 mt-2">
            Add stocks to track in your daily brief reports
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
        <Button onClick={onCancel} variant="ghost" size="sm">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={!formData.email || formData.stocks.length === 0}
          size="sm"
        >
          {isEdit ? 'Save Changes' : 'Create Schedule'}
        </Button>
      </div>
    </div>
  );
}

export default function DailyBriefPage() {
  return <DailyBriefView />;
}

/* ── Sub-components ──────────────────────────────────────────────── */

function SnapshotCards({ snapshot }: { snapshot: PortfolioSnapshot }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">
          Portfolio Value
        </p>
        <p className="text-xl font-bold text-gray-100">
          {formatCurrency(snapshot.totalValue)}
        </p>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">Total P&L</p>
        <p
          className={cn(
            'text-xl font-bold',
            getChangeColor(snapshot.totalPnl)
          )}
        >
          {formatCurrency(snapshot.totalPnl)}
        </p>
        <Badge
          variant={snapshot.totalPnlPercent >= 0 ? 'green' : 'red'}
          className="mt-1"
        >
          {formatPercent(snapshot.totalPnlPercent)}
        </Badge>
      </div>
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
        <p className="text-xs text-dark-400 font-medium mb-1">Holdings</p>
        <p className="text-xl font-bold text-gray-100">
          {snapshot.holdings.length}
        </p>
        <p className="text-xs text-dark-400 mt-1">stocks tracked</p>
      </div>
    </div>
  );
}

function GainersLosers({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const sorted = [...snapshot.holdings].sort(
    (a, b) => b.pnlPercent - a.pnlPercent
  );
  const gainers = sorted.filter((h) => h.pnlPercent > 0).slice(0, 3);
  const losers = sorted.filter((h) => h.pnlPercent < 0).slice(-3).reverse();

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {gainers.length > 0 && (
        <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
          <h3 className="text-sm font-semibold text-accent-green mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Top Gainers
          </h3>
          <div className="space-y-2">
            {gainers.map((h) => (
              <div
                key={h.symbol}
                className="flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-100">
                  {h.symbol}
                </span>
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
          <h3 className="text-sm font-semibold text-accent-red mb-3 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Top Losers
          </h3>
          <div className="space-y-2">
            {losers.map((h) => (
              <div
                key={h.symbol}
                className="flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-100">
                  {h.symbol}
                </span>
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

function SentimentGauge({ content, snapshot }: { content: string; snapshot: PortfolioSnapshot }) {
  let score = 50; // neutral default

  // Factor 1: Portfolio performance (40% weight)
  const portfolioScore = snapshot.totalPnlPercent > 5 ? 100 :
                        snapshot.totalPnlPercent > 0 ? 75 :
                        snapshot.totalPnlPercent > -5 ? 50 : 25;

  // Factor 2: Market indices (40% weight)
  let marketScore = 50;
  if (snapshot.marketIndices && snapshot.marketIndices.length > 0) {
    const avgChange = snapshot.marketIndices.reduce((sum, idx) => sum + idx.changePercent, 0) / snapshot.marketIndices.length;
    marketScore = Math.max(0, Math.min(100, 50 + avgChange * 10)); // Scale around 50
  }

  // Factor 3: Content analysis (20% weight)
  const lower = content.toLowerCase();
  const bullishKeywords = ['bullish', 'upside', 'growth', 'positive', 'outperform', 'buy', 'strong', 'rally', 'momentum'];
  const bearishKeywords = ['bearish', 'downside', 'risk', 'negative', 'underperform', 'sell', 'weak', 'decline', 'correction'];

  let bullishCount = 0;
  let bearishCount = 0;
  for (const kw of bullishKeywords) {
    bullishCount += (lower.match(new RegExp(kw, 'g')) || []).length;
  }
  for (const kw of bearishKeywords) {
    bearishCount += (lower.match(new RegExp(kw, 'g')) || []).length;
  }

  const contentTotal = bullishCount + bearishCount;
  const contentScore = contentTotal > 0 ? (bullishCount / contentTotal) * 100 : 50;

  // Weighted average
  score = Math.round((portfolioScore * 0.4) + (marketScore * 0.4) + (contentScore * 0.2));

  const label =
    score >= 70 ? 'Bullish' : score >= 40 ? 'Neutral' : 'Bearish';
  const color =
    score >= 70
      ? 'text-accent-green'
      : score >= 40
        ? 'text-accent-amber'
        : 'text-accent-red';
  const barColor =
    score >= 70
      ? 'bg-accent-green'
      : score >= 40
        ? 'bg-accent-amber'
        : 'bg-accent-red';

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-accent-amber" />
        Portfolio Sentiment
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-full rounded-full bg-dark-700 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-accent-red">Bearish</span>
            <span className="text-xs text-accent-green">Bullish</span>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className={cn('text-2xl font-bold', color)}>{score}</p>
          <p className={cn('text-xs font-medium', color)}>{label}</p>
        </div>
      </div>
    </div>
  );
}

function ExecutiveSummary({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const isPositive = snapshot.totalPnl >= 0;
  return (
    <div className="rounded-xl border border-accent-amber/20 bg-gradient-to-r from-accent-amber/5 to-accent-green/5 p-6">
      <h2 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-accent-amber" />
        Executive Summary
      </h2>
      <p className="text-sm text-gray-300 mb-4">
        Your portfolio is valued at <strong>{formatCurrency(snapshot.totalValue)}</strong> with a total P&L of{' '}
        <span className={cn('font-semibold', getChangeColor(snapshot.totalPnl))}>
          {formatCurrency(snapshot.totalPnl)} ({formatPercent(snapshot.totalPnlPercent)})
        </span>
        . {snapshot.holdings.length} holdings are being tracked with {isPositive ? 'positive momentum' : 'areas for review'}.
      </p>
      <div className="flex items-center gap-4 text-xs text-dark-400">
        <span>📊 Market Analysis Included</span>
        <span>🎯 Actionable Insights</span>
        <span>⚠️ Risk Assessment</span>
      </div>
    </div>
  );
}

function MarketOverview({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const indices = snapshot.marketIndices || [];
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-accent-blue" />
        Market Overview
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        {indices.map((idx) => (
          <div key={idx.symbol}>
            <p className="text-xs text-dark-400">{idx.symbol}</p>
            <p className="text-sm font-semibold text-gray-100">{formatCurrency(idx.price)}</p>
            <Badge
              variant={idx.changePercent >= 0 ? 'green' : 'red'}
              className="text-xs"
            >
              {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
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

function RiskAssessment({ content }: { content: string }) {
  const lower = content.toLowerCase();
  const riskLevel = lower.includes('high risk') || lower.includes('bearish') ? 'High' :
                   lower.includes('moderate') || lower.includes('neutral') ? 'Medium' : 'Low';

  const color = riskLevel === 'High' ? 'text-accent-red' :
               riskLevel === 'Medium' ? 'text-accent-amber' : 'text-accent-green';

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-accent-red" />
        Risk Assessment
      </h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Overall Risk Level</span>
        <Badge variant={riskLevel === 'High' ? 'red' : riskLevel === 'Medium' ? 'amber' : 'green'}>
          {riskLevel}
        </Badge>
      </div>
      <p className="text-xs text-dark-400 mt-2">
        Based on portfolio composition and market conditions.
      </p>
    </div>
  );
}

function ActionItems({ content }: { content: string }) {
  // Extract action items from content (this is simplified)
  const actions = [
    "Review underperforming holdings",
    "Consider sector diversification",
    "Monitor market volatility",
  ];

  return (
    <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
      <h3 className="text-sm font-semibold text-accent-green mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Action Items
      </h3>
      <ul className="space-y-1">
        {actions.map((action, i) => (
          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
            <span className="text-accent-green mt-0.5">•</span>
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviousBriefItem({
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
    <div className="rounded-xl border border-dark-700 bg-dark-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-dark-850 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-dark-400" />
          <span className="text-gray-300">{date}</span>
          <Badge
            variant={
              brief.portfolio_snapshot.totalPnl >= 0 ? 'green' : 'red'
            }
          >
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
            <div className="px-4 pb-4 border-t border-dark-700/50">
              <div className="prose prose-sm prose-invert max-w-none mt-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {brief.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
