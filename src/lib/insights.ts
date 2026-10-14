// Insights rules (old studio + SPEC5, adjusted for 3c): KPIs, the 7-day expectation, What works grouping.
import type { Account, Book, Idea, Metric, Pack, Snap } from '../data/types';
import { compactViews, kfmt, ts } from './format';

export interface PostRow { idea: Idea; metric: Metric | null; latest: Snap | null; postedAt: number }
const D = 864e5;

/** Posted ideas, newest first (by posted date, then code). */
export function postedRows(ideas: Idea[], metrics: Metric[]): PostRow[] {
  const by = new Map(metrics.map((m) => [m.ideaCode, m]));
  return ideas.filter((i) => i.status === 'Posted').map((idea) => {
    const metric = by.get(idea.code) ?? null;
    return { idea, metric, latest: metric?.latest ?? null, postedAt: ts(idea.posted?.date ?? '') || ts(metric?.postedAt ?? '') };
  }).sort((a, b) => b.postedAt - a.postedAt || a.idea.code.localeCompare(b.idea.code));
}

export const median = (v: number[]): number | null => {
  const s = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};

/** A reel's day-7 views: the snapshot taken on day 7 (or the closest of days 6–8). */
export function day7Views(m: Metric | null): number | null {
  if (!m) return null;
  const c = m.snapshots.filter((s) => s.day != null && s.day >= 6 && s.day <= 8 && s.views != null).sort((a, b) => Math.abs(a.day! - 7) - Math.abs(b.day! - 7));
  return c[0]?.views ?? null;
}

export interface Expectation { value: number | null; kind: '7-day' | 'median' }
/**
 * The dashed tick: the median of earlier reels' day-7 views once there are 3 or more of them,
 * else the median of all reels' latest views.
 */
export function expectations(rows: PostRow[]): Map<string, Expectation> {
  const all = median(rows.map((r) => r.latest?.views ?? NaN).filter((x) => Number.isFinite(x)) as number[]);
  const out = new Map<string, Expectation>();
  for (const r of rows) {
    const earlier = rows.filter((x) => x.postedAt && r.postedAt && x.postedAt < r.postedAt).map((x) => day7Views(x.metric)).filter((v): v is number => v != null);
    out.set(r.idea.code, earlier.length >= 3 ? { value: median(earlier), kind: '7-day' } : { value: all, kind: 'median' });
  }
  return out;
}

export interface Kpi { key: string; label: string; value: string; delta: string; tone: 'up' | 'down' | '' }
const pct = (c: number | null, p: number | null) => (c == null || p == null || !(p > 0) ? null : Math.round(((c - p) / p) * 100));
const sgn = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
const tone = (v: number | null): Kpi['tone'] => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
const fmtN = (v: number) => Math.round(v).toLocaleString('en-US');

/** Followers on a date: the last account snapshot at or before it. */
function followersAt(acct: Account[], t: number): number | null {
  let v: number | null = null;
  for (const a of acct) { if (ts(a.at) <= t && a.followers != null) v = a.followers; }
  return v;
}

export function kpis(rows: PostRow[], account: Account[], now: number): Kpi[] {
  const withStats = rows.filter((r) => r.latest && r.postedAt);
  const cur = withStats.filter((r) => now - r.postedAt <= 30 * D);
  const pri = withStats.filter((r) => now - r.postedAt > 30 * D && now - r.postedAt <= 60 * D);
  const sum = (a: PostRow[], k: keyof Snap) => { const v = a.map((r) => r.latest![k] as number | null).filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) : null; };
  const avg = (a: PostRow[], k: keyof Snap) => { const v = a.map((r) => r.latest![k] as number | null).filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const vc = sum(cur, 'views'); const vp = sum(pri, 'views');
  const sc = sum(cur, 'shares'); const sp = sum(pri, 'shares');
  const wc = avg(cur, 'watchThroughPct'); const wp = avg(pri, 'watchThroughPct');
  const dv = pct(vc, vp); const ds = pct(sc, sp); const dw = wc != null && wp != null ? Math.round(wc - wp) : null;
  const out: Kpi[] = [
    { key: 'views', label: 'Views', value: vc == null ? '—' : kfmt(vc), delta: dv == null ? '—' : `${sgn(dv)}${Math.abs(dv)}% vs prior 30 days`, tone: tone(dv) },
    { key: 'watch', label: 'Avg. watch', value: wc == null ? '—' : `${Math.round(wc)}%`, delta: dw == null ? '—' : `${sgn(dw)}${Math.abs(dw)} pt${Math.abs(dw) === 1 ? '' : 's'}`, tone: tone(dw) },
    { key: 'sends', label: 'Sends', value: sc == null ? '—' : fmtN(sc), delta: ds == null ? '—' : `${sgn(ds)}${Math.abs(ds)}%`, tone: tone(ds) },
  ];
  // Followers come from profile screenshots (account snapshots); until there are two, show follows from reels.
  const fNow = followersAt(account, now); const f30 = followersAt(account, now - 30 * D); const f60 = followersAt(account, now - 60 * D);
  if (fNow != null && f30 != null && account.length >= 2) {
    const gain = fNow - f30; const prior = f60 != null ? f30 - f60 : null; const d = pct(gain, prior);
    out.push({ key: 'followers', label: 'Followers', value: `${sgn(gain)}${fmtN(Math.abs(gain))}`, delta: d == null ? `${fmtN(fNow)} total` : `${sgn(d)}${Math.abs(d)}% vs prior`, tone: tone(d) });
  } else {
    const fc = sum(cur, 'follows'); const fp = sum(pri, 'follows'); const df = pct(fc, fp);
    out.push({ key: 'followers', label: 'Follows from reels', value: fc == null ? '—' : `+${fmtN(fc)}`, delta: df == null ? '—' : `${sgn(df)}${Math.abs(df)}% vs prior`, tone: tone(df) });
  }
  return out;
}

