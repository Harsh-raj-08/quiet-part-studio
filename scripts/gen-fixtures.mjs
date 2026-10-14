// Writes test/fixtures/*.json: invented demo data in the same shape as the real collections.
// The ideas mirror the owner's design mock (so screenshots can be compared like for like).
// Nothing here is book text: hooks, notes and candidates are made-up short lines.
// Usage: node scripts/gen-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('test/fixtures');
fs.mkdirSync(OUT, { recursive: true });
const write = (name, docs) => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(docs, null, 2) + '\n');

const STAGES = ['Idea', 'Approved', 'Scripted', 'Voiced', 'Produced', 'QA passed', 'Posted'];
const iso = (d) => `2026-10-${String(d).padStart(2, '0')}T12:00:00.000Z`;

// ---------------------------------------------------------------- books (the design's shelf: six researched, one in research, one waiting)
const BOOKS = [
  ['TFS', 'thinking-fast-and-slow', 'Thinking, Fast and Slow', 'Daniel Kahneman', 'Mind', "The richest source of 'you're doing it too' moments. Every chapter has a testable trick.", 38, '2026-10-02'],
  ['AH', 'atomic-habits', 'Atomic Habits', 'James Clear', 'Habits', 'Concrete, visual, and endlessly quotable. Good for systems-over-goals framing.', 26, '2026-09-28'],
  ['EN', 'enchiridion', 'Enchiridion', 'Epictetus', 'Philosophy', 'Short, ancient, and blunt. Two-line ideas that end on the viewer.', 14, '2026-09-20'],
  ['FTW', 'four-thousand-weeks', 'Four Thousand Weeks', 'Oliver Burkeman', 'Time', 'Anti-productivity with real warmth. Good closers.', 21, '2026-09-16'],
  ['PM', 'the-psychology-of-money', 'The Psychology of Money', 'Morgan Housel', 'Money', 'Stories over spreadsheets. Each chapter is a short reel already.', 19, '2026-09-12'],
  ['SH', 'stumbling-on-happiness', 'Stumbling on Happiness', 'Daniel Gilbert', 'Mind', 'Forecasting errors everyone recognises. Light, funny, well-sourced.', 16, '2026-09-08'],
  ['CD', 'the-courage-to-be-disliked', 'The Courage to Be Disliked', 'Kishimi & Koga', 'Philosophy', 'Dialogue format gives natural two-voice reels.', 0, ''],
  ['MSM', 'mans-search-for-meaning', "Man's Search for Meaning", 'Viktor Frankl', 'Meaning', 'Needs careful handling. Hold until the tone guide is ready.', 0, ''],
];
const DIGEST = {
  TFS: 'Two systems run your thinking. One is fast and confident; the other is slow and lazy. Most errors happen when the fast one answers and the slow one signs off without reading.',
  AH: 'Habits are the compound interest of behaviour. Change the system and the environment rather than relying on motivation, and make the next action small enough to start.',
  EN: "A handbook for separating what is yours to control from what isn't. Judgements, not events, are what disturb us.",
};
const bookId = Object.fromEntries(BOOKS.map(([c, id]) => [c, id]));
write('books', BOOKS.map(([code, id, title, author, topic, why, notes, when], k) => ({
  id, data: {
    title, author, code, topic, lane: 'Well known', why, status: notes ? 'Done' : code === 'CD' ? 'In research' : 'Candidate', order: k + 1,
    notesCount: notes, ideaCount: 0, ...(when ? { researchedAt: `${when}T09:00:00.000Z` } : {}), ...(DIGEST[code] ? { digest: DIGEST[code] } : {}),
    ...(code === 'CD' || code === 'TFS' ? { filePath: `books/${id}/demo-${code.toLowerCase()}.pdf`, fileName: `${code.toLowerCase()}-demo.pdf`, fileSize: 2306867, uploadedAt: iso(1) } : {}),
  },
})));

