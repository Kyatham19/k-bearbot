'use client';

import { useEffect, useState } from 'react';

export type Prefs = {
  show_charts: boolean;
  show_news_cards: boolean;
  language_mode: 'auto' | 'english' | 'tanglish';
  notif_in_app: boolean;
};

const DEFAULTS: Prefs = {
  show_charts: true,
  show_news_cards: true,
  language_mode: 'auto',
  notif_in_app: true,
};

let cache: Prefs | null = null;
let inflight: Promise<Prefs> | null = null;

async function loadPrefs(): Promise<Prefs> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/api/user/preferences')
    .then((r) => (r.ok ? r.json() : { preferences: DEFAULTS }))
    .then((d) => {
      const p = (d.preferences ?? DEFAULTS) as Partial<Prefs>;
      cache = { ...DEFAULTS, ...p };
      return cache;
    })
    .catch(() => {
      cache = DEFAULTS;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidatePrefs() {
  cache = null;
}

export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(cache ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    loadPrefs().then((p) => {
      if (alive) setPrefs(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return prefs;
}
