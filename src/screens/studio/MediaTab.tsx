import { useRef, useState, type CSSProperties } from 'react';
import { MEDIA, type MediaKind } from '../../data/actions';
import { useSignedUrl } from '../../data/files';
import type { Idea, Pack, QaRec } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, Empty, JobRow, Label, Overlay } from '../../design/kit';
import { fmtDur, parseT } from '../../lib/packs';
import { fmtSize, fmtWhen } from '../../lib/format';
import { hatch } from './FramesTab';
import { live, useStudio } from './useStudio';

const minus = (n: number, d = 1) => (n < 0 ? `−${Math.abs(n).toFixed(d)}` : n.toFixed(d));
const GLYPH = { pass: '✓', warn: '!', fail: '✕' } as const;
const GCOL = { pass: 'var(--grow)', warn: 'var(--caution)', fail: 'var(--caution)' } as const;
const GNAME = { pass: 'Pass', warn: 'Warning', fail: 'Fail' } as const;

export function verdictStyle(v: string): CSSProperties {
  const c = v === 'GO' ? 'var(--grow)' : v ? 'var(--caution)' : 'var(--dim)';
  return { flex: 'none', font: `500 18px/1 ${MONO}`, letterSpacing: '.18em', color: c, border: `2px solid ${c}`, borderRadius: 4, padding: '10px 14px 9px', transform: 'rotate(-3deg)' };
}