// ---------------------------------------------------------------- ideas (same rows as the design mock)
const SEED = [
  ['TFS-07', 'TFS', 'Idea', [5, 4, 4, 5], 'SUPPORTED', "You're not deciding. You're answering an easier question and calling it a decision.", 'When a question is hard, the mind quietly swaps it for an easy one and hands you that answer instead.', "Everyone has felt a decision that was 'obvious' in the moment and baffling a week later. This names the swap.", 'Next time a choice feels instant, write down the question you actually answered.', 'Two questions on a ghost page. The hard one fades; the easy one is lit and underlined.', 'Attribute substitution is well documented across judgement studies (Kahneman & Frederick, 2002).', '97–104'],
  ['FTW-02', 'FTW', 'Idea', [4, 3, 5, 4], 'PHILOSOPHY', 'The to-do list was never going to end. That was the point you kept missing.', "Getting through everything is not a finish line you're late for. It doesn't exist.", "Lands with anyone who's had a productive week and still felt behind.", 'Pick three things you\'re deliberately not doing this week. Say them out loud.', 'An endless list scrolling past; one line stays still and lights up.', "An argument, not a finding. Present it as Burkeman's view.", '21–30'],
  ['SH-04', 'SH', 'Idea', [4, 4, 4, 4], 'SUPPORTED', "You're terrible at predicting what will make future-you happy. Everyone is.", "We imagine the future using today's mood, then act surprised when it feels different.", 'Relief, not blame: the error is universal.', 'Before a big purchase, ask someone who already has it how they feel now.', 'Present-self and future-self as two ink figures; the forecast line between them is dashed.', 'Affective forecasting errors replicate well (Wilson & Gilbert, 2005).', '112–130'],
  ['PM-05', 'PM', 'Idea', [4, 3, 4, 3], 'STORY', 'Rich and wealthy are opposites more often than you think.', "Wealth is the money you didn't spend. You can't see it, which is why nobody admires it.", 'Reframes status spending without lecturing.', 'Notice the last thing you bought so someone else would see it.', "A car drawn in solid ink; beside it a dashed outline labelled 'the version you kept'.", 'A framing from the book, illustrated with anecdotes rather than data.', '99–106'],
  ['AH-09', 'AH', 'Idea', [3, 4, 3, 3], 'CHECK', 'Your environment is voting on your habits while you\'re asleep.', 'The room you wake up in has already made half your choices.', 'Concrete and actionable, but the claim needs a source before it ships.', "Move one thing in your room tonight that makes tomorrow's habit easier.", 'A bedroom drawn in line; one object glows faintly.', 'Needs a primary study on cue-driven behaviour before scripting.', '81–92'],
  ['AH-04', 'AH', 'Approved', [5, 4, 4, 4], 'SUPPORTED', 'Motivation is the least reliable part of any habit. So stop designing around it.', "If the habit only works on good days, it isn't a habit yet.", 'Takes the guilt out of low-motivation days and gives a design problem instead.', 'Shrink the habit until it works on your worst day.', 'A motivation curve drawn as a jagged line; a flat solid line runs underneath.', 'Habit formation research favours cue and context over intention (Wood & Neal).', '141–150'],
  ['EN-01', 'EN', 'Approved', [4, 5, 5, 4], 'PHILOSOPHY', 'Most of what upsets you was never yours to control. Epictetus wrote that down nineteen centuries ago.', "Draw the line between what's yours and what isn't, and most of the weight falls on the other side.", 'Old, short, and immediately usable. The age of the idea is the hook.', "List what's bothering you today. Cross out everything you can't act on.", 'A single page split by an ink line. Left side lit, right side ghosted.', 'A Stoic teaching, not an empirical claim. Credit it as philosophy.', '§1'],
  ['TFS-03', 'TFS', 'Approved', [4, 3, 3, 4], 'MIXED', "The 'hot hand' you swear you can feel is mostly noise.", 'We see streaks in randomness because a pattern is easier to live with than chance.', 'Sports fans argue about this, which drives sends.', 'Flip a coin 20 times and count the longest streak before you guess.', 'A row of coin flips; a streak is circled in pen, then shown to be ordinary.', 'Original studies found no effect; later re-analysis found a small one. Say both.', '114–118'],
  ['FTW-05', 'FTW', 'Scripted', [5, 5, 4, 5], 'PHILOSOPHY', 'The average life is about four thousand weeks. Count how many you\'ve used.', "Finitude isn't the problem to solve. It's what makes any choice mean something.", 'Personal maths makes it stick; viewers comment their number.', "Work out your week number. Write it somewhere you'll see it.", 'A grid of 4,000 small squares; filled ones in ink, the current week in lilac.', "The number is arithmetic; the argument is Burkeman's.", '1–12'],
  ['PM-02', 'PM', 'Scripted', [4, 4, 4, 4], 'STORY', 'Nobody is thinking about your car as much as you are.', "People look at the car and imagine themselves in it. They don't think about you at all.", 'Funny and slightly deflating in a useful way.', 'Ask a friend what car you drive. See if they know.', 'A valet story told in four ink frames.', 'An anecdote from the book; frame it as a story.', '91–94'],
  ['SH-01', 'SH', 'Voiced', [4, 3, 4, 3], 'SUPPORTED', 'Your brain fills the future with the present. That\'s why every plan feels obvious today.', 'Imagination borrows from now, so tomorrow always looks like today in a costume.', 'Explains why plans made on good days fail on bad ones.', 'Plan the next week while you\'re tired. See what changes.', 'A calendar page; next week drawn as a faint copy of this one.', 'Presentism in forecasting is well supported.', '147–160'],
  ['AH-02', 'AH', 'Voiced', [4, 4, 4, 4], 'MIXED', "'One percent better a day' is a nice line. The maths isn't why it works.", "It works because it's small enough to start, not because it compounds to 37×.", 'Corrects a popular quote without dunking on it.', 'Pick a change too small to skip.', "The 1.01^365 curve, dashed; a short solid line labelled 'today'.", 'The compounding figure is illustrative, not measured.', '15–20'],
  ['TFS-01', 'TFS', 'Produced', [5, 5, 5, 4], 'SUPPORTED', 'A bat and a ball cost $1.10. Your first answer is wrong, and it arrived fast.', 'The answer that comes first is the one you least checked.', 'Interactive: viewers pause to solve it.', 'Before answering anything fast today, count to three.', 'The puzzle written on paper; the wrong answer crossed out in pen.', 'Cognitive Reflection Test, Frederick 2005.', '44–46'],
  ['EN-04', 'EN', 'QA passed', [5, 4, 4, 5], 'PHILOSOPHY', "It isn't the event that hurts. It's the sentence you say about it.", 'Between what happened and how you feel is a sentence. You wrote it.', 'Short enough to remember; ends on the viewer.', "Write the sentence you told yourself about today's worst moment.", 'An event in solid ink; the sentence about it in lilac underline.', 'Stoic teaching; also the basis of cognitive reappraisal.', '§5'],
  ['PM-01', 'PM', 'Posted', [4, 4, 4, 4], 'STORY', 'Saving money is just paying future-you first.', "Savings are a gift to a person you haven't met yet.", 'Warm framing on a dry topic.', "Name the account after the person you'll be in ten years.", 'Two ink figures; an envelope passes between them.', "A framing, illustrated by the book's stories.", '145–150'],
  ['AH-01', 'AH', 'Posted', [5, 4, 4, 5], 'SUPPORTED', "You don't rise to your goals. You fall to your systems.", 'Goals pick the direction. Systems decide whether you get there.', "The book's best-known line, with a fresh visual.", 'Write the system behind one goal. Just the daily part.', 'A summit drawn faint; the staircase below in solid ink.', 'Supported by research on implementation intentions.', '23–27'],
  ['SH-06', 'SH', 'Dropped', [3, 2, 2, 3], 'MYTH', "Money can't buy happiness. Or can it?", 'The cliché is wrong in both directions.', "Too familiar; the hook doesn't earn the second read.", '—', '—', "The popular version of this claim isn't supported. Dropped before scripting.", '210–215'],
];
const POSTED = { 'PM-01': { date: '2026-10-03', views: 12400 }, 'AH-01': { date: '2026-09-28', views: 31000 } };
const EXTRA = {
  'AH-01': { format: 'Reel', hookStyle: 'contrarian', sources: [{ title: 'Implementation intentions, a review (demo)', url: 'https://example.com/implementation-intentions' }, { title: 'A source with an unsafe link', url: 'http://example.com/not-https' }] },
  'SH-01': { voiceAssetId: 'media/SH-01/demo-voice.m4a', voiceFileName: 'voice-demo.m4a', voiceUploadedAt: iso(9) },
  'TFS-01': { videoAssetId: 'media/TFS-01/demo-TFS-01_v2.mp4', videoFileName: 'TFS-01_v2.mp4', videoSize: 9437184, videoUploadedAt: '2026-10-11T09:12:00.000Z', qaLast: { qaId: 'tfs-01-qa-1', verdict: 'FIX', at: iso(11) } },
  'EN-04': { videoAssetId: 'media/EN-04/demo-EN-04_final.mp4', videoFileName: 'EN-04_final.mp4', videoSize: 7340032, videoUploadedAt: iso(10), qaLast: { qaId: 'en-04-qa-1', verdict: 'GO', at: iso(10) } },
};

