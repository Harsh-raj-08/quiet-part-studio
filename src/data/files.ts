import { useEffect, useState } from 'react';
import { useStore } from './store';

/** Signed URLs last an hour (the adapter asks for 3600 s); reuse one for 50 minutes. */
const TTL = 50 * 60 * 1000;
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();

/**
 * Storage path -> URL to show. Returns null while loading, '' when there is nothing to show.
 * Files are always referenced by path; a URL is never stored.
 */
export function useSignedUrl(path: string | null | undefined): string | null {
  const store = useStore();
  const key = path || '';
  const hit = key ? cache.get(key) : undefined;
  const [url, setUrl] = useState<string | null>(key ? (hit && hit.exp > Date.now() ? hit.url : null) : '');
  useEffect(() => {
    if (!key) { setUrl(''); return; }
    const c = cache.get(key);
    if (c && c.exp > Date.now()) { setUrl(c.url); return; }
    let live = true;
    setUrl(null);
    let p = inflight.get(key);
    if (!p) {
      p = store.adapter.signedUrl(key).then((u) => { const safe = /^(https:|blob:|data:image\/)/i.test(u) ? u : ''; cache.set(key, { url: safe, exp: Date.now() + TTL }); return safe; })
        .catch(() => '').finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    p.then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [key, store]);
  return url;
}
