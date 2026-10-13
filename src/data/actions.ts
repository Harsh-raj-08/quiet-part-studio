import type { Store } from './store';
import type { Status } from './types';
import { buildMovePatch } from '../lib/stages';

export function errMsg(e: unknown): string {
  const c = e && typeof e === 'object' ? (e as { code?: string; message?: string }) : {};
  if (c.code === 'missing') return 'That item no longer exists.';
  if (c.code === 'version_conflict') return 'A newer version appeared. Try again.';
  if (/row-level security|permission|42501|not allowed/i.test(c.message ?? '')) return 'That change was refused. You may have view-only access.';
  return 'Could not save that change.';
}

export interface MoveResult { changed: boolean }

/** Move an idea: fresh get, history append, ifVersion write (retried once on conflict). */
export async function moveIdea(store: Store, id: string, to: Status, extra?: Record<string, unknown> | null, now: () => string = () => new Date().toISOString()): Promise<MoveResult> {
  let changed = false;
  await store.mutate('ideas', id, (cur) => {
    if (cur.data.status === to) { changed = false; return null; }
    changed = true;
    return buildMovePatch(cur.data, to, extra ?? null, now());
  });
  return { changed };
}

export const MEDIA = {
  voice: { exts: ['mp3', 'wav', 'm4a'], accept: '.mp3,.wav,.m4a,audio/*', label: 'MP3, WAV or M4A', btn: 'Upload voice', to: 'Voiced' as Status },
  video: { exts: ['mp4', 'mov', 'webm'], accept: '.mp4,.mov,.webm,video/*', label: 'MP4, MOV or WebM', btn: 'Upload video', to: 'Produced' as Status },
} as const;
export type MediaKind = keyof typeof MEDIA;
export const MAX_UPLOAD = 52428800; // the storage bucket's 50 MB limit

export function checkFile(kind: MediaKind, f: File): string | null {
  const ext = (f.name.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase();
  if (!(MEDIA[kind].exts as readonly string[]).includes(ext)) return `Choose a ${MEDIA[kind].label} file.`;
  if (!(f.size > 0)) return 'That file is empty.';
  if (f.size > MAX_UPLOAD) return 'That file is over the 50 MB limit.';
  return null;
}

/** Upload through the adapter, then record it on the idea. Does not move the idea. */
export async function uploadMedia(store: Store, ideaId: string, kind: MediaKind, file: File, now: () => string = () => new Date().toISOString()): Promise<void> {
  const r = await store.adapter.uploadFile(file, { folder: `ideas/${ideaId}` });
  const at = now();
  const patch = kind === 'voice'
    ? { voiceAssetId: r.id, voiceFileName: file.name, voiceUploadedAt: at }
    : { videoAssetId: r.id, videoFileName: file.name, videoSize: file.size, videoUploadedAt: at };
  await store.mutate('ideas', ideaId, () => patch);
}

const sane = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '_');

export interface QueueJob { node: string; request: string; ideaCode?: string; bookId?: string; packId?: string; videoAssetId?: string; kind?: string }

export async function queueJob(store: Store, o: QueueJob, now: () => string = () => new Date().toISOString()): Promise<string> {
  const target = o.ideaCode || o.bookId || 'x';
  const id = sane(`${o.node}-${target}${o.kind ? `-${o.kind}` : ''}-${Date.now()}`);
  const data: Record<string, unknown> = { node: o.node, request: o.request.slice(0, 1200), status: 'queued', createdAt: now() };
  if (o.ideaCode) data.ideaCode = o.ideaCode;
  if (o.bookId) data.bookId = o.bookId;
  if (o.packId) data.packId = o.packId;
  if (o.kind) data.kind = o.kind;
  if (o.videoAssetId) data.videoAssetId = o.videoAssetId;
  await store.set('jobs', id, data);
  return id;
}

/** Fire the worker after queuing. Returns the toast to show. */
export async function fireAndDescribe(store: Store): Promise<string> {
  const r = await store.adapter.fireWorker();
  if (r.ok) return 'Sent to the studio worker. Results appear here in a few minutes.';
  if (r.error === 'too_soon') return 'Queued. The worker was just started and will pick this up.';
  return 'Queued. It runs at the next scheduled check.';
}
