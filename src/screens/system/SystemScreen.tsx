import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { useHeadline } from '../../app/useHeadline';
import { useBooks, useChats, useJobs, useLoaded, usePlaybooks, useRuns, useSettings } from '../../data/hooks';
import { useRunner } from '../../data/useRunner';
import type { Job, StudioSettings } from '../../data/types';
import { MONO, SANS, SERIF, EASE } from '../../design/fonts';
import { Btn, statusStyle, SubTabs } from '../../design/kit';
import { Eyebrow, Headline } from '../../design/primitives';
import { fmtWhen, whenText } from '../../lib/format';
import { DEMO_NOTE } from '../../data/actions';
import { idleSince, workerOnline } from '../../lib/worker';

const SUBS = [['runs', 'Runs'], ['jobs', 'Jobs'], ['settings', 'Settings']] as const;
type Sub = (typeof SUBS)[number][0];
const NODES = ['all', 'writer', 'research', 'art', 'qa', 'scout', 'trends', 'review'];
const STATUSES = ['all', 'queued', 'running', 'done', 'failed'];
const COLS = '76px 60px minmax(0,1fr) 92px 96px';

/** "1m 12s", "48s", "1h 05m". */
export function took(ms: number): string {
  if (!(ms >= 0)) return '';
  const n = Math.round(ms / 1000);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  if (m < 60) return `${m}m ${String(n % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
export { whenText };

function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const t = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(t); }, [on]);
}

const nodeChip = (on: boolean): CSSProperties => ({ height: 30, padding: '0 12px', borderRadius: 999, cursor: 'pointer', font: `500 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)' });

interface Row { id: string; node: string; target: string; note: string; status: string; start: string; end: string; at: string; error?: string }

/** System: run log, job queue and settings, as designed. */
export function SystemScreen() {
  const h = useHeadline('system');
  const { sub, go } = useApp();
  const s = (SUBS.some((x) => x[0] === sub) ? sub : 'runs') as Sub;
  const [node, setNode] = useState('all');
  const [st, setSt] = useState('all');
  const runs = useRuns(); const jobs = useJobs(); const books = useBooks(); const chats = useChats();
  const runsLoaded = useLoaded('runs'); const jobsLoaded = useLoaded('jobs');
  const target = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return (j: Job | undefined, fallback = '') => {
      if (!j) return fallback;
      if (j.ideaCode) return j.ideaCode;
      if (j.bookId) { const b = books.find((x) => x.id === j.bookId); return b ? b.code || b.title : j.bookId; }
      if (j.chatId) return 'chat';
      void byId; return fallback;
    };
  }, [jobs, books]);
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const runRows: Row[] = runs.map((r) => ({ id: r.id, node: r.node, target: r.target || target(jobById.get(r.jobId)), note: r.summary, status: r.status || 'done', start: r.startedAt, end: r.finishedAt, at: r.at || r.finishedAt || r.startedAt }));
  const jobRows: Row[] = jobs.map((j) => ({ id: j.id, node: j.kind ? `${j.node}` : j.node, target: target(j), note: [j.kind && j.kind !== 'chat' ? j.kind : j.kind === 'chat' ? `chat · ${chats.find((c) => c.id === j.chatId)?.title ?? ''}` : '', j.request].filter(Boolean).join(' · '), status: j.status || 'queued', start: j.startedAt, end: j.finishedAt, at: j.createdAt, error: j.error }));
  const rows = (s === 'jobs' ? jobRows : runRows).filter((r) => (node === 'all' || r.node === node) && (s !== 'jobs' || st === 'all' || r.status === st));
  const anyRunning = rows.some((r) => r.status === 'running');
  useTick(anyRunning && s !== 'settings');

  return (
    <div data-screen="system">
      <section style={{ padding: '56px 0 0' }}>
        <Eyebrow>{h.eb}</Eyebrow>
        <Headline ghost={h.g} lit={h.l} maxCh={22} />
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px' }}>
        <SubTabs tabs={SUBS} value={s} onChange={(k) => go('system', k)} label="System sections" idPrefix="sub-system" />
        {s !== 'settings' && (
          <div role="group" aria-label="Node" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(runs.some((r) => r.node === 'taste') || jobs.some((j) => j.node === 'taste') ? [...NODES, 'taste'] : NODES).map((n) => <button key={n} id={`rf-${n}`} type="button" aria-pressed={node === n} onClick={() => setNode(n)} style={nodeChip(node === n)}>{n}</button>)}
          </div>
        )}
      </div>
      {s === 'jobs' && <WorkerBar st={st} setSt={setSt} shown={rows.length} total={jobRows.length} />}
      {s !== 'settings' && ((s === 'runs' ? runsLoaded : jobsLoaded) ? <Table rows={rows} kind={s} node={node} /> : <div aria-busy="true" style={{ minHeight: 300 }} />)}
      {s === 'settings' && <Settings />}
    </div>
  );
}

