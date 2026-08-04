'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, Button, ErrorBanner } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function redirectAfterLogin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/dashboard');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const target = profile?.role === 'skipper' ? '/dashboard/skipper' : profile?.role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';
    router.replace(searchParams.get('next') || target);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword(form);
    setLoading(false);
    if (signErr) {
      setError(signErr.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : signErr.message);
      return;
    }
    await redirectAfterLogin();
    router.refresh();
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-2xl font-bold mb-6">Connexion</h1>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <TextInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mot de passe">
          <TextInput type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="mb-4 text-right">
          <Link href="/forgot-password" className="text-sm font-semibold text-navy underline">Mot de passe oublié ?</Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} Se connecter
        </Button>
      </form>
      <p className="text-center text-sm mt-5 text-gray-500">
        Pas encore de compte ? <a href="/signup?role=skipper" className="font-semibold underline text-navy">Créer un compte</a>
      </p>
    </main>
  );
}
