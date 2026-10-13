import type { Adapter } from './adapter';
import { FIXTURES } from './fixtures';
import { createMockAdapter } from './mockAdapter';

/** mock (tests) and demo (public demo) share the in-memory adapter; only MOCK=1 builds expose window.__mock. */
export function bootMock(mode: 'mock' | 'demo'): Adapter {
  const { adapter, handle } = createMockAdapter(FIXTURES, mode);
  if (__MOCK__) window.__mock = handle;
  return adapter;
}
