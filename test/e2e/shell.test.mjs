import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const state = (page) => page.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const aside = r('#sidebar'), cmd = r('#cmdbar'), main = r('#main'), util = r('#utilrow');
  return { asideW: aside.width, asideRight: aside.right, cmdH: cmd.height, cmdBottom: cmd.bottom, mainLeft: main.left, mainTop: main.top, utilH: util.height,
    sideHidden: document.getElementById('sidebar').getAttribute('aria-hidden') === 'true', cmdHidden: document.getElementById('cmdbar').getAttribute('aria-hidden') === 'true',
    xscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});

test('Sidebar is the default; Command bar is hidden', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const s = await state(page);
  assert.equal(s.asideW, 264);
  assert.equal(s.cmdH, 0);
  assert.equal(s.utilH, 64);
  assert.equal(s.mainLeft, 264);
  assert.equal(s.sideHidden, false);
  assert.equal(s.cmdHidden, true);
  assert.equal(await page.locator('#sidebar').getAttribute('inert'), null);
  assert.notEqual(await page.locator('#cmdbar').getAttribute('inert'), null);
  await ctx.close();
});

test('Ctrl+\\ hides the sidebar and shows the command bar, and back; the collapse buttons do the same', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(700);
  let s = await state(page);
  assert.ok(s.asideW <= 1, `sidebar width ${s.asideW}`);
  assert.ok(s.cmdH > 100 && s.cmdH < 130, `command bar height ${s.cmdH}`);
  assert.ok(s.utilH <= 1, `util row ${s.utilH}`);
  assert.ok(s.mainLeft <= 1);
  assert.equal(s.sideHidden, true);
  assert.notEqual(await page.locator('#sidebar').getAttribute('inert'), null);
  await page.keyboard.press('Meta+\\'); await page.waitForTimeout(700);
  s = await state(page);
  assert.equal(s.asideW, 264); assert.equal(s.cmdH, 0);
  await page.click('#side-hide'); await page.waitForTimeout(700);
  assert.ok((await state(page)).asideW <= 1);
  await page.click('#side-show'); await page.waitForTimeout(700);
  assert.equal((await state(page)).asideW, 264);
  await ctx.close();
});

// Sample the layout every animation frame during the transition.
async function sampleTransition(page, press) {
  await page.evaluate(() => {
    window.__frames = [];
    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const aside = r('#sidebar'), cmd = r('#cmdbar'), main = r('#main'), h1 = r('h1');
      const hit = document.elementFromPoint(main.left + 24, 520);
      window.__frames.push({ t, asideW: aside.width, asideRight: aside.right, cmdH: cmd.height, cmdBottom: cmd.bottom, mainLeft: main.left, mainTop: main.top, h1Left: h1.left, h1Top: h1.top,
        hitInMain: !!(hit && hit.closest('#main')), xscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth });
      if (t < 800) requestAnimationFrame(tick);
    };
    window.__t0 = t0; requestAnimationFrame(tick);
  });
  await press();
  await page.waitForTimeout(900);
  return page.evaluate(() => window.__frames);
}
const near = (frames, ms) => frames.reduce((a, b) => (Math.abs(b.t - ms) < Math.abs(a.t - ms) ? b : a));

