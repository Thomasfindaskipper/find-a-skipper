'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const BOAT_TYPES = ['Voilier', 'Moteur', 'Catamaran', 'Grande unité (+20m)'];

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[] | undefined) {
  return (value || []).join(', ');
}

function Tag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-medium px-3.5 py-2 rounded-full mr-2 mb-2 border-[1.5px] ${
        active ? 'bg-navy text-white border-navy' : 'bg-white text-anthracite border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

export default function ProfilePage() {
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [boatTypes, setBoatTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [certifications, setCertifications] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [bio, setBio] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email || '');
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const p = data as Profile;
      setProfile(p);
      setFullName(p.full_name);
      setPhone(p.phone || '');
      setZones(p.zones || []);
      setBoatTypes(p.boat_types || []);
      setLanguages(joinList(p.languages));
      setAvatarUrl(p.avatar_url || '');
      setExperienceYears(p.experience_years?.toString() || '');
      setCertifications(joinList((p.certifications || []).map((cert) => cert.name)));
      setHourlyRate(p.hourly_rate || '');
      setAvailabilityNote(p.availability_note || '');
      setBio(p.bio || '');
      setCompanyName(p.company_name || '');
      setFleetSize(p.fleet_size?.toString() || '');
      setCity(p.city || '');
      setLoading(false);
    })();
  }, []);

  function toggleZone(z: string) {
    setZones((prev) => (prev.includes(z) ? prev.filter((v) => v !== z) : [...prev, z]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
        avatar_url: avatarUrl || null,
        zones,
        boat_types: boatTypes,
        languages: splitList(languages),
        experience_years: experienceYears ? Number(experienceYears) : null,
        certifications: splitList(certifications).map((name) => ({ name, verified: false })),
        hourly_rate: hourlyRate || null,
        availability_note: availabilityNote || null,
        company_name: companyName || null,
        fleet_size: fleetSize ? Number(fleetSize) : null,
        city: city || null,
        bio,
      })
      .eq('id', profile!.id);
    setSaving(false);
    if (updErr) { setError(updErr.message); return; }
    setProfile((p) => (p ? {
      ...p,
      full_name: fullName,
      phone,
      avatar_url: avatarUrl || null,
      zones,
      boat_types: boatTypes,
      languages: splitList(languages),
      experience_years: experienceYears ? Number(experienceYears) : null,
      certifications: splitList(certifications).map((name) => ({ name, verified: false })),
      hourly_rate: hourlyRate || null,
      availability_note: availabilityNote || null,
      company_name: companyName || null,
      fleet_size: fleetSize ? Number(fleetSize) : null,
      city: city || null,
      bio,
    } : p));
    setEditing(false);
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;
  if (!profile) return <main className="max-w-md mx-auto px-6 py-10"><p>Connectez-vous pour voir votre profil.</p></main>;

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      {!editing ? (
        <>
          <h1 className="font-display text-2xl font-bold mb-6">Mon profil</h1>
          <div className="rounded-2xl p-6 mb-4 bg-white border border-navy/[0.08]">
            {profile.avatar_url && (
              <div className="mb-4 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.avatar_url} alt={profile.full_name} className="h-14 w-14 rounded-full object-cover border border-navy/[0.08]" />
                <div>
                  <div className="text-sm font-semibold">Photo de profil</div>
                  <div className="text-xs text-gray-500 break-all">{profile.avatar_url}</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-lightblue text-navy">
                {profile.role === 'skipper' ? 'Skipper' : profile.role}
              </span>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm font-semibold text-navy">
                <Pencil size={14} /> Modifier
              </button>
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row label="Nom" value={profile.full_name} />
              <Row label="Email" value={email} />
              {profile.phone && <Row label="Téléphone" value={profile.phone} />}
              {profile.role !== 'skipper' && profile.company_name && <Row label="Société" value={profile.company_name} />}
              {profile.role !== 'skipper' && profile.fleet_size !== null && <Row label="Flotte" value={String(profile.fleet_size)} />}
              {profile.role !== 'skipper' && profile.city && <Row label="Ville" value={profile.city} />}
              {profile.role === 'skipper' && profile.avatar_url && <Row label="Photo" value={profile.avatar_url} />}
              {profile.role === 'skipper' && profile.experience_years !== null && <Row label="Expérience" value={`${profile.experience_years} ans`} />}
              {profile.role === 'skipper' && profile.zones?.length > 0 && <Row label="Zones" value={profile.zones.join(', ')} />}
              {profile.role === 'skipper' && profile.boat_types?.length > 0 && <Row label="Bateaux" value={profile.boat_types.join(', ')} />}
              {profile.role === 'skipper' && profile.languages?.length > 0 && <Row label="Langues" value={profile.languages.join(', ')} />}
              {profile.role === 'skipper' && profile.certifications?.length > 0 && <Row label="Certifications" value={profile.certifications.map((cert) => cert.name).join(', ')} />}
              {profile.role === 'skipper' && profile.hourly_rate && <Row label="Tarif" value={profile.hourly_rate} />}
              {profile.role === 'skipper' && profile.availability_note && <Row label="Disponibilité" value={profile.availability_note} />}
              {profile.role === 'skipper' && profile.bio && <Row label="Bio" value={profile.bio} />}
            </dl>
          </div>
        </>
      ) : (
        <form onSubmit={handleSave}>
          <h1 className="font-display text-2xl font-bold mb-6">Modifier mon profil</h1>
          <ErrorBanner message={error} />
          <Field label="Nom"><TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
          <Field label="Téléphone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Photo de profil (URL)"><TextInput value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." /></Field>
          {profile.role !== 'skipper' && (
            <>
              <Field label="Nom de la société"><TextInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
              <Field label="Nombre de bateaux gérés"><TextInput type="number" min="0" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} /></Field>
              <Field label="Ville"><TextInput value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            </>
          )}
          {profile.role === 'skipper' && (
            <>
              <Field label="Années d'expérience"><TextInput type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} /></Field>
              <Field label="Zones de navigation">
                <div>{ZONES.map((z) => <Tag key={z} label={z} active={zones.includes(z)} onClick={() => toggleZone(z)} />)}</div>
              </Field>
              <Field label="Types de bateaux maîtrisés">
                <div>{BOAT_TYPES.map((b) => <Tag key={b} label={b} active={boatTypes.includes(b)} onClick={() => setBoatTypes((prev) => prev.includes(b) ? prev.filter((value) => value !== b) : [...prev, b])} />)}</div>
              </Field>
              <Field label="Langues"><TextInput value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Français, Anglais" /></Field>
              <Field label="Certifications"><TextInput value={certifications} onChange={(e) => setCertifications(e.target.value)} placeholder="Permis hauturier, Yachtmaster" /></Field>
              <Field label="Tarif"><TextInput value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Ex. 250€/jour" /></Field>
              <Field label="Disponibilité"><TextInput value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} placeholder="Ex. Disponible avril à octobre" /></Field>
              <Field label="Bio courte"><TextArea value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
            </>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1">Enregistrer</Button>
          </div>
        </form>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
