// Shared pieces for the Studio and Library screens, ported from the design's inline styles
// (StudioScreen.dc.html, LibraryScreen.dc.html, SystemScreen.dc.html).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MONO, SANS, SERIF } from './fonts';
import { fmtRel } from '../lib/format';

/** Mono section label: 10.5/1, .16em, caps, faint. */
export const labelStyle: CSSProperties = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
export function Label({ children, id, style }: { children: ReactNode; id?: string; style?: CSSProperties }) {
  return <span id={id} style={{ ...labelStyle, ...style }}>{children}</span>;
}

/** Sub-tab segmented pill (h32, Sans 13), as in the Studio and Library designs. */
export function subPill(on: boolean): CSSProperties {
  return { height: 32, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', font: `400 13px/1 ${SANS}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)', whiteSpace: 'nowrap' };
}
export function SubTabs<T extends string>({ tabs, value, onChange, label, idPrefix }: { tabs: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string; idPrefix: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'inline-flex', padding: 3, border: '1px solid var(--line2)', borderRadius: 999 }}>
      {tabs.map(([k, l]) => (
        <button key={k} id={`${idPrefix}-${k}`} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} style={subPill(value === k)}>{l}</button>
      ))}
    </div>
  );
}

/** Mono chip (h32, 500 11, .1em): pack codes, book codes, ratings, versions. */
export function monoChip(on: boolean, extra?: CSSProperties): CSSProperties {
  return { height: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer', font: `500 11px/1 ${MONO}`, letterSpacing: '.1em', border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)', whiteSpace: 'nowrap', ...extra };
}

type BtnKind = 'outline' | 'ink' | 'quiet';
/** The design's larger buttons: outlined h40 (Sans 13) and ink h40 (500 13). */
export function bigBtn(kind: BtnKind, h = 40, disabled = false): CSSProperties {
  const base: CSSProperties = { height: h, padding: kind === 'ink' ? '0 20px' : '0 18px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', font: `${kind === 'ink' ? 500 : 400} 13px/1 ${SANS}` };
  const k: CSSProperties = kind === 'ink' ? { border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--on-ink)' }
    : kind === 'outline' ? { border: '1px solid var(--line2)', background: 'transparent', color: 'var(--ink)' }
      : { border: '1px solid transparent', background: 'transparent', color: 'var(--dim)' };
  return { ...base, ...k, ...(disabled ? { opacity: 0.45 } : null) };
}
export function Btn({ kind = 'outline', h = 40, children, style, disabled, ...rest }: { kind?: BtnKind; h?: number; children: ReactNode; style?: CSSProperties; disabled?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children'>) {
  return (
    <button type="button" disabled={disabled} className={kind === 'ink' ? 'qp-hv-op88' : kind === 'outline' ? 'qp-hv-line-faint' : 'qp-hv-ink'} style={{ ...bigBtn(kind, h, disabled), ...style }} {...rest}>{children}</button>
  );
}

/** The indeterminate lilac line (running jobs). */
export function LiveLine({ style }: { style?: CSSProperties }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 2, background: 'var(--line2)', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: '40%', background: 'var(--lilac)', boxShadow: '0 0 12px var(--lilac)', animation: 'qpRun 1.8s cubic-bezier(.4,0,.2,1) infinite' }} />
    </div>
  );
}

/** The design's empty state: dashed line2, Newsreader italic. */
export function Empty({ title, children, action, id, pad = 40 }: { title: string; children?: ReactNode; action?: ReactNode; id?: string; pad?: number }) {
  return (
    <div id={id} data-empty style={{ display: 'grid', gap: 10, justifyItems: 'start', padding: pad, border: '1px dashed var(--line2)', borderRadius: 16 }}>
      <p style={{ margin: 0, font: `italic 400 22px/1.3 ${SERIF}` }}>{title}</p>
      {children && <p style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}>{children}</p>}
      {action && <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{action}</div>}
    </div>
  );
}

