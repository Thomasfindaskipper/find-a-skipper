'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, MapPin, Ship } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { formatDateForLocale } from '@/lib/i18n/format';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { localizeBoatType, localizeMissionType, localizeZone } from '@/lib/i18n/options';
import { Select, Badge, EmptyState, Button } from '@/components/ui';
import { NAVIGATION_ZONES, SKIPPER_BOAT_TYPES } from '@/lib/profile-options';
import type { Mission } from '@/lib/database.types';

const MISSION_TYPES = ['À la journée', 'À la semaine', 'Saisonnier', 'Convoyage'];

export default function MissionsPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const allLabel = copy.skippers.all;
  const missionStatusLabel = (status: Mission['status']) => {
    if (status === 'open') return copy.missions.statusOpen;
    if (status === 'assigned') return copy.missions.assigned;
    if (status === 'completed') return copy.missions.completed;
    return copy.missions.cancelled;
  };
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Mission['status']>('open');
  const [filterType, setFilterType] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBoatType, setFilterBoatType] = useState('all');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('missions')
          .select('*')
          .order('posted_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setMissions((data as Mission[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadMissions);
      } finally {
        setLoading(false);
      }
    })();
  }, [extra.errors.loadMissions]);

  const filtered = missions.filter((m) => {
    const matchesQuery =
      !query.trim() ||
      [m.departure, m.destination || '', m.zone, m.boat_type, m.type, m.compensation || '', m.duration || '']
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchesType = filterType === 'all' || m.type === filterType;
    const matchesZone = filterZone === 'all' || m.zone === filterZone;
    const matchesBoatType = filterBoatType === 'all' || m.boat_type === filterBoatType;

    return matchesQuery && matchesStatus && matchesType && matchesZone && matchesBoatType;
  });

  const hasActiveFilters =
    query.trim().length > 0 ||
    filterStatus !== 'open' ||
    filterType !== 'all' ||
    filterZone !== 'all' ||
    filterBoatType !== 'all';

  function resetFilters() {
    setQuery('');
    setFilterStatus('open');
    setFilterType('all');
    setFilterZone('all');
    setFilterBoatType('all');
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{copy.missions.title}</h1>
      <p className="mb-6 text-gray-500">
        {filtered.length}
        {filtered.length !== missions.length ? ` / ${missions.length}` : ''}
      </p>

      <div className="flex flex-col gap-3 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.missions.queryPlaceholder}
          className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-[14.5px] outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label={copy.missions.status}>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | Mission['status'])}>
              <option value="open">{copy.missions.open}</option>
              <option value="all">{copy.missions.allStatuses}</option>
              <option value="assigned">{copy.missions.assigned}</option>
              <option value="completed">{copy.missions.completed}</option>
              <option value="cancelled">{copy.missions.cancelled}</option>
            </Select>
          </FilterField>
          <FilterField label={copy.missions.type}>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">{allLabel}</option>
              {MISSION_TYPES.map((t) => <option key={t} value={t}>{localizeMissionType(t, locale)}</option>)}
            </Select>
          </FilterField>
          <FilterField label={copy.missions.zone}>
            <Select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
              <option value="all">{allLabel}</option>
              {NAVIGATION_ZONES.map((z) => <option key={z} value={z}>{localizeZone(z, locale)}</option>)}
            </Select>
          </FilterField>
          <FilterField label={copy.missions.boat}>
            <Select value={filterBoatType} onChange={(e) => setFilterBoatType(e.target.value)}>
              <option value="all">{allLabel}</option>
              {SKIPPER_BOAT_TYPES.map((boatType) => <option key={boatType} value={boatType}>{localizeBoatType(boatType, locale)}</option>)}
            </Select>
          </FilterField>
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" className="self-start px-3 py-2 text-sm" onClick={resetFilters}>
            {copy.common.resetFilters}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>
      ) : error ? (
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState text={copy.missions.noResult} />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="rounded-2xl overflow-hidden lift-card bg-white border border-navy/[0.08] block">
              <div className="h-20 flex items-center justify-center relative bg-gradient-to-br from-lightblue to-[#cfe0f2]">
                <Ship size={26} className="text-navy/50" />
                <div className="absolute top-3 left-3"><Badge>{missionStatusLabel(m.status)}</Badge></div>
                <div className="absolute top-3 right-3"><Badge>{localizeMissionType(m.type, locale)}</Badge></div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[15px] mb-1">{m.departure}{m.destination ? ` → ${m.destination}` : ''}</h3>
                <div className="flex items-center gap-1 text-xs mb-1 text-gray-500"><CalendarDays size={12} /> {formatDateForLocale(m.start_date, locale)}{m.duration ? ` · ${m.duration}` : ''}</div>
                <div className="flex items-center gap-1 text-xs mb-1 text-gray-500"><MapPin size={12} /> {localizeZone(m.zone, locale)}</div>
                <div className="flex items-center gap-1 text-xs mb-3 text-gray-500"><Ship size={12} /> {localizeBoatType(m.boat_type, locale)}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-navy">{m.compensation || copy.missions.quote}</span>
                  <span className="text-xs font-semibold text-gray-500">{missionStatusLabel(m.status)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="rounded-2xl border border-navy/[0.08] bg-white p-3">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}
