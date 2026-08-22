'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Badge, EmptyState } from '@/components/ui';
import type { Mission } from '@/lib/database.types';

function missionStatusLabel(status: Mission['status']) {
  if (status === 'open') return 'Ouverte';
  if (status === 'assigned') return 'Assignée';
  if (status === 'completed') return 'Terminée';
  return 'Annulée';
}

export default function MyMissionsPage() {
  const [missions, setMissions] = useState<Mission[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('missions')
        .select('*')
        .eq('poster_id', user.id)
        .order('posted_at', { ascending: false });
      setMissions((data as Mission[]) || []);
    })();
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Mes missions publiées</h1>
      <p className="mb-8 text-gray-500">Sélectionnez une mission pour voir les candidatures reçues.</p>

      {missions === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : missions.length === 0 ? (
        <EmptyState text="Vous n'avez pas encore publié de mission." actionLabel="Publier une mission" actionHref="/missions/new" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {missions.map((m) => (
            <Link key={m.id} href={`/my-missions/${m.id}`} className="rounded-2xl p-5 lift-card bg-white border border-navy/[0.08] block">
              <div className="mb-2"><Badge>{m.type}</Badge></div>
              <h3 className="font-bold text-[15px] mb-1">{m.departure}{m.destination ? ` → ${m.destination}` : ''}</h3>
              <div className="text-xs mb-3 text-gray-500">{m.zone} · {m.boat_type}</div>
              <div className="text-xs mb-3 text-gray-500">Statut: {missionStatusLabel(m.status)}</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                <Users size={15} /> {m.applicants_count || 0} candidature{(m.applicants_count || 0) !== 1 ? 's' : ''}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
