import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBooks, useIdeas, useJobs, useLoaded, useReports } from '../data/hooks';
import { useStore } from '../data/store';
import { SANS, EASE } from '../design/fonts';
import { ToastProvider } from '../design/primitives';
import { newCandidates } from '../lib/headlines';
import { lsGet, lsSet } from '../lib/storage';
import { IdeaDrawer } from '../screens/ideas/Drawer';
import { IdeaOps } from '../screens/ideas/ops';
import { IdeasScreen } from '../screens/ideas/IdeasScreen';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { StudioScreen } from '../screens/studio/StudioScreen';
import { InsightsScreen } from '../screens/insights/InsightsScreen';
import { SystemScreen } from '../screens/system/SystemScreen';
import { AppCtx, type AppState, type SearchWhere, type Theme } from './context';
import { useRoute } from './route';
import { SearchPanel, SearchProvider } from './Search';
import { CommandBar, Sidebar, UtilRow, type NavMeta } from './Shell';

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(() => {
    const b = document.body.getAttribute('data-theme');
    return b === 'paper' ? 'paper' : lsGet('qps.theme') === 'paper' ? 'paper' : 'night';
  });
  const setTheme = useCallback((t: Theme) => { set(t); document.body.setAttribute('data-theme', t); lsSet('qps.theme', t); }, []);
  useEffect(() => { document.body.setAttribute('data-theme', theme); }, [theme]);
  return [theme, setTheme];
}

/** Sidebar is the default. Hiding it shows the command bar; showing it again returns. Remembered. */
function useSide(): [boolean, () => void] {
  const [collapsed, set] = useState(() => lsGet('qps.sideHidden') === '1');
  const toggle = useCallback(() => set((c) => { lsSet('qps.sideHidden', c ? '0' : '1'); return !c; }), []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggle(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [toggle]);
  return [collapsed, toggle];
}

export function App() {
  const store = useStore();
  const [route, goRoute] = useRoute();
  const [theme, setTheme] = useTheme();
  const [collapsed, toggleSide] = useSide();
  const [selected, select] = useState<string | null>(null);
  const [openPack, openPackId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<SearchWhere | null>(null);
  const jobs = useJobs(); const ideas = useIdeas(); const books = useBooks(); const reports = useReports();
  const ideasLoaded = useLoaded('ideas'); const booksLoaded = useLoaded('books'); const reportsLoaded = useLoaded('reports');

  // Same behaviour as the design's goTab: leaving a screen clears the selection and the open pack.
  const go = useCallback((tab: AppState['tab'], sub?: string) => { select(null); openPackId(null); goRoute(tab, sub); }, [goRoute]);
  useEffect(() => { if (route.tab !== 'ideas') select(null); }, [route.tab]);
  useEffect(() => { setSearchOpen(null); }, [collapsed]);

  const running = useMemo(() => jobs.filter((j) => j.status === 'running').length, [jobs]);
  const meta: NavMeta = useMemo(() => ({
    discover: reportsLoaded ? `${newCandidates(reports, books)} new` : '–',
    library: booksLoaded ? String(books.length) : '–',
    ideas: ideasLoaded ? String(ideas.filter((i) => i.status !== 'Dropped').length) : '–',
    studio: ideasLoaded ? String(ideas.filter((i) => ['Scripted', 'Voiced', 'Produced', 'QA passed'].includes(i.status)).length) : '–',
    insights: '',
  }), [reports, books, ideas, reportsLoaded, booksLoaded, ideasLoaded]);

  const app: AppState = {
    tab: route.tab, sub: route.sub, go, selected, select, openPack, openPackId, collapsed, toggleSide, theme, setTheme, searchOpen, setSearchOpen, running, mode: store.adapter.mode,
  };

  const rootStyle = { background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: SANS, position: 'relative' as const, transition: 'background .3s, color .3s' };
  const shellStyle = { display: 'grid', gridTemplateColumns: `${collapsed ? 0 : 264}px minmax(0,1fr)`, transition: `grid-template-columns .5s ${EASE}`, minHeight: '100vh', position: 'relative' as const, zIndex: 1 };

  return (
    <AppCtx.Provider value={app}>
      <ToastProvider>
        <SearchProvider>
          <IdeaOps>
          <div style={rootStyle}>
            <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60, opacity: 0.5, mixBlendMode: 'soft-light', backgroundImage: GRAIN }} />
            <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 59, background: 'radial-gradient(ellipse 85% 70% at 50% 42%, transparent 55%, var(--vig) 100%)' }} />
            <div id="shell" style={shellStyle}>
              <Sidebar meta={meta} />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <CommandBar />
                <main id="main" style={{ padding: '0 48px 64px', minWidth: 0 }}>
                  <UtilRow />
                  {route.tab === 'ideas' && <IdeasScreen />}
                  {route.tab === 'discover' && <DiscoverScreen />}
                  {route.tab === 'library' && <LibraryScreen />}
                  {route.tab === 'studio' && <StudioScreen />}
                  {route.tab === 'insights' && <InsightsScreen />}
                  {route.tab === 'system' && <SystemScreen />}
                </main>
              </div>
            </div>
            {route.tab === 'ideas' && selected && <IdeaDrawer />}
            <SearchPanel />
          </div>
          </IdeaOps>
        </SearchProvider>
      </ToastProvider>
    </AppCtx.Provider>
  );
}