const ST_COLOR: Record<string, string> = { running: 'var(--lilac)', done: 'var(--grow)', failed: 'var(--caution)', queued: 'var(--calm)' };
/** Status pill from the System table. */
export function statusStyle(s: string): CSSProperties {
  const c = ST_COLOR[s] ?? 'var(--dim)';
  return { justifySelf: 'start', font: `500 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: c, border: `1px ${s === 'queued' ? 'dashed' : 'solid'} ${c}`, borderRadius: 999, padding: '6px 10px', boxShadow: s === 'running' ? '0 0 14px -4px var(--lilac)' : 'none', whiteSpace: 'nowrap' };
}
/** A job as a System table row: node · note · status · when, with the live line while it runs. */
export function JobRow({ id, node, note, status, at, error, extra }: { id?: string; node: string; note: string; status: string; at: string; error?: string; extra?: ReactNode }) {
  const s = status || 'queued';
  return (
    <div id={id} data-job={s} style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '16px 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 16, alignItems: 'center' }}>
        <span style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase' }}>{node}</span>
        <span style={{ font: `400 14px/1.45 ${SANS}`, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note}>{note}</span>
        <span role="status" style={statusStyle(s)}>{s}</span>
        <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{at ? fmtRel(at) : ''}</span>
      </div>
      {(s === 'running' || s === 'queued') && <LiveLine />}
      {error && <p role="alert" style={{ margin: 0, font: `400 13px/1.5 ${SANS}`, color: 'var(--caution)' }}>{error}</p>}
      {extra}
    </div>
  );
}

/** Text input styled as the design's pill input (r999, line2, sf) with an ink button at the end. */
export function PromptPill({ id, value, onChange, onSend, placeholder, send = 'Send', disabled, busy, label, maxLength = 2000, inputProps }: {
  id: string; value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; send?: string; disabled?: boolean; busy?: boolean; label: string; maxLength?: number;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div className="qp-search" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 8px 8px 22px', border: '1px solid var(--line2)', borderRadius: 999, background: 'var(--sf)' }}>
      <label htmlFor={id} className="qp-sr">{label}</label>
      <input id={id} type="text" className="qp-search-input" value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled && !busy) { e.preventDefault(); onSend(); } }}
        style={{ flex: 1, minWidth: 0, height: 40, border: 0, background: 'transparent', outline: 'none', font: `400 14px/1 ${SANS}`, color: 'var(--ink)' }} {...inputProps} />
      <button id={`${id}-send`} type="button" disabled={disabled || busy} onClick={onSend} className="qp-hv-op88"
        style={{ height: 40, padding: '0 20px', borderRadius: 999, border: 0, background: 'var(--ink)', cursor: disabled || busy ? 'default' : 'pointer', font: `500 13px/1 ${SANS}`, color: 'var(--on-ink)', whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1 }}>{busy ? 'Sending…' : send}</button>
    </div>
  );
}

// ---------------------------------------------------------------- clipboard
// Copy inside the click handler; when the browser refuses, show the text pre-selected so it can be copied by hand.
let fallback: { label: string; text: string } | null = null;
const fbSubs = new Set<() => void>();
const setFallback = (v: typeof fallback) => { fallback = v; fbSubs.forEach((f) => f()); };

export async function copyText(text: string, label: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    setFallback({ label, text });
    return false;
  }
}

/** A copy button that relabels to "Copied" for 1.6 s, as in the design. */
export function useCopied(): [string, (key: string, text: string, label: string) => void] {
  const [copied, setCopied] = useState('');
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  const copy = useCallback((key: string, text: string, label: string) => {
    void copyText(text, label).then((ok) => {
      if (!ok) return;
      setCopied(key);
      clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(''), 1600);
    });
  }, []);
  return [copied, copy];
}

export function CopyFallback() {
  const v = useSyncExternalStore((cb) => { fbSubs.add(cb); return () => { fbSubs.delete(cb); }; }, () => fallback, () => null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (v) { ta.current?.focus(); ta.current?.select(); } }, [v]);
  useEffect(() => {
    if (!v) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setFallback(null); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [v]);
  if (!v) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="copy-fb-h" id="copy-fallback" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.35)' }} onClick={() => setFallback(null)}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, calc(100vw - 32px))', display: 'grid', gap: 16, padding: 28, background: 'var(--sf)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 24px 60px -20px var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span id="copy-fb-h" style={labelStyle}>Copy {fallback?.label}</span>
          <Btn h={32} onClick={() => setFallback(null)}>Close</Btn>
        </div>
        <p style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--dim)' }}>The browser blocked the clipboard. The text is selected: press ⌘C or Ctrl+C.</p>
        <textarea ref={ta} id="copy-fb-text" readOnly value={v.text} rows={10} style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--ink)', font: `400 12px/1.6 ${MONO}`, resize: 'vertical' }} />
      </div>
    </div>,
    document.body,
  );
}

/** A centred overlay panel (drawer styling), closed with Escape or the close button; focus returns to the opener. */
export function Overlay({ title, onClose, children, id }: { title: string; onClose: () => void; children: ReactNode; id: string }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', on);
    return () => { document.removeEventListener('keydown', on); prev?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div id={id} role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', display: 'grid', gap: 16, padding: 24, background: 'var(--sf)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 24px 60px -20px var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={labelStyle}>{title}</span>
          <button ref={close} id={`${id}-close`} type="button" aria-label="Close" onClick={onClose} className="qp-hv-close" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', font: `400 16px/1 ${SANS}` }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
