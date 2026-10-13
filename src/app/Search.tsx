import { createContext, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBooks, useIdeas, useNotes, usePacks, useReports } from '../data/hooks';
import { MONO, SANS, SERIF } from '../design/fonts';
import { searchAll, markParts, type Group, type Hit } from '../lib/search';
import { useApp, type SearchWhere } from './context';

interface SearchApi {
  query: string;
  setQuery: (q: string) => void;
  groups: Group[];
  ws: string[];
  flat: Hit[];
  active: number;
  setActive: (n: number) => void;
  pick: (h: Hit) => void;
  close: (clear?: boolean) => void;
  anchors: React.MutableRefObject<Partial<Record<SearchWhere, HTMLElement | null>>>;
  inputs: React.MutableRefObject<Partial<Record<SearchWhere, HTMLInputElement | null>>>;
}
const Ctx = createContext<SearchApi | null>(null);
const useSearch = () => { const c = useContext(Ctx); if (!c) throw new Error('SearchProvider missing'); return c; };

export function SearchProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const books = useBooks(); const ideas = useIdeas(); const packs = usePacks(); const notes = useNotes(); const reports = useReports();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const anchors = useRef<Partial<Record<SearchWhere, HTMLElement | null>>>({});
  const inputs = useRef<Partial<Record<SearchWhere, HTMLInputElement | null>>>({});
  const res = useMemo(() => searchAll(query, { books, ideas, packs, notes, reports }), [query, books, ideas, packs, notes, reports]);
  const flat = useMemo(() => res.groups.flatMap((g) => g.items), [res]);
  useEffect(() => setActive(-1), [query]);

  const { setSearchOpen, go, select, openPackId } = app;
  const close = useCallback((clear = false) => { if (clear) setQuery(''); setSearchOpen(null); }, [setSearchOpen]);
  const pick = useCallback((h: Hit) => {
    close(true);
    const t = h.target;
    if (t.type === 'idea') { go('ideas'); select(t.id); }
    else if (t.type === 'book') go('library', 'shelf');
    else if (t.type === 'pack') { go('studio', 'script'); openPackId(t.id); }
    else if (t.type === 'note') go('library', 'notes');
    else go('discover', 'reports');
  }, [close, go, select, openPackId]);

  // ⌘K / Ctrl+K and "/" open the search that is visible (command bar when the sidebar is hidden).
  const { collapsed, searchOpen } = app;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey) || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        const w: SearchWhere = collapsed ? 'cmd' : 'util';
        setSearchOpen(w);
        const inp = inputs.current[w];
        if (inp) { inp.focus(); inp.select(); }
      }
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [collapsed, setSearchOpen]);

  // Outside click closes the panel.
  useEffect(() => {
    if (!searchOpen) return;
    const on = (e: PointerEvent) => {
      const a = anchors.current[searchOpen];
      const p = document.getElementById('gs-pop');
      const n = e.target as Node;
      if ((a && a.contains(n)) || (p && p.contains(n))) return;
      setSearchOpen(null);
    };
    document.addEventListener('pointerdown', on);
    return () => document.removeEventListener('pointerdown', on);
  }, [searchOpen, setSearchOpen]);

  const value = useMemo<SearchApi>(() => ({ query, setQuery, groups: res.groups, ws: res.ws, flat, active, setActive, pick, close, anchors, inputs }), [query, res, flat, active, pick, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const kbd: React.CSSProperties = { font: `400 11px/1 ${MONO}`, color: 'var(--dim)', border: '1px solid var(--line2)', borderRadius: 999, padding: '7px 10px' };

function useKeys(where: SearchWhere) {
  const s = useSearch();
  const { setSearchOpen } = useApp();
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = s.flat.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) s.setActive((s.active + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) s.setActive((s.active - 1 + n) % n); }
    else if (e.key === 'Enter') { const it = s.flat[s.active >= 0 ? s.active : 0]; if (it) { e.preventDefault(); s.pick(it); } }
    else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      const had = s.query || s.groups.length;
      s.close(true);
      if (!had) e.currentTarget.blur();
      void where; void setSearchOpen;
    }
  };
}

/** The 560 command-bar pill. The input is always there, so the idle state is the design's pill. */
export function CommandSearch() {
  const s = useSearch();
  const { searchOpen, setSearchOpen } = useApp();
  const onKey = useKeys('cmd');
  const open = searchOpen === 'cmd' && s.query.trim().length > 0;
  return (
    <div ref={(el) => { s.anchors.current.cmd = el; }} role="search" className="qp-hv-line-faint qp-search" onClick={() => s.inputs.current.cmd?.focus()}
      style={{ justifySelf: 'center', width: '100%', maxWidth: 560, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, height: 46, padding: '0 8px 0 18px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', cursor: 'text', font: `400 14px/1 ${SANS}`, color: 'var(--faint)', textAlign: 'left' }}>
      <input ref={(el) => { s.inputs.current.cmd = el; }} id="global-search" type="text" role="combobox" aria-expanded={open} aria-controls="gs-pop" aria-autocomplete="list" aria-label="Search the studio"
        aria-activedescendant={open && s.active >= 0 ? `gs-opt-${s.active}` : undefined}
        autoComplete="off" spellCheck={false} placeholder="Jump to an idea, book, pack or run" value={s.query}
        onChange={(e) => { s.setQuery(e.target.value); setSearchOpen('cmd'); }} onFocus={() => setSearchOpen('cmd')} onKeyDown={onKey}
        className="qp-search-input" style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', padding: 0, font: `400 14px/1 ${SANS}`, color: 'var(--ink)' }} />
      <span style={kbd}>⌘K</span>
    </div>
  );
}

