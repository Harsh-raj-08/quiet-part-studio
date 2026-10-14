import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../../app/context';
import { useBooks, useChats, useIdeas, useJobs, useLoaded, useReports } from '../../data/hooks';
import { isLive, useRunner } from '../../data/useRunner';
import { fireAndDescribe, queueJob } from '../../data/actions';
import type { Book, Chat, ChatTurn, Idea, Job } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, LiveLine } from '../../design/kit';
import { fmtChatWhen, initials, slugOf } from '../../lib/format';
import { addToQueue, queueBtn, shelfState } from './shared';

const CHIPS = ["What's trending in money this week?", 'Find a source for AH-09', "Myths we haven't covered"];

/** Code for an idea Scout suggested: the book's code when it's on the shelf, else XX; next free number. */
export function nextIdeaCode(books: Book[], ideas: Idea[], bookTitle: string): { code: string; book: Book | null } {
  const lt = bookTitle.trim().toLowerCase();
  const book = books.find((b) => b.title.trim().toLowerCase() === lt || b.id === slugOf(bookTitle)) ?? null;
  const prefix = book ? (book.code || initials(book.title) || 'XX') : 'XX';
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const n = ideas.reduce((m, i) => { const x = i.code.match(re); return x ? Math.max(m, +x[1]!) : m; }, 0) + 1;
  return { code: `${prefix}-${String(n).padStart(2, '0')}`, book };
}