function history(status) {
  const end = status === 'Dropped' ? 1 : STAGES.indexOf(status);
  const days = [9, 7, 5, 4, 3, 2, 1];
  const out = STAGES.slice(0, end + 1).map((s, k) => ({ status: s, day: 11 - Math.round(days[k] * (end ? (end - k) / end : 0)) }));
  if (status === 'Dropped') out.push({ status: 'Dropped', day: 10 });
  return out.map((h, k, arr) => ({ status: h.status, at: iso(k === arr.length - 1 ? 11 : Math.max(1, h.day - (arr.length - 1 - k))) }));
}

const ideas = SEED.map(([code, b, status, sc, evidence, hook, quietPart, why, tryThis, visual, evidenceNote, pages], k) => {
  const hist = history(status);
  const data = {
    code, bookId: bookId[b], rank: k + 1, hook, quietPart, why, tryThis, visual, evidence, evidenceNote, pages,
    scores: { hook: sc[0], visual: sc[1], truth: sc[2], send: sc[3] }, total: sc.reduce((a, c) => a + c, 0),
    status, updatedAt: hist[hist.length - 1].at, history: hist, ...(EXTRA[code] ?? {}),
  };
  if (POSTED[code]) data.posted = { date: POSTED[code].date, link: 'https://example.com/reel-demo' };
  if (status === 'Dropped') data.dropReason = "the hook doesn't earn a second read.";
  return { id: code, data };
});
write('ideas', ideas);

