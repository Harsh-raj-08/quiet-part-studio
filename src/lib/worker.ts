import { fmtDay, fmtWhen } from './format';

/** The worker writes settings/studio.workerSeenAt on every pass; under 13 h old counts as online. */
export const HEARTBEAT_MS = 13 * 3600 * 1000;
export function workerOnline(seenAt: string, now: number = Date.now()): boolean {
  const t = Date.parse(seenAt);
  return Number.isFinite(t) && now - t < HEARTBEAT_MS && now - t > -HEARTBEAT_MS;
}
/** "idle since 9 Oct" / "idle since yesterday, 18:40"; plain "idle" when the worker has never reported. */
export function idleSince(seenAt: string, now: Date = new Date()): string {
  const t = Date.parse(seenAt);
  if (!Number.isFinite(t)) return 'idle';
  const w = fmtWhen(seenAt, now);
  return `idle since ${/^(today|yesterday)/.test(w) ? w : fmtDay(seenAt, now)}`;
}
