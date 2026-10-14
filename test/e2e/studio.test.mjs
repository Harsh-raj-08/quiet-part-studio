import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, startServer, openApp, benign, mock, OUT } from '../helpers.mjs';

let srv, browser, VIDEO;
before(async () => {
  srv = await startServer(); browser = await chromium.launch();
  // A real 16 s clip so seeking can be checked (ffmpeg when available; the seek test skips otherwise).
  VIDEO = path.join(OUT, 'test-clip.webm');
  if (!fs.existsSync(VIDEO)) { try { execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x222222:s=180x320:d=16:r=10', '-c:v', 'libvpx', '-b:v', '50k', '-y', VIDEO]); } catch { VIDEO = null; } }
});
after(async () => { await browser.close(); await srv.close(); });

const open = (hash, o = {}) => openApp(browser, srv.url, { sideHidden: true, hash, ...o });
const doc = (page, coll, id) => mock(page, (m, c, i) => m.get(c, i)?.data ?? null, coll, id);
const jobs = (page) => mock(page, (m) => m.list('jobs').map((d) => ({ id: d.id, ...d.data })));
const clip = async (page) => { await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url }); };
const readClip = (page) => page.evaluate(() => navigator.clipboard.readText());

test('grid: six packs in production, stage chips with counts, 4 columns at 1440, segments from the data, QA stamps', async () => {
  const { page, ctx, errors } = await open('#studio');
  await page.waitForSelector('[data-pack-grid]');
  assert.deepEqual(await page.locator('[data-pack-card]').evaluateAll((l) => l.map((e) => e.getAttribute('data-pack-card'))), ['FTW-05', 'PM-02', 'SH-01', 'AH-02', 'TFS-01', 'EN-04']);
  assert.deepEqual(await page.locator('[data-stage-chip]').allInnerTexts().then((l) => l.map((t) => t.replace(/\s+/g, ' ').trim())), ['All packs 6', 'Scripted 2', 'Voiced 2', 'Produced 1', 'QA passed 1']);
  const cols = await page.locator('[data-pack-grid]').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  assert.equal(cols, 4);
  const lit = (code) => page.locator(`[data-pack-card="${code}"] [data-seg]`).evaluateAll((l) => l.map((e) => e.getAttribute('data-on') === 'true'));
  assert.deepEqual(await lit('FTW-05'), [true, false, false, false, false]);
  assert.deepEqual(await lit('SH-01'), [true, true, true, false, false]); // frames exist, voice uploaded
  assert.deepEqual(await lit('TFS-01'), [true, false, true, true, true]);
  assert.equal(await page.locator('[data-pack-card="TFS-01"] [data-qa-stamp]').evaluate((e) => getComputedStyle(e).color), 'rgb(224, 104, 76)'); // caution
  assert.equal(await page.locator('[data-pack-card="EN-04"] [data-qa-stamp]').evaluate((e) => getComputedStyle(e).color), 'rgb(134, 192, 143)'); // grow
  assert.match(await page.locator('[data-pack-card="FTW-05"]').innerText(), /COVER · 4,000 WEEKS[\s\S]*FROM · FOUR THOUSAND WEEKS[\s\S]*0:42 · v3/);
  await page.click('[data-stage-chip="Voiced"]');
  assert.deepEqual(await page.locator('[data-pack-card]').evaluateAll((l) => l.map((e) => e.getAttribute('data-pack-card'))), ['SH-01', 'AH-02']);
  await page.click('[data-stage-chip="all"]');
  await page.click('[data-pack-card="FTW-05"]');
  await page.waitForSelector('[data-pack="FTW-05-v3"]');
  assert.equal(await page.evaluate(() => location.hash), '#studio/script/FTW-05-v3');
  assert.deepEqual(errors.filter((e) => !benign(e)), []);
  await ctx.close();
});

