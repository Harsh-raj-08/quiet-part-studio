import { useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { useLoaded, usePlaybooks } from '../../data/hooks';
import { useRunner } from '../../data/useRunner';
import type { Job, Report } from '../../data/types';
import { MONO, PEN, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, Label } from '../../design/kit';
import { dayMonth, str } from '../../lib/format';
import { lsGet, lsSet } from '../../lib/storage';

const isO = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const objs = (a: unknown) => (Array.isArray(a) ? a : []).map((x) => (typeof x === 'string' ? { text: x } : x)).filter(isO);
const h3: CSSProperties = { margin: 0, font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--dim)' };
const para: CSSProperties = { margin: 0, font: `400 19px/1.65 ${SERIF}`, textWrap: 'pretty' };
const CONF: Record<string, string> = { strong: 'var(--grow)', medium: 'var(--calm)', early: 'var(--faint)' };

/** Learnings lines the Writer reads: "- [early|medium|strong] text", at most 12, no links. */
export function cleanLearnings(t: string): { lines: string[]; dropped: number } {
  const lines: string[] = []; let dropped = 0;
  t.split('\n').forEach((l) => { l = l.trimEnd(); if (!l.trim()) return; if (/^- ?\[(early|medium|strong)\] [^\n]{1,140}$/.test(l) && !/http|</i.test(l) && lines.length < 12) lines.push(l); else dropped++; });
  return { lines, dropped };
}

/** The weekly review as the design's editorial article, then the learnings proposal. */
export function Review({ r, job }: { r: Report | null; job: Job | null }) {
  const { go, select } = useApp();
  const loaded = useLoaded('reports');
  if (!loaded) return <div aria-busy="true" style={{ minHeight: 400 }} />;
  const d = r?.d ?? {};
  const chip = (code: string) => code ? <button type="button" data-rv-idea={code} onClick={() => { go('ideas'); select(code); }} className="qp-hv-soft"
    style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.1em', padding: '5px 8px', border: '1px solid var(--line2)', borderRadius: 999, background: 'transparent', color: 'var(--ink)', cursor: 'pointer', verticalAlign: '3px', marginRight: 10 }}>{code}</button> : null;
  const items = (a: unknown, text: (x: Record<string, unknown>) => string): ReactNode[] => objs(a).map((x, i) => {
    const code = str(x.ideaCode); const t = text(x);
    return t ? <p key={i} style={para}>{code && !t.startsWith(code) ? chip(code) : null}{code && t.startsWith(code) ? <>{chip(code)}{t.slice(code.length).replace(/^\s+/, '')}</> : t}</p> : null;
  }).filter(Boolean);
  const winT = (x: Record<string, unknown>) => str(x.why) || [str(x.metric), str(x.text)].filter(Boolean).join('. ');
  const sections: [string, ReactNode[]][] = r ? [
    ['What worked', [...items(d.wins, winT), ...objs(d.patterns).map((p, i) => (
      <p key={`p${i}`} style={para}>{str(p.evidence) || str(p.pattern || p.finding || p.text)}{str(p.confidence) && <span style={{ marginLeft: 10, font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: CONF[str(p.confidence).toLowerCase()] ?? 'var(--dim)', border: `1px ${str(p.confidence) === 'early' ? 'dashed' : 'solid'} currentColor`, borderRadius: 999, padding: '4px 8px', verticalAlign: '3px' }}>{str(p.confidence)}</span>}</p>))]],
    ["What didn't", items(d.misses, winT)],
    ['Experiments', objs(d.experiments).map((x, i) => <p key={i} style={para}>{[str(x.hypothesis), str(x.test) && `Test: ${str(x.test)}`].filter(Boolean).join(' ') || str(x.text)}</p>)],
    ['Next week', items(d.nextActions, (x) => str(x.action || x.text))],
  ] : [];
  const sc = isO(d.scorecard) ? d.scorecard : null;
  const num = (v: unknown, dg = 0, suf = '') => (v == null || v === '' || !Number.isFinite(+v!) ? '–' : `${(+v!).toLocaleString('en-US', { maximumFractionDigits: dg })}${suf}`);
  const headline = str(d.headline) || str(d.summary);
  return (
    <>
      {job && <div style={{ maxWidth: '68ch', margin: '0 auto 24px' }}><JobRow id="review-job" node="review" note={job.request} status={job.status} at={job.createdAt} error={job.error} /></div>}
      {!r ? (
        <p id="review-empty" style={{ margin: 0, padding: 40, border: '1px dashed var(--line2)', borderRadius: 16, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>No review yet. It runs every Monday, or press Run review now.</p>
      ) : (
        <article id="review" style={{ position: 'relative', display: 'grid', gap: 36, maxWidth: '68ch', margin: '0 auto', padding: '16px 0 40px' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Weekly review · week of {dayMonth(str(d.weekOf) || r.at)} · written by Review</span>
            {headline && <h2 id="review-headline" style={{ margin: 0, font: `300 40px/1.12 ${SERIF}`, letterSpacing: '-.022em', textWrap: 'balance' }}>{headline}</h2>}
            {str(d.note) && <span aria-hidden="true" style={{ justifySelf: 'end', marginTop: 4, font: `400 24px/1.1 ${PEN}`, color: 'var(--dim)', transform: 'rotate(-3deg)' }}>{str(d.note)}</span>}
            {str(d.headline) && str(d.summary) && <p style={{ ...para, color: 'var(--dim)' }}>{str(d.summary)}</p>}
          </div>
          {sections.filter(([, ps]) => ps.length).map(([h, ps]) => <section key={h} style={{ display: 'grid', gap: 12 }}><h3 style={h3}>{h}</h3>{ps}</section>)}
          {sc && (
            <section id="rv-tiles" style={{ display: 'grid', gap: 16 }}>
              <h3 style={h3}>Scorecard</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 16 }}>
                {[['Posted', num(sc.posted)], ['Median views', num(sc.medianViews)], ['Avg watch', num(sc.avgWatchPct, 0, '%')], ['Save rate', num(sc.saveRate, 1, '%')], ['Share rate', num(sc.shareRate, 1, '%')], ['Follows /1k', num(sc.followsPer1k, 1)]].map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gap: 10, paddingTop: 12, borderTop: '1px solid var(--line2)' }}><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{k}</span><span style={{ font: `300 26px/1 ${SERIF}` }}>{v}</span></div>
                ))}
              </div>
            </section>
          )}
          {str(d.sources) || Array.isArray(d.sources) ? <span style={{ font: `400 11px/1.5 ${MONO}`, color: 'var(--faint)' }}>Sources · {(Array.isArray(d.sources) ? d.sources : [d.sources]).map((x) => (isO(x) ? str(x.title || x.url) : str(x))).filter(Boolean).join(' · ')}</span> : null}
        </article>
      )}
      <Learnings />
    </>
  );
}

