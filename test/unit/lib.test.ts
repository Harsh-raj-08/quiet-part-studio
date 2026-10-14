import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMovePatch, columnItems, nextStage, placeholderIndex, planMove, prevStage } from '../../src/lib/stages';
import { headlines } from '../../src/lib/headlines';
import { pageRanges, pagesOverlap } from '../../src/lib/pages';
import { compactViews, fmtDay, initials, nw, pgs, shortBookTitle } from '../../src/lib/format';
import { allWords, markParts, searchAll, snipOf } from '../../src/lib/search';
import { normIdea, type Idea, type Book } from '../../src/data/types';

const mk = (o: Partial<Idea> & { code: string }): Idea => normIdea({ id: o.code, version: 1, data: { scores: { hook: 4, visual: 4, truth: 4, send: 4 }, status: 'Idea', ...o } as Record<string, unknown> });

test('pages: ranges, en dash, overlap', () => {
  assert.deepEqual(pageRanges('97–104'), [[97, 104]]);
  assert.deepEqual(pageRanges('12, 40-42'), [[12, 12], [40, 42]]);
  assert.deepEqual(pageRanges('1245-9'), [[1245, 1249]]);
  assert.ok(pagesOverlap('23–27', '18–31'));
  assert.ok(!pagesOverlap('97–104', '300–320'));
});

test('format helpers', () => {
  assert.equal(nw(14, true), 'Fourteen');
  assert.equal(nw(21), '21');
  assert.equal(pgs('97–104'), 'pp. 97–104');
  assert.equal(pgs('5'), 'p. 5');
  assert.equal(pgs('§1'), '§1');
  assert.equal(compactViews(12400), '12.4k');
  assert.equal(compactViews(31000), '31.0k');
  assert.equal(compactViews(950), '950');
  assert.equal(shortBookTitle('The Psychology of Money'), 'Psychology of Money');
  assert.equal(initials('Atomic Habits'), 'AH');
  assert.equal(fmtDay('2026-10-03T12:00:00Z', new Date('2026-10-11T12:00:00Z')), '3 Oct');
});

test('stages: next, prev, dropped prev from history', () => {
  assert.equal(nextStage('Idea'), 'Approved');
  assert.equal(nextStage('Posted'), null);
  assert.equal(prevStage({ status: 'Idea', history: [] }), null);
  assert.equal(prevStage({ status: 'Voiced', history: [] }), 'Scripted');
  assert.equal(prevStage({ status: 'Dropped', history: [{ status: 'Idea', at: '' }, { status: 'Approved', at: '' }, { status: 'Dropped', at: '' }] }), 'Approved');
});

test('planMove: rules shared by buttons and drag and drop', () => {
  const base = { history: [], voiceAssetId: '', videoAssetId: '' };
  const ctx = { hasPack: true };
  assert.equal(planMove({ ...base, status: 'Idea' }, 'Idea', ctx).kind, 'noop');
  assert.deepEqual(planMove({ ...base, status: 'Idea' }, 'Approved', ctx), { kind: 'ok', extra: {}, message: 'Moved to Approved' });
  assert.deepEqual(planMove({ ...base, status: 'Idea' }, 'Dropped', ctx), { kind: 'prompt', need: 'drop' });
  assert.equal(planMove({ ...base, status: 'Scripted' }, 'Voiced', ctx).kind, 'prompt');
  assert.equal(planMove({ ...base, status: 'Scripted', voiceAssetId: 'x' }, 'Voiced', ctx).kind, 'ok');
  assert.deepEqual(planMove({ ...base, status: 'Voiced' }, 'Produced', ctx), { kind: 'prompt', need: 'video' });
  assert.deepEqual(planMove({ ...base, status: 'QA passed' }, 'Posted', ctx), { kind: 'prompt', need: 'post' });
  assert.equal(planMove({ ...base, status: 'Approved' }, 'Scripted', { hasPack: false }).kind, 'invalid');
  assert.equal(planMove({ ...base, status: 'Approved' }, 'Scripted', ctx).kind, 'ok');
  assert.equal(planMove({ ...base, status: 'Posted' }, 'Dropped', ctx).kind, 'invalid');
  const back = planMove({ ...base, status: 'Posted' }, 'QA passed', ctx);
  assert.ok(back.kind === 'ok' && back.message === 'Moved back to QA passed' && 'posted' in back.extra);
  assert.equal(planMove({ ...base, status: 'Dropped' }, 'Idea', ctx).kind, 'ok');
  assert.equal(planMove({ ...base, status: 'Dropped' }, 'Voiced', ctx).kind, 'invalid');
});