test('detail header: hook as title, FROM line, meta row, chips switch packs, back to the grid', async () => {
  const { page, ctx } = await open('#studio/script/FTW-05-v3');
  await page.waitForSelector('#pack-title');
  assert.equal(await page.locator('#pack-title').innerText(), "The average life is about four thousand weeks. Count how many you've used.");
  assert.equal((await page.locator('#pack-title').evaluate((e) => getComputedStyle(e).fontSize)), '38px');
  const head = await page.locator('[data-pack] header').innerText();
  assert.match(head, /FROM · FOUR THOUSAND WEEKS · OLIVER BURKEMAN/);
  assert.match(head, /COVER · 4,000 WEEKS\s+REEL · 9:16\s+0:42\s+5 BEATS\s+PACK V3/);
  assert.equal(await page.locator('[id^="ver-"]').count(), 0, 'one version: no version pills');
  await page.click('#pcode-TFS-01');
  await page.waitForSelector('[data-pack="TFS-01-v5"]');
  await page.click('#sub-studio-qa'); await page.waitForSelector('#qa-report');
  await page.click('#pcode-EN-04');
  await page.waitForSelector('[data-pack="EN-04-v3"] #qa-verdict');
  assert.equal(await page.evaluate(() => location.hash), '#studio/qa/EN-04-v3', 'switching packs keeps the sub-tab');
  await page.click('#pack-back');
  await page.waitForSelector('[data-pack-grid]');
  await ctx.close();
});

test('copy buttons use the exact SPEC formats and relabel to "Copied"', async () => {
  const { page, ctx } = await open('#studio/script/PM-02-v2');
  await clip(page);
  await page.waitForSelector('#copy-design');
  await page.click('#copy-design');
  await page.waitForFunction(() => document.getElementById('copy-design').textContent === 'Copied');
  const d = await readClip(page);
  assert.ok(d.startsWith('Night canvas, Newsreader for every word on screen'));
  assert.ok(d.includes('\n\n[0:00–0:05]\nV.O: Housel used to park cars at a hotel.\n[On-screen]: A VALET STORY\n\n[0:05–0:15]\nV.O: '));
  await page.click('#copy-voice');
  assert.equal(await readClip(page), (await doc(page, 'packs', 'PM-02-v2')).voiceover);
  await page.waitForFunction(() => document.getElementById('copy-design').textContent === 'Copy for Claude Design', null, { timeout: 3000 });
  await page.click('#copy-caption');
  assert.equal(await readClip(page), 'Cover: A VALET STORY\n\nThe car is for the person looking at it, not the person in it. ¹ From The Psychology of Money.');
  await ctx.close();
});

test('clipboard refused: the text is shown pre-selected instead', async () => {
  const { page, ctx } = await open('#studio/script/FTW-05-v3');
  await page.waitForSelector('#copy-voice');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true }); });
  await page.click('#copy-voice');
  await page.waitForSelector('#copy-fallback');
  assert.match(await page.inputValue('#copy-fb-text'), /^Four thousand weeks\. That's the whole thing\.\n/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('copy-fallback'));
  await ctx.close();
});

