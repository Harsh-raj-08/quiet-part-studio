import type { CSSProperties } from 'react';
import { MONO, SANS, EASE } from '../design/fonts';
import { segPill, StatusDot, Wordmark } from '../design/primitives';
import { TAB_NAMES, NAV } from './route';
import { useApp } from './context';
import { CommandSearch, UtilSearch } from './Search';

export interface NavMeta { discover: string; library: string; ideas: string; studio: string; insights: string }

const toggleIcon = (
  <span style={{ position: 'relative', display: 'block', width: 12, height: 10, border: '1px solid currentColor', borderRadius: 2 }}>
    <span style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 1, background: 'currentColor' }} />
  </span>
);

function ThemeToggle() {
  const { theme, setTheme } = useApp();
  return (
    <div role="group" aria-label="Theme" style={{ display: 'inline-flex', padding: 3, border: '1px solid var(--line2)', borderRadius: 999 }}>
      {(['night', 'paper'] as const).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} data-theme-btn={t} onClick={() => setTheme(t)} style={segPill(theme === t)}>{t === 'night' ? 'Night' : 'Paper'}</button>
      ))}
    </div>
  );
}

function StatusLine({ side }: { side?: boolean }) {
  const { running, mode } = useApp();
  const text = side ? (running ? `Worker online · ${running} running` : 'Worker idle') : running ? `${running} running` : 'Idle';
  return (
    <div data-status style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 11px/${side ? 1.3 : 1} ${MONO}`, letterSpacing: '.06em', color: 'var(--dim)' }}>
      <StatusDot on={running > 0 || mode !== 'supabase'} />
      <span style={{ whiteSpace: side ? undefined : 'nowrap' }}>{text}</span>
    </div>
  );
}

function DemoPill() {
  const { mode } = useApp();
  if (mode !== 'demo') return null;
  return <span data-demo-pill style={{ whiteSpace: 'nowrap', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', border: '1px dashed var(--line2)', borderRadius: 999, padding: '6px 10px' }}>Demo, changes aren’t saved</span>;
}

export function Sidebar({ meta }: { meta: NavMeta }) {
  const { collapsed, toggleSide, tab, go } = useApp();
  const asideStyle: CSSProperties = {
    position: 'sticky', top: 0, height: '100vh', minWidth: 0, overflow: 'hidden',
    borderRight: collapsed ? '1px solid transparent' : '1px solid var(--line)', background: 'var(--bg)',
    opacity: collapsed ? 0 : 1, transform: collapsed ? 'translateX(-24px)' : 'none',
    transition: `opacity .3s ${EASE} ${collapsed ? '0s' : '.15s'}, transform .5s ${EASE}, border-color .3s, visibility 0s linear ${collapsed ? '.5s' : '0s'}`,
    pointerEvents: collapsed ? 'none' : 'auto', visibility: collapsed ? 'hidden' : 'visible',
  };
  return (
    <aside id="sidebar" aria-hidden={collapsed} inert={collapsed} style={asideStyle}>
      <div style={{ width: 264, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 0 8px' }}>
          <Wordmark />
          <button type="button" id="side-hide" onClick={toggleSide} title="Hide sidebar (⌘\)" aria-label="Hide sidebar" className="qp-hv-op1"
            style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, border: 0, borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--faint)', opacity: 0.7 }}>{toggleIcon}</button>
        </div>
        <div style={{ padding: '6px 8px 0', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Studio</div>
        <div style={{ margin: '44px 8px 14px', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' }}>Pipeline</div>
        <nav aria-label="Pipeline" style={{ position: 'relative', display: 'grid', gap: 2 }}>
          <div aria-hidden="true" style={{ position: 'absolute', left: 19, top: 18, bottom: 18, width: 1, background: 'var(--line2)' }} />
          {NAV.map((n) => {
            const on = n.tab === tab;
            return (
              <button key={n.tab} type="button" data-nav={n.tab} aria-current={on ? 'page' : undefined} onClick={() => go(n.tab)} className="qp-hv-ghost"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 42, padding: '0 10px 0 8px', border: 0, borderRadius: 10, cursor: 'pointer', background: on ? 'var(--ghost)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)', font: `${on ? 500 : 400} 14px/1 ${SANS}` }}>
                <span style={{ position: 'relative', width: 24, display: 'grid', placeItems: 'center' }}>
                  <span style={on ? { width: 9, height: 9, borderRadius: '50%', background: 'var(--lilac)', boxShadow: '0 0 16px var(--lilac)' } : { width: 7, height: 7, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--faint)' }} />
                </span>
                <span style={{ font: `400 10.5px/1 ${MONO}`, letterSpacing: '.08em', color: 'var(--faint)' }}>{n.num}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{n.name}</span>
                <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>{meta[n.tab]}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'grid', gap: 14, padding: '0 8px' }}>
          <button type="button" data-nav="system" onClick={() => go('system')} className="qp-hv-ink"
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, padding: '8px 0', cursor: 'pointer', font: `400 13.5px/1 ${SANS}`, color: tab === 'system' ? 'var(--ink)' : 'var(--dim)' }}>
            System <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--faint)' }}>runs · jobs · settings</span>
          </button>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <DemoPill />
          <StatusLine side />
          <div style={{ display: 'inline-flex', justifySelf: 'start' }}><ThemeToggle /></div>
        </div>
      </div>
    </aside>
  );
}

/** Sticky command header. Collapsed (0fr) while the sidebar shows; 1fr when the sidebar is hidden. */
export function CommandBar() {
  const { collapsed, toggleSide, tab, go } = useApp();
  const cmdWrap: CSSProperties = {
    position: 'sticky', top: 0, zIndex: 20, display: 'grid', gridTemplateRows: collapsed ? '1fr' : '0fr', opacity: collapsed ? 1 : 0, transform: collapsed ? 'none' : 'translateY(-10px)',
    transition: `grid-template-rows .5s ${EASE}, opacity .35s ${EASE} ${collapsed ? '.15s' : '0s'}, transform .5s ${EASE}`, pointerEvents: collapsed ? 'auto' : 'none',
  };
  const cmdStyle = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: on ? 'var(--ink)' : 'var(--faint)' });
  return (
    <div id="cmdbar" aria-hidden={!collapsed} inert={!collapsed} style={cmdWrap}>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <header style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 32, padding: '0 48px', height: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 'none', whiteSpace: 'nowrap' }}><Wordmark /></div>
            <CommandSearch />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20 }}>
              <DemoPill />
              <StatusLine />
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label="Pipeline" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, padding: '0 48px 16px', position: 'relative' }}>
            <button type="button" id="side-show" onClick={toggleSide} title="Show sidebar (⌘\)" aria-label="Show sidebar" className="qp-hv-op1"
              style={{ position: 'absolute', left: 44, top: '50%', marginTop: -19, display: 'grid', placeItems: 'center', width: 22, height: 22, border: 0, borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--faint)', opacity: 0.7 }}>{toggleIcon}</button>
            {NAV.map((n) => {
              const on = n.tab === tab;
              return (
                <button key={n.tab} type="button" data-nav={n.tab} aria-current={on ? 'page' : undefined} onClick={() => go(n.tab)} className="qp-hv-ink" style={cmdStyle(on)}>
                  <span style={on ? { width: 6, height: 6, borderRadius: '50%', background: 'var(--lilac)', boxShadow: '0 0 10px var(--lilac)' } : { display: 'none' }} />
                  {n.num} · {n.name}
                </button>
              );
            })}
            <button type="button" data-nav="system" aria-current={tab === 'system' ? 'page' : undefined} onClick={() => go('system')} className="qp-hv-ink"
              style={{ background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', font: `400 10.5px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: tab === 'system' ? 'var(--ink)' : 'var(--faint)', marginLeft: 12, paddingLeft: 28, borderLeft: '1px solid var(--line2)' }}>System</button>
          </nav>
        </header>
      </div>
    </div>
  );
}

/** Breadcrumb + search row. 64px with the sidebar, 0 with the command bar. */
export function UtilRow() {
  const { collapsed, tab } = useApp();
  const utilStyle: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: collapsed ? 0 : 64, opacity: collapsed ? 0 : 1, overflow: 'hidden',
    borderBottom: `1px solid ${collapsed ? 'transparent' : 'var(--line)'}`, transition: `height .5s ${EASE}, opacity .25s ${EASE}, border-color .3s`,
    font: `400 11px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)',
  };
  return (
    <div id="utilrow" inert={collapsed} style={utilStyle}>
      <span>Pipeline <span style={{ color: 'var(--line2)' }}>/</span> <span style={{ color: 'var(--dim)' }}>{TAB_NAMES[tab]}</span></span>
      <UtilSearch />
    </div>
  );
}
