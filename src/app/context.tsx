import { createContext, useContext } from 'react';
import type { TabId } from '../lib/headlines';

export type Theme = 'night' | 'paper';
export type SearchWhere = 'cmd' | 'util';

export interface AppState {
  tab: TabId;
  sub: string;
  /** Open pack (Studio) or current book (Library), from the hash. */
  id: string;
  go: (tab: TabId, sub?: string, id?: string) => void;
  /** Idea shown in the drawer (document id). */
  selected: string | null;
  select: (id: string | null) => void;
  /** Pack open in Studio (document id), or null for the pack grid. */
  openPack: string | null;
  /** Open a pack in Studio (optionally on a sub-tab). null returns to the grid. */
  openPackId: (id: string | null, sub?: string) => void;
  /** true = sidebar hidden, command bar showing. */
  collapsed: boolean;
  toggleSide: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  searchOpen: SearchWhere | null;
  setSearchOpen: (w: SearchWhere | null) => void;
  running: number;
  mode: 'supabase' | 'mock' | 'demo';
}

export const AppCtx = createContext<AppState | null>(null);
export function useApp(): AppState {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppCtx missing');
  return c;
}