/** Hidden file input + the button that opens it. */
function UploadBtn({ idea, kind, label, h = 40, kindStyle = 'outline' as const }: { idea: Idea; kind: MediaKind; label: string; h?: number; kindStyle?: 'outline' | 'ink' }) {
  const S = useStudio();
  const ref = useRef<HTMLInputElement>(null);
  const busy = S.busy.has(`upload:${kind}:${idea.code}`);
  return (
    <>
      <input ref={ref} id={`media-${kind}-file`} type="file" tabIndex={-1} className="qp-sr" accept={MEDIA[kind].accept} aria-label={`${label} for ${idea.code}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void S.uploadMedia(idea, kind, f); }} />
      <Btn id={`media-${kind}-upload`} kind={kindStyle} h={h} disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : label}</Btn>
    </>
  );
}

export function MediaTab({ cur, idea }: { cur: Pack; idea: Idea | null }) {
  const S = useStudio();
  const [sel, setSel] = useState<string>('');
  const [img, setImg] = useState<number | null>(null);
  const vref = useRef<HTMLVideoElement>(null);
  const videoUrl = useSignedUrl(idea?.videoAssetId || '');
  const voiceUrl = useSignedUrl(idea?.voiceAssetId || '');
  if (!idea) return <p style={{ margin: 0, font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>This pack's idea was not found.</p>;

  const list = S.qaByPack.get(cur.id) ?? S.qaByIdea.get(idea.code) ?? [];
  const q: QaRec | null = list.find((x) => x.id === sel) ?? list[0] ?? null;
  const job = S.jobs.find((j) => j.node === 'qa' && j.ideaCode === idea.code) ?? null;
  const active = !!job && live(job);
  const runKey = `qa:${idea.code}`;
  const runQa = () => void S.queue(runKey, { node: 'qa', ideaCode: idea.code, packId: cur.id, videoAssetId: idea.videoAssetId, request: 'Check before posting' });
  const seek = (sec: number) => {
    const v = vref.current;
    if (!v) return;
    try { if (Number.isFinite(v.duration) && v.duration > 0 && sec > v.duration) sec = Math.max(0, v.duration - 0.05); v.currentTime = sec; v.pause(); v.scrollIntoView({ block: 'nearest' }); } catch { /* not seekable yet */ }
  };

  const files = (
    <div id="media-files" style={{ display: 'grid', borderTop: '1px solid var(--line)' }}>
      {(['voice', 'video'] as const).map((k) => {
        const has = k === 'voice' ? idea.voiceAssetId : idea.videoAssetId;
        const name = k === 'voice' ? idea.voiceFileName : idea.videoFileName;
        const at = k === 'voice' ? idea.voiceUploadedAt : idea.videoUploadedAt;
        return (
          <div key={k} id={`file-${k}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <Label>{k === 'voice' ? 'Voiceover' : 'Video'}</Label>
              <span style={{ font: `400 13px/1.4 ${SANS}`, color: has ? 'var(--ink)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {has ? [name || 'file', k === 'video' && idea.videoSize > 0 ? fmtSize(idea.videoSize) : '', fmtWhen(at)].filter(Boolean).join(' · ') : 'None uploaded yet'}
              </span>
            </div>
            <UploadBtn idea={idea} kind={k} label={has ? 'Replace' : k === 'voice' ? 'Upload voice' : 'Upload video'} h={32} />
          </div>
        );
      })}
      {voiceUrl && <audio id="media-voice" controls preload="none" src={voiceUrl} style={{ width: '100%', marginTop: 12 }} />}
    </div>
  );

  if (!idea.videoAssetId && !list.length) {
    return (
      <>
        <Empty id="qa-empty" title="No edited video yet." action={<UploadBtn idea={idea} kind="video" label="Upload video" />}>
          Upload the export once it's cut. QA checks length, loudness, caption safe zones and the first second.
        </Empty>
        {files}
      </>
    );
  }

  const m = q?.meas;
  const meas: [string, string][] = [];
  if (m) {
    if (m.durationSec != null) meas.push(['Length', fmtDur(m.durationSec) || `${m.durationSec} s`]);
    if (m.lufs != null) meas.push(['Loudness', `${minus(m.lufs)} LUFS`]);
    if (m.safeZonePct != null) meas.push(['Safe zone', `${Math.round(m.safeZonePct)}%`]);
    if (m.firstWordSec != null) meas.push(['First word', `${m.firstWordSec} s`]);
  }
  const more = m ? [m.width && m.height ? `${m.width}×${m.height}` : '', m.fps ? `${Math.round(m.fps * 100) / 100} fps` : '', m.truePeak != null ? `true peak ${minus(m.truePeak)} dBTP` : '',
    m.silences.length ? `${m.silences.length} silence${m.silences.length > 1 ? 's' : ''}` : '', m.ssimLoop != null ? `loop SSIM ${m.ssimLoop.toFixed(3)}` : ''].filter(Boolean) : [];
  // Fixes merge into the check with the same timestamp; the rest become their own rows.
  const fixFor = new Map<string, string>();
  const loose: QaRec['fixes'] = [];
  q?.fixes.forEach((f) => { if (f.t && q.checks.some((c) => c.t === f.t) && !fixFor.has(f.t)) fixFor.set(f.t, f.fix || f.issue); else loose.push(f); });
  const stale = !!(q && q.videoAssetId && idea.videoAssetId && q.videoAssetId !== idea.videoAssetId);

  const Ts = ({ t, id }: { t: string; id: string }) => {
    const sec = parseT(t);
    const ok = sec != null && !!videoUrl;
    return <button id={id} type="button" disabled={!ok} title={ok ? `Jump to ${t} in the video` : undefined} onClick={() => sec != null && seek(sec)} className="qp-hv-soft"
      style={{ height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: ok ? 'pointer' : 'default', font: `400 11px/1 ${MONO}`, color: 'var(--ink)', opacity: ok ? 1 : 0.6 }}>{t}</button>;
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,220px), 1fr))', gap: 40, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {videoUrl ? (
            <video ref={vref} id="qa-video" controls playsInline preload="metadata" src={videoUrl} aria-label="Finished video"
              style={{ width: '100%', aspectRatio: '9/16', borderRadius: 14, border: '1px solid var(--line2)', background: '#0B0A09', objectFit: 'contain' }} />
          ) : (
            <div id="qa-video-ph" style={{ aspectRatio: '9/16', display: 'grid', placeItems: 'center', border: '1px solid var(--line2)', borderRadius: 14, ...hatch('#0B0A09'), font: `400 10px/1.4 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,222,.4)', textAlign: 'center' }}>
              <span>{idea.videoAssetId ? <>Edited video<br />{idea.videoFileName || 'video'}</> : 'No video uploaded'}</span>
            </div>
          )}
          {idea.videoUploadedAt && <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>Uploaded {fmtWhen(idea.videoUploadedAt)}</span>}
          {files}
        </div>
        <div id="qa-report" style={{ display: 'grid', gap: 32, minWidth: 0 }}>
          {q ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 22 }}>
              <span id="qa-verdict" data-verdict={q.verdict} style={verdictStyle(q.verdict)}>{q.verdict || '?'}</span>
              <p id="qa-summary" style={{ flex: '1 1 240px', margin: 0, font: `italic 400 20px/1.4 ${SERIF}`, textWrap: 'pretty', overflowWrap: 'anywhere' }}>{q.summary || `QA said ${q.verdict}.`}</p>
              {idea.videoAssetId && <Btn id="qa-run" kind="ink" h={38} disabled={active || S.busy.has(runKey)} onClick={runQa}>{active ? (job!.status === 'running' ? 'QA running…' : 'QA queued…') : list.length ? 'Run QA again' : 'Run QA'}</Btn>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 22 }}>
              <p style={{ flex: '1 1 240px', margin: 0, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>No QA report yet. Run QA and the verdict lands here.</p>
              {idea.videoAssetId && <Btn id="qa-run" kind="ink" h={38} disabled={active || S.busy.has(runKey)} onClick={runQa}>{active ? (job!.status === 'running' ? 'QA running…' : 'QA queued…') : list.length ? 'Run QA again' : 'Run QA'}</Btn>}
            </div>
          )}
          {(list.length > 1 || stale) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: -16 }}>
              {list.length > 1 && (
                <select id="qa-history" aria-label="QA report" value={q?.id} onChange={(e) => setSel(e.target.value)}
                  style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', cursor: 'pointer' }}>
                  {list.map((x, i) => <option key={x.id} value={x.id}>{`${x.verdict || '?'} · ${fmtWhen(x.at)}${i ? '' : ' (latest)'}`}</option>)}
                </select>
              )}
              {stale && <span id="qa-stale" style={{ font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--dim)' }}>This report checked an earlier upload.</span>}
            </div>
          )}
          {job && live(job) && <JobRow id="qa-job" node="qa" note={job.request} status={job.status} at={job.createdAt} error={job.error} />}
          {q && meas.length > 0 && (
            <div id="qa-meas" style={{ display: 'grid', gap: 12, padding: '20px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 16 }}>
                {meas.map(([k, v]) => <div key={k} style={{ display: 'grid', gap: 10 }}><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{k}</span><span style={{ font: `300 26px/1 ${SERIF}` }}>{v}</span></div>)}
              </div>
              {more.length > 0 && <span style={{ font: `400 11px/1.5 ${MONO}`, color: 'var(--faint)' }}>{more.join(' · ')}</span>}
            </div>
          )}
          {q && (q.checks.length > 0 || loose.length > 0) && (
            <ul id="qa-checks" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
              {q.checks.map((c, k) => (
                <li key={k} data-check={c.status} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline' }}>
                  <span role="img" aria-label={GNAME[c.status]} style={{ font: `500 13px/1.5 ${MONO}`, color: GCOL[c.status], textAlign: 'center' }}>{GLYPH[c.status]}</span>
                  <span style={{ display: 'grid', gap: 4 }}>
                    <span style={{ font: `400 14.5px/1.5 ${SANS}` }}>{c.name}</span>
                    {c.detail && <span style={{ font: `400 13px/1.5 ${SANS}`, color: 'var(--dim)' }}>{c.detail}</span>}
                    {c.t && fixFor.get(c.t) && <span style={{ font: `400 13px/1.5 ${SANS}`, color: 'var(--dim)' }}><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginRight: 8 }}>Fix</span>{fixFor.get(c.t)}</span>}
                  </span>
                  {c.t ? <Ts t={c.t} id={`qa-ts-${k}`} /> : <span />}
                </li>
              ))}
              {loose.map((f, k) => (
                <li key={`f${k}`} data-fix style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 12, alignItems: 'baseline' }}>
                  <span aria-hidden="true" style={{ font: `500 13px/1.5 ${MONO}`, color: 'var(--caution)', textAlign: 'center' }}>→</span>
                  <span style={{ display: 'grid', gap: 4 }}>
                    <span style={{ font: `400 14.5px/1.5 ${SANS}` }}>{f.issue || 'Fix'}</span>
                    {f.fix && <span style={{ font: `400 13px/1.5 ${SANS}`, color: 'var(--dim)' }}><span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginRight: 8 }}>Fix</span>{f.fix}</span>}
                  </span>
                  {f.t ? <Ts t={f.t} id={`qa-fix-${k}`} /> : <span />}
                </li>
              ))}
            </ul>
          )}
          {q && q.images.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <Label>Frames from the check</Label>
              <div id="qa-images" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 14 }}>
                {q.images.map((f, k) => <QaImg key={k} k={k} path={f.path} label={f.label} onOpen={() => setImg(k)} />)}
              </div>
            </div>
          )}
        </div>
      </div>
      {img != null && q?.images[img] && <QaImgView path={q.images[img]!.path} label={q.images[img]!.label} onClose={() => setImg(null)} />}
    </>
  );
}

const tile: CSSProperties = { aspectRatio: '9/16', display: 'grid', placeItems: 'center', border: '1px solid var(--line2)', borderRadius: 12, ...hatch(), overflow: 'hidden', position: 'relative', padding: 0, cursor: 'pointer', font: `400 10px/1.4 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
function QaImg({ path, label, k, onOpen }: { path: string; label: string; k: number; onOpen: () => void }) {
  const url = useSignedUrl(path);
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 8 }}>
      <button id={`qaimg-${k}`} type="button" onClick={onOpen} aria-label={`View ${label || `image ${k + 1}`} larger`} className="qp-hv-soft" style={tile}>
        {url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{url === null ? '…' : 'No image'}</span>}
      </button>
      <figcaption style={{ font: `400 10px/1.4 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</figcaption>
    </figure>
  );
}
function QaImgView({ path, label, onClose }: { path: string; label: string; onClose: () => void }) {
  const url = useSignedUrl(path);
  return (
    <Overlay id="frov" title={`QA image · ${label}`} onClose={onClose}>
      <div style={{ ...tile, cursor: 'default', maxHeight: '62vh', justifySelf: 'center' }}>
        {url ? <img src={url} alt={label} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span>No image</span>}
      </div>
    </Overlay>
  );
}
