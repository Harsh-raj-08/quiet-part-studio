import { useEffect, type CSSProperties } from 'react';
import { useApp } from '../../app/context';
import type { Book, BookNote, Idea } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { fmtDay, pgs } from '../../lib/format';
import { pagesOverlap } from '../../lib/pages';
import { noteCount } from './LibraryScreen';

const grp: CSSProperties = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' };
const bullets: CSSProperties = { margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 8, font: `400 14.5px/1.55 ${SANS}`, color: 'var(--dim)' };
const pg = (p: string) => (p ? <span style={{ color: 'var(--faint)' }}> · {pgs(p)}</span> : null);

/** Two columns: the book's digest on the left, the chapter accordion on the right. */
export function Notes({ book, notes, ideas, openId, setOpenId }: { book: Book; notes: BookNote[]; ideas: Idea[]; openId: string | null | undefined; setOpenId: (id: string | null) => void }) {
  const { go, select } = useApp();
  const chs = notes.slice().sort((a, b) => a.chapterNo - b.chapterNo);
  // Default open: the first chapter (as designed); a search hand-off opens its chapter.
  const open = openId === undefined ? chs[0]?.id ?? null : openId;
  useEffect(() => {
    if (openId) document.getElementById(`chap-${openId}`)?.scrollIntoView({ block: 'start' });
  }, [openId]);
  const became = (n: BookNote) => (n.pages ? ideas.filter((i) => i.pages && pagesOverlap(i.pages, n.pages)) : []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px), 1fr))', gap: '40px 56px', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <span style={{ font: `400 10.5px/1.5 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}><span style={{ color: 'var(--lilac)' }}>¹</span> {book.title}{book.author ? ` · ${book.author}` : ''}</span>
        <p id="bd-digest" style={{ margin: 0, font: `300 23px/1.5 ${SERIF}`, textWrap: 'pretty' }}>{book.digest || book.why || 'No digest yet. Research writes one when it finishes the book.'}</p>
        <div id="bd-counts" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>
          <span><span style={{ color: 'var(--ink)' }}>{chs.length || '—'}</span> chapters</span>
          <span><span style={{ color: 'var(--ink)' }}>{ideas.length}</span> ideas</span>
          <span>Researched {book.researchedAt ? fmtDay(book.researchedAt) : '—'}</span>
        </div>
      </div>
      <div id="chapters" style={{ display: 'grid', borderTop: '1px solid var(--line)' }}>
        {chs.map((n) => {
          const isOpen = open === n.id;
          const seeds = became(n);
          const c = noteCount(n);
          return (
            <div key={n.id} id={`chap-${n.id}`} data-chapter={n.chapterNo} style={{ borderBottom: '1px solid var(--line)', scrollMarginTop: 140 }}>
              <button type="button" id={`chap-btn-${n.id}`} aria-expanded={isOpen} aria-controls={`chap-body-${n.id}`} onClick={() => setOpenId(isOpen ? null : n.id)}
                style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto auto', gap: 16, alignItems: 'baseline', width: '100%', padding: '22px 4px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)' }}>
                <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{String(n.chapterNo || 0).padStart(2, '0')}</span>
                <span style={{ font: `400 20px/1.3 ${SERIF}` }}>{n.title || 'Untitled chapter'}</span>
                <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{c} note{c === 1 ? '' : 's'} · {seeds.length} idea{seeds.length === 1 ? '' : 's'}</span>
                <span aria-hidden="true" style={{ font: `400 16px/1 ${MONO}`, color: 'var(--dim)', width: 16, textAlign: 'center' }}>{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && (
                <div id={`chap-body-${n.id}`} style={{ display: 'grid', gap: 22, padding: '0 4px 28px 64px' }}>
                  {n.summary && <p style={{ margin: 0, paddingLeft: 18, borderLeft: '1.5px solid var(--ink)', font: `italic 400 19px/1.5 ${SERIF}`, textWrap: 'pretty' }}>{n.summary}</p>}
                  {n.keyIdeas.length > 0 && <Group label="Key ideas" show={n.stories.length + n.claims.length + n.lines.length > 0}><ul style={bullets}>{n.keyIdeas.map((k, i) => <li key={i}>{k.idea}{k.mechanism ? ` — ${k.mechanism}` : ''}{pg(k.pages)}</li>)}</ul></Group>}
                  {n.stories.length > 0 && <Group label="Stories"><ul style={bullets}>{n.stories.map((k, i) => <li key={i}>{k.who && <span style={{ color: 'var(--ink)' }}>{k.who}: </span>}{k.what}{pg(k.pages)}</li>)}</ul></Group>}
                  {n.claims.length > 0 && <Group label="Claims to check"><ul style={bullets}>{n.claims.map((k, i) => <li key={i}>{k.claim}{pg(k.pages)}</li>)}</ul></Group>}
                  {n.lines.length > 0 && <Group label="Lines">{n.lines.map((k, i) => <blockquote key={i} style={{ margin: 0, paddingLeft: 18, borderLeft: '1.5px solid var(--lilac)', font: `italic 400 17px/1.5 ${SERIF}` }}>“{k.text}”{k.page && <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)', marginLeft: 8 }}>{pgs(k.page)}</span>}</blockquote>)}</Group>}
                  {!c && !n.summary && <p style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--faint)' }}>Nothing recorded for this chapter yet.</p>}
                  {seeds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ ...grp, marginRight: 6 }}>Became</span>
                      {seeds.map((i) => <button key={i.id} type="button" data-became={i.code} title={i.hook} onClick={() => { go('ideas'); select(i.id); }} className="qp-hv-soft"
                        style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.1em', padding: '6px 9px', border: '1px solid var(--line2)', borderRadius: 999, background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}>{i.code}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!chs.length && <p id="notes-empty" style={{ margin: 0, padding: '32px 4px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Chapter notes appear once research has run on this book.</p>}
      </div>
    </div>
  );
}

/** A group label inside an open chapter. When the chapter only has key ideas, they show as plain bullets (as designed). */
function Group({ label, show = true, children }: { label: string; show?: boolean; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>{show && <span style={grp}>{label}</span>}{children}</div>;
}
