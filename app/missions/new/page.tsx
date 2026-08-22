'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Select, Button, ErrorBanner } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const BOAT_TYPES = ['Voilier', 'Moteur', 'Catamaran', 'Grande unité (+20m)'];
const MISSION_TYPES = ['À la journée', 'À la semaine', 'Saisonnier', 'Convoyage', 'Autre'];

export default function NewMissionPage() {
  const router = useRouter();
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

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
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
    if (!departure || !startDate) { setError("Merci d'indiquer au minimum le lieu et la date."); return; }
    setLoading(true);
    const supabase = createClient();
    const { data: mission, error: insErr } = await supabase
      .from('missions')
      .insert({
        poster_id: profile!.id,
        type,
        boat_type: boatType,
        zone,
        departure,
        destination: destination || null,
        start_date: startDate,
        duration: duration || null,
        compensation: compensation || null,
        requirements: requirements || null,
        description: description || null,
      })
      .select()
      .single();
    setLoading(false);
    if (insErr) { setError(insErr.message); return; }
    router.push(`/missions/${mission.id}?created=1`);
  }

  if (checking) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-display text-2xl font-bold mb-1">Publier une mission</h1>
      <p className="text-sm mb-6 text-gray-500">Gratuit. Les skippers disponibles pourront postuler directement.</p>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label="Type de mission">
          <Select value={type} onChange={(e) => setType(e.target.value)}>{MISSION_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Type de bateau">
          <Select value={boatType} onChange={(e) => setBoatType(e.target.value)}>{BOAT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Zone de navigation">
          <Select value={zone} onChange={(e) => setZone(e.target.value)}>{ZONES.map((z) => <option key={z}>{z}</option>)}</Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lieu de départ"><TextInput required value={departure} onChange={(e) => setDeparture(e.target.value)} /></Field>
          <Field label="Destination (si convoyage)"><TextInput value={destination} onChange={(e) => setDestination(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début"><TextInput type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="Durée"><TextInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ex. 1 jour" /></Field>
        </div>
        <Field label="Rémunération" hint="Laissez vide si sur devis">
          <TextInput value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="Ex. 220 €" />
        </Field>
        <Field label="Exigences particulières">
          <TextArea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Permis, expérience, langues, disponibilités..." />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} Publier la mission
        </Button>
      </form>
    </main>
  );
}
