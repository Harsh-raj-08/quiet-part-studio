import type { Book, Idea, Job, Metric, Report } from '../data/types';
import { isToday, kfmt, longDate, nw, slugOf, str } from './format';

export type TabId = 'discover' | 'library' | 'ideas' | 'studio' | 'insights' | 'system';

export interface Headline { eb: string; g: string; l: string; note: string }

export interface HeadlineData {
  loading: (name: string) => boolean;
  ideas: Idea[];
  books: Book[];
  jobs: Job[];
  runs: { id: string; status: string; jobId: string; finishedAt: string; at: string }[];
  metrics: Metric[];
  reports: Report[];
  ratings: number;
  now?: Date;
}

/** Ideas whose next step is the owner's: Idea (approve), Scripted (voice), Voiced (video), QA passed (post), Produced once QA has spoken. */
const WAIT: Record<string, 1> = { Idea: 1, Scripted: 1, Voiced: 1, 'QA passed': 1 };
export const waitingOn = (i: Pick<Idea, 'status' | 'qaLast'>): boolean => !!WAIT[i.status] || (i.status === 'Produced' && !!i.qaLast);

const LD: Record<TabId, string> = { discover: 'reports', library: 'books', ideas: 'ideas', studio: 'ideas', insights: 'metrics', system: 'jobs' };
const EB_LOADING: Record<TabId, string> = { discover: '01 · Discover', library: '02 · Library', ideas: '03 · Ideas', studio: '04 · Studio', insights: '05 · Insights', system: 'System' };

export function latestScout(reports: Report[]): Report | undefined {
  return reports.filter((r) => r.type === 'scout').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))[0];
}
export const scoutCandidates = (r: Report | undefined): Record<string, unknown>[] =>
  r && Array.isArray(r.d.candidates) ? (r.d.candidates as Record<string, unknown>[]).filter((c) => c && typeof c === 'object' && slugOf(str(c.title))) : [];

export function newCandidates(reports: Report[], books: Book[]): number {
  const have = new Set(books.map((b) => slugOf(b.title)));
  return scoutCandidates(latestScout(reports)).filter((c) => !have.has(slugOf(str(c.title)))).length;
}

/** Hero text per screen: eyebrow, ghost part, lit part, margin note. Same templates as the current studio. */
export function headlines(t: TabId, D: HeadlineData): Headline {
  const o: Headline = { eb: '', g: '', l: '', note: '' };
  const now = D.now ?? new Date();
  if (D.loading(LD[t])) { o.eb = EB_LOADING[t]; o.g = 'Loading…'; return o; }

  if (t === 'discover') {
    const sc = latestScout(D.reports);
    const c = scoutCandidates(sc);
    const have = new Set(D.books.map((b) => slugOf(b.title)));
    const k = c.filter((x) => !have.has(slugOf(str(x.title)))).length;
    o.eb = '01 · Discover · Scout';
    if (!sc || !c.length) { o.g = sc ? 'Scout found no candidates this week.' : "Scout hasn't run yet."; o.l = 'Ask it something below.'; }
    else {
      o.g = `Scout found ${nw(c.length)}${c.length > 1 ? ' candidates' : ' candidate'} this week.`;
      o.l = k ? `${nw(k, true)}${k > 1 ? " aren't" : " isn't"} on the shelf yet.` : 'All of them are on the shelf.';
    }
  } else if (t === 'library') {
    const nb = D.books.length;
    const nr = D.books.filter((b) => !b.notesCount).length;
    o.eb = '02 · Library · The shelf the ideas come from';
    if (!nb) { o.g = 'The shelf is empty.'; o.l = 'Add a book to begin.'; }
    else {
      o.g = `${nw(nb, true)}${nb > 1 ? ' books' : ' book'} on the shelf.`;
      o.l = nr ? `${nw(nr, true)}${nr > 1 ? ' still need' : ' still needs'} research.` : 'All of them are researched.';
    }
  } else if (t === 'ideas') {
    const a = D.ideas.filter((i) => i.status !== 'Dropped' && i.status !== 'Posted');
    const nbk = new Set(a.map((i) => i.bookId || i.fromBook)).size;
    const w = a.filter(waitingOn).length;
    o.eb = `03 · Ideas · ${longDate(now)}`;
    o.g = a.length ? `${nw(a.length, true)}${a.length > 1 ? ' ideas' : ' idea'} in motion across ${nw(nbk)}${nbk > 1 ? ' books.' : ' book.'}` : 'No ideas in motion yet.';
    o.l = w ? `${nw(w, true)}${w > 1 ? ' are' : ' is'} waiting on you.` : 'Nothing is waiting on you.';
    if (D.ideas.some((i) => i.status === 'Idea')) o.note = '← start with the top scorer';
  } else if (t === 'studio') {
    const np = D.ideas.filter((i) => ['Scripted', 'Voiced', 'Produced', 'QA passed'].includes(i.status)).length;
    const nq = D.ideas.filter((i) => i.status === 'QA passed').length;
    o.eb = '04 · Studio · Production packs';
    o.g = np ? `${nw(np, true)}${np > 1 ? ' packs' : ' pack'} in production.` : 'No packs in production.';
    o.l = nq ? `${nw(nq, true)}${nq > 1 ? ' are' : ' is'} ready to post.` : 'None are ready to post yet.';
  } else if (t === 'insights') {
    const ms = D.metrics.filter((m) => m.latest);
    const vw = ms.reduce((x, m) => x + (m.latest?.views ?? 0), 0);
    const rv = D.reports.filter((r) => r.type === 'review').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))[0];
    const pats = rv && Array.isArray(rv.d.patterns) ? (rv.d.patterns as Record<string, unknown>[]) : [];
    const pt = pats.find((p) => p && typeof p === 'object');
    const ptx = pt ? str(pt.pattern || pt.text || pt.title).trim() : '';
    o.eb = '05 · Insights · Last 30 days';
    o.g = ms.length ? `${nw(ms.length, true)}${ms.length > 1 ? ' posts, ' : ' post, '}${kfmt(vw)} views.` : 'No posts yet.';
    o.l = ptx ? (ptx.length > 80 ? `${ptx.slice(0, 79).replace(/\s+\S*$/, '')}…` : ptx.replace(/[.!?]*$/, '.')) : 'Log stats to see what works.';
  } else {
    const rn = D.jobs.filter((j) => j.status === 'running').length;
    const fj = D.jobs.filter((j) => j.status === 'failed' && isToday(j.finishedAt || j.createdAt, now));
    const ids = new Set(D.jobs.map((j) => j.id));
    const fr = D.runs.filter((r) => r.status === 'failed' && !ids.has(r.jobId) && isToday(r.finishedAt || r.at, now)).length;
    const f = fj.length + fr;
    o.eb = 'System · Worker, queue and settings';
    o.g = rn ? `${nw(rn, true)}${rn > 1 ? ' jobs' : ' job'} running.` : 'Worker idle.';
    o.l = f ? `${nw(f, true)} failed today.` : 'Nothing has failed today.';
  }
  return o;
}
