import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const open = (hash, o = {}) => openApp(browser, srv.url, { sideHidden: true, hash, ...o });
const doc = (page, coll, id) => mock(page, (m, c, i) => m.get(c, i)?.data ?? null, coll, id);

test('Runs: the design table (node, target, note, status, when + took), live running time, node filter', async () => {
  const { page, ctx, errors } = await open('#system');
  await page.waitForSelector('#runs-table');
  assert.equal(await page.locator('h1').innerText(), 'Worker online, two jobs running. Nothing has failed today.');
  assert.equal(await page.locator('[data-row]').count(), 9);
  const row = (id) => page.locator(`[data-row="${id}"]`).innerText().then((t) => t.replace(/\s+/g, ' ').trim());
  assert.equal(await row('run-writer-ah04'), 'WRITER AH-04 Drafting production pack v1 RUNNING now 1m 12s');
  assert.equal(await row('run-research-cd'), 'RESEARCH CD Reading chapter 6 of 13 RUNNING now 8m 40s');
  assert.equal(await row('run-qa-tfs01'), 'QA TFS-01 Fix verdict: loudness, caption safe zone DONE 09:14 48s');
  assert.equal(await row('run-scout-w41'), 'SCOUT — Weekly report: nine candidates DONE Mon 06:00 3m 31s');
  assert.equal(await row('run-art-pm02'), 'ART PM-02 Frame 03 rejected by safety filter FAILED Fri 11:07 22s');
  assert.deepEqual(await page.locator('[data-status=queued] span').count(), 0);
  const pill = await page.locator('[data-row="run-writer-ah04"] span').nth(3).evaluate((e) => { const s = getComputedStyle(e); return [s.color, s.boxShadow !== 'none']; });
  assert.deepEqual(pill, ['rgb(184, 164, 244)', true]);
  await page.click('#rf-art');
  assert.equal(await page.locator('[data-row]').count(), 2);
  await page.click('#rf-review');
  assert.equal(await page.locator('[data-row]').count(), 1);
  assert.equal(await page.locator('#rf-taste').count(), 0);
  await page.click('#rf-all');
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('Jobs: queue with status chips (queued is dashed calm), node filter, Run worker now', async () => {
  const { page, ctx } = await open('#system/jobs');
  await page.waitForSelector('#jobs-table');
  assert.match(await page.locator('#worker-line').innerText(), /Worker online · checks every 30 minutes/);
  assert.equal(await page.locator('#jobs-count').innerText(), 'Showing 5 of 5');
  const q = page.locator('[data-row="art-AH-04-1"] span').nth(3);
  assert.deepEqual(await q.evaluate((e) => { const s = getComputedStyle(e); return [s.borderTopStyle, s.color]; }), ['dashed', 'rgb(143, 181, 218)']);
  assert.match(await page.locator('[data-row="art-AH-04-1"]').innerText(), /next/);
  await page.click('#jf-running');
  assert.equal(await page.locator('[data-row]').count(), 2);
  await page.click('#jf-all');
  await page.click('#rf-scout');
  assert.match(await page.locator('[data-row]').innerText(), /chat · Angles on decision fatigue/);
  await page.click('#run-worker');
  await page.waitForFunction(() => /Worker started/.test(document.querySelector('[data-toast]')?.textContent || ''));
  assert.equal(await mock(page, (m) => m.fires), 1);
  await ctx.close();
});

test('Settings: the five design settings are editable and stored in settings/studio; read-only info rows', async () => {
  const { page, ctx } = await open('#system/settings');
  await page.waitForSelector('#settings');
  assert.equal(await page.inputValue('#set-writer-lane'), 'careful');
  await page.selectOption('#set-writer-lane', 'quick');
  await page.waitForFunction(() => window.__mock.get('settings', 'studio').data.writerLane === 'quick');
  await page.selectOption('#set-cadence', 'Daily');
  await page.waitForFunction(() => window.__mock.get('settings', 'studio').data.cadence === 'Daily');
  assert.equal(await page.getAttribute('#set-auto-art', 'aria-checked'), 'true');
  await page.click('#set-auto-art');
  await page.waitForFunction(() => document.getElementById('set-auto-art').getAttribute('aria-checked') === 'false');
  await page.click('#set-space-philosophy');
  await page.waitForFunction(() => window.__mock.get('settings', 'studio').data.spacePhilosophy === true);
  const s = await doc(page, 'settings', 'studio');
  assert.deepEqual([s.writerLane, s.cadence, s.autoArt, s.notifyQa, s.spacePhilosophy, s.workerSchedule], ['quick', 'Daily', false, true, true, 'every 30 minutes'], 'other fields kept');
  assert.match(await page.locator('#info-worker').innerText(), /Checks the queue every 30 minutes\.[\s\S]*ONLINE/);
  assert.match(await page.locator('#info-security').innerText(), /never posts, deletes or spends/);
  assert.match(await page.locator('#info-playbooks').innerText(), /learnings \(\d+ characters\)/);
  await ctx.close();
});

test('heartbeat: online under 13 h, else "idle since …" in the headline and the sidebar status', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { hash: '#system' });
  await page.waitForSelector('#runs-table');
  assert.match(await page.locator('#sidebar [data-status]').innerText(), /^Worker online · 2 running$/);
  await mock(page, (m) => m.put('settings', 'studio', { workerSeenAt: '2026-10-11T00:30:00.000Z' }));
  await page.waitForFunction(() => /^Worker online/.test(document.querySelector('h1').textContent));
  await mock(page, (m) => m.put('settings', 'studio', { workerSeenAt: '2026-10-09T08:00:00.000Z' }));
  await page.waitForFunction(() => document.querySelector('h1').textContent.startsWith('Worker idle since 9 Oct.'));
  assert.match(await page.locator('#sidebar [data-status]').innerText(), /^Worker idle since 9 Oct · 2 running$/);
  await ctx.close();
});

for (const width of [1440, 1024]) {
  test(`system: no body x-scroll, clean console at ${width}px`, async () => {
    for (const hash of ['#system', '#system/jobs', '#system/settings']) {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, hash, readySelector: '[data-screen=system]' });
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, hash);
      assert.deepEqual(errors.filter((e) => !benign(e)), [], hash);
      await ctx.close();
    }
  });
}
