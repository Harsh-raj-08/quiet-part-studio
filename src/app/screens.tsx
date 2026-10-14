import { lazy, Suspense, type ReactNode } from 'react';

// Each screen is its own chunk (esbuild splitting); Ideas, the default screen, stays in the main bundle.
const named = <K extends string>(p: Promise<Record<K, () => ReactNode>>, k: K) => p.then((m) => ({ default: m[k] }));
export const DiscoverScreen = lazy(() => named(import('../screens/discover/DiscoverScreen'), 'DiscoverScreen'));
export const LibraryScreen = lazy(() => named(import('../screens/library/LibraryScreen'), 'LibraryScreen'));
export const StudioScreen = lazy(() => named(import('../screens/studio/StudioScreen'), 'StudioScreen'));
export const InsightsScreen = lazy(() => named(import('../screens/insights/InsightsScreen'), 'InsightsScreen'));
export const SystemScreen = lazy(() => named(import('../screens/system/SystemScreen'), 'SystemScreen'));

/** While a screen chunk loads: keep the page height so nothing jumps. */
export function ScreenSlot({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div aria-busy="true" style={{ minHeight: '70vh' }} />}>{children}</Suspense>;
}
