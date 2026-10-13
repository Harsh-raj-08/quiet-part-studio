import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import { App } from './app/App';
import { Login, NotOwner, useAuth } from './app/Auth';
import type { Adapter } from './data/adapter';
import { Store, StoreProvider } from './data/store';

function boot(): Adapter | Promise<Adapter> {
  window.__QPS_CONFIG = __QPS_CONFIG__;
  // Dead branches are removed by the bundler, so a production build carries no fixtures
  // and a test build carries no Supabase client.
  return __QPS_MODE__ === 'supabase'
    ? import('./data/supabaseAdapter').then((m) => m.createSupabaseAdapter(__QPS_CONFIG__))
    : import('./data/mockBoot').then((m) => m.bootMock(__QPS_MODE__));
}

function Gate({ adapter, store }: { adapter: Adapter; store: Store }) {
  const a = useAuth(adapter);
  if (a.status === 'loading') return <div aria-busy="true" style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  if (a.status === 'signed-out') return <Login adapter={adapter} />;
  if (!a.owner) return <NotOwner adapter={adapter} email={a.user?.email ?? ''} />;
  return <StoreProvider store={store}><App /></StoreProvider>;
}

void Promise.resolve(boot()).then((adapter) => {
  const store = new Store(adapter);
  createRoot(document.getElementById('root')!).render(<Gate adapter={adapter} store={store} />);
});
