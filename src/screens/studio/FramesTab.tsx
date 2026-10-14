import { useState, type CSSProperties } from 'react';
import { useSignedUrl } from '../../data/files';
import type { Frame, Pack } from '../../data/types';
import { MONO, SANS } from '../../design/fonts';
import { Btn, JobRow, Label, Overlay, PromptPill, useCopied } from '../../design/kit';
import { framesByBeat } from '../../lib/packs';
import { live, useStudio } from './useStudio';

export const hatch = (bg = 'var(--sf)'): CSSProperties => ({ background: `repeating-linear-gradient(135deg, var(--ghost) 0 1px, transparent 1px 9px), ${bg}` });
const tile: CSSProperties = { aspectRatio: '9/16', display: 'grid', placeItems: 'center', padding: 12, border: '1px solid var(--line2)', borderRadius: 12, ...hatch(), font: `400 10px/1.4 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', textAlign: 'center', overflow: 'hidden', position: 'relative' };

/** One tile per beat (placeholders where the Art Director hasn't drawn yet), real frames from pack.frames, overlay viewer. */
export function FramesTab({ cur }: { cur: Pack }) {
  const S = useStudio();
  const [req, setReq] = useState('');
  const [view, setView] = useState<number | null>(null);
  const { perBeat, extra } = framesByBeat(cur.beats, cur.frames);
  const all: (Frame & { label: string })[] = [
    ...perBeat.map((f, i) => (f ? { ...f, label: `Frame ${String(i + 1).padStart(2, '0')} · ${cur.beats[i]!.t}` } : null)).filter((x): x is Frame & { label: string } => !!x),
    ...extra.map((f, i) => ({ ...f, label: f.t ? `Frame · ${f.t}` : `Extra frame ${i + 1}` })),
  ];
  const job = S.jobs.find((j) => j.node === 'art' && j.packId === cur.id) ?? null;
  const active = !!job && live(job);
  const key = `art:${cur.id}`;
  const make = () => {
    const bt = req.trim();
    void S.queue(key, { node: 'art', ideaCode: cur.ideaCode, packId: cur.id, request: bt ? `Make reference frames for beats: ${bt}` : 'Make reference frames for all beats' }).then((ok) => { if (ok) setReq(''); });
  };
  const open = (f: Frame) => setView(all.findIndex((x) => x.path === f.path && x.t === f.t));
  return (
    <>
      <div id="frames-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '24px 18px' }}>
        {cur.beats.map((b, i) => {
          const f = perBeat[i];
          return (
            <figure key={i} data-frame-tile={i} style={{ margin: 0, display: 'grid', gap: 10, alignContent: 'start' }}>
              {f ? <FrameThumb f={f} label={`Frame ${String(i + 1).padStart(2, '0')}`} t={b.t} onOpen={() => open(f)} id={`frame-${i}`} />
                : <div style={tile}>Frame {String(i + 1).padStart(2, '0')}<br />{b.t}</div>}
              <figcaption style={{ font: `400 12.5px/1.45 ${SANS}`, color: 'var(--dim)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f?.note || b.visual || b.onscreen}</figcaption>
            </figure>
          );
        })}
        {extra.map((f, i) => (
          <figure key={`x${i}`} style={{ margin: 0, display: 'grid', gap: 10, alignContent: 'start' }}>
            <FrameThumb f={f} label="Frame" t={f.t} onOpen={() => open(f)} id={`frame-x${i}`} />
            <figcaption style={{ font: `400 12.5px/1.45 ${SANS}`, color: 'var(--dim)' }}>{f.note}</figcaption>
          </figure>
        ))}
      </div>
      <section aria-labelledby="frames-h" style={{ display: 'grid', gap: 12 }}>
        <Label id="frames-h">Reference frames</Label>
        <PromptPill id="frames-beats" label="Which beats" value={req} onChange={setReq} onSend={make} maxLength={120} placeholder="Which beats? Leave empty for all (e.g. 0:00, 0:22)"
          send={active ? 'Queued…' : 'Make frames'} disabled={active} busy={S.busy.has(key)} />
        {job && <JobRow id="frames-job" node="art" note={job.request} status={job.status} at={job.createdAt} error={job.error} />}
      </section>
      {view != null && all[view] && <FrameView f={all[view]!} onClose={() => setView(null)} />}
    </>
  );
}

function FrameThumb({ f, label, t, onOpen, id }: { f: Frame; label: string; t: string; onOpen: () => void; id: string }) {
  const url = useSignedUrl(f.path);
  return (
    <button id={id} type="button" onClick={onOpen} aria-label={`View ${label.toLowerCase()} at ${t} larger`} className="qp-hv-soft" style={{ ...tile, padding: 0, cursor: 'pointer', color: 'var(--faint)' }}>
      {url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span>{url === null ? 'Loading…' : 'Image missing'}<br />{t}</span>}
    </button>
  );
}

function FrameView({ f, onClose }: { f: Frame & { label: string }; onClose: () => void }) {
  const url = useSignedUrl(f.path);
  const [copied, copy] = useCopied();
  return (
    <Overlay id="frov" title={`Reference frame · ${f.label}`} onClose={onClose}>
      <div style={{ ...tile, aspectRatio: '9/16', maxHeight: '62vh', justifySelf: 'center', width: 'auto', padding: 0 }}>
        {url ? <img id="frov-img" src={url} alt={`Reference frame ${f.label}`} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span>No image</span>}
      </div>
      <p id="frov-note" style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}>{f.note || 'No note for this frame.'}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn id="frov-copy" disabled={!f.note} onClick={() => copy('n', f.note, 'Frame note')}>{copied === 'n' ? 'Copied' : 'Copy note'}</Btn>
        {url && /^https:\/\//i.test(url) && <a href={url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'center', font: `400 13px/1 ${SANS}` }}>Open full size</a>}
      </div>
    </Overlay>
  );
}
