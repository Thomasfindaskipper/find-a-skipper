import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getRequestCopy, getRequestLocale } from '@/lib/i18n/server';
import { getExtraCopy } from '@/lib/i18n/extra';

export default async function AdminDashboard() {
  const copy = await getRequestCopy();
  const extra = getExtraCopy(await getRequestLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-center">
      <ShieldAlert size={36} className="text-navyDeep mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold mb-2">{copy.nav.dashboard}</h1>
      <p className="text-sm text-gray-500">
        {extra.profile.verificationTitle}
      </p>
      <div className="mt-6">
        <Link href="/dashboard/admin/verifications" className="inline-flex items-center px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold">
          {extra.profile.submitForVerification}
        </Link>
      </div>
    </main>
  );
}
