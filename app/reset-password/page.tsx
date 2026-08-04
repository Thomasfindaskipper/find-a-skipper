'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, Button, ErrorBanner } from '@/components/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
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
    const next = searchParams.get('next') || '/dashboard';
    setTimeout(() => router.replace(next), 1500);
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-2xl font-bold mb-2">Nouveau mot de passe</h1>
      <p className="text-sm text-gray-500 mb-6">Choisissez un mot de passe sécurisé pour votre compte.</p>

      <ErrorBanner message={error} />

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          Votre mot de passe a bien été mis à jour. Redirection en cours…
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Nouveau mot de passe">
            <TextInput type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirmer le mot de passe">
            <TextInput type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>

          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 className="animate-spin" size={16} />} Enregistrer le mot de passe
          </Button>
        </form>
      )}
    </main>
  );
}