// ---------------------------------------------------------------- packs (the design's six packs; PM-02 also has an older v1)
// [t, vo, onscreen, visual]
const PACKS = {
  'FTW-05': { v: 3, dur: 42, beats: [['0:00–0:04', "Four thousand weeks. That's the whole thing.", '4,000 WEEKS', 'Grid of 4,000 squares fades in on night canvas.'], ['0:04–0:12', "If you're thirty, you've already used about fifteen hundred of them.", '~1,560 USED', 'Filled squares sweep left to right in ink.'], ['0:12–0:22', "Most of us live like the list will end, and then we'll start.", 'THE LIST NEVER ENDS', 'Ghost to-do list scrolls behind; one line stays still.'], ['0:22–0:34', "It won't. Finitude isn't the problem. It's what makes a choice mean something.", "IT'S WHAT MAKES IT MEAN SOMETHING", 'The current week square lights in lilac.'], ['0:34–0:42', "Work out your number. Write it somewhere you'll see it.", 'YOUR NUMBER →', 'Source chip and seed end card.']],
    caption: "Four thousand weeks is the average. Work out how many you've used, then pick what this one is for. ¹ From Four Thousand Weeks, Oliver Burkeman.", watch: ["Say 'about'. The figure is an average, not a promise.", 'Keep the grid legible at 1080 wide; no squares under 6 px.'] },
  'PM-02': { v: 2, dur: 36, beats: [['0:00–0:05', 'Housel used to park cars at a hotel.', 'A VALET STORY', 'Ink frame: a valet stand at night.'], ['0:05–0:15', "He'd look at a Ferrari and imagine himself in it. Never the driver.", 'NOT THE DRIVER', "Driver's outline dashed; the car solid."], ['0:15–0:28', "That's what people do with your car too. They don't think about you at all.", "THEY DON'T THINK ABOUT YOU", 'Lit line on ghost page.'], ['0:28–0:36', 'Ask a friend what you drive. See if they know.', 'ASK A FRIEND', 'End card.']],
    caption: 'The car is for the person looking at it, not the person in it. ¹ From The Psychology of Money.', watch: ["Frame it as Housel's story, not a study."] },
  'SH-01': { v: 4, dur: 39, beats: [['0:00–0:06', "Plan next week while you're tired. Notice anything?", 'PLAN IT TIRED', 'Calendar page on paper.'], ['0:06–0:20', 'Your brain builds the future out of how you feel right now.', 'THE FUTURE, BORROWED', 'Next week drawn as a faint copy of this one.'], ['0:20–0:31', 'So tomorrow always looks like today in a costume.', 'TODAY IN A COSTUME', 'Lit line.'], ['0:31–0:39', "Gilbert calls it presentism. You'll see it everywhere now.", '¹ STUMBLING ON HAPPINESS', 'End card.']],
    caption: 'Tomorrow always looks like today in a costume. ¹ From Stumbling on Happiness, Daniel Gilbert.', watch: ["Keep 'presentism' on screen for at least 1.5 s."] },
  'AH-02': { v: 2, dur: 40, beats: [['0:00–0:06', 'One percent better a day makes you thirty-seven times better in a year.', '1.01³⁶⁵ ≈ 37', 'Dashed compounding curve.'], ['0:06–0:18', "Nice line. Nobody's measuring it.", "NOBODY'S MEASURING", 'Curve fades to ghost.'], ['0:18–0:32', 'It works because the change is small enough to start.', 'SMALL ENOUGH TO START', "Short solid line labelled 'today'."], ['0:32–0:40', 'Pick a change too small to skip.', 'TOO SMALL TO SKIP', 'End card.']],
    caption: "It works because it's small enough to start. ¹ From Atomic Habits.", watch: ['Mark the 37× figure as illustrative.', 'Evidence stamp: MIXED.'] },
  'TFS-01': { v: 5, dur: 41, beats: [['0:00–0:05', 'A bat and a ball cost a dollar ten.', '$1.10', 'Puzzle written on paper.'], ['0:05–0:12', 'The bat costs a dollar more than the ball. How much is the ball?', 'PAUSE HERE', 'Timer arc in lilac.'], ['0:12–0:22', "Ten cents, right? It's five.", "IT'S 5¢", 'Wrong answer crossed out in pen.'], ['0:22–0:34', 'The answer that comes first is the one you least checked.', 'THE ONE YOU LEAST CHECKED', 'Lit line.'], ['0:34–0:41', 'Count to three before the next fast answer.', 'COUNT TO THREE', 'End card.']],
    caption: 'The answer that comes first is the one you checked least. ¹ From Thinking, Fast and Slow.', watch: ['Leave a real pause at 0:12 for viewers to solve.'] },
  'EN-04': { v: 3, dur: 34, beats: [['0:00–0:05', 'Something went wrong today. Hold onto it.', 'HOLD ONTO IT', 'Night canvas, slow grain.'], ['0:05–0:15', "Between what happened and how you feel, there's a sentence.", 'A SENTENCE', 'Event drawn in solid ink.'], ['0:15–0:26', 'You wrote it.', 'YOU WROTE IT', 'Lit line, lilac underline.'], ['0:26–0:34', 'Epictetus said it first. Write yours down.', '¹ ENCHIRIDION', 'End card.']],
    caption: "It isn't the event. It's the sentence you say about it. ¹ From Enchiridion, Epictetus.", watch: ['Credit as philosophy, not research.'] },
};
const packs = [];
for (const [code, p] of Object.entries(PACKS)) {
  const beats = p.beats.map(([t, vo, onscreen, visual]) => ({ t, vo, onscreen, visual }));
  const base = {
    ideaCode: code, title: `Pack for ${code}`, intro: 'Demo pack.', durationSec: p.dur, beats, voiceover: beats.map((b) => b.vo).join('\n'),
    designPrompt: 'Night canvas, Newsreader for every word on screen, one lilac mark per frame, grain at 6%. (Demo prompt.)', cover: beats[0].onscreen, caption: p.caption, watchouts: p.watch,
    createdBy: 'writer', createdAt: iso(8),
  };
  if (code === 'PM-02') {
    packs.push({ id: `${code}-v1`, data: { ...base, version: 1, beats: beats.slice(0, 3), voiceover: beats.slice(0, 3).map((b) => b.vo).join('\n'), createdAt: iso(6) } });
    Object.assign(base, {
      hooks: [
        { style: 'story', vo: 'Housel used to park cars at a hotel.', onscreen: 'A VALET STORY', why: 'Opens on a scene, not a claim.' },
        { style: 'direct-you', vo: 'Nobody is looking at your car. Not like you think.', onscreen: 'NOBODY IS LOOKING', why: 'Puts the viewer in it from the first word.' },
        { style: 'question', vo: 'Who do you picture when you see a Ferrari?', onscreen: 'WHO DO YOU PICTURE?', why: 'A question the viewer answers wrong.' },
      ],
      story: { belief: 'Nice things earn respect.', truth: 'People picture themselves, not you.', scene: 'A valet stand at night.', turn: 'Never the driver.', feeling: 'Light relief.' },
      critic: { total: 28, scores: { hook: 4, gap: 4, scene: 5, turn: 4, rhythm: 4, truth: 4, ending: 3 }, predictedOwnerScore: 7, notes: ['The ending asks for an action; good.', 'Beat 2 runs long by a second. (Demo notes.)'] },
    });
  }
  if (code === 'SH-01') base.frames = [{ t: '0:00', path: 'frames/SH-01/demo-frame-01.png', note: 'Calendar page on paper, soft top light.' }, { t: '0:20', path: 'frames/SH-01/demo-frame-03.png', note: 'Lit line on a ghost page.' }];
  packs.push({ id: `${code}-v${p.v}`, data: { ...base, version: p.v } });
}
write('packs', packs);

