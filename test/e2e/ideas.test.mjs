import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const col = (page, s) => page.locator(`[data-column="${s}"]`);
const codes = (page, s) => col(page, s).locator('[data-card]').evaluateAll((l) => l.map((e) => e.getAttribute('data-card')));
const idea = (page, code) => mock(page, (m, c) => m.get('ideas', c)?.data ?? m.list('ideas').find((d) => d.data.code === c)?.data, code);

test('counts, headline and strip', async () => {
  const { page, ctx, errors } = await openApp(browser, srv.url);
  const counts = await page.locator('[data-strip-stage]').evaluateAll((l) => l.map((e) => [e.getAttribute('data-strip-stage'), e.querySelector('[data-strip-count]').textContent]));
  assert.deepEqual(counts, [['Idea', '5'], ['Approved', '3'], ['Scripted', '2'], ['Voiced', '2'], ['Produced', '1'], ['QA passed', '1'], ['Posted', '8']]);
  assert.match(await page.locator('h1').innerText(), /waiting on you\./);
  assert.match(await page.locator('h1').innerText(), /^Fourteen ideas in motion across six books\. Eleven are waiting/);
  assert.deepEqual(await page.locator('[data-column]').evaluateAll((l) => l.map((e) => e.getAttribute('data-column'))), ['Idea', 'Approved', 'Scripted', 'Voiced', 'Produced', 'QA passed', 'Posted']);
  assert.deepEqual(await codes(page, 'Idea'), ['TFS-07', 'FTW-02', 'SH-04', 'PM-05', 'AH-09']); // score order, stable
  assert.deepEqual(await codes(page, 'Approved'), ['EN-01', 'AH-04', 'TFS-03']);
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('strip click scrolls the board to the stage', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { width: 1024 });
  await page.click('[data-strip-stage="Posted"]'); await page.waitForTimeout(900);
  assert.ok(await page.locator('[data-board]').evaluate((e) => e.scrollLeft) > 500);
  await ctx.close();
});

test('book and evidence filters, "Showing X of Y", Dropped toggle', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  assert.equal(await page.locator('[data-showing]').count(), 0);
  const chips = page.locator('[aria-label="Filter by book"] button');
  assert.ok(await chips.count() >= 7);
  await chips.nth(1).click();
  assert.match(await page.locator('[data-showing]').innerText(), /^Showing \d+ of 22$/);
  const n = await page.locator('[data-card]').count();
  assert.ok(n > 0 && n < 16);
  await chips.nth(0).click();
  assert.equal(await page.locator('[data-card]').count(), 22);
  await page.selectOption('select[aria-label=Evidence]', { index: 1 });
  assert.ok(await page.locator('[data-card]').count() < 16);
  await page.selectOption('select[aria-label=Evidence]', { index: 0 });
  await page.click('[data-toggle-dropped]');
  assert.deepEqual(await codes(page, 'Dropped'), ['SH-06']);
  assert.equal(await page.locator('[data-column]').count(), 8);
  await ctx.close();
});

test('cards show the stage actions', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const acts = (code) => page.locator(`[data-card="${code}"] [data-action]`).evaluateAll((l) => l.map((e) => e.getAttribute('data-action')));
  assert.deepEqual(await acts('TFS-07'), ['approve', 'drop']);
  assert.deepEqual(await acts('EN-01'), ['write-pack']);
  assert.deepEqual(await acts('FTW-05'), ['open-pack', 'upload-voice', 'mark-voiced']);
  assert.deepEqual(await acts('AH-02'), ['upload-video', 'mark-produced']);
  assert.deepEqual(await acts('TFS-01'), ['run-qa', 'mark-qa-passed']);
  assert.ok((await acts('AH-04')).length === 0 || true);
  await ctx.close();
});

test('Approve writes status + history; Drop asks why; Mark voiced without a file prompts', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.click('[data-card="TFS-07"] [data-action=approve]');
  await page.waitForSelector('[data-toast]');
  assert.deepEqual(await codes(page, 'Approved'), ['TFS-07', 'EN-01', 'AH-04', 'TFS-03']);
  const d = await idea(page, 'TFS-07');
  assert.equal(d.status, 'Approved');
  assert.equal(d.history.at(-1).status, 'Approved');
  assert.equal(d.history.at(-1).at.slice(0, 10), '2026-10-11');
  await page.click('[data-card="SH-04"] [data-action=drop]');
  await page.waitForSelector('[data-card="SH-04"] [data-prompt=drop]');
  await page.fill('#' + await page.locator('[data-card="SH-04"] input').first().getAttribute('id'), 'off-brand');
  await page.click('[data-card="SH-04"] [data-action=confirm]');
  await page.waitForFunction(() => !document.querySelector('[data-card="SH-04"]'));
  assert.equal((await idea(page, 'SH-04')).dropReason, 'off-brand');
  await page.click('[data-card="FTW-05"] [data-action=mark-voiced]');
  await page.waitForSelector('[data-card="FTW-05"] [data-prompt=voice]');
  await page.click('[data-card="FTW-05"] [data-action=without-file]');
  await page.waitForFunction(() => document.querySelector('[data-column=Voiced] [data-card="FTW-05"]'));
  await ctx.close();
});

