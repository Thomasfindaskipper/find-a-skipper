'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, Button, ErrorBanner } from '@/components/ui';

function safeNextPath(nextPath: string | null, fallback: string) {
  if (!nextPath) return fallback;
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return fallback;
  return nextPath;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 12) {
      setError(copy.common.password);
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError(copy.common.password);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.common.confirmPassword);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    const next = safeNextPath(searchParams.get('next'), '/dashboard');
    setTimeout(() => router.replace(next), 1500);
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-2xl font-bold mb-2">{copy.common.password}</h1>
      <p className="text-sm text-gray-500 mb-6">{copy.login.forgot}</p>

      <ErrorBanner message={error} />

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          {extra.resetPassword.updatedRedirecting}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label={copy.common.password}>
            <TextInput type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={copy.common.confirmPassword}>
            <TextInput type="password" required minLength={12} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>

          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 className="animate-spin" size={16} />} {copy.common.save}
          </Button>
        </form>
      )}
    </main>
  );
}
