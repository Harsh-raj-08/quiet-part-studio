import { useMemo } from 'react';
import { useLoaded, useNorm } from './store';
import { normBook, normIdea, normJob, normMetric, normNote, normPack, normPost, normQa, normRating, normReport, type Book, type Post, type Rating, type BookNote, type Idea, type Job, type Metric, type Pack, type QaRec, type Report } from './types';

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
