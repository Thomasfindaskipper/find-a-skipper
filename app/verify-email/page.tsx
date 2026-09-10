'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import { buildEmailRedirectTo, isEmailVerified, safeNextPath } from '@/lib/auth';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui';
import { dashboardHrefForRole, onboardingRequired } from '@/lib/onboarding';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { copy } = useLocale();
  const requestedNext = safeNextPath(searchParams.get('next'), '/dashboard');
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(searchParams.get('error') === 'confirmation_failed' ? copy.login.invalidLink : '');
  const [message, setMessage] = useState('');

  const emailHint = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      if (user?.email && !initialEmail) {
        setEmail(user.email);
      }

      if (!isEmailVerified(user)) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile && onboardingRequired(profile)) {
        router.replace('/onboarding');
        return;
      }

      const target = profile?.role ? dashboardHrefForRole(profile.role) : '/dashboard';
      router.replace(safeNextPath(requestedNext, target));
    })();
  }, [initialEmail, requestedNext, router]);

  async function resendConfirmationEmail() {
    setError('');
    setMessage('');

    if (!emailHint || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailHint)) {
      setError(copy.verifyEmail.invalidEmail);
      return;
    }

    setResending(true);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: emailHint,
      options: {
        emailRedirectTo: buildEmailRedirectTo(window.location.origin, requestedNext),
      },
    });
    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage(copy.verifyEmail.sent);
  }

  async function checkVerificationStatus() {
    setChecking(true);
    setError('');
    setMessage('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setChecking(false);

    if (!isEmailVerified(user)) {
      setMessage(copy.verifyEmail.notConfirmed);
      return;
    }

    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-gray-500">
        <Loader2 className="animate-spin" size={20} /> {copy.common.loading}
      </div>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <div className="mb-6 flex justify-center"><BrandLogo /></div>
      <div className="rounded-2xl p-6 bg-white border border-navy/[0.08]">
        <MailCheck size={28} className="text-navy mb-4" />
        <h1 className="font-display text-2xl font-bold mb-3">{copy.verifyEmail.title}</h1>
        <p className="text-sm text-gray-500 mb-5">
          {copy.verifyEmail.description}
        </p>
        <ErrorBanner message={error} />
        {message && <div className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <Field label={copy.common.email}>
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <div className="space-y-3">
          <Button type="button" onClick={resendConfirmationEmail} disabled={resending} className="w-full flex items-center justify-center gap-2">
            {resending && <Loader2 className="animate-spin" size={16} />} {copy.verifyEmail.resend}
          </Button>
          <Button type="button" variant="outline" onClick={checkVerificationStatus} disabled={checking} className="w-full flex items-center justify-center gap-2">
            {checking && <Loader2 className="animate-spin" size={16} />} {copy.verifyEmail.check}
          </Button>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <Link href="/login" className="font-semibold text-navy underline">
            {copy.verifyEmail.back}
          </Link>
          <span className="text-gray-500">{copy.verifyEmail.spam}</span>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  const { copy } = useLocale();
  return (
    <Suspense fallback={<div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}