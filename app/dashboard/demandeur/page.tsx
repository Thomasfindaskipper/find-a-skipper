import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Ship, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';
import { missingRoleFields, onboardingRequired } from '@/lib/onboarding';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietaire',
  broker: 'Broker',
  charter_company: 'Societe de charter',
};

export default async function DemandeurDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = data as Profile | null;

  if (!profile) {
    redirect('/signup');
  }

  if (!['owner', 'broker', 'charter_company'].includes(profile.role)) {
    redirect('/dashboard');
  }

  if (onboardingRequired(profile)) {
    redirect('/onboarding');
  }

  const { data: missions, count } = await supabase
    .from('missions')
    .select('*', { count: 'exact' })
    .eq('poster_id', user.id)
    .order('posted_at', { ascending: false })
    .limit(5);

  const totalApplicants = (missions ?? []).reduce((sum, m) => sum + (m.applicants_count || 0), 0);
  const missing = missingRoleFields(profile);
  const showOnboarding = missing.length > 0;

  const isFleetProfile = profile.role === 'broker' || profile.role === 'charter_company';

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Bonjour {profile.company_name || profile.full_name?.split(' ')[0]}</h1>

      <p className="text-gray-500 mb-8">{ROLE_LABEL[profile.role]} - voici votre espace.</p>

      {showOnboarding && (
        <div className="rounded-2xl p-5 mb-6 bg-lightblue flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-navyDeep">
            <p className="font-semibold mb-1">Onboarding en cours</p>
            <p>Completez votre profil pour activer pleinement votre espace demandeur.</p>
            <ul className="list-disc pl-5 mt-2">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <Link href="/onboarding" className="text-sm font-bold px-4 py-2 rounded-lg bg-navy text-white whitespace-nowrap">
            Finaliser
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <Link href="/missions/new" className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card">
          <Plus size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Publier une mission</h3>
          <p className="text-sm text-gray-500">Gratuit, en quelques minutes.</p>
        </Link>

        <Link href="/my-missions" className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card">
          <Ship size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Mes missions</h3>
          <p className="text-sm text-gray-500">
            {count ?? 0} mission{(count ?? 0) !== 1 ? 's' : ''} publiee{(count ?? 0) !== 1 ? 's' : ''}.
          </p>
        </Link>

        <div className="rounded-2xl p-6 bg-white border border-navy/[0.08]">
          <Users size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Candidatures recues</h3>
          <p className="text-sm text-gray-500">{totalApplicants} au total</p>
        </div>
      </div>

      {isFleetProfile && (
        <div className="rounded-2xl p-5 bg-lightblue">
          <p className="text-sm text-navyDeep">
            En tant que {ROLE_LABEL[profile.role].toLowerCase()}, vous gerez potentiellement plusieurs bateaux
            {profile.fleet_size ? ` (environ ${profile.fleet_size} actuellement)` : ''}. La gestion de flotte detaillee arrivera dans une
            prochaine version.
          </p>
        </div>
      )}
    </main>
  );
}
