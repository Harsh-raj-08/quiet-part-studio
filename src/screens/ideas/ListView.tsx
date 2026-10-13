import type { KeyboardEvent } from 'react';
import { useApp } from '../../app/context';
import type { Idea } from '../../data/types';
import { MONO, SERIF } from '../../design/fonts';
import { Stamp } from '../../design/primitives';
import { byScore } from '../../lib/stages';
import { shortBookTitle } from '../../lib/format';
import { useOps } from './ops';

const COLS = '88px minmax(0,1fr) 200px 120px 128px 72px';

export function ListView({ rows }: { rows: Idea[] }) {
  const { selected, select } = useApp();
  const ops = useOps();
  const sorted = byScore(rows);
  const key = (id: string) => (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); } };
  return (
    <div role="table" aria-label="Ideas" data-list style={{ display: 'grid', borderTop: '1px solid var(--line2)' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 24, padding: '14px 8px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', borderBottom: '1px solid var(--line)' }}>
        <span role="columnheader">Code</span><span role="columnheader">Hook</span><span role="columnheader">Source</span><span role="columnheader">Stage</span><span role="columnheader">Evidence</span><span role="columnheader" style={{ textAlign: 'right' }}>Score</span>
      </div>
      {sorted.map((r, k) => {
        const b = ops.bookById.get(r.bookId);
        return (
          <div key={r.id} role="row" tabIndex={0} data-row={r.code} onClick={() => select(r.id)} onKeyDown={key(r.id)} className="qp-hv-ghost"
            style={{ display: 'grid', gridTemplateColumns: COLS, gap: 24, alignItems: 'center', padding: '18px 8px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: selected === r.id ? 'var(--ghost)' : 'transparent' }}>
            <span role="cell" style={{ font: `400 11px/1.6 ${MONO}`, letterSpacing: '.1em', color: 'var(--dim)' }}>{r.code}</span>
            <span role="cell" style={{ font: `400 17px/1.4 ${SERIF}`, textWrap: 'pretty' }}>{r.hook || 'No hook written yet'}</span>
            <span role="cell" style={{ font: `400 10.5px/1.6 ${MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{b ? shortBookTitle(b.title) : r.fromBook}</span>
            <span role="cell" style={{ font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--dim)' }}>{r.status}</span>
            <span role="cell"><Stamp ev={r.evidence} index={k} flat /></span>
            <span role="cell" style={{ textAlign: 'right', font: `400 20px/1.2 ${SERIF}`, fontVariantNumeric: 'tabular-nums' }}>{r.total}</span>
          </div>
        );
      })}
    </div>
  );
}
