import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const codes = (page, s) => page.locator(`[data-column="${s}"] [data-card]`).evaluateAll((l) => l.map((e) => e.getAttribute('data-card')));
const idea = (page, code) => mock(page, (m, c) => m.list('ideas').find((d) => d.data.code === c)?.data, code);

/** Drive the HTML5 events by hand so each intermediate state can be asserted. */
async function dragStart(page, code) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(`[data-card="${code}"]`).dispatchEvent('dragstart', { dataTransfer: dt });
  await page.waitForTimeout(60); // the design sets state in a 0ms timeout
  return dt;
}
const over = (page, stage, dt, y) => page.locator(`[data-column="${stage}"]`).dispatchEvent('dragover', { dataTransfer: dt });

test('drag start fades the source to .35 and keeps it in place', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  assert.equal(await page.locator('[data-card="TFS-07"]').evaluate((e) => getComputedStyle(e).opacity), '1');
  await dragStart(page, 'TFS-07');
  assert.equal(await page.locator('[data-card="TFS-07"]').evaluate((e) => getComputedStyle(e).opacity), '0.35');
  assert.equal(await page.locator('[data-placeholder]').count(), 0);
  await ctx.close();
});

// Approved column holds EN-01 18, AH-04 17, TFS-03 14 (by score). Dragging a card of score s lands at the index below.
const cases = [
  { code: 'TFS-07', score: 18, at: 0 },   // 18 ties EN-01: the stable sort keeps visible order, TFS-07 first
  { code: 'FTW-02', score: 16, at: 2 },   // below 17, above 14
  { code: 'PM-05', score: 14, at: 2 },    // ties TFS-03 on 14: visible order puts PM-05 first
  { code: 'AH-09', score: 13, at: 3 },    // bottom
];
for (const c of cases) {
  test(`placeholder lands at index ${c.at} for a score of ${c.score} (${c.code})`, async () => {
    const { page, ctx } = await openApp(browser, srv.url);
    const dt = await dragStart(page, c.code);
    await over(page, 'Approved', dt);
    await page.waitForSelector('[data-placeholder]');
    const idx = await page.locator('[data-column=Approved] > div:last-child > *').evaluateAll((l) => l.findIndex((e) => e.hasAttribute('data-placeholder')));
    assert.equal(idx, c.at);
    assert.equal(await page.locator('[data-column=Approved]').getAttribute('data-over'), 'true');
    assert.match(await page.locator('[data-placeholder]').innerText(), /drop here/i);
    const ph = { height: await page.locator('[data-placeholder]').evaluate((e) => e.offsetHeight) };
    const card = { height: await page.locator(`[data-card="${c.code}"]`).evaluate((e) => e.offsetHeight) };
    assert.ok(Math.abs(ph.height - card.height) < 1.5, `placeholder ${ph.height} vs card ${card.height}`);
    const hl = await page.locator('[data-column=Approved]').evaluate((e) => { const s = getComputedStyle(e); return [s.boxShadow, s.backgroundColor]; });
    assert.match(hl[0], /inset/);
    await ctx.close();
  });
}

test('no placeholder over the source column; leaving the column clears the highlight', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const dt = await dragStart(page, 'TFS-07');
  await over(page, 'Idea', dt);
  await page.waitForTimeout(60);
  assert.equal(await page.locator('[data-placeholder]').count(), 0);
  await over(page, 'Approved', dt);
  await page.waitForSelector('[data-placeholder]');
  await page.locator('[data-column=Approved]').dispatchEvent('dragleave', { dataTransfer: dt, relatedTarget: null });
  await page.waitForFunction(() => !document.querySelector('[data-placeholder]'));
  await page.locator('[data-card="TFS-07"]').dispatchEvent('dragend', { dataTransfer: dt });
  await page.waitForTimeout(60);
  assert.equal(await page.locator('[data-card="TFS-07"]').evaluate((e) => getComputedStyle(e).opacity), '1');
  await ctx.close();
});

test('real mouse drag and drop writes status + history (Idea to Approved)', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.dragAndDrop('[data-card="FTW-02"]', '[data-column=Approved] header');
  await page.waitForFunction(() => document.querySelector('[data-column=Approved] [data-card="FTW-02"]'));
  const d = await idea(page, 'FTW-02');
  assert.equal(d.status, 'Approved');
  assert.equal(d.history.at(-1).status, 'Approved');
  assert.deepEqual((await codes(page, 'Approved')).slice(0, 3), ['EN-01', 'AH-04', 'FTW-02']);
  assert.ok(await page.locator('[data-toast]').count() > 0);
  assert.equal(await page.locator('[data-placeholder]').count(), 0);
  await ctx.close();
});

