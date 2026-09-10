import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { fetchWithTimeout } from '@/lib/supabase/fetch-with-timeout';

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(
    url,
    publishableKey,
    {
      global: {
        fetch: fetchWithTimeout,
      },
    }
  );
}
