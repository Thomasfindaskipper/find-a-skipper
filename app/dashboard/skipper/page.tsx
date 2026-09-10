import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Ship, Send, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getRequestCopy, getRequestLocale } from '@/lib/i18n/server';
import { getExtraCopy } from '@/lib/i18n/extra';
import type { Profile } from '@/lib/database.types';
import { missingRoleFields, onboardingRequired } from '@/lib/onboarding';

export default async function SkipperDashboard() {
  const copy = await getRequestCopy();
  const extra = getExtraCopy(await getRequestLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = data as Profile;
  if (profile.role !== 'skipper') redirect('/dashboard');
  if (onboardingRequired(profile)) redirect('/onboarding');

  const { count: applicationsCount } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('skipper_id', user.id);

  const missing = missingRoleFields(profile);
  const showOnboarding = onboardingRequired(profile) || missing.length > 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{profile.full_name.split(' ')[0]}</h1>
      <p className="text-gray-500 mb-8">{copy.nav.dashboard}</p>

      {showOnboarding && (
        <div className="rounded-2xl p-5 mb-6 bg-lightblue flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-navyDeep">
            <p className="font-semibold mb-1">{copy.nav.profile}</p>
            <p>{extra.onboarding.completeRequired}</p>
            {missing.length > 0 && (
              <ul className="list-disc pl-5 mt-2">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
            <Link href="/onboarding" className="text-sm font-bold px-4 py-2 rounded-lg bg-navy text-white whitespace-nowrap">{copy.common.save}</Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        <Link href="/missions" className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card">
          <Ship size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">{copy.missions.title}</h3>
          <p className="text-sm text-gray-500">{copy.missions.open}</p>
        </Link>
        <Link href="/my-applications" className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card">
          <Send size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">{copy.nav.myApplications}</h3>
          <p className="text-sm text-gray-500">{applicationsCount ?? 0}</p>
        </Link>
        <Link href="/profile" className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card">
          <ShieldCheck size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">{copy.nav.profile}</h3>
          <p className="text-sm text-gray-500">{profile.identity_verified ? copy.common.yes : copy.common.no}</p>
        </Link>
      </div>
    </main>
  );
}
