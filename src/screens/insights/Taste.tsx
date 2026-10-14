import { useMemo, useState, type CSSProperties } from 'react';
import { useLoaded, usePacks, usePlaybooks, useRatings } from '../../data/hooks';
import { useRunner } from '../../data/useRunner';
import type { Job } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, Label } from '../../design/kit';
import { fmtDay, str } from '../../lib/format';
import { lsGet, lsSet } from '../../lib/storage';

/** Taste lines: "- [early|medium|strong] text" or "- calibration: text", at most 13, no links. */
export function cleanTaste(t: string): { lines: string[]; dropped: number } {
  const lines: string[] = []; let dropped = 0;
  t.split('\n').forEach((l) => { l = l.trimEnd(); if (!l.trim()) return; if ((/^- ?\[(early|medium|strong)\] [^\n]{1,200}$/.test(l) || /^- calibration: [^\n]{1,160}$/.test(l)) && !/http|</i.test(l) && lines.length < 13) lines.push(l); else dropped++; });
  return { lines, dropped };
}
const para: CSSProperties = { margin: 0, font: `400 19px/1.65 ${SERIF}`, textWrap: 'pretty' };

export function Taste({ job }: { job: Job | null }) {
  const pbs = usePlaybooks(); const ratings = useRatings(); const packs = usePacks();
  const loaded = useLoaded('ratings');
  const R = useRunner();
  const [, force] = useState(0);
  const tp = pbs.find((p) => p.id === 'taste-profile'); const pq = pbs.find((p) => p.id === 'taste-proposed');
  const lines = str(tp?.d.text).split('\n').map((x) => x.trim()).filter(Boolean);
  const pd = pq && str(pq.d.text).trim() && Date.parse(str(pq.d.at)) > (Date.parse(str(tp?.d.at)) || 0) && lsGet('qps.tastex') !== str(pq.d.at) ? pq.d : null;
  const c = pd ? cleanTaste(str(pd.text)) : null;
  const a = new Set(lines); const b = new Set(c?.lines ?? []);
  const rs = useMemo(() => ratings.slice().sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).slice(0, 30), [ratings]);
  const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0;
  const pred = (pid: string) => packs.find((p) => p.id === pid)?.critic?.predictedOwnerScore ?? null;
  const anyPred = rs.some((r) => pred(r.packId) != null);
  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: '68ch', margin: '0 auto' }}>
      {job && <JobRow id="taste-job" node="taste" note={job.request} status={job.status} at={job.createdAt} error={job.error} />}
      <section id="taste-profile" style={{ display: 'grid', gap: 14 }}>
        <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Taste profile · what the Writer reads about you{tp?.d.at ? ` · ${fmtDay(str(tp.d.at))}` : ''}</span>
        {lines.length ? lines.map((l, i) => {
          const m = l.match(/^-\s*\[(early|medium|strong)\]\s*(.*)$/); const cal = l.match(/^-\s*calibration:\s*(.*)$/);
          return <p key={i} style={para}>{m ? m[2] : cal ? <><span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', marginRight: 10 }}>Calibration</span>{cal[1]}</> : l.replace(/^-\s*/, '')}
            {m && <span style={{ marginLeft: 10, font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: m[1] === 'strong' ? 'var(--grow)' : m[1] === 'medium' ? 'var(--calm)' : 'var(--faint)', border: `1px ${m[1] === 'early' ? 'dashed' : 'solid'} currentColor`, borderRadius: 999, padding: '4px 8px', verticalAlign: '3px' }}>{m[1]}</span>}</p>;
        }) : <p style={{ ...para, fontStyle: 'italic', color: 'var(--faint)' }}>No taste profile yet. Rate 5 scripts in Studio and the Writer starts learning.</p>}
      </section>
      {c && (
        <div id="taste-prop" style={{ display: 'grid', gap: 10, padding: 22, border: '1px solid var(--line)', borderRadius: 14 }}>
          <Label>Proposed update</Label>
          {lines.filter((x) => !b.has(x)).map((x, i) => <div key={`o${i}`} data-diff="old" style={{ font: `400 15px/1.5 ${SANS}`, color: 'var(--caution)', textDecoration: 'line-through' }}>{x}</div>)}
          {c.lines.filter((x) => !a.has(x)).map((x, i) => <div key={`n${i}`} data-diff="new" style={{ justifySelf: 'start', font: `400 15px/1.5 ${SANS}`, backgroundImage: 'var(--ul)', backgroundRepeat: 'no-repeat', backgroundSize: '100% .14em', backgroundPosition: '0 96%' }}>{x}</div>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn id="taste-accept" kind="ink" h={38} disabled={!c.lines.length || R.busy.has('tp')} onClick={() => void R.run('tp', async () => {
              const data = { node: 'taste-profile', text: c.lines.join('\n'), at: new Date().toISOString(), basedOn: str(pd!.basedOn) || null, acceptedBy: 'owner' };
              if (tp) await R.store.mutate('playbooks', 'taste-profile', () => data); else await R.store.set('playbooks', 'taste-profile', data);
              R.toast('Taste profile accepted');
            })}>Accept</Btn>
            <Btn id="taste-dismiss" kind="quiet" h={38} onClick={() => { lsSet('qps.tastex', str(pd!.at)); force((n) => n + 1); }}>Dismiss</Btn>
          </div>
        </div>
      )}
      <section id="taste-trend" aria-labelledby="taste-h" style={{ display: 'grid', gap: 4 }}>
        <span id="taste-h" style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)', paddingBottom: 16 }}>
          <span id="taste-count">{ratings.length ? `${ratings.length} script${ratings.length > 1 ? 's' : ''} rated · average ${avg.toFixed(1)}` : 'No scripts rated yet'}</span>{anyPred ? ' · dashed is the Critic’s prediction' : ''}
        </span>
        {loaded && rs.map((r) => {
          const p = pred(r.packId);
          return (
            <div key={r.id} data-rating={r.packId} style={{ display: 'grid', gridTemplateColumns: '52px 72px minmax(80px,1fr) 52px', gap: 16, alignItems: 'center', padding: '14px 4px', borderTop: '1px solid var(--line)' }}>
              <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{fmtDay(r.at)}</span>
              <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{r.ideaCode || r.packId} v{r.version}</span>
              <span role="img" aria-label={`${r.score} out of 10${p != null ? `, predicted ${p}` : ''}`} style={{ position: 'relative', display: 'block', height: 14 }}>
                {p != null && <span data-pred style={{ position: 'absolute', left: `${p * 10}%`, top: 0, bottom: 0, width: 0, borderLeft: '1.5px dashed var(--faint)' }} />}
                <span style={{ position: 'absolute', left: 0, top: 6, height: 2, width: `${r.score * 10}%`, background: 'var(--ink)' }} />
              </span>
              <span style={{ textAlign: 'right', font: `400 18px/1 ${SERIF}` }}>{r.score}<span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--faint)' }}>/10</span></span>
            </div>
          );
        })}
        {loaded && !rs.length && <p style={{ margin: 0, padding: '16px 4px', font: `italic 400 17px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Ratings show up here as you save them in Studio › Script.</p>}
      </section>
    </div>
  );
}
