import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { checkBookFile, errMsg, fireAndDescribe, queueJob, uploadBookFile } from '../../data/actions';
import { useSignedUrl } from '../../data/files';
import { useStore } from '../../data/store';
import type { Book, BookNote, Idea, Job } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, LiveLine } from '../../design/kit';
import { Seg, useToast } from '../../design/primitives';
import { fmtSize, fmtWhen, initials } from '../../lib/format';
import { CODE_RE } from './AddBook';
import { noteCount, researched } from './LibraryScreen';

const live = (j: Job) => j.status === 'queued' || j.status === 'running';

export function Shelf({ books, notes, ideas, jobs, loaded, focusId }: { books: Book[]; notes: BookNote[]; ideas: Idea[]; jobs: Job[]; loaded: boolean; focusId: string }) {
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`book-${focusId}`)?.scrollIntoView({ block: 'center' });
  }, [focusId, loaded]);
  if (!loaded) return <div aria-busy="true" style={{ minHeight: 400 }} />;
  if (!books.length) return <p style={{ margin: 0, padding: '32px 4px', font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>Nothing on the shelf yet. Add a book, upload its PDF, then run research.</p>;
  return (
    <div id="shelf" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 16 }}>
      {books.map((b) => <BookCard key={b.id} b={b} notes={notes.filter((n) => n.bookId === b.id)} ideas={ideas.filter((i) => i.bookId === b.id)} jobs={jobs} sel={b.id === focusId} />)}
    </div>
  );
}

