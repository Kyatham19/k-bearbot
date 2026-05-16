'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Sun,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import {
  ActionItems,
  ExecutiveSummary,
  GainersLosers,
  MarketOverview,
  PreviousBriefItem,
  RiskAssessment,
  SentimentGauge,
  SnapshotCards,
} from '@/components/daily-brief/brief-insights';
import { DailyBriefSettings } from '@/components/daily-brief/schedule-settings';
import type { DailyBrief } from '@/types/stock';
import type { ScheduledReport } from '@/types/database';

export function DailyBriefView() {
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
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
            <ActionItems />

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

export default function DailyBriefPage() {
  return <DailyBriefView />;
}
