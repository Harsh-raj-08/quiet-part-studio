import type { CollectionName, Doc, StudioUser } from './types';

export class VersionConflictError extends Error {
  readonly code = 'version_conflict';
  constructor(message = 'version_conflict') { super(message); this.name = 'VersionConflictError'; }
}
export class MissingDocError extends Error {
  readonly code = 'missing';
  constructor(message = 'missing') { super(message); this.name = 'MissingDocError'; }
}
export const isConflict = (e: unknown): e is VersionConflictError => !!e && typeof e === 'object' && (e as { code?: string }).code === 'version_conflict';

export interface WriteOpts { ifVersion?: number }
export interface UploadResult { id: string; path: string; size: number; name: string }
export interface FireResult { ok: boolean; sessionUrl?: string; error?: string }
export type Unsub = () => void;

export interface AuthState {
  /** 'loading' until the first session check has finished. */
  status: 'loading' | 'signed-out' | 'signed-in';
  user: StudioUser | null;
  /** true when the signed-in account has a row in studio_owner. */
  owner: boolean;
}

export interface Adapter {
  readonly mode: 'supabase' | 'mock' | 'demo';
  /** Delivers the full current list immediately (once loaded), then again after every change. */
  subscribe(coll: CollectionName, cb: (docs: Doc[]) => void): Unsub;
  get(coll: CollectionName, id: string): Promise<Doc | null>;
  /** Create. Fails if the id exists. */
  set(coll: CollectionName, id: string, data: Record<string, unknown>): Promise<Doc>;
  /** Merge a patch (top-level keys) into an existing doc. */
  update(coll: CollectionName, id: string, patch: Record<string, unknown>, opts?: WriteOpts): Promise<Doc>;
  /** Replace the whole data object. */
  replace(coll: CollectionName, id: string, data: Record<string, unknown>, opts?: WriteOpts): Promise<Doc>;
  uploadFile(file: File, opts?: { folder?: string }): Promise<UploadResult>;
  signedUrl(pathOrId: string): Promise<string>;
  fireWorker(): Promise<FireResult>;
  user(): Promise<StudioUser | null>;
  // auth (mock/demo adapters are always signed in as the owner)
  auth(): AuthState;
  onAuth(cb: (s: AuthState) => void): Unsub;
  signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
}
