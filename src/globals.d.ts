declare module '*.css';

/** Replaced at build time by esbuild `define` (see scripts/_build.mjs). */
declare const __QPS_MODE__: 'supabase' | 'mock' | 'demo';
declare const __QPS_CONFIG__: { mode: 'supabase' | 'mock' | 'demo'; supabaseUrl: string; supabaseAnonKey: string };
declare const __MOCK__: boolean;

interface Window {
  __QPS_CONFIG?: { mode: 'supabase' | 'mock' | 'demo'; supabaseUrl: string; supabaseAnonKey: string };
  /** Only present in MOCK=1 builds. */
  __mock?: import('./data/mockAdapter').MockHandle;
}
