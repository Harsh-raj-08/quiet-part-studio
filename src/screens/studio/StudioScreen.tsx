import { useApp } from '../../app/context';
import { useHeadline } from '../../app/useHeadline';
import { Eyebrow, Headline } from '../../design/primitives';
import { PackDetail } from './PackDetail';
import { PackGrid } from './PackGrid';
import { StudioProvider, useStudio } from './useStudio';

/** 04 · Studio: the pack grid ("All packs"), or one pack's detail when the hash names a pack. */
export function StudioScreen() {
  return <StudioProvider><Studio /></StudioProvider>;
}

function Studio() {
  const h = useHeadline('studio');
  const { openPack } = useApp();
  const S = useStudio();
  const pack = openPack ? S.packById.get(openPack) ?? null : null;
  return (
    <div data-screen="studio">
      <section style={{ padding: '56px 0 0' }}>
        <Eyebrow>{h.eb}</Eyebrow>
        <Headline ghost={h.g} lit={h.l} maxCh={22} />
      </section>
      {openPack && pack ? <PackDetail pack={pack} /> : openPack && !S.loaded ? <div aria-busy="true" style={{ minHeight: '60vh' }} /> : <PackGrid missing={openPack && S.loaded ? openPack : null} />}
    </div>
  );
}