/** Paragraphs and "- " bullets from a reply, rendered as text (never HTML). */
function RichText({ text, style }: { text: string; style: CSSProperties }) {
  const blocks: ({ ul: string[] } | { p: string })[] = [];
  text.split('\n').forEach((l) => {
    const m = l.match(/^\s*[-*]\s+(.*)$/);
    if (m) { const last = blocks[blocks.length - 1]; if (last && 'ul' in last) last.ul.push(m[1]!); else blocks.push({ ul: [m[1]!] }); }
    else if (l.trim()) blocks.push({ p: l.trim() });
  });
  return <>{blocks.map((b, k) => ('ul' in b ? <ul key={k} style={{ ...style, paddingLeft: 20 }}>{b.ul.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p key={k} style={style}>{b.p}</p>))}</>;
}

export function Ask() {
  const { id, go, select } = useApp();
  const chats = useChats(); const jobs = useJobs(); const books = useBooks(); const ideas = useIdeas(); const reports = useReports();
  const loaded = useLoaded('chats');
  const R = useRunner();
  const [draft, setDraft] = useState('');
  const [brief, setBrief] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const isNew = id === 'new';
  const chat: Chat | null = isNew ? null : chats.find((c) => c.id === id) ?? chats[0] ?? null;
  const chatJobs = useMemo(() => (chat ? jobs.filter((j) => j.chatId === chat.id) : []), [jobs, chat]);
  const pending = chatJobs.find((j) => j.kind === 'chat' && isLive(j)) ?? null;
  const lastUser = chat ? [...chat.turns].reverse().find((t) => t.role === 'user') ?? null : null;
  const failed = !pending && chat && chat.turns[chat.turns.length - 1]?.role === 'user' ? chatJobs.find((j) => j.kind === 'chat' && j.status === 'failed') ?? null : null;
  const research = chatJobs.filter((j) => j.kind !== 'chat');
  const sending = R.busy.has('ask');

  // Keep the newest turn in view as the conversation grows (not on first load, and not when switching chats).
  const seen = useRef<{ id: string; n: number } | null>(null);
  const n = (chat?.turns.length ?? 0) + (pending ? 1 : 0);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { id: chat?.id ?? '', n };
    if (prev && prev.id === (chat?.id ?? '') && n > prev.n) threadEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [chat?.id, n]);
  useEffect(() => { setBrief(null); }, [chat?.id]);

  // Create the chat (or append the user turn), then queue the chat job and record it on the chat.
  const runSend = (text?: string) => {
    const q = (text ?? draft).trim().slice(0, 2000);
    if (!q || sending || pending) return;
    const at = new Date().toISOString();
    const turn = { role: 'user', content: q, at };
    void R.run('ask', async () => {
      let cid = chat?.id;
      if (!cid) {
        cid = `scout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await R.store.set('chats', cid, { node: 'scout', title: q.slice(0, 60), turns: [turn], jobs: [], createdAt: at, updatedAt: at });
        go('discover', 'ask', cid);
      } else {
        await R.store.mutate('chats', cid, (cur) => ({ turns: [...(Array.isArray(cur.data.turns) ? cur.data.turns : []), turn].slice(-60), updatedAt: at }));
      }
      const jid = await queueJob(R.store, { node: 'scout', kind: 'chat', chatId: cid, request: q });
      await R.store.mutate('chats', cid, (cur) => ({ jobs: [...(Array.isArray(cur.data.jobs) ? cur.data.jobs : []), jid].slice(-50) }));
      setDraft('');
      R.toast(await fireAndDescribe(R.store));
    });
  };

  const sendBrief = () => {
    const text = (brief ?? '').trim().slice(0, 1200);
    if (!text || !chat) { R.toast('Write a brief first', true); return; }
    void R.queue('brief', { node: 'scout', chatId: chat.id, request: text }, async (jid) => {
      await R.store.mutate('chats', chat.id, (cur) => ({ jobs: [...(Array.isArray(cur.data.jobs) ? cur.data.jobs : []), jid].slice(-50), updatedAt: new Date().toISOString() }));
    }).then((jid) => { if (jid) setBrief(null); });
  };

  const addIdea = (x: { bookTitle: string; hook: string }) => {
    if (ideas.some((i) => i.hook.trim() === x.hook.trim())) return;
    void R.run(`idea:${x.hook}`, async () => {
      const { code, book } = nextIdeaCode(books, ideas, x.bookTitle);
      const at = new Date().toISOString();
      const rank = ideas.reduce((m, i) => Math.max(m, i.rank ?? 0), 0) + 1;
      await R.store.set('ideas', code, {
        code, ...(book ? { bookId: book.id } : {}), fromBook: x.bookTitle.slice(0, 200), hook: x.hook.slice(0, 400), status: 'Idea', rank,
        createdBy: 'scout-chat', ...(chat ? { chatId: chat.id } : {}), history: [{ status: 'Idea', at }], updatedAt: at,
      });
      R.toast(`Added ${code} to Ideas`);
    });
  };

  const convStyle = (on: boolean): CSSProperties => ({ display: 'grid', gap: 8, padding: 14, borderRadius: 12, cursor: 'pointer', textAlign: 'left', color: 'var(--ink)', background: on ? 'var(--sf)' : 'transparent', border: `1px solid ${on ? 'var(--line2)' : 'transparent'}` });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 40px', alignItems: 'flex-start' }}>
      <aside aria-label="Conversations" style={{ flex: '1 1 220px', maxWidth: 280, display: 'grid', gap: 8 }}>
        <button id="chat-new" type="button" onClick={() => { setDraft(''); go('discover', 'ask', 'new'); }} className="qp-hv-line-faint"
          style={{ height: 40, borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', marginBottom: 12 }}>New conversation</button>
        {chats.map((c) => (
          <button key={c.id} id={`chat-${c.id}`} type="button" aria-current={c.id === chat?.id ? 'true' : undefined} onClick={() => go('discover', 'ask', c.id)} className="qp-hv-quiet" style={convStyle(c.id === chat?.id)}>
            <span style={{ font: `400 14.5px/1.35 ${SERIF}`, textAlign: 'left' }}>{c.title}</span>
            <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--faint)' }}>{fmtChatWhen(c.updatedAt || c.createdAt)}</span>
          </button>
        ))}
        {loaded && !chats.length && <p style={{ margin: '8px 0 0', font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--faint)' }}>No conversations yet.</p>}
      </aside>

      <div style={{ flex: '999 1 480px', minWidth: 0, display: 'grid', gap: 28, maxWidth: 820 }}>
        <div id="scout-thread" role="log" aria-label="Conversation with Scout" style={{ display: 'grid', gap: 28 }}>
          {!chat && (
            <div style={{ display: 'grid', gap: 10, maxWidth: '68ch' }}>
              <ScoutLabel />
              <p style={{ margin: 0, font: `400 18px/1.6 ${SERIF}`, color: 'var(--dim)' }}>Ask about books, angles or evidence. Scout reads the shelf and this week's reports, then answers here. Anything it can't check becomes a research run.</p>
            </div>
          )}
          {chat?.turns.map((t, k) => <Turn key={k} t={t} k={k} books={books} ideas={ideas} onAddIdea={addIdea} onAddBook={(b) => void R.run(`book:${b.title}`, async () => { if (await addToQueue(R.store, books, b)) R.toast('Added to the book queue'); })} busy={R.busy} />)}
          {pending && (
            <div id="scout-thinking" style={{ display: 'grid', gap: 16, maxWidth: '68ch' }}>
              <ScoutLabel />
              <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
                <span style={{ font: `italic 400 17px/1.4 ${SERIF}`, color: 'var(--dim)' }}>{pending.status === 'running' ? 'Reading the shelf and this week\'s trends…' : 'Scout is thinking… usually 1–3 min'}</span>
                <LiveLine />
              </div>
            </div>
          )}
          {failed && <p id="scout-failed" role="alert" style={{ margin: 0, font: `400 14px/1.5 ${SANS}`, color: 'var(--caution)' }}>Scout couldn't answer that one{failed.error ? `: ${failed.error}` : '.'} Send it again, or send it as a research run.</p>}
          {research.map((j) => <ResearchJob key={j.id} j={j} reports={reports} onOpen={(rid) => go('discover', 'reports', rid)} />)}
          <div ref={threadEnd} />
        </div>

        {brief != null ? (
          <div id="scout-brief-card" style={{ display: 'grid', gap: 12, padding: 22, border: '1px solid var(--line)', borderRadius: 14 }}>
            <label htmlFor="scout-brief" style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Research brief for Scout</label>
            <textarea id="scout-brief" rows={5} maxLength={1200} value={brief} onChange={(e) => setBrief(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--ink)', font: `400 15px/1.5 ${SANS}`, resize: 'vertical' }} />
            <p style={{ margin: 0, font: `italic 400 15px/1.4 ${SERIF}`, color: 'var(--dim)' }}>Scout searches the web with this brief and writes a report you'll find under Scout reports.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn id="scout-brief-send" kind="ink" disabled={!brief.trim() || R.busy.has('brief')} onClick={sendBrief}>{R.busy.has('brief') ? 'Sending…' : 'Send to Scout'}</Btn>
              <Btn id="scout-brief-cancel" kind="quiet" onClick={() => setBrief(null)}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHIPS.map((t, k) => (
                <button key={t} id={`scout-sugg-${k}`} type="button" disabled={!!pending || sending} onClick={() => runSend(t)} className="qp-hv-quiet"
                  style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px dashed var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13px/1 ${SANS}`, color: 'var(--dim)' }}>{t}</button>
              ))}
            </div>
            <div className="qp-search" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 10px 10px 22px', border: '1px solid var(--line2)', borderRadius: 22, background: 'var(--sf)' }}>
              <label htmlFor="scout-input" className="qp-sr">Message to Scout</label>
              <textarea id="scout-input" rows={2} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Scout for angles, sources or what's trending…" className="qp-search-input"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); runSend(); } }}
                style={{ flex: 1, minWidth: 0, resize: 'none', border: 0, background: 'transparent', outline: 'none', padding: '10px 0', font: `400 15px/1.5 ${SANS}`, color: 'var(--ink)' }} />
              <button id="scout-send" type="button" onClick={() => runSend()} disabled={!draft.trim() || !!pending || sending} className="qp-hv-op88"
                style={{ height: 42, padding: '0 22px', borderRadius: 999, border: 0, background: 'var(--ink)', cursor: 'pointer', font: `500 13px/1 ${SANS}`, color: 'var(--on-ink)' }}>Ask</button>
            </div>
            {lastUser && (
              <div>
                <button id="scout-brief-open" type="button" onClick={() => setBrief(lastUser.content.slice(0, 1200))} className="qp-hv-ink"
                  style={{ border: 0, background: 'transparent', padding: '4px 0', cursor: 'pointer', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>Send as research run →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function ScoutLabel() {
    return <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lilac)', boxShadow: '0 0 10px var(--lilac)' }} />Scout</span>;
  }

  function Turn({ t, k, books: bs, ideas: is, onAddIdea, onAddBook, busy }: { t: ChatTurn; k: number; books: Book[]; ideas: Idea[]; onAddIdea: (x: { bookTitle: string; hook: string }) => void; onAddBook: (b: ChatTurn['books'][number]) => void; busy: Set<string> }) {
    if (t.role === 'user') {
      return <p data-turn="user" style={{ justifySelf: 'end', maxWidth: '60ch', margin: 0, padding: '14px 18px', borderRadius: '18px 18px 4px 18px', background: 'var(--sf2)', font: `400 15px/1.5 ${SANS}`, whiteSpace: 'pre-wrap' }}>{t.content}</p>;
    }
    return (
      <div data-turn="scout" style={{ display: 'grid', gap: 16, maxWidth: '68ch' }}>
        <ScoutLabel />
        <RichText text={t.content || '(No reply.)'} style={{ margin: 0, font: `400 18px/1.6 ${SERIF}`, textWrap: 'pretty' }} />
        {t.ideas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 12 }}>
            {t.ideas.map((x, i) => {
              const added = is.some((d) => d.hook.trim() === x.hook.trim());
              return (
                <article key={i} data-scout-idea={`${k}-${i}`} style={{ display: 'grid', gap: 14, alignContent: 'start', padding: 18, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--sf)' }}>
                  <span style={{ font: `400 10px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>¹ From · {x.bookTitle || 'Not on the shelf'}</span>
                  <p style={{ margin: 0, font: `400 16.5px/1.38 ${SERIF}`, textWrap: 'pretty' }}>{x.hook}</p>
                  <button type="button" id={`add-idea-${k}-${i}`} disabled={added || busy.has(`idea:${x.hook}`)} onClick={() => onAddIdea(x)}
                    style={{ justifySelf: 'start', height: 32, padding: '0 14px', borderRadius: 999, cursor: added ? 'default' : 'pointer', font: `400 12.5px/1 ${SANS}`, border: `1px solid ${added ? 'var(--grow)' : 'var(--line2)'}`, background: 'transparent', color: added ? 'var(--grow)' : 'var(--ink)' }}>{added ? 'Added to Ideas ✓' : 'Add to Ideas'}</button>
                </article>
              );
            })}
          </div>
        )}
        {t.books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,240px),1fr))', gap: 12 }}>
            {t.books.map((b, i) => {
              const q = queueBtn(shelfState(bs, b.title));
              return (
                <article key={i} data-scout-book={b.title} style={{ display: 'grid', gap: 10, alignContent: 'start', padding: 18, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--sf)' }}>
                  {b.lane && <span style={{ justifySelf: 'start', font: `500 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 9px', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--dim)' }}>{b.lane}</span>}
                  <span style={{ font: `300 21px/1.18 ${SERIF}` }}>{b.title}</span>
                  <span style={{ font: `italic 400 14px/1.3 ${SERIF}`, color: 'var(--dim)' }}>{[b.author, b.year].filter(Boolean).join(' · ')}</span>
                  {b.why && <p style={{ margin: 0, font: `400 13px/1.5 ${SANS}`, color: 'var(--dim)' }}>{b.why}</p>}
                  <button type="button" id={`cadd-${slugOf(b.title)}`} onClick={() => onAddBook(b)} disabled={q.label !== 'Add to book queue'} style={{ ...q.style, justifySelf: 'start' }}>{q.label}</button>
                </article>
              );
            })}
          </div>
        )}
        {t.sources.length > 0 && <span style={{ font: `400 11px/1.5 ${MONO}`, color: 'var(--faint)' }}>Sources · {t.sources.join(' · ')}</span>}
      </div>
    );
  }
}

function ResearchJob({ j, reports, onOpen }: { j: Job; reports: { id: string; type: string; d: Record<string, unknown> }[]; onOpen: (id: string) => void }) {
  const rep = reports.find((r) => r.type === 'scout' && String(r.d.jobId ?? '') === j.id);
  return (
    <JobRow id={`askjob-${j.id}`} node="scout" note={`Research run · ${j.request}`} status={j.status} at={j.createdAt} error={j.error}
      extra={rep ? <div><Btn id={`askrep-${j.id}`} h={32} style={{ padding: '0 14px', font: `400 12.5px/1 ${SANS}` }} onClick={() => onOpen(rep.id)}>Open report</Btn></div> : undefined} />
  );
}
