'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useLocale } from '@/components/LocaleProvider';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';

export default function AccountPage() {
  const router = useRouter();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const CONFIRMATION_TEXT = locale === 'fr' ? 'SUPPRIMER MON COMPTE' : 'DELETE MY ACCOUNT';
  const [confirmationInput, setConfirmationInput] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canSubmit = useMemo(
    () => confirmationInput.trim().toUpperCase() === CONFIRMATION_TEXT,
    [confirmationInput, CONFIRMATION_TEXT]
  );

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!canSubmit) {
      setError(extra.account.confirmPhraseMismatch);
      return;
    }

    setSubmitting(true);

    const response = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || null }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

    if (!response.ok || !payload.success) {
      setSubmitting(false);
      setError(payload.error || extra.account.unableDelete);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    setSubmitting(false);
    setSuccess(extra.account.deletedRedirecting);
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-6 flex justify-center"><BrandLogo /></div>
      <h1 className="font-display text-3xl font-bold text-navy mb-3 text-center">{copy.account.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {copy.account.description}
      </p>

      <section className="rounded-2xl border border-red-200 bg-red-50/60 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold text-red-700">{copy.account.warning}</h2>
            <p className="text-sm text-red-700/90 mt-1">
              {copy.account.warningBody}
            </p>
          </div>
        </div>

        <ErrorBanner message={error} />
        {success && <p className="text-sm text-emerald-700 mb-4">{success}</p>}

        <form onSubmit={handleDeleteAccount} className="space-y-3">
          <Field label={copy.account.confirmationLabel} hint={`${copy.account.confirmationHint} ${CONFIRMATION_TEXT}`}>
            <TextInput
              value={confirmationInput}
              onChange={(event) => setConfirmationInput(event.target.value)}
              placeholder={CONFIRMATION_TEXT}
              autoComplete="off"
            />
          </Field>

          <Field label={copy.account.reasonLabel} hint={copy.account.reasonHint}>
            <TextInput
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={250}
            />
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={submitting || !canSubmit} className="bg-red-600 hover:bg-red-700 sm:flex-1">
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> {copy.account.deleting}
                </span>
              ) : (
                copy.account.delete
              )}
            </Button>
            <Link href="/profile" className="inline-flex items-center justify-center rounded-xl border-2 border-navyDeep px-5 py-3 text-[15px] font-bold text-navyDeep sm:flex-1">
              {copy.account.back}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
