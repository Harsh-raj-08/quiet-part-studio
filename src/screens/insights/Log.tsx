import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { fireAndDescribe, queueJob } from '../../data/actions';
import { useSignedUrl } from '../../data/files';
import { useAccount, useJobs, useLoaded } from '../../data/hooks';
import { isLive, useRunner } from '../../data/useRunner';
import { METRIC_FIELDS, type MetricField, type Snap } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, Label, Overlay } from '../../design/kit';
import { compactViews, expectations, kpis, type PostRow } from '../../lib/insights';
import { fmtDay, parseWhen, shortDay } from '../../lib/format';

export const IMG_ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
const IMG_MAX = 10 * 1024 * 1024;
/** Insights screenshots: PNG, JPEG or WebP, up to 10 MB each, `max` per batch. */
export function checkImages(files: File[], max: number): string | null {
  if (!files.length) return 'Choose a screenshot.';
  if (files.length > max) return `Up to ${max} screenshots at a time.`;
  for (const f of files) {
    const ext = (f.name.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'Screenshots must be PNG, JPEG or WebP.';
    if (!(f.size > 0)) return 'That file is empty.';
    if (f.size > IMG_MAX) return `${f.name} is over 10 MB.`;
  }
  return null;
}

const COLS = '52px minmax(160px,1.4fr) minmax(80px,.8fr) 52px 40px 76px';
const fn = (v: number | null, d = 0) => (v == null || !Number.isFinite(v) ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d }));
const shortDate = shortDay;

