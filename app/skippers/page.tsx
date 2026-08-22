'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Select, EmptyState, initials } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const CERTIFICATION_FILTERS = ['Permis', 'Yachtmaster', 'Capitaine', 'Brevet'] as const;

function extractTariff(value: string | null) {
  if (!value) return null;
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export default function SkippersDirectoryPage() {
  const [skippers, setSkippers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterZone, setFilterZone] = useState('Toutes');
  const [filterExperience, setFilterExperience] = useState('Toutes');
  const [filterAvailability, setFilterAvailability] = useState('Toutes');
  const [filterCertification, setFilterCertification] = useState('Toutes');
  const [filterTariff, setFilterTariff] = useState('Toutes');
  const [query, setQuery] = useState('');

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

  const filtered = skippers.filter((s) => {
    const matchesZone = filterZone === 'Toutes' || (s.zones || []).includes(filterZone);
    const matchesExperience =
      filterExperience === 'Toutes' ||
      (filterExperience === '0-2' && (s.experience_years ?? 0) <= 2) ||
      (filterExperience === '3-5' && (s.experience_years ?? 0) >= 3 && (s.experience_years ?? 0) <= 5) ||
      (filterExperience === '6+' && (s.experience_years ?? 0) >= 6);
    const matchesAvailability =
      filterAvailability === 'Toutes' ||
      (filterAvailability === 'Disponible' && Boolean(s.availability_note)) ||
      (filterAvailability === 'Non précisée' && !s.availability_note);
    const matchesCertification =
      filterCertification === 'Toutes' ||
      (s.certifications || []).some((cert) => cert.name.toLowerCase().includes(filterCertification.toLowerCase()));
    const tariff = extractTariff(s.hourly_rate);
    const matchesTariff =
      filterTariff === 'Toutes' ||
      (filterTariff === '<200' && tariff !== null && tariff < 200) ||
      (filterTariff === '200-400' && tariff !== null && tariff >= 200 && tariff <= 400) ||
      (filterTariff === '400+' && tariff !== null && tariff > 400);
    const matchesQuery =
      !query.trim() ||
      [s.full_name, s.bio || '', s.availability_note || '', s.permits || '', s.zones.join(' '), s.languages.join(' '), s.boat_types.join(' ')].join(' ').toLowerCase().includes(query.trim().toLowerCase());

    return matchesZone && matchesExperience && matchesAvailability && matchesCertification && matchesTariff && matchesQuery;
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Annuaire des skippers</h1>
      <p className="mb-6 text-gray-500">{skippers.length} skipper{skippers.length !== 1 ? 's' : ''} inscrit{skippers.length !== 1 ? 's' : ''}</p>

      <div className="flex flex-col gap-3 mb-8">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un skipper, une zone, une langue..."
            className="w-full outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3">
        <Select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className="w-auto">
          <option>Toutes</option>{ZONES.map((z) => <option key={z}>{z}</option>)}
        </Select>
        <Select value={filterExperience} onChange={(e) => setFilterExperience(e.target.value)} className="w-auto">
          <option>Toutes</option>
          <option value="0-2">0-2 ans</option>
          <option value="3-5">3-5 ans</option>
          <option value="6+">6 ans et +</option>
        </Select>
        <Select value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value)} className="w-auto">
          <option>Toutes</option>
          <option value="Disponible">Disponible</option>
          <option value="Non précisée">Non précisée</option>
        </Select>
        <Select value={filterCertification} onChange={(e) => setFilterCertification(e.target.value)} className="w-auto">
          <option>Toutes</option>{CERTIFICATION_FILTERS.map((cert) => <option key={cert}>{cert}</option>)}
        </Select>
        <Select value={filterTariff} onChange={(e) => setFilterTariff(e.target.value)} className="w-auto">
          <option>Toutes</option>
          <option value="<200">Moins de 200</option>
          <option value="200-400">200 à 400</option>
          <option value="400+">400 et +</option>
        </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState text="Aucun skipper ne correspond pour l'instant." actionLabel="Créer un compte skipper" actionHref="/signup?role=skipper" />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtered.map((s) => (
            <Link key={s.id} href={`/skippers/${s.id}`} className="rounded-2xl p-5 lift-card bg-white border border-navy/[0.08] block">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3 font-bold bg-navyDeep text-white overflow-hidden">
                {s.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.avatar_url} alt={s.full_name} className="h-full w-full object-cover" />
                ) : (
                  initials(s.full_name)
                )}
              </div>
              <h3 className="font-bold text-[15px] mb-1">{s.full_name}</h3>
              <div className="text-xs mb-2 text-gray-500">{(s.zones || []).join(', ') || 'Zone non précisée'}</div>
              {s.experience_years && <div className="text-xs font-semibold mb-2 text-navy">{s.experience_years} ans d&apos;expérience</div>}
              {s.availability_note && <div className="text-xs mb-2 text-gray-500">{s.availability_note}</div>}
              {s.hourly_rate && <div className="text-xs font-semibold mb-2 text-navy">{s.hourly_rate}</div>}
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
