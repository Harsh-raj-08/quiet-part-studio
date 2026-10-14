import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/context';
import { useBooks, useJobs, useLoaded, useReports } from '../../data/hooks';
import { isLive, useRunner } from '../../data/useRunner';
import type { Report } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { dayMonYear, slugOf, str } from '../../lib/format';
import { addToQueue, card, emptyItalic, queueBtn, sectionLabel, selectStyle, shelfState, smallChip, srcText } from './shared';

const MODES = [['all', 'All'], ['weekly', 'Weekly'], ['manual', 'Manual'], ['briefs', 'Your briefs']] as const;
const LANES = ['All', 'Well known', 'Trending', 'Hidden gem'];
type Mode = (typeof MODES)[number][0];

/** Report kind, as the old studio worked it out: explicit mode, else the request text. */
export function repMode(r: Report, jobReq = ''): Exclude<Mode, 'all'> {
  const m = str(r.d.mode).toLowerCase();
  if (m === 'weekly' || m === 'manual') return m;
  if (m === 'brief' || m === 'briefs') return 'briefs';
  const q = str(r.d.request) || jobReq;
  return /^weekly run/i.test(q) ? 'weekly' : /^manual run/i.test(q) ? 'manual' : 'briefs';
}
const KIND = { weekly: 'Scout · weekly', manual: 'Scout · manual run', briefs: 'Your brief' } as const;

