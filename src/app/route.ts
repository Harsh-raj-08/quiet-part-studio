import { useCallback, useEffect, useState } from 'react';
import type { TabId } from '../lib/headlines';

export const TABS: readonly TabId[] = ['discover', 'library', 'ideas', 'studio', 'insights', 'system'];
export const SUBS: Partial<Record<TabId, readonly string[]>> = {
  discover: ['ask', 'reports', 'trends'],
  library: ['shelf', 'notes', 'bank'],
  studio: ['script', 'frames', 'qa', 'posts'],
  insights: ['log', 'review', 'works', 'taste'],
  system: ['runs', 'jobs', 'settings'],
};
export const TAB_NAMES: Record<TabId, string> = { discover: 'Discover', library: 'Library', ideas: 'Ideas', studio: 'Studio', insights: 'Insights', system: 'System' };
export const NAV: { tab: Exclude<TabId, 'system'>; num: string; name: string }[] = [
  { tab: 'discover', num: '01', name: 'Discover' },
  { tab: 'library', num: '02', name: 'Library' },
  { tab: 'ideas', num: '03', name: 'Ideas' },
  { tab: 'studio', num: '04', name: 'Studio' },
  { tab: 'insights', num: '05', name: 'Insights' },
];

/** id: the open pack (Studio) or the current book (Library), when there is one. */
export interface Route { tab: TabId; sub: string; id: string }
const OLD: Record<string, TabId> = { board: 'ideas', books: 'library', packs: 'studio', runs: 'system' };

/** "#studio/script" -> { tab: 'studio', sub: 'script' }. Unknown or empty -> Ideas (the design's default screen). */
export function parseHash(hash: string): Route {
  const [a, b, c] = hash.replace(/^#/, '').split('/');
  const tab = (OLD[a ?? ''] ?? (a as TabId)) as TabId;
  if (!TABS.includes(tab)) return { tab: 'ideas', sub: '', id: '' };
  const subs = SUBS[tab];
  const sub = subs ? (subs.includes(b ?? '') ? (b as string) : subs[0]!) : '';
  let id = '';
  try { id = decodeURIComponent(c ?? '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120); } catch { id = ''; }
  return { tab, sub, id: subs ? id : '' };
}
export function formatHash(r: Route): string {
  if (r.id) return `#${r.tab}/${r.sub || SUBS[r.tab]?.[0] || ''}/${encodeURIComponent(r.id)}`;
  const sub = r.sub && (r.sub !== SUBS[r.tab]?.[0] || r.tab === 'studio') ? `/${r.sub}` : '';
  return `#${r.tab}${sub}`;
}

export function useRoute(): [Route, (tab: TabId, sub?: string, id?: string) => void] {
  const [r, setR] = useState<Route>(() => parseHash(typeof location === 'undefined' ? '' : location.hash));
  useEffect(() => {
    const on = () => setR(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((tab: TabId, sub?: string, id?: string) => {
    const next = parseHash(`#${tab}/${sub ?? ''}/${id ? encodeURIComponent(id) : ''}`);
    const h = formatHash(next);
    if (location.hash !== h) location.hash = h; else setR(next);
    try { window.scrollTo(0, 0); } catch { /* jsdom-less envs */ }
  }, []);
  return [r, go];
}
