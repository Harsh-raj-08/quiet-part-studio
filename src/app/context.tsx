import { createContext, useContext } from 'react';
import type { TabId } from '../lib/headlines';

export type Theme = 'night' | 'paper';
export type SearchWhere = 'cmd' | 'util';

export interface AppState {
  tab: TabId;
  sub: string;
  go: (tab: TabId, sub?: string) => void;
  /** Idea shown in the drawer (document id). */
  selected: string | null;
  select: (id: string | null) => void;
  /** Pack opened from "Open pack vN" (document id). The Studio screen arrives in a later build. */
  openPack: string | null;
  openPackId: (id: string | null) => void;
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
