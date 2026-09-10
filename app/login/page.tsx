'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, Button, ErrorBanner } from '@/components/ui';
import PasswordInput from '@/components/password-input';
import { buildVerifyEmailPath, isEmailVerified, safeNextPath } from '@/lib/auth';
import { onboardingRequired } from '@/lib/onboarding';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { copy } = useLocale();
  const [form, setForm] = useState({ email: searchParams.get('email') || '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get('error') === 'confirmation_failed' ? copy.login.invalidLink : '');

  async function redirectAfterLogin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/dashboard');
      return;
    }

    if (!isEmailVerified(user)) {
      router.replace(buildVerifyEmailPath(user.email || form.email, searchParams.get('next')));
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile && onboardingRequired(profile)) {
      router.replace('/onboarding');
      return;
    }

    const target = profile?.role === 'skipper' ? '/dashboard/skipper' : profile?.role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';
    router.replace(safeNextPath(searchParams.get('next'), target));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword(form);
    setLoading(false);
    if (signErr) {
      if (/fetch|network|Failed to fetch/i.test(signErr.message)) {
        setError(copy.login.unavailable);
      } else {
        setError(
          signErr.message === 'Invalid login credentials'
            ? copy.login.invalidCredentials
            : signErr.message
        );
      }
      return;
    }
    await redirectAfterLogin();
    router.refresh();
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <div className="mb-6 flex justify-center"><BrandLogo /></div>
      <h1 className="font-display text-2xl font-bold mb-6 text-center">{copy.login.title}</h1>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label={copy.common.email}>
          <TextInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={copy.common.password}>
          <PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="mb-4 text-right">
          <Link href="/forgot-password" className="text-sm font-semibold text-navy underline">{copy.login.forgot}</Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} {copy.login.submit}
        </Button>
      </form>
      <div className="mt-4 text-sm text-gray-500">
        {copy.login.pending}{' '}
        <Link href={buildVerifyEmailPath(form.email || searchParams.get('email'), searchParams.get('next'))} className="font-semibold text-navy underline">
          {copy.login.resend}
        </Link>
      </div>
      <p className="text-center text-sm mt-5 text-gray-500">
        {copy.login.noAccount} <a href="/signup?role=skipper" className="font-semibold underline text-navy">{copy.login.create}</a>
      </p>
    </main>
  );
}
