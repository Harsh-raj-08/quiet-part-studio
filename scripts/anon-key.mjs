// The browser bundle may only ever carry a public key: a publishable key (sb_publishable_…) or a legacy JWT whose role is "anon".
// A service-role or secret key here would give every visitor full database access, so the build refuses it.
export function isPublicAnonKey(key) {
  if (typeof key !== 'string' || !key) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return !!payload && payload.role === 'anon';
  } catch { return false; }
}
