'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Badge, EmptyState } from '@/components/ui';
import type { Mission } from '@/lib/database.types';

export default function MyMissionsPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const missionStatusLabel = (status: Mission['status']) => {
    if (status === 'open') return copy.missions.statusOpen;
    if (status === 'assigned') return copy.missions.assigned;
    if (status === 'completed') return copy.missions.completed;
    return copy.missions.cancelled;
  };
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMissions([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('missions')
          .select('*')
          .eq('poster_id', user.id)
          .order('posted_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          setMissions([]);
          return;
        }

        setMissions((data as Mission[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadMyMissions);
        setMissions([]);
      }
    })();
  }, [extra.errors.loadMyMissions]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{copy.nav.myMissions}</h1>
      <p className="mb-8 text-gray-500">{copy.missions.title}</p>

      {missions === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>
      ) : error ? (
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">
          {error}
        </div>
      ) : missions.length === 0 ? (
        <EmptyState text={copy.missions.noResult} actionLabel={copy.nav.publishMission} actionHref="/missions/new" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {missions.map((m) => (
            <Link key={m.id} href={`/my-missions/${m.id}`} className="rounded-2xl p-5 lift-card bg-white border border-navy/[0.08] block">
              <div className="mb-2"><Badge>{m.type}</Badge></div>
              <h3 className="font-bold text-[15px] mb-1">{m.departure}{m.destination ? ` → ${m.destination}` : ''}</h3>
              <div className="text-xs mb-3 text-gray-500">{m.zone} · {m.boat_type}</div>
              <div className="text-xs mb-3 text-gray-500">{copy.missions.status}: {missionStatusLabel(m.status)}</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                <Users size={15} /> {m.applicants_count || 0} {copy.nav.myApplications.toLowerCase()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
