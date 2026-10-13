import { useMemo } from 'react';
import { useBooks, useIdeas, useJobs, useMetrics, useReports } from '../data/hooks';
import { useCollection } from '../data/store';
import { useLoadedMap } from './useLoadedMap';
import { headlines, type Headline, type TabId } from '../lib/headlines';

/** Hero text for a screen, from live data. `now` lets tests freeze the date line. */
export function useHeadline(tab: TabId): Headline {
  const ideas = useIdeas(); const books = useBooks(); const jobs = useJobs(); const metrics = useMetrics(); const reports = useReports();
  const runsRaw = useCollection('runs');
  const ratings = useCollection('ratings');
  const loaded = useLoadedMap();
  const runs = useMemo(() => runsRaw.map((d) => ({ id: d.id, status: String(d.data.status ?? ''), jobId: String(d.data.jobId ?? ''), finishedAt: String(d.data.finishedAt ?? ''), at: String(d.data.at ?? '') })), [runsRaw]);
  return useMemo(
    () => headlines(tab, { loading: (n) => !loaded[n], ideas, books, jobs, runs, metrics, reports, ratings: ratings.length }),
    [tab, loaded, ideas, books, jobs, runs, metrics, reports, ratings.length],
  );
}
