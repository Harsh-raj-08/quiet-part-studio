import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { useHeadline } from '../../app/useHeadline';
import { useIdeas, useJobs, useMetrics, useReports } from '../../data/hooks';
import { isLive, useRunner } from '../../data/useRunner';
import { fireAndDescribe, queueJob } from '../../data/actions';
import { SANS } from '../../design/fonts';
import { Btn, subPill, SubTabs } from '../../design/kit';
import { Eyebrow, Headline } from '../../design/primitives';
import { GROUPS, METRICS, postedRows, type GroupKey, type MetricKey } from '../../lib/insights';
import { dayMonth, str } from '../../lib/format';
import { lsGet, lsSet } from '../../lib/storage';
import { selectStyle } from '../discover/shared';
import { Log, IMG_ACCEPT, checkImages } from './Log';
import { Review } from './Review';
import { Taste } from './Taste';
import { Works } from './Works';

const SUBS = [['log', 'Log stats'], ['review', 'Weekly review'], ['works', 'What works'], ['taste', 'Taste']] as const;
type Sub = (typeof SUBS)[number][0];

/** 05 · Insights: Log stats, Weekly review, What works, Taste. Reading numbers from screenshots is a Review job. */
export function InsightsScreen() {
  const h = useHeadline('insights');
  const { sub, go } = useApp();
  const s = (SUBS.some((x) => x[0] === sub) ? sub : 'log') as Sub;
  const R = useRunner();
  const ideas = useIdeas(); const metrics = useMetrics(); const reports = useReports(); const jobs = useJobs();
  const rows = useMemo(() => postedRows(ideas, metrics), [ideas, metrics]);
  const [open, setOpen] = useState<string | null>(null);
  const [group, setGroupS] = useState<GroupKey>(() => (GROUPS.some((g) => g[0] === lsGet('qps.worksG')) ? lsGet('qps.worksG') as GroupKey : 'evidence'));
  const setGroup = (g: GroupKey) => { setGroupS(g); lsSet('qps.worksG', g); };
  const [metric, setMetric] = useState<MetricKey>('sends');
  const [rev, setRev] = useState(0);
  const profileRef = useRef<HTMLInputElement>(null);
  const reviews = useMemo(() => reports.filter((r) => r.type === 'review').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)), [reports]);
  const revJob = jobs.find((j) => j.node === 'review' && !j.kind && !j.ideaCode && isLive(j));
  const tasteJob = jobs.find((j) => j.node === 'taste' && isLive(j));
  const profJob = jobs.find((j) => j.node === 'review' && j.kind === 'read-profile' && isLive(j));

  const uploadProfile = (files: File[]) => {
    const bad = checkImages(files, 1);
    if (bad) { R.toast(bad, true); return; }
    void R.run('profile', async () => {
      const r = await R.store.adapter.uploadFile(files[0]!, { folder: 'stats/profile' });
      await queueJob(R.store, { node: 'review', kind: 'read-profile', request: 'Read follower count', files: [r.path] });
      R.toast(await fireAndDescribe(R.store));
    });
  };

  const right = s === 'log' ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input ref={profileRef} id="profile-file" type="file" tabIndex={-1} className="qp-sr" accept={IMG_ACCEPT} aria-label="Profile screenshot"
        onChange={(e) => { const f = Array.from(e.target.files ?? []) as File[]; e.target.value = ''; uploadProfile(f); }} />
      <Btn id="profile-upload" kind="quiet" h={38} disabled={R.busy.has('profile') || !!profJob} onClick={() => profileRef.current?.click()} style={{ border: '1px solid var(--line2)' }}>
        {R.busy.has('profile') ? 'Uploading…' : profJob ? 'Reading followers…' : 'Profile screenshot'}</Btn>
      {rows.length > 0 && <Btn id="log-today" h={38} onClick={() => { const t = rows.find((r) => !r.latest) ?? rows[0]!; setOpen(t.idea.code); setTimeout(() => document.getElementById(`stat-${t.idea.code}`)?.scrollIntoView({ block: 'center' }), 30); }}>Log today's numbers</Btn>}
    </div>
  ) : s === 'review' ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {reviews.length > 1 && <select id="review-select" aria-label="Review" value={String(rev)} onChange={(e) => setRev(+e.target.value)} style={selectStyle}>{reviews.map((r, i) => <option key={r.id} value={String(i)}>Week of {dayMonth(str(r.d.weekOf) || r.at)}</option>)}</select>}
      <Btn id="run-review" h={38} disabled={!!revJob || R.busy.has('review')} onClick={() => void R.queue('review', { node: 'review', request: 'Weekly review' })}>{revJob ? 'Review running…' : 'Run review now'}</Btn>
    </div>
  ) : s === 'works' ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <select id="works-metric" aria-label="Metric" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} style={selectStyle}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <div role="group" aria-label="Group by" style={{ display: 'inline-flex', flexWrap: 'wrap', padding: 3, border: '1px solid var(--line2)', borderRadius: 999 }}>
        {GROUPS.map(([k, l]) => <button key={k} id={`wg-${k}`} type="button" aria-pressed={group === k} onClick={() => setGroup(k)} style={subPill(group === k)}>{l}</button>)}
      </div>
    </div>
  ) : (
    <Btn id="run-taste" h={38} disabled={!!tasteJob || R.busy.has('taste')} onClick={() => void R.queue('taste', { node: 'taste', request: 'Update taste profile' })}>{tasteJob ? 'Taste running…' : 'Run taste now'}</Btn>
  );

  return (
    <div data-screen="insights">
      <section style={{ padding: '56px 0 0' }}>
        <Eyebrow>{h.eb}</Eyebrow>
        <Headline ghost={h.g} lit={h.l} maxCh={22} />
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px', font: `400 13px/1 ${SANS}` }}>
        <SubTabs tabs={SUBS} value={s} onChange={(k) => go('insights', k)} label="Insights sections" idPrefix="sub-insights" />
        {right}
      </div>
      {s === 'log' && <Log rows={rows} open={open} setOpen={setOpen} />}
      {s === 'review' && <Review r={reviews[Math.min(rev, Math.max(reviews.length - 1, 0))] ?? null} job={revJob ?? null} />}
      {s === 'works' && <Works rows={rows} group={group} metric={metric} />}
      {s === 'taste' && <Taste job={tasteJob ?? null} />}
    </div>
  );
}
