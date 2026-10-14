import { useMemo } from 'react';
import { useBooks, useLoaded, usePacks } from '../../data/hooks';
import type { Pack } from '../../data/types';
import { MONO, SERIF } from '../../design/fonts';
import { compactViews, fmtMetric, METRICS, workGroups, type GroupKey, type MetricKey, type PostRow } from '../../lib/insights';

/** What works: average views and the chosen metric per group (the design shows sends), bar scaled to the metric. */
export function Works({ rows, group, metric }: { rows: PostRow[]; group: GroupKey; metric: MetricKey }) {
  const books = useBooks(); const packs = usePacks();
  const loaded = useLoaded('metrics');
  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const packFor = useMemo(() => { const m = new Map<string, Pack>(); packs.forEach((p) => { const c = m.get(p.ideaCode); if (!c || p.version > c.version) m.set(p.ideaCode, p); }); return m; }, [packs]);
  const withStats = rows.filter((r) => r.latest).map((r) => ({ idea: r.idea, latest: r.latest!, pack: packFor.get(r.idea.code) ?? null }));
  const gs = useMemo(() => workGroups(withStats, group, metric, bookMap), [withStats, group, metric, bookMap]);
  const max = Math.max(0, ...gs.map((g) => g.value ?? 0)) || 1;
  const label = METRICS.find((m) => m[0] === metric)![1];
  if (!loaded) return <div aria-busy="true" style={{ minHeight: 300 }} />;
  if (withStats.length < 3) return <p id="works-empty" style={{ margin: 0, padding: 40, border: '1px dashed var(--line2)', borderRadius: 16, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>Needs at least 3 posted reels with stats. Right now: {withStats.length}.</p>;
  return (
    <>
      <div id="works" role="list" aria-label={`Average views and ${label.toLowerCase()} by group`} style={{ display: 'grid', borderTop: '1px solid var(--line2)' }}>
        {gs.map((g) => (
          <div key={g.name} role="listitem" data-group={g.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,180px) minmax(60px,1fr) 80px 80px 48px', gap: 20, alignItems: 'center', padding: '26px 4px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ font: `italic 400 21px/1.2 ${SERIF}` }}>{g.name}{g.n < 2 && <span title="Only one reel so far" style={{ marginLeft: 10, font: `400 9.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', border: '1px dashed var(--faint)', borderRadius: 3, padding: '3px 5px', verticalAlign: '4px', fontStyle: 'normal' }}>early</span>}</span>
            <span style={{ display: 'block', height: 2, background: 'var(--line2)' }}><span data-bar style={{ display: 'block', height: 2, width: `${((g.value ?? 0) / max) * 100}%`, background: 'var(--ink)' }} /></span>
            <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}><span style={{ font: `300 24px/1 ${SERIF}` }}>{g.views == null ? '–' : compactViews(g.views)}</span><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>avg views</span></span>
            <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}><span data-value style={{ font: `300 24px/1 ${SERIF}` }}>{fmtMetric(metric, g.value)}</span><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap' }}>avg {metric === 'sends' ? 'sends' : metric === 'watch' ? 'watch' : metric === 'save' ? 'saves' : metric === 'share' ? 'shares' : 'follows/1k'}</span></span>
            <span style={{ textAlign: 'right', font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>n = {g.n}</span>
          </div>
        ))}
      </div>
      {withStats.length < 10 && <p id="works-small" style={{ margin: '20px 0 0', font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Small sample: {withStats.length} reels. Treat these as hints, not rules.</p>}
    </>
  );
}
