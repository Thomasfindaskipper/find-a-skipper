'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, Button, ErrorBanner } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { copy } = useLocale();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-navy mb-6">
        <ArrowLeft size={16} /> {copy.verifyEmail.back}
      </Link>

      <h1 className="font-display text-2xl font-bold mb-2">{copy.login.forgot}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {copy.common.email}
      </p>

      <ErrorBanner message={error} />

      {sent ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          {copy.verifyEmail.sent}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label={copy.common.email}>
            <TextInput
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 className="animate-spin" size={16} />} {copy.verifyEmail.resend}
          </Button>
        </form>
      )}
    </main>
  );
}
