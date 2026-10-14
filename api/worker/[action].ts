import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, serviceClient } from '../_lib/auth';
import { handleWorker, MAX_BODY, type WorkerDb } from '../_lib/worker-core';
import { supabaseWorkerDb } from '../_lib/worker-db';

/** Read the raw body ourselves (never via req.body) so the 1 MB cap holds before any parsing. */
function readBody(req: VercelRequest): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []; let n = 0; let over = false;
    req.on('data', (c: Buffer) => { n += c.length; if (n > MAX_BODY) { over = true; return; } chunks.push(c); });
    req.on('end', () => resolve(over ? 'x'.repeat(MAX_BODY + 1) : Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/**
 * POST /api/worker/{next|get|query|write|file-url|upload-url|heartbeat}
 * Authorization: Bearer <WORKER_TOKEN>. The service-role key stays on the server. See docs/ARCHITECTURE.md.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = String(Array.isArray(req.query.action) ? req.query.action[0] : req.query.action ?? '');
  const len = Number(req.headers['content-length'] ?? 0);
  let db: WorkerDb | null = null;
  try { db = supabaseWorkerDb(serviceClient()); } catch { db = null; }
  const body = req.method === 'POST' && !(len > MAX_BODY) ? await readBody(req) : len > MAX_BODY ? 'x'.repeat(MAX_BODY + 1) : null;
  const out = await handleWorker(
    { method: req.method ?? 'GET', action, contentType: String(req.headers['content-type'] ?? ''), body, token: bearer(req) },
    { workerToken: process.env.WORKER_TOKEN, db, now: () => Date.now() },
  );
  if (out.status === 405) res.setHeader('Allow', 'POST');
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
}
