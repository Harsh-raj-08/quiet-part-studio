export const str = (v: unknown): string => (v == null ? '' : String(v));
export const numOr = (v: unknown, d: number): number => {
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const NW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** Number as a word up to twenty (the design's WORDS table), digits beyond. */
export function nw(n: number, cap = false): string {
  const w = n >= 0 && n <= 20 ? NW[n]! : String(n);
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

export const ts = (s: string): number => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };

/** "Sunday 11 October" (eyebrow). */
export function longDate(d: Date = new Date()): string {
  const L = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', o);
  return `${L({ weekday: 'long' })} ${d.getDate()} ${L({ month: 'long' })}`;
}

export function isToday(t: string, now: Date = new Date()): boolean {
  const d = new Date(Date.parse(t));
  if (!Number.isFinite(+d)) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** "3 Oct", or "3 Oct 2025" when the year differs from now. */
export function fmtDay(s: string, now: Date = new Date()): string {
  if (!s) return '';
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return str(s);
  const d = new Date(t);
  const o: Intl.DateTimeFormatOptions = d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-GB', o);
}

export function fmtRel(s: string, now: number = Date.now()): string {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return '';
  const d = (now - t) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return fmtDay(s);
}

/** Compact view counts: 950, 1.2k, 12.4k, 31.0k, 120k, 1.4M. */
export function compactViews(v: number): string {
  const n = Math.round(v);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e5) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

/** kfmt as used by the Insights headline (drops a trailing .0). */
export function kfmt(v: number): string {
  const n = Math.round(v);
  return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e5 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

/** "pp. 97–104", "p. 5", "§1". */
export function pgs(p: string): string {
  const s = str(p).trim();
  if (!s) return '';
  if (!/^\d/.test(s)) return s;
  return (/[-,;–—&]/.test(s) ? 'pp. ' : 'p. ') + s;
}

export function fmtSize(n: number): string {
  if (!(n > 0)) return '';
  if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Card source line: the title without a leading article ("The Psychology of Money" -> "Psychology of Money"). */
export const shortBookTitle = (t: string): string => str(t).replace(/^(the|a|an)\s+/i, '');

const STOP = /^(the|a|an|of|to|be|and|in|on|for|is|are|why|how)$/i;
export function initials(t: string): string {
  const w = str(t).match(/[A-Za-z]+/g) ?? [];
  let k = w.filter((x) => !STOP.test(x));
  if (!k.length) k = w;
  let c = k.map((x) => x[0]).join('').toUpperCase().slice(0, 3);
  if (c.length < 2 && k[0]) c = k[0].slice(0, 2).toUpperCase();
  return /^[A-Z]{2,3}$/.test(c) ? c : '';
}

export const slugOf = (t: string): string => str(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
