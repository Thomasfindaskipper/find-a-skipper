'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Anchor, Briefcase, Building2, Ship as ShipIcon, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner } from '@/components/ui';
import type { Role } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];
const BOAT_TYPES = ['Voilier', 'Moteur', 'Catamaran', 'Grande unité (+20m)'];

const ROLE_OPTIONS: { value: Role; label: string; icon: typeof Anchor }[] = [
  { value: 'skipper', label: 'Skipper', icon: Anchor },
  { value: 'owner', label: 'Propriétaire', icon: Briefcase },
  { value: 'broker', label: 'Broker', icon: Building2 },
  { value: 'charter_company', label: 'Société de charter', icon: ShipIcon },
];

function Tag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-medium px-3.5 py-2 rounded-full mr-2 mb-2 border-[1.5px] transition ${
        active ? 'bg-navy text-white border-navy' : 'bg-white text-anthracite border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get('role') as Role) || 'skipper';

  const [role, setRole] = useState<Role>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  // skipper fields
  const [experienceYears, setExperienceYears] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [boatTypes, setBoatTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState('');
  const [permits, setPermits] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [bio, setBio] = useState('');
  // demandeur fields
  const [companyName, setCompanyName] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [city, setCity] = useState('');

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName || !email || !password) {
      setError("Merci de remplir au minimum le nom, l'email et le mot de passe.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          role,
          full_name: fullName,
          phone,
          company_name: role === 'broker' || role === 'charter_company' ? companyName : null,
          fleet_size: role === 'broker' || role === 'charter_company' ? fleetSize : null,
          city: role === 'owner' ? city : null,
          experience_years: role === 'skipper' ? experienceYears : null,
          zones: role === 'skipper' ? zones : [],
          boat_types: role === 'skipper' ? boatTypes : [],
          languages: role === 'skipper' ? languages.split(',').map((item) => item.trim()).filter(Boolean) : [],
          permits: role === 'skipper' ? permits : null,
          avatar_url: role === 'skipper' ? avatarUrl : null,
          hourly_rate: role === 'skipper' ? hourlyRate : null,
          availability_note: role === 'skipper' ? availabilityNote : null,
          bio: role === 'skipper' ? bio : null,
        },
      },
    });
    setLoading(false);
    if (signErr) { setError(signErr.message); return; }
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="text-center py-10">
        <h1 className="font-display text-2xl font-bold mb-2">Confirmez votre email</h1>
        <p className="text-sm text-gray-500">
          Un email de confirmation vous a été envoyé. Cliquez sur le lien qu&apos;il contient, puis connectez-vous.
        </p>
      </div>
    );
  }

  const isDemandeur = role !== 'skipper';

  return (
    <>
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-2 mb-6">
        {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            className={`flex items-center gap-2 p-3 rounded-xl justify-center text-sm font-semibold border-[1.5px] ${
              role === value ? 'bg-navy text-white border-navy' : 'bg-white text-anthracite border-gray-200'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <Field label={role === 'skipper' ? 'Nom complet' : 'Nom du contact'}>
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        {(role === 'broker' || role === 'charter_company') && (
          <>
            <Field label="Nom de la société">
              <TextInput required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <Field label="Nombre de bateaux gérés (approximatif)">
              <TextInput type="number" min="0" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} />
            </Field>
          </>
        )}
        {role === 'owner' && (
          <Field label="Ville">
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Marseille" />
          </Field>
        )}

        <Field label="Email">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe" hint="6 caractères minimum">
          <TextInput type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>

        {role === 'skipper' && (
          <>
            <Field label="Années d'expérience">
              <TextInput type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
            </Field>
            <Field label="Zones de navigation">
              <div>{ZONES.map((z) => <Tag key={z} label={z} active={zones.includes(z)} onClick={() => toggle(zones, setZones, z)} />)}</div>
            </Field>
            <Field label="Types de bateaux maîtrisés">
              <div>{BOAT_TYPES.map((b) => <Tag key={b} label={b} active={boatTypes.includes(b)} onClick={() => toggle(boatTypes, setBoatTypes, b)} />)}</div>
            </Field>
            <Field label="Permis / brevets">
              <TextInput value={permits} onChange={(e) => setPermits(e.target.value)} />
            </Field>
            <Field label="Langues">
              <TextInput value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Français, Anglais" />
            </Field>
            <Field label="Photo de profil (URL)">
              <TextInput value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Tarif">
              <TextInput value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Ex. 250€/jour" />
            </Field>
            <Field label="Disponibilité">
              <TextInput value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} placeholder="Ex. Disponible avril à octobre" />
            </Field>
            <Field label="Bio courte">
              <TextArea value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
          </>
        )}

        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} Créer mon compte
        </Button>
      </form>
      {isDemandeur && (
        <p className="text-xs text-center mt-3 text-gray-500">
          Propriétaire, broker ou société de charter : le tableau de bord s&apos;adapte à votre profil (gestion d&apos;une flotte pour les professionnels).
        </p>
      )}
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-2xl font-bold mb-6">Créer un compte</h1>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
