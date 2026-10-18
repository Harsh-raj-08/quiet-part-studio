import { useEffect, useMemo, useRef, useState } from 'react';
import { useHeadline } from '../../app/useHeadline';
import { useLoaded } from '../../data/hooks';
import { EVIDENCE, STAGES, type Idea, type Status } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Chip, Eyebrow, Headline, MarginNote, Seg } from '../../design/primitives';
import { initials } from '../../lib/format';
import { lsGet, lsSet } from '../../lib/storage';
import { Board, type DndState } from './Board';
import { ListView } from './ListView';
import { applyExtra, extraCount, loadExtra, MoreFilters, type Extra } from './MoreFilters';
import { useOps } from './ops';

type View = 'board' | 'list';
const EV_OPTIONS = ['All', ...EVIDENCE];
const COL_W = 328;

export function IdeasScreen() {
  const ops = useOps();
  const hero = useHeadline('ideas');
  const loaded = useLoaded('ideas');
  const [book, setBook] = useState('all');
  const [ev, setEv] = useState('All');
  const [view, setViewState] = useState<View>(() => (lsGet('qps.ideasView') === 'list' ? 'list' : 'board'));
  const [dropped, setDropped] = useState(false);
  const [extra, setExtra] = useState<Extra>(loadExtra);
  const [dnd, setDnd] = useState<DndState>({ drag: null, dragH: 170, over: null });
  const boardRef = useRef<HTMLDivElement>(null);
  const setView = (v: View) => { setViewState(v); lsSet('qps.ideasView', v); };

  const { ideas, books } = ops;
  // A filter that no longer matches anything (the book was removed) falls back to All.
  useEffect(() => { if (book !== 'all' && books.length && !books.some((b) => b.id === book)) setBook('all'); }, [book, books]);

  const stages: Status[] = useMemo(() => (dropped ? [...STAGES, 'Dropped'] : [...STAGES]), [dropped]);
  const inScope = useMemo(() => ideas.filter((i) => dropped || i.status !== 'Dropped'), [ideas, dropped]);
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const visible: Idea[] = useMemo(() => applyExtra(inScope.filter((i) => (book === 'all' || i.bookId === book) && (ev === 'All' || i.evidence === ev)), extra, bookById), [inScope, book, ev, extra, bookById]);
  const filtered = book !== 'all' || ev !== 'All' || extraCount(extra) > 0;

  const chips = [{ k: 'all', label: 'All books', title: 'All books', n: inScope.length }].concat(books.map((b) => ({ k: b.id, label: b.code || initials(b.title) || b.title, title: b.title, n: inScope.filter((i) => i.bookId === b.id).length })).filter((c) => c.n > 0 || c.k === book));

  const goStage = (k: number) => {
    setView('board');
    setTimeout(() => boardRef.current?.scrollTo({ left: k * COL_W, behavior: 'smooth' }), 30);
  };

  return (
    <>
      <section style={{ padding: '56px 0 0', display: 'flex', flexWrap: 'wrap', gap: '16px 48px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <Eyebrow>{hero.eb}</Eyebrow>
          <Headline ghost={hero.g} lit={hero.l} maxCh={21} />
        </div>
        {hero.note && <MarginNote>{hero.note}</MarginNote>}
      </section>

      <div role="group" aria-label="Stages" data-strip style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))`, gap: 20, marginTop: 56 }}>
        {stages.map((s, k) => {
          const n = visible.filter((i) => i.status === s).length;
          return (
            <button key={s} type="button" data-strip-stage={s} onClick={() => goStage(k)} className="qp-hv-top-ink"
              style={{ display: 'grid', gap: 12, textAlign: 'left', background: 'none', border: 0, padding: '14px 0 0', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--line2)' }}>
              <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</span>
              <span data-strip-count style={{ font: `300 34px/1 ${SERIF}`, fontVariantNumeric: 'tabular-nums', color: n ? 'var(--ink)' : 'var(--faint)' }}>{loaded ? n : '–'}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px 24px', margin: '48px 0 28px' }}>
        <div role="group" aria-label="Filter by book" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c) => <Chip key={c.k} label={c.label} n={c.n} title={c.title} mono={c.k !== 'all'} on={book === c.k} onClick={() => setBook(c.k)} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {filtered && <span data-showing style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)', whiteSpace: 'nowrap' }}>Showing {visible.length} of {inScope.length}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            <MoreFilters ideas={ideas} books={books} value={extra} onChange={setExtra} />
            <select aria-label="Evidence" value={ev} onChange={(e) => setEv(e.target.value)} style={{ height: 34, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 13px/1 ${SANS}`, letterSpacing: 0, textTransform: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
              {EV_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button type="button" data-toggle-dropped aria-pressed={dropped} onClick={() => setDropped((d) => !d)}
            style={{ height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 13px/1 ${SANS}`, border: `1px ${dropped ? 'solid' : 'dashed'} var(--line2)`, background: 'transparent', color: dropped ? 'var(--ink)' : 'var(--dim)' }}>{dropped ? 'Hide dropped' : 'Show dropped'}</button>
          <Seg label="View" value={view} onChange={setView} options={[['board', 'Board'], ['list', 'List']]} />
        </div>
      </div>

      {!loaded ? (
        <div style={{ border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>Loading the board…</div>
      ) : view === 'board' ? (
        <Board ref={boardRef} visible={visible} stages={stages} dnd={dnd} setDnd={(f) => setDnd(f)} />
      ) : (
        <ListView rows={visible} />
      )}
    </>
  );
}