export { compactViews };

// ---------------------------------------------------------------- What works
export const HOOK_LABEL: Record<string, string> = { 'myth-bust': 'Myth fix', number: 'Surprise fact', contrarian: 'Reframe', question: 'Question', story: 'Story', 'direct-you': 'Direct' };
export const GROUPS = [['evidence', 'Evidence'], ['book', 'Book'], ['hook', 'Hook type'], ['format', 'Format'], ['length', 'Length'], ['weekday', 'Weekday']] as const;
export type GroupKey = (typeof GROUPS)[number][0];
export const METRICS = [['sends', 'Sends'], ['watch', 'Avg watch %'], ['save', 'Save rate'], ['share', 'Share rate'], ['follow', 'Follows per 1k reach']] as const;
export type MetricKey = (typeof METRICS)[number][0];

const fmtKind = (f: string) => f.trim().split(/[\s·,(—-]+/)[0] ?? '';
export function reelLen(i: Idea, pack: Pack | null): number | null {
  if (pack && pack.durationSec > 0) return pack.durationSec;
  const m = i.format.match(/(\d+)\s*s\b/i);
  return m ? +m[1]! : null;
}
export function groupOf(i: Idea, k: GroupKey, books: Map<string, Book>, pack: Pack | null): string {
  if (k === 'evidence') return i.evidence ? i.evidence[0] + i.evidence.slice(1).toLowerCase() : '(none)';
  if (k === 'book') { const b = books.get(i.bookId); return b ? b.code || b.title : '(none)'; }
  if (k === 'hook') return HOOK_LABEL[i.hookStyle] ?? (i.hookStyle || '(none)');
  if (k === 'format') return fmtKind(i.format) || '(none)';
  if (k === 'length') { const l = reelLen(i, pack); return l == null ? 'Unknown' : l < 45 ? '<45 s' : l <= 60 ? '45–60 s' : l <= 75 ? '60–75 s' : '>75 s'; }
  const t = Date.parse(i.posted?.date ?? '');
  return Number.isFinite(t) ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t).getUTCDay()]! : 'Unknown';
}
export function metricOf(l: Snap, k: MetricKey, len: number | null): number | null {
  const reach = l.reach != null && l.reach > 0 ? l.reach : l.views != null && l.views > 0 ? l.views : null;
  if (k === 'sends') return l.shares;
  if (k === 'watch') return l.watchThroughPct != null ? l.watchThroughPct : l.avgWatchSec != null && len ? (l.avgWatchSec / len) * 100 : null;
  if (k === 'save') return l.saves != null && reach ? (l.saves / reach) * 100 : null;
  if (k === 'share') return l.shares != null && reach ? (l.shares / reach) * 100 : null;
  return l.follows != null && reach ? (l.follows / reach) * 1000 : null;
}
export const fmtMetric = (k: MetricKey, v: number | null) => (v == null ? '–' : k === 'sends' ? Math.round(v).toLocaleString('en-US') : k === 'follow' ? v.toFixed(1) : `${v.toFixed(1)}%`);

export interface WorkGroup { name: string; views: number | null; value: number | null; n: number }
/** Average views and the chosen metric per group, sorted by the metric (the design sorts by sends). */
export function workGroups(rows: { idea: Idea; latest: Snap; pack: Pack | null }[], g: GroupKey, m: MetricKey, books: Map<string, Book>): WorkGroup[] {
  const map = new Map<string, { v: number[]; x: number[]; n: number }>();
  for (const r of rows) {
    const name = groupOf(r.idea, g, books, r.pack);
    const e = map.get(name) ?? { v: [], x: [], n: 0 };
    e.n++;
    if (r.latest.views != null) e.v.push(r.latest.views);
    const x = metricOf(r.latest, m, reelLen(r.idea, r.pack));
    if (x != null && Number.isFinite(x)) e.x.push(x);
    map.set(name, e);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return Array.from(map, ([name, e]) => ({ name, views: avg(e.v), value: avg(e.x), n: e.n }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name));
}
