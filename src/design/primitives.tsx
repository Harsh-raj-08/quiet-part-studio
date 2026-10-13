import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { MONO, PEN, SANS, SERIF } from './fonts';

/** the qu[ı + lilac seed dot]et part */
export function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', flex: 'none', font: `300 26px/1 ${SERIF}`, letterSpacing: '-.02em', color: 'var(--ink)' }}>
      <span>the qu</span>
      <span style={{ position: 'relative' }}>ı<span style={{ position: 'absolute', left: '50%', top: '.02em', width: '.17em', height: '.17em', marginLeft: '-.085em', borderRadius: '50%', background: 'var(--lilac)', boxShadow: '0 0 14px var(--lilac)' }} /></span>
      <span>et part</span>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ font: `400 11px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 22 }}>{children}</div>;
}

export const litStyle: CSSProperties = {
  color: 'var(--ink)', backgroundImage: 'var(--ul)', backgroundRepeat: 'no-repeat', backgroundSize: '100% .14em', backgroundPosition: '0 96%',
  WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', paddingBottom: '.04em',
};

/** Two-part headline: ghost text, then the lit part with the hand-drawn lilac underline. */
export function Headline({ ghost, lit, maxCh = 21 }: { ghost: string; lit: string; maxCh?: number }) {
  return (
    <h1 style={{ margin: 0, maxWidth: `${maxCh}ch`, font: `300 clamp(38px, 4.4vw, 60px)/1.06 ${SERIF}`, letterSpacing: '-.028em', textWrap: 'balance' }}>
      <span style={{ color: 'var(--faint)' }}>{ghost}</span>{' '}
      <span style={lit ? litStyle : undefined}>{lit}</span>
    </h1>
  );
}

export function MarginNote({ children }: { children: ReactNode }) {
  return <div style={{ paddingBottom: 10, font: `400 26px/1 ${PEN}`, color: 'var(--dim)', transform: 'rotate(-3deg)', whiteSpace: 'nowrap' }}>{children}</div>;
}

export function Hairline({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'var(--line)', ...style }} />;
}

// ---------------------------------------------------------------- pills
export type PillKind = 'primary' | 'soft' | 'quiet';
const BS: Record<PillKind, CSSProperties> = {
  primary: { border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--on-ink)' },
  soft: { border: '1px solid var(--line2)', background: 'transparent', color: 'var(--ink)' },
  quiet: { border: '1px solid transparent', background: 'transparent', color: 'var(--dim)' },
};
/** Card action pill: h28, padding 0 12, Sans 12 (500 for primary), hover opacity .8. */
export function pillStyle(kind: PillKind): CSSProperties {
  return { height: 28, padding: '0 12px', borderRadius: 999, cursor: 'pointer', font: `${kind === 'primary' ? 500 : 400} 12px/1 ${SANS}`, whiteSpace: 'nowrap', ...BS[kind] };
}
export function Pill({ kind = 'soft', children, style, disabled, ...rest }: { kind?: PillKind; children: ReactNode; style?: CSSProperties; disabled?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children'>) {
  return (
    <button type="button" disabled={disabled} className="qp-hv-op8" style={{ ...pillStyle(kind), ...(disabled ? { opacity: 0.45, cursor: 'default' } : null), ...style }} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- stamp
export function evColor(ev: string): string {
  return ({ SUPPORTED: 'var(--grow)', MIXED: 'var(--grow)', MYTH: 'var(--caution)', STORY: 'var(--calm)', PHILOSOPHY: 'var(--dim)', CHECK: 'var(--faint)' } as Record<string, string>)[ev] || 'var(--dim)';
}
/** Evidence stamp. Tilted: +2deg on even cards, -2.5deg on odd. Flat: a rounded tag. */
export function stampStyle(ev: string, i: number, flat: boolean): CSSProperties {
  const c = evColor(ev);
  const dashed = ev === 'MIXED' || ev === 'CHECK';
  return {
    flex: 'none', display: 'inline-block', font: `500 9.5px/1 ${MONO}`, letterSpacing: '.16em', color: c, border: `1.5px ${dashed ? 'dashed' : 'solid'} ${c}`,
    padding: flat ? '5px 9px' : '5px 7px 4px', borderRadius: flat ? 999 : 3, transform: flat ? 'none' : `rotate(${i % 2 ? '-2.5deg' : '2deg'})`, whiteSpace: 'nowrap',
  };
}
export function Stamp({ ev, index = 0, flat = false, style }: { ev: string; index?: number; flat?: boolean; style?: CSSProperties }) {
  if (!ev) return null;
  return <span data-stamp={ev} style={{ ...stampStyle(ev, index, flat), ...style }}>{ev}</span>;
}

// ---------------------------------------------------------------- segmented control
export function segPill(on: boolean): CSSProperties {
  return { height: 30, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)', transition: 'background .2s, color .2s' };
}
export function Seg<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 3, border: '1px solid var(--line2)', borderRadius: 999 }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} style={segPill(value === v)}>{l}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- chip (book filter)
export function Chip({ label, n, on, mono, title, onClick }: { label: string; n?: number; on: boolean; mono?: boolean; title?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} title={title} onClick={onClick} className="qp-hv-line-faint"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: mono ? `500 11px/1 ${MONO}` : `400 13px/1 ${SANS}`, letterSpacing: mono ? '.1em' : 0, border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)' }}>
      {label}
      {n != null && <span style={{ font: `400 10.5px/1 ${MONO}`, opacity: 0.6 }}>{n}</span>}
    </button>
  );
}

export function StatusDot({ on = true }: { on?: boolean }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? 'var(--grow)' : 'var(--faint)', animation: on ? 'qpPulse 2.4s ease-in-out infinite' : 'none', flex: 'none' }} />;
}

// ---------------------------------------------------------------- toast
interface ToastApi { toast: (msg: string, err?: boolean) => void }
const ToastCtx = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx).toast;

/** Toasts are an ink pill, bottom centre. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; err: boolean; k: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, err = false) => {
    setT({ msg, err, k: Date.now() + Math.random() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), err ? 5000 : 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 28, zIndex: 70, pointerEvents: 'none' }}>
        {t && (
          <div key={t.k} data-toast={t.err ? 'error' : 'info'} style={{ position: 'absolute', left: 0, bottom: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap', maxWidth: 'min(92vw, 560px)', overflow: 'hidden', textOverflow: 'ellipsis', padding: '13px 20px', borderRadius: 999, background: t.err ? 'var(--caution)' : 'var(--ink)', color: t.err ? '#FFF6F2' : 'var(--on-ink)', font: `400 11px/1 ${MONO}`, letterSpacing: '.06em', boxShadow: '0 18px 50px -20px var(--shadow)', animation: 'qpToast .22s ease-out' }}>
            {t.msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
