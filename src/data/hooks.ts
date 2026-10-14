import { useMemo } from 'react';
import { useCollection, useLoaded, useNorm } from './store';
import { normAccount, normChat, normRun, normSettings, type Account, type Chat, type Run, type StudioSettings, normBook, normIdea, normJob, normMetric, normNote, normPack, normPost, normQa, normRating, normReport, type Book, type Post, type Rating, type BookNote, type Idea, type Job, type Metric, type Pack, type QaRec, type Report } from './types';

export function useBooks(): Book[] {
  const l = useNorm('books', normBook);
  return useMemo(() => l.slice().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)), [l]);
}
export function useIdeas(): Idea[] {
  const l = useNorm('ideas', normIdea);
  return useMemo(() => l.slice().sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.code.localeCompare(b.code)), [l]);
}
export function usePacks(): Pack[] { return useNorm('packs', normPack); }
export function useJobs(): Job[] {
  const l = useNorm('jobs', normJob);
  return useMemo(() => l.slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)), [l]);
}
export function useNotes(): BookNote[] { return useNorm('booknotes', normNote); }
export function useReports(): Report[] { return useNorm('reports', normReport); }
export function useMetrics(): Metric[] { return useNorm('metrics', normMetric); }
export function useQa(): QaRec[] {
  const l = useNorm('qa', normQa);
  return useMemo(() => l.slice().sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)), [l]);
}
export function usePosts(): Post[] { return useNorm('posts', normPost); }
export function useRatings(): Rating[] {
  const l = useNorm('ratings', normRating);
  return useMemo(() => l.filter((r) => r.score >= 1 && r.score <= 10), [l]);
}
export { useLoaded };
export function useChats(): Chat[] {
  const l = useNorm('chats', normChat);
  return useMemo(() => l.slice().sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0)), [l]);
}
export function useRuns(): Run[] {
  const l = useNorm('runs', normRun);
  return useMemo(() => l.slice().sort((a, b) => (Date.parse(b.at || b.startedAt) || 0) - (Date.parse(a.at || a.startedAt) || 0)), [l]);
}
export function useAccount(): Account[] {
  const l = useNorm('account', normAccount);
  return useMemo(() => l.filter((a) => a.followers != null && Date.parse(a.at)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), [l]);
}
export function useSettings(): StudioSettings {
  const docs = useCollection('settings');
  return useMemo(() => normSettings(docs), [docs]);
}
export function usePlaybooks(): { id: string; d: Record<string, unknown> }[] {
  const docs = useCollection('playbooks');
  return useMemo(() => docs.map((x) => ({ id: x.id, d: x.data })), [docs]);
}
