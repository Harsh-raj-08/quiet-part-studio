import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { checkFile, demoSays, errMsg, fireAndDescribe, mediaFolder, MEDIA, moveIdea, queueJob, type MediaKind, type QueueJob } from '../../data/actions';
import { useBooks, useIdeas, useJobs, usePacks, usePosts, useQa, useRatings, useLoaded } from '../../data/hooks';
import { useStore } from '../../data/store';
import { isHttps, type Book, type Idea, type Job, type Pack, type Post, type QaRec, type Rating, type Status } from '../../data/types';
import { useToast } from '../../design/primitives';
import { ownerStamp, versionId, PROD_STAGES } from '../../lib/packs';
import { planMove } from '../../lib/stages';

export const live = (j: Job) => j.status === 'queued' || j.status === 'running';

export interface Studio {
  loaded: boolean;
  ideas: Idea[]; ideaByCode: Map<string, Idea>; bookById: Map<string, Book>;
  packsByIdea: Map<string, Pack[]>; packById: Map<string, Pack>; curPack: (i: Idea) => Pack | null;
  /** Pack groups shown on the grid (ideas in Scripted → QA passed, plus Posted ones), in idea rank order. */
  groups: { idea: Idea; pack: Pack }[];
  jobs: Job[]; qaByPack: Map<string, QaRec[]>; qaByIdea: Map<string, QaRec[]>; posts: Post[]; ratings: Rating[];
  busy: Set<string>;
  run: (key: string, fn: () => Promise<unknown>) => Promise<boolean>;
  open: (packId: string, sub?: string) => void;
  queue: (key: string, job: QueueJob) => Promise<boolean>;
  saveVersion: (cur: Pack, patch: Record<string, unknown>, by: string, note: string, ideaExtra?: Record<string, unknown>) => Promise<string | null>;
  uploadMedia: (idea: Idea, kind: MediaKind, file: File | undefined) => Promise<boolean>;
  postIdea: (idea: Idea, date: string, link: string) => Promise<string | null>;
}

const Ctx = createContext<Studio | null>(null);
export function useStudio(): Studio { const c = useContext(Ctx); if (!c) throw new Error('StudioProvider missing'); return c; }

