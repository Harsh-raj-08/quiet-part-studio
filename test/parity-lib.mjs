// Visual parity: screenshots of the app vs the committed design baselines (test/parity/design-*.png),
// compared at 1440x1000. Baselines come from scripts/capture-design.mjs (the owner's design file, rendered locally).
import fs from 'node:fs';
import path from 'node:path';
import { OUT, root, openApp } from './helpers.mjs';

export const PARITY_DIR = path.join(root, 'test/parity');
export const FREEZE = '*,*::before,*::after{animation:none!important}';

/** A pixel counts as different when any channel moves by more than TOL (out of 255). */
export const TOL = 16;

/** Phase 3b screens, opened by hash in the Command bar layout (as the owner uses them). */
export const SHOTS_3B = {
  'studio-grid': '#studio', 'studio-script': '#studio/script/FTW-05-v3', 'studio-frames': '#studio/frames/FTW-05-v3', 'studio-qa': '#studio/qa/TFS-01-v5',
  'studio-posts': '#studio/posts/FTW-05-v3', 'library-shelf': '#library', 'library-notes': '#library/notes', 'library-bank': '#library/bank',
};
export async function captureScreens(browser, base, theme) {
  const shots = {}; const errors = [];
  for (const [name, hash] of Object.entries(SHOTS_3B)) {
    const { page, ctx, errors: e } = await openApp(browser, base, { theme, sideHidden: true, hash });
    await page.addStyleTag({ content: FREEZE });
    await page.waitForTimeout(400);
    shots[`${theme}-${name}`] = await page.screenshot();
    errors.push(...e);
    await ctx.close();
  }
  return { shots, errors };
}

export const SHOTS = ['night-sidebar', 'night-command', 'night-drawer', 'night-drawer-command', 'paper-sidebar', 'paper-command', 'paper-drawer', 'paper-drawer-command'];

/** Drive the app through the same steps capture-design.mjs drives the design through. */
export async function captureApp(browser, base, theme) {
  const { page, ctx, errors } = await openApp(browser, base, { theme });
  await page.addStyleTag({ content: FREEZE });
  await page.waitForTimeout(150);
  const shots = {}; const masks = {};
  const snap = async (name) => {
    shots[name] = await page.screenshot();
    // The hero headline is deliberately different (the old studio's waiting rule), so a second figure masks it.
    const b = await page.locator('h1').first().boundingBox();
    masks[name] = [[Math.max(0, Math.floor(b.x - 8)), Math.max(0, Math.floor(b.y - 8)), Math.ceil(b.width + 16), Math.max(Math.ceil(b.height + 16), 200)]];
  };
  await snap(`${theme}-sidebar`);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(900);
  await snap(`${theme}-command`);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(900);
  await page.locator('[data-card="TFS-07"]').click({ position: { x: 60, y: 24 } }); await page.waitForTimeout(700);
  await snap(`${theme}-drawer`);
  await page.keyboard.press('Control+\\'); await page.waitForTimeout(900);
  await snap(`${theme}-drawer-command`);
  await ctx.close();
  return { shots, masks, errors };
}

/**
 * Compare two PNG buffers in a page canvas. Returns { pct, diff, w, h } and writes a [design | app | diff] sheet.
 * `mask` optionally lists rectangles (x, y, w, h) ignored in both images (used to report a second figure without the hero text).
 */
export async function compare(browser, designPng, appPng, mask = []) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ a, b, tol, mask }) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const A = await load(`data:image/png;base64,${a}`); const B = await load(`data:image/png;base64,${b}`);
      const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
      const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
      const da = px(A), db = px(B);
      const out = document.createElement('canvas'); out.width = w * 3; out.height = h;
      const ox = out.getContext('2d');
      ox.drawImage(A, 0, 0); ox.drawImage(B, w, 0);
      const dd = ox.createImageData(w, h);
      const inMask = (x, y) => mask.some((m) => x >= m[0] && x < m[0] + m[2] && y >= m[1] && y < m[1] + m[3]);
      let diff = 0, total = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const masked = inMask(x, y);
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        const bad = !masked && d > tol;
        if (!masked) total++;
        if (bad) diff++;
        const g = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3 * 0.25;
        dd.data[i] = bad ? 255 : g; dd.data[i + 1] = bad ? 60 : g; dd.data[i + 2] = bad ? 60 : g; dd.data[i + 3] = 255;
        if (masked) { dd.data[i] = 60; dd.data[i + 1] = 60; dd.data[i + 2] = 90; }
      }
      ox.putImageData(dd, w * 2, 0);
      return { pct: (diff / total) * 100, diff, w, h, sheet: out.toDataURL('image/png').split(',')[1] };
    }, { a: designPng.toString('base64'), b: appPng.toString('base64'), tol: TOL, mask });
  } finally { await page.close(); }
}

export function saveSheet(name, base64) { fs.writeFileSync(path.join(OUT, `parity-${name}.png`), Buffer.from(base64, 'base64')); }
export const readDesign = (name) => fs.readFileSync(path.join(PARITY_DIR, `design-${name}.png`));
