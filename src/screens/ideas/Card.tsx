import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../app/context';
import type { Idea, Status } from '../../data/types';
import { ALL_STATUS } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Pill, Stamp } from '../../design/primitives';
import { compactViews, fmtDay, shortBookTitle } from '../../lib/format';
import { MovePrompt, UploadButton } from './Controls';
import { useOps } from './ops';

/** Writer-running line: a 2px track with a 40% lilac bar. */
export function LiveLine() {
  return (
    <div style={{ position: 'relative', height: 2, background: 'var(--line2)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: '40%', background: 'var(--lilac)', boxShadow: '0 0 12px var(--lilac)', animation: 'qpRun 1.8s cubic-bezier(.4,0,.2,1) infinite' }} />
    </div>
  );
}

export interface CardProps {
  idea: Idea;
  k: number;
  dragging: boolean;
  onDragStart: (code: string, height: number) => void;
  onDragEnd: () => void;
}

export function Card({ idea, k, dragging, onDragStart, onDragEnd }: CardProps) {
  const ops = useOps();
  const { selected, select } = useApp();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const sel = selected === idea.id;
  const book = ops.bookById.get(idea.bookId);
  const metric = ops.metricByCode.get(idea.code);
  const views = metric?.latest?.views ?? null;
  const pack = ops.curPack(idea);
  const writing = idea.status === 'Approved' && !!ops.writerJob(idea.code);
  const qaRunning = !!ops.qaJob(idea.code);
  const pend = ops.pending && ops.pending.id === idea.id ? ops.pending : null;
  const showCardPrompt = !!pend && pend.origin !== 'dnd';
  const dimmed = dragging || (!!pend && pend.origin === 'dnd');

  const cardStyle: CSSProperties = {
    position: 'relative', minWidth: 0, cursor: 'pointer', padding: '20px 20px 18px', borderRadius: 14, background: 'var(--sf)',
    border: `1px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, boxShadow: sel ? '0 18px 50px -24px var(--shadow)' : 'none', transition: 'border-color .2s, box-shadow .2s',
    opacity: dimmed ? 0.35 : idea.status === 'Dropped' ? 0.62 : 1,
  };

  // ---- actions per stage (the design's set)
  const A: { key: string; node: React.ReactNode }[] = [];
  let note = ''; let tone = 'var(--dim)';
  const btn = (key: string, label: string, kind: 'primary' | 'soft' | 'quiet', on: () => void, extra?: { disabled?: boolean; title?: string }) =>
    A.push({ key, node: <Pill key={key} kind={kind} data-action={key} disabled={extra?.disabled} title={extra?.title} onClick={on}>{label}</Pill> });
  switch (idea.status) {
    case 'Idea':
      btn('approve', 'Approve', 'primary', () => ops.requestMove(idea, 'Approved', 'card'));
      btn('drop', 'Drop', 'quiet', () => ops.requestMove(idea, 'Dropped', 'card'));
      break;
    case 'Approved':
      if (!writing) btn('write-pack', 'Write pack', 'primary', () => void ops.writePack(idea), { disabled: ops.busy.has(`writer:${idea.code}`) });
      break;
    case 'Scripted':
      btn('open-pack', pack ? `Open pack v${pack.version}` : 'Open pack', 'primary', () => ops.openPackFor(idea), { disabled: !pack, title: pack ? undefined : 'No pack found for this idea' });
      A.push({ key: 'upload-voice', node: <UploadButton key="upload-voice" idea={idea} kind="voice" label={idea.voiceAssetId ? 'Voice ✓' : 'Upload voice'} /> });
      btn('mark-voiced', 'Mark voiced', 'quiet', () => ops.requestMove(idea, 'Voiced', 'card'));
      break;
    case 'Voiced':
      A.push({ key: 'upload-video', node: <UploadButton key="upload-video" idea={idea} kind="video" label={idea.videoAssetId ? 'Video ✓' : 'Upload video'} /> });
      btn('mark-produced', 'Mark produced', 'quiet', () => ops.requestMove(idea, 'Produced', 'card'));
      break;
    case 'Produced': {
      const q = idea.qaLast?.verdict;
      if (qaRunning) note = 'QA running…';
      else btn('run-qa', 'Run QA', 'primary', () => void ops.runQa(idea), { disabled: ops.busy.has(`qa:${idea.code}`) });
      btn('mark-qa-passed', 'Mark QA passed', 'quiet', () => ops.requestMove(idea, 'QA passed', 'card'));
      if (q && !qaRunning) { note = q === 'GO' ? 'Last QA said GO.' : `Last QA said ${q}. You can still mark it passed.`; tone = q === 'GO' ? 'var(--grow)' : 'var(--caution)'; }
      break;
    }
    case 'QA passed':
      btn('mark-posted', 'Mark posted', 'primary', () => ops.requestMove(idea, 'Posted', 'card'));
      btn('open-pack', 'Open pack', 'quiet', () => ops.openPackFor(idea));
      break;
    case 'Dropped':
      note = `Dropped${idea.dropReason ? `: ${idea.dropReason}` : ''}`;
      btn('restore', 'Restore', 'quiet', () => ops.requestMove(idea, 'Idea', 'card'));
      break;
    default: break;
  }
  const hasActions = A.length > 0 || !!note;

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(idea.id); }
    else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setMenu(true); }
  };

  const onDrag = (e: DragEvent<HTMLElement>) => {
    try { e.dataTransfer.setData('text/plain', idea.code); e.dataTransfer.effectAllowed = 'move'; } catch { /* some browsers throw on setData */ }
    const hgt = e.currentTarget ? e.currentTarget.offsetHeight : 170;
    setTimeout(() => onDragStart(idea.code, hgt), 0);
  };

  return (
    <article ref={ref} id={`card-${idea.id}`} data-card={idea.code} data-stage={idea.status} data-dragging={dragging ? 'true' : undefined} tabIndex={0} aria-label={`${idea.code}. ${idea.hook}`} aria-keyshortcuts="m"
      draggable onDragStart={onDrag} onDragEnd={onDragEnd} onClick={() => select(idea.id)} onKeyDown={onKey} className="qp-hv-line-faint" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{idea.code}</span>
        <span data-score style={{ font: `400 20px/1 ${SERIF}`, fontVariantNumeric: 'tabular-nums' }}>{idea.total}<span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--faint)', marginLeft: 2 }}>/20</span></span>
      </div>
      <p style={{ margin: '0 0 18px', font: `400 18.5px/1.36 ${SERIF}`, letterSpacing: '-.005em', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.hook || 'No hook written yet'}</p>
      {writing && (
        <div role="status" data-writer-running style={{ display: 'grid', gap: 8, margin: '-4px 0 18px' }}>
          <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>Writer · drafting pack</span>
          <LiveLine />
        </div>
      )}
      {idea.status === 'Posted' && (
        <div data-posted style={{ display: 'flex', gap: 16, margin: '-4px 0 18px', font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>
          {idea.posted?.date && <span>{fmtDay(idea.posted.date)}</span>}
          {views != null && (<><span style={{ color: 'var(--ink)' }}>{compactViews(views)}</span><span>views</span></>)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `400 10px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>¹ From · {book ? shortBookTitle(book.title) : idea.fromBook || '–'}</span>
        <Stamp ev={idea.evidence} index={k} />
      </div>
      {showCardPrompt && pend && <MovePrompt pending={pend} variant="card" />}
      {!showCardPrompt && hasActions && (
        <div data-actions onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 }}>
          {A.map((a) => a.node)}
          {note && <span data-note style={{ flexBasis: '100%', marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: tone }}>{note}</span>}
        </div>
      )}
      {menu && <MoveMenu idea={idea} anchor={ref} onClose={(to) => { setMenu(false); if (to) ops.requestMove(idea, to, 'menu'); else ref.current?.focus(); }} />}
    </article>
  );
}

