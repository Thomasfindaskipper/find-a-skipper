import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { fetchWithTimeout } from '@/lib/supabase/fetch-with-timeout';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();
  return createServerClient<Database>(
    url,
    publishableKey,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render — safe to ignore
            // because the middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}