export function StudioProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const { openPackId } = useApp();
  const ideas = useIdeas(); const books = useBooks(); const packs = usePacks(); const jobs = useJobs(); const qa = useQa(); const posts = usePosts(); const ratings = useRatings();
  const packsLoaded = useLoaded('packs'); const ideasLoaded = useLoaded('ideas');
  const loaded = packsLoaded && ideasLoaded;
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const inflight = useRef(new Set<string>());

  const ideaByCode = useMemo(() => new Map(ideas.map((i) => [i.code, i])), [ideas]);
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const packById = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs]);
  const packsByIdea = useMemo(() => {
    const m = new Map<string, Pack[]>();
    packs.forEach((p) => { const l = m.get(p.ideaCode); if (l) l.push(p); else m.set(p.ideaCode, [p]); });
    m.forEach((l) => l.sort((a, b) => b.version - a.version));
    return m;
  }, [packs]);
  const curPack = useCallback((i: Idea): Pack | null => {
    const l = packsByIdea.get(i.code);
    if (!l) return null;
    if (i.packCurrent) {
      const p = l.find((x) => x.id === i.packCurrent) ?? (Number.isFinite(+i.packCurrent) ? l.find((x) => x.version === +i.packCurrent) : undefined);
      if (p) return p;
    }
    return l[0] ?? null;
  }, [packsByIdea]);
  const groups = useMemo(() => ideas
    .filter((i) => (PROD_STAGES as readonly string[]).includes(i.status) || i.status === 'Posted')
    .map((idea) => ({ idea, pack: curPack(idea) }))
    .filter((g): g is { idea: Idea; pack: Pack } => !!g.pack), [ideas, curPack]);
  const qaByPack = useMemo(() => { const m = new Map<string, QaRec[]>(); qa.forEach((q) => { const l = m.get(q.packId); if (l) l.push(q); else m.set(q.packId, [q]); }); return m; }, [qa]);
  const qaByIdea = useMemo(() => { const m = new Map<string, QaRec[]>(); qa.forEach((q) => { const l = m.get(q.ideaCode); if (l) l.push(q); else m.set(q.ideaCode, [q]); }); return m; }, [qa]);

  /** One write at a time per key; errors become a toast. */
  const run = useCallback(async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    if (inflight.current.has(key)) return false;
    inflight.current.add(key); setBusy((s) => new Set(s).add(key));
    try { await fn(); return true; }
    catch (e) { toast(errMsg(e), true); return false; }
    finally { inflight.current.delete(key); setBusy((s) => { const n = new Set(s); n.delete(key); return n; }); }
  }, [toast]);

  const queue = useCallback((key: string, job: QueueJob) => run(key, async () => {
    await queueJob(store, job);
    toast(await fireAndDescribe(store));
  }), [run, store, toast]);

  /** v{n+1} from the fresh current pack + patch; voiceover recomputed when beats change; then idea.packCurrent (fresh get). */
  const saveVersion = useCallback(async (cur: Pack, patch: Record<string, unknown>, by: string, note: string, ideaExtra?: Record<string, unknown>) => {
    let out: string | null = null;
    await run(`pack:${cur.ideaCode}`, async () => {
      const base = await store.get('packs', cur.id);
      if (!base) throw Object.assign(new Error('missing'), { code: 'missing' });
      const top = Math.max(cur.version, ...(packsByIdea.get(cur.ideaCode) ?? []).map((p) => p.version));
      const nv = top + 1;
      const id = versionId(cur.ideaCode, nv);
      const doc: Record<string, unknown> = { ...base.data, ...patch, ideaCode: cur.ideaCode, version: nv, createdBy: by, basedOn: cur.id, createdAt: new Date().toISOString(), changeNote: note, ...ownerStamp() };
      if (Array.isArray(patch.beats)) doc.voiceover = (patch.beats as { vo: string }[]).map((b) => b.vo).join('\n');
      await store.set('packs', id, doc);
      const idea = ideaByCode.get(cur.ideaCode);
      if (idea) await store.mutate('ideas', idea.id, () => ({ packCurrent: id, updatedAt: new Date().toISOString(), ...(ideaExtra ?? {}) }));
      out = id;
      toast(`Saved as v${nv}`);
    });
    return out;
  }, [run, store, packsByIdea, ideaByCode, toast]);

  /** Upload to studio/media/{code}/…, record the path on the idea, and move it on only from the stage the board would. */
  const uploadMedia = useCallback(async (idea: Idea, kind: MediaKind, file: File | undefined) => {
    if (!file) return false;
    const bad = checkFile(kind, file);
    if (bad) { toast(bad, true); return false; }
    return run(`upload:${kind}:${idea.code}`, async () => {
      const r = await store.adapter.uploadFile(file, { folder: mediaFolder(idea.code) });
      const at = new Date().toISOString();
      await store.mutate('ideas', idea.id, () => (kind === 'voice'
        ? { voiceAssetId: r.path, voiceFileName: file.name, voiceUploadedAt: at }
        : { videoAssetId: r.path, videoFileName: file.name, videoSize: file.size, videoUploadedAt: at }));
      const from: Status = kind === 'voice' ? 'Scripted' : 'Voiced';
      if (idea.status === from) { await moveIdea(store, idea.id, MEDIA[kind].to, null); toast(demoSays(store, `${kind === 'voice' ? 'Voiceover' : 'Video'} uploaded. Moved to ${MEDIA[kind].to}`)); }
      else toast(demoSays(store, `${kind === 'voice' ? 'Voiceover' : 'Video'} uploaded`));
    });
  }, [run, store, toast]);

  /** Mark the reel posted: same rule as the board's Posted prompt (https link only), or update the date/link when already posted. */
  const postIdea = useCallback(async (idea: Idea, date: string, link: string): Promise<string | null> => {
    const l = link.trim();
    if (l && !isHttps(l)) return 'Links must start with https://';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Pick the date it went out.';
    const posted = { date, link: l };
    const ok = await run(`idea:${idea.id}`, async () => {
      if (idea.status === 'Posted') { await store.mutate('ideas', idea.id, () => ({ posted, updatedAt: new Date().toISOString() })); toast('Posted details saved'); return; }
      const plan = planMove(idea, 'Posted', { hasPack: true });
      if (plan.kind === 'invalid') throw Object.assign(new Error(plan.reason), { code: 'x' });
      await moveIdea(store, idea.id, 'Posted', { posted });
      toast('Marked posted');
    });
    return ok ? null : 'Could not save that change.';
  }, [run, store, toast]);

  const value: Studio = {
    loaded, ideas, ideaByCode, bookById, packsByIdea, packById, curPack, groups, jobs, qaByPack, qaByIdea, posts, ratings, busy, run,
    open: (id, sub) => openPackId(id, sub), queue, saveVersion, uploadMedia, postIdea,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
