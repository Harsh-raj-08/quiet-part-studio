import { useState, useSyncExternalStore, type FormEvent } from 'react';
import type { Adapter, AuthResult, AuthState } from '../data/adapter';
import { MONO, SANS, SERIF } from '../design/fonts';
import { Eyebrow, Wordmark } from '../design/primitives';

export function useAuth(adapter: Adapter): AuthState {
  return useSyncExternalStore((cb) => adapter.onAuth(cb), () => adapter.auth(), () => adapter.auth());
}

const wrap = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 24px', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS } as const;

type Kind = NonNullable<AuthResult['kind']>;
/** Friendly text for a failed auth call. Provider error text is never shown. */
export function authMessage(kind: Kind | undefined, what: 'password' | 'link' | 'change'): string {
  switch (kind) {
    case 'invalid': return "That email and password don't match.";
    case 'rate': return 'Too many sign-in emails were sent in the last hour. Use your password, or try the link again in an hour.';
    case 'network': return "Can't reach the studio. Check your connection.";
    case 'weak': return 'Choose a stronger password: longer, with a mix of letters and numbers.';
    case 'same': return 'That is already your password. Pick a new one.';
    default: return what === 'link' ? "Couldn't send the link. Try again in a moment." : what === 'change' ? "Couldn't update the password. Try again in a moment." : "Couldn't sign you in. Try again in a moment.";
  }
}

const label = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' } as const;
const primary = { height: 42, padding: '0 22px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--on-ink)', cursor: 'pointer', font: `500 13.5px/1 ${SANS}`, justifySelf: 'start' } as const;
const secondary = { background: 'none', border: 0, padding: 0, cursor: 'pointer', font: `400 13px/1.4 ${SANS}`, color: 'var(--dim)', textDecoration: 'underline', textUnderlineOffset: 3, justifySelf: 'start' } as const;

/** Sign-in in the design's language: wordmark, email and password, with the emailed link as the alternative. */
export function Login({ adapter }: { adapter: Adapter }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const fail = (kind: Kind | undefined, what: 'password' | 'link') => { setState('error'); setErr(authMessage(kind, what)); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || state === 'sending') return;
    setState('sending');
    const r = await adapter.signInWithPassword(email.trim(), password);
    if (!r.ok) fail(r.kind, 'password'); // on success the app swaps this screen out
  };
  const link = async () => {
    if (!email.trim() || state === 'sending') { setState('error'); setErr('Enter your email first.'); return; }
    setState('sending');
    const r = await adapter.signInWithEmail(email.trim());
    if (r.ok) setState('sent'); else fail(r.kind, 'link');
  };
  return (
    <div style={wrap}>
      <form onSubmit={(e) => void submit(e)} style={{ width: 'min(420px, 100%)', display: 'grid', gap: 28 }}>
        <Wordmark />
        <div>
          <Eyebrow>Studio · Sign in</Eyebrow>
          <h1 style={{ margin: 0, font: `300 34px/1.14 ${SERIF}`, letterSpacing: '-.022em' }}>
            <span style={{ color: 'var(--faint)' }}>Only the owner gets in. </span>
            <span style={{ color: 'var(--ink)' }}>Use your password or a link.</span>
          </h1>
        </div>
        {state === 'sent' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <p role="status" style={{ margin: 0, font: `italic 400 18px/1.5 ${SERIF}`, color: 'var(--dim)' }}>Check your email. The link signs you in on this device.</p>
            <button type="button" id="login-back" onClick={() => setState('idle')} style={secondary}>Use a password instead</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <label htmlFor="login-email" style={label}>Email</label>
            <input id="login-email" className="qp-field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="login-password" style={{ ...label, marginTop: 4 }}>Password</label>
            <input id="login-password" className="qp-field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" id="login-submit" disabled={state === 'sending'} style={{ ...primary, marginTop: 6 }}>{state === 'sending' ? 'Signing in…' : 'Sign in with password'}</button>
            <button type="button" id="login-link" disabled={state === 'sending'} onClick={() => void link()} style={secondary}>Email me a sign-in link instead</button>
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
        <button type="button" id="signout" onClick={() => void adapter.signOut()} style={{ height: 42, padding: '0 18px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', font: `400 13.5px/1 ${SANS}`, justifySelf: 'start' }}>Sign out</button>
      </div>
    </div>
  );
}