test('script: 76px time column, visual line per beat, the lit beat (second-to-last, or the one with the quiet part)', async () => {
  const { page, ctx } = await open('#studio/script/FTW-05-v3');
  await page.waitForSelector('#beats');
  assert.equal(await page.locator('[data-beat]').count(), 5);
  assert.equal(await page.locator('[data-beat]').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ')[0]), '76px');
  assert.equal(await page.locator('[data-lit]').getAttribute('data-beat'), '3');
  const p = page.locator('[data-lit] p');
  assert.match(await p.evaluate((e) => getComputedStyle(e).backgroundImage), /svg/);
  assert.equal(await p.evaluate((e) => getComputedStyle(e).fontWeight), '400');
  assert.equal(await page.locator('[data-beat="0"] p').evaluate((e) => getComputedStyle(e).fontWeight), '300');
  assert.match(await page.locator('[data-beat="0"]').innerText(), /ON SCREEN · 4,000 WEEKS\nGrid of 4,000 squares fades in on night canvas\./);
  // the design prompt fold
  assert.equal(await page.locator('#fold-prompt-body').count(), 0);
  await page.click('#fold-prompt');
  assert.match(await page.locator('#fold-prompt-body').innerText(), /one lilac mark per frame/);
  // the quiet part rule
  await mock(page, (m) => m.put('ideas', 'FTW-05', { quietPart: 'Most of us live like the list will end, and then we\'ll start.' }));
  await page.waitForFunction(() => document.querySelector('[data-lit]')?.getAttribute('data-beat') === '2');
  await ctx.close();
});

test('versions: pills, older version shows Revert, which writes v{n+1} (createdBy revert) and moves packCurrent', async () => {
  const { page, ctx } = await open('#studio/script/PM-02-v2');
  await page.waitForSelector('#ver-PM-02-v1');
  assert.equal(await page.locator('#revert-btn').count(), 0);
  await page.click('#ver-PM-02-v1');
  await page.waitForSelector('[data-pack="PM-02-v1"] #revert-btn');
  assert.equal(await page.locator('[data-beat]').count(), 3);
  await page.click('#revert-btn');
  await page.waitForSelector('[data-pack="PM-02-v3"]');
  const v3 = await doc(page, 'packs', 'PM-02-v3');
  assert.equal(v3.version, 3); assert.equal(v3.createdBy, 'revert'); assert.equal(v3.basedOn, 'PM-02-v1'); assert.equal(v3.beats.length, 3);
  assert.equal((await doc(page, 'ideas', 'PM-02')).packCurrent, 'PM-02-v3');
  assert.ok(await doc(page, 'packs', 'PM-02-v1'), 'versions are never deleted');
  await ctx.close();
});

test('hooks: In use, Use this hook makes v{n+1} with beat 0 swapped, voiceover recomputed, hookStyle set', async () => {
  const { page, ctx } = await open('#studio/script/PM-02-v2');
  await page.waitForSelector('#hooks-sec #hook-inuse-0');
  assert.equal(await page.locator('#hook-use-0').count(), 0);
  await page.click('#hook-use-1');
  await page.waitForSelector('[data-pack="PM-02-v3"]');
  const v3 = await doc(page, 'packs', 'PM-02-v3');
  assert.equal(v3.beats[0].vo, 'Nobody is looking at your car. Not like you think.');
  assert.equal(v3.beats[0].onscreen, 'NOBODY IS LOOKING');
  assert.equal(v3.beats[0].t, '0:00–0:05');
  assert.equal(v3.voiceover.split('\n')[0], 'Nobody is looking at your car. Not like you think.');
  assert.equal(v3.createdBy, 'hook-swap'); assert.equal(v3.changeNote, 'Hook: direct-you'); assert.equal(v3.hooks.length, 3);
  const idea = await doc(page, 'ideas', 'PM-02');
  assert.equal(idea.hookStyle, 'direct-you'); assert.equal(idea.packCurrent, 'PM-02-v3');
  await page.waitForSelector('#hook-inuse-1');
  await ctx.close();
});

test('no hooks yet: "Get 3 hook options" queues a Writer job and fires the worker', async () => {
  const { page, ctx } = await open('#studio/script/FTW-05-v3');
  await page.click('#hooks-get');
  await page.waitForSelector('#hooks-job');
  const j = (await jobs(page)).find((x) => x.kind === 'hooks');
  assert.deepEqual([j.node, j.ideaCode, j.packId, j.status], ['writer', 'FTW-05', 'FTW-05-v3', 'queued']);
  assert.equal(await mock(page, (m) => m.fires), 1);
  assert.equal(await page.locator('#hooks-get').isDisabled(), true);
  await ctx.close();
});

test('writer notes: story and critic cards', async () => {
  const { page, ctx } = await open('#studio/script/PM-02-v2');
  await page.waitForSelector('#writer-notes');
  assert.match(await page.locator('#wn-story').innerText(), /BELIEF\s+Nice things earn respect\./);
  assert.match(await page.locator('#wn-critic').innerText(), /28\/35 · predicts you'd rate it 7/);
  await ctx.close();
});

test('rating: 1–10 + note writes ratings/{packId}; the fifth rating queues Taste', async () => {
  const { page, ctx } = await open('#studio/script/FTW-05-v3');
  await page.waitForSelector('#rate-box');
  assert.equal(await page.locator('#rate-note-send').isDisabled(), true);
  await page.click('#rate-8');
  await page.fill('#rate-note', 'Strong close');
  await page.click('#rate-note-send');
  await page.waitForSelector('#rate-state');
  const r = await doc(page, 'ratings', 'FTW-05-v3');
  assert.deepEqual([r.packId, r.ideaCode, r.version, r.score, r.note], ['FTW-05-v3', 'FTW-05', 3, 8, 'Strong close']);
  assert.ok((await jobs(page)).some((j) => j.node === 'taste' && j.status === 'queued'), 'fifth rating queues taste');
  // re-rating replaces, and does not queue again
  await page.click('#rate-6'); await page.click('#rate-note-send');
  await page.waitForFunction(() => /Rated 6\/10/.test(document.getElementById('rate-state')?.textContent || ''));
  assert.equal((await jobs(page)).filter((j) => j.node === 'taste').length, 1);
  await ctx.close();
});

test('prompt box: Quick edit -> writer job kind "edit"; Needs research -> writer job; live row; "Open v{n}" when done', async () => {
  const { page, ctx } = await open('#studio/script/SH-01-v4');
  await page.waitForSelector('#prompt-input');
  await page.click('#prompt-input-send');
  assert.equal((await jobs(page)).filter((j) => j.kind === 'edit').length, 0, 'empty request is not sent');
  await page.fill('#prompt-input', 'Tighten beat 3');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#deep-card[data-job="queued"]');
  let j = (await jobs(page)).find((x) => x.node === 'writer' && x.ideaCode === 'SH-01');
  assert.deepEqual([j.kind, j.packId, j.request], ['edit', 'SH-01-v4', 'Tighten beat 3']);
  assert.equal(await page.locator('#prompt-input-send').isDisabled(), true, 'one at a time');
  // The worker runs it and writes v5.
  await mock(page, (m, id) => { m.put('jobs', id, { status: 'running' }); }, j.id);
  await page.waitForSelector('#deep-card[data-job="running"]');
  await mock(page, (m, id) => { m.put('packs', 'SH-01-v5', { ...m.get('packs', 'SH-01-v4').data, version: 5, createdAt: new Date(Date.now() + 1000).toISOString() }); m.put('jobs', id, { status: 'done' }); }, j.id);
  await page.click('#deep-open');
  await page.waitForSelector('[data-pack="SH-01-v5"]');
  // research lane
  await page.click('button:has-text("Needs research")');
  await page.fill('#prompt-input', 'Check the presentism source');
  await page.click('#prompt-input-send');
  await page.waitForFunction(() => document.querySelector('#deep-card')?.textContent.includes('Check the presentism source'));
  j = (await jobs(page)).find((x) => x.request === 'Check the presentism source');
  assert.equal(j.kind, undefined); assert.equal(j.node, 'writer'); assert.equal(j.packId, 'SH-01-v5');
  await ctx.close();
});

test('frames: a placeholder tile per beat; real frames land on their beat; overlay with Escape; Make frames queues art', async () => {
  const { page, ctx } = await open('#studio/frames/FTW-05-v3');
  await page.waitForSelector('#frames-grid');
  assert.equal(await page.locator('[data-frame-tile]').count(), 5);
  assert.match(await page.locator('[data-frame-tile="0"]').innerText(), /FRAME 01\s+0:00–0:04/);
  await page.fill('#frames-beats', '0:22');
  await page.click('#frames-beats-send');
  await page.waitForSelector('#frames-job');
  const j = (await jobs(page)).find((x) => x.node === 'art');
  assert.deepEqual([j.ideaCode, j.packId, j.request], ['FTW-05', 'FTW-05-v3', 'Make reference frames for beats: 0:22']);
  await page.click('#pcode-SH-01');
  await page.waitForSelector('#frame-0 img');
  assert.equal(await page.locator('#frame-1').count(), 0, 'beat 2 has no frame');
  assert.equal(await page.locator('#frame-2 img').count(), 1, 'the 0:20 frame sits on beat 3 (0:20–0:31)');
  await page.click('#frame-2');
  await page.waitForSelector('#frov');
  assert.match(await page.locator('#frov-note').innerText(), /Lit line on a ghost page/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'frov-close');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('frov'));
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'frame-2', 'focus returns');
  await ctx.close();
});

