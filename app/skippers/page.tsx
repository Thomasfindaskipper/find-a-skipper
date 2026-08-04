'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Select, EmptyState, initials } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];

export default function SkippersDirectoryPage() {
  const [skippers, setSkippers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterZone, setFilterZone] = useState('Toutes');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'skipper')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSkippers((data as Profile[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = skippers.filter((s) => filterZone === 'Toutes' || (s.zones || []).includes(filterZone));

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Annuaire des skippers</h1>
      <p className="mb-6 text-gray-500">{skippers.length} skipper{skippers.length !== 1 ? 's' : ''} inscrit{skippers.length !== 1 ? 's' : ''}</p>

      <div className="flex flex-wrap gap-3 mb-8">
        <Select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className="w-auto">
          <option>Toutes</option>{ZONES.map((z) => <option key={z}>{z}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState text="Aucun skipper ne correspond pour l'instant." actionLabel="Créer un compte skipper" actionHref="/signup?role=skipper" />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtered.map((s) => (
            <Link key={s.id} href={`/skippers/${s.id}`} className="rounded-2xl p-5 lift-card bg-white border border-navy/[0.08] block">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3 font-bold bg-navyDeep text-white">{initials(s.full_name)}</div>
              <h3 className="font-bold text-[15px] mb-1">{s.full_name}</h3>
              <div className="text-xs mb-2 text-gray-500">{(s.zones || []).join(', ') || 'Zone non précisée'}</div>
              {s.experience_years && <div className="text-xs font-semibold mb-2 text-navy">{s.experience_years} ans d&apos;expérience</div>}
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-lightblue text-navy">
                <ShieldCheck size={12} /> {s.identity_verified ? 'Profil vérifié' : 'Profil skipper'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
