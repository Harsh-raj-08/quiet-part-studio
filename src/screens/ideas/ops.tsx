import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { checkFile, demoSays, errMsg, fireAndDescribe, MEDIA, moveIdea, queueJob, uploadMedia, type MediaKind } from '../../data/actions';
import { useBooks, useIdeas, useJobs, useMetrics, usePacks } from '../../data/hooks';
import { useStore } from '../../data/store';
import type { Book, Idea, Job, Metric, Pack, Status } from '../../data/types';
import { useToast } from '../../design/primitives';
import { isHttps } from '../../data/types';
import { planMove, prevStage, type Need } from '../../lib/stages';
import { todayISO } from '../../lib/format';

export type Origin = 'dnd' | 'card' | 'drawer' | 'menu';
export interface Pending { id: string; code: string; to: Status; need: Need; origin: Origin }

export interface Ops {
  ideas: Idea[];
  books: Book[];
  bookById: Map<string, Book>;
  packsByIdea: Map<string, Pack[]>;
  curPack: (i: Idea) => Pack | null;
  metricByCode: Map<string, Metric>;
  writerJob: (code: string) => Job | undefined;
  qaJob: (code: string) => Job | undefined;
  busy: Set<string>;
  uploading: Set<string>;
  pending: Pending | null;
  requestMove: (idea: Idea, to: Status, origin: Origin) => void;
  cancelPending: () => void;
  confirmDrop: (reason: string) => Promise<boolean>;
  confirmPost: (date: string, link: string) => Promise<string | null>;
  confirmWithoutFile: () => Promise<boolean>;
  upload: (idea: Idea, kind: MediaKind, file: File | undefined) => Promise<boolean>;
  moveBack: (idea: Idea) => void;
  moveForward: (idea: Idea, to: Status) => void;
  writePack: (idea: Idea) => Promise<void>;
  runQa: (idea: Idea) => Promise<void>;
  openPackFor: (idea: Idea) => void;
}

const Ctx = createContext<Ops | null>(null);
export function useOps(): Ops {
  const c = useContext(Ctx);
  if (!c) throw new Error('IdeaOps missing');
  return c;
}

const live = (j: Job) => j.status === 'queued' || j.status === 'running';

