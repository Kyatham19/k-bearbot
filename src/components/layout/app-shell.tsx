'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MarketStreamBar } from '@/components/market-stream/market-stream-bar';
import { AIProgressIndicator } from '@/components/ai/ai-progress-indicator';
import { useAppStore } from '@/stores/app-store';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  // Keep sidebar open on desktop, synced with viewport
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  // Show market stream only on portfolio, brief, and watchlist pages
  const showMarketStream = /\/(portfolio|daily-brief|watchlist)/.test(pathname);

  return (
    <div className="flex h-dvh w-full overflow-auto">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        {showMarketStream && <MarketStreamBar />}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      {/* AI Progress Indicator */}
      <AIProgressIndicator />
    </div>
  );
}