for (const dir of ['hide', 'show']) {
  test(`transition frames (${dir}): no overlap with the content area, no jump beyond the animated width`, async () => {
    const { page, ctx } = await openApp(browser, srv.url, { sideHidden: dir === 'show' });
    const frames = await sampleTransition(page, () => page.keyboard.press('Control+\\'));
    assert.ok(frames.length > 10, `captured ${frames.length} frames`);
    for (const f of frames) {
      assert.ok(Math.abs(f.mainLeft - f.asideW) < 1.5, `content left ${f.mainLeft} vs animated width ${f.asideW} at ${f.t | 0}ms`);
      assert.ok(f.asideRight <= f.mainLeft + 0.5, `sidebar overlaps content at ${f.t | 0}ms`);
      assert.ok(f.cmdBottom <= f.mainTop + 0.5, `command bar overlaps content at ${f.t | 0}ms`);
      assert.ok(Math.abs(f.h1Left - (f.mainLeft + 48)) < 1.5, `headline moved sideways at ${f.t | 0}ms`);
      assert.ok(f.hitInMain, `something other than the content sits over its left edge at ${f.t | 0}ms`);
      assert.equal(f.xscroll, false);
    }
    // The four checkpoints: 0, 150, 300, 500 ms are in progress, then settled.
    const [a, b, c, d] = [0, 150, 300, 500].map((ms) => near(frames, ms));
    const w = dir === 'hide' ? [a.asideW, b.asideW, c.asideW, d.asideW] : [-a.asideW, -b.asideW, -c.asideW, -d.asideW];
    assert.ok(w[0] >= w[1] && w[1] >= w[2] && w[2] >= w[3] && w[0] > w[3], `width should move monotonically: ${w.join(', ')}`);
    const last = frames.at(-1);
    assert.ok(dir === 'hide' ? last.asideW <= 1 : last.asideW === 264);
    await ctx.close();
  });
}

test('the collapsed state is remembered', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(700);
  await page.reload(); await page.waitForSelector('[data-board]');
  let s = await state(page);
  assert.ok(s.asideW <= 1, `sidebar width ${s.asideW}`); assert.ok(s.cmdH > 100);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(700);
  await page.reload(); await page.waitForSelector('[data-board]');
  s = await state(page);
  assert.equal(s.asideW, 264); assert.equal(s.cmdH, 0);
  await ctx.close();
});

test('prefers-reduced-motion switches instantly', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { reducedMotion: true });
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(80);
  const s = await state(page);
  assert.ok(s.asideW <= 1, `sidebar width ${s.asideW}`);
  assert.ok(s.cmdH > 100, `command bar already open (${s.cmdH})`);
  assert.ok(s.utilH <= 1, `util row ${s.utilH}`);
  await ctx.close();
});

test('command bar contents: pill, status, theme toggle, step tabs with the lilac dot on the active tab, System', async () => {
  const { page, ctx } = await openApp(browser, srv.url, { sideHidden: true });
  const q = (s) => page.locator(s);
  const pill = await q('[role=search]').first().boundingBox();
  assert.equal(Math.round(pill.width), 560); assert.equal(Math.round(pill.height), 46);
  assert.equal(await q('#global-search').getAttribute('placeholder'), 'Jump to an idea, book, pack or run');
  assert.match(await q('#cmdbar [data-status]').innerText(), /2 running/);
  const tabs = await q('#cmdbar nav [data-nav]').allInnerTexts();
  assert.deepEqual(tabs.map((t) => t.replace(/\s+/g, ' ').trim()), ['01 · DISCOVER', '02 · LIBRARY', '03 · IDEAS', '04 · STUDIO', '05 · INSIGHTS', 'SYSTEM']);
  const dot = await q('#cmdbar [data-nav=ideas] span').first().evaluate((e) => { const c = getComputedStyle(e); return [c.width, c.backgroundColor, c.display]; });
  assert.deepEqual(dot, ['6px', 'rgb(184, 164, 244)', 'block']);
  assert.equal(await q('#cmdbar [data-nav=discover] span').first().evaluate((e) => getComputedStyle(e).display), 'none');
  assert.ok(await q('#cmdbar [data-theme-btn]').count() === 2);
  const cmd = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('cmdbar')); return [c.position, c.top, c.zIndex]; });
  assert.deepEqual(cmd, ['sticky', '0px', '20']);
  await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(100);
  assert.equal(Math.round((await q('#cmdbar').boundingBox()).y), 0, 'sticky while scrolled');
  await ctx.close();
});

test('theme toggle sets body[data-theme], not <html>, and is remembered', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg').trim());
  assert.equal(await bg(), '#121110');
  await page.click('#sidebar [data-theme-btn=paper]');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'paper');
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-theme')), false);
  assert.equal(await bg(), '#ECE6D9');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lilac').trim()), '#6B52CC');
  await page.reload(); await page.waitForSelector('[data-board]');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'paper');
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(700);
  await page.click('#cmdbar [data-theme-btn=night]');
  assert.equal(await bg(), '#121110');
  await ctx.close();
});