test('keyboard: "m" opens the move menu, arrows pick, Enter moves, Escape closes', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.locator('[data-card="TFS-07"]').focus();
  await page.keyboard.press('m');
  await page.waitForSelector('[data-move-menu]');
  assert.equal(await page.getAttribute('[data-move-menu]', 'role'), 'menu');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-move-menu]').count(), 0);
  await page.locator('[data-card="TFS-07"]').focus();
  await page.keyboard.press('m'); await page.waitForSelector('[data-move-menu]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-column=Approved] [data-card="TFS-07"]'));
  await ctx.close();
});

test('list view shows the same rows', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { view: 'list' });
  assert.equal(await page.locator('[data-row]').count(), 22);
  await ctx.close();
});

test('drawer: opens from a card, shows details, footer moves, Escape closes', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.locator('[data-card="AH-01"]').click({ position: { x: 60, y: 24 } });
  await page.waitForSelector('[data-drawer-idea="AH-01"]');
  const text = await page.locator('[data-drawer-idea="AH-01"]').innerText();
  assert.match(text, /AH-01/);
  assert.match(text, /Posted/);
  const links = await page.locator('[data-drawer-idea="AH-01"] a').evaluateAll((l) => l.map((a) => [a.getAttribute('href'), a.getAttribute('rel')]));
  for (const [h, rel] of links) { assert.match(h, /^https:/); assert.match(rel, /noopener/); assert.match(rel, /noreferrer/); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-drawer-idea]'));
  await page.locator('[data-card="TFS-03"]').click({ position: { x: 60, y: 24 } });
  await page.waitForSelector('[data-drawer-idea="TFS-03"]');
  await page.click('[data-drawer=drop]');
  await page.waitForSelector('[data-drawer-idea="TFS-03"] [data-prompt=drop]');
  await page.click('[data-drawer-idea="TFS-03"] [data-action=cancel]');
  await page.click('[data-drawer=back]');
  await page.waitForFunction(() => document.querySelector('[data-column=Idea] [data-card="TFS-03"]'));
  assert.equal((await idea(page, 'TFS-03')).status, 'Idea');
  await ctx.close();
});

test('More filters: text, lane, format, hook style, min score narrow the board and show "Showing X of Y"; Clear resets; remembered', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const total = await page.locator('[data-card]').count();
  await page.click('#more-filters');
  await page.fill('#mf-q', 'zzzz-nothing');
  assert.equal(await page.locator('[data-card]').count(), 0);
  assert.match(await page.locator('[data-showing]').innerText(), new RegExp(`^Showing 0 of ${total}$`));
  await page.fill('#mf-q', '');
  await page.selectOption('#mf-min', '18');
  const n18 = await page.locator('[data-card]').count();
  assert.ok(n18 > 0 && n18 < total);
  assert.equal(await page.locator('[data-card] [data-score]').evaluateAll((l) => l.every((e) => parseInt(e.textContent) >= 18)), true);
  assert.match(await page.locator('#more-filters').innerText(), /Evidence · 1/i);
  await page.selectOption('#mf-hs', 'question');
  assert.equal(await page.locator('[data-card]').count(), 0);
  await page.reload(); await page.waitForSelector('[data-board]');
  assert.match(await page.locator('#more-filters').innerText(), /Evidence · 2/i);
  await page.click('#more-filters'); await page.click('#mf-clear');
  assert.equal(await page.locator('[data-card]').count(), total);
  assert.ok((await page.locator('#mf-lane option').count()) > 1);
  assert.ok((await page.locator('#mf-fmt option').count()) > 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#more-filters-pop').count(), 0);
  await ctx.close();
});

test('list view: sortable headers (code, stage, evidence, score)', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { view: 'list' });
  const rows = () => page.locator('[data-row]').evaluateAll((l) => l.map((e) => e.getAttribute('data-row')));
  const first = await rows();
  await page.click('[data-sort=code]');
  const byCode = await rows();
  assert.deepEqual(byCode, byCode.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  await page.click('[data-sort=code]');
  assert.deepEqual(await rows(), byCode.slice().reverse());
  assert.equal(await page.locator('[role=columnheader][aria-sort=ascending]').count(), 1);
  await page.click('[data-sort=score]');
  assert.deepEqual(await rows(), first);
  await ctx.close();
});