// ---------------------------------------------------------------- jobs: a writer job for AH-04 and Research reading The Courage to Be Disliked
write('jobs', [
  { id: 'writer-AH-04-1', data: { node: 'writer', ideaCode: 'AH-04', request: 'Write production pack', status: 'running', createdAt: iso(11), startedAt: iso(11) } },
  { id: 'writer-FTW-05-0', data: { node: 'writer', ideaCode: 'FTW-05', request: 'Write production pack', status: 'done', createdAt: iso(5), startedAt: iso(5), finishedAt: iso(5) } },
  { id: 'research-the-courage-to-be-disliked-1', data: { node: 'research', bookId: 'the-courage-to-be-disliked', request: 'full', status: 'running', createdAt: iso(11), startedAt: iso(11), progress: { step: 6, of: 13, label: 'Reading chapter 6 of 13' } } },
]);

// ---------------------------------------------------------------- qa
write('qa', [
  { id: 'tfs-01-qa-1', data: { ideaCode: 'TFS-01', packId: 'TFS-01-v5', videoAssetId: 'media/TFS-01/demo-TFS-01_v2.mp4', verdict: 'FIX', at: iso(11), summary: 'Two fixes before it ships. Both are small.',
    measurements: { width: 1080, height: 1920, fps: 30, durationSec: 41, lufs: -13.1, truePeak: -0.8, safeZonePct: 96, firstWordSec: 0.3, silences: [] },
    checks: [
      { name: 'Hook lands in the first second.', status: 'pass' }, { name: 'Source chip appears before 0:05.', status: 'pass' },
      { name: 'Caption at 0:14 sits under the like button.', status: 'warn', t: '0:14' }, { name: 'Loudness is 1 LU hot; target −14.', status: 'fail', t: '0:00' },
      { name: 'One lilac mark per frame.', status: 'pass' },
    ],
    fixes: [{ t: '0:14', issue: 'Caption under the like button.', fix: 'Raise the caption 120 px.' }, { t: '0:00', issue: 'Mix is 1 LU hot.', fix: 'Bring the master down 1 dB.' }],
    images: [{ path: 'qa/TFS-01/demo-0-14.png', label: '0:14 safe zone' }] } },
  { id: 'tfs-01-qa-0', data: { ideaCode: 'TFS-01', packId: 'TFS-01-v5', verdict: 'NO-GO', at: iso(10), summary: 'First cut: no source chip. (Demo.)', checks: [{ name: 'Source chip missing.', status: 'fail' }] } },
  { id: 'en-04-qa-1', data: { ideaCode: 'EN-04', packId: 'EN-04-v3', verdict: 'GO', at: iso(10), summary: 'Clean pass. Ready to post.',
    measurements: { durationSec: 34, lufs: -14.0, safeZonePct: 100, firstWordSec: 0.2 },
    checks: [{ name: 'Hook lands in the first second.', status: 'pass' }, { name: 'Source chip appears before 0:05.', status: 'pass' }, { name: 'Captions clear of UI.', status: 'pass' }, { name: 'Loudness on target.', status: 'pass' }, { name: 'One lilac mark per frame.', status: 'pass' }] } },
]);
write('metrics', Object.entries(POSTED).map(([code, p]) => ({ id: code, data: { ideaCode: code, postedAt: p.date, latest: { views: p.views, avgWatchSec: 19, saves: 410, shares: 220, follows: 35, day: 7 } } })));

