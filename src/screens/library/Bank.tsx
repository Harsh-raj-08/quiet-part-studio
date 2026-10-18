import type { CSSProperties } from 'react';
import { useApp } from '../../app/context';
import { ALL_STATUS, EVIDENCE, type Idea } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { stampStyle } from '../../design/primitives';

export interface BankF { ev: string; st: string; fmt: string; min?: string; sort?: string }
const COLS = '40px 72px minmax(160px,1fr) 112px 96px 48px';
const sel: CSSProperties = { height: 32, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 12.5px/1 ${SANS}`, color: 'var(--ink)', cursor: 'pointer' };
const fmtKind = (f: string) => f.trim().split(/[\s·,(—-]+/)[0] ?? '';

export const bankCount = (f: BankF): number => (f.min && f.min !== 'all' ? 1 : 0) + (f.sort && f.sort !== 'score' ? 1 : 0);
/** Minimum score and sort order, in the popover of the active "Idea bank" tab. */
export function BankMenu({ f, setF }: { f: BankF; setF: (f: BankF) => void }) {
  const wide = { ...sel, width: '100%' };
  return (
    <div role="group" aria-label="Score and order" style={{ display: 'grid', gap: 10 }}>
      <select id="bank-min" aria-label="Minimum score" value={f.min ?? 'all'} onChange={(e) => setF({ ...f, min: e.target.value })} style={wide}>
        <option value="all">Any score</option>{[14, 16, 18].map((n) => <option key={n} value={String(n)}>{n}+</option>)}
      </select>
      <select id="bank-sort" aria-label="Sort" value={f.sort ?? 'score'} onChange={(e) => setF({ ...f, sort: e.target.value })} style={wide}>
        <option value="score">Sort by score</option><option value="rank">Sort by rank</option><option value="code">Sort by code</option>
      </select>
    </div>
  );
}

/** Evidence, stage and format selects, sitting in the sub-tab row (left of the book chips). */
export function BankFilters({ ideas, f, setF }: { ideas: Idea[]; f: BankF; setF: (f: BankF) => void }) {
  const fmts = Array.from(new Set(ideas.map((i) => fmtKind(i.format)).filter(Boolean))).sort();
  const sts = ALL_STATUS.filter((s) => ideas.some((i) => i.status === s));
  return (
    <div role="group" aria-label="Filter the idea bank" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginRight: 10 }}>
      <select id="bank-ev" aria-label="Evidence" value={f.ev} onChange={(e) => setF({ ...f, ev: e.target.value })} style={sel}>
        <option value="all">Any evidence</option>{EVIDENCE.map((e) => <option key={e} value={e}>{e[0] + e.slice(1).toLowerCase()}</option>)}
      </select>
      <select id="bank-st" aria-label="Stage" value={f.st} onChange={(e) => setF({ ...f, st: e.target.value })} style={sel}>
        <option value="all">Any stage</option>{sts.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {fmts.length > 0 && <select id="bank-fmt" aria-label="Format" value={f.fmt} onChange={(e) => setF({ ...f, fmt: e.target.value })} style={sel}>
        <option value="all">Any format</option>{fmts.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>}
    </div>
  );
}

/** The design's idea bank table: rank (by score), code, hook (+ format), tilted evidence stamp, stage, score. */
export function Bank({ ideas, f }: { ideas: Idea[]; f: BankF }) {
  const { go, select } = useApp();
  const min = f.min && f.min !== 'all' ? +f.min : 0;
  const by = f.sort ?? 'score';
  const rows = ideas.filter((i) => (f.ev === 'all' || i.evidence === f.ev) && (f.st === 'all' || i.status === f.st) && (f.fmt === 'all' || fmtKind(i.format) === f.fmt) && i.total >= min)
    .slice().sort((a, b) => by === 'rank' ? (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.code.localeCompare(b.code) : by === 'code' ? a.code.localeCompare(b.code, undefined, { numeric: true }) : b.total - a.total || (a.rank ?? 1e9) - (b.rank ?? 1e9));
  const filtered = f.ev !== 'all' || f.st !== 'all' || f.fmt !== 'all' || min > 0;
  return (
    <div id="bank" style={{ display: 'grid', borderTop: '1px solid var(--line2)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, padding: '14px 8px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', borderBottom: '1px solid var(--line)' }}>
        <span>Rank</span><span>Code</span><span>Hook</span><span>Evidence</span><span>Stage</span><span style={{ textAlign: 'right' }}>Score</span>
      </div>
      {rows.map((r, i) => (
        <button key={r.id} type="button" data-bank-row={r.code} onClick={() => { go('ideas'); select(r.id); }} className="qp-hv-ghost"
          style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center', padding: '18px 8px', border: 0, borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
          <span style={{ font: `300 22px/1 ${SERIF}`, color: 'var(--faint)' }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{r.code}</span>
          <span style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <span style={{ font: `400 17px/1.4 ${SERIF}`, textWrap: 'pretty' }}>{r.hook || 'No hook written yet'}</span>
            {r.format && <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>{r.format}</span>}
          </span>
          <span>{r.evidence && <span style={{ ...stampStyle(r.evidence, i, false), transform: `rotate(${i % 2 ? '-2deg' : '2deg'})` }}>{r.evidence}</span>}</span>
          <span style={{ font: `italic 400 16px/1.3 ${SERIF}`, color: 'var(--dim)' }}>{r.status}</span>
          <span style={{ textAlign: 'right', font: `400 20px/1 ${SERIF}` }}>{r.total}</span>
        </button>
      ))}
      {!rows.length && <p id="bank-empty" style={{ margin: 0, padding: '32px 8px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>{filtered ? 'No idea from this book matches these filters.' : 'No ideas from this book yet.'}</p>}
    </div>
  );
}
