// Pack rules shared by the Studio screens and the unit tests. Formats follow the old studio's SPEC exactly.
import type { Beat, Idea, Pack, Post, Sticker } from '../data/types';
import { STAGES } from '../data/types';

/** "Copy for Claude Design": designPrompt, a blank line, then every beat as [t]\nV.O: …\n[On-screen]: … joined by blank lines. */
export function designText(p: Pick<Pack, 'designPrompt' | 'beats'>): string {
  return [p.designPrompt, p.beats.map((b) => `[${b.t}]\nV.O: ${b.vo}\n[On-screen]: ${b.onscreen}`).join('\n\n')].filter((x) => x.trim()).join('\n\n');
}
/** "Copy VO script": the voiceover field, or the beats' V.O lines when it is missing. */
export const voText = (p: Pick<Pack, 'voiceover' | 'beats'>): string => p.voiceover.trim() ? p.voiceover : p.beats.map((b) => b.vo).join('\n');
/** "Copy caption": Cover: …, a blank line, the caption. */
export const captionText = (cover: string, caption: string): string => `Cover: ${cover}\n\n${caption}`;

export const stickerText = (k: Sticker | null): string =>
  k ? `${k.type ? k.type[0]!.toUpperCase() + k.type.slice(1).toLowerCase() : 'Sticker'}${k.prompt ? ` · ${k.prompt}` : ''}${k.options.length ? ` · (${k.options.join(' / ')})` : ''}` : '';

/** Posts & stories "Copy for Claude Design" (SPEC5). */
export function postDesignText(p: Post): string {
  const body = p.kind === 'story'
    ? p.frames.map((f) => `[Frame ${f.n}]\nText: ${f.text}\nVisual: ${f.visual}${f.sticker ? `\nSticker: ${stickerText(f.sticker)}` : ''}`).join('\n\n')
    : p.slides.map((x) => `[Slide ${x.n}]\nHeadline: ${x.headline}\nBody: ${x.body}\nVisual: ${x.visual}`).join('\n\n');
  return p.designPrompt ? `${p.designPrompt}\n\n${body}` : body;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** The lit beat: one marked `lit`, else the one that carries the idea's quiet part, else the second-to-last beat. */
export function litBeat(beats: Pick<Beat, 'vo' | 'lit'>[], quietPart: string): number {
  if (!beats.length) return -1;
  const marked = beats.findIndex((b) => b.lit === true);
  if (marked >= 0) return marked;
  const q = norm(quietPart);
  if (q.length >= 8) {
    const k = beats.findIndex((b) => { const v = norm(b.vo); return v.length >= 8 && (v.includes(q) || q.includes(v)); });
    if (k >= 0) return k;
  }
  return Math.max(0, beats.length - 2);
}

/** "m:ss", "m:ss.s", "h:mm:ss", "12s", ranges "0:12–0:15" (start) -> seconds; null when unreadable. */
export function parseT(v: string): number | null {
  const x = String(v ?? '').trim().replace(/[‐-―−]/g, '-').replace(/[[\]()~]/g, '');
  const f = x.split(/\s*(?:-|\bto\b)\s*/i)[0]!.trim();
  let m = f.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1]! * 3600 + +m[2]! * 60 + +m[3]!;
  m = f.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1]! * 60 + +m[2]!;
  m = f.match(/^(\d+(?:\.\d+)?)\s*s?$/i);
  if (m) return +m[1]!;
  return null;
}
/** End of a beat window "0:04–0:12" -> 12; null when there is no end. */
export function parseEnd(v: string): number | null {
  const parts = String(v ?? '').replace(/[‐-―−]/g, '-').split(/\s*(?:-|\bto\b)\s*/i);
  return parts.length > 1 ? parseT(parts[1]!) : null;
}

export const fmtDur = (sec: number): string => sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '';

export const PROD_STAGES = ['Scripted', 'Voiced', 'Produced', 'QA passed'] as const;
const si = (s: string) => (STAGES as readonly string[]).indexOf(s);

/** The five segments on a pack card. Lit from the data, or because the idea is already past that step. */
export function packSegments(p: Pick<Pack, 'frames'>, idea: Pick<Idea, 'status' | 'voiceAssetId' | 'videoAssetId' | 'qaLast'> | null): [string, boolean][] {
  const k = idea ? si(idea.status) : -1;
  const past = (s: string) => k >= si(s);
  return [
    ['Script', true],
    ['Frames', p.frames.length > 0],
    ['Voice', !!idea && (!!idea.voiceAssetId || past('Voiced'))],
    ['Video', !!idea && (!!idea.videoAssetId || past('Produced'))],
    ['QA', !!idea && (!!idea.qaLast || past('QA passed'))],
  ];
}

/** Which frame belongs to which beat: a frame at time t goes to the beat whose window holds t. */
export function framesByBeat<F extends { t: string }>(beats: Pick<Beat, 't'>[], frames: F[]): { perBeat: (F | null)[]; extra: F[] } {
  const perBeat: (F | null)[] = beats.map(() => null);
  const extra: F[] = [];
  const starts = beats.map((b) => parseT(b.t));
  frames.forEach((f) => {
    const t = parseT(f.t);
    let k = -1;
    if (t != null) {
      for (let i = 0; i < beats.length; i++) {
        const a = starts[i]; const e = parseEnd(beats[i]!.t) ?? starts[i + 1] ?? Infinity;
        if (a != null && t >= a && t < e) { k = i; break; }
      }
    }
    if (k >= 0 && !perBeat[k]) perBeat[k] = f; else extra.push(f);
  });
  return { perBeat, extra };
}

/** New version id, in the studio's convention: {code}-v{n}. */
export const versionId = (code: string, n: number) => `${code}-v${n}`;
