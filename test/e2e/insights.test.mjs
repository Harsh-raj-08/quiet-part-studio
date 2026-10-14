import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const open = (hash, o = {}) => openApp(browser, srv.url, { sideHidden: true, hash, ...o });
const doc = (page, coll, id) => mock(page, (m, c, i) => m.get(c, i)?.data ?? null, coll, id);
const jobs = (page) => mock(page, (m) => m.list('jobs').map((d) => ({ id: d.id, ...d.data })));
const png = (name) => ({ name, mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });

test('Log stats: headline, KPI tiles (followers from account snapshots), per-post rows with the 7-day expectation', async () => {
  const { page, ctx, errors } = await open('#insights');
  await page.waitForSelector('#ins-kpis');
  assert.equal(await page.locator('h1').innerText(), 'Eight posts, 118k views. Supported claims got twice the sends.');
  const k = await page.locator('#ins-kpis > div').allInnerTexts();
  assert.deepEqual(k.map((t) => t.replace(/\s+/g, ' ').trim()), ['VIEWS 118k —', 'AVG. WATCH 67% —', 'SENDS 4,230 —', 'FOLLOWERS +1,180 −8% vs prior']);
  assert.equal(await page.locator('#kpi-followers span').last().evaluate((e) => getComputedStyle(e).color), 'rgb(224, 104, 76)');
  assert.match(await page.locator('#h-log').innerText(), /DASHED IS THE 7-DAY EXPECTATION/);
  const rows = await page.locator('[id^=statrow-]').evaluateAll((l) => l.map((e) => e.id.slice(8)));
  assert.deepEqual(rows, ['FTW-01', 'PM-01', 'AH-01', 'TFS-05', 'EN-02', 'SH-02', 'AH-06', 'PM-03']);
  assert.match(await page.locator('#statrow-AH-01').innerText(), /^28 Sep\nYou don't rise to your goals\. You fall to your systems\.\n31\.0k\n78%\n1,240 sends$/);
  // FTW-01 (newest) has 6 earlier reels with day-7 numbers: its tick is the 7-day median; PM-03 (oldest) falls back to the median of all.
  assert.equal(await page.locator('#statrow-FTW-01 [data-exp]').getAttribute('data-exp'), '7-day');
  assert.equal(await page.locator('#statrow-PM-03 [data-exp]').getAttribute('data-exp'), 'median');
  assert.match(await page.locator('#statrow-FTW-01 [role=img]').getAttribute('aria-label'), /9,800 views, 7-day expectation 11,700/);
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('Followers fall back to "Follows from reels" until the account collection has data', async () => {
  const { page, ctx } = await open('#insights');
  await page.waitForSelector('#kpi-followers');
  await mock(page, (m) => { const s = m.list('account'); m.seed({ ...Object.fromEntries(['books', 'booknotes', 'ideas', 'packs', 'posts', 'jobs', 'runs', 'reports', 'qa', 'metrics', 'chats', 'ratings', 'playbooks', 'settings'].map((c) => [c, m.list(c)])), account: [] }); void s; });
  await page.waitForFunction(() => /FOLLOWS FROM REELS/.test(document.getElementById('kpi-followers')?.textContent?.toUpperCase() || ''));
  assert.match(await page.locator('#kpi-followers').innerText(), /\+1,180/);
  await ctx.close();
});

test('a row opens: snapshot history, screenshots; Add screenshots uploads to studio/stats/{code}/ and queues read-screenshots', async () => {
  const { page, ctx } = await open('#insights');
  await page.click('#statrow-PM-01');
  await page.waitForSelector('#snaps-PM-01');
  assert.equal(await page.locator('#snaps-PM-01 tbody tr').count(), 3);
  assert.equal(await page.locator('#shot-PM-01-0').count(), 1);
  await page.click('#shot-PM-01-0'); await page.waitForSelector('#frov'); await page.keyboard.press('Escape');
  await page.setInputFiles('#stats-files-PM-01', [{ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('x') }]);
  await page.waitForFunction(() => /PNG, JPEG or WebP/.test(document.querySelector('[data-toast=error]')?.textContent || ''));
  await page.setInputFiles('#stats-files-PM-01', Array.from({ length: 7 }, (_, i) => png(`s${i}.png`)));
  await page.waitForFunction(() => /Up to 6/.test(document.querySelector('[data-toast=error]')?.textContent || ''));
  await page.setInputFiles('#stats-files-PM-01', [png('overview.png'), png('engagement.png')]);
  await page.waitForSelector('#stats-job-PM-01');
  const m = await doc(page, 'metrics', 'PM-01');
  assert.equal(m.screenshots.length, 3);
  assert.match(m.screenshots[1].path, /^stats\/PM-01\/.+overview\.png$/);
  const j = (await jobs(page)).find((x) => x.kind === 'read-screenshots');
  assert.deepEqual([j.node, j.ideaCode, j.files.length, j.status], ['review', 'PM-01', 2, 'queued']);
  assert.deepEqual(j.files, m.screenshots.slice(1).map((s) => s.path));
  assert.equal(await mock(page, (x) => x.fires), 1);
  await ctx.close();
});

test('Edit numbers saves a new snapshot (source "edit") and updates the row', async () => {
  const { page, ctx } = await open('#insights');
  await page.click('#statrow-FTW-01');
  await page.click('#stats-edit-FTW-01');
  assert.equal(await page.inputValue('#stat-views-FTW-01'), '9800');
  await page.fill('#stat-views-FTW-01', '15,400');
  await page.fill('#stat-shares-FTW-01', '505');
  await page.click('#sx-save-FTW-01');
  await page.waitForFunction(() => !document.getElementById('sx-FTW-01'));
  const m = await doc(page, 'metrics', 'FTW-01');
  assert.equal(m.latest.views, 15400); assert.equal(m.latest.shares, 505); assert.equal(m.latest.source, 'edit'); assert.equal(m.latest.day, 3);
  assert.equal(m.snapshots.at(-1).source, 'edit');
  await page.waitForFunction(() => /15\.4k[\s\S]*505 sends/.test(document.getElementById('statrow-FTW-01').textContent));
  await ctx.close();
});

test('Profile screenshot queues read-profile; Log today\'s numbers opens a row', async () => {
  const { page, ctx } = await open('#insights');
  await page.setInputFiles('#profile-file', [png('profile.png')]);
  await page.waitForFunction(() => /Reading followers/.test(document.getElementById('profile-upload').textContent));
  const j = (await jobs(page)).find((x) => x.kind === 'read-profile');
  assert.equal(j.node, 'review'); assert.match(j.files[0], /^stats\/profile\/.+profile\.png$/);
  await page.click('#log-today');
  await page.waitForSelector('#statbody-FTW-01');
  await ctx.close();
});

test('Weekly review: the editorial article, idea chips, scorecard, history, Run review now; learnings diff + Accept', async () => {
  const { page, ctx } = await open('#insights/review');
  await page.waitForSelector('#review');
  const t = await page.locator('#review').innerText();
  assert.match(t, /^WEEKLY REVIEW · WEEK OF 5 OCTOBER · WRITTEN BY REVIEW\nThe systems line carried the week\. The money post found a quieter audience\.\n/);
  assert.match(t, /WHAT WORKED\n+AH-01\s*did 31k views and 1,240 sends/);
  assert.match(t, /Supported claims averaged roughly twice the sends of philosophy posts\.[\s\S]*MEDIUM/);
  assert.match(t, /WHAT DIDN'T\n+EN-02\s*underperformed/);
  assert.match(t, /NEXT WEEK\n+TFS-01\s*Ship TFS-01/);
  assert.match(t, /SCORECARD[\s\S]*MEDIAN VIEWS\n21,700/);
  assert.equal(await page.locator('#review-headline').evaluate((e) => getComputedStyle(e).fontSize), '40px');
  // learnings proposal
  assert.deepEqual(await page.locator('#lrn-prop [data-diff=old]').allInnerTexts(), ['- [medium] Supported claims get more sends than philosophy posts.']);
  assert.deepEqual(await page.locator('#lrn-prop [data-diff=new]').allInnerTexts(), ['- [medium] Supported claims get about twice the sends of philosophy posts.', '- [early] Put the source chip after the first beat.']);
  await page.click('#lrn-accept');
  await page.waitForFunction(() => !document.getElementById('lrn-prop'));
  assert.equal((await doc(page, 'playbooks', 'learnings')).text.split('\n').length, 3);
  // history + run
  await page.selectOption('#review-select', '1');
  await page.waitForFunction(() => document.getElementById('review-headline')?.textContent === 'A quiet week: two reels, both above the median.');
  await page.click('#run-review');
  await page.waitForSelector('#review-job');
  assert.equal((await jobs(page)).find((x) => x.node === 'review' && x.request === 'Weekly review').status, 'queued');
  await page.click('[data-rv-idea="TFS-05"]');
  await page.waitForSelector('[data-drawer-idea="TFS-05"]');
  await ctx.close();
});

test('learnings: Dismiss hides the proposal (remembered)', async () => {
  const { page, ctx } = await open('#insights/review');
  await page.click('#lrn-dismiss');
  await page.waitForFunction(() => !document.getElementById('lrn-prop'));
  await page.reload(); await page.waitForSelector('#learnings');
  assert.equal(await page.locator('#lrn-prop').count(), 0);
  await ctx.close();
});

test('What works: avg views + avg sends per group, sorted by sends; six groupings with the design hook labels; metric select; early tags', async () => {
  const { page, ctx } = await open('#insights/works');
  await page.waitForSelector('#works');
  const rows = await page.locator('[data-group]').evaluateAll((l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(rows, ['Supported 21.3k AVG VIEWS 890 AVG SENDS n = 3', 'Story 12.7k AVG VIEWS 415 AVG SENDS n = 2', 'MixedEARLY 10.9k AVG VIEWS 330 AVG SENDS n = 1', 'Philosophy 8.9k AVG VIEWS 200 AVG SENDS n = 2']);
  await page.click('#wg-hook');
  assert.deepEqual(await page.locator('[data-group]').evaluateAll((l) => l.map((e) => e.getAttribute('data-group'))), ['Direct', 'Surprise fact', 'Reframe', 'Myth fix']);
  await page.click('#wg-weekday'); await page.waitForSelector('[data-group="Sat"]');
  await page.click('#wg-book'); await page.waitForSelector('[data-group="AH"]');
  await page.selectOption('#works-metric', 'save');
  assert.match(await page.locator('[data-group] [data-value]').first().innerText(), /%$/);
  assert.match(await page.locator('#works-small').innerText(), /Small sample: 8 reels/);
  await page.reload(); await page.waitForSelector('#works');
  assert.equal(await page.locator('#wg-book').getAttribute('aria-pressed'), 'true', 'grouping remembered');
  await ctx.close();
});

test('What works needs 3 reels with stats', async () => {
  const { page, ctx } = await open('#insights/works');
  await page.waitForSelector('#works');
  await mock(page, (m) => { for (const d of m.list('metrics').slice(2)) m.put('metrics', d.id, { latest: null, snapshots: [] }); });
  await page.waitForSelector('#works-empty');
  await ctx.close();
});

test('Taste: profile, ratings trend with the Critic tick, proposal Accept, Run taste now', async () => {
  const { page, ctx } = await open('#insights/taste');
  await page.waitForSelector('#taste-profile');
  assert.match(await page.locator('#taste-profile').innerText(), /Prefers endings that hand the viewer one small action\.\s*MEDIUM/);
  assert.equal((await page.locator('#taste-count').innerText()).toLowerCase(), '4 scripts rated · average 7.3');
  assert.equal(await page.locator('[data-rating]').count(), 4);
  assert.equal(await page.locator('[data-rating="PM-02-v2"] [data-pred]').count(), 1);
  await mock(page, (m) => m.put('playbooks', 'taste-proposed', { node: 'taste', at: '2026-10-11T09:00:00Z', text: '- [medium] Prefers endings that hand the viewer one small action.\n- [strong] Likes a source chip after the first beat.' }));
  await page.waitForSelector('#taste-prop');
  await page.click('#taste-accept');
  await page.waitForFunction(() => !document.getElementById('taste-prop'));
  assert.match((await doc(page, 'playbooks', 'taste-profile')).text, /\[strong\] Likes a source chip/);
  await page.click('#run-taste');
  await page.waitForSelector('#taste-job');
  await ctx.close();
});

for (const width of [1440, 1024]) {
  test(`insights: no body x-scroll, clean console at ${width}px`, async () => {
    for (const hash of ['#insights', '#insights/review', '#insights/works', '#insights/taste']) {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, hash, readySelector: '[data-screen=insights]' });
      if (hash === '#insights') { await page.click('#statrow-PM-01'); await page.click('#stats-edit-PM-01'); }
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, hash);
      assert.deepEqual(errors.filter((e) => !benign(e)), [], hash);
      await ctx.close();
    }
  });
}