// ---------------------------------------------------------------- book notes (the design's chapters; invented summaries, no book text)
// [chapterNo, title, pages, summary, notes[]] - "Became" chips come from page overlap with the book's ideas.
const CH = {
  'thinking-fast-and-slow': [
    [1, 'Two systems', '19–46', 'Fast thinking runs on its own. Slow thinking only joins when something looks wrong.', ['System 1 is automatic and always on.', 'System 2 is effortful and easily tired.']],
    [2, 'The lazy controller', '39–49', "Checking an answer costs effort, so we mostly don't.", ['The bat-and-ball puzzle shows how rarely we check.', 'Effort and self-control draw on the same budget.']],
    [3, 'Answering an easier question', '97–108', 'Faced with a hard question, the mind quietly answers a simpler one.', ['Substitution feels like insight from the inside.']],
    [4, 'The illusion of patterns', '109–118', 'We see causes in randomness because chance is uncomfortable.', ['Small samples produce extreme results.', 'Streaks are normal in random sequences.']],
  ],
  'atomic-habits': [
    [1, 'The surprising power of small habits', '13–20', "Tiny changes look like nothing until they don't.", ['Results lag behind habits.', "The 'plateau of latent potential'."]],
    [2, 'Systems over goals', '23–31', 'Goals set the direction; the system decides the result.', ['Winners and losers share the same goals.']],
    [3, 'Motivation is overrated', '81–150', 'Environment beats intention.', ['Make cues obvious and friction low.']],
  ],
  enchiridion: [
    [1, 'What is up to us', '§1–4', 'Some things are ours; most are not. Confusing the two causes most of our distress.', ['Opinions, desires and aversions are ours.', 'Body, reputation and office are not.']],
    [2, 'Judgements, not events', '§5', "It's our view of a thing that troubles us.", ['Reframe the sentence, not the event.']],
  ],
};
const notes = [];
for (const [book, chs] of Object.entries(CH)) {
  for (const [n, title, pages, summary, ks] of chs) {
    notes.push({ id: `${book}-${String(n).padStart(2, '0')}`, data: { bookId: book, chapterNo: n, title, pages, summary,
      keyIdeas: ks.map((idea) => ({ idea, mechanism: '', pages: '' })), stories: [], claimsToCheck: [], lines: [], createdAt: iso(2) } });
  }
}
// One chapter with every kind of note, for the grouped view.
Object.assign(notes.find((x) => x.id === 'atomic-habits-02').data, {
  stories: [{ who: 'A demo team', what: 'Changed its process, not its target.', pages: '26' }],
  claimsToCheck: [{ claim: 'Demo claim to check.', pages: '24' }],
  lines: [{ text: 'A short invented line for the demo.', page: '27' }],
});
write('booknotes', notes);

