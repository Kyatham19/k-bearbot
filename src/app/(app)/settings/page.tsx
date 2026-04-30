'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Palette, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserPreferences } from '@/types/database';

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

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
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
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
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
        {/* Market Preferences */}
        <SettingCard
          icon={BarChart3}
          title="Market Preferences"
          description="Set your default market and regional preferences"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                Default Market
              </label>
              <div className="flex gap-2">
                <Button
                  variant={preferences?.default_market === 'US' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updatePreference('default_market', 'US')}
                >
                  US Markets
                </Button>
                <Button
                  variant={preferences?.default_market === 'IN' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updatePreference('default_market', 'IN')}
                >
                  Indian Markets
                </Button>
              </div>
              <p className="text-xs text-dark-400 mt-1">
                This affects default stock suggestions and market data preferences
              </p>
            </div>
          </div>
        </SettingCard>

        {/* Theme Settings */}
        <SettingCard
          icon={Palette}
          title="Appearance"
          description="Customize the look and feel of the application"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                Theme
              </label>
              <div className="flex gap-2">
                <Button
                  variant={preferences?.theme === 'dark' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updatePreference('theme', 'dark')}
                >
                  Dark
                </Button>
                <Button
                  variant={preferences?.theme === 'light' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updatePreference('theme', 'light')}
                >
                  Light
                </Button>
                <Button
                  variant={preferences?.theme === 'system' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updatePreference('theme', 'system')}
                >
                  System
                </Button>
              </div>
            </div>
          </div>
        </SettingCard>

        {/* Account Information */}
        <SettingCard
          icon={User}
          title="Account Information"
          description="View and manage your account details"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Account Status
                </label>
                <Badge variant="green">Active</Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Member Since
                </label>
                <p className="text-sm text-dark-400">
                  {preferences?.created_at
                    ? new Date(preferences.created_at).toLocaleDateString()
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </div>
        </SettingCard>

        {/* Privacy & Security */}
        <SettingCard
          icon={Shield}
          title="Privacy & Security"
          description="Manage your data privacy and security settings"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Data Collection</h4>
                <p className="text-xs text-dark-400">
                  We collect anonymous usage data to improve our services
                </p>
              </div>
              <Badge variant="gray">Required</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Email Communications</h4>
                <p className="text-xs text-dark-400">
                  Receive important updates and portfolio reports
                </p>
              </div>
              <Badge variant="green">Enabled</Badge>
            </div>
          </div>
        </SettingCard>

        {/* Notifications */}
        <SettingCard
          icon={Bell}
          title="Notifications"
          description="Configure when and how you receive notifications"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Daily Brief Emails</h4>
                <p className="text-xs text-dark-400">
                  Automated portfolio reports sent to your email
                </p>
              </div>
              <Badge variant="green">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-dark-750">
              <div>
                <h4 className="text-sm font-medium text-gray-100">Market Alerts</h4>
                <p className="text-xs text-dark-400">
                  Notifications for significant market movements
                </p>
              </div>
              <Badge variant="gray">Coming Soon</Badge>
            </div>
          </div>
        </SettingCard>
      </div>
    </div>
  );
}