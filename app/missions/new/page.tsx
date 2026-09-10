'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import { buildVerifyEmailPath, isEmailVerified } from '@/lib/auth';
import { getExtraCopy } from '@/lib/i18n/extra';
import { localizeBoatType, localizeMissionType, localizeZone } from '@/lib/i18n/options';
import { Field, TextInput, TextArea, Select, Button, ErrorBanner } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const BOAT_TYPES = ['Voilier', 'Moteur', 'Catamaran', 'Grande unité (+20m)'];
const MISSION_TYPES = ['À la journée', 'À la semaine', 'Saisonnier', 'Convoyage', 'Autre'];

export default function NewMissionPage() {
  const router = useRouter();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState(MISSION_TYPES[0]);
  const [boatType, setBoatType] = useState(BOAT_TYPES[0]);
  const [zone, setZone] = useState(ZONES[0]);
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [compensation, setCompensation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [description, setDescription] = useState('');

  function missionPayload(includeRequirements: boolean) {
    const baseDescription = description.trim();
    const req = requirements.trim();
    const generatedTitle = `${type} - ${departure.trim()}${destination.trim() ? ` vers ${destination.trim()}` : ''}`;
    const fallbackDescription =
      !includeRequirements && req
        ? `${baseDescription ? `${baseDescription}\n\n` : ''}Exigences: ${req}`
        : baseDescription;

    return {
      poster_id: profile!.id,
      title: generatedTitle,
      type,
      boat_type: boatType,
      zone,
      departure,
      destination: destination || null,
      start_date: startDate,
      duration: duration || null,
      compensation: compensation || null,
      ...(includeRequirements ? { requirements: req || null } : {}),
      description: fallbackDescription || null,
    };
  }

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      if (!isEmailVerified(user)) {
        router.replace(buildVerifyEmailPath(user.email || null, '/missions/new'));
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!data || !['owner', 'broker', 'charter_company'].includes(data.role)) {
        router.push('/dashboard');
        return;
      }
      setProfile(data as Profile);
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!departure || !startDate) { setError(extra.missionsNew.minFields); return; }
    setLoading(true);
    const supabase = createClient();

    let { data: mission, error: insErr } = await supabase
      .from('missions')
      .insert(missionPayload(true))
      .select()
      .single();

    if (insErr && /Could not find the 'requirements' column/i.test(insErr.message)) {
      ({ data: mission, error: insErr } = await supabase
        .from('missions')
        .insert(missionPayload(false))
        .select()
        .single());
    }

    setLoading(false);
    if (insErr) { setError(insErr.message); return; }
    router.push(`/missions/${mission.id}?created=1`);
  }

  if (checking) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-display text-2xl font-bold mb-1">{copy.nav.publishMission}</h1>
      <p className="text-sm mb-6 text-gray-500">{copy.missions.open}</p>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label={copy.missions.type}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>{MISSION_TYPES.map((t) => <option key={t}>{localizeMissionType(t, locale)}</option>)}</Select>
        </Field>
        <Field label={copy.missions.boat}>
          <Select value={boatType} onChange={(e) => setBoatType(e.target.value)}>{BOAT_TYPES.map((t) => <option key={t}>{localizeBoatType(t, locale)}</option>)}</Select>
        </Field>
        <Field label={copy.missions.zone}>
          <Select value={zone} onChange={(e) => setZone(e.target.value)}>{ZONES.map((z) => <option key={z}>{localizeZone(z, locale)}</option>)}</Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={extra.missionsNew.departure}><TextInput required value={departure} onChange={(e) => setDeparture(e.target.value)} /></Field>
          <Field label={extra.missionsNew.destination}><TextInput value={destination} onChange={(e) => setDestination(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={extra.missionsNew.startDate}><TextInput type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label={extra.missionsNew.duration}><TextInput value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
        </div>
        <Field label={extra.missionsNew.compensation} hint={copy.missions.quote}>
          <TextInput value={compensation} onChange={(e) => setCompensation(e.target.value)} />
        </Field>
        <Field label={extra.missionsNew.requirements}>
          <TextArea value={requirements} onChange={(e) => setRequirements(e.target.value)} />
        </Field>
        <Field label={extra.missionsNew.description}>
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} {copy.nav.publishMission}
        </Button>
      </form>
    </main>
  );
}
