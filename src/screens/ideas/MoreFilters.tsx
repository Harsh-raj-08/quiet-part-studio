import { useEffect, useRef, useState } from 'react';
import type { Book, Idea } from '../../data/types';
import { MONO, SANS } from '../../design/fonts';
import { lsGet, lsSet } from '../../lib/storage';

export interface Extra { lane: string; fmt: string; hs: string; min: string; q: string }
export const NO_EXTRA: Extra = { lane: 'all', fmt: 'all', hs: 'all', min: 'all', q: '' };
export const HOOK_STYLES = ['myth-bust', 'question', 'number', 'contrarian', 'story', 'direct-you'];
const KEY = 'qps.ideasMore';

/** The format kind used for filtering: "Reel + carousel" -> "Reel". */
export const fmtKind = (f: string): string => f.trim().split(/[\s·,(—+-]+/)[0] ?? '';

export function loadExtra(): Extra {
  try {
    const x = JSON.parse(lsGet(KEY) || 'null') as Partial<Record<keyof Extra, unknown>> | null;
    if (x && typeof x === 'object') {
      const pick = (k: keyof Extra): string => (typeof x[k] === 'string' ? (x[k] as string) : NO_EXTRA[k]);
      return { lane: pick('lane'), fmt: pick('fmt'), hs: pick('hs'), min: pick('min'), q: pick('q') };
    }
  } catch { /* ignore */ }
  return NO_EXTRA;
}
export const saveExtra = (e: Extra) => lsSet(KEY, JSON.stringify(e));
export const extraCount = (e: Extra): number => (e.lane !== 'all' ? 1 : 0) + (e.fmt !== 'all' ? 1 : 0) + (e.hs !== 'all' ? 1 : 0) + (e.min !== 'all' ? 1 : 0) + (e.q.trim() ? 1 : 0);

export function applyExtra(list: Idea[], e: Extra, bookById: Map<string, Book>): Idea[] {
  if (!extraCount(e)) return list;
  const words = e.q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((i) => {
    if (e.lane !== 'all' && bookById.get(i.bookId)?.lane !== e.lane) return false;
    if (e.fmt !== 'all' && fmtKind(i.format) !== e.fmt) return false;
    if (e.hs !== 'all' && i.hookStyle !== e.hs) return false;
    if (e.min !== 'all' && i.total < +e.min) return false;
    if (words.length) { const hay = `${i.code} ${i.hook} ${i.quietPart}`.toLowerCase(); if (!words.every((w) => hay.includes(w))) return false; }
    return true;
  });
}

const sel = { height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg)', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', cursor: 'pointer', width: '100%' } as const;
const lab = { display: 'grid', gap: 6, font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' } as const;

/** "More filters": lane, format, hook style, min score and text, in a popover. */
export function MoreFilters({ ideas, books, value, onChange }: { ideas: Idea[]; books: Book[]; value: Extra; onChange: (e: Extra) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const n = extraCount(value);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const set = (p: Partial<Extra>) => { const next = { ...value, ...p }; onChange(next); saveExtra(next); };
  const lanes = Array.from(new Set(books.map((b) => b.lane).filter(Boolean)));
  const fmts = Array.from(new Set(ideas.map((i) => fmtKind(i.format)).filter(Boolean))).sort();
  return (
    <div ref={root} style={{ position: 'relative' }}>
      {/* Looks exactly like the toolbar's "Evidence" caption; it opens the extra filters. A count shows only when some are active. */}
      <button type="button" id="more-filters" aria-expanded={open} aria-controls="more-filters-pop" aria-haspopup="dialog" title="More filters" onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: n ? 'var(--ink)' : 'inherit' }}>Evidence{n ? ` · ${n}` : ''}</button>
      {open && (
        <div id="more-filters-pop" role="dialog" aria-label="More filters" style={{ position: 'absolute', right: 0, top: 30, zIndex: 30, width: 'min(300px, 86vw)', display: 'grid', gap: 14, padding: 18, borderRadius: 14, border: '1px solid var(--line2)', background: 'var(--sf)', boxShadow: '0 24px 60px -20px var(--shadow)' }}>
          <label style={lab}>Search<input id="mf-q" className="qp-field" type="search" placeholder="Code, hook or quiet part" value={value.q} onChange={(e) => set({ q: e.target.value })} style={{ height: 34, fontSize: 13 }} /></label>
          <label style={lab}>Lane<select id="mf-lane" value={value.lane} onChange={(e) => set({ lane: e.target.value })} style={sel}><option value="all">Any lane</option>{lanes.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <label style={lab}>Format<select id="mf-fmt" value={value.fmt} onChange={(e) => set({ fmt: e.target.value })} style={sel}><option value="all">Any format</option>{fmts.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <label style={lab}>Hook style<select id="mf-hs" value={value.hs} onChange={(e) => set({ hs: e.target.value })} style={sel}><option value="all">Any style</option>{HOOK_STYLES.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <label style={lab}>Minimum score<select id="mf-min" value={value.min} onChange={(e) => set({ min: e.target.value })} style={sel}><option value="all">Any score</option>{[14, 16, 18].map((l) => <option key={l} value={String(l)}>{l}+</option>)}</select></label>
          {n > 0 && <button type="button" id="mf-clear" onClick={() => set(NO_EXTRA)} style={{ justifySelf: 'start', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, color: 'var(--dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Clear</button>}
        </div>
      )}
    </div>
  );
}