/** All the idea operations in one place, so cards, the drawer, the keyboard menu and drag and drop share one rule set. */
export function IdeaOps({ children }: { children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const { go, openPackId } = useApp();
  const ideas = useIdeas(); const books = useBooks(); const packs = usePacks(); const jobs = useJobs(); const metrics = useMetrics();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const inflight = useRef(new Set<string>());

  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const metricByCode = useMemo(() => new Map(metrics.map((m) => [m.ideaCode, m])), [metrics]);
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
      const byId = l.find((p) => p.id === i.packCurrent);
      if (byId) return byId;
      const n = +i.packCurrent;
      if (Number.isFinite(n)) { const p = l.find((x) => x.version === n); if (p) return p; }
    }
    return l[0] ?? null;
  }, [packsByIdea]);
  const writerJob = useCallback((code: string) => jobs.find((j) => j.node === 'writer' && j.ideaCode === code && !j.kind && live(j)), [jobs]);
  const qaJob = useCallback((code: string) => jobs.find((j) => j.node === 'qa' && j.ideaCode === code && live(j)), [jobs]);

  const mark = (set: React.Dispatch<React.SetStateAction<Set<string>>>, k: string, on: boolean) =>
    set((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; });

  /** Runs one write at a time per idea. Returns true when the write went through. */
  const run = useCallback(async (idea: Idea, to: Status, extra: Record<string, unknown> | null, msg: string): Promise<boolean> => {
    const key = `idea:${idea.id}`;
    if (inflight.current.has(key)) return false;
    inflight.current.add(key); mark(setBusy, key, true);
    try {
      await moveIdea(store, idea.id, to, extra);
      toast(msg);
      return true;
    } catch (e) { toast(errMsg(e), true); return false; }
    finally { inflight.current.delete(key); mark(setBusy, key, false); }
  }, [store, toast]);

  const requestMove = useCallback((idea: Idea, to: Status, origin: Origin) => {
    if (inflight.current.has(`idea:${idea.id}`)) return;
    const plan = planMove(idea, to, { hasPack: !!curPack(idea) });
    if (plan.kind === 'noop') return;
    if (plan.kind === 'invalid') { toast(plan.reason, true); return; }
    if (plan.kind === 'prompt') { setPending({ id: idea.id, code: idea.code, to, need: plan.need, origin }); return; }
    setPending(null);
    void run(idea, to, plan.extra, plan.message);
  }, [curPack, run, toast]);

  const pendingIdea = useCallback((): Idea | null => (pending ? ideas.find((i) => i.id === pending.id) ?? null : null), [pending, ideas]);

  const confirmDrop = useCallback(async (reason: string) => {
    const i = pendingIdea();
    if (!i || !pending) return false;
    const ok = await run(i, 'Dropped', { dropReason: reason.trim() }, 'Dropped');
    if (ok) setPending(null);
    return ok;
  }, [pending, pendingIdea, run]);

  const confirmPost = useCallback(async (date: string, link: string): Promise<string | null> => {
    const i = pendingIdea();
    if (!i) return 'That idea is gone.';
    const l = link.trim();
    if (l && !isHttps(l)) return 'The link must start with https://';
    const ok = await run(i, 'Posted', { posted: { date: date || todayISO(), link: l } }, 'Marked posted');
    if (ok) setPending(null);
    return ok ? null : 'Could not save that change.';
  }, [pendingIdea, run]);

  const confirmWithoutFile = useCallback(async () => {
    const i = pendingIdea();
    if (!i || !pending) return false;
    const ok = await run(i, pending.to, null, `Moved to ${pending.to}`);
    if (ok) setPending(null);
    return ok;
  }, [pending, pendingIdea, run]);

  const upload = useCallback(async (idea: Idea, kind: MediaKind, file: File | undefined): Promise<boolean> => {
    if (!file) return false;
    const bad = checkFile(kind, file);
    if (bad) { toast(bad, true); return false; }
    const key = `${kind}:${idea.code}`;
    if (inflight.current.has(key)) return false;
    inflight.current.add(key); mark(setUploading, key, true);
    try {
      await uploadMedia(store, idea, kind, file);
      const fresh = await store.get('ideas', idea.id);
      if (fresh && fresh.data.status === MEDIA[kind].to) { toast(demoSays(store, kind === 'voice' ? 'Voiceover uploaded' : 'Video uploaded')); }
      else await moveIdea(store, idea.id, MEDIA[kind].to, null).then(() => toast(demoSays(store, kind === 'voice' ? 'Voiceover uploaded. Moved to Voiced' : 'Video uploaded. Moved to Produced')));
      setPending((p) => (p && p.id === idea.id ? null : p));
      return true;
    } catch (e) { toast(errMsg(e), true); return false; }
    finally { inflight.current.delete(key); mark(setUploading, key, false); }
  }, [store, toast]);

  const moveBack = useCallback((idea: Idea) => {
    const prev = prevStage(idea);
    if (!prev) return;
    requestMove(idea, prev, 'drawer');
  }, [requestMove]);
  const moveForward = useCallback((idea: Idea, to: Status) => requestMove(idea, to, 'drawer'), [requestMove]);

  const writePack = useCallback(async (idea: Idea) => {
    const key = `writer:${idea.code}`;
    if (writerJob(idea.code) || inflight.current.has(key)) return;
    inflight.current.add(key); mark(setBusy, key, true);
    try {
      await queueJob(store, { node: 'writer', request: 'Write production pack', ideaCode: idea.code });
      toast(await fireAndDescribe(store));
    } catch (e) { toast(errMsg(e), true); }
    finally { inflight.current.delete(key); mark(setBusy, key, false); }
  }, [store, toast, writerJob]);

  const runQa = useCallback(async (idea: Idea) => {
    if (!idea.videoAssetId) { toast('Upload the video first', true); return; }
    const key = `qa:${idea.code}`;
    if (qaJob(idea.code) || inflight.current.has(key)) return;
    inflight.current.add(key); mark(setBusy, key, true);
    try {
      const p = curPack(idea);
      await queueJob(store, { node: 'qa', request: 'Check before posting', ideaCode: idea.code, packId: p?.id, videoAssetId: idea.videoAssetId });
      toast(await fireAndDescribe(store));
    } catch (e) { toast(errMsg(e), true); }
    finally { inflight.current.delete(key); mark(setBusy, key, false); }
  }, [store, toast, qaJob, curPack]);

  const openPackFor = useCallback((idea: Idea) => {
    const p = curPack(idea);
    if (!p) { toast('No pack found for this idea', true); return; }
    openPackId(p.id, 'script');
  }, [curPack, go, openPackId, toast]);

  const value: Ops = {
    ideas, books, bookById, packsByIdea, curPack, metricByCode, writerJob, qaJob, busy, uploading, pending, requestMove,
    cancelPending: () => setPending(null), confirmDrop, confirmPost, confirmWithoutFile, upload, moveBack, moveForward, writePack, runQa, openPackFor,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
