import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { useIdeas, useJobs, useLoaded, useReports } from '../../data/hooks';
import { isLive, useRunner } from '../../data/useRunner';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { useCopied } from '../../design/kit';
import { dayMonth, str } from '../../lib/format';
import { card, sectionLabel, selectStyle, srcText } from './shared';

const isO = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const objs = (a: unknown) => (Array.isArray(a) ? a.filter(isO) : []);
const tagN = (t: unknown) => str(t).trim().replace(/^#+/, '').replace(/\s+/g, '');
/** Copy hashtags (SPEC2): all core + the first rotating, at most five. */
export function tagList(ht: Record<string, unknown>): string[] {
  const core = (Array.isArray(ht.core) ? ht.core : []).map(tagN).filter(Boolean);
  const rot = (Array.isArray(ht.rotating) ? ht.rotating : []).map(tagN).filter(Boolean);
  return core.concat(rot.slice(0, 1)).slice(0, 5);
}
const h4: CSSProperties = { margin: 0, font: `400 20px/1.3 ${SERIF}` };
const body: CSSProperties = { margin: 0, font: `400 14px/1.55 ${SANS}`, color: 'var(--dim)' };
const srcLine: CSSProperties = { font: `400 10.5px/1.5 ${MONO}`, color: 'var(--faint)' };
const grid = (min: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(100%,${min}px), 1fr))`, gap: 16 });

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <section id={`tr-${id}`} style={{ scrollMarginTop: 140, display: 'grid', gap: 20, padding: '36px 0', borderTop: '1px solid var(--line)' }}><span style={sectionLabel}>{label}</span>{children}</section>;
}

export function Trends() {
  const reports = useReports(); const jobs = useJobs(); const ideas = useIdeas();
  const { go, select } = useApp();
  const loaded = useLoaded('reports');
  const R = useRunner();
  const [sel, setSel] = useState(0);
  const [copied, copy] = useCopied();
  const list = useMemo(() => reports.filter((r) => r.type === 'trends').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)), [reports]);
  const r = list[Math.min(sel, Math.max(list.length - 1, 0))];
  const d = r?.d ?? {};
  const running = jobs.find((j) => j.node === 'trends' && isLive(j));
  const week = str(d.weekOf) || r?.at || '';
  const ht = isO(d.hashtags) ? d.hashtags : {};
  const tags = tagList(ht);
  const pt = isO(d.postingTimes) ? d.postingTimes : {};
  const actions = objs(d.actions).filter((a) => str(a.action));
  const platform = objs(d.platformUpdates); const formats = objs(d.formats); const hooks = objs(d.hooks); const audio = objs(d.audio);
  const sources = (Array.isArray(d.sources) ? d.sources : []).map((x) => srcText([x])).filter(Boolean);
  const core = (Array.isArray(ht.core) ? ht.core : []).map(tagN).filter(Boolean); const rot = (Array.isArray(ht.rotating) ? ht.rotating : []).map(tagN).filter(Boolean);
  const present: [string, string][] = ([['actions', 'Actions', actions.length], ['platform', 'Platform', platform.length], ['formats', 'Formats', formats.length], ['hooks', 'Hooks', hooks.length],
    ['hashtags', 'Hashtags', core.length + rot.length], ['audio', 'Audio', audio.length], ['times', 'Times', str(pt.guidance) ? 1 : 0], ['sources', 'Sources', sources.length]] as [string, string, number][])
    .filter((x) => x[2] > 0).map(([k, l]) => [k, l]);

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px 24px', marginBottom: 28 }}>
        <span id="tr-week" style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>Trends · Instagram{week ? ` · week of ${dayMonth(week)}` : ''}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {list.length > 0 && <select id="tr-select" aria-label="Week" value={String(sel)} onChange={(e) => setSel(+e.target.value)} style={selectStyle}>{list.map((x, i) => <option key={x.id} value={String(i)}>Week of {dayMonth(str(x.d.weekOf) || x.at)}</option>)}</select>}
          <button id="run-trends" type="button" disabled={!!running || R.busy.has('trends')} onClick={() => void R.queue('trends', { node: 'trends', request: 'Manual run' })} className="qp-hv-op88"
            style={{ height: 38, padding: '0 18px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', cursor: 'pointer', font: `500 13px/1 ${SANS}`, color: 'var(--on-ink)', whiteSpace: 'nowrap' }}>{running ? 'Trends running…' : 'Run Trends now'}</button>
        </div>
      </div>
      {!loaded ? <div aria-busy="true" style={{ minHeight: 300 }} /> : !r ? (
        <p id="tr-empty" style={{ margin: 0, padding: 40, border: '1px dashed var(--line2)', borderRadius: 16, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>No report yet. Press Run to create the first one.</p>
      ) : (
        <>
          {str(d.summary) && <p id="tr-summary" style={{ margin: '0 0 28px', maxWidth: '64ch', font: `300 23px/1.5 ${SERIF}`, textWrap: 'pretty' }}>{str(d.summary)}</p>}
          {present.length > 1 && (
            <nav aria-label="Jump to section" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {present.map(([k, l]) => (
                <a key={k} id={`tj-${k}`} href={`#tr-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`tr-${k}`)?.scrollIntoView({ block: 'start' }); }} className="qp-hv-soft"
                  style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line2)', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', textDecoration: 'none' }}>{l}</a>
              ))}
            </nav>
          )}
          {actions.length > 0 && (
            <Section id="actions" label="This week's actions">
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
                {actions.map((a, i) => {
                  const code = str(a.ideaCode); const idea = code ? ideas.find((x) => x.code === code) : undefined;
                  const cs: CSSProperties = { justifySelf: 'start', font: `500 11px/1 ${MONO}`, letterSpacing: '.1em', padding: '6px 9px', borderRadius: 999, border: `1px ${code ? 'solid' : 'dashed'} var(--line2)`, color: code ? 'var(--ink)' : 'var(--faint)', background: 'transparent' };
                  return (
                    <li key={i} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: 20, alignItems: 'baseline', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                      {idea ? <button type="button" id={`ta-${i}`} onClick={() => { go('ideas'); select(idea.id); }} className="qp-hv-soft" style={{ ...cs, cursor: 'pointer' }}>{code}</button> : <span style={cs}>{code || 'General'}</span>}
                      <span style={{ font: `400 18px/1.45 ${SERIF}`, textWrap: 'pretty' }}>{str(a.action)}</span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}
          {platform.length > 0 && <Section id="platform" label="Platform updates"><div style={grid(300)}>{platform.map((x, i) => (
            <article key={i} style={card}><h4 style={h4}>{str(x.title)}</h4>{str(x.detail) && <p style={body}>{str(x.detail)}</p>}{srcText([x.source]) && <span style={srcLine}>Source · {srcText([x.source])}</span>}</article>))}</div></Section>}
          {formats.length > 0 && <Section id="formats" label="Formats"><div style={grid(300)}>{formats.map((x, i) => (
            <article key={i} style={card}><h4 style={h4}>{str(x.name)}</h4>{str(x.why) && <p style={body}>{str(x.why)}</p>}
              {str(x.howWeUseIt) && <div style={{ display: 'grid', gap: 6, paddingTop: 12, borderTop: '1px solid var(--line)' }}><span style={sectionLabel}>How we use it</span><p style={{ margin: 0, font: `400 15.5px/1.5 ${SERIF}` }}>{str(x.howWeUseIt)}</p></div>}
            </article>))}</div></Section>}
          {hooks.length > 0 && <Section id="hooks" label="Hook patterns"><div style={grid(260)}>{hooks.map((x, i) => (
            <article key={i} style={card}><span style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase' }}>{str(x.pattern)}</span>{str(x.example) && <p style={{ margin: 0, font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--dim)', textWrap: 'pretty' }}>{str(x.example)}</p>}</article>))}</div></Section>}
          {core.length + rot.length > 0 && (
            <Section id="hashtags" label="Hashtags">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {core.map((t) => <span key={`c${t}`} data-tag="core" style={{ font: `400 12px/1 ${MONO}`, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line2)', color: 'var(--ink)' }}>#{t}</span>)}
                {rot.map((t) => <span key={`r${t}`} data-tag="rotating" style={{ font: `400 12px/1 ${MONO}`, padding: '8px 12px', borderRadius: 999, border: '1px dashed var(--faint)', color: 'var(--dim)' }}>#{t}</span>)}
              </div>
              {str(ht.note) && <p style={{ margin: 0, font: `400 13.5px/1.5 ${SANS}`, color: 'var(--dim)' }}>{str(ht.note)}</p>}
              <div><button id="copy-tags" type="button" onClick={() => copy('t', tags.map((t) => `#${t}`).join(' '), 'Hashtags')} className="qp-hv-soft"
                style={{ height: 34, padding: '0 16px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13px/1 ${SANS}`, color: 'var(--ink)' }}>{copied === 't' ? 'Copied' : 'Copy hashtags'}</button></div>
            </Section>
          )}
          {audio.length > 0 && (
            <Section id="audio" label="Audio picks">
              <div style={grid(300)}>{audio.map((x, i) => (
                <article key={i} style={card}><h4 style={h4}>{str(x.name)}</h4>
                  {(str(x.artist) || str(x.mood)) && <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>{[str(x.artist), str(x.mood)].filter(Boolean).join(' · ')}</span>}
                  {str(x.howToUse) && <p style={body}>{str(x.howToUse)}</p>}{srcText([x.source]) && <span style={srcLine}>Source · {srcText([x.source])}</span>}
                </article>))}</div>
              <p style={{ margin: 0, font: `italic 400 16px/1.45 ${SERIF}`, color: 'var(--faint)' }}>Pick these inside Instagram's audio library. Our reels are voice-led, so keep music low or off.</p>
            </Section>
          )}
          {str(pt.guidance) && <Section id="times" label="Posting times"><p style={{ margin: 0, maxWidth: '60ch', font: `400 20px/1.5 ${SERIF}` }}>{str(pt.guidance)}</p>{srcText([pt.source]) && <span style={srcLine}>Source · {srcText([pt.source])}</span>}</Section>}
          {sources.length > 0 && <Section id="sources" label="Sources"><ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>{sources.map((x, i) => <li key={i} style={{ font: `400 12px/1.5 ${MONO}`, color: 'var(--dim)' }}>{x}</li>)}</ul></Section>}
        </>
      )}
    </>
  );
}
