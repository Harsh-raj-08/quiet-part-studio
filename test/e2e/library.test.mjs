import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, benign, mock } from '../helpers.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await srv.close(); });

const open = (hash, o = {}) => openApp(browser, srv.url, { sideHidden: true, hash, ...o });
const doc = (page, coll, id) => mock(page, (m, c, i) => m.get(c, i)?.data ?? null, coll, id);
const jobs = (page) => mock(page, (m) => m.list('jobs').map((d) => ({ id: d.id, ...d.data })));

test('shelf: headline, 4 columns at 1440, code chip, topic, title/author type, counts, three footer states', async () => {
  const { page, ctx, errors } = await open('#library');
  await page.waitForSelector('#shelf');
  assert.equal(await page.locator('h1').innerText(), 'Eight books on the shelf. Two still need research.');
  assert.equal(await page.locator('#shelf').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), 4);
  assert.equal(await page.locator('[data-book]').count(), 8);
  const tfs = page.locator('#book-thinking-fast-and-slow');
  assert.match(await tfs.innerText(), /^TFS\nMIND\nThinking, Fast and Slow\nDaniel Kahneman\n[\s\S]*38 notes\s+4 ideas\s+1 posted\s+Open notes/);
  assert.deepEqual(await tfs.locator('h3').evaluate((e) => { const s = getComputedStyle(e); return [s.fontSize, s.fontWeight]; }), ['27px', '300']);
  assert.match(await page.locator('#book-atomic-habits').innerText(), /2 posted/);
  const cd = page.locator('#book-the-courage-to-be-disliked');
  assert.match(await cd.locator('[data-research-live]').innerText(), /RESEARCH · READING CHAPTER 6 OF 13/);
  assert.equal(await page.locator('#research-running-the-courage-to-be-disliked').isDisabled(), true);
  assert.equal(await page.locator('#research-quick-mans-search-for-meaning').innerText(), 'Run research');
  await page.click('#open-notes-atomic-habits');
  await page.waitForSelector('#chapters');
  assert.equal(await page.evaluate(() => location.hash), '#library/notes/atomic-habits');
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('Add a book: the pill toggles to Cancel; Title, Author, Code, Lane; validation; writes books/{slug}', async () => {
  const { page, ctx } = await open('#library');
  await page.click('#hero-add');
  assert.equal(await page.locator('#hero-add').innerText(), 'Cancel');
  await page.click('#ab-add');
  assert.equal(await page.locator('#add-book [role=alert]').count() + (await page.evaluate(() => !document.getElementById('ab-title').checkValidity() ? 1 : 0)), 1);
  await page.fill('#ab-title', 'Slow Mornings');
  await page.fill('#ab-author', 'Marta Vell');
  await page.fill('#ab-code', 'tfs');
  assert.equal(await page.inputValue('#ab-code'), 'TFS');
  await page.click('#ab-add');
  assert.match(await page.locator('#add-book [role=alert]').innerText(), /already used by Thinking, Fast and Slow/);
  await page.fill('#ab-code', 'sm');
  await page.selectOption('#ab-lane', 'Time');
  await page.click('#ab-add');
  await page.waitForSelector('#book-slow-mornings');
  const b = await doc(page, 'books', 'slow-mornings');
  assert.deepEqual([b.title, b.author, b.code, b.topic, b.status, b.order], ['Slow Mornings', 'Marta Vell', 'SM', 'Time', 'Candidate', 9]);
  assert.equal(await page.locator('#add-book').count(), 0);
  assert.equal(await page.locator('#book-slow-mornings').getAttribute('aria-current'), 'true');
  await ctx.close();
});

test('Book file & code: upload PDF to studio/books/{id}/…, type check, code save, research depth and job shapes', async () => {
  const { page, ctx } = await open('#library');
  const id = 'mans-search-for-meaning';
  await mock(page, (m, i) => m.put('books', i, { code: '' }), id);
  // Run research without a file explains and opens the fold.
  await page.click(`#research-quick-${id}`);
  await page.waitForSelector(`#bkdet-body-${id}`);
  assert.match(await page.locator('[data-toast=error]').innerText(), /Upload the book first/);
  assert.equal(await page.locator(`#research-run-${id}`).isDisabled(), true);
  await page.setInputFiles(`#book-file-${id}`, { name: 'notes.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await page.waitForFunction(() => /PDF or EPUB/.test(document.querySelector('[data-toast=error]')?.textContent || ''));
  await page.setInputFiles(`#book-file-${id}`, { name: 'msm.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') });
  await page.waitForFunction((i) => /msm\.pdf/.test(document.getElementById(`book-file-info-${i}`)?.textContent || ''), id);
  const b = await doc(page, 'books', id);
  assert.match(b.filePath, /^books\/mans-search-for-meaning\/.+msm\.pdf$/);
  assert.equal(b.fileName, 'msm.pdf');
  // Full needs a code: prefilled from the title, saved explicitly.
  assert.match(await page.locator(`#research-why-${id}`).innerText(), /Save a 2 or 3 letter code/);
  assert.match(await page.inputValue(`#book-code-${id}`), /^[A-Z]{2,3}$/, 'prefilled from the title');
  await page.fill(`#book-code-${id}`, 'MS');
  await page.click(`#book-code-save-${id}`);
  await page.waitForFunction((i) => !document.getElementById(`research-why-${i}`), id);
  assert.equal((await doc(page, 'books', id)).code, 'MS');
  await page.click(`#bkdet-body-${id} button:has-text("Notes only")`);
  await page.click(`#research-run-${id}`);
  await page.waitForSelector(`#book-job-${id}`);
  const j = (await jobs(page)).find((x) => x.node === 'research' && x.bookId === id);
  assert.deepEqual([j.request, j.status], ['notes only', 'queued']);
  assert.equal(await mock(page, (m) => m.fires), 1);
  assert.equal(await page.locator(`#research-running-${id}`).isDisabled(), true);
  await ctx.close();
});

test('chapter notes: two columns, digest, counts, first chapter open, summary line, grouped notes, Became chips by page overlap', async () => {
  const { page, ctx } = await open('#library/notes');
  await page.waitForSelector('#chapters');
  assert.deepEqual(await page.locator('[role=group][aria-label=Book] button').allInnerTexts(), ['TFS', 'AH', 'EN', 'FTW', 'PM', 'SH'], 'only researched books');
  assert.match(await page.locator('#bd-digest').innerText(), /^Two systems run your thinking/);
  assert.match(await page.locator('#bd-counts').innerText(), /4 chapters\s+4 ideas\s+Researched 2 Oct/);
  assert.equal(await page.locator('[id^=chap-body-]').count(), 1);
  const ch1 = page.locator('#chap-thinking-fast-and-slow-01');
  assert.match(await ch1.innerText(), /01\nTwo systems\n2 notes · 1 idea\n–\n+Fast thinking runs on its own/);
  assert.deepEqual(await ch1.locator('[data-became]').allInnerTexts(), ['TFS-01']);
  await page.click('#chap-btn-thinking-fast-and-slow-03');
  assert.equal(await page.locator('#chap-body-thinking-fast-and-slow-01').count(), 0, 'one open at a time');
  assert.deepEqual(await page.locator('#chap-thinking-fast-and-slow-03 [data-became]').allInnerTexts(), ['TFS-07']);
  await page.click('#libbook-atomic-habits');
  await page.waitForSelector('#chap-atomic-habits-01');
  await page.click('#chap-btn-atomic-habits-02');
  const t = await page.locator('#chap-body-atomic-habits-02').innerText();
  assert.match(t, /KEY IDEAS[\s\S]*STORIES\nA demo team: Changed its process, not its target\. · p\. 26[\s\S]*CLAIMS TO CHECK[\s\S]*LINES\n“A short invented line for the demo\.”/);
  assert.deepEqual(await page.locator('#chap-atomic-habits-02 [data-became]').allInnerTexts(), ['AH-01']);
  // A chip opens the idea drawer.
  await page.click('#chap-atomic-habits-02 [data-became="AH-01"]');
  await page.waitForSelector('[data-drawer-idea="AH-01"]');
  await ctx.close();
});

test('chapter notes: empty state for a researched book without chapter docs', async () => {
  const { page, ctx } = await open('#library/notes/four-thousand-weeks');
  await page.waitForSelector('#notes-empty');
  assert.equal(await page.locator('#notes-empty').innerText(), 'Chapter notes appear once research has run on this book.');
  await ctx.close();
});

test('idea bank: the design table ranked by score, stamps, stage, evidence/stage filters, row opens the drawer', async () => {
  const { page, ctx } = await open('#library/bank/atomic-habits');
  await page.waitForSelector('#bank');
  assert.deepEqual(await page.locator('[data-bank-row]').evaluateAll((l) => l.map((e) => e.getAttribute('data-bank-row'))), ['AH-01', 'AH-04', 'AH-02', 'AH-06', 'AH-09']);
  assert.match(await page.locator('[data-bank-row="AH-01"]').innerText(), /^01\nAH-01\nYou don't rise to your goals\. You fall to your systems\.\nREEL\nSUPPORTED\nPosted\n18$/);
  await page.selectOption('#bank-ev', 'MIXED');
  assert.deepEqual(await page.locator('[data-bank-row]').evaluateAll((l) => l.map((e) => e.getAttribute('data-bank-row'))), ['AH-02', 'AH-06']);
  await page.selectOption('#bank-ev', 'all');
  await page.selectOption('#bank-st', 'Idea');
  assert.deepEqual(await page.locator('[data-bank-row]').evaluateAll((l) => l.map((e) => e.getAttribute('data-bank-row'))), ['AH-09']);
  await page.selectOption('#bank-st', 'Posted');
  await page.selectOption('#bank-fmt', 'Reel');
  assert.equal(await page.locator('[data-bank-row]').count(), 2);
  await page.selectOption('#bank-st', 'Approved');
  await page.waitForSelector('#bank-empty');
  await page.selectOption('#bank-st', 'all'); await page.selectOption('#bank-fmt', 'all');
  await page.click('[data-bank-row="AH-04"]');
  await page.waitForSelector('[data-drawer-idea="AH-04"]');
  await ctx.close();
});

test('search: a chapter-note result opens that chapter; a book result scrolls to its card', async () => {
  const { page, ctx } = await open('#ideas');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('lazy controller');
  await page.waitForSelector('#gs-pop');
  await page.locator('#gs-pop [role=option]').first().click();
  await page.waitForSelector('#chap-body-thinking-fast-and-slow-02');
  assert.equal(await page.evaluate(() => location.hash), '#library/notes/thinking-fast-and-slow');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Enchiridion');
  await page.waitForSelector('#gs-pop [data-g=Books]');
  await page.locator('#gs-pop [data-g=Books][role=option]').first().click();
  await page.waitForSelector('#book-enchiridion[aria-current=true]');
  await ctx.close();
});

for (const width of [1440, 1024]) {
  test(`library screens: no body x-scroll, clean console at ${width}px`, async () => {
    for (const hash of ['#library', '#library/notes/atomic-habits', '#library/bank/thinking-fast-and-slow']) {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, hash, readySelector: '[data-screen=library]' });
      await page.click('#hero-add');
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, hash);
      assert.deepEqual(errors.filter((e) => !benign(e)), [], hash);
      await ctx.close();
    }
  });
}
