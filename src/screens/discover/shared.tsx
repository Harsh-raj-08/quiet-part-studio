import type { CSSProperties } from 'react';
import type { Store } from '../../data/store';
import type { Book } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { slugOf, str } from '../../lib/format';

/** Where a suggested book stands: on the shelf, already queued (a Candidate), or new. */
export function shelfState(books: Book[], title: string): 'shelf' | 'queue' | null {
  const sl = slugOf(title); const lt = str(title).trim().toLowerCase();
  const b = books.find((x) => x.id === sl || x.title.trim().toLowerCase() === lt);
  if (!b) return null;
  return b.status === 'Candidate' ? 'queue' : 'shelf';
}

/** Add a suggested book to the queue: books/{slug}, status Candidate, order max+1 (never overwrites). */
export async function addToQueue(store: Store, books: Book[], c: { title: string; author?: string; lane?: string; why?: string }): Promise<boolean> {
  const id = slugOf(c.title);
  if (!id || shelfState(books, c.title)) return false;
  const order = books.reduce((m, b) => (b.order < 1e9 ? Math.max(m, b.order) : m), 0) + 1;
  await store.set('books', id, { title: str(c.title).slice(0, 200), author: str(c.author).slice(0, 200), lane: str(c.lane), why: str(c.why).slice(0, 600), status: 'Candidate', order });
  return true;
}

export const sectionLabel: CSSProperties = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
export function smallChip(on: boolean): CSSProperties {
  return { height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, border: `1px solid ${on ? 'var(--ink)' : 'var(--line2)'}`, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-ink)' : 'var(--dim)', whiteSpace: 'nowrap' };
}
export const selectStyle: CSSProperties = { height: 38, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', cursor: 'pointer' };
export const card: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 22, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--sf)', minWidth: 0 };
export const emptyItalic: CSSProperties = { margin: 0, padding: '32px 0', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' };

/** A queue/shelf button in the candidate style: primary when it can add, outlined dim once it's there. */
export function queueBtn(state: 'shelf' | 'queue' | null): { label: string; style: CSSProperties } {
  const inQ = !!state;
  return {
    label: state === 'shelf' ? 'On the shelf' : state === 'queue' ? 'In queue ✓' : 'Add to book queue',
    style: { flex: 'none', height: 32, padding: '0 14px', borderRadius: 999, cursor: inQ ? 'default' : 'pointer', font: `400 12.5px/1 ${SANS}`, whiteSpace: 'nowrap', border: `1px solid ${inQ ? 'var(--line2)' : 'var(--ink)'}`, background: inQ ? 'transparent' : 'var(--ink)', color: inQ ? 'var(--dim)' : 'var(--on-ink)' },
  };
}

/** Source line text: strings or {title, url}, joined with " · ". */
export const srcText = (a: unknown): string => (Array.isArray(a) ? a : a ? [a] : []).map((x) => (x && typeof x === 'object' ? str((x as { title?: string; url?: string }).title || (x as { url?: string }).url) : str(x))).filter(Boolean).join(' · ');
