import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const open = (hash, o = {}) => openApp(browser, srv.url, { sideHidden: true, hash, ...o });
const doc = (page, coll, id) => mock(page, (m, c, i) => m.get(c, i)?.data ?? null, coll, id);
const jobs = (page) => mock(page, (m) => m.list('jobs').map((d) => ({ id: d.id, ...d.data })));
const clip = async (page) => { await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url }); };

test('Ask Scout: conversations list (newest first, design dates), first one open, hook cards and the Sources line', async () => {
  const { page, ctx, errors } = await open('#discover');
  await page.waitForSelector('#scout-thread [data-turn=scout]');
  assert.deepEqual((await page.locator('aside[aria-label=Conversations] [id^=chat-scout]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')), ['Angles on decision fatigue Today, 10:42', 'Is the 21-day habit thing real? Yesterday', "Stoic ideas that aren't clichés 7 Oct"]);
  assert.equal(await page.locator('#chat-scout-1').getAttribute('aria-current'), 'true');
  assert.equal(await page.locator('[data-scout-idea]').count(), 3);
  assert.match(await page.locator('#scout-thread').innerText(), /Sources · Kahneman ch\. 9 · Clear ch\. 12 · Hagger et al\. 2016 \(replication\)/);
  assert.equal(await page.locator('#scout-thinking').count(), 0);
  await page.click('#chat-scout-2');
  await page.waitForFunction(() => location.hash === '#discover/ask/scout-2');
  assert.match(await page.locator('#scout-thread').innerText(), /Lally et al\. 2010/);
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('Add to Ideas creates ideas/{code} at status Idea (book code when on the shelf, XX otherwise)', async () => {
  const { page, ctx } = await open('#discover/ask/scout-1');
  await page.click('#add-idea-1-0');
  await page.waitForFunction(() => /Added to Ideas/.test(document.getElementById('add-idea-1-0').textContent));
  const d = await doc(page, 'ideas', 'TFS-08');
  assert.deepEqual([d.code, d.bookId, d.status, d.createdBy, d.chatId, d.history[0].status], ['TFS-08', 'thinking-fast-and-slow', 'Idea', 'scout-chat', 'scout-1', 'Idea']);
  assert.equal(d.hook, "You're not tired of deciding. You've been answering easier questions all day.");
  assert.equal(await page.locator('#add-idea-1-0').isDisabled(), true);
  await page.click('#add-idea-1-2');
  await page.waitForFunction(() => /Added/.test(document.getElementById('add-idea-1-2').textContent));
  assert.ok(await doc(page, 'ideas', 'FTW-06'));
  // A book that isn't on the shelf gets XX.
  await mock(page, (m) => m.put('chats', 'scout-2', { turns: [...m.get('chats', 'scout-2').data.turns, { role: 'assistant', content: 'One more.', at: '2026-10-11T11:00:00Z', ideas: [{ bookTitle: 'Range', hook: 'Late starters are sampling.' }] }] }));
  await page.click('#chat-scout-2');
  await page.click('#add-idea-2-0');
  await page.waitForFunction(() => /Added/.test(document.getElementById('add-idea-2-0')?.textContent || ''));
  const x = await doc(page, 'ideas', 'XX-01');
  assert.equal(x.bookId, undefined); assert.equal(x.fromBook, 'Range');
  await ctx.close();
});

test('sending: Enter sends (Shift+Enter is a newline), the turn is saved, a scout chat job is queued, "thinking" until the worker answers', async () => {
  const { page, ctx } = await open('#discover/ask/scout-1');
  await page.click('#scout-input');
  await page.keyboard.type('Any sources on choice overload?');
  await page.keyboard.press('Shift+Enter');
  assert.match(await page.inputValue('#scout-input'), /\n$/);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#scout-thinking');
  assert.equal(await page.inputValue('#scout-input'), '');
  const c = await doc(page, 'chats', 'scout-1');
  assert.equal(c.turns.at(-1).role, 'user'); assert.equal(c.turns.at(-1).content, 'Any sources on choice overload?');
  const j = (await jobs(page)).find((x) => x.kind === 'chat' && x.status === 'queued');
  assert.deepEqual([j.node, j.chatId, j.request], ['scout', 'scout-1', 'Any sources on choice overload?']);
  assert.ok(c.jobs.includes(j.id));
  assert.equal(await mock(page, (m) => m.fires), 1);
  assert.equal(await page.locator('#scout-send').isDisabled(), true, 'one question at a time');
  // The worker runs, then appends the assistant turn.
  await mock(page, (m, id) => m.put('jobs', id, { status: 'running' }), j.id);
  await page.waitForFunction(() => /Reading the shelf/.test(document.getElementById('scout-thinking').textContent));
  await mock(page, (m, id) => { m.put('chats', 'scout-1', { turns: [...m.get('chats', 'scout-1').data.turns, { role: 'assistant', content: 'Two good ones:\n- Schwartz, 2004\n- Chernev et al., 2015', at: '2026-10-11T12:01:00Z', sources: ['Chernev et al. 2015'] }] }); m.put('jobs', id, { status: 'done' }); }, j.id);
  await page.waitForFunction(() => !document.getElementById('scout-thinking'));
  const last = page.locator('[data-turn=scout]').last();
  assert.equal(await last.locator('li').count(), 2);
  assert.match(await last.innerText(), /Sources · Chernev et al\. 2015/);
  await ctx.close();
});

test('a failed chat job says so in the thread', async () => {
  const { page, ctx } = await open('#discover/ask/scout-1');
  await page.fill('#scout-input', 'Will this fail?');
  await page.click('#scout-send');
  await page.waitForSelector('#scout-thinking');
  const j = (await jobs(page)).find((x) => x.kind === 'chat' && x.status === 'queued');
  await mock(page, (m, id) => m.put('jobs', id, { status: 'failed', error: 'Scout timed out' }), j.id);
  await page.waitForSelector('#scout-failed');
  assert.match(await page.locator('#scout-failed').innerText(), /Scout timed out/);
  await ctx.close();
});

test('New conversation + a suggestion chip sends immediately and creates the chat', async () => {
  const { page, ctx } = await open('#discover');
  await page.click('#chat-new');
  await page.waitForFunction(() => location.hash === '#discover/ask/new');
  assert.equal(await page.locator('[data-turn]').count(), 0);
  await page.click('#scout-sugg-0');
  await page.waitForSelector('#scout-thinking');
  const id = await page.evaluate(() => location.hash.split('/')[2]);
  assert.match(id, /^scout-\d+-/);
  const c = await doc(page, 'chats', id);
  assert.equal(c.title, "What's trending in money this week?"); assert.equal(c.turns.length, 1); assert.equal(c.jobs.length, 1);
  assert.equal((await jobs(page)).find((x) => x.id === c.jobs[0]).chatId, id);
  await page.waitForSelector(`#chat-${id}[aria-current=true]`);
  await ctx.close();
});

test('Send as research run: the brief is the editable last message; it queues a scout job; "Open report" when it lands', async () => {
  const { page, ctx } = await open('#discover/ask/scout-1');
  await page.click('#scout-brief-open');
  assert.equal(await page.inputValue('#scout-brief'), "What's a fresh angle on decision fatigue that we could source from the shelf?");
  await page.fill('#scout-brief', 'Find replications of decision fatigue studies since 2016.');
  await page.click('#scout-brief-send');
  await page.waitForFunction(() => !document.getElementById('scout-brief'));
  const j = (await jobs(page)).find((x) => x.request === 'Find replications of decision fatigue studies since 2016.');
  assert.deepEqual([j.node, j.kind, j.chatId], ['scout', undefined, 'scout-1']);
  assert.ok((await doc(page, 'chats', 'scout-1')).jobs.includes(j.id));
  await page.waitForSelector(`#askjob-${j.id}`);
  await mock(page, (m, id) => { m.put('reports', 'scout-brief-x', { type: 'scout', at: '2026-10-11T12:00:00Z', jobId: id, request: 'Find replications', summary: 'Brief result.', candidates: [] }); m.put('jobs', id, { status: 'done' }); }, j.id);
  await page.click(`#askrep-${j.id}`);
  await page.waitForFunction(() => /Brief result/.test(document.getElementById('rep-head')?.textContent || ''));
  assert.equal(await page.evaluate(() => location.hash), '#discover/reports/scout-brief-x');
  await ctx.close();
});

test('suggested books in a reply: Add to book queue, On the shelf', async () => {
  const { page, ctx } = await open('#discover/ask/scout-3');
  await page.waitForSelector('[data-scout-book]');
  assert.equal(await page.locator('#cadd-enchiridion').innerText(), 'On the shelf');
  await page.click('#cadd-meditations');
  await page.waitForFunction(() => /In queue/.test(document.getElementById('cadd-meditations').textContent));
  const b = await doc(page, 'books', 'meditations');
  assert.deepEqual([b.title, b.status, b.lane], ['Meditations', 'Candidate', 'Well known']);
  await ctx.close();
});

test('Scout reports: kind line, summary, candidate cards (On the shelf, risk, sources), lane + hide filters, Add to book queue, briefs, Run Scout now', async () => {
  const { page, ctx } = await open('#discover/reports');
  await page.waitForSelector('#cands');
  assert.match(await page.locator('#rep-head').innerText(), /^SCOUT · WEEKLY · 6 OCT 2026\n+Attention and choice dominate this week\./);
  assert.equal(await page.locator('[data-cand]').count(), 6);
  const cd = page.locator('[data-cand=the-courage-to-be-disliked]');
  assert.equal(await cd.locator('[data-on-shelf]').count(), 1);
  assert.match(await cd.innerText(), /Risk: Long dialogue[\s\S]*Publisher catalogues · bestseller lists \(UK, US\)\s+On the shelf/);
  assert.equal(await page.locator('#cand-count').innerText(), 'Showing 6 of 6');
  await page.click('#hide-shelf');
  assert.equal(await page.locator('#cand-count').innerText(), 'Showing 5 of 6');
  assert.equal(await page.locator('#hide-shelf').innerText(), 'Showing new books only');
  await page.click('[data-lane="Hidden gem"]');
  assert.deepEqual(await page.locator('[data-cand]').evaluateAll((l) => l.map((e) => e.getAttribute('data-cand'))), ['the-scout-mindset']);
  await page.click('#add-the-scout-mindset');
  await page.waitForFunction(() => document.getElementById('add-the-scout-mindset').textContent === 'In queue ✓');
  const b = await doc(page, 'books', 'the-scout-mindset');
  assert.deepEqual([b.title, b.author, b.lane, b.status, b.order], ['The Scout Mindset', 'Julia Galef', 'Hidden gem', 'Candidate', 9]);
  await page.click('[data-lane="All"]');
  await page.click('#rep-mode-briefs');
  assert.match(await page.locator('#rep-request').innerText(), /Books about regret that aren't self-help\./);
  assert.match(await page.locator('#rep-head').innerText(), /^YOUR BRIEF · 3 OCT 2026/);
  await page.click('#rep-mode-all');
  assert.deepEqual(await page.locator('#rep-select option').allInnerTexts(), ['6 Oct 2026 · Scout · weekly', '3 Oct 2026 · Your brief', '29 Sep 2026 · Scout · manual run']);
  await page.click('#hide-shelf');
  await page.selectOption('#rep-select', '2');
  await page.waitForSelector('[data-cand=four-thousand-weeks] [data-on-shelf]');
  await page.click('#run-scout');
  await page.waitForFunction(() => document.getElementById('run-scout').textContent === 'Scout running…');
  const j = (await jobs(page)).find((x) => x.node === 'scout' && x.request === 'Manual run');
  assert.equal(j.status, 'queued');
  await ctx.close();
});

test('Trends: week line, summary, jump chips, actions (General chip, code opens the drawer), hashtags copy, week select, Run Trends now', async () => {
  const { page, ctx } = await open('#discover/trends');
  await clip(page);
  await page.waitForSelector('#tr-summary');
  assert.equal(await page.locator('#tr-week').innerText(), 'TRENDS · INSTAGRAM · WEEK OF 5 OCTOBER');
  assert.deepEqual(await page.locator('nav[aria-label="Jump to section"] a').allInnerTexts(), ['ACTIONS', 'PLATFORM', 'FORMATS', 'HOOKS', 'HASHTAGS', 'AUDIO', 'TIMES', 'SOURCES']);
  assert.match(await page.locator('#tr-actions').innerText(), /General\nRetire hustle-adjacent hooks for two weeks\./);
  assert.match(await page.locator('#tr-platform').innerText(), /Source · Instagram creators account/);
  await page.click('#copy-tags');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '#booksummary #psychology #stoicism #habits #bookstagram');
  await page.waitForFunction(() => document.getElementById('copy-tags').textContent === 'Copied');
  await page.click('#ta-0');
  await page.waitForSelector('[data-drawer-idea="FTW-05"]');
  await page.goBack(); await page.waitForSelector('#tr-select');
  await page.selectOption('#tr-select', '1');
  await page.waitForFunction(() => document.getElementById('tr-week').textContent.includes('28 SEPTEMBER') || document.getElementById('tr-week').textContent.includes('28 September'));
  assert.equal(await page.locator('#tr-platform').count(), 0);
  await page.click('#run-trends');
  await page.waitForFunction(() => document.getElementById('run-trends').textContent === 'Trends running…');
  await ctx.close();
});

test('empty states: no chats, no reports', async () => {
  const { page, ctx } = await open('#discover/reports');
  await mock(page, (m) => { for (const d of m.list('reports')) m.put('reports', d.id, { type: 'gone' }); });
  await page.waitForSelector('#rep-empty');
  await page.click('#sub-discover-trends');
  await page.waitForSelector('#tr-empty');
  await ctx.close();
});

for (const width of [1440, 1024]) {
  test(`discover: no body x-scroll, clean console at ${width}px`, async () => {
    for (const hash of ['#discover', '#discover/reports', '#discover/trends']) {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, hash, readySelector: '[data-screen=discover]' });
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, hash);
      assert.deepEqual(errors.filter((e) => !benign(e)), [], hash);
      await ctx.close();
    }
  });
}
