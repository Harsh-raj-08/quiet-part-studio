import { useCallback, useRef, useState } from 'react';
import { errMsg, fireAndDescribe, queueJob, type QueueJob } from './actions';
import { useStore } from './store';
import { useToast } from '../design/primitives';

/** One write at a time per key, errors as a toast; `queue` adds a job and fires the worker. */
export function useRunner() {
  const store = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const inflight = useRef(new Set<string>());
  const run = useCallback(async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    if (inflight.current.has(key)) return false;
    inflight.current.add(key); setBusy((s) => new Set(s).add(key));
    try { await fn(); return true; } catch (e) { toast(errMsg(e), true); return false; } finally {
      inflight.current.delete(key); setBusy((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [toast]);
  const queue = useCallback(async (key: string, job: QueueJob, after?: (id: string) => Promise<unknown>) => {
    let id = '';
    const ok = await run(key, async () => { id = await queueJob(store, job); if (after) await after(id); toast(await fireAndDescribe(store)); });
    return ok ? id : null;
  }, [run, store, toast]);
  return { busy, run, queue, store, toast };
}
export const isLive = (j: { status: string } | null | undefined) => !!j && (j.status === 'queued' || j.status === 'running');
