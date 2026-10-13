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

// ---------------------------------------------------------------- books
const BOOKS = [
  ['TFS', 'thinking-fast-and-slow', 'Thinking, Fast and Slow', 'Daniel Kahneman'],
  ['AH', 'atomic-habits', 'Atomic Habits', 'James Clear'],
  ['EN', 'enchiridion', 'Enchiridion', 'Epictetus'],
  ['FTW', 'four-thousand-weeks', 'Four Thousand Weeks', 'Oliver Burkeman'],
  ['PM', 'the-psychology-of-money', 'The Psychology of Money', 'Morgan Housel'],
  ['SH', 'stumbling-on-happiness', 'Stumbling on Happiness', 'Daniel Gilbert'],
];
const bookId = Object.fromEntries(BOOKS.map(([c, id]) => [c, id]));
write('books', BOOKS.map(([code, id, title, author], k) => ({
  id, data: { title, author, code, lane: 'Well known', why: 'Demo shelf entry.', status: 'researched', order: k + 1, notesCount: code === 'AH' ? 2 : code === 'TFS' ? 1 : 0, ideaCount: 0, researchedAt: iso(2) },
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
  'SH-01': { voiceAssetId: 'uploads/ideas/SH-01/voice-demo.m4a', voiceFileName: 'voice-demo.m4a', voiceUploadedAt: iso(9) },
  'TFS-01': { videoAssetId: 'uploads/ideas/TFS-01/final-demo.mp4', videoFileName: 'final-demo.mp4', videoSize: 9437184, videoUploadedAt: iso(10), qaLast: { qaId: 'tfs-01-qa-1', verdict: 'FIX', at: iso(10) } },
  'EN-04': { qaLast: { qaId: 'en-04-qa-1', verdict: 'GO', at: iso(10) } },
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

// ---------------------------------------------------------------- packs (latest version per scripted idea, plus one older)
const PACKV = { 'FTW-05': 3, 'PM-02': 2, 'SH-01': 4, 'AH-02': 2, 'TFS-01': 5, 'EN-04': 3 };
const packs = [];
for (const [code, v] of Object.entries(PACKV)) {
  const idea = ideas.find((i) => i.id === code).data;
  for (const ver of code === 'FTW-05' ? [v - 1, v] : [v]) {
    packs.push({ id: `${code.toLowerCase()}-v${ver}`, data: { ideaCode: code, version: ver, title: `Pack for ${code}`, intro: 'Demo pack.', durationSec: 42, beats: [{ t: '0:00', vo: idea.hook, onscreen: 'Hook' }, { t: '0:12', vo: idea.quietPart, onscreen: 'The quiet part' }] } });
  }
}
write('packs', packs);

// ---------------------------------------------------------------- jobs (one writer job running => "1 running")
write('jobs', [
  { id: 'writer-AH-04-1', data: { node: 'writer', ideaCode: 'AH-04', request: 'Write production pack', status: 'running', createdAt: iso(11), startedAt: iso(11) } },
  { id: 'writer-FTW-05-0', data: { node: 'writer', ideaCode: 'FTW-05', request: 'Write production pack', status: 'done', createdAt: iso(5), startedAt: iso(5), finishedAt: iso(5) } },
]);

// ---------------------------------------------------------------- qa, metrics
write('qa', [
  { id: 'tfs-01-qa-1', data: { ideaCode: 'TFS-01', packId: 'tfs-01-v5', verdict: 'FIX', at: iso(10), summary: 'Two fixes before it ships (demo).' } },
  { id: 'en-04-qa-1', data: { ideaCode: 'EN-04', packId: 'en-04-v3', verdict: 'GO', at: iso(10), summary: 'Clean (demo).' } },
]);
write('metrics', Object.entries(POSTED).map(([code, p]) => ({ id: code, data: { ideaCode: code, postedAt: p.date, latest: { views: p.views, avgWatchSec: 19, saves: 410, shares: 220, follows: 35, day: 7 } } })));

// ---------------------------------------------------------------- book notes (chapters overlap AH-01's pages; none overlap TFS-07)
write('booknotes', [
  { id: 'atomic-habits-2', data: { bookId: 'atomic-habits', chapterNo: 2, title: 'Systems and goals (demo notes)', pages: '18–31', keyIdeas: [{ idea: 'A system is what you do every day; a goal is what you want.', mechanism: 'Demo mechanism line.', pages: '23–25' }, { idea: 'Unrelated idea elsewhere in the chapter.', mechanism: '', pages: '30' }], stories: [{ who: 'A demo team', what: 'Changed its process, not its target.', pages: '26' }], claimsToCheck: [{ claim: 'Demo claim to check.', pages: '24' }], lines: [{ text: 'A short invented line for the demo.', page: '27' }] } },
  { id: 'atomic-habits-9', data: { bookId: 'atomic-habits', chapterNo: 9, title: 'Environment (demo notes)', pages: '80–95', keyIdeas: [{ idea: 'Cues live in rooms.', mechanism: '', pages: '81–84' }], stories: [], claimsToCheck: [], lines: [] } },
  { id: 'thinking-fast-and-slow-12', data: { bookId: 'thinking-fast-and-slow', chapterNo: 12, title: 'A far-away chapter (demo notes)', pages: '300–320', keyIdeas: [{ idea: 'Nothing to do with TFS-07.', mechanism: '', pages: '305' }], stories: [], claimsToCheck: [], lines: [] } },
]);

// ---------------------------------------------------------------- reports: a Scout report with three candidates that are not on the shelf
write('reports', [
  { id: 'scout-2026-10-06', data: { type: 'scout', at: iso(6), summary: 'Three demo candidates.', candidates: [
    { title: 'Slow Mornings', author: 'Marta Vell', year: '2021', lane: 'Hidden gem', why: 'Invented demo entry.' },
    { title: 'The Cost of Attention', author: 'R. Ono', year: '2019', lane: 'Trending', why: 'Invented demo entry.' },
    { title: 'Small Hours', author: 'J. Aldren', year: '2017', lane: 'Well known', why: 'Invented demo entry.' },
  ] } },
]);

write('settings', [{ id: 'studio', data: { workerSchedule: 'every 30 minutes' } }]);
for (const c of ['runs', 'posts', 'chats', 'ratings', 'playbooks']) write(c, []);
console.log('fixtures written to', OUT);
