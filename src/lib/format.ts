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

/**
 * Every date the studio shows is in the viewer's local zone. A date-only string ("2026-10-09", a posted day or
 * "week of") means that calendar day locally, so it parses as local midnight, not UTC midnight.
 */
export function parseWhen(s: string): number {
  const v = str(s).trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!).getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : NaN;
}
export const ts = (s: string): number => { const t = parseWhen(s); return Number.isFinite(t) ? t : 0; };
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** Whole local calendar days from `a` to `b`. */
export const dayDiff = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000);
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sunday 11 October" (eyebrow). */
export function longDate(d: Date = new Date()): string {
  const L = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', o);
  return `${L({ weekday: 'long' })} ${d.getDate()} ${L({ month: 'long' })}`;
}

export function isToday(t: string, now: Date = new Date()): boolean {
  const d = new Date(parseWhen(t));
  if (!Number.isFinite(+d)) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** "3 Oct", or "3 Oct 2025" when the year differs from now. */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "8 Oct", or "8 Oct 2025" in another year (three-letter months: "Sep", not "Sept"). */
export function fmtDay(s: string, now: Date = new Date()): string {
  if (!s) return '';
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return str(s);
  const d = new Date(t);
  const base = `${d.getDate()} ${MON[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
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

/** "today, 09:12" / "yesterday, 18:40" / "8 Oct", in the viewer's local time. */
export function fmtWhen(s: string, now: Date = new Date()): string {
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const diff = dayDiff(d, now);
  const hm = hhmm(d);
  if (diff === 0) return `today, ${hm}`;
  if (diff === 1) return `yesterday, ${hm}`;
  return fmtDay(s, now);
}

/** Chat list dates as designed: "Today, 10:42" / "Yesterday" / "7 Oct". */
export function fmtChatWhen(s: string, now: Date = new Date()): string {
  const w = fmtWhen(s, now);
  if (w.startsWith('today')) return `T${w.slice(1)}`;
  if (w.startsWith('yesterday')) return 'Yesterday';
  return w;
}
/** "2026-10-05" -> "5 October". */
export function dayMonth(s: string): string {
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return str(s);
  const d = new Date(t);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
}
/** "6 Oct 2026". */
export function dayMonYear(s: string): string {
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return str(s);
  const d = new Date(t);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
/** The System table's "when": now (running), 09:14 (today), Mon 06:00 (this week), else 7 Oct. Local time. */
export function whenText(iso: string, running: boolean, now: number): string {
  if (running) return 'now';
  const t = parseWhen(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const diff = dayDiff(d, new Date(now));
  if (diff <= 0) return hhmm(d);
  if (diff < 7) return `${DAYS[d.getDay()]} ${hhmm(d)}`;
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
/** "8 Oct" for a timestamp (ms), local. */
export const shortDay = (t: number) => (t ? `${new Date(t).getDate()} ${MON[new Date(t).getMonth()]}` : '–');

const clock12 = (d: Date) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
/** Under 24 h: "just now" / "12 min ago" / "2 h ago". */
export function fmtAgo(s: string, now: number = Date.now()): string {
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, (now - t) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  return `${Math.floor(d / 3600)} h ago`;
}
/** Local date and time as "15 Oct, 1:32 pm" (the year is added when it is not this year). Under 24 h it reads "2 h ago" instead. */
export function fmtStamp(s: string, now: number = Date.now(), relative = true): string {
  const t = parseWhen(s);
  if (!Number.isFinite(t)) return '';
  if (relative && now - t >= 0 && now - t < 86400000) return fmtAgo(s, now);
  return `${fmtDay(s, new Date(now))}, ${clock12(new Date(t))}`;
}
/** The same instant without the relative form: "15 Oct, 1:32 pm" (for tooltips). */
export const fmtStampFull = (s: string, now: number = Date.now()): string => fmtStamp(s, now, false);
