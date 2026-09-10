'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { localizeBoatType, localizeZone } from '@/lib/i18n/options';
import { formatAvailabilitySummary, indicativeRateLabel, normalizeProfileCertifications, topCertifications } from '@/lib/profile';
import { resolveAvatarUrl } from '@/lib/media';
import { LANGUAGE_OPTIONS, NAVIGATION_ZONES, RATE_FILTER_OPTIONS, SKIPPER_BOAT_TYPES } from '@/lib/profile-options';
import { Select, EmptyState, initials, Button } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

function extractTariff(value: string | null) {
  if (!value) return null;
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function rateLabel(min: number | null, max: number | null) {
  if (min === null && max !== null) return `< ${max}`;
  if (min !== null && max !== null) return `${min} - ${max}`;
  if (min !== null) return `${min}+`;
  return '';
}

const EXPERIENCE_FILTER_OPTIONS: Array<{ value: string; min: number; max: number | null }> = [
  { value: '0-2', min: 0, max: 2 },
  { value: '3-5', min: 3, max: 5 },
  { value: '6+', min: 6, max: null },
];

function experienceLabel(min: number, max: number | null) {
  if (max === null) return `${min}+`;
  return `${min}-${max}`;
}

export default function SkippersDirectoryPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const allLabel = copy.skippers.all;
  const [skippers, setSkippers] = useState<Profile[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [reputationBySkipper, setReputationBySkipper] = useState<Record<string, { average: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterExperience, setFilterExperience] = useState('all');
  const [filterAvailability, setFilterAvailability] = useState('all');
  const [filterTariff, setFilterTariff] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [filterBoatType, setFilterBoatType] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*, availability_slots(*)')
          .eq('role', 'skipper')
          .order('created_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          setSkippers([]);
          return;
        }

        setSkippers((data as Profile[]) || []);
        const skipperIds = ((data as Profile[]) || []).map((profile) => profile.id);

        if (skipperIds.length > 0) {
          const { data: reviewRows } = await supabase
            .from('reviews')
            .select('reviewee_id, rating')
            .in('reviewee_id', skipperIds);

          const stats = ((reviewRows as Array<{ reviewee_id: string; rating: number }>) || []).reduce<Record<string, { total: number; count: number }>>((accumulator, row) => {
            const current = accumulator[row.reviewee_id] || { total: 0, count: 0 };
            current.total += row.rating;
            current.count += 1;
            accumulator[row.reviewee_id] = current;
            return accumulator;
          }, {});

          const reputation = Object.entries(stats).reduce<Record<string, { average: number; count: number }>>((accumulator, [skipperId, value]) => {
            accumulator[skipperId] = { average: value.total / value.count, count: value.count };
            return accumulator;
          }, {});

          setReputationBySkipper(reputation);
        } else {
          setReputationBySkipper({});
        }

        const resolvedEntries = await Promise.all(
          ((data as Profile[]) || []).map(async (profile) => [profile.id, await resolveAvatarUrl(supabase, profile.avatar_url)] as const)
        );
        setAvatarUrls(Object.fromEntries(resolvedEntries));
      } catch (err) {
        setSkippers([]);
        setError(err instanceof Error ? err.message : extra.errors.loadSkippers);
      } finally {
        setLoading(false);
      }
    })();
  }, [extra.errors.loadSkippers]);

  const filtered = skippers.filter((s) => {
    const matchesZone = filterZone === 'all' || (s.zones || []).includes(filterZone);
    const matchesExperience =
      filterExperience === 'all' ||
      (filterExperience === '0-2' && (s.experience_years ?? 0) <= 2) ||
      (filterExperience === '3-5' && (s.experience_years ?? 0) >= 3 && (s.experience_years ?? 0) <= 5) ||
      (filterExperience === '6+' && (s.experience_years ?? 0) >= 6);
    const matchesAvailability =
      filterAvailability === 'all' ||
      (filterAvailability === 'Disponible' && Boolean((s.availability_slots || []).length || s.availability_note)) ||
      (filterAvailability === 'Non précisée' && !(s.availability_slots || []).length && !s.availability_note);
    const matchesLanguage = filterLanguage === 'all' || (s.languages || []).includes(filterLanguage);
    const matchesBoatType = filterBoatType === 'all' || (s.boat_types || []).includes(filterBoatType);
    const tariff = extractTariff(s.hourly_rate);
    const matchesTariff =
      filterTariff === 'all' ||
      (filterTariff === '<200' && tariff !== null && tariff < 200) ||
      (filterTariff === '200-400' && tariff !== null && tariff >= 200 && tariff <= 400) ||
      (filterTariff === '400+' && tariff !== null && tariff > 400);
    const matchesQuery =
      !query.trim() ||
      [
        s.full_name,
        s.city || '',
        s.availability_note || '',
        s.zones.join(' '),
        s.languages.join(' '),
        s.boat_types.join(' '),
        normalizeProfileCertifications(s.certifications).map((cert) => cert.name).join(' '),
      ].join(' ').toLowerCase().includes(query.trim().toLowerCase());

    return matchesZone && matchesExperience && matchesAvailability && matchesLanguage && matchesBoatType && matchesTariff && matchesQuery;
  });

  const hasActiveFilters =
    filterZone !== 'all' ||
    filterExperience !== 'all' ||
    filterAvailability !== 'all' ||
    filterTariff !== 'all' ||
    filterLanguage !== 'all' ||
    filterBoatType !== 'all' ||
    query.trim().length > 0;

  function resetFilters() {
    setFilterZone('all');
    setFilterExperience('all');
    setFilterAvailability('all');
    setFilterTariff('all');
    setFilterLanguage('all');
    setFilterBoatType('all');
    setQuery('');
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{copy.skippers.title}</h1>
      <p className="mb-6 text-gray-500">
        {filtered.length}
        {filtered.length !== skippers.length ? ` / ${skippers.length}` : ''}
      </p>

      <div className="flex flex-col gap-3 mb-8">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.skippers.queryPlaceholder}
            className="w-full outline-none text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <FilterField label={copy.skippers.zone}>
            <Select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
              <option value="all">{allLabel}</option>{NAVIGATION_ZONES.map((z) => <option key={z} value={z}>{localizeZone(z, locale)}</option>)}
            </Select>
          </FilterField>
          <FilterField label={copy.skippers.experience}>
            <Select value={filterExperience} onChange={(e) => setFilterExperience(e.target.value)}>
              <option value="all">{allLabel}</option>
              {EXPERIENCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{experienceLabel(option.min, option.max)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={copy.skippers.availability}>
            <Select value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value)}>
              <option value="all">{allLabel}</option>
              <option value="Disponible">{copy.skippers.available}</option>
              <option value="Non précisée">{copy.skippers.availabilityUnknown}</option>
            </Select>
          </FilterField>
          <FilterField label={copy.skippers.language}>
            <Select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)}>
              <option value="all">{allLabel}</option>{LANGUAGE_OPTIONS.map((language) => <option key={language}>{language}</option>)}
            </Select>
          </FilterField>
          <FilterField label={copy.skippers.boatType}>
            <Select value={filterBoatType} onChange={(e) => setFilterBoatType(e.target.value)}>
              <option value="all">{allLabel}</option>{SKIPPER_BOAT_TYPES.map((boatType) => <option key={boatType} value={boatType}>{localizeBoatType(boatType, locale)}</option>)}
            </Select>
          </FilterField>
          <FilterField label={copy.skippers.rate}>
            <Select value={filterTariff} onChange={(e) => setFilterTariff(e.target.value)}>
              <option value="all">{allLabel}</option>
              {RATE_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{rateLabel(option.min, option.max)}</option>)}
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
        <EmptyState text={copy.skippers.noResult} actionLabel={copy.skippers.createSkipper} actionHref="/signup?role=skipper" />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtered.map((s) => (
            <Link key={s.id} href={`/skippers/${s.id}`} className="rounded-2xl p-5 lift-card bg-white border border-navy/[0.08] block">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 font-bold bg-navyDeep text-white overflow-hidden">
                {avatarUrls[s.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrls[s.id] || ''} alt={s.full_name} className="h-full w-full object-cover" />
                ) : (
                  initials(s.full_name)
                )}
              </div>
              <h3 className="font-bold text-[15px] mb-1">{s.full_name}</h3>
              <div className="text-xs mb-2 text-gray-500">{s.city || (s.zones || [])[0] || copy.skippers.locationMissing}</div>
              <div className="text-xs font-semibold mb-2 text-navy">
                {s.experience_years === null || s.experience_years === undefined
                  ? copy.skippers.experienceUnknown
                  : s.experience_years <= 1
                    ? copy.skippers.oneYear
                    : `${s.experience_years} ${copy.skippers.manyYears}`}
              </div>

              {topCertifications(normalizeProfileCertifications(s.certifications)).length > 0 && (
                <div className="text-xs mb-2 text-gray-600">{topCertifications(normalizeProfileCertifications(s.certifications)).slice(0, 2).join(' • ')}</div>
              )}

              {(s.availability_slots?.length || s.availability_note) ? (
                <div className="text-xs mb-2 text-gray-500">{s.availability_slots?.length ? formatAvailabilitySummary(s.availability_slots) : s.availability_note}</div>
              ) : (
                <div className="text-xs mb-2 text-gray-400">{copy.skippers.availabilityUnknown}</div>
              )}

              {s.languages?.length > 0 && <div className="text-xs mb-2 text-gray-500">{s.languages.slice(0, 3).join(', ')}</div>}
              <div className="text-xs font-semibold text-navy">{s.hourly_rate ? indicativeRateLabel(s.hourly_rate) : copy.skippers.rateMissing}</div>
              {reputationBySkipper[s.id] && (
                <div className="text-xs text-gray-600 mt-2">
                  ★ {reputationBySkipper[s.id].average.toFixed(1)} ({reputationBySkipper[s.id].count} avis)
                </div>
              )}
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