export function Log({ rows, open, setOpen }: { rows: PostRow[]; open: string | null; setOpen: (c: string | null) => void }) {
  const account = useAccount();
  const loaded = useLoaded('metrics') && true;
  const ideasLoaded = useLoaded('ideas');
  const exp = useMemo(() => expectations(rows), [rows]);
  const K = useMemo(() => kpis(rows, account, Date.now()), [rows, account]);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.latest?.views ?? 0, exp.get(r.idea.code)?.value ?? 0))) * 1.03;
  const sevenDay = rows.some((r) => exp.get(r.idea.code)?.kind === '7-day');
  if (!loaded || !ideasLoaded) return <div aria-busy="true" style={{ minHeight: 400 }} />;
  return (
    <>
      <div id="ins-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 24, paddingBottom: 40, borderBottom: '1px solid var(--line)' }}>
        {K.map((k) => (
          <div key={k.key} id={`kpi-${k.key}`} style={{ display: 'grid', gap: 12, paddingTop: 16, borderTop: '1px solid var(--line2)' }}>
            <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>{k.label}</span>
            <span style={{ font: `300 clamp(36px,4vw,52px)/1 ${SERIF}`, letterSpacing: '-.02em' }}>{k.value}</span>
            <span style={{ font: `400 11px/1 ${MONO}`, color: k.tone === 'up' ? 'var(--grow)' : k.tone === 'down' ? 'var(--caution)' : 'var(--faint)' }}>{k.delta}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 0 16px' }}>
          <span id="h-log" style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            Views per post · solid is actual, dashed is {sevenDay ? 'the 7-day expectation' : 'the median of all reels'}
          </span>
        </div>
        {rows.map((r) => <Row key={r.idea.code} r={r} exp={exp.get(r.idea.code)!} max={max} open={open === r.idea.code} onToggle={() => setOpen(open === r.idea.code ? null : r.idea.code)} />)}
        {!rows.length && <p id="log-empty" style={{ margin: 0, padding: '32px 4px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Nothing posted yet. Once an idea is marked posted it shows up here, ready for its numbers.</p>}
        {rows.length > 0 && <p id="stats-tip" style={{ margin: '20px 0 0', font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Screenshot each reel's Insights at day 1, day 7 and day 30: Overview, Engagement and Watch time. The Review worker reads the numbers.</p>}
      </div>
    </>
  );
}

function Row({ r, exp, max, open, onToggle }: { r: PostRow; exp: { value: number | null; kind: string }; max: number; open: boolean; onToggle: () => void }) {
  const l = r.latest;
  const v = l?.views ?? null;
  return (
    <div id={`stat-${r.idea.code}`} style={{ borderTop: '1px solid var(--line)' }}>
      <button type="button" id={`statrow-${r.idea.code}`} aria-expanded={open} aria-controls={`statbody-${r.idea.code}`} onClick={onToggle} className="qp-hv-ghost"
        style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center', width: '100%', padding: '16px 4px', border: 0, background: open ? 'var(--ghost)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)' }}>
        <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{shortDate(r.postedAt)}</span>
        <span title={`${r.idea.code} · ${r.idea.hook}`} style={{ font: `400 16px/1.35 ${SERIF}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.idea.hook || r.idea.code}</span>
        {v != null ? (
          <span role="img" aria-label={`${fn(v)} views${exp.value != null ? `, ${exp.kind === '7-day' ? '7-day expectation' : 'median'} ${fn(exp.value)}` : ''}`} style={{ position: 'relative', display: 'block', height: 14 }}>
            {exp.value != null && <span data-exp={exp.kind} style={{ position: 'absolute', left: `${Math.min(100, (exp.value / max) * 100)}%`, top: 0, bottom: 0, width: 0, borderLeft: '1.5px dashed var(--faint)' }} />}
            <span data-bar style={{ position: 'absolute', left: 0, top: 6, height: 2, width: `${Math.max(1, Math.min(100, (v / max) * 100))}%`, background: 'var(--ink)' }} />
          </span>
        ) : <span style={{ font: `italic 400 14px/1 ${SERIF}`, color: 'var(--faint)' }}>No stats yet</span>}
        <span style={{ textAlign: 'right', font: `400 18px/1 ${SERIF}` }}>{v == null ? '' : compactViews(v)}</span>
        <span style={{ textAlign: 'right', font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>{l?.watchThroughPct != null ? `${Math.round(l.watchThroughPct)}%` : v == null ? '' : '–'}</span>
        <span style={{ textAlign: 'right', whiteSpace: 'nowrap', font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>{l?.shares != null ? `${fn(l.shares)} sends` : ''}</span>
      </button>
      {open && <Body r={r} />}
    </div>
  );
}

const inp: CSSProperties = { height: 42, padding: '0 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--ink)', font: `400 14px/1 ${MONO}`, width: '100%', minWidth: 0 };

function Body({ r }: { r: PostRow }) {
  const R = useRunner();
  const jobs = useJobs();
  const code = r.idea.code;
  const fileRef = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<Record<MetricField, string> | null>(null);
  const [view, setView] = useState<number | null>(null);
  const job = jobs.find((j) => j.node === 'review' && j.kind === 'read-screenshots' && j.ideaCode === code) ?? null;
  const m = r.metric;

  const upload = (files: File[]) => {
    const bad = checkImages(files, 6);
    if (bad) { R.toast(bad, true); return; }
    void R.run(`shots:${code}`, async () => {
      const at = new Date().toISOString();
      const ups: { path: string; fileName: string; at: string }[] = [];
      for (const f of files) { const u = await R.store.adapter.uploadFile(f, { folder: `stats/${code}` }); ups.push({ path: u.path, fileName: f.name, at }); }
      const cur = await R.store.get('metrics', code);
      if (!cur) await R.store.set('metrics', code, { ideaCode: code, postedAt: r.idea.posted?.date ?? '', screenshots: ups, snapshots: [], updatedAt: at });
      else await R.store.mutate('metrics', code, (d) => ({ screenshots: [...(Array.isArray(d.data.screenshots) ? d.data.screenshots : []), ...ups].slice(-60), updatedAt: at }));
      await queueJob(R.store, { node: 'review', kind: 'read-screenshots', ideaCode: code, request: `Read ${ups.length} screenshot${ups.length > 1 ? 's' : ''}`, files: ups.map((u) => u.path) });
      R.toast(await fireAndDescribe(R.store));
    });
  };

  const save = () => {
    if (!edit) return;
    const vals: Partial<Record<MetricField, number | null>> = {};
    for (const [k] of METRIC_FIELDS) { const t = edit[k].trim().replace(/,/g, ''); if (t === '') vals[k] = null; else { const n = Number(t); if (!Number.isFinite(n) || n < 0) { R.toast(`Check the ${k} number`, true); return; } vals[k] = n; } }
    void R.run(`edit:${code}`, async () => {
      const at = new Date().toISOString();
      const posted = parseWhen(r.idea.posted?.date ?? '');
      const snap = { at, day: Number.isFinite(posted) ? Math.max(0, Math.round((Date.parse(at) - posted) / 864e5)) : null, ...vals, source: 'edit', note: '' };
      const cur = await R.store.get('metrics', code);
      if (!cur) await R.store.set('metrics', code, { ideaCode: code, postedAt: r.idea.posted?.date ?? '', snapshots: [snap], latest: snap, screenshots: [], updatedAt: at });
      else await R.store.mutate('metrics', code, (d) => ({ snapshots: [...(Array.isArray(d.data.snapshots) ? d.data.snapshots : []), snap].slice(-100), latest: snap, updatedAt: at }));
      setEdit(null);
      R.toast('Numbers saved');
    });
  };

  const startEdit = () => { const l = r.latest; const v = {} as Record<MetricField, string>; for (const [k] of METRIC_FIELDS) v[k] = l && l[k] != null ? String(l[k]) : ''; setEdit(v); };

  return (
    <div id={`statbody-${code}`} style={{ display: 'grid', gap: 20, padding: '8px 4px 32px 68px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input ref={fileRef} id={`stats-files-${code}`} type="file" multiple tabIndex={-1} className="qp-sr" accept={IMG_ACCEPT} aria-label={`Insights screenshots for ${code}`}
          onChange={(e) => { const f = Array.from(e.target.files ?? []) as File[]; e.target.value = ''; upload(f); }} />
        <Btn id={`stats-upload-${code}`} h={32} disabled={R.busy.has(`shots:${code}`) || isLive(job)} style={{ padding: '0 14px', font: `400 12.5px/1 ${SANS}` }} onClick={() => fileRef.current?.click()}>
          {R.busy.has(`shots:${code}`) ? 'Uploading…' : 'Add screenshots'}</Btn>
        <Btn id={`stats-edit-${code}`} h={32} kind="quiet" style={{ padding: '0 12px', font: `400 12.5px/1 ${SANS}` }} onClick={() => (edit ? setEdit(null) : startEdit())}>{edit ? 'Close' : r.latest ? 'Edit numbers' : 'Enter numbers'}</Btn>
        <span style={{ font: `italic 400 14px/1.4 ${SERIF}`, color: 'var(--faint)' }}>{r.idea.code} · posted {fmtDay(r.idea.posted?.date ?? '')}</span>
      </div>
      {job && <JobRow id={`stats-job-${code}`} node="review" note={job.status === 'done' ? 'Read the screenshots; the numbers are below.' : job.request} status={job.status} at={job.createdAt} error={job.error} />}
      {edit && (
        <form id={`sx-${code}`} onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'grid', gap: 14, padding: 22, border: '1px solid var(--line2)', borderRadius: 16, background: 'var(--sf)' }}>
          <Label>Correct the numbers · saves a new snapshot</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
            {METRIC_FIELDS.map(([k, label]) => (
              <label key={k} htmlFor={`stat-${k}-${code}`} style={{ display: 'grid', gap: 8, font: `400 10px/1.2 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}
                <input id={`stat-${k}-${code}`} type="text" inputMode="decimal" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} style={inp} /></label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn id={`sx-save-${code}`} kind="ink" h={38} disabled={R.busy.has(`edit:${code}`)} onClick={save}>Save numbers</Btn>
            <Btn kind="quiet" h={38} onClick={() => setEdit(null)}>Cancel</Btn>
          </div>
        </form>
      )}
      {m && m.snapshots.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table id={`snaps-${code}`} style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, font: `400 12px/1.4 ${MONO}`, color: 'var(--dim)' }}>
            <thead><tr>{['Day', 'Date', 'Views', 'Reach', 'Watch %', 'Likes', 'Saves', 'Sends', 'Follows', 'Source'].map((h) => <th key={h} scope="col" style={{ textAlign: h === 'Day' || h === 'Date' || h === 'Source' ? 'left' : 'right', padding: '8px 6px', font: `400 10px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
            <tbody>{m.snapshots.slice().reverse().map((x: Snap, i) => (
              <tr key={i}>{[x.day == null ? '–' : `Day ${x.day}`, fmtDay(x.at), fn(x.views), fn(x.reach), x.watchThroughPct == null ? '–' : `${fn(x.watchThroughPct, 1)}%`, fn(x.likes), fn(x.saves), fn(x.shares), fn(x.follows), x.source || 'manual']
                .map((c, j) => <td key={j} style={{ padding: '8px 6px', textAlign: j < 2 || j === 9 ? 'left' : 'right', borderBottom: '1px solid var(--line)' }}>{c}</td>)}</tr>))}</tbody>
          </table>
        </div>
      )}
      {m && m.screenshots.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <Label>Screenshots</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{m.screenshots.map((s, k) => <Shot key={k} path={s.path} id={`shot-${code}-${k}`} label={s.fileName} onOpen={() => setView(k)} />)}</div>
        </div>
      )}
      {!m?.snapshots.length && !m?.screenshots.length && !job && <p style={{ margin: 0, font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--faint)' }}>No stats logged for this reel yet.</p>}
      {view != null && m?.screenshots[view] && <ShotView path={m.screenshots[view]!.path} label={m.screenshots[view]!.fileName} onClose={() => setView(null)} />}
    </div>
  );
}

const tile: CSSProperties = { width: 72, aspectRatio: '9/16', position: 'relative', overflow: 'hidden', padding: 0, borderRadius: 10, border: '1px solid var(--line2)', background: 'repeating-linear-gradient(135deg, var(--ghost) 0 1px, transparent 1px 9px), var(--sf)', cursor: 'pointer', color: 'var(--faint)', font: `400 9px/1 ${MONO}` };
function Shot({ path, id, label, onOpen }: { path: string; id: string; label: string; onOpen: () => void }) {
  const url = useSignedUrl(path);
  return <button id={id} type="button" aria-label={`View screenshot ${label}`} onClick={onOpen} className="qp-hv-soft" style={tile}>{url ? <img src={url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : '…'}</button>;
}
function ShotView({ path, label, onClose }: { path: string; label: string; onClose: () => void }) {
  const url = useSignedUrl(path);
  return <Overlay id="frov" title={`Screenshot · ${label || 'Insights'}`} onClose={onClose}><div style={{ ...tile, width: 'auto', maxHeight: '64vh', justifySelf: 'center', cursor: 'default' }}>{url ? <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}</div></Overlay>;
}
