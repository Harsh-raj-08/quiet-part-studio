import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { useNotes } from '../../data/hooks';
import { useStore } from '../../data/store';
import { isHttps, SCORE_KEYS, type Idea } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Stamp } from '../../design/primitives';
import { fmtDay, fmtRel, fmtSize, isToday, pgs } from '../../lib/format';
import { pagesOverlap } from '../../lib/pages';
import { nextStage, prevStage, stageIndex } from '../../lib/stages';
import { MovePrompt } from './Controls';
import { useOps } from './ops';

const LABEL: CSSProperties = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };

function Section({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return <div id={id} style={{ display: 'grid', gap: 8 }}><span style={LABEL}>{label}</span>{children}</div>;
}

function SafeLink({ url, text }: { url: string; text: string }) {
  return isHttps(url) ? <a href={url.trim()} target="_blank" rel="noopener noreferrer">{text || url}</a> : <span>{text || url}</span>;
}

function useSignedUrl(path: string): string {
  const store = useStore();
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    setUrl('');
    if (path) store.adapter.signedUrl(path).then((u) => { if (live) setUrl(u); }, () => { /* private file not reachable right now */ });
    return () => { live = false; };
  }, [store, path]);
  return url;
}

function Media({ idea }: { idea: Idea }) {
  const voice = useSignedUrl(idea.voiceAssetId);
  const video = useSignedUrl(idea.videoAssetId);
  const { go, openPackId } = useApp();
  const ops = useOps();
  const q = idea.qaLast;
  if (!idea.voiceAssetId && !idea.videoAssetId && !q) return null;
  const note: CSSProperties = { font: `400 13px/1.45 ${SANS}`, color: 'var(--dim)' };
  const qaColor = q?.verdict === 'GO' ? 'var(--grow)' : 'var(--caution)';
  return (
    <Section label="Files and QA" id="drawer-media">
      {idea.voiceAssetId && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={note}>Voiceover · {idea.voiceFileName || 'file'}</span>
          {voice && <audio controls preload="metadata" src={voice} aria-label="Voiceover" style={{ width: '100%' }} />}
        </div>
      )}
      {idea.videoAssetId && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={note}>Video · {idea.videoFileName || 'file'}{idea.videoSize > 0 ? ` · ${fmtSize(idea.videoSize)}` : ''}</span>
          {video && <video controls muted playsInline preload="metadata" src={video} aria-label="Finished video" style={{ width: '100%', maxHeight: 280, borderRadius: 10, background: 'var(--bg)' }} />}
        </div>
      )}
      {q && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" data-qa-chip title="Open the QA report" onClick={() => { const p = ops.curPack(idea); if (p) openPackId(p.id, 'qa'); else go('studio'); }}
            style={{ cursor: 'pointer', background: 'transparent', font: `500 9.5px/1 ${MONO}`, letterSpacing: '.16em', color: qaColor, border: `1.5px solid ${qaColor}`, padding: '5px 7px 4px', borderRadius: 3, transform: 'rotate(-2deg)', whiteSpace: 'nowrap' }}>QA · {q.verdict}</button>
          <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{fmtDay(q.at)}</span>
        </div>
      )}
    </Section>
  );
}

