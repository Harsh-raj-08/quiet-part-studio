import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../../data/store';
import { queueJob } from '../../data/actions';
import type { Idea, Pack } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, Label, labelStyle, monoChip, PromptPill, useCopied } from '../../design/kit';
import { Seg, useToast } from '../../design/primitives';
import { captionText, litBeat } from '../../lib/packs';
import { fmtRel, ts } from '../../lib/format';
import { live, useStudio } from './useStudio';

const lit: CSSProperties = { backgroundImage: 'var(--ul)', backgroundRepeat: 'no-repeat', backgroundSize: '100% .14em', backgroundPosition: '0 96%', WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', justifySelf: 'start' };

export function ScriptTab({ cur, idea }: { cur: Pack; idea: Idea | null }) {
  const k = litBeat(cur.beats, idea?.quietPart ?? '');
  return (
    <>
      <WriterNotes cur={cur} />
      <Hooks cur={cur} idea={idea} />
      {cur.beats.length ? (
        <ol id="beats" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
          {cur.beats.map((b, i) => (
            <li key={i} data-beat={i} data-lit={i === k ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr)', gap: 20, padding: '22px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ font: `400 11px/1.7 ${MONO}`, color: 'var(--faint)' }}>{b.t}</span>
              <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
                <p style={{ margin: 0, font: `${i === k ? 400 : 300} 21px/1.4 ${SERIF}`, color: i === k ? 'var(--ink)' : 'var(--dim)', textWrap: 'pretty', ...(i === k ? lit : null) }}>{b.vo}</p>
                {b.onscreen && <span style={{ font: `400 10.5px/1.5 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>On screen · {b.onscreen}</span>}
                {b.visual && <span style={{ font: `400 13.5px/1.5 ${SANS}`, color: 'var(--faint)' }}>{b.visual}</span>}
              </div>
            </li>
          ))}
        </ol>
      ) : <p style={{ margin: 0, font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>This pack has no script beats yet.</p>}
      <DesignFold cur={cur} />
      <CaptionWatch cur={cur} />
      <RateBox cur={cur} />
      <PromptBox cur={cur} />
    </>
  );
}

// ---------------------------------------------------------------- writer notes (story + critic)
const CRIT: [string, string][] = [['hook', 'Hook'], ['gap', 'Gap'], ['scene', 'Scene'], ['turn', 'Turn'], ['rhythm', 'Rhythm'], ['truth', 'Truth'], ['ending', 'Ending']];
const card: CSSProperties = { display: 'grid', gap: 14, alignContent: 'start', padding: 22, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--sf)', minWidth: 0 };

function WriterNotes({ cur }: { cur: Pack }) {
  const st = cur.story; const cr = cur.critic;
  const rows = st ? ([['Belief', st.belief], ['Truth', st.truth], ['Scene', st.scene], ['Turn', st.turn], ['Feeling', st.feeling]] as const).filter((r) => r[1]) : [];
  if (!rows.length && !cr) return null;
  return (
    <div id="writer-notes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px), 1fr))', gap: 16 }}>
      {rows.length > 0 && (
        <section id="wn-story" style={card} aria-label="Story">
          <Label>Story</Label>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: '10px 14px' }}>
            {rows.map(([k, v]) => [<dt key={`${k}t`} style={{ ...labelStyle, fontSize: 10, lineHeight: 1.9 }}>{k}</dt>, <dd key={`${k}d`} style={{ margin: 0, font: `400 16px/1.45 ${SERIF}` }}>{v}</dd>])}
          </dl>
        </section>
      )}
      {cr && (
        <section id="wn-critic" style={card} aria-label="Critic">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <Label>Critic</Label>
            <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>{cr.total == null ? '—' : cr.total}/35{cr.predictedOwnerScore != null ? ` · predicts you'd rate it ${cr.predictedOwnerScore}` : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(58px,1fr))', gap: 12, padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            {CRIT.map(([k, l]) => {
              const v = cr.scores[k];
              return (
                <div key={k} style={{ display: 'grid', gap: 8 }}>
                  <span style={{ font: `400 9.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>{l}</span>
                  <span style={{ font: `300 24px/1 ${SERIF}` }}>{v == null ? '—' : v}</span>
                  <span role="img" aria-label={`${l} ${v ?? 'not scored'} out of 5`} style={{ display: 'block', height: 2, background: 'var(--line2)' }}><span style={{ display: 'block', height: 2, width: `${Math.max(0, Math.min(5, v ?? 0)) * 20}%`, background: 'var(--ink)' }} /></span>
                </div>
              );
            })}
          </div>
          {cr.notes && <p style={{ margin: 0, whiteSpace: 'pre-wrap', font: `400 15px/1.55 ${SERIF}`, color: 'var(--dim)' }}>{cr.notes}</p>}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- hooks
function Hooks({ cur, idea }: { cur: Pack; idea: Idea | null }) {
  const S = useStudio();
  const b0 = cur.beats[0];
  const inUse = (b0?.vo ?? '').trim();
  const busy = S.busy.has(`pack:${cur.ideaCode}`);
  const job = S.jobs.find((j) => j.node === 'writer' && j.kind === 'hooks' && j.ideaCode === cur.ideaCode);
  const active = !!job && live(job);
  if (!cur.hooks.length) {
    return (
      <section id="hooks-sec" aria-labelledby="hooks-h" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px 18px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <Label id="hooks-h">Hooks</Label>
            <span style={{ font: `italic 400 16px/1.3 ${SERIF}`, color: 'var(--dim)' }}>One opening line so far. The Writer can draft three more to choose from.</span>
          </div>
          <Btn id="hooks-get" h={32} disabled={active || !idea || !b0 || S.busy.has(`hooks:${cur.ideaCode}`)}
            onClick={() => void S.queue(`hooks:${cur.ideaCode}`, { node: 'writer', kind: 'hooks', ideaCode: cur.ideaCode, packId: cur.id, request: 'Write 3 hook options for the opening beat' })}
            style={{ padding: '0 14px', font: `400 12.5px/1 ${SANS}` }}>{active ? 'Writer is on it…' : 'Get 3 hook options'}</Btn>
        </div>
        {job && <JobRow id="hooks-job" node="writer" note={job.request} status={job.status} at={job.createdAt} error={job.error} />}
      </section>
    );
  }
  return (
    <section id="hooks-sec" aria-labelledby="hooks-h" style={{ display: 'grid', gap: 14 }}>
      <Label id="hooks-h">Hooks</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,260px), 1fr))', gap: 16 }}>
        {cur.hooks.slice(0, 3).map((h, k) => {
          const on = h.vo.trim() === inUse;
          return (
            <article key={k} id={`hook-${k}`} data-in-use={on ? 'true' : undefined} style={{ ...card, gap: 12, borderColor: on ? 'var(--line2)' : 'var(--line)' }}>
              <span style={{ justifySelf: 'start', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', border: '1px solid var(--line2)', borderRadius: 999, padding: '6px 10px' }}>{h.style.replace(/-/g, ' ')}</span>
              <p style={{ margin: 0, font: `400 20px/1.34 ${SERIF}`, textWrap: 'pretty' }}>{h.vo}</p>
              {h.onscreen && <span style={{ font: `400 10.5px/1.5 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>{h.onscreen}</span>}
              {h.why && <p style={{ margin: 0, font: `400 13.5px/1.5 ${SANS}`, color: 'var(--dim)' }}>{h.why}</p>}
              <div style={{ marginTop: 4 }}>
                {on ? <span id={`hook-inuse-${k}`} style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--grow)' }}>In use</span>
                  : <Btn id={`hook-use-${k}`} kind="ink" h={32} disabled={busy || !b0} style={{ padding: '0 14px', font: `500 12.5px/1 ${SANS}` }}
                    onClick={() => {
                      const beats = cur.beats.map((b, i) => (i ? b : { ...b, vo: h.vo, onscreen: h.onscreen }));
                      void S.saveVersion(cur, { beats, hooks: cur.hooks }, 'hook-swap', `Hook: ${h.style}`, { hookStyle: h.style }).then((id) => { if (id) S.open(id, 'script'); });
                    }}>Use this hook</Btn>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Claude Design prompt fold (Library chapter-row pattern)
function DesignFold({ cur }: { cur: Pack }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <button id="fold-prompt" type="button" aria-expanded={open} aria-controls="fold-prompt-body" onClick={() => setOpen(!open)}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 16, alignItems: 'baseline', width: '100%', padding: '22px 4px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)' }}>
        <span style={{ font: `400 20px/1.3 ${SERIF}` }}>Claude Design prompt</span>
        <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{cur.designPrompt.length} characters</span>
        <span aria-hidden="true" style={{ font: `400 16px/1 ${MONO}`, color: 'var(--dim)', width: 16, textAlign: 'center' }}>{open ? '–' : '+'}</span>
      </button>
      {open && <pre id="fold-prompt-body" style={{ margin: 0, padding: '0 4px 28px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: `400 12px/1.6 ${MONO}`, color: 'var(--dim)' }}>{cur.designPrompt || 'No design prompt in this pack.'}</pre>}
    </div>
  );
}

// ---------------------------------------------------------------- caption + watch-outs
function CaptionWatch({ cur }: { cur: Pack }) {
  const [copied, copy] = useCopied();
  const cover = cur.cover || cur.beats[0]?.onscreen || '';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32 }}>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Label>Caption</Label>
          <button id="copy-caption" type="button" onClick={() => copy('cap', captionText(cover, cur.caption), 'Cover and caption')} className="qp-hv-ink"
            style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>{copied === 'cap' ? 'Copied' : 'Copy caption'}</button>
        </div>
        <p id="pack-caption" style={{ margin: 0, padding: '20px 22px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--sf)', font: `400 16px/1.55 ${SERIF}`, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>{cur.caption || 'No caption in this pack.'}</p>
      </div>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <Label>Watch-outs</Label>
        {cur.watchouts.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {cur.watchouts.map((w, k) => <li key={k} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 10, font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}><span style={{ color: 'var(--caution)' }}>!</span><span>{w}</span></li>)}
          </ul>
        ) : <p style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--faint)' }}>None noted.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rating (ratings/{packId}); every fifth rating queues Taste
function RateBox({ cur }: { cur: Pack }) {
  const S = useStudio();
  const store = useStore();
  const toast = useToast();
  const ex = S.ratings.find((r) => r.packId === cur.id) ?? null;
  const [score, setScore] = useState<number | null>(ex?.score ?? null);
  const [note, setNote] = useState(ex?.note ?? '');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) { setScore(ex?.score ?? null); setNote(ex?.note ?? ''); } }, [ex?.at, cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDirty(false); }, [cur.id]);
  const key = `rate:${cur.id}`;
  const save = () => {
    if (!score) return;
    const data = { packId: cur.id, ideaCode: cur.ideaCode, version: cur.version, score, note: note.trim().slice(0, 200), at: new Date().toISOString() };
    void S.run(key, async () => {
      if (ex) await store.replace('ratings', cur.id, data); else await store.set('ratings', cur.id, data);
      setDirty(false);
      const n = S.ratings.filter((r) => r.packId !== cur.id).length + 1;
      if (n % 5 === 0 && !S.jobs.some((j) => j.node === 'taste' && live(j))) {
        await queueJob(store, { node: 'taste', request: 'Update taste profile' });
        void store.adapter.fireWorker();
        toast('Saved. Updating your taste profile.');
      } else toast('Rating saved');
    });
  };
  return (
    <section id="rate-box" aria-labelledby="rate-h" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 16 }}>
        <Label id="rate-h">Rate this script</Label>
        {ex && <span id="rate-state" style={{ font: `400 11px/1 ${MONO}`, color: 'var(--dim)' }}>Rated {ex.score}/10 · {fmtRel(ex.at)}</span>}
      </div>
      <div role="group" aria-label="Score, 1 to 10" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} id={`rate-${n}`} type="button" aria-pressed={score === n} onClick={() => { setScore(n); setDirty(true); }} style={monoChip(score === n, { minWidth: 40 })}>{n}</button>
        ))}
      </div>
      <PromptPill id="rate-note" label="Rating note" value={note} maxLength={200} placeholder="What worked, or didn't?" send={S.busy.has(key) ? 'Saving…' : 'Save rating'}
        onChange={(v) => { setNote(v); setDirty(true); }} onSend={save} disabled={!score || S.busy.has(key)} />
    </section>
  );
}

// ---------------------------------------------------------------- prompt box: both lanes become Writer jobs on Vercel
type Lane = 'edit' | 'research';
function PromptBox({ cur }: { cur: Pack }) {
  const S = useStudio();
  const toast = useToast();
  const [text, setText] = useState('');
  const [lane, setLane] = useState<Lane>('edit');
  const jobs = useMemo(() => S.jobs.filter((j) => j.node === 'writer' && j.ideaCode === cur.ideaCode && !!j.packId && (j.kind === 'edit' || !j.kind)), [S.jobs, cur.ideaCode]);
  const job = jobs[0] ?? null;
  const pending = !!job && live(job);
  const newer = job && job.status === 'done'
    ? (S.packsByIdea.get(cur.ideaCode) ?? []).find((p) => p.id !== job.packId && ts(p.createdAt) >= ts(job.createdAt)) ?? null : null;
  const key = `prompt:${cur.ideaCode}`;
  const send = () => {
    const req = text.trim().slice(0, 2000);
    if (!req) { toast('Describe the change first'); document.getElementById('prompt-input')?.focus(); return; }
    void S.queue(key, { node: 'writer', ideaCode: cur.ideaCode, packId: cur.id, request: req, lane: lane === 'edit' ? 'quick' : 'deep', ...(lane === 'edit' ? { kind: 'edit' } : {}) }).then((ok) => { if (ok) setText(''); });
  };
  return (
    <section id="prompt-panel" aria-label="Ask Claude to change this pack" style={{ display: 'grid', gap: 12 }}>
      <PromptPill id="prompt-input" label="Change request" value={text} onChange={setText} onSend={send} placeholder="Ask Claude to change this pack: tighten beat 3, softer close…"
        disabled={pending} busy={S.busy.has(key)} send="Send" />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingLeft: 8 }}>
        <Seg<Lane> label="How should the Writer handle it" options={[['edit', 'Quick edit'], ['research', 'Needs research']]} value={lane} onChange={setLane} />
        <span id="prompt-note" style={{ font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--dim)' }}>
          {pending ? 'A Writer job for this pack is already queued.' : lane === 'edit' ? 'The Writer changes only what you ask, from the idea card.' : 'The Writer goes back to the book or the web first.'}
        </span>
      </div>
      {job && (
        <JobRow id="deep-card" node={job.kind === 'edit' ? 'edit' : 'writer'} note={job.request} status={job.status} at={job.createdAt} error={job.error}
          extra={newer ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span id="deep-ready" style={{ font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--grow)' }}>New version v{newer.version} ready</span><Btn id="deep-open" h={32} style={{ padding: '0 14px', font: `400 12.5px/1 ${SANS}` }} onClick={() => S.open(newer.id, 'script')}>Open v{newer.version}</Btn></div> : undefined} />
      )}
    </section>
  );
}