// ---------------------------------------------------------------- reports: a Scout report with three candidates that are not on the shelf
write('reports', [
  { id: 'scout-2026-10-06', data: { type: 'scout', at: iso(6), summary: 'Three demo candidates.', candidates: [
    { title: 'Slow Mornings', author: 'Marta Vell', year: '2021', lane: 'Hidden gem', why: 'Invented demo entry.' },
    { title: 'The Cost of Attention', author: 'R. Ono', year: '2019', lane: 'Trending', why: 'Invented demo entry.' },
    { title: 'Small Hours', author: 'J. Aldren', year: '2017', lane: 'Well known', why: 'Invented demo entry.' },
  ] } },
]);

write('settings', [{ id: 'studio', data: { workerSchedule: 'every 30 minutes' } }]);
// ---------------------------------------------------------------- posts: a story set and a carousel for FTW-05
write('posts', [
  { id: 'FTW-05-story-v1', data: { ideaCode: 'FTW-05', kind: 'story', version: 1, createdAt: iso(9), designPrompt: 'Paper stories, Newsreader, one lilac mark. (Demo.)', frames: [
    { n: 1, text: 'How many weeks have you used?', visual: 'Grid on paper.', sticker: { type: 'question', prompt: 'Your number?', options: [] } },
    { n: 2, text: 'Most people guess low.', visual: 'Filled squares.', sticker: { type: 'poll', prompt: 'Did you guess low?', options: ['Yes', 'No'] } },
    { n: 3, text: '¹ Four Thousand Weeks', visual: 'Source card.', sticker: null },
  ] } },
  { id: 'FTW-05-carousel-v1', data: { ideaCode: 'FTW-05', kind: 'carousel', version: 1, createdAt: iso(9), designPrompt: 'Paper carousel, 4:5. (Demo.)', cover: 'YOUR NUMBER', caption: 'Count your weeks. (Demo caption.)', altText: 'A grid of small squares, some filled.', slides: [
    { n: 1, headline: 'Four thousand weeks.', body: 'That is the average.', visual: 'Grid fades in.' },
    { n: 2, headline: 'You have used some.', body: 'Work out how many.', visual: 'Filled squares.' },
    { n: 3, headline: 'The list never ends.', body: 'That was always true.', visual: 'Ghost list.' },
    { n: 4, headline: 'Pick this week.', body: 'What is it for?', visual: 'One lilac square.' },
  ] } },
]);
// ---------------------------------------------------------------- ratings: four scripts rated, so the fifth queues Taste
write('ratings', ['PM-02-v2', 'SH-01-v4', 'AH-02-v2', 'TFS-01-v5'].map((packId, k) => ({ id: packId, data: { packId, ideaCode: packId.replace(/-v\d+$/, ''), version: +packId.split('-v')[1], score: [7, 8, 6, 8][k], note: '', at: iso(3 + k) } })));
for (const c of ['runs', 'chats', 'playbooks']) write(c, []);
console.log('fixtures written to', OUT);
