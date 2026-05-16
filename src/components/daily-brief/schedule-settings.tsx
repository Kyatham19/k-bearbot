'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Mail, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ScheduledReport } from '@/types/database';

type StockSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

type SchedulePayload = {
  email: string;
  stocks: string[];
  schedule_time: string;
  timezone: string;
  is_active: boolean;
};

export function DailyBriefSettings({
  reports,
  onReportsChange,
  loading,
  setLoading,
}: {
  reports: ScheduledReport[];
  onReportsChange: (reports: ScheduledReport[]) => void;
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
        onReportsChange(reports.filter((r) => r.id !== id));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (report: ScheduledReport) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduled-reports/${report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !report.is_active }),
      });
      if (res.ok) {
        const data = (await res.json()) as { report: ScheduledReport };
        onReportsChange(reports.map((r) => (r.id === report.id ? data.report : r)));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatLastSent = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <Clock className="h-5 w-5 text-accent-blue" />
            Automated Daily Briefs
          </h2>
          <p className="mt-1 text-sm text-dark-400">
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

      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="py-8 text-center text-dark-400">
            <Mail className="mx-auto mb-3 h-12 w-12 opacity-50" />
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
                      onReportsChange(reports.map((r) => (r.id === report.id ? updated : r)));
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div className="flex flex-wrap items-center gap-4">
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
                      <Power
                        className={cn(
                          'h-4 w-4',
                          report.is_active ? 'text-accent-green' : 'text-dark-400'
                        )}
                      />
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
                      className="text-accent-red hover:bg-accent-red/10 hover:text-accent-red"
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
  onSuccess: (report: ScheduledReport) => void;
  onCancel: () => void;
  initialData?: SchedulePayload;
  reportId?: string;
}) {
  const isEdit = !!reportId;
  const [formData, setFormData] = useState<SchedulePayload>({
    email: initialData?.email ?? '',
    stocks: initialData?.stocks ?? [],
    schedule_time: initialData?.schedule_time ?? '07:00',
    timezone: initialData?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_active: initialData?.is_active ?? true,
  });
  const [stockInput, setStockInput] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const data = (await response.json()) as { results?: StockSearchResult[] };
        setSearchResults(data.results || []);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleStockInputChange = useCallback(
    (value: string) => {
      setStockInput(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        void searchStocks(value);
      }, 300);
    },
    [searchStocks]
  );

  const handleAddStock = (symbol?: string) => {
    const stockSymbol = symbol || stockInput.trim().toUpperCase();
    if (stockSymbol && !formData.stocks.includes(stockSymbol)) {
      setFormData((prev) => ({ ...prev, stocks: [...prev.stocks, stockSymbol] }));
      setStockInput('');
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleRemoveStock = (symbol: string) => {
    setFormData((prev) => ({ ...prev, stocks: prev.stocks.filter((s) => s !== symbol) }));
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
        const data = (await res.json()) as { report: ScheduledReport };
        onSuccess(data.report);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-dark-700 bg-dark-850 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-100">Email Address</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full rounded-md border border-dark-700 bg-dark-800 px-3 py-2 text-gray-100 placeholder-dark-500 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-100">Schedule Time (HH:MM)</label>
          <input
            type="time"
            value={formData.schedule_time}
            onChange={(e) => setFormData((prev) => ({ ...prev, schedule_time: e.target.value }))}
            className="w-full rounded-md border border-dark-700 bg-dark-800 px-3 py-2 text-gray-100 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
          />
        </div>
      </div>

      <div className="relative">
        <label className="mb-2 block text-sm font-medium text-gray-100">Assets to Track</label>
        <div className="mb-2 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={stockInput}
              onChange={(e) => handleStockInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (showSuggestions && searchResults.length > 0) handleAddStock(searchResults[0].symbol);
                  else handleAddStock();
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className="w-full rounded-md border border-dark-700 bg-dark-800 px-3 py-2 text-gray-100 placeholder-dark-500 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
              placeholder="Search assets (e.g., Bitcoin, Ethereum, Solana)..."
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
              </div>
            )}
          </div>
          <Button onClick={() => handleAddStock()} size="sm" variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showSuggestions && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-dark-700 bg-dark-800 shadow-lg">
            {searchResults.map((result, index) => (
              <div
                key={`${result.symbol}-${index}`}
                className="cursor-pointer border-b border-dark-700/50 px-3 py-2 hover:bg-dark-700 last:border-b-0"
                onClick={() => handleAddStock(result.symbol)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100">{result.symbol}</span>
                      <Badge variant="gray" className="text-xs">
                        {result.exchange}
                      </Badge>
                    </div>
                    <div className="truncate text-sm text-dark-400">{result.name}</div>
                  </div>
                  <Badge variant="blue" className="ml-2 text-xs">
                    {result.type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
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
          <p className="mt-2 text-xs text-dark-400">
            Add assets to track in your daily brief reports.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-dark-700 pt-4">
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
