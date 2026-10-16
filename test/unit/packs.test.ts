import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionText, designText, framesByBeat, litBeat, packSegments, parseEnd, parseT, postDesignText, stickerText, voText } from '../../src/lib/packs';
import { formatHash, parseHash } from '../../src/app/route';
import { normPack, normPost, normQa } from '../../src/data/types';

const beats = [
  { t: '0:00–0:04', vo: 'One.', onscreen: 'A', visual: '' },
  { t: '0:04–0:12', vo: 'Two.', onscreen: 'B', visual: '' },
  { t: '0:12–0:22', vo: 'The quiet part, said plainly.', onscreen: 'C', visual: '' },
  { t: '0:22–0:30', vo: 'Four.', onscreen: 'D', visual: '' },
];

test('copy formats (SPEC): Claude Design, VO script, caption', () => {
  assert.equal(designText({ designPrompt: 'PROMPT', beats: beats.slice(0, 2) }), 'PROMPT\n\n[0:00–0:04]\nV.O: One.\n[On-screen]: A\n\n[0:04–0:12]\nV.O: Two.\n[On-screen]: B');
  assert.equal(designText({ designPrompt: '', beats: beats.slice(0, 1) }), '[0:00–0:04]\nV.O: One.\n[On-screen]: A');
  assert.equal(voText({ voiceover: '', beats: beats.slice(0, 2) }), 'One.\nTwo.');
  assert.equal(voText({ voiceover: 'Stored VO', beats }), 'Stored VO');
  assert.equal(captionText('COVER', 'Caption.'), 'Cover: COVER\n\nCaption.');
});

test('posts copy formats (SPEC5) and sticker text', () => {
  assert.equal(stickerText({ type: 'poll', prompt: 'Which?', options: ['A', 'B'] }), 'Poll · Which? · (A / B)');
  assert.equal(stickerText(null), '');
  const story = normPost({ id: 'X-01-story-v2', version: 1, data: { designPrompt: 'P', frames: [{ text: 'T', visual: 'V', sticker: null }, { text: 'T2', visual: 'V2', sticker: { type: 'quiz', prompt: 'Q', options: [] } }] } });
  assert.equal(story.kind, 'story'); assert.equal(story.version, 2); assert.equal(story.ideaCode, 'X-01');
  assert.equal(postDesignText(story), 'P\n\n[Frame 1]\nText: T\nVisual: V\n\n[Frame 2]\nText: T2\nVisual: V2\nSticker: Quiz · Q');
  const car = normPost({ id: 'X-01-carousel-v1', version: 1, data: { slides: [{ n: 1, headline: 'H', body: 'B', visual: 'V' }] } });
  assert.equal(postDesignText(car), '[Slide 1]\nHeadline: H\nBody: B\nVisual: V');
});

test('lit beat: the one with the quiet part, else the second-to-last', () => {
  assert.equal(litBeat(beats, 'the quiet part, said plainly'), 2);
  assert.equal(litBeat(beats, 'Something else entirely'), 2);
  assert.equal(litBeat(beats.slice(0, 2), ''), 0);
  assert.equal(litBeat(beats, 'Four.'), 2, 'too short to match: falls back');
  assert.equal(litBeat([], 'x'), -1);
  assert.equal(litBeat([{ vo: 'a' }, { vo: 'b', lit: true }, { vo: 'c' }], 'c'), 1, 'an explicit lit flag wins');
});

test('timestamps: m:ss, decimals, h:mm:ss, seconds, ranges (start) and ends', () => {
  assert.equal(parseT('0:12.5'), 12.5);
  assert.equal(parseT('0:12–0:15'), 12);
  assert.equal(parseT('1:02'), 62);
  assert.equal(parseT('1:00:05'), 3605);
  assert.equal(parseT('14s'), 14);
  assert.equal(parseT('[0:03]'), 3);
  assert.equal(parseT('soon'), null);
  assert.equal(parseEnd('0:04–0:12'), 12);
  assert.equal(parseEnd('0:04'), null);
});

test('frames land on the beat whose window holds their time; the rest are extras', () => {
  const r = framesByBeat(beats, [{ t: '0:05' }, { t: '0:22' }, { t: '0:05' }, { t: 'x' }]);
  assert.deepEqual(r.perBeat.map((f) => f?.t ?? null), [null, '0:05', null, '0:22']);
  assert.deepEqual(r.extra.map((f) => f.t), ['0:05', 'x']);
});

test('pack card segments come from the data, or the idea being past that step', () => {
  const idea = { status: 'Scripted' as const, voiceAssetId: '', videoAssetId: '', qaLast: null };
  assert.deepEqual(packSegments({ frames: [] }, idea).map((s) => s[1]), [true, false, false, false, false]);
  assert.deepEqual(packSegments({ frames: [{ t: '', path: 'p', note: '' }] }, { ...idea, voiceAssetId: 'v' }).map((s) => s[1]), [true, true, true, false, false]);
  assert.deepEqual(packSegments({ frames: [] }, { ...idea, status: 'QA passed' }).map((s) => s[1]), [true, false, true, true, true]);
});

test('normalisers: pack watch-outs from text, frames by path (or legacy assetId), QA checks/fixes/measurements', () => {
  const p = normPack({ id: 'A-v1', version: 1, data: { watchouts: '- one\n- two', frames: [{ t: '0:00', assetId: 'old' }], beats: [{ t: '0:00', vo: 'x', onscreen: 'y', visual: 'z' }] } });
  assert.deepEqual(p.watchouts, ['one', 'two']); assert.equal(p.frames[0]!.path, 'old'); assert.equal(p.beats[0]!.visual, 'z');
  const q = normQa({ id: 'q', version: 1, data: { verdict: 'no go', checks: [{ name: 'n', status: 'odd', t: '0:01' }], measurements: { lufs: '-14', safeZonePct: 90 } } });
  assert.equal(q.verdict, 'NO-GO'); assert.equal(q.checks[0]!.status, 'warn'); assert.equal(q.checks[0]!.t, '0:01');
  assert.equal(q.meas.lufs, -14); assert.equal(q.meas.safeZonePct, 90); assert.equal(q.meas.firstWordSec, null);
});

