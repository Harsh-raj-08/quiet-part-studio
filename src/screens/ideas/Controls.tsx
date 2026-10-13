import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MEDIA, type MediaKind } from '../../data/actions';
import { MONO, SANS } from '../../design/fonts';
import { Pill, type PillKind } from '../../design/primitives';
import { todayISO } from '../../lib/format';
import { useOps, type Origin, type Pending } from './ops';

/** A pill that opens the file picker. The input itself is visually hidden but present (tests and assistive tech can reach it). */
export function UploadButton({ idea, kind, kindStyle = 'soft', label, large }: { idea: { id: string; code: string }; kind: MediaKind; kindStyle?: PillKind; label?: string; large?: boolean }) {
  const ops = useOps();
  const ref = useRef<HTMLInputElement>(null);
  const busy = ops.uploading.has(`${kind}:${idea.code}`);
  const target = ops.ideas.find((i) => i.id === idea.id);
  const big: CSSProperties = large ? { height: 42, padding: '0 20px', font: `400 13.5px/1 ${SANS}` } : {};
  return (
    <>
      <input ref={ref} type="file" tabIndex={-1} className="qp-sr" accept={MEDIA[kind].accept} data-upload={`${kind}-${idea.code}`} aria-label={`${MEDIA[kind].btn} for ${idea.code}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (target) void ops.upload(target, kind, f); }} />
      <Pill kind={kindStyle} disabled={busy} data-action={`upload-${kind}`} style={big} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : label ?? MEDIA[kind].btn}</Pill>
    </>
  );
}

const label: CSSProperties = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
const text: CSSProperties = { margin: 0, font: `400 13px/1.5 ${SANS}`, color: 'var(--dim)' };

function Btn({ kind, children, onClick, disabled, action, large }: { kind: PillKind; children: string; onClick: () => void; disabled?: boolean; action: string; large: boolean }) {
  return (
    <Pill kind={kind} disabled={disabled} data-action={action} style={large ? { height: 42, padding: kind === 'primary' ? '0 22px' : '0 18px', font: `${kind === 'primary' ? 500 : 400} 13.5px/1 ${SANS}` } : undefined} onClick={onClick}>{children}</Pill>
  );
}

/** The inline question that follows a move needing more input: a file, a date and link, or a reason. */
export function MovePrompt({ pending, variant }: { pending: Pending; variant: 'column' | 'card' | 'drawer' }) {
  const ops = useOps();
  const idea = ops.ideas.find((i) => i.id === pending.id);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayISO());
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const large = variant === 'drawer';

  useEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('input[type=text],input[type=date],button');
    el?.focus({ preventScroll: true });
  }, [pending.need, pending.id]);

  if (!idea) return null;
  const wrap: CSSProperties =
    variant === 'column' ? { border: '1px solid var(--line2)', borderRadius: 14, background: 'var(--sf)', padding: '18px 20px', display: 'grid', gap: 12 }
      : variant === 'card' ? { display: 'grid', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }
        : { display: 'grid', gap: 12, width: '100%' };
  const fieldStyle: CSSProperties = variant === 'drawer' ? {} : { height: 36, fontSize: 13 };
  const save = async (fn: () => Promise<unknown>) => { setSaving(true); try { await fn(); } finally { setSaving(false); } };
  const onEsc = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); ops.cancelPending(); } };

  const head = <div style={label}>{pending.need === 'drop' ? 'Drop' : `Move to ${pending.to}`} · {idea.code}</div>;
  let body;
  if (pending.need === 'voice' || pending.need === 'video') {
    const kind: MediaKind = pending.need;
    body = (
      <>
        <p style={text}>{kind === 'voice' ? 'No voiceover on file yet.' : 'No video on file yet.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <UploadButton idea={idea} kind={kind} kindStyle={large ? 'primary' : 'soft'} large={large} label={kind === 'voice' ? 'Upload voiceover' : 'Upload video'} />
          <Btn large={large} kind="quiet" action="without-file" disabled={saving || ops.uploading.has(`${kind}:${idea.code}`)} onClick={() => void save(ops.confirmWithoutFile)}>{kind === 'voice' ? 'Mark voiced without file' : 'Mark produced without file'}</Btn>
          <Btn large={large} kind="quiet" action="cancel" onClick={ops.cancelPending}>Cancel</Btn>
        </div>
      </>
    );
  } else if (pending.need === 'post') {
    const submit = () => void save(async () => { const e = await ops.confirmPost(date, link); setErr(e ?? ''); });
    body = (
      <>
        <label style={label} htmlFor={`post-date-${idea.id}`}>Posted on</label>
        <input id={`post-date-${idea.id}`} className="qp-field" type="date" value={date} style={fieldStyle} onChange={(e) => setDate(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <label style={label} htmlFor={`post-link-${idea.id}`}>Link (optional, https only)</label>
        <input id={`post-link-${idea.id}`} className="qp-field" type="text" inputMode="url" placeholder="https://www.instagram.com/…" value={link} style={fieldStyle} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        {err && <p role="alert" style={{ ...text, color: 'var(--caution)' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn large={large} kind="primary" action="confirm" disabled={saving} onClick={submit}>Mark posted</Btn>
          <Btn large={large} kind="quiet" action="cancel" onClick={ops.cancelPending}>Cancel</Btn>
        </div>
      </>
    );
  } else {
    const submit = () => void save(async () => { await ops.confirmDrop(reason); });
    body = (
      <>
        <label style={label} htmlFor={`drop-reason-${idea.id}`}>Why drop it? (optional)</label>
        <input id={`drop-reason-${idea.id}`} className="qp-field" type="text" maxLength={240} placeholder="Weak evidence, off-brand, done elsewhere…" value={reason} style={fieldStyle} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn large={large} kind="primary" action="confirm" disabled={saving} onClick={submit}>Drop idea</Btn>
          <Btn large={large} kind="quiet" action="cancel" onClick={ops.cancelPending}>Cancel</Btn>
        </div>
      </>
    );
  }
  return (
    <div ref={root} data-prompt={pending.need} data-prompt-origin={pending.origin satisfies Origin} role="group" aria-label={`Move ${idea.code} to ${pending.to}`} onKeyDown={onEsc} onClick={(e) => e.stopPropagation()} style={wrap}>
      {head}
      {body}
    </div>
  );
}
