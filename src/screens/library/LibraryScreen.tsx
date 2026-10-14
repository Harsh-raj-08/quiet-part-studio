import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../app/context';
import { onFocus, takeFocus } from '../../app/focus';
import { useHeadline } from '../../app/useHeadline';
import { useBooks, useIdeas, useJobs, useLoaded, useNotes } from '../../data/hooks';
import type { Book, BookNote } from '../../data/types';
import { SANS, SERIF } from '../../design/fonts';
import { monoChip, SubTabs } from '../../design/kit';
import { Eyebrow, Headline } from '../../design/primitives';
import { AddBook } from './AddBook';
import { Bank, BankFilters, type BankF } from './Bank';
import { Notes } from './Notes';
import { Shelf } from './Shelf';

const SUBS = [['shelf', 'Shelf'], ['notes', 'Chapter notes'], ['bank', 'Idea bank']] as const;
type Sub = (typeof SUBS)[number][0];

export const noteCount = (n: BookNote) => n.keyIdeas.length + n.stories.length + n.claims.length + n.lines.length;
/** Researched: research has written notes (count on the book, or chapter docs). */
export const researched = (b: Book, notes: BookNote[]) => (b.notesCount ?? 0) > 0 || notes.some((n) => n.bookId === b.id);

/** 02 · Library: Shelf, Chapter notes and Idea bank, with the design's book chips on the right of the sub-tabs. */
export function LibraryScreen() {
  const h = useHeadline('library');
  const { sub, id, go } = useApp();
  const books = useBooks(); const notes = useNotes(); const ideas = useIdeas(); const jobs = useJobs();
  const booksLoaded = useLoaded('books');
  const [adding, setAdding] = useState(false);
  const [bf, setBf] = useState<BankF>({ ev: 'all', st: 'all', fmt: 'all' });
  const [openCh, setOpenCh] = useState<string | null | undefined>(undefined);
  const s = (SUBS.some((x) => x[0] === sub) ? sub : 'shelf') as Sub;

  const done = useMemo(() => books.filter((b) => researched(b, notes)), [books, notes]);
  const book = books.find((b) => b.id === id) ?? (s === 'shelf' ? null : done[0] ?? books[0] ?? null);
  const chips = done.length ? (book && !done.includes(book) ? [...done, book] : done) : books;

  // Search hand-off: open a chapter.
  useEffect(() => {
    const take = () => { const c = takeFocus('chapter'); if (c) setOpenCh(c); };
    take();
    return onFocus(take);
  }, []);

  return (
    <div data-screen="library">
      <section style={{ padding: '56px 0 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ minWidth: 0, flex: '1 1 520px' }}>
          <Eyebrow>{h.eb}</Eyebrow>
          <Headline ghost={h.g} lit={h.l} maxCh={22} />
        </div>
        <button id="hero-add" type="button" aria-expanded={adding} aria-controls="add-book" onClick={() => setAdding(!adding)} className="qp-hv-op88"
          style={{ height: 42, padding: '0 20px', borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', cursor: 'pointer', font: `500 13px/1 ${SANS}`, color: 'var(--on-ink)' }}>{adding ? 'Cancel' : 'Add a book'}</button>
      </section>
      {adding && <AddBook books={books} onDone={(bid) => { setAdding(false); go('library', 'shelf', bid); }} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px' }}>
        <SubTabs tabs={SUBS} value={s} onChange={(k) => { setOpenCh(undefined); go('library', k, k === 'shelf' ? undefined : book?.id); }} label="Library sections" idPrefix="sub-library" />
        {s !== 'shelf' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {s === 'bank' && book && <BankFilters ideas={ideas.filter((i) => i.bookId === book.id)} f={bf} setF={setBf} />}
            <div role="group" aria-label="Book" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {chips.map((b) => (
                <button key={b.id} id={`libbook-${b.id}`} type="button" aria-pressed={b.id === book?.id} title={b.title}
                  onClick={() => { setOpenCh(undefined); go('library', s, b.id); }} style={monoChip(b.id === book?.id)}>{b.code || b.title.slice(0, 3).toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {s === 'shelf' && <Shelf books={books} notes={notes} ideas={ideas} jobs={jobs} loaded={booksLoaded} focusId={id} />}
      {s === 'notes' && (book ? <Notes book={book} notes={notes.filter((n) => n.bookId === book.id)} ideas={ideas.filter((i) => i.bookId === book.id)} openId={openCh} setOpenId={setOpenCh} /> : <EmptyShelf loaded={booksLoaded} />)}
      {s === 'bank' && (book ? <Bank ideas={ideas.filter((i) => i.bookId === book.id)} f={bf} /> : <EmptyShelf loaded={booksLoaded} />)}
    </div>
  );
}

function EmptyShelf({ loaded }: { loaded: boolean }) {
  return <p style={{ margin: 0, padding: '32px 4px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>{loaded ? 'The shelf is empty. Add a book to begin.' : 'Loading the shelf…'}</p>;
}
