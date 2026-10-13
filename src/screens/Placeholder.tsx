import type { TabId } from '../lib/headlines';
import { SERIF } from '../design/fonts';
import { Eyebrow, Headline } from '../design/primitives';
import { useHeadline } from '../app/useHeadline';

/** Hero for the screen plus a quiet "Arrives in the next build" block, in the design's empty-state language. */
export function Placeholder({ tab }: { tab: TabId }) {
  const h = useHeadline(tab);
  return (
    <section data-screen={tab} style={{ padding: '56px 0 0' }}>
      <Eyebrow>{h.eb}</Eyebrow>
      <Headline ghost={h.g} lit={h.l} maxCh={22} />
      <div data-arrives style={{ marginTop: 56, border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, font: `italic 400 20px/1.4 ${SERIF}`, color: 'var(--dim)' }}>
        Arrives in the next build.
      </div>
    </section>
  );
}
