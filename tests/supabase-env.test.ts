import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupabaseEnv } from '../lib/supabase/env';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

test('getSupabaseEnv uses NEXT_PUBLIC_SUPABASE_ANON_KEY when present', () => {
  resetEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

  const env = getSupabaseEnv();
  assert.equal(env.url, 'https://example.supabase.co');
  assert.equal(env.publishableKey, 'anon-key');
});

test('getSupabaseEnv falls back to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', () => {
  resetEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

  const env = getSupabaseEnv();
  assert.equal(env.url, 'https://example.supabase.co');
  assert.equal(env.publishableKey, 'publishable-key');
});

test('getSupabaseEnv throws when required variables are missing', () => {
  resetEnv();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  assert.throws(() => getSupabaseEnv(), /Missing Supabase env vars/);
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});