function BookCard({ b, notes, ideas, jobs, sel }: { b: Book; notes: BookNote[]; ideas: Idea[]; jobs: Job[]; sel: boolean }) {
  const { go } = useApp();
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'full' | 'notes'>('full');
  const [code, setCode] = useState(b.code || initials(b.title));
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setCode(b.code || initials(b.title)); }, [b.code, b.title]);

  const job = jobs.find((j) => j.node === 'research' && j.bookId === b.id) ?? null;
  const running = !!job && live(job);
  const done = researched(b, notes);
  const nNotes = b.notesCount ?? notes.reduce((x, n) => x + noteCount(n), 0);
  const posted = ideas.filter((i) => i.status === 'Posted').length;
  const why = !b.filePath ? 'Upload the book first.' : mode === 'full' && !CODE_RE.test(b.code) ? 'Save a 2 or 3 letter code to run the full pass.' : running ? `A research job is already ${job!.status}.` : '';
  const fileUrl = useSignedUrl(open && b.filePath ? b.filePath : '');

  const act = async (k: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(k);
    try { await fn(); } catch (e) { toast(errMsg(e), true); } finally { setBusy(''); }
  };
  const runResearch = () => {
    if (why) { toast(why, true); setOpen(true); return; }
    void act('research', async () => {
      await queueJob(store, { node: 'research', bookId: b.id, request: mode === 'notes' ? 'notes only' : 'full' });
      toast(await fireAndDescribe(store));
    });
  };
  const saveCode = () => {
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) { toast('Use 2 or 3 letters, A to Z', true); return; }
    void act('code', async () => { await store.mutate('books', b.id, () => ({ code: c })); toast('Code saved'); });
  };
  const upload = (f: File | undefined) => {
    if (!f) return;
    const bad = checkBookFile(f);
    if (bad) { toast(bad, true); return; }
    void act('upload', async () => { await uploadBookFile(store, b.id, f); toast(`Uploaded ${f.name}`); });
  };
  const progress = job?.progress;
  const progressText = progress?.label || (progress?.step != null && progress?.of != null ? `Step ${progress.step} of ${progress.of}` : job?.status === 'running' ? 'Running' : 'Queued');
  const label = { font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'var(--faint)' };

  return (
    <article id={`book-${b.id}`} data-book={b.id} aria-current={sel ? 'true' : undefined} className="qp-hv-quiet"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 24px 20px', border: `1px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 16, background: 'var(--sf)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span title={b.code ? undefined : 'No code saved yet'} style={{ font: `500 11px/1 ${MONO}`, letterSpacing: '.14em', padding: '6px 9px', border: `1px ${b.code ? 'solid' : 'dashed'} var(--line2)`, borderRadius: 999, color: b.code ? 'var(--ink)' : 'var(--faint)' }}>{b.code || initials(b.title) || '—'}</span>
        <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{b.topic || b.lane}</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <h3 style={{ margin: 0, font: `300 27px/1.12 ${SERIF}`, letterSpacing: '-.018em', textWrap: 'balance' }}>{b.title}</h3>
        {b.author && <span style={{ font: `italic 400 15px/1.3 ${SERIF}`, color: 'var(--dim)' }}>{b.author}</span>}
      </div>
      {b.why && <p style={{ margin: 0, font: `400 13.5px/1.55 ${SANS}`, color: 'var(--dim)', textWrap: 'pretty' }}>{b.why}</p>}
      <div style={{ flex: 1 }} />
      {running && (
        <div data-research-live style={{ display: 'grid', gap: 8 }}>
          <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>Research · {progressText}</span>
          <LiveLine />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>
          <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--ink)' }}>{nNotes}</span> notes</span>
          <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--ink)' }}>{ideas.length}</span> ideas</span>
          <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--ink)' }}>{posted}</span> posted</span>
        </div>
        {running ? <button id={`research-running-${b.id}`} type="button" disabled style={{ flex: 'none', height: 32, padding: '0 14px', borderRadius: 999, cursor: 'default', font: `400 12.5px/1 ${SANS}`, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--faint)' }}>Running…</button>
          : done ? <button id={`open-notes-${b.id}`} type="button" onClick={() => go('library', 'notes', b.id)} className="qp-hv-soft" style={{ flex: 'none', height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--ink)' }}>Open notes</button>
            : <button id={`research-quick-${b.id}`} type="button" onClick={runResearch} disabled={busy === 'research'} className="qp-hv-op88" title={why || undefined} style={{ flex: 'none', height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', font: `400 12.5px/1 ${SANS}`, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--on-ink)' }}>Run research</button>}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', margin: '0 -4px' }}>
        <button id={`bkdet-${b.id}`} type="button" aria-expanded={open} aria-controls={`bkdet-body-${b.id}`} onClick={() => setOpen(!open)}
          style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px 0', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--dim)' }}>
          <span style={label}>Book file &amp; code</span>
          <span aria-hidden="true" style={{ font: `400 14px/1 ${MONO}`, color: 'var(--dim)' }}>{open ? '–' : '+'}</span>
        </button>
        {open && (
          <div id={`bkdet-body-${b.id}`} style={{ display: 'grid', gap: 14, padding: '16px 4px 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <span id={`book-file-info-${b.id}`} style={{ flex: '1 1 160px', minWidth: 0, font: `400 13px/1.4 ${SANS}`, color: b.filePath ? 'var(--ink)' : 'var(--faint)', overflowWrap: 'anywhere' }}>
                {b.filePath ? <>{fileUrl && /^https:\/\//i.test(fileUrl) ? <a href={fileUrl} target="_blank" rel="noopener noreferrer">{b.fileName || 'Book file'}</a> : (b.fileName || 'Book file')}{b.fileSize > 0 ? ` · ${fmtSize(b.fileSize)}` : ''}{b.uploadedAt ? ` · ${fmtWhen(b.uploadedAt)}` : ''}</> : 'PDF or EPUB, up to 50 MB.'}
              </span>
              <input ref={fileRef} id={`book-file-${b.id}`} type="file" tabIndex={-1} className="qp-sr" accept=".pdf,.epub,application/pdf,application/epub+zip" aria-label={`Book file for ${b.title}`}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
              <Btn id={`book-upload-${b.id}`} h={32} disabled={busy === 'upload'} style={{ padding: '0 14px', font: `400 12.5px/1 ${SANS}` }} onClick={() => fileRef.current?.click()}>{busy === 'upload' ? 'Uploading…' : b.filePath ? 'Replace file' : 'Upload book'}</Btn>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <label htmlFor={`book-code-${b.id}`} style={label}>Code</label>
              <input id={`book-code-${b.id}`} type="text" maxLength={3} autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCode(); } }}
                style={{ width: 72, height: 32, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--bg)', font: `500 12px/1 ${MONO}`, letterSpacing: '.12em', color: 'var(--ink)' }} />
              <Btn id={`book-code-save-${b.id}`} h={32} kind="quiet" disabled={!CODE_RE.test(code) || code === b.code || busy === 'code'} style={{ padding: '0 12px', font: `400 12.5px/1 ${SANS}` }} onClick={saveCode}>Save code</Btn>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <Seg<'full' | 'notes'> label="Research depth" options={[['full', 'Full'], ['notes', 'Notes only']]} value={mode} onChange={setMode} />
              <Btn id={`research-run-${b.id}`} h={32} kind="ink" disabled={!!why || busy === 'research'} title={why || undefined} style={{ padding: '0 14px', font: `500 12.5px/1 ${SANS}` }} onClick={runResearch}>Run Research</Btn>
            </div>
            {why && <span id={`research-why-${b.id}`} style={{ font: `italic 400 14px/1.4 ${SERIF}`, color: 'var(--dim)' }}>{why}</span>}
            {job && <JobRow id={`book-job-${b.id}`} node="research" note={`${job.request}${job.progress ? ` · ${progressText}` : ''}`} status={job.status} at={job.createdAt} error={job.error} />}
          </div>
        )}
      </div>
    </article>
  );
}