/** Keyboard alternative to dragging: focus a card, press "m". */
function MoveMenu({ idea, anchor, onClose }: { idea: Idea; anchor: React.RefObject<HTMLElement | null>; onClose: (to?: Status) => void }) {
  const stages = ALL_STATUS.filter((s) => s !== idea.status);
  const [i, setI] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const h = 56 + stages.length * 34;
    setPos({ left: Math.max(12, Math.min(r.left + 20, window.innerWidth - 236)), top: Math.max(12, Math.min(r.top + 44, window.innerHeight - h - 12)) });
  }, [anchor, stages.length]);
  useEffect(() => { items.current[i]?.focus(); }, [i, pos]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => (x + 1) % stages.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => (x - 1 + stages.length) % stages.length); }
    else if (e.key === 'Home') { e.preventDefault(); setI(0); }
    else if (e.key === 'End') { e.preventDefault(); setI(stages.length - 1); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onClose(); }
    e.stopPropagation();
  };
  if (!pos) return null;
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
      <div role="menu" aria-label={`Move ${idea.code} to…`} data-move-menu onKeyDown={onKey}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: 224, zIndex: 50, background: 'var(--sf)', border: '1px solid var(--line2)', borderRadius: 14, boxShadow: '0 24px 60px -20px var(--shadow)', padding: '10px 6px 6px' }}>
        <div style={{ padding: '2px 12px 10px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Move to…</div>
        {stages.map((s, n) => (
          <button key={s} ref={(el) => { items.current[n] = el; }} type="button" role="menuitem" data-move-to={s} tabIndex={n === i ? 0 : -1} onClick={() => onClose(s)} onMouseEnter={() => setI(n)} className="qp-hv-ghost"
            style={{ display: 'flex', width: '100%', alignItems: 'center', height: 32, padding: '0 12px', border: 0, borderRadius: 8, background: n === i ? 'var(--ghost)' : 'transparent', cursor: 'pointer', textAlign: 'left', font: `400 13px/1 ${SANS}`, color: s === 'Dropped' ? 'var(--dim)' : 'var(--ink)' }}>{s}</button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
