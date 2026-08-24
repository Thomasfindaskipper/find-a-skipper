'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner } from '@/components/ui';
import type { Profile, VerificationDocument, VerificationDocType, VerificationRequest } from '@/lib/database.types';

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
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [docType, setDocType] = useState<VerificationDocType>('identity');
  const [docFile, setDocFile] = useState<File | null>(null);

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

      const { data: reqData } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentRequest = (reqData as VerificationRequest | null) || null;
      setRequest(currentRequest);

      if (currentRequest) {
        const { data: docsData } = await supabase
          .from('verification_documents')
          .select('*')
          .eq('request_id', currentRequest.id)
          .order('created_at', { ascending: false });
        setDocuments((docsData as VerificationDocument[]) || []);
      }

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

  async function ensureRequest() {
    if (!profile) return null;
    if (request) return request;

    const supabase = createClient();
    const { data, error: reqErr } = await supabase
      .from('verification_requests')
      .insert({ user_id: profile.id, status: 'draft' })
      .select('*')
      .single();

    if (reqErr) {
      setError(reqErr.message);
      return null;
    }

    const created = data as VerificationRequest;
    setRequest(created);
    return created;
  }

  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setVerificationMessage('');

    if (!profile || !docFile) {
      setError('Merci de choisir un justificatif.');
      return;
    }

    const req = await ensureRequest();
    if (!req) return;

    setUploading(true);
    const supabase = createClient();
    const safeName = `${Date.now()}-${docFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${profile.id}/${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('verification-documents')
      .upload(storagePath, docFile, { upsert: false });

    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }

    const { data: docData, error: docErr } = await supabase
      .from('verification_documents')
      .insert({
        request_id: req.id,
        user_id: profile.id,
        doc_type: docType,
        storage_path: storagePath,
        original_filename: docFile.name,
        mime_type: docFile.type || null,
      })
      .select('*')
      .single();

    setUploading(false);

    if (docErr) {
      setError(docErr.message);
      return;
    }

    setDocuments((prev) => [docData as VerificationDocument, ...prev]);
    setDocFile(null);
    setVerificationMessage('Justificatif depose avec succes.');
  }

  async function submitVerificationRequest() {
    setError('');
    setVerificationMessage('');

    if (!request) {
      setError('Ajoutez au moins un justificatif avant de soumettre.');
      return;
    }

    if (documents.length === 0) {
      setError('Ajoutez au moins un justificatif avant de soumettre.');
      return;
    }

    setSubmittingVerification(true);
    const supabase = createClient();
    const { data, error: updErr } = await supabase
      .from('verification_requests')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), rejection_reason: null })
      .eq('id', request.id)
      .select('*')
      .single();

    setSubmittingVerification(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    setRequest(data as VerificationRequest);
    setVerificationMessage('Demande envoyee. Un admin va la traiter.');
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
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${profile.identity_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {profile.identity_verified ? 'Verifie' : 'Non verifie'}
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

      <section className="rounded-2xl p-6 bg-white border border-navy/[0.08]">
        <h2 className="font-semibold mb-2">Verification du profil</h2>
        {verificationMessage && <p className="text-sm text-emerald-700 mb-2">{verificationMessage}</p>}
        {request?.status === 'rejected' && request.rejection_reason && (
          <p className="text-sm text-red-700 mb-2">Dernier refus: {request.rejection_reason}</p>
        )}
        <p className="text-sm text-gray-500 mb-4">
          Statut actuel: {request ? request.status : 'draft'}
        </p>

        <form onSubmit={handleUploadDocument} className="space-y-3">
          <Field label="Type de justificatif">
            <select value={docType} onChange={(e) => setDocType(e.target.value as VerificationDocType)} className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-sm bg-white">
              <option value="identity">Piece d&apos;identite</option>
              <option value="license">Permis / licence</option>
              <option value="certificate">Certification</option>
              <option value="company">Justificatif societe</option>
              <option value="ownership">Justificatif proprietaire</option>
              <option value="mandate">Mandat broker</option>
              <option value="other">Autre</option>
            </select>
          </Field>

          <Field label="Fichier">
            <input
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={uploading || request?.status === 'approved'}>
              {uploading ? 'Depot...' : 'Deposer le justificatif'}
            </Button>
            <Button type="button" variant="outline" disabled={submittingVerification || documents.length === 0 || request?.status === 'approved'} onClick={submitVerificationRequest}>
              {submittingVerification ? 'Envoi...' : 'Soumettre a verification'}
            </Button>
          </div>
        </form>

        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Justificatifs deposes</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun justificatif depose.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="text-sm flex items-center justify-between gap-3 p-2 rounded-lg border border-navy/[0.08]">
                  <span>{doc.doc_type} - {doc.original_filename || doc.storage_path}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-navy underline"
                    onClick={async () => {
                      const supabase = createClient();
                      const { data } = await supabase.storage.from('verification-documents').createSignedUrl(doc.storage_path, 120);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
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
