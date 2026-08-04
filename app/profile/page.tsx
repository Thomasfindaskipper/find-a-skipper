'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

const ZONES = ['Méditerranée', 'Atlantique', 'Manche / Mer du Nord', 'Bretagne', 'Outre-mer'];

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
  const [bio, setBio] = useState('');

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
      setBio(p.bio || '');
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
      .update({ full_name: fullName, phone, zones, bio })
      .eq('id', profile!.id);
    setSaving(false);
    if (updErr) { setError(updErr.message); return; }
    setProfile((p) => (p ? { ...p, full_name: fullName, phone, zones, bio } : p));
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
              {profile.role === 'skipper' && profile.zones?.length > 0 && <Row label="Zones" value={profile.zones.join(', ')} />}
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
          {profile.role === 'skipper' && (
            <>
              <Field label="Zones de navigation">
                <div>{ZONES.map((z) => <Tag key={z} label={z} active={zones.includes(z)} onClick={() => toggleZone(z)} />)}</div>
              </Field>
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
