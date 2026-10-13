import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { isConflict, MissingDocError, type Adapter, type WriteOpts } from './adapter';
import type { CollectionName, Doc } from './types';

const EMPTY: Doc[] = [];

/**
 * Holds the latest list per collection. Each collection is subscribed once, on first use, and stays
 * subscribed for the life of the app. Components read through useCollection()/useDoc().
 */
export class Store {
  private raw = new Map<CollectionName, Doc[]>();
  private loadedSet = new Set<CollectionName>();
  private listeners = new Map<CollectionName, Set<() => void>>();
  private started = new Set<CollectionName>();
  constructor(readonly adapter: Adapter) {}

  private ensure(c: CollectionName) {
    if (this.started.has(c)) return;
    this.started.add(c);
    this.adapter.subscribe(c, (docs) => {
      this.raw.set(c, docs);
      this.loadedSet.add(c);
      this.listeners.get(c)?.forEach((l) => l());
    });
  }
  listen(c: CollectionName, cb: () => void): () => void {
    let s = this.listeners.get(c);
    if (!s) { s = new Set(); this.listeners.set(c, s); }
    s.add(cb);
    this.ensure(c);
    return () => { s!.delete(cb); };
  }
  snapshot(c: CollectionName): Doc[] { return this.raw.get(c) ?? EMPTY; }
  loaded(c: CollectionName): boolean { return this.loadedSet.has(c); }
  /** Subscribe now without a component (used to warm collections the shell needs). */
  warm(...cs: CollectionName[]) { cs.forEach((c) => this.ensure(c)); }

  // ------------------------------------------------------------------ write API
  get(c: CollectionName, id: string) { return this.adapter.get(c, id); }
  set(c: CollectionName, id: string, data: Record<string, unknown>) { return this.adapter.set(c, id, data); }
  update(c: CollectionName, id: string, patch: Record<string, unknown>, opts?: WriteOpts) { return this.adapter.update(c, id, patch, opts); }
  replace(c: CollectionName, id: string, data: Record<string, unknown>, opts?: WriteOpts) { return this.adapter.replace(c, id, data, opts); }

  /**
   * Fresh-get, compute a patch from the *current* document, write it with ifVersion. On a version
   * conflict, read again and retry once. (History appends use this so concurrent worker writes are never lost.)
   */
  async mutate(c: CollectionName, id: string, build: (cur: Doc) => Record<string, unknown> | null): Promise<Doc | null> {
    for (let attempt = 0; ; attempt++) {
      const cur = await this.adapter.get(c, id);
      if (!cur) throw new MissingDocError();
      const patch = build(cur);
      if (!patch) return cur;
      try {
        return await this.adapter.update(c, id, patch, { ifVersion: cur.version });
      } catch (e) {
        if (isConflict(e) && attempt === 0) continue;
        throw e;
      }
    }
  }
}

interface Ctx { store: Store; adapter: Adapter }
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  const v = useMemo(() => ({ store, adapter: store.adapter }), [store]);
  return <StoreCtx.Provider value={v}>{children}</StoreCtx.Provider>;
}
export function useStore(): Store {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c.store;
}

export function useCollection(c: CollectionName): Doc[] {
  const store = useStore();
  return useSyncExternalStore((cb) => store.listen(c, cb), () => store.snapshot(c), () => EMPTY);
}
export function useLoaded(c: CollectionName): boolean {
  const store = useStore();
  return useSyncExternalStore((cb) => store.listen(c, cb), () => store.loaded(c), () => false);
}
export function useDoc(c: CollectionName, id: string | null): Doc | null {
  const docs = useCollection(c);
  return useMemo(() => (id ? docs.find((d) => d.id === id) ?? null : null), [docs, id]);
}
/** Normalised, memoised view of a collection. `norm` must be a stable function. */
export function useNorm<T>(c: CollectionName, norm: (d: Doc) => T): T[] {
  const docs = useCollection(c);
  return useMemo(() => docs.map(norm), [docs, norm]);
}
