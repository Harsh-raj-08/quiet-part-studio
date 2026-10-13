import { useState, useSyncExternalStore, type FormEvent } from 'react';
import type { Adapter, AuthState } from '../data/adapter';
import { MONO, SANS, SERIF } from '../design/fonts';
import { Eyebrow, Wordmark } from '../design/primitives';

export function useAuth(adapter: Adapter): AuthState {
  return useSyncExternalStore((cb) => adapter.onAuth(cb), () => adapter.auth(), () => adapter.auth());
}

const wrap = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 24px', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS } as const;

/** Magic-link sign-in in the design's language: wordmark, one email field, "Send link". */
export function Login({ adapter }: { adapter: Adapter }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    const r = await adapter.signInWithEmail(email.trim());
    if (r.ok) setState('sent'); else { setState('error'); setErr(r.error ?? 'Could not send the link.'); }
  };
  return (
    <div style={wrap}>
      <form onSubmit={submit} style={{ width: 'min(420px, 100%)', display: 'grid', gap: 28 }}>
        <Wordmark />
        <div>
          <Eyebrow>Studio · Sign in</Eyebrow>
          <h1 style={{ margin: 0, font: `300 34px/1.14 ${SERIF}`, letterSpacing: '-.022em' }}>
            <span style={{ color: 'var(--faint)' }}>Only the owner gets in. </span>
            <span style={{ color: 'var(--ink)' }}>One link, no password.</span>
          </h1>
        </div>
        {state === 'sent' ? (
          <p role="status" style={{ margin: 0, font: `italic 400 18px/1.5 ${SERIF}`, color: 'var(--dim)' }}>Check your email. The link signs you in on this device.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <label htmlFor="login-email" style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Email</label>
            <input id="login-email" className="qp-field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={state === 'sending'} style={{ height: 42, padding: '0 22px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--on-ink)', cursor: 'pointer', font: `500 13.5px/1 ${SANS}`, justifySelf: 'start' }}>{state === 'sending' ? 'Sending…' : 'Send link'}</button>
            {state === 'error' && <p role="alert" style={{ margin: 0, font: `400 13px/1.4 ${SANS}`, color: 'var(--caution)' }}>{err}</p>}
          </div>
        )}
      </form>
    </div>
  );
}

export function NotOwner({ adapter, email }: { adapter: Adapter; email: string }) {
  return (
    <div style={wrap}>
      <div style={{ width: 'min(460px, 100%)', display: 'grid', gap: 22 }}>
        <Wordmark />
        <p role="alert" style={{ margin: 0, font: `italic 400 22px/1.4 ${SERIF}` }}>Signed in, but this account isn’t the studio owner.</p>
        <p style={{ margin: 0, font: `400 13.5px/1.55 ${SANS}`, color: 'var(--dim)' }}>{email} has no row in studio_owner yet. See docs/SETUP.md for the one SQL line.</p>
        <button type="button" onClick={() => void adapter.signOut()} style={{ height: 42, padding: '0 18px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', font: `400 13.5px/1 ${SANS}`, justifySelf: 'start' }}>Sign out</button>
      </div>
    </div>
  );
}