test('buildMovePatch appends history to the fresh doc and caps at 100', () => {
  const p = buildMovePatch({ history: [{ status: 'Idea', at: 'a' }] }, 'Approved', { x: 1 }, 't');
  assert.deepEqual(p, { status: 'Approved', updatedAt: 't', history: [{ status: 'Idea', at: 'a' }, { status: 'Approved', at: 't' }], x: 1 });
  const big = buildMovePatch({ history: Array.from({ length: 100 }, (_, i) => ({ status: 'Idea', at: String(i) })) }, 'Approved', null, 't');
  assert.equal((big.history as unknown[]).length, 100);
});

test('placeholderIndex: score-sorted landing slot for every position', () => {
  const col = [20, 18, 16, 12].map((t, i) => mk({ code: `A-${i}`, status: 'Approved', total: t }));
  const dragged = (t: number) => mk({ code: 'D-1', status: 'Idea', total: t });
  const at = (t: number) => { const d = dragged(t); return placeholderIndex([...col, d], d, 'Approved'); };
  assert.equal(at(25), 0);
  assert.equal(at(19), 1);
  assert.equal(at(17), 2);
  assert.equal(at(14), 3);
  assert.equal(at(5), 4);
  assert.equal(at(18), 2, 'ties land after existing cards of the same score only when the dragged card is later in order');
  assert.deepEqual(columnItems([...col, dragged(1)], 'Approved').map((x) => x.total), [20, 18, 16, 12]);
});

test('headlines: templates', () => {
  const ideas = [mk({ code: 'A-1', bookId: 'a', status: 'Idea' }), mk({ code: 'A-2', bookId: 'b', status: 'Approved' }), mk({ code: 'A-3', bookId: 'b', status: 'Posted' })];
  const D = { loading: () => false, ideas, books: [] as Book[], jobs: [], runs: [], metrics: [], reports: [], ratings: 0, now: new Date('2026-10-11T12:00:00Z') };
  const h = headlines('ideas', D);
  assert.equal(h.eb, '03 · Ideas · Sunday 11 October');
  assert.equal(h.g, 'Two ideas in motion across two books.');
  assert.equal(h.l, 'One is waiting on you.');
  assert.equal(h.note, '← start with the top scorer');
  assert.equal(headlines('ideas', { ...D, ideas: [] }).g, 'No ideas in motion yet.');
  assert.equal(headlines('ideas', { ...D, ideas: [ideas[1]!] }).l, 'Nothing is waiting on you.');
  assert.equal(headlines('ideas', { ...D, loading: () => true }).g, 'Loading…');
  assert.equal(headlines('studio', D).g, 'No packs in production.');
  assert.equal(headlines('system', D).g, 'Worker idle.');
  assert.equal(headlines('system', { ...D, jobs: [{ id: 'j', node: 'writer', ideaCode: '', bookId: '', packId: '', chatId: '', request: '', status: 'running', error: '', kind: '', createdAt: '', startedAt: '', finishedAt: '', progress: null }] }).g, 'One job running.');
});

test('search: groups, snippets, marks', () => {
  assert.ok(allWords(['fast', 'slow'], 'Thinking, Fast and Slow'));
  assert.equal(snipOf('abc', ['zzz']), null);
  assert.deepEqual(markParts('Fast and slow', ['fast']).map((p) => p.hit), [true, false]);
  const i = mk({ code: 'TFS-07', hook: 'You are answering an easier question', quietPart: 'The mind swaps the question' });
  const r = searchAll('question', { books: [], ideas: [i], packs: [], notes: [], reports: [] });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.name, 'Ideas');
  assert.equal(r.groups[0]!.items[0]!.c, 'TFS-07');
  assert.equal(searchAll('   ', { books: [], ideas: [i], packs: [], notes: [], reports: [] }).groups.length, 0);
});
