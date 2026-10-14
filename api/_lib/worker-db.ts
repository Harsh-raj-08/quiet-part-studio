import type { SupabaseClient } from '@supabase/supabase-js';
import { ConflictError, type Op, type WDoc, type WorkerDb } from './worker-core';

const col = (f: string) => (f === 'id' ? 'id' : `data->>${f}`);

/** WorkerDb over the service-role Supabase client (server only). Writes go through write_doc (versioned). */
export function supabaseWorkerDb(sb: SupabaseClient): WorkerDb {
  return {
    async get(table, id) {
      const { data, error } = await sb.from(table).select('id,data,version').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as WDoc | null) ?? null;
    },
    async query(table, where, orderBy, limit) {
      let q = sb.from(table).select('id,data,version');
      for (const [f, op, v] of where as [string, Op, unknown][]) {
        if (op === 'in') q = q.in(col(f), (v as unknown[]).map(String));
        else q = q.filter(col(f), op, String(v));
      }
      if (orderBy) q = q.order(col(orderBy.field), { ascending: orderBy.dir !== 'desc' });
      const { data, error } = await q.limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as WDoc[];
    },
    async write(table, id, data, ifVersion, merge) {
      const { data: rows, error } = await sb.rpc('write_doc', { p_table: table, p_id: id, p_data: data, p_if_version: ifVersion, p_merge: merge });
      if (error) { if (/version_conflict/.test(error.message)) throw new ConflictError(); throw new Error(error.message); }
      const row = (Array.isArray(rows) ? rows[0] : rows) as { id: string; version: number } | undefined;
      if (!row) throw new ConflictError();
      return row;
    },
    async signedDownload(path, seconds) {
      const { data, error } = await sb.storage.from('studio').createSignedUrl(path, seconds);
      if (error || !data) throw new Error(error?.message ?? 'no_url');
      return data.signedUrl;
    },
    async signedUpload(path) {
      const { data, error } = await sb.storage.from('studio').createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? 'no_url');
      return { url: data.signedUrl, token: data.token };
    },
  };
}