test('media & QA: verdict stamp, measurements, checks with timestamp pills, merged fixes, history, Run QA again', async () => {
  const { page, ctx } = await open('#studio/qa/TFS-01-v5');
  await page.waitForSelector('#qa-verdict');
  assert.equal(await page.locator('#qa-verdict').innerText(), 'FIX');
  const st = await page.locator('#qa-verdict').evaluate((e) => { const s = getComputedStyle(e); return [s.color, s.fontSize, s.borderTopWidth, s.transform]; });
  assert.equal(st[0], 'rgb(224, 104, 76)'); assert.equal(st[1], '18px'); assert.equal(st[2], '2px'); assert.notEqual(st[3], 'none');
  assert.match(await page.locator('#qa-meas').innerText(), /LENGTH\s+0:41\s+LOUDNESS\s+−13\.1 LUFS\s+SAFE ZONE\s+96%\s+FIRST WORD\s+0\.3 s/);
  assert.equal(await page.locator('[data-check]').count(), 5);
  assert.match(await page.locator('[data-check="warn"]').innerText(), /Caption at 0:14 sits under the like button\.\nFIX\s*Raise the caption 120 px\./);
  assert.equal(await page.locator('[data-fix]').count(), 0, 'both fixes merged into their checks');
  assert.match(await page.locator('#qa-video-ph').innerText(), /EDITED VIDEO\s+TFS-01_V2\.MP4/);
  assert.equal(await page.locator('#qa-ts-2').isDisabled(), true, 'no player yet: pills are inert');
  await page.selectOption('#qa-history', 'tfs-01-qa-0');
  await page.waitForFunction(() => document.getElementById('qa-verdict').textContent === 'NO-GO');
  await page.click('#qa-run');
  await page.waitForSelector('#qa-job');
  const j = (await jobs(page)).find((x) => x.node === 'qa');
  assert.deepEqual([j.ideaCode, j.packId, j.videoAssetId], ['TFS-01', 'TFS-01-v5', 'media/TFS-01/demo-TFS-01_v2.mp4']);
  assert.equal(await page.locator('#qa-run').isDisabled(), true);
  await ctx.close();
});

