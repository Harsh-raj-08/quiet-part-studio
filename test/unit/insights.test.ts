import { test } from 'node:test';
import assert from 'node:assert/strict';
import { day7Views, expectations, groupOf, HOOK_LABEL, kpis, median, metricOf, postedRows, workGroups } from '../../src/lib/insights';
import { idleSince, workerOnline } from '../../src/lib/worker';
import { headlines } from '../../src/lib/headlines';
import { took, whenText } from '../../src/screens/system/SystemScreen';
import { nextIdeaCode } from '../../src/screens/discover/Ask';
import { tagList } from '../../src/screens/discover/Trends';
import { repMode } from '../../src/screens/discover/Reports';
import { cleanLearnings } from '../../src/screens/insights/Review';
import { cleanTaste } from '../../src/screens/insights/Taste';
import { normAccount, normBook, normChat, normIdea, normMetric, normSettings, type Idea } from '../../src/data/types';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const idea = (code: string, date: string, extra: Record<string, unknown> = {}): Idea => normIdea({ id: code, version: 1, data: { code, status: 'Posted', posted: { date, link: '' }, evidence: 'SUPPORTED', ...extra } });
const metric = (code: string, views: number, d7: number | null, extra: Record<string, unknown> = {}) =>
  normMetric({ id: code, version: 1, data: { ideaCode: code, snapshots: [...(d7 != null ? [{ day: 7, views: d7 }] : []), { day: 20, views, shares: views / 20, follows: 10, watchThroughPct: 60, ...extra }] } });

test('median and day-7 views', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5); assert.equal(median([]), null);
  assert.equal(day7Views(normMetric({ id: 'x', version: 1, data: { snapshots: [{ day: 1, views: 5 }, { day: 8, views: 70 }, { day: 30, views: 99 }] } })), 70);
  assert.equal(day7Views(null), null);
});

test('expectation: median of earlier day-7 views once there are 3, else the median of all', () => {
  const ideas = [idea('A', '2026-09-01'), idea('B', '2026-09-05'), idea('C', '2026-09-10'), idea('D', '2026-09-20')];
  const rows = postedRows(ideas, [metric('A', 1000, 800), metric('B', 3000, 2000), metric('C', 2000, 1500), metric('D', 9000, null)]);
  assert.deepEqual(rows.map((r) => r.idea.code), ['D', 'C', 'B', 'A']);
  const e = expectations(rows);
  assert.deepEqual(e.get('D'), { value: 1500, kind: '7-day' });
  assert.deepEqual(e.get('C'), { value: 2500, kind: 'median' });
});

test('KPIs: 30-day sums with deltas; followers from account snapshots, else follows from reels', () => {
  const ideas = [idea('A', '2026-10-01'), idea('B', '2026-09-01')];
  const rows = postedRows(ideas, [metric('A', 2000, null), metric('B', 1000, null)]);
  const acct = [['2026-08-11', 9000], ['2026-09-11', 10280], ['2026-10-11', 11460]].map(([at, f]) => normAccount({ id: String(at), version: 1, data: { at: `${at}T09:00:00Z`, followers: f } }));
  const k = kpis(rows, acct, NOW);
  assert.deepEqual(k.map((x) => [x.label, x.value, x.delta]), [['Views', '2k', '+100% vs prior 30 days'], ['Avg. watch', '60%', '0 pts'], ['Sends', '100', '+100%'], ['Followers', '+1,180', '−8% vs prior']]);
  assert.equal(kpis(rows, [], NOW)[3]!.label, 'Follows from reels');
});

test('What works: hook labels, groups, metrics, sorted by the metric', () => {
  assert.deepEqual(HOOK_LABEL, { 'myth-bust': 'Myth fix', number: 'Surprise fact', contrarian: 'Reframe', question: 'Question', story: 'Story', 'direct-you': 'Direct' });
  const books = new Map([['b', normBook({ id: 'b', version: 1, data: { title: 'Book', code: 'BK' } })]]);
  const i = idea('A', '2026-10-06', { hookStyle: 'number', bookId: 'b', format: 'Reel 42s' });
  assert.equal(groupOf(i, 'hook', books, null), 'Surprise fact');
  assert.equal(groupOf(i, 'book', books, null), 'BK');
  assert.equal(groupOf(i, 'length', books, null), '<45 s');
  assert.equal(groupOf(i, 'weekday', books, null), 'Tue');
  assert.equal(groupOf(i, 'evidence', books, null), 'Supported');
  const l = metric('A', 1000, null, { reach: 500, saves: 25 }).latest!;
  assert.equal(metricOf(l, 'save', null), 5); assert.equal(metricOf(l, 'follow', null), 20);
  const g = workGroups([{ idea: i, latest: l, pack: null }, { idea: idea('B', '2026-10-01', { evidence: 'MYTH' }), latest: metric('B', 4000, null).latest!, pack: null }], 'evidence', 'sends', books);
  assert.deepEqual(g.map((x) => [x.name, x.views, x.value, x.n]), [['Myth', 4000, 200, 1], ['Supported', 1000, 50, 1]]);
});

