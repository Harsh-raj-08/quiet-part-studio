import { useApp } from '../../app/context';
import { useHeadline } from '../../app/useHeadline';
import { SubTabs } from '../../design/kit';
import { Eyebrow, Headline } from '../../design/primitives';
import { Ask } from './Ask';
import { Reports } from './Reports';
import { Trends } from './Trends';

const SUBS = [['ask', 'Ask Scout'], ['reports', 'Scout reports'], ['trends', 'Trends']] as const;
type Sub = (typeof SUBS)[number][0];

/** 01 · Discover: Ask Scout (chat through worker jobs), Scout reports, Trends. */
export function DiscoverScreen() {
  const h = useHeadline('discover');
  const { sub, go } = useApp();
  const s = (SUBS.some((x) => x[0] === sub) ? sub : 'ask') as Sub;
  return (
    <div data-screen="discover">
      <section style={{ padding: '56px 0 0' }}>
        <Eyebrow>{h.eb}</Eyebrow>
        <Headline ghost={h.g} lit={h.l} maxCh={22} />
      </section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px' }}>
        <SubTabs tabs={SUBS} value={s} onChange={(k) => go('discover', k)} label="Discover sections" idPrefix="sub-discover" />
      </div>
      {s === 'ask' && <Ask />}
      {s === 'reports' && <Reports />}
      {s === 'trends' && <Trends />}
    </div>
  );
}