test('hash routing: Ideas is the default; tabs, sub-tabs and ids; Discover/Insights/System still show hero + "Arrives in the next build"', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  assert.equal(await page.locator('[data-board]').count(), 1);
  await page.click('#sidebar [data-nav=discover]');
  await page.waitForSelector('[data-screen=discover]');
  assert.equal(await page.evaluate(() => location.hash), '#discover');
  assert.match(await page.locator('h1').innerText(), /Scout found three candidates this week\. Three aren't on the shelf yet\./);
  assert.match(await page.locator('[data-arrives]').innerText(), /Arrives in the next build/);
  await page.goto(`${srv.url}/#studio/script`); await page.waitForSelector('[data-screen=studio] [data-pack-grid]');
  assert.match(await page.locator('h1').innerText(), /Six packs in production\./);
  await page.evaluate(() => { location.hash = '#studio/qa/TFS-01-v5'; }); await page.waitForSelector('[data-pack="TFS-01-v5"] #qa-report');
  await page.evaluate(() => { location.hash = '#packs'; }); await page.waitForSelector('[data-pack-grid]');
  await page.evaluate(() => { location.hash = '#insights'; }); await page.waitForSelector('[data-screen=insights]');
  await page.evaluate(() => { location.hash = '#system'; }); await page.waitForSelector('[data-screen=system]');
  assert.match(await page.locator('h1').innerText(), /Two jobs running\. Nothing has failed today\./);
  await page.evaluate(() => { location.hash = '#library'; }); await page.waitForSelector('[data-screen=library]');
  assert.match(await page.locator('h1').innerText(), /Eight books on the shelf\. Two still need research\./);
  await page.evaluate(() => { location.hash = '#nonsense'; }); await page.waitForSelector('[data-board]');
  await ctx.close();
});

test('nav counts in the sidebar', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  const t = (n) => page.locator(`#sidebar [data-nav=${n}]`).innerText().then((x) => x.replace(/\s+/g, ' '));
  assert.match(await t('discover'), /3 new/); assert.match(await t('library'), /8$/); assert.match(await t('ideas'), /16$/); assert.match(await t('studio'), /6$/);
  await ctx.close();
});

test('global search: sidebar and command bar, keyboard, groups, 560 wide panel', async () => {
  const { page, ctx } = await openApp(browser, srv.url);
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#global-search-util');
  await page.keyboard.type('question');
  await page.waitForSelector('#gs-pop [data-g=Ideas]');
  assert.ok(await page.locator('#gs-pop mark').count() > 0);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-drawer-idea]');
  assert.equal(await page.locator('#gs-pop').count(), 0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(700);
  await page.keyboard.press('Meta+k');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'global-search');
  await page.keyboard.type('atomic');
  await page.waitForSelector('#gs-pop');
  const w = await page.locator('#gs-pop').boundingBox();
  const p = await page.locator('[role=search]').first().boundingBox();
  assert.equal(Math.round(w.width), 560); assert.equal(Math.round(w.width), Math.round(p.width));
  assert.match((await page.locator('#gs-pop').textContent()).toLowerCase(), /books/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#gs-pop').count(), 0);
  await page.fill('#global-search', 'zzzz'); await page.waitForSelector('#gs-empty');
  await ctx.close();
});

for (const width of [1440, 1024]) {
  for (const hidden of [false, true]) {
    test(`no body x-scroll and a clean console at ${width}px (${hidden ? 'command bar' : 'sidebar'})`, async () => {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, sideHidden: hidden });
      await page.waitForTimeout(300);
      assert.equal((await state(page)).xscroll, false);
      await page.click('[data-toggle-dropped]'); await page.waitForTimeout(200);
      assert.equal((await state(page)).xscroll, false);
      assert.deepEqual(errors.filter((e) => !benign(e)), []);
      await ctx.close();
    });
  }
}