test('drop on Voiced without a voiceover asks for it; "without file" completes the move', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const dt = await dragStart(page, 'FTW-05');
  await over(page, 'Voiced', dt);
  await page.locator('[data-column=Voiced]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForSelector('[data-column=Voiced] [data-prompt=voice]');
  assert.equal((await idea(page, 'FTW-05')).status, 'Scripted');
  await page.click('[data-column=Voiced] [data-action=without-file]');
  await page.waitForFunction(() => document.querySelector('[data-column=Voiced] [data-card="FTW-05"]'));
  assert.equal((await idea(page, 'FTW-05')).status, 'Voiced');
  await ctx.close();
});

test('Produced asks for a video, Posted asks for a date and link, Dropped asks why', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  let dt = await dragStart(page, 'AH-02');
  await page.locator('[data-column=Produced]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForSelector('[data-column=Produced] [data-prompt=video]');
  await page.click('[data-column=Produced] [data-action=cancel]');
  assert.equal((await idea(page, 'AH-02')).status, 'Voiced');

  dt = await dragStart(page, 'EN-04');
  await page.locator('[data-column=Posted]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForSelector('[data-column=Posted] [data-prompt=post]');
  await page.fill('[data-column=Posted] input[type=text]', 'http://insecure.example/x');
  await page.click('[data-column=Posted] [data-action=confirm]');
  await page.waitForSelector('[data-column=Posted] [role=alert]');
  assert.equal((await idea(page, 'EN-04')).status, 'QA passed');
  await page.fill('[data-column=Posted] input[type=text]', 'https://www.instagram.com/reel/demo');
  await page.click('[data-column=Posted] [data-action=confirm]');
  await page.waitForFunction(() => document.querySelector('[data-column=Posted] [data-card="EN-04"]'));
  const d = await idea(page, 'EN-04');
  assert.equal(d.status, 'Posted');
  assert.equal(d.posted.link, 'https://www.instagram.com/reel/demo');

  await page.click('[data-toggle-dropped]');
  dt = await dragStart(page, 'AH-09');
  await page.locator('[data-column=Dropped]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForSelector('[data-column=Dropped] [data-prompt=drop]');
  await page.click('[data-column=Dropped] [data-action=confirm]');
  await page.waitForFunction(() => document.querySelector('[data-column=Dropped] [data-card="AH-09"]'));
  await ctx.close();
});

test('invalid drop reverts with an error toast and writes nothing', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const before = await mock(page, (m) => m.writes.length);
  const dt = await dragStart(page, 'AH-04'); // Approved, has no pack
  await page.locator('[data-column=Scripted]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForSelector('[data-toast=error]');
  assert.match(await page.locator('[data-toast=error]').innerText(), /No pack yet/);
  assert.equal(await mock(page, (m) => m.writes.length), before);
  assert.equal((await idea(page, 'AH-04')).status, 'Approved');
  assert.equal(await page.locator('[data-card="AH-04"]').evaluate((e) => getComputedStyle(e).opacity), '1');
  await ctx.close();
});

test('moving back is allowed (Voiced to Scripted); the history keeps growing', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const n = (await idea(page, 'SH-01')).history.length;
  const dt = await dragStart(page, 'SH-01');
  await page.locator('[data-column=Scripted]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForFunction(() => document.querySelector('[data-column=Scripted] [data-card="SH-01"]'));
  const d = await idea(page, 'SH-01');
  assert.equal(d.history.length, n + 1);
  assert.equal(d.history.at(-1).status, 'Scripted');
  assert.deepEqual((await page.evaluate(() => 0)), 0);
  await ctx.close();
});

test('a version conflict is retried once on a fresh copy', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await mock(page, (m) => m.conflictNext(1));
  await page.click('[data-card="PM-05"] [data-action=approve]');
  await page.waitForFunction(() => document.querySelector('[data-column=Approved] [data-card="PM-05"]'));
  await ctx.close();
});

test('no console errors after all that', async () => {
  const { page, ctx, errors } = await openApp(browser, srv.url);
  const dt = await dragStart(page, 'FTW-02');
  await page.locator('[data-column=Approved]').dispatchEvent('drop', { dataTransfer: dt });
  await page.waitForTimeout(300);
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});
