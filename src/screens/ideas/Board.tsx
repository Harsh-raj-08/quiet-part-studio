import { forwardRef, useRef, type CSSProperties, type DragEvent } from 'react';
import { EMPTY_COL, columnItems, placeholderIndex } from '../../lib/stages';
import type { Idea, Status } from '../../data/types';
import { MONO, SERIF } from '../../design/fonts';
import { Card } from './Card';
import { MovePrompt } from './Controls';
import { useOps } from './ops';

export interface DndState { drag: string | null; dragH: number; over: string | null }

interface BoardProps {
  visible: Idea[];
  stages: Status[];
  dnd: DndState;
  setDnd: (f: (s: DndState) => DndState) => void;
}

/** The "Drop here" placeholder: same height as the dragged card, dashed faint, scale-in. */
function Placeholder({ h }: { h: number }) {
  return (
    <div aria-hidden="true" data-placeholder style={{ height: `${h}px`, borderRadius: 14, border: '1.5px dashed var(--faint)', background: 'var(--ghost)', display: 'grid', placeItems: 'center', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)', animation: 'qpPh .18s ease-out' }}>Drop here</div>
  );
}

/** Seven (or eight) equal columns, horizontal scroll with snap. HTML5 drag and drop exactly as designed. */
export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board({ visible, stages, dnd, setDnd }, ref) {
  const ops = useOps();
  const dragIdea = dnd.drag ? ops.ideas.find((x) => x.code === dnd.drag) ?? null : null;
  const drag = dnd.drag;
  const dragRef = useRef(drag);
  dragRef.current = drag;

  return (
    <div ref={ref} data-board style={{ display: 'flex', gap: 0, overflowX: 'auto', margin: '0 -48px', padding: '4px 36px 40px', scrollSnapType: 'x proximity', scrollPadding: '0 36px', scrollbarWidth: 'thin', scrollbarColor: 'var(--line2) transparent', alignItems: 'stretch' }}>
      {stages.map((s, ci) => {
        const l = columnItems(visible, s);
        const isOver = dnd.over === s && !!drag;
        const showPh = isOver && !!dragIdea && dragIdea.status !== s;
        const pend = ops.pending && ops.pending.origin === 'dnd' && ops.pending.to === s ? ops.pending : null;
        const pendIdea = pend ? ops.ideas.find((i) => i.id === pend.id) ?? null : null;
        // Index at which the dragged (or just-dropped) card lands in this column's score order.
        const phAt = showPh && dragIdea ? placeholderIndex(visible, dragIdea, s) : pendIdea ? placeholderIndex(visible, pendIdea, s) : -1;
        const nodes: React.ReactNode[] = l.map((x, k) => (
          <Card key={x.id} idea={x} k={k} dragging={drag === x.code} onDragStart={(code, h) => setDnd((d) => ({ ...d, drag: code, dragH: h }))}
            onDragEnd={() => setDnd(() => ({ drag: null, dragH: 170, over: null }))} />
        ));
        if (showPh) nodes.splice(phAt, 0, <Placeholder key="__ph" h={dnd.dragH || 170} />);
        else if (pend && pendIdea) nodes.splice(Math.min(phAt, nodes.length), 0, <MovePrompt key="__prompt" pending={pend} variant="column" />);
        const style: CSSProperties = {
          flex: '0 0 328px', scrollSnapAlign: 'start', minWidth: 0, minHeight: '64vh', padding: '0 12px 16px', borderRadius: 16,
          backgroundColor: isOver ? 'var(--ghost)' : 'transparent', boxShadow: isOver ? 'inset 0 0 0 1px var(--line2)' : 'none',
          backgroundImage: ci < stages.length - 1 ? 'linear-gradient(to bottom, var(--line2) 0 2px, transparent 2px)' : 'none', backgroundSize: '1px 7px', backgroundRepeat: 'repeat-y', backgroundPosition: 'right top',
          transition: 'background-color .2s, box-shadow .2s',
        };
        const onOver = (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
          if (dnd.over !== s) setDnd((d) => ({ ...d, over: s }));
        };
        const onLeave = (e: DragEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null) && dnd.over === s) setDnd((d) => ({ ...d, over: null }));
        };
        const onDrop = (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          let code = dragRef.current;
          try { code = e.dataTransfer.getData('text/plain') || code; } catch { /* ignore */ }
          const idea = code ? ops.ideas.find((x) => x.code === code) : null;
          setDnd(() => ({ drag: null, dragH: 170, over: null }));
          if (idea) ops.requestMove(idea, s, 'dnd');
        };
        return (
          <section key={s} data-column={s} data-over={isOver ? 'true' : undefined} aria-label={`${s}, ${l.length}`} onDragOver={onOver} onDragLeave={onLeave} onDrop={onDrop} style={style}>
            <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 14px' }}>
              <h2 style={{ margin: 0, font: `italic 400 21px/1 ${SERIF}`, letterSpacing: '-.01em' }}>{s}</h2>
              <span data-count style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{String(l.length).padStart(2, '0')}</span>
            </header>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
              {nodes}
              {!l.length && !showPh && !pend && (
                <div data-empty style={{ border: '1px dashed var(--line2)', borderRadius: 14, padding: '22px 20px', font: `italic 400 16px/1.4 ${SERIF}`, color: 'var(--faint)' }}>{EMPTY_COL[s]}</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
});
