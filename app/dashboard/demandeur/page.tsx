import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Ship, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  broker: 'Broker',
  charter_company: 'Société de charter',
};

export default async function DemandeurDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

if (!profile) {
  redirect('/signup');
}

if (!['owner', 'broker', 'charter_company'].includes(profile.role)) {
  redirect('/dashboard');
}
  

  const { data: missions, count } = await supabase
    .from('missions')
    .select('*', { count: 'exact' })
    .eq('poster_id', user.id)
    .order('posted_at', { ascending: false })
    .limit(5);

  const totalApplicants = (missions ?? []).reduce(
    (sum, m) => sum + (m.applicants_count || 0),
    0
  );

  const isFleetProfile =
    profile.role === 'broker' || profile.role === 'charter_company';

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">
        Bonjour {profile.company_name || profile.full_name?.split(' ')[0]}
      </h1>

      <p className="text-gray-500 mb-8">
        {ROLE_LABEL[profile.role]} — voici votre espace.
      </p>

      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <Link
          href="/missions/new"
          className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card"
        >
          <Plus size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Publier une mission</h3>
          <p className="text-sm text-gray-500">
            Gratuit, en quelques minutes.
          </p>
        </Link>

        <Link
          href="/my-missions"
          className="rounded-2xl p-6 bg-white border border-navy/[0.08] lift-card"
        >
          <Ship size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Mes missions</h3>
          <p className="text-sm text-gray-500">
            {count ?? 0} mission{(count ?? 0) !== 1 ? 's' : ''} publiée
            {(count ?? 0) !== 1 ? 's' : ''}.
          </p>
        </Link>

        <div className="rounded-2xl p-6 bg-white border border-navy/[0.08]">
          <Users size={22} className="text-navyDeep mb-3" />
          <h3 className="font-bold mb-1">Candidatures reçues</h3>
          <p className="text-sm text-gray-500">
            {totalApplicants} au total
          </p>
        </div>
      </div>

      {isFleetProfile && (
        <div className="rounded-2xl p-5 bg-lightblue">
          <p className="text-sm text-navyDeep">
            En tant que {ROLE_LABEL[profile.role].toLowerCase()}, vous gérez
            potentiellement plusieurs bateaux
            {profile.fleet_size
              ? ` (environ ${profile.fleet_size} actuellement)`
              : ''}
            . La gestion de flotte détaillée arrivera dans une prochaine
            version.
          </p>
        </div>
      )}
    </main>
  );
}