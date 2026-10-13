// Local test builds alias '@supabase/supabase-js' to this file (it is not installed here).
// The test bundle runs in mock mode, so this is only a safety net: real use throws loudly.
export type SupabaseClient = Record<string, never>;
export function createClient(): SupabaseClient {
  throw new Error('supabase-js is stubbed in the test build. Use mock mode.');
}
