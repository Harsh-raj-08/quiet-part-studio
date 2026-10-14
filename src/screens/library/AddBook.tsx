import { useState, type CSSProperties } from 'react';
import { errMsg } from '../../data/actions';
import { useStore } from '../../data/store';
import type { Book } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { useToast } from '../../design/primitives';
import { slugOf } from '../../lib/format';

export const CODE_RE = /^[A-Z]{2,3}$/;
const TOPICS = ['Mind', 'Money', 'Time', 'Philosophy'];
const lbl: CSSProperties = { display: 'grid', gap: 8, font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const inp: CSSProperties = { height: 42, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg)', letterSpacing: 0, textTransform: 'none', color: 'var(--ink)', outline: 'none', minWidth: 0 };

/** The design's add form: Title, Author, Code, Lane (the book's topic) -> books/{slug}, status Candidate, order max+1. */
export function AddBook({ books, onDone }: { books: Book[]; onDone: (id: string) => void }) {
  const store = useStore();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [code, setCode] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = title.trim(); const id = slugOf(t); const c = code.trim().toUpperCase();
    if (!t || !id) { setErr('Give the book a title.'); return; }
    if (c && !CODE_RE.test(c)) { setErr('The code is 2 or 3 letters, A to Z.'); return; }
    if (books.some((b) => b.id === id || b.title.toLowerCase() === t.toLowerCase())) { setErr('That book is already on the shelf.'); return; }
    const dup = c && books.find((b) => b.code === c);
    if (dup) { setErr(`Code ${c} is already used by ${dup.title}.`); return; }
    setBusy(true); setErr('');
    try {
      const order = books.reduce((m, b) => (b.order < 1e9 ? Math.max(m, b.order) : m), 0) + 1;
      await store.set('books', id, { title: t.slice(0, 200), author: author.trim().slice(0, 200), ...(c ? { code: c } : {}), topic, why: '', status: 'Candidate', order });
      toast(`Added ${t} to the shelf`);
      onDone(id);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <form id="add-book" onSubmit={(e) => { e.preventDefault(); void submit(); }}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end', marginTop: 32, padding: 22, border: '1px solid var(--line2)', borderRadius: 16, background: 'var(--sf)' }}>
      <label style={lbl} htmlFor="ab-title">Title<input id="ab-title" type="text" autoFocus required maxLength={200} placeholder="The Courage to Be Disliked" value={title} onChange={(e) => setTitle(e.target.value)} className="qp-search-input" style={{ ...inp, font: `400 15px/1 ${SERIF}` }} /></label>
      <label style={lbl} htmlFor="ab-author">Author<input id="ab-author" type="text" maxLength={200} placeholder="Kishimi & Koga" value={author} onChange={(e) => setAuthor(e.target.value)} className="qp-search-input" style={{ ...inp, font: `400 14px/1 ${SANS}` }} /></label>
      <label style={lbl} htmlFor="ab-code">Code<input id="ab-code" type="text" maxLength={3} placeholder="CD" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} className="qp-search-input" style={{ ...inp, font: `500 13px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase' }} /></label>
      <label style={lbl} htmlFor="ab-lane">Lane<select id="ab-lane" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ ...inp, padding: '0 10px', font: `400 14px/1 ${SANS}` }}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <button id="ab-add" type="submit" disabled={busy} className="qp-hv-line-faint" style={{ height: 42, padding: '0 20px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13px/1 ${SANS}`, color: 'var(--ink)' }}>{busy ? 'Adding…' : 'Add to shelf'}</button>
      {err && <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, font: `400 13px/1.5 ${SANS}`, color: 'var(--caution)' }}>{err}</p>}
    </form>
  );
}
