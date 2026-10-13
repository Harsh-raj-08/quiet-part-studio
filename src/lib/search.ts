import type { Book, BookNote, Idea, Pack, Report } from '../data/types';
import { fmtDay, shortBookTitle, str } from './format';
import { scoutCandidates } from './headlines';

export type Target =
  | { type: 'book'; id: string }
  | { type: 'idea'; id: string }
  | { type: 'pack'; id: string; ideaCode: string }
  | { type: 'note'; id: string; bookId: string }
  | { type: 'scout'; id: string };

export interface Hit { c?: string; t: string; s?: string | null; target: Target }
export interface Group { name: 'Books' | 'Ideas' | 'Packs' | 'Notes' | 'Scouted'; items: Hit[] }
export interface SearchData { books: Book[]; ideas: Idea[]; packs: Pack[]; notes: BookNote[]; reports: Report[] }

export const words = (q: string): string[] => str(q).toLowerCase().split(/\s+/).filter(Boolean);
export function allWords(ws: string[], txt: string): boolean {
  const t = str(txt).toLowerCase();
  return ws.every((w) => t.includes(w));
}
export function snipOf(t: string, ws: string[]): string | null {
  const s = str(t).replace(/\s+/g, ' ').trim();
  const lo = s.toLowerCase();
  let at = -1;
  ws.forEach((w) => { const k = lo.indexOf(w); if (k >= 0 && (at < 0 || k < at)) at = k; });
  if (at < 0) return null;
  const st = Math.max(0, at - 28);
  const en = Math.min(s.length, st + 96);
  return (st > 0 ? '…' : '') + s.slice(st, en) + (en < s.length ? '…' : '');
}

/** Split text into plain and matched parts (for <mark>). */
export function markParts(t: string, ws: string[]): { text: string; hit: boolean }[] {
  const s = str(t);
  if (!ws.length) return [{ text: s, hit: false }];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lw = ws.map((x) => x.toLowerCase());
  return s.split(new RegExp(`(${ws.map(esc).join('|')})`, 'i')).filter((p) => p !== '').map((p) => ({ text: p, hit: lw.includes(p.toLowerCase()) }));
}

/** Books, ideas, packs, notes and scouted titles, five per group, grouped. Same rules as the current studio. */
export function searchAll(q: string, D: SearchData): { ws: string[]; groups: Group[] } {
  const ws = words(q);
  const groups: Group[] = [];
  if (!ws.length) return { ws, groups };
  const ex = (fields: string[]) => { for (const f of fields) { const sn = snipOf(f, ws); if (sn) return sn; } return null; };

  const books: Hit[] = D.books.filter((b) => allWords(ws, `${b.title} ${b.author}`)).slice(0, 5).map((b) => ({ t: b.title, s: b.author, target: { type: 'book', id: b.id } }));
  const ideas: Hit[] = D.ideas.filter((i) => allWords(ws, [i.code, i.hook, i.quietPart, i.fromBook].join(' '))).slice(0, 5)
    .map((i) => ({ c: i.code, t: i.hook || 'No hook written yet', s: ex([i.quietPart, i.fromBook]), target: { type: 'idea', id: i.id } }));
  const packs: Hit[] = D.packs.filter((p) => allWords(ws, [p.id, p.title, ...p.beats.map((b) => b.vo)].join(' ')))
    .sort((a, b) => a.ideaCode.localeCompare(b.ideaCode) || b.version - a.version).slice(0, 5)
    .map((p) => ({ c: `${p.ideaCode} v${p.version}`, t: p.title, s: ex(p.beats.map((b) => b.vo)), target: { type: 'pack', id: p.id, ideaCode: p.ideaCode } }));
  const notes: Hit[] = D.notes.filter((n) => allWords(ws, [n.title, ...n.keyIdeas.map((k) => k.idea), ...n.lines.map((k) => k.text)].join(' '))).slice(0, 5).map((n) => {
    const b = D.books.find((x) => x.id === n.bookId);
    return { c: `Ch ${n.chapterNo || '?'}`, t: n.title || 'Untitled chapter', s: ex([...n.keyIdeas.map((k) => k.idea), ...n.lines.map((k) => k.text)]) || (b ? shortBookTitle(b.title) : ''), target: { type: 'note', id: n.id, bookId: n.bookId } };
  });
  const scouted: Hit[] = [];
  const seen = new Set<string>();
  D.reports.filter((r) => r.type === 'scout').sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).forEach((r) => {
    scoutCandidates(r).forEach((c) => {
      const t = str(c.title);
      if (t && !seen.has(t.toLowerCase()) && allWords(ws, t)) {
        seen.add(t.toLowerCase());
        scouted.push({ t, s: [str(c.author), fmtDay(r.at)].filter(Boolean).join(' · '), target: { type: 'scout', id: r.id } });
      }
    });
  });
  const add = (name: Group['name'], items: Hit[]) => { if (items.length) groups.push({ name, items }); };
  add('Books', books); add('Ideas', ideas); add('Packs', packs); add('Notes', notes); add('Scouted', scouted.slice(0, 5));
  return { ws, groups };
}
