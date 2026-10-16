import { useApp } from '../../app/context';
import type { Pack } from '../../data/types';
import { MONO, SANS, SERIF } from '../../design/fonts';
import { Btn, monoChip, SubTabs, useCopied } from '../../design/kit';
import { designText, fmtDur, stampLines, versionTitle, voText } from '../../lib/packs';
import { FramesTab } from './FramesTab';
import { MediaTab } from './MediaTab';
import { PostsTab } from './PostsTab';
import { ScriptTab } from './ScriptTab';
import { useStudio } from './useStudio';

export const SUBS = [['script', 'Script'], ['frames', 'Frames'], ['qa', 'Media & QA'], ['posts', 'Posts & stories']] as const;
type Sub = (typeof SUBS)[number][0];

/** Pack detail: ← All packs, sub-tabs, pack-code chips; FROM line, the hook as title, meta row with versions, copy buttons. */
export function PackDetail({ pack: cur }: { pack: Pack }) {
  const S = useStudio();
  const { sub, go } = useApp();
  const [copied, copy] = useCopied();
  const idea = S.ideaByCode.get(cur.ideaCode) ?? null;
  const book = idea ? S.bookById.get(idea.bookId) : undefined;
  const from = [book?.title, book?.author].filter(Boolean).join(' · ') || idea?.fromBook || '';
  const vers = (S.packsByIdea.get(cur.ideaCode) ?? [cur]).slice().sort((a, b) => a.version - b.version);
  const current = idea ? S.curPack(idea) : vers[vers.length - 1]!;
  const isOld = !!current && current.id !== cur.id;
  const s = (SUBS.some((x) => x[0] === sub) ? sub : 'script') as Sub;
  const chips = S.groups.filter((g) => g.idea.status !== 'Posted' || g.idea.code === cur.ideaCode);
  const cover = cur.cover || cur.beats[0]?.onscreen || '';
  const busy = S.busy.has(`pack:${cur.ideaCode}`);

  return (
    <div data-pack={cur.id}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, margin: '48px 0 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <button id="pack-back" type="button" onClick={() => go('studio', 'script')} className="qp-hv-line-faint"
            style={{ height: 38, padding: '0 16px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', cursor: 'pointer', font: `400 13px/1 ${SANS}`, color: 'var(--ink)', whiteSpace: 'nowrap' }}>← All packs</button>
          <SubTabs tabs={SUBS} value={s} onChange={(k) => S.open(cur.id, k)} label="Pack sections" idPrefix="sub-studio" />
        </div>
        <div role="group" aria-label="Switch pack" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((g) => {
            const on = g.idea.code === cur.ideaCode;
            return <button key={g.idea.code} id={`pcode-${g.idea.code}`} type="button" aria-pressed={on} title={g.idea.hook} onClick={() => S.open(g.pack.id, s)} style={monoChip(on)}>{g.idea.code}</button>;
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 40, minWidth: 0 }}>
        <header style={{ display: 'grid', gap: 16, paddingBottom: 28, borderBottom: '1px solid var(--line)' }}>
          {from && <span style={{ font: `400 10.5px/1.5 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)' }}><span style={{ color: 'var(--lilac)' }}>¹</span> From · {from}</span>}
          <h2 id="pack-title" style={{ margin: 0, maxWidth: '28ch', font: `300 clamp(28px, 3vw, 38px)/1.12 ${SERIF}`, letterSpacing: '-.022em', textWrap: 'pretty' }}>{idea?.hook || cur.title}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 22px', font: `400 11px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
              {cover && <span>Cover · <span style={{ color: 'var(--ink)' }}>{cover}</span></span>}
              <span>Reel · 9:16</span>
              {cur.durationSec > 0 && <span>{fmtDur(cur.durationSec)}</span>}
              <span>{cur.beats.length} beats</span>
              <span>Pack v{cur.version}</span>
              {vers.length > 1 && (
                <span role="group" aria-label="Version" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, letterSpacing: 0 }}>
                  {vers.map((p) => <button key={p.id} id={`ver-${p.id}`} type="button" aria-pressed={p.id === cur.id} title={versionTitle(p, p.id === current?.id)}
                    onClick={() => S.open(p.id, s)} style={monoChip(p.id === cur.id, { height: 28, padding: '0 10px' })}>v{p.version}</button>)}
                </span>
              )}
              {(() => { const l = stampLines(cur); return (l.written || l.edited) ? <span data-stamp style={{ letterSpacing: 0, textTransform: 'none', font: `400 11.5px/1 ${MONO}`, color: 'var(--faint)' }}>{[l.written, l.edited].filter(Boolean).join(' · ')}</span> : null; })()}
              {isOld && <span style={{ letterSpacing: 0, textTransform: 'none', display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                <span style={{ font: `italic 400 15px/1 ${SERIF}`, color: 'var(--dim)' }}>v{current!.version} is current.</span>
                <Btn id="revert-btn" kind="quiet" h={28} disabled={busy} style={{ padding: '0 12px', font: `400 12px/1 ${SANS}`, border: '1px solid var(--line2)' }}
                  onClick={() => void S.saveVersion(cur, {}, 'revert', `Reverted to v${cur.version}`).then((id) => { if (id) S.open(id, s); })}>Revert to v{cur.version}</Btn>
              </span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Btn id="copy-voice" onClick={() => copy('vo', voText(cur), 'VO script')}>{copied === 'vo' ? 'Copied' : 'Copy VO script'}</Btn>
              <Btn id="copy-design" kind="ink" onClick={() => copy('dp', designText(cur), 'Claude Design prompt and script')}>{copied === 'dp' ? 'Copied' : 'Copy for Claude Design'}</Btn>
            </div>
          </div>
        </header>
        <div role="tabpanel" aria-labelledby={`sub-studio-${s}`} id="studio-pane" style={{ display: 'grid', gap: 40, minWidth: 0 }}>
          {s === 'script' && <ScriptTab cur={cur} idea={idea} />}
          {s === 'frames' && <FramesTab cur={cur} />}
          {s === 'qa' && <MediaTab cur={cur} idea={idea} />}
          {s === 'posts' && <PostsTab cur={cur} idea={idea} />}
        </div>
      </div>
    </div>
  );
}
