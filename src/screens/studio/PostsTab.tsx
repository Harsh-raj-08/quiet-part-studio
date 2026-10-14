import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../../data/store';
import type { Idea, Pack, Post } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, JobRow, Label, PromptPill, useCopied } from '../../design/kit';
import { captionText, postDesignText, stickerText } from '../../lib/packs';
import { fmtDay, fmtRel, todayISO } from '../../lib/format';
import { live, useStudio } from './useStudio';

// Paper colours on purpose: these tiles preview what gets posted, so they stay Paper in both themes.
const P_INK = '#1C1A17';
const paperTile = (ratio: string): CSSProperties => ({
  aspectRatio: ratio, display: 'grid', alignContent: 'space-between', gap: 8, padding: 12, border: '1px solid rgba(28,26,23,.2)', borderRadius: 12,
  background: 'repeating-linear-gradient(135deg, rgba(28,26,23,.06) 0 1px, transparent 1px 9px), #ECE6D9', color: P_INK, overflow: 'hidden', minWidth: 0,
});
const pLabel: CSSProperties = { font: `400 10px/1.4 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(28,26,23,.5)' };
const field: CSSProperties = { height: 42, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', outline: 'none' };

export function PostsTab({ cur, idea }: { cur: Pack; idea: Idea | null }) {
  if (!idea) return <p style={{ margin: 0, font: `italic 400 19px/1.4 ${SERIF}`, color: 'var(--faint)' }}>This pack's idea was not found.</p>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px), 1fr))', gap: 40, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <CaptionEditor cur={cur} />
          <MarkPosted idea={idea} />
        </div>
        <PostBlock idea={idea} kind="story" />
      </div>
      <PostBlock idea={idea} kind="carousel" />
    </>
  );
}

/** The design's post caption textarea. Edits save to packs.captionFinal when the field loses focus. */
function CaptionEditor({ cur }: { cur: Pack }) {
  const S = useStudio();
  const store = useStore();
  const saved = cur.captionFinal || cur.caption;
  const [v, setV] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [at, setAt] = useState('');
  useEffect(() => { if (!dirty) setV(saved); }, [saved, dirty]);
  useEffect(() => { setDirty(false); setAt(''); }, [cur.id]);
  const save = () => {
    if (!dirty) return;
    const text = v.slice(0, 2200);
    void S.run(`caption:${cur.id}`, async () => { await store.mutate('packs', cur.id, () => ({ captionFinal: text })); setDirty(false); setAt(new Date().toISOString()); });
  };
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <label htmlFor="post-caption" style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Post caption</label>
        <span id="post-caption-state" role="status" style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{S.busy.has(`caption:${cur.id}`) ? 'Saving…' : dirty ? 'Edited' : at ? 'Saved' : cur.captionFinal ? 'Your edit' : ''}</span>
      </div>
      <textarea id="post-caption" rows={7} value={v} maxLength={2200} onChange={(e) => { setV(e.target.value); setDirty(true); }} onBlur={save}
        style={{ width: '100%', padding: '20px 22px', border: '1px solid var(--line2)', borderRadius: 14, background: 'var(--sf)', resize: 'vertical', font: `400 16px/1.55 ${SERIF}`, color: 'var(--ink)', outline: 'none' }} />
    </>
  );
}

/** "Mark as posted": date + link (https only) -> ideas.posted, with the board's move rule. */
function MarkPosted({ idea }: { idea: Idea }) {
  const S = useStudio();
  const [date, setDate] = useState(idea.posted?.date || todayISO());
  const [link, setLink] = useState(idea.posted?.link || '');
  const [err, setErr] = useState('');
  useEffect(() => { setDate(idea.posted?.date || todayISO()); setLink(idea.posted?.link || ''); setErr(''); }, [idea.id, idea.posted?.date, idea.posted?.link]);
  const busy = S.busy.has(`idea:${idea.id}`);
  const submit = () => void S.postIdea(idea, date, link).then((e) => setErr(e ?? ''));
  return (
    <>
      <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 14 }}>{idea.status === 'Posted' ? `Posted ${fmtDay(idea.posted?.date || '')}` : 'Mark as posted'}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <label htmlFor="posted-date" className="qp-sr">Posted on</label>
        <input id="posted-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, padding: '0 12px', font: `400 13px/1 ${MONO}` }} />
        <label htmlFor="posted-link" className="qp-sr">Link (https only)</label>
        <input id="posted-link" type="url" inputMode="url" placeholder="https://instagram.com/reel/…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="qp-search-input" style={{ ...field, flex: '1 1 180px', minWidth: 0 }} />
        <Btn id="posted-save" kind="ink" h={42} disabled={busy} onClick={submit}>{idea.status === 'Posted' ? 'Save' : 'Posted'}</Btn>
      </div>
      {err && <p role="alert" style={{ margin: 0, font: `400 13px/1.5 ${SANS}`, color: 'var(--caution)' }}>{err}</p>}
      {idea.status === 'Posted' && idea.posted?.link && /^https:\/\//i.test(idea.posted.link) && (
        <a href={idea.posted.link} target="_blank" rel="noopener noreferrer" style={{ font: `400 13px/1.4 ${SANS}`, overflowWrap: 'anywhere' }}>{idea.posted.link.replace(/^https:\/\//i, '')}</a>
      )}
    </>
  );
}

const KIND = {
  story: { title: 'Community stories · paper', write: 'Write story set', noun: 'story set', ratio: '9/16', id: 'post-story' },
  carousel: { title: 'Carousel · paper', write: 'Write carousel', noun: 'carousel', ratio: '4/5', id: 'post-carousel' },
} as const;

function PostBlock({ idea, kind }: { idea: Idea; kind: 'story' | 'carousel' }) {
  const S = useStudio();
  const store = useStore();
  const K = KIND[kind];
  const list = useMemo(() => S.posts.filter((p) => p.ideaCode === idea.code && p.kind === kind).sort((a, b) => b.version - a.version), [S.posts, idea.code, kind]);
  const [sel, setSel] = useState('');
  const [req, setReq] = useState('');
  const [posting, setPosting] = useState<string | null>(null);
  const [copied, copy] = useCopied();
  const p: Post | null = list.find((x) => x.id === sel) ?? list[0] ?? null;
  const job = S.jobs.find((j) => j.node === 'writer' && j.ideaCode === idea.code && j.kind === kind) ?? null;
  const active = !!job && live(job);
  const wkey = `writer:${idea.code}:${kind}`;
  const write = () => void S.queue(wkey, { node: 'writer', kind, ideaCode: idea.code, request: `${K.write}${req.trim() ? `: ${req.trim().slice(0, 200)}` : ''}` }).then((ok) => { if (ok) setReq(''); });
  const markPosted = (post: Post, d: string) => void S.run(`post:${post.id}`, async () => { await store.mutate('posts', post.id, () => ({ postedAt: d })); setPosting(null); });

  return (
    <section id={K.id} aria-labelledby={`${K.id}-h`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Label id={`${K.id}-h`}>{K.title}</Label>
        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
          {p?.postedAt && <span id={`${K.id}-posted`} style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--grow)' }}>Posted {fmtDay(p.postedAt)}</span>}
          {list.length > 1 ? (
            <select id={`${K.id}-ver`} aria-label={`${K.noun} version`} value={p?.id} onChange={(e) => setSel(e.target.value)}
              style={{ height: 32, padding: '0 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--sf)', font: `400 12px/1 ${MONO}`, color: 'var(--ink)' }}>
              {list.map((x) => <option key={x.id} value={x.id}>{`v${x.version}${x.postedAt ? ' · posted' : ''}`}</option>)}
            </select>
          ) : p ? <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>v{p.version}{p.createdAt ? ` · ${fmtRel(p.createdAt)}` : ''}</span> : null}
        </span>
      </div>
      {p ? (
        <>
          <div id={`${K.id}-cards`} style={{ display: 'grid', gridTemplateColumns: kind === 'story' ? 'repeat(3,minmax(0,1fr))' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {kind === 'story' ? p.frames.map((f) => (
              <div key={f.n} data-story-frame={f.n} style={paperTile(K.ratio)}>
                <span style={pLabel}>Story {String(f.n).padStart(2, '0')}</span>
                <span style={{ font: `400 15px/1.3 ${SERIF}`, textWrap: 'pretty' }}>{f.text}</span>
                <span style={{ display: 'grid', gap: 6 }}>
                  {f.visual && <span style={{ font: `400 11px/1.4 ${SANS}`, color: 'rgba(28,26,23,.6)' }}>{f.visual}</span>}
                  {f.sticker && <span title={stickerText(f.sticker)} style={{ justifySelf: 'start', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `400 9.5px/1 ${MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3E6E9C', border: '1px solid #3E6E9C', borderRadius: 999, padding: '5px 8px' }}>{stickerText(f.sticker)}</span>}
                </span>
              </div>
            )) : p.slides.map((x) => (
              <div key={x.n} data-slide={x.n} style={paperTile(K.ratio)}>
                <span style={pLabel}>Slide {String(x.n).padStart(2, '0')}</span>
                <span style={{ display: 'grid', gap: 6 }}>
                  <span style={{ font: `400 18px/1.25 ${SERIF}` }}>{x.headline}</span>
                  {x.body && <span style={{ font: `400 12.5px/1.45 ${SANS}`, color: 'rgba(28,26,23,.72)' }}>{x.body}</span>}
                </span>
                {x.visual ? <span style={{ font: `400 11px/1.4 ${SANS}`, color: 'rgba(28,26,23,.55)' }}>{x.visual}</span> : <span />}
              </div>
            ))}
          </div>
          <div role="group" aria-label={`${K.noun} actions`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Btn id={`${K.id}-copy-design`} kind="ink" onClick={() => copy('d', postDesignText(p), `Claude Design prompt and ${K.noun}`)}>{copied === 'd' ? 'Copied' : 'Copy for Claude Design'}</Btn>
            {(kind === 'carousel' || p.caption || p.cover) && <Btn id={`${K.id}-copy-caption`} onClick={() => copy('c', captionText(p.cover, p.caption), 'Cover and caption')}>{copied === 'c' ? 'Copied' : 'Copy caption'}</Btn>}
            {(kind === 'carousel' || p.altText) && <Btn id={`${K.id}-copy-alt`} disabled={!p.altText} onClick={() => copy('a', p.altText, 'Alt text')}>{copied === 'a' ? 'Copied' : 'Copy alt text'}</Btn>}
            {!p.postedAt && <Btn id={`${K.id}-mark`} kind="quiet" onClick={() => setPosting(posting ? null : todayISO())}>Mark posted</Btn>}
          </div>
          {posting != null && !p.postedAt && (
            <div id={`${K.id}-form`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <label htmlFor={`${K.id}-date`} style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Posted on</label>
              <input id={`${K.id}-date`} type="date" value={posting} onChange={(e) => setPosting(e.target.value)} style={{ ...field, padding: '0 12px', font: `400 13px/1 ${MONO}` }} />
              <Btn id={`${K.id}-confirm`} kind="ink" h={42} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(posting) || S.busy.has(`post:${p.id}`)} onClick={() => markPosted(p, posting)}>Confirm</Btn>
              <Btn id={`${K.id}-cancel`} kind="quiet" h={42} onClick={() => setPosting(null)}>Cancel</Btn>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: kind === 'story' ? 'repeat(3,minmax(0,1fr))' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {(kind === 'story' ? ['the question', 'your answer', 'source'] : ['cover', 'the idea', 'the turn', 'the close']).map((t, i) => (
            <div key={t} style={{ ...paperTile(K.ratio), placeItems: 'center', alignContent: 'center', textAlign: 'center', opacity: 0.7 }}><span style={pLabel}>{kind === 'story' ? 'Story' : 'Slide'} {String(i + 1).padStart(2, '0')} · {t}</span></div>
          ))}
        </div>
      )}
      {job && <JobRow id={`${K.id}-job`} node="writer" note={job.request} status={job.status} at={job.createdAt} error={job.error} />}
      <PromptPill id={`${K.id}-req`} label={`What should change in the ${K.noun}`} value={req} onChange={setReq} onSend={write} maxLength={200}
        placeholder={p ? `What should change in the ${K.noun}? (optional)` : `Anything the Writer should know? (optional)`}
        send={active ? 'Queued…' : p ? 'Write a new version' : K.write} disabled={active} busy={S.busy.has(wkey)} />
    </section>
  );
}
