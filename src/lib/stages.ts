import { ALL_STATUS, STAGES, type Idea, type Stage, type Status } from '../data/types';

export { ALL_STATUS, STAGES };
export type Need = 'voice' | 'video' | 'post' | 'drop';

export const EMPTY_COL: Record<Status, string> = {
  Idea: 'New ideas land here.', Approved: 'Approved ideas wait for a pack.', Scripted: 'Ideas with a finished pack.', Voiced: 'Voiceover recorded.',
  Produced: 'Edited and exported.', 'QA passed': 'Checked and ready to post.', Posted: 'Out in the world.', Dropped: 'Nothing dropped.',
};

export type MovePlan =
  | { kind: 'noop' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'ok'; extra: Record<string, unknown>; message: string }
  | { kind: 'prompt'; need: Need };

export interface MoveCtx { hasPack: boolean }

export const stageIndex = (s: string): number => (STAGES as readonly string[]).indexOf(s);

/** The stage "Move to <next> →" goes to. Null for Posted and Dropped. */
export function nextStage(status: Status): Stage | null {
  const x = stageIndex(status);
  return x >= 0 && x < STAGES.length - 1 ? STAGES[x + 1]! : null;
}

/** Where "Move back one stage" goes. For a dropped idea: the last stage it was in. */
export function prevStage(i: Pick<Idea, 'status' | 'history'>): Stage | null {
  if (i.status === 'Dropped') {
    for (let k = i.history.length - 1; k >= 0; k--) {
      const s = i.history[k]!.status;
      if (s !== 'Dropped' && stageIndex(s) >= 0) return s as Stage;
    }
    return 'Idea';
  }
  const x = stageIndex(i.status);
  return x > 0 ? STAGES[x - 1]! : null;
}

/**
 * The single rule set behind the card buttons, the drawer footer, the keyboard menu and drag and drop.
 * Dragging is free in both directions (as designed); the rules below only refuse moves that would
 * leave the pipeline inconsistent, and ask for the missing input otherwise.
 */
export function planMove(idea: Pick<Idea, 'status' | 'history' | 'voiceAssetId' | 'videoAssetId'>, to: Status, ctx: MoveCtx): MovePlan {
  const from = idea.status;
  if (to === from) return { kind: 'noop' };
  if (to === 'Dropped') {
    if (from === 'Posted') return { kind: 'invalid', reason: "A posted idea can't be dropped. Move it back first." };
    return { kind: 'prompt', need: 'drop' };
  }
  if (from === 'Dropped') {
    const prev = prevStage(idea);
    if (to === 'Idea' || to === prev) return { kind: 'ok', extra: { dropReason: '' }, message: `Restored to ${to}` };
    return { kind: 'invalid', reason: `Restore it first: drop it on Idea${prev && prev !== 'Idea' ? ` or ${prev}` : ''}.` };
  }
  const fi = stageIndex(from);
  const ti = stageIndex(to);
  if (ti < fi) {
    const extra: Record<string, unknown> = from === 'Posted' ? { posted: null } : {};
    return { kind: 'ok', extra, message: `Moved back to ${to}` };
  }
  if (to === 'Scripted' && !ctx.hasPack) return { kind: 'invalid', reason: 'No pack yet. Press Write pack first.' };
  if (to === 'Voiced' && !idea.voiceAssetId) return { kind: 'prompt', need: 'voice' };
  if (to === 'Produced' && !idea.videoAssetId) return { kind: 'prompt', need: 'video' };
  if (to === 'Posted') return { kind: 'prompt', need: 'post' };
  return { kind: 'ok', extra: {}, message: `Moved to ${to}` };
}

/** history + status patch, appended to the *fresh* document (never to a stale copy). */
export function buildMovePatch(cur: Record<string, unknown>, to: Status, extra: Record<string, unknown> | null, at: string): Record<string, unknown> {
  let hist = Array.isArray(cur.history) ? (cur.history as unknown[]).slice() : [];
  hist.push({ status: to, at });
  if (hist.length > 100) hist = hist.slice(-100);
  return { status: to, updatedAt: at, history: hist, ...(extra ?? {}) };
}

/** Score-descending order, stable on the incoming order (the design's sort). */
export const byScore = <T extends { total: number }>(l: T[]): T[] => l.slice().sort((a, b) => b.total - a.total);

export function columnItems<T extends { status: string; total: number }>(visible: T[], stage: string): T[] {
  return byScore(visible.filter((i) => i.status === stage));
}

/**
 * Index at which the dragged card would land in `stage` (score-sorted position). Ported from the
 * design: simulate the move on the visible list, sort, find the dragged card.
 */
export function placeholderIndex<T extends { code: string; status: string; total: number }>(visible: T[], dragged: T, stage: string): number {
  const sim = visible.map((x) => (x.code === dragged.code ? { ...x, status: stage } : x)).filter((x) => x.status === stage);
  const sorted = byScore(sim);
  return Math.max(0, sorted.findIndex((x) => x.code === dragged.code));
}