test('hash routes carry an id for Studio packs and Library books', () => {
  assert.deepEqual(parseHash('#studio/qa/TFS-01-v5'), { tab: 'studio', sub: 'qa', id: 'TFS-01-v5' });
  assert.deepEqual(parseHash('#library/notes/atomic-habits'), { tab: 'library', sub: 'notes', id: 'atomic-habits' });
  assert.deepEqual(parseHash('#studio'), { tab: 'studio', sub: 'script', id: '' });
  assert.deepEqual(parseHash('#studio/script/<script>'), { tab: 'studio', sub: 'script', id: 'script' });
  assert.equal(formatHash({ tab: 'studio', sub: 'frames', id: 'FTW-05-v3' }), '#studio/frames/FTW-05-v3');
  assert.equal(formatHash({ tab: 'library', sub: 'shelf', id: '' }), '#library');
});

import { critRubric } from '../../src/screens/studio/ScriptTab';
test('critic panel uses the v3 rubric for v3 scores and the v2 rubric for old packs', () => {
  const v3 = critRubric({ hook: 5, anchor: 4, flow: 4, shift: 4, emotion: 4, conclusion: 5, truth: 4 }).map(([k]) => k);
  assert.deepEqual(v3, ['hook', 'anchor', 'flow', 'shift', 'emotion', 'conclusion', 'truth']);
  const v2 = critRubric({ hook: 4, gap: 3, scene: 4, turn: 3, rhythm: 4, truth: 5, ending: 3 }).map(([k]) => k);
  assert.deepEqual(v2, ['hook', 'gap', 'scene', 'turn', 'rhythm', 'truth', 'ending']);
  assert.equal(critRubric({}).length, 7);
});

// ---- last edited
import { ownerStamp, stampLine, stampLines, stampShort, versionTitle } from '../../src/lib/packs';
import { fmtAgo, fmtStamp } from '../../src/lib/format';
import type { Doc } from '../../src/data/types';

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).toISOString();
const NOW = new Date(2026, 9, 16, 12, 0).getTime();

test('fmtStamp: local "15 Oct, 1:32 pm", relative under 24 h, year when not this year', () => {
  assert.equal(fmtStamp(at(2026, 10, 15, 13, 32), NOW, false), '15 Oct, 1:32 pm');
  assert.equal(fmtStamp(at(2026, 10, 15, 13, 32), NOW), '22 h ago');
  assert.equal(fmtStamp(at(2026, 10, 16, 10, 0), NOW), '2 h ago');
  assert.equal(fmtStamp(at(2026, 10, 16, 11, 40), NOW), '20 min ago');
  assert.equal(fmtStamp(at(2026, 10, 16, 11, 59), NOW).includes('min ago'), true);
  assert.equal(fmtAgo(at(2026, 10, 16, 12, 0), NOW), 'just now');
  assert.equal(fmtStamp(at(2025, 12, 31, 0, 5), NOW), '31 Dec 2025, 12:05 am');
  assert.equal(fmtStamp(at(2026, 1, 2, 12, 0), NOW), '2 Jan, 12:00 pm');
  assert.equal(fmtStamp('nonsense', NOW), '');
});

const pk = (x: Record<string, unknown>, extra: Partial<Doc> = {}) => normPack({ id: 'X-v1', version: 1, data: { ideaCode: 'X', version: 1, ...x }, ...extra });

test('written / edited lines: edited only when over a minute after it was written; row timestamps fill in', () => {
  const w = at(2026, 10, 15, 13, 32); const e = at(2026, 10, 16, 11, 5);
  assert.equal(stampLine(pk({ createdAt: w }), NOW), 'Written 15 Oct, 1:32 pm');
  assert.equal(stampLine(pk({ createdAt: w, editedAt: e, editedBy: 'owner' }), NOW), 'Written 15 Oct, 1:32 pm · Edited 55 min ago');
  assert.equal(stampLines(pk({ createdAt: w, editedAt: at(2026, 10, 15, 13, 32) }), NOW).edited, '');
  assert.equal(stampLine(pk({}, { createdAt: w }), NOW), 'Written 15 Oct, 1:32 pm');
  assert.equal(stampLine(pk({}), NOW), '');
  assert.equal(stampShort(pk({ createdAt: w, editedAt: e }), NOW), 'edited 55 min ago');
  assert.equal(stampShort(pk({ createdAt: at(2026, 10, 12, 9, 0), editedAt: at(2026, 10, 14, 9, 0) }), NOW), 'edited 14 Oct');
  assert.equal(stampShort(pk({ createdAt: w }), NOW), 'written 15 Oct');
  assert.equal(versionTitle(pk({ createdAt: w }), true, NOW), 'v1 (current) · written 15 Oct, 1:32 pm');
  assert.equal(pk({ editedAt: e, editedBy: 'owner' }).editedBy, 'owner');
});

test('ownerStamp writes an ISO time and "owner"', () => {
  const s = ownerStamp(new Date(Date.UTC(2026, 9, 16, 6, 30)));
  assert.deepEqual(s, { editedAt: '2026-10-16T06:30:00.000Z', editedBy: 'owner' });
});
