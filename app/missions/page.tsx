'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Ship } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Select, Badge, EmptyState } from '@/components/ui';
import type { Mission } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const MISSION_TYPES = ['À la journée', 'À la semaine', 'Saisonnier', 'Convoyage', 'Autre'];

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('Toutes');
  const [filterZone, setFilterZone] = useState('Toutes');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('missions')
      .select('*')
      .eq('status', 'open')
      .order('posted_at', { ascending: false })
      .then(({ data }) => {
        setMissions((data as Mission[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = missions.filter(
    (m) =>
      (filterType === 'Toutes' || m.type === filterType) &&
      (filterZone === 'Toutes' || m.zone === filterZone)
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Missions ouvertes</h1>
      <p className="mb-6 text-gray-500">{filtered.length} mission{filtered.length !== 1 ? 's' : ''} ouverte{filtered.length !== 1 ? 's' : ''}</p>

      <div className="flex flex-wrap gap-3 mb-8">
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-auto">
          <option>Toutes</option>{MISSION_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className="w-auto">
          <option>Toutes</option>{ZONES.map((z) => <option key={z}>{z}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState text="Aucune mission pour l'instant." />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="rounded-2xl overflow-hidden lift-card bg-white border border-navy/[0.08] block">
              <div className="h-28 flex items-center justify-center relative bg-gradient-to-br from-lightblue to-[#cfe0f2]">
                <Ship size={26} className="text-navy/50" />
                <div className="absolute top-3 left-3"><Badge>Ouverte</Badge></div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[15px] mb-1">{m.departure}{m.destination ? ` → ${m.destination}` : ''}</h3>
                <div className="flex items-center gap-1 text-xs mb-3 text-gray-500"><MapPin size={12} /> {m.zone} · {m.boat_type}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-navy">{m.compensation || 'Sur devis'}</span>
                  <span className="text-emerald-700 font-medium text-xs">● {m.applicants_count || 0} candidature{(m.applicants_count || 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