test('worker heartbeat (13 h) and the system headline', () => {
  assert.equal(workerOnline('2026-10-11T00:00:01Z', NOW), true);
  assert.equal(workerOnline('2026-10-10T22:59:00Z', NOW), false);
  assert.equal(workerOnline('', NOW), false);
  assert.equal(idleSince('2026-10-09T08:00:00Z', new Date(NOW)), 'idle since 9 Oct');
  assert.equal(idleSince('2026-10-10T18:40:00Z', new Date(NOW)), 'idle since yesterday, 18:40');
  const base = { loading: () => false, ideas: [], books: [], runs: [], metrics: [], reports: [], ratings: 0, now: new Date(NOW) };
  const run = { id: 'j', node: 'w', ideaCode: '', bookId: '', packId: '', chatId: '', request: '', status: 'running', error: '', kind: '', createdAt: '', startedAt: '', finishedAt: '', progress: null };
  assert.equal(headlines('system', { ...base, jobs: [run], workerSeenAt: '2026-10-11T11:00:00Z' }).g, 'Worker online, one job running.');
  assert.equal(headlines('system', { ...base, jobs: [], workerSeenAt: '2026-10-11T11:00:00Z' }).g, 'Worker online, nothing running.');
  assert.equal(headlines('system', { ...base, jobs: [], workerSeenAt: '2026-10-01T11:00:00Z' }).g, 'Worker idle since 1 Oct.');
});

test('System table: took and when', () => {
  assert.equal(took(48_000), '48s'); assert.equal(took(72_000), '1m 12s'); assert.equal(took(3_900_000), '1h 05m');
  assert.equal(whenText('2026-10-11T09:14:00Z', false, NOW), '09:14');
  assert.equal(whenText('2026-10-05T06:00:00Z', false, NOW), 'Mon 06:00');
  assert.equal(whenText('2026-09-29T06:00:00Z', false, NOW), '29 Sep');
  assert.equal(whenText('', true, NOW), 'now');
});

test('Discover helpers: idea codes, hashtag list, report kind', () => {
  const books = [normBook({ id: 'atomic-habits', version: 1, data: { title: 'Atomic Habits', code: 'AH' } })];
  const ideas = ['AH-01', 'AH-09', 'XX-01'].map((c) => normIdea({ id: c, version: 1, data: { code: c } }));
  assert.equal(nextIdeaCode(books, ideas, 'Atomic Habits').code, 'AH-10');
  assert.equal(nextIdeaCode(books, ideas, 'Unknown Book').code, 'XX-02');
  assert.deepEqual(tagList({ core: ['#a', 'b c', 'd', 'e'], rotating: ['r1', 'r2'] }), ['a', 'bc', 'd', 'e', 'r1']);
  const r = (d: Record<string, unknown>) => ({ id: 'r', type: 'scout', at: '', d });
  assert.equal(repMode(r({ mode: 'weekly' })), 'weekly');
  assert.equal(repMode(r({ request: 'Manual run' })), 'manual');
  assert.equal(repMode(r({ request: 'Books about regret' })), 'briefs');
});

test('learnings and taste lines are validated before the Writer sees them', () => {
  assert.deepEqual(cleanLearnings('- [early] ok\n- no tag\n- [strong] see https://x\n\n- [medium] fine'), { lines: ['- [early] ok', '- [medium] fine'], dropped: 2 });
  assert.deepEqual(cleanTaste('- calibration: one point low\n- [weird] x').lines, ['- calibration: one point low']);
});

test('chat, settings and account normalisers', () => {
  const c = normChat({ id: 'c', version: 1, data: { turns: [{ role: 'user', content: 'q' }, { role: 'system', content: 'x' }, { role: 'assistant', content: 'a', sources: ['s1', { title: 's2', url: 'https://x' }], ideas: [{ bookTitle: 'B', hook: 'h' }, { bookTitle: 'B' }] }] } });
  assert.equal(c.turns.length, 2); assert.deepEqual(c.turns[1]!.sources, ['s1', 's2']); assert.equal(c.turns[1]!.ideas.length, 1); assert.equal(c.title, 'Untitled chat');
  const s = normSettings([{ id: 'studio', version: 1, data: { writerLane: 'QUICK', workerTriggerId: 't' } }]);
  assert.deepEqual([s.writerLane, s.cadence, s.autoArt, s.notifyQa, s.spacePhilosophy, s.triggerSet], ['quick', '4 per week', true, true, false, true]);
  assert.equal(normAccount({ id: 'a', version: 1, data: { at: 'x', followers: '12' } }).followers, 12);
});