/** The small "Search ⌘K" button in the sidebar layout's utility row. */
export function UtilSearch() {
  const s = useSearch();
  const { searchOpen, setSearchOpen } = useApp();
  const onKey = useKeys('util');
  const isOpen = searchOpen === 'util';
  const open = isOpen && s.query.trim().length > 0;
  if (!isOpen) {
    return (
      <button ref={(el) => { s.anchors.current.util = el; }} type="button" onClick={() => setSearchOpen('util')} className="qp-hv-line-faint"
        style={{ display: 'flex', alignItems: 'center', gap: 28, height: 36, padding: '0 6px 0 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'text', font: `400 13px/1 ${SANS}`, letterSpacing: 0, textTransform: 'none', color: 'var(--faint)' }}>
        Search<span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--dim)', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 8px' }}>⌘K</span>
      </button>
    );
  }
  return (
    <div ref={(el) => { s.anchors.current.util = el; }} role="search" style={{ display: 'flex', alignItems: 'center', gap: 12, height: 36, width: 300, padding: '0 6px 0 14px', borderRadius: 999, border: '1px solid var(--faint)', background: 'transparent', font: `400 13px/1 ${SANS}`, letterSpacing: 0, textTransform: 'none' }}>
      <input ref={(el) => { s.inputs.current.util = el; }} id="global-search-util" autoFocus type="text" role="combobox" aria-expanded={open} aria-controls="gs-pop" aria-autocomplete="list" aria-label="Search the studio"
        aria-activedescendant={open && s.active >= 0 ? `gs-opt-${s.active}` : undefined}
        autoComplete="off" spellCheck={false} placeholder="Search" value={s.query} onChange={(e) => s.setQuery(e.target.value)} onKeyDown={onKey}
        onBlur={() => { if (!s.query.trim()) setSearchOpen(null); }}
        className="qp-search-input" style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', padding: 0, font: `400 13px/1 ${SANS}`, color: 'var(--ink)' }} />
      <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--dim)', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 8px' }}>⌘K</span>
    </div>
  );
}

/** Results panel: same width as the pill (560), sf, line2, r16, shadow. Portalled so the header's overflow can't clip it. */
export function SearchPanel() {
  const s = useSearch();
  const { searchOpen } = useApp();
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const show = !!searchOpen && s.ws.length > 0;

  useLayoutEffect(() => {
    if (!show || !searchOpen) { setBox(null); return; }
    const place = () => {
      const a = s.anchors.current[searchOpen];
      if (!a) return;
      const r = a.getBoundingClientRect();
      const width = Math.min(560, window.innerWidth - 32);
      const left = searchOpen === 'cmd' ? r.left + r.width / 2 - width / 2 : Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
      setBox({ top: r.bottom + 8, left: Math.max(16, left), width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [show, searchOpen, s.anchors, s.query]);

  useEffect(() => {
    if (s.active < 0) return;
    document.getElementById(`gs-opt-${s.active}`)?.scrollIntoView({ block: 'nearest' });
  }, [s.active]);

  if (!show || !box) return null;
  let k = 0;
  return createPortal(
    <div id="gs-pop" role="listbox" aria-label="Search results" onMouseDown={(e) => e.preventDefault()}
      style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, maxHeight: 'min(70vh, 560px)', overflowY: 'auto', zIndex: 45, background: 'var(--sf)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 24px 60px -20px var(--shadow)', padding: '8px 0' }}>
      {s.groups.length === 0 && (
        <div id="gs-empty" style={{ padding: '18px 22px', font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Nothing matches “{s.query.trim()}”</div>
      )}
      {s.groups.map((g) => (
        <Fragment key={g.name}>
          <div id={`gs-g-${g.name.toLowerCase()}`} style={{ padding: '14px 22px 8px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>{g.name}</div>
          {g.items.map((it) => {
            const idx = k++;
            const on = idx === s.active;
            return (
              <div key={`${g.name}-${idx}`} id={`gs-opt-${idx}`} role="option" aria-selected={on} data-g={g.name} onClick={() => s.pick(it)} onMouseMove={() => { if (s.active !== idx) s.setActive(idx); }}
                style={{ padding: '10px 22px', cursor: 'pointer', display: 'grid', gap: 5, background: on ? 'var(--ghost)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                  {it.c && <span style={{ flex: 'none', font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{it.c}</span>}
                  <span style={{ font: `400 17px/1.35 ${SERIF}`, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Marked text={it.t} ws={s.ws} /></span>
                </div>
                {it.s && <div style={{ font: `400 13px/1.45 ${SANS}`, color: 'var(--dim)' }}><Marked text={it.s} ws={s.ws} /></div>}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}

function Marked({ text, ws }: { text: string; ws: string[] }) {
  return <>{markParts(text, ws).map((p, i) => (p.hit ? <mark key={i} className="qp-mark">{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}</>;
}
