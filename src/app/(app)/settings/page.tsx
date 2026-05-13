'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  BarChart3,
  Languages,
  Eye,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserPreferences } from '@/types/database';

type Prefs = Partial<UserPreferences> & {
  default_market?: 'US' | 'IN';
  theme?: string;
  language_mode?: 'auto' | 'english' | 'tanglish';
  show_charts?: boolean;
  show_news_cards?: boolean;
  notif_brief_email?: boolean;
  notif_in_app?: boolean;
  daily_brief_time?: string;
  daily_brief_tz?: string;
  created_at?: string;
};

function SettingCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 p-6">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-accent-blue/10 text-accent-blue">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-100 mb-1">{title}</h3>
          <p className="text-sm text-dark-400 mb-4">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-accent-blue' : 'bg-dark-600'}`}
      aria-pressed={value}
      aria-label={label}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

const COMMON_TZ = [
  'Asia/Kolkata',
  'America/New_York',
  'Europe/London',
  'Asia/Singapore',
  'Asia/Dubai',
  'UTC',
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      } else {
        toast.error('Failed to load preferences');
      }
    } catch {
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: string, value: unknown) => {
    // Optimistic
    setPreferences((p) => ({ ...(p ?? {}), [key]: value }));
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        toast.success('Saved');
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error ?? 'Save failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-700 rounded w-1/4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-dark-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const p = preferences ?? {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-accent-blue" />
          Settings
        </h1>
        <p className="text-sm text-dark-400 mt-1">
          Customize your AlphaSight AI experience
        </p>
      </div>

      <div className="space-y-6">
        {/* Market */}
        <SettingCard icon={BarChart3} title="Market Preferences" description="Set your default market and regional preferences">
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">Default Market</label>
            <div className="flex gap-2">
              <Button variant={p.default_market === 'US' ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('default_market', 'US')}>US Markets</Button>
              <Button variant={p.default_market === 'IN' ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('default_market', 'IN')}>Indian Markets</Button>
            </div>
          </div>
        </SettingCard>

        {/* Theme */}
        <SettingCard icon={Palette} title="Appearance" description="Customize the look and feel">
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-2">Theme</label>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <Button key={t} variant={p.theme === t ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('theme', t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </SettingCard>

        {/* Language */}
        <SettingCard icon={Languages} title="Language" description="Choose how the assistant talks back to you">
          <div className="flex gap-2 flex-wrap">
            <Button variant={p.language_mode === 'auto' ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('language_mode', 'auto')}>Auto-detect</Button>
            <Button variant={p.language_mode === 'english' ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('language_mode', 'english')}>English only</Button>
            <Button variant={p.language_mode === 'tanglish' ? 'primary' : 'secondary'} size="sm" onClick={() => updatePreference('language_mode', 'tanglish')}>Tanglish</Button>
          </div>
          <p className="text-xs text-dark-400 mt-2">
            Auto-detect picks Tanglish only when you write in Tanglish.
          </p>
        </SettingCard>

        {/* Display */}
        <SettingCard icon={Eye} title="Display" description="Control what shows up in chat">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Show Charts</h4>
                <p className="text-xs text-dark-400">Embed price charts for stock queries</p>
              </div>
              <Toggle value={!!p.show_charts} onChange={(v) => updatePreference('show_charts', v)} label="Show Charts" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Show News Cards</h4>
                <p className="text-xs text-dark-400">Display news headlines for analyzed stocks</p>
              </div>
              <Toggle value={!!p.show_news_cards} onChange={(v) => updatePreference('show_news_cards', v)} label="Show News Cards" />
            </div>
          </div>
        </SettingCard>

        {/* Notifications */}
        <SettingCard icon={Bell} title="Notifications" description="Choose where you hear from us">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Daily Brief Emails</h4>
                <p className="text-xs text-dark-400">Scheduled portfolio brief delivered by email</p>
              </div>
              <Toggle value={!!p.notif_brief_email} onChange={(v) => updatePreference('notif_brief_email', v)} label="Daily brief email" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">In-app Toasts</h4>
                <p className="text-xs text-dark-400">Show success/error toasts inside the app</p>
              </div>
              <Toggle value={!!p.notif_in_app} onChange={(v) => updatePreference('notif_in_app', v)} label="In-app toasts" />
            </div>
          </div>
        </SettingCard>

        {/* Daily brief schedule */}
        <SettingCard icon={Clock} title="Daily Brief Schedule" description="Pick when the brief lands in your inbox">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">Time (HH:MM, local)</label>
              <input
                type="time"
                className="w-full rounded-lg bg-dark-750 border border-dark-700 px-3 py-2 text-sm text-gray-100"
                value={p.daily_brief_time ?? '09:00'}
                onChange={(e) => updatePreference('daily_brief_time', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">Timezone</label>
              <select
                className="w-full rounded-lg bg-dark-750 border border-dark-700 px-3 py-2 text-sm text-gray-100"
                value={p.daily_brief_tz ?? 'Asia/Kolkata'}
                onChange={(e) => updatePreference('daily_brief_tz', e.target.value)}
              >
                {COMMON_TZ.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </SettingCard>

        {/* Account */}
        <SettingCard icon={User} title="Account Information" description="View and manage your account details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">Status</label>
              <Badge variant="green">Active</Badge>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">Member Since</label>
              <p className="text-sm text-dark-400">
                {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </SettingCard>

        {/* Privacy */}
        <SettingCard icon={Shield} title="Privacy & Security" description="Manage your data privacy">
          <div className="flex items-center justify-between p-4 rounded-lg bg-dark-750">
            <div>
              <h4 className="text-sm font-medium text-gray-100">Data Collection</h4>
              <p className="text-xs text-dark-400">Anonymous usage data only</p>
            </div>
            <Badge variant="gray">Required</Badge>
          </div>
        </SettingCard>
      </div>
    </div>
  );
}
