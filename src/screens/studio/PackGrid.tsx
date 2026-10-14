import { useMemo, useState, type CSSProperties } from 'react';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { fmtDur, packSegments } from '../../lib/packs';
import { lsGet, lsSet } from '../../lib/storage';
import { useStudio } from './useStudio';

const CHIPS: [string, string][] = [['all', 'All packs'], ['Scripted', 'Scripted'], ['Voiced', 'Voiced'], ['Produced', 'Produced'], ['QA passed', 'QA passed']];
const IN_PROD = new Set(['Scripted', 'Voiced', 'Produced', 'QA passed']);

export const qaColor = (v: string) => (v === 'GO' ? 'var(--grow)' : 'var(--caution)');
export function qaStamp(v: string): CSSProperties {
  const c = qaColor(v);
  return { font: `500 9.5px/1 ${MONO}`, letterSpacing: '.16em', color: c, border: `1.5px solid ${c}`, borderRadius: 3, padding: '5px 7px 4px', transform: 'rotate(-2deg)', whiteSpace: 'nowrap' };
}

/** The design's "All packs" grid: stage chips with counts, the hint on the right, auto-fill cards (4 across at 1440). */
export function PackGrid({ missing }: { missing: string | null }) {
  const S = useStudio();
  const [stage, setStageState] = useState<string>(() => lsGet('qps.studioStage') || 'all');
  const setStage = (k: string) => { setStageState(k); lsSet('qps.studioStage', k); };
  const prod = useMemo(() => S.groups.filter((g) => IN_PROD.has(g.idea.status)), [S.groups]);
  const posted = S.groups.filter((g) => g.idea.status === 'Posted');
  const chips = posted.length ? [...CHIPS, ['Posted', 'Posted'] as [string, string]] : CHIPS;
  const st = chips.some((c) => c[0] === stage) ? stage : 'all';
  const shown = st === 'all' ? prod : S.groups.filter((g) => g.idea.status === st);

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px' }}>
        <div role="group" aria-label="Filter by stage" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map(([k, l]) => {
            const on = st === k;
            const n = k === 'all' ? prod.length : S.groups.filter((g) => g.idea.status === k).length;
            return (
              <button key={k} type="button" data-stage-chip={k} aria-pressed={on} onClick={() => setStage(k)} className="qp-hv-line-faint"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 13px/1 ${SANS}`, border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)' }}>
                {l}<span style={{ font: `400 10.5px/1 ${MONO}`, opacity: 0.6 }}>{S.loaded ? n : '–'}</span>
              </button>
            );
          })}
        </div>
        <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>Copy into Claude Design · voiceover tool</span>
      </div>
      {missing && <p role="status" style={{ margin: '0 0 24px', font: `italic 400 17px/1.4 ${SERIF}`, color: 'var(--dim)' }}>That pack isn't here any more. Pick another below.</p>}
      {!S.loaded ? (
        <div aria-busy="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,300px), 1fr))', gap: 16 }}>
          {[0, 1, 2, 3].map((k) => <div key={k} style={{ height: 300, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--sf)', opacity: 0.6 }} />)}
        </div>
      ) : !shown.length ? (
        <div data-empty style={{ padding: 40, border: '1px dashed var(--line2)', borderRadius: 16, font: `italic 400 22px/1.3 ${SERIF}`, color: 'var(--dim)' }}>
          {S.groups.length ? 'No pack at this stage.' : 'No packs yet. Approve an idea, then press Write pack.'}
        </div>
      ) : (
        <div data-pack-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,300px), 1fr))', gap: 16 }}>
          {shown.map(({ idea, pack: p }) => {
            const b = S.bookById.get(idea.bookId);
            const segs = packSegments(p, idea);
            const cover = p.cover || p.beats[0]?.onscreen || '';
            const qv = idea.qaLast?.verdict ?? '';
            return (
              <article key={p.id} data-pack-card={idea.code} tabIndex={0} role="link" aria-label={`${idea.code}: ${idea.hook || p.title}`}
                onClick={() => S.open(p.id, 'script')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.open(p.id, 'script'); } }} className="qp-hv-line-faint"
                style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 22px 20px', border: '1px solid var(--line)', borderRadius: 16, background: 'var(--sf)', cursor: 'pointer', minWidth: 0, transition: 'border-color .2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{idea.code}</span>
                  <span style={{ font: `italic 400 16px/1 ${SERIF}`, color: 'var(--dim)' }}>{idea.status}</span>
                </div>
                <p style={{ margin: 0, font: `400 20px/1.34 ${SERIF}`, letterSpacing: '-.008em', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.hook || p.title}</p>
                {cover && <span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>Cover · <span style={{ color: 'var(--dim)' }}>{cover}</span></span>}
                <div style={{ flex: 1 }} />
                <div data-segs style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6 }}>
                  {segs.map(([label, on]) => (
                    <div key={label} data-seg={label.toLowerCase()} data-on={on ? 'true' : 'false'} title={`${label}${on ? ' done' : ' not yet'}`} style={{ display: 'grid', gap: 8 }}>
                      <span style={{ display: 'block', height: 2, borderRadius: 2, background: on ? 'var(--ink)' : 'var(--line2)' }} />
                      <span style={{ font: `400 9.5px/1 ${MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: on ? 'var(--dim)' : 'var(--faint)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>¹ From · {b?.title || idea.fromBook || '–'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
                    <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>{[fmtDur(p.durationSec), `v${p.version}`].filter(Boolean).join(' · ')}</span>
                    {qv && <span data-qa-stamp={qv} style={qaStamp(qv)}>QA · {qv}</span>}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