function Notes({ idea }: { idea: Idea }) {
  const all = useNotes();
  const hits = useMemo(() => {
    if (!idea.pages) return [];
    return all.filter((n) => n.bookId === idea.bookId && pagesOverlap(n.pages, idea.pages)).sort((a, b) => a.chapterNo - b.chapterNo).map((n) => {
      const P = idea.pages;
      const it: [string, string, string][] = [];
      n.keyIdeas.forEach((k) => { if (pagesOverlap(k.pages, P)) it.push(['Idea', k.idea + (k.mechanism ? ` — ${k.mechanism}` : ''), k.pages]); });
      n.stories.forEach((k) => { if (pagesOverlap(k.pages, P)) it.push(['Story', (k.who ? `${k.who}: ` : '') + k.what, k.pages]); });
      n.claims.forEach((k) => { if (pagesOverlap(k.pages, P)) it.push(['Check', k.claim, k.pages]); });
      n.lines.forEach((k) => { if (pagesOverlap(k.page, P)) it.push(['Line', `“${k.text}”`, k.page]); });
      return { n, items: it.slice(0, 5) };
    });
  }, [all, idea.bookId, idea.pages]);
  if (!hits.length) return null;
  return (
    <Section label="Book notes for these pages" id="drawer-notes">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
        {hits.map((x) => (
          <li key={x.n.id} style={{ display: 'grid', gap: 6 }}>
            <div style={{ font: `500 14px/1.4 ${SANS}` }}>Ch {x.n.chapterNo || '?'}{x.n.title ? ` · ${x.n.title}` : ''}{x.n.pages && <span style={{ fontWeight: 400, color: 'var(--dim)' }}> · {pgs(x.n.pages)}</span>}</div>
            {x.items.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, font: `400 14.5px/1.5 ${SANS}`, color: 'var(--dim)' }}>
                {x.items.map((t, k) => <li key={k}><span style={{ ...LABEL, marginRight: 8 }}>{t[0]}</span>{t[1]}{t[2] && <span style={{ color: 'var(--faint)' }}> · {pgs(t[2])}</span>}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Stats({ idea }: { idea: Idea }) {
  const ops = useOps();
  const { go } = useApp();
  const l = ops.metricByCode.get(idea.code)?.latest;
  const fm = (v: number | null | undefined, u = '') => (v == null ? '–' : `${v >= 1000 && !u ? v.toLocaleString('en-US') : Math.round(v * 10) / 10}${u}`);
  return (
    <Section label="Latest stats" id="drawer-stats">
      {l ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 }}>
          {([['Views', fm(l.views)], ['Avg watch', fm(l.avgWatchSec, 's')], ['Saves', fm(l.saves)], ['Shares', fm(l.shares)], ['Follows', fm(l.follows)]] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gap: 8 }}>
              <span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{k}</span>
              <span style={{ font: `300 22px/1 ${SERIF}` }}>{v}</span>
            </div>
          ))}
        </div>
      ) : <p id="drawer-nostats" style={{ margin: 0, font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--faint)' }}>No stats logged yet.</p>}
      <div><button type="button" onClick={() => go('insights', 'log')} style={{ height: 28, padding: '0 12px', borderRadius: 999, cursor: 'pointer', font: `400 12px/1 ${SANS}`, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--ink)' }}>Add stats</button></div>
    </Section>
  );
}

export function IdeaDrawer() {
  const { selected, select } = useApp();
  const ops = useOps();
  const idea = ops.ideas.find((i) => i.id === selected) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<string | null>(null);
  idRef.current = idea?.id ?? null;

  // Focus moves into the drawer on open and back to the card on close. Escape closes it.
  useEffect(() => {
    const id = selected;
    closeRef.current?.focus({ preventScroll: true });
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) select(null); };
    document.addEventListener('keydown', on);
    return () => {
      document.removeEventListener('keydown', on);
      if (id) requestAnimationFrame(() => { const el = document.getElementById(`card-${id}`); if (el && !document.activeElement?.closest('[role=dialog]') && document.activeElement === document.body) el.focus({ preventScroll: true }); });
    };
  }, [selected, select]);

  if (!idea) return null;
  const book = ops.bookById.get(idea.bookId);
  const next = nextStage(idea.status);
  const prev = prevStage(idea);
  const pack = ops.curPack(idea);
  const writing = !!ops.writerJob(idea.code);
  const pend = ops.pending && ops.pending.id === idea.id && ops.pending.origin === 'drawer' ? ops.pending : null;
  const hist = idea.history.map((h, k, a) => {
    const last = k === a.length - 1;
    return { status: h.status, last, at: last && isToday(h.at) ? 'Today' : fmtDay(h.at) };
  });
  const from = [book?.title, book?.author, pgs(idea.pages)].filter(Boolean).join(' · ') || idea.fromBook;
  const dropped = idea.status === 'Dropped';
  const needsPack = idea.status === 'Approved' && !pack;

  const primary = needsPack
    ? <button type="button" data-drawer="write-pack" disabled={writing} onClick={() => void ops.writePack(idea)} className="qp-hv-op88" style={primaryStyle(writing)}>{writing ? 'Queued for Writer' : 'Write pack'}</button>
    : next ? <button type="button" data-drawer="advance" onClick={() => ops.moveForward(idea, next)} className="qp-hv-op88" style={primaryStyle(false)}>Move to {next} →</button> : null;

  return (
    <aside role="dialog" aria-label="Idea detail" data-drawer-idea={idea.code}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 40, width: 'min(480px,46vw)', minWidth: 'min(380px,100vw)', display: 'flex', flexDirection: 'column', background: 'var(--sf)', borderLeft: '1px solid var(--line2)', boxShadow: '-40px 0 120px var(--shadow)', animation: 'qpIn .32s cubic-bezier(.2,.7,.2,1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 32px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, font: `400 11px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          <span style={{ color: 'var(--ink)' }}>{idea.code}</span><span>·</span><span data-drawer-stage>{idea.status}</span>
        </div>
        <button ref={closeRef} type="button" id="drawer-close" onClick={() => select(null)} className="qp-hv-close"
          style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, color: 'var(--dim)' }}>Close</button>
      </div>
      <div data-drawer-body style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 40px', display: 'grid', gap: 36, alignContent: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <span style={{ font: `400 10.5px/1.5 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}><span style={{ color: 'var(--lilac)' }}>¹</span> From · {from}</span>
          <h2 style={{ margin: 0, font: `300 34px/1.14 ${SERIF}`, letterSpacing: '-.022em', textWrap: 'pretty' }}>{idea.hook || 'No hook written yet'}</h2>
        </div>
        {idea.quietPart && (
          <div style={{ display: 'grid', gap: 12 }}>
            <span style={LABEL}>The quiet part</span>
            <p style={{ margin: 0, font: `italic 400 22px/1.4 ${SERIF}`, textWrap: 'pretty' }}>{idea.quietPart}</p>
          </div>
        )}
        <div data-scores style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, padding: '20px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          {SCORE_KEYS.map(([k, label]) => {
            const v = idea.scores[k];
            return (
              <div key={k} style={{ display: 'grid', gap: 10 }}>
                <span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
                <span style={{ font: `300 28px/1 ${SERIF}` }}>{v}<span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--faint)', marginLeft: 2 }}>/5</span></span>
                <span role="img" aria-label={`${label} ${v} out of 5`} style={{ display: 'block', height: 2, background: 'var(--line2)' }}>
                  <span style={{ display: 'block', height: 2, width: `${Math.max(0, Math.min(5, v)) * 20}%`, background: 'var(--ink)' }} />
                </span>
              </div>
            );
          })}
        </div>
        {(idea.why || idea.tryThis || idea.visual) && (
          <div style={{ display: 'grid', gap: 24, font: `400 16.5px/1.6 ${SERIF}`, color: 'var(--ink)' }}>
            {idea.why && <Section label="Why it lands"><p style={{ margin: 0, textWrap: 'pretty' }}>{idea.why}</p></Section>}
            {idea.tryThis && <Section label="Try this"><p style={{ margin: 0, textWrap: 'pretty' }}>{idea.tryThis}</p></Section>}
            {idea.visual && <Section label="Visual"><p style={{ margin: 0, color: 'var(--dim)', textWrap: 'pretty' }}>{idea.visual}</p></Section>}
          </div>
        )}
        {(idea.evidence || idea.evidenceNote || idea.sources.length > 0) && (
          <div data-evidence style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 20, alignItems: 'start', padding: 22, border: '1px solid var(--line)', borderRadius: 14 }}>
            <Stamp ev={idea.evidence} index={1} style={{ fontSize: 11, padding: '7px 10px 6px' }} />
            <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
              {idea.evidenceNote && <p style={{ margin: 0, font: `400 14px/1.55 ${SANS}`, color: 'var(--dim)', textWrap: 'pretty' }}>{idea.evidenceNote}</p>}
              {idea.sources.length > 0 && (
                <ul data-sources style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4, font: `400 13px/1.45 ${SANS}`, wordBreak: 'break-word' }}>
                  {idea.sources.map((s, k) => <li key={k}><SafeLink url={s.url} text={s.title || s.url} /></li>)}
                </ul>
              )}
            </div>
          </div>
        )}
        {idea.format && <Section label="Format"><span style={{ font: `400 14px/1.4 ${SANS}`, color: 'var(--dim)' }}>{idea.format}</span></Section>}
        <Notes idea={idea} />
        <Media idea={idea} />
        {idea.status === 'Posted' && (
          <Section label="Posted" id="drawer-posted">
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}>{idea.posted?.date ? fmtDay(idea.posted.date) : 'Date not recorded'}{idea.posted && isHttps(idea.posted.link) && <> · <SafeLink url={idea.posted.link} text={idea.posted.link} /></>}</div>
          </Section>
        )}
        {idea.status === 'Posted' && <Stats idea={idea} />}
        {dropped && <Section label="Dropped"><div style={{ font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}>{idea.dropReason || 'No reason given'}</div></Section>}
        <div style={{ display: 'grid', gap: 14 }}>
          <span style={LABEL}>History</span>
          <ol data-history style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 0, position: 'relative' }}>
            {hist.map((h, k) => (
              <li key={k} data-last={h.last ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', justifySelf: 'center', background: h.last ? 'var(--ink)' : 'transparent', border: h.last ? 0 : '1px solid var(--faint)' }} />
                <span style={{ font: `400 14px/1.3 ${SANS}`, color: h.last ? 'var(--ink)' : 'var(--dim)' }}>{h.status}</span>
                <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{h.at}</span>
              </li>
            ))}
          </ol>
          {idea.updatedAt && <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>Updated {fmtRel(idea.updatedAt)}</span>}
        </div>
      </div>
      <div data-drawer-foot style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '18px 32px', borderTop: '1px solid var(--line)', background: 'var(--sf)' }}>
        {pend ? <MovePrompt pending={pend} variant="drawer" /> : (
          <>
            {prev && !(dropped && prev === 'Idea') && stageIndex(idea.status) !== 0 && (
              <button type="button" data-drawer="back" onClick={() => ops.moveBack(idea)} className="qp-hv-back"
                style={{ flexBasis: '100%', justifySelf: 'start', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, color: 'var(--dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {dropped ? `Restore to ${prev}` : 'Move back one stage'}
              </button>
            )}
            <button type="button" data-drawer="drop" onClick={() => ops.requestMove(idea, dropped ? 'Idea' : 'Dropped', 'drawer')} className="qp-hv-drop"
              style={{ height: 42, padding: '0 18px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13.5px/1 ${SANS}`, color: 'var(--dim)' }}>{dropped ? 'Restore to Idea' : 'Drop idea'}</button>
            {primary}
          </>
        )}
      </div>
    </aside>
  );
}

const primaryStyle = (disabled: boolean): CSSProperties => ({ height: 42, padding: '0 22px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', cursor: disabled ? 'default' : 'pointer', font: `500 13.5px/1 ${SANS}`, color: 'var(--on-ink)', opacity: disabled ? 0.45 : 1 });