test('media: upload a video to studio/media/{code}/…, timestamp pills seek the player; stale-report note', async (t) => {
  if (!VIDEO) { t.skip('ffmpeg not available'); return; }
  const { page, ctx } = await open('#studio/qa/TFS-01-v5');
  await page.waitForSelector('#media-video-file', { state: 'attached' });
  await page.setInputFiles('#media-video-file', VIDEO.replace(/\.webm$/, '.webm'));
  await page.waitForSelector('#qa-video');
  const idea = await doc(page, 'ideas', 'TFS-01');
  assert.match(idea.videoAssetId, /^media\/TFS-01\/.+test-clip\.webm$/);
  assert.equal(idea.status, 'Produced', 'already past Voiced: no move');
  await page.waitForSelector('#qa-stale');
  await page.waitForFunction(() => document.getElementById('qa-video').readyState >= 1);
  await page.click('#qa-ts-2');
  await page.waitForFunction(() => Math.abs(document.getElementById('qa-video').currentTime - 14) < 0.2);
  assert.equal(await page.evaluate(() => document.getElementById('qa-video').paused), true);
  await ctx.close();
});

test('media: no video -> the design empty state with Upload video; upload rules (type, 50 MB); Voiced -> Produced', async () => {
  const { page, ctx } = await open('#studio/qa/FTW-05-v3');
  await page.waitForSelector('#qa-empty');
  assert.match(await page.locator('#qa-empty').innerText(), /No edited video yet\.[\s\S]*Upload video/);
  await page.setInputFiles('#media-video-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await page.waitForSelector('[data-toast=error]');
  assert.match(await page.locator('[data-toast=error]').innerText(), /MP4, MOV or WebM/);
  await page.evaluate(() => { const i = document.getElementById('media-video-file'); const dt = new DataTransfer(); const f = new File([new Uint8Array(1)], 'big.mp4'); Object.defineProperty(f, 'size', { value: 52428801 }); dt.items.add(f); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => /50 MB/.test(document.querySelector('[data-toast=error]')?.textContent || ''));
  assert.equal(await mock(page, (m) => m.uploads.length), 0);
  await page.setInputFiles('#media-video-file', { name: 'cut.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake') });
  await page.waitForFunction(() => !document.getElementById('qa-empty'));
  const f = await doc(page, 'ideas', 'FTW-05');
  assert.match(f.videoAssetId, /^media\/FTW-05\//); assert.equal(f.status, 'Scripted', 'a Scripted idea stays put');
  // Voice upload from Scripted moves to Voiced, like the board.
  await page.setInputFiles('#media-voice-file', { name: 'vo.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('fake') });
  await page.waitForFunction(() => /Moved to Voiced/.test(document.querySelector('[data-toast]')?.textContent || ''));
  const g = await doc(page, 'ideas', 'FTW-05');
  assert.equal(g.status, 'Voiced'); assert.equal(g.history.at(-1).status, 'Voiced'); assert.match(g.voiceAssetId, /^media\/FTW-05\//);
  await ctx.close();
});

test('posts: caption editor saves packs.captionFinal; Mark as posted (https only) moves the idea to Posted', async () => {
  const { page, ctx } = await open('#studio/posts/EN-04-v3');
  await page.waitForSelector('#post-caption');
  assert.match(await page.inputValue('#post-caption'), /^It isn't the event\./);
  await page.fill('#post-caption', 'New caption for the post.');
  await page.click('#posted-date');
  await page.waitForFunction(() => /Saved/.test(document.getElementById('post-caption-state').textContent));
  assert.equal((await doc(page, 'packs', 'EN-04-v3')).captionFinal, 'New caption for the post.');
  await page.fill('#posted-date', '2026-10-11');
  await page.fill('#posted-link', 'http://instagram.com/reel/x');
  await page.click('#posted-save');
  await page.waitForSelector('[role=alert]');
  assert.equal((await doc(page, 'ideas', 'EN-04')).status, 'QA passed');
  await page.fill('#posted-link', 'https://instagram.com/reel/demo');
  await page.click('#posted-save');
  await page.waitForFunction(() => window.__mock.get('ideas', 'EN-04').data.status === 'Posted');
  const i = await doc(page, 'ideas', 'EN-04');
  assert.equal(i.status, 'Posted'); assert.deepEqual(i.posted, { date: '2026-10-11', link: 'https://instagram.com/reel/demo' }); assert.equal(i.history.at(-1).status, 'Posted');
  const a = page.locator('a[href="https://instagram.com/reel/demo"]');
  assert.equal(await a.getAttribute('rel'), 'noopener noreferrer');
  await ctx.close();
});

test('posts: paper story tiles and carousel slides; SPEC5 copy formats; Write a new version; Mark posted', async () => {
  const { page, ctx } = await open('#studio/posts/FTW-05-v3');
  await clip(page);
  await page.waitForSelector('#post-story-cards');
  assert.equal(await page.locator('[data-story-frame]').count(), 3);
  assert.equal(await page.locator('[data-story-frame="1"]').evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(236, 230, 217)', 'paper colours in the night theme');
  assert.equal(await page.locator('[data-slide]').count(), 4);
  await page.click('#post-story-copy-design');
  assert.equal(await readClip(page), 'Paper stories, Newsreader, one lilac mark. (Demo.)\n\n[Frame 1]\nText: How many weeks have you used?\nVisual: Grid on paper.\nSticker: Question · Your number?\n\n[Frame 2]\nText: Most people guess low.\nVisual: Filled squares.\nSticker: Poll · Did you guess low? · (Yes / No)\n\n[Frame 3]\nText: ¹ Four Thousand Weeks\nVisual: Source card.');
  await page.click('#post-carousel-copy-design');
  assert.match(await readClip(page), /^Paper carousel, 4:5\. \(Demo\.\)\n\n\[Slide 1\]\nHeadline: Four thousand weeks\.\nBody: That is the average\.\nVisual: Grid fades in\.\n\n\[Slide 2\]/);
  await page.click('#post-carousel-copy-caption');
  assert.equal(await readClip(page), 'Cover: YOUR NUMBER\n\nCount your weeks. (Demo caption.)');
  await page.click('#post-carousel-copy-alt');
  assert.equal(await readClip(page), 'A grid of small squares, some filled.');
  await page.fill('#post-carousel-req', 'shorter slide 2');
  await page.click('#post-carousel-req-send');
  await page.waitForSelector('#post-carousel-job');
  const j = (await jobs(page)).find((x) => x.kind === 'carousel');
  assert.deepEqual([j.node, j.ideaCode, j.request], ['writer', 'FTW-05', 'Write carousel: shorter slide 2']);
  assert.match(j.id, /^writer-FTW-05-carousel-/);
  await page.click('#post-story-mark');
  await page.fill('#post-story-date', '2026-10-10');
  await page.click('#post-story-confirm');
  await page.waitForSelector('#post-story-posted');
  assert.equal((await doc(page, 'posts', 'FTW-05-story-v1')).postedAt, '2026-10-10');
  await ctx.close();
});

test('posts: nothing written yet shows paper placeholders and "Write story set"', async () => {
  const { page, ctx } = await open('#studio/posts/PM-02-v2');
  await page.waitForSelector('#post-story');
  assert.equal(await page.locator('#post-story-req-send').innerText(), 'Write story set');
  await page.click('#post-story-req-send');
  await page.waitForSelector('#post-story-job');
  assert.equal((await jobs(page)).find((x) => x.kind === 'story').request, 'Write story set');
  await ctx.close();
});

test('an unknown pack id falls back to the grid with a note', async () => {
  const { page, ctx } = await open('#studio/script/NOPE-v1');
  await page.waitForSelector('[data-pack-grid]');
  assert.match(await page.locator('[role=status]').first().innerText(), /isn't here any more/);
  await ctx.close();
});

for (const width of [1440, 1024]) {
  test(`studio screens: no body x-scroll, clean console at ${width}px`, async () => {
    for (const hash of ['#studio', '#studio/script/PM-02-v2', '#studio/frames/SH-01-v4', '#studio/qa/TFS-01-v5', '#studio/posts/FTW-05-v3']) {
      const { page, ctx, errors } = await openApp(browser, srv.url, { width, hash, readySelector: '[data-screen=studio]' });
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, hash);
      assert.deepEqual(errors.filter((e) => !benign(e)), [], hash);
      await ctx.close();
    }
  });
}