function Table({ rows, kind, node }: { rows: Row[]; kind: 'runs' | 'jobs'; node: string }) {
  const now = Date.now();
  return (
    <div id={`${kind}-table`} style={{ display: 'grid', borderTop: '1px solid var(--line2)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, padding: '14px 4px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', borderBottom: '1px solid var(--line)' }}>
        <span>Node</span><span>Target</span><span>Note</span><span>Status</span><span style={{ textAlign: 'right' }}>When</span>
      </div>
      {rows.map((r) => {
        const running = r.status === 'running';
        const dur = running ? took(now - Date.parse(r.start)) : r.start && r.end ? took(Date.parse(r.end) - Date.parse(r.start)) : '';
        return (
          <div key={r.id} data-row={r.id} data-status={r.status} className="qp-hv-ghost" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 16, alignItems: 'center', padding: '18px 4px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase' }}>{r.node}</span>
            <span style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.target}>{r.target || '—'}</span>
            <span title={r.error ? `${r.note} · ${r.error}` : r.note} style={{ font: `400 14px/1.45 ${SANS}`, color: r.error ? 'var(--caution)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error ? `${r.note} · ${r.error}` : r.note}</span>
            <span style={statusStyle(r.status)}>{r.status}</span>
            <span style={{ display: 'grid', gap: 5, justifyItems: 'end', font: `400 11px/1 ${MONO}`, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
              <span>{kind === 'jobs' && r.status === 'queued' ? 'next' : whenText(r.at, running, now)}</span>
              <span data-took style={{ color: 'var(--dim)' }}>{dur || '—'}</span>
            </span>
          </div>
        );
      })}
      {!rows.length && <p id={`${kind}-none`} style={{ margin: 0, padding: '32px 4px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>{node === 'all' ? (kind === 'jobs' ? 'The queue is empty.' : 'No runs logged yet.') : 'Nothing here for this node.'}</p>}
    </div>
  );
}

function WorkerBar({ st, setSt, shown, total }: { st: string; setSt: (s: string) => void; shown: number; total: number }) {
  const R = useRunner();
  const set = useSettings();
  const on = workerOnline(set.workerSeenAt);
  const fire = () => void R.run('fire', async () => {
    if (R.store.adapter.mode === 'demo') { R.toast(DEMO_NOTE); return; }
    const r = await R.store.adapter.fireWorker();
    R.toast(r.ok ? 'Worker started. It picks up the queue now.' : r.error === 'too_soon' ? 'The worker was started a moment ago.' : 'Could not start the worker. It runs at the next scheduled check.', !r.ok && r.error !== 'too_soon');
  });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px 24px', marginBottom: 24 }}>
      <div role="group" aria-label="Status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {STATUSES.map((x) => <button key={x} id={`jf-${x}`} type="button" aria-pressed={st === x} onClick={() => setSt(x)} style={nodeChip(st === x)}>{x}</button>)}
        <span id="jobs-count" style={{ marginLeft: 8, font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>Showing {shown} of {total}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <span id="worker-line" style={{ font: `400 11px/1.4 ${MONO}`, color: 'var(--dim)' }}>Worker {on ? 'online' : idleSince(set.workerSeenAt)}{set.workerSchedule ? ` · checks ${set.workerSchedule}` : ''}</span>
        <Btn id="run-worker" kind="ink" h={38} disabled={R.busy.has('fire')} onClick={fire}>{R.busy.has('fire') ? 'Starting…' : 'Run worker now'}</Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- settings
const CADENCE = ['4 per week', '3 per week', 'Daily'];
function Toggle({ id, on, onFlip, label }: { id: string; on: boolean; onFlip: () => void; label: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} aria-label={label} onClick={onFlip}
      style={{ justifySelf: 'end', position: 'relative', width: 46, height: 26, borderRadius: 999, border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', cursor: 'pointer', padding: 0, transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: on ? 'var(--on-ink)' : 'var(--dim)', transition: `left .2s ${EASE}` }} />
    </button>
  );
}
function SRow({ k, d, children, id }: { k: string; d: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div id={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(120px,240px)', gap: 32, alignItems: 'center', padding: '24px 4px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'grid', gap: 6 }}><span style={{ font: `400 19px/1.3 ${SERIF}` }}>{k}</span><span style={{ font: `400 13.5px/1.5 ${SANS}`, color: 'var(--dim)' }}>{d}</span></div>
      {children}
    </div>
  );
}
const valPill = (on: boolean): CSSProperties => ({ justifySelf: 'end', font: `500 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: on ? 'var(--grow)' : 'var(--faint)', border: `1px ${on ? 'solid' : 'dashed'} currentColor`, borderRadius: 999, padding: '6px 10px', whiteSpace: 'nowrap' });
const selStyle: CSSProperties = { justifySelf: 'end', width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 14px/1 ${SANS}`, color: 'var(--ink)' };

function Settings() {
  const set = useSettings();
  const pbs = usePlaybooks();
  const { mode } = useApp();
  const R = useRunner();
  const save = (patch: Partial<StudioSettings>) => void R.run('settings', async () => {
    const cur = await R.store.get('settings', 'studio');
    if (cur) await R.store.mutate('settings', 'studio', () => patch as Record<string, unknown>); else await R.store.set('settings', 'studio', patch as Record<string, unknown>);
    R.toast('Setting saved');
  });
  const on = workerOnline(set.workerSeenAt);
  const chars = pbs.reduce((n, p) => n + String(p.d.text ?? '').length, 0);
  return (
    <div id="settings" style={{ display: 'grid', maxWidth: 860, borderTop: '1px solid var(--line2)' }}>
      <SRow k="Writer lane" d="Quick drafts in seconds, or a careful pass that checks every claim against the notes.">
        <select id="set-writer-lane" aria-label="Writer lane" value={set.writerLane} onChange={(e) => save({ writerLane: e.target.value as StudioSettings['writerLane'] })} style={selStyle}><option value="careful">Careful</option><option value="quick">Quick</option></select>
      </SRow>
      <SRow k="Posting cadence" d="Review uses this to space posts and avoid back-to-back topics.">
        <select id="set-cadence" aria-label="Posting cadence" value={CADENCE.includes(set.cadence) ? set.cadence : CADENCE[0]} onChange={(e) => save({ cadence: e.target.value })} style={selStyle}>{CADENCE.map((c) => <option key={c}>{c}</option>)}</select>
      </SRow>
      <SRow k="Auto-queue art after a pack" d="Generate reference frames as soon as the writer finishes."><Toggle id="set-auto-art" label="Auto-queue art after a pack" on={set.autoArt} onFlip={() => save({ autoArt: !set.autoArt })} /></SRow>
      <SRow k="Notify on QA verdict" d="Send a message when a video gets GO, FIX or NO-GO."><Toggle id="set-notify-qa" label="Notify on QA verdict" on={set.notifyQa} onFlip={() => save({ notifyQa: !set.notifyQa })} /></SRow>
      <SRow k="Space philosophy posts" d="Keep at least one post between philosophy topics."><Toggle id="set-space-philosophy" label="Space philosophy posts" on={set.spacePhilosophy} onFlip={() => save({ spacePhilosophy: !set.spacePhilosophy })} /></SRow>
      <div style={{ height: 40 }} />
      <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)', padding: '0 4px 16px', borderBottom: '1px solid var(--line2)' }}>How the studio runs · read only</span>
      <SRow id="info-worker" k="Studio worker" d={<>{set.workerSchedule ? `Checks the queue ${set.workerSchedule}.` : 'No schedule set yet.'} {set.workerSeenAt ? `Last seen ${fmtWhen(set.workerSeenAt)}.` : 'Has not reported in yet.'} {mode === 'supabase' ? (set.triggerSet ? 'A trigger is set for “Run worker now”.' : 'No trigger is set; “Run worker now” waits for the schedule.') : ''}</>}>
        <span style={valPill(on)}>{on ? 'Online' : idleSince(set.workerSeenAt)}</span>
      </SRow>
      <SRow id="info-data" k="Data and files" d="Studio data lives in your Supabase project. Files sit in a private bucket and open through links that expire after an hour."><span style={valPill(mode !== 'demo')}>{mode === 'demo' ? 'Demo data' : mode === 'mock' ? 'Test data' : 'Connected'}</span></SRow>
      <SRow id="info-claude" k="Claude" d="Nothing runs Claude inside this page. Asking Scout, edits, hooks, screenshots and reviews all go to the worker as jobs, and the results appear here."><span style={valPill(true)}>Through the worker</span></SRow>
      <SRow id="info-playbooks" k="Playbooks" d={pbs.length ? pbs.slice().sort((a, b) => a.id.localeCompare(b.id)).map((p) => `${p.id} (${String(p.d.text ?? '').length.toLocaleString('en-US')} characters)`).join(' · ') : 'None yet.'}>
        <span style={{ justifySelf: 'end', font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>{chars.toLocaleString('en-US')} characters</span>
      </SRow>
      <SRow id="info-security" k="Security" d={<span style={{ display: 'grid', gap: 4 }}>
        <span>Only you can open or change this studio.</span>
        <span>The worker can only write studio data. It never posts, deletes or spends.</span>
        <span>Files are private.</span>
        <span>Your Instagram and ElevenLabs logins never touch this page.</span>
      </span>}><span style={valPill(true)}>Owner only</span></SRow>
    </div>
  );
}