/** Current learnings, and the Review worker's proposed update as a diff with Accept / Dismiss. */
function Learnings() {
  const pbs = usePlaybooks();
  const R = useRunner();
  const [, force] = useState(0);
  const cur = pbs.find((p) => p.id === 'learnings');
  const prop = pbs.find((p) => p.id === 'learnings-proposed');
  const curLines = str(cur?.d.text).split('\n').map((x) => x.trim()).filter(Boolean);
  const pd = prop && str(prop.d.text).trim() && Date.parse(str(prop.d.at)) > (Date.parse(str(cur?.d.at)) || 0) && lsGet('qps.lrnx') !== str(prop.d.at) ? prop.d : null;
  const c = pd ? cleanLearnings(str(pd.text)) : null;
  const a = new Set(curLines); const b = new Set(c?.lines ?? []);
  return (
    <section id="learnings" aria-labelledby="lrn-h" style={{ display: 'grid', gap: 14, maxWidth: '68ch', margin: '0 auto', paddingTop: 28, borderTop: '1px solid var(--line)' }}>
      <Label id="lrn-h">Learnings · the Writer reads these before every pack</Label>
      {c && (
        <div id="lrn-prop" style={{ display: 'grid', gap: 10, padding: 22, border: '1px solid var(--line)', borderRadius: 14 }}>
          <Label>Proposed update</Label>
          {curLines.filter((x) => !b.has(x)).map((x, i) => <div key={`o${i}`} data-diff="old" style={{ font: `400 15px/1.5 ${SANS}`, color: 'var(--caution)', textDecoration: 'line-through' }}>{x}</div>)}
          {c.lines.filter((x) => !a.has(x)).map((x, i) => <div key={`n${i}`} data-diff="new" style={{ justifySelf: 'start', font: `400 15px/1.5 ${SANS}`, backgroundImage: 'var(--ul)', backgroundRepeat: 'no-repeat', backgroundSize: '100% .14em', backgroundPosition: '0 96%' }}>{x}</div>)}
          {c.dropped > 0 && <p style={{ margin: 0, font: `italic 400 14px/1.4 ${SERIF}`, color: 'var(--caution)' }}>{c.dropped} line{c.dropped > 1 ? 's' : ''} dropped (wrong format, a link, or past 12 lines).</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn id="lrn-accept" kind="ink" h={38} disabled={!c.lines.length || R.busy.has('lrn')} onClick={() => void R.run('lrn', async () => {
              const data = { node: 'learnings', text: c.lines.join('\n'), at: new Date().toISOString(), basedOn: str(pd!.basedOn) || null, acceptedBy: 'owner' };
              if (cur) await R.store.mutate('playbooks', 'learnings', () => data);
              else await R.store.set('playbooks', 'learnings', data);
              R.toast('Learnings accepted');
            })}>Accept learnings</Btn>
            <Btn id="lrn-dismiss" kind="quiet" h={38} onClick={() => { lsSet('qps.lrnx', str(pd!.at)); force((n) => n + 1); }}>Dismiss</Btn>
          </div>
        </div>
      )}
      {curLines.length ? <ul id="lrn-current" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, font: `400 16px/1.55 ${SERIF}` }}>{curLines.map((l, i) => <li key={i}>{l.replace(/^-\s*/, '')}</li>)}</ul>
        : <p style={{ margin: 0, font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--faint)' }}>No learnings recorded yet.</p>}
    </section>
  );
}
