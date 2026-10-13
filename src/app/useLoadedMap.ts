import { useMemo } from 'react';
import { useLoaded } from '../data/store';

/** Which collections have delivered their first snapshot. */
export function useLoadedMap(): Record<string, boolean> {
  const reports = useLoaded('reports'); const books = useLoaded('books'); const ideas = useLoaded('ideas'); const metrics = useLoaded('metrics'); const jobs = useLoaded('jobs');
  return useMemo(() => ({ reports, books, ideas, metrics, jobs }), [reports, books, ideas, metrics, jobs]);
}