export function Reports() {
  const { id } = useApp();
  const reports = useReports(); const books = useBooks(); const jobs = useJobs();
  const loaded = useLoaded('reports');
  const R = useRunner();
  const [mode, setMode] = useState<Mode>('all');
  const [sel, setSel] = useState(0);
  const [lane, setLane] = useState('All');
  const [hide, setHide] = useState(false);
  const jobReq = (r: Report) => str(jobs.find((j) => j.id === str(r.d.jobId))?.request);
  const all = useMemo(() => reports.filter((r) => r.type === 'scout').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)), [reports]);
  const list = all.filter((r) => mode === 'all' || repMode(r, jobReq(r)) === mode);
  // "Open report" from a chat lands here with the report id.
  useEffect(() => { if (id) { const k = all.findIndex((r) => r.id === id); if (k >= 0) { setMode('all'); setSel(k); } } }, [id, all.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ri = Math.min(sel, Math.max(list.length - 1, 0));
  const r = list[ri];
  const running = jobs.find((j) => j.node === 'scout' && !j.kind && !j.chatId && isLive(j));
  const cands = r && Array.isArray(r.d.candidates) ? (r.d.candidates as Record<string, unknown>[]).filter((c) => c && typeof c === 'object' && str(c.title)) : [];
  const vis = cands.filter((c) => (lane === 'All' || str(c.lane) === lane) && !(hide && shelfState(books, str(c.title)) === 'shelf'));
  const repSources = r ? srcText(r.d.sources) : '';
  const answer = r ? str(r.d.answer) : '';
  const summary = r ? str(r.d.summary) : '';

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px 24px', marginBottom: 32 }}>
        <div role="group" aria-label="Report type" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MODES.map(([k, l]) => <button key={k} id={`rep-mode-${k}`} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setSel(0); }} style={smallChip(mode === k)}>{l}</button>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {list.length > 0 && (
            <select id="rep-select" aria-label="Report" value={String(ri)} onChange={(e) => setSel(+e.target.value)} style={selectStyle}>
              {list.map((x, i) => <option key={x.id} value={String(i)}>{`${dayMonYear(x.at)} · ${KIND[repMode(x, jobReq(x))]}`}</option>)}
            </select>
          )}
          <button id="run-scout" type="button" disabled={!!running || R.busy.has('scout')} onClick={() => void R.queue('scout', { node: 'scout', request: 'Manual run' })} className="qp-hv-op88"
            style={{ height: 38, padding: '0 18px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', cursor: running ? 'default' : 'pointer', font: `500 13px/1 ${SANS}`, color: 'var(--on-ink)', whiteSpace: 'nowrap' }}>{running ? 'Scout running…' : 'Run Scout now'}</button>
        </div>
      </div>
      {!loaded ? <div aria-busy="true" style={{ minHeight: 300 }} /> : !r ? (
        <p id="rep-empty" style={{ margin: 0, padding: 40, border: '1px dashed var(--line2)', borderRadius: 16, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>
          {all.length ? 'No report of this type yet. Press Run to create the first one.' : 'No report yet. Press Run to create the first one.'}
        </p>
      ) : (
        <>
          <header id="rep-head" style={{ display: 'grid', gap: 16, maxWidth: '74ch', paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
            <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>{KIND[repMode(r, jobReq(r))]} · {dayMonYear(r.at)}</span>
            {repMode(r, jobReq(r)) === 'briefs' && str(r.d.request) && <p id="rep-request" style={{ margin: 0, paddingLeft: 18, borderLeft: '1.5px solid var(--ink)', font: `italic 400 20px/1.45 ${SERIF}` }}>“{str(r.d.request)}”</p>}
            {answer && <p id="rep-answer" style={{ margin: 0, font: `300 23px/1.5 ${SERIF}`, textWrap: 'pretty' }}>{answer}</p>}
            {summary && <p id="rep-summary" style={{ margin: 0, font: `300 23px/1.5 ${SERIF}`, textWrap: 'pretty' }}>{summary}</p>}
          </header>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px 24px', margin: '28px 0 20px' }}>
            <div role="group" aria-label="Lane" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={sectionLabel}>Lane</span><span style={{ width: 6 }} />
              {LANES.map((l) => <button key={l} type="button" data-lane={l} aria-pressed={lane === l} onClick={() => setLane(l)} style={smallChip(lane === l)}>{l}</button>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button id="hide-shelf" type="button" aria-pressed={hide} onClick={() => setHide(!hide)}
                style={{ height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, border: `1px ${hide ? 'solid' : 'dashed'} var(--line2)`, background: 'transparent', color: hide ? 'var(--ink)' : 'var(--dim)' }}>{hide ? 'Showing new books only' : 'Hide books already on the shelf'}</button>
              <span id="cand-count" style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>Showing {vis.length} of {cands.length}</span>
            </div>
          </div>
          <div id="cands" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,320px), 1fr))', gap: 16 }}>
            {vis.map((c) => {
              const title = str(c.title); const st = shelfState(books, title); const q = queueBtn(st);
              const hooks = Array.isArray(c.hooks) ? (c.hooks as unknown[]).map(str).filter(Boolean) : [];
              const src = srcText(c.sources) || repSources.split(' · ').slice(0, 2).join(' · ');
              return (
                <article key={title} data-cand={slugOf(title)} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    {str(c.lane) ? <span style={{ font: `500 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 9px', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--dim)' }}>{str(c.lane)}</span> : <span />}
                    {st === 'shelf' && <span data-on-shelf style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--grow)' }}>On the shelf</span>}
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                    <h3 style={{ margin: 0, font: `300 26px/1.14 ${SERIF}`, letterSpacing: '-.016em', textWrap: 'balance' }}>{title}</h3>
                    <span style={{ font: `italic 400 15px/1.3 ${SERIF}`, color: 'var(--dim)' }}>{[str(c.author), str(c.year)].filter(Boolean).join(' · ')}</span>
                  </div>
                  {str(c.why) && <p style={{ margin: 0, font: `400 13.5px/1.55 ${SANS}`, color: 'var(--dim)', textWrap: 'pretty' }}>{str(c.why)}</p>}
                  {hooks.length > 0 && (
                    <div style={{ display: 'grid', gap: 10, padding: '14px 0 4px', borderTop: '1px solid var(--line)' }}>
                      <span style={sectionLabel}>Sample hooks</span>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>{hooks.map((h, i) => <li key={i} style={{ font: `400 16px/1.4 ${SERIF}`, textWrap: 'pretty' }}>{h}</li>)}</ul>
                    </div>
                  )}
                  {str(c.risk) && <p style={{ margin: 0, display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 8, font: `400 13px/1.5 ${SANS}`, color: 'var(--caution)' }}><span>!</span><span>Risk: {str(c.risk)}</span></p>}
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <span style={{ minWidth: 0, font: `400 10.5px/1.5 ${MONO}`, color: 'var(--faint)' }}>{src}</span>
                    <button type="button" id={`add-${slugOf(title)}`} disabled={!!st || R.busy.has(`book:${title}`)} style={q.style}
                      onClick={() => void R.run(`book:${title}`, async () => { if (await addToQueue(R.store, books, { title, author: str(c.author), lane: str(c.lane), why: str(c.why) })) R.toast('Added to the book queue'); })}>{q.label}</button>
                  </div>
                </article>
              );
            })}
          </div>
          {!vis.length && <p id="cand-none" style={emptyItalic}>{cands.length ? 'No candidate matches these filters.' : 'This report has no candidates.'}</p>}
          {repSources && (
            <div style={{ display: 'grid', gap: 10, marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
              <span style={sectionLabel}>Report sources</span>
              <span id="rep-sources" style={{ font: `400 12px/1.6 ${MONO}`, color: 'var(--dim)' }}>{repSources}</span>
            </div>
          )}
        </>
      )}
    </>
  );
}
