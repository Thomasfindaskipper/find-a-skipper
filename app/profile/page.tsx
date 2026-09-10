'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { localizeRole } from '@/lib/i18n/options';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner, initials } from '@/components/ui';
import AvailabilityEditor from '@/components/availability-editor';
import CertificationSelect from '@/components/certification-select';
import LanguageSelect from '@/components/language-select';
import MultiSelectTags from '@/components/multi-select-tags';
import PhoneInput from '@/components/phone-input';
import { getPhoneStorageValue, phoneValueFromStored, validatePhoneValue, type PhoneValue } from '@/lib/phone';
import { DEFAULT_INDICATIVE_RATE, NAVIGATION_ZONES, SKIPPER_BOAT_TYPES } from '@/lib/profile-options';
import { formatAvailabilitySummary, normalizeLanguages, normalizeProfileCertifications } from '@/lib/profile';
import { resolveAvatarUrl } from '@/lib/media';
import type { AvailabilitySlot, Profile, VerificationDocument, VerificationDocType, VerificationRequest } from '@/lib/database.types';

const MAX_VERIFICATION_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

function normalizeHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
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
  const [reputation, setReputation] = useState<{ average: number; count: number } | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState<PhoneValue>(phoneValueFromStored(null));
  const [zones, setZones] = useState<string[]>([]);
  const [boatTypes, setBoatTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [experienceYears, setExperienceYears] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_INDICATIVE_RATE);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [editingAvailabilitySlotId, setEditingAvailabilitySlotId] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [city, setCity] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

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
      setPhone(phoneValueFromStored(p.phone));
      setZones(p.zones || []);
      setBoatTypes(p.boat_types || []);
      setLanguages(normalizeLanguages(p.languages));
      setAvatarUrl(p.avatar_url || '');
      setResolvedAvatarUrl(await resolveAvatarUrl(supabase, p.avatar_url));
      setExperienceYears(p.experience_years?.toString() || '');
      setCertifications(normalizeProfileCertifications(p.certifications).map((cert) => cert.name));
      setHourlyRate(p.hourly_rate || DEFAULT_INDICATIVE_RATE);
      setAvailabilityNote(p.availability_note || '');
      setBio(p.bio || '');
      setCompanyName(p.company_name || '');
      setFleetSize(p.fleet_size?.toString() || '');
      setCity(p.city || '');

      const { data: slotsData } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('skipper_id', p.id)
        .order('start_date', { ascending: true });
      setAvailabilitySlots((slotsData as AvailabilitySlot[]) || []);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', p.id);
      const ratings = (reviewsData as Array<{ rating: number }>) || [];
      if (ratings.length > 0) {
        const total = ratings.reduce((accumulator, review) => accumulator + review.rating, 0);
        setReputation({ average: total / ratings.length, count: ratings.length });
      } else {
        setReputation(null);
      }

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

  function toggleBoatType(boatType: string) {
    setBoatTypes((prev) => (prev.includes(boatType) ? prev.filter((value) => value !== boatType) : [...prev, boatType]));
  }

  function toggleCertification(certification: string) {
    setCertifications((prev) => (prev.includes(certification) ? prev.filter((value) => value !== certification) : [...prev, certification]));
  }

  function addAvailabilitySlot() {
    if (!availabilityStart || !availabilityEnd) {
      setError(extra.profile.startEndRequired);
      return;
    }

    if (availabilityEnd < availabilityStart) {
      setError(extra.profile.endAfterStart);
      return;
    }

    setError('');
    setAvailabilitySlots((current) => {
      if (editingAvailabilitySlotId) {
        return current.map((slot) => (
          slot.id === editingAvailabilitySlotId
            ? { ...slot, start_date: availabilityStart, end_date: availabilityEnd }
            : slot
        ));
      }

      return [
        ...current,
        {
          id: `draft-${availabilityStart}-${availabilityEnd}-${current.length}`,
          skipper_id: profile?.id || '',
          start_date: availabilityStart,
          end_date: availabilityEnd,
          created_at: new Date().toISOString(),
        },
      ];
    });
    setAvailabilityStart('');
    setAvailabilityEnd('');
    setEditingAvailabilitySlotId(null);
  }

  function removeAvailabilitySlot(id: string) {
    setAvailabilitySlots((current) => current.filter((slot) => slot.id !== id));
    if (editingAvailabilitySlotId === id) {
      setEditingAvailabilitySlotId(null);
      setAvailabilityStart('');
      setAvailabilityEnd('');
    }
  }

  function editAvailabilitySlot(slot: AvailabilitySlot) {
    setEditingAvailabilitySlotId(slot.id);
    setAvailabilityStart(slot.start_date);
    setAvailabilityEnd(slot.end_date);
    setError('');
  }

  function cancelAvailabilityEdit() {
    setEditingAvailabilitySlotId(null);
    setAvailabilityStart('');
    setAvailabilityEnd('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const normalizedAvatarUrl = normalizeHttpsUrl(avatarUrl);
    if (avatarUrl.trim() && !normalizedAvatarUrl) {
      setSaving(false);
      setError(extra.profile.photoHttps);
      return;
    }

    const phoneError = validatePhoneValue(phone, false, locale);
    if (phoneError) {
      setSaving(false);
      setError(phoneError);
      return;
    }

    if (avatarFile && avatarFile.size > MAX_AVATAR_FILE_BYTES) {
      setSaving(false);
      setError(extra.profile.photoTooLarge);
      return;
    }

    const supabase = createClient();
    let nextAvatarUrl = normalizedAvatarUrl;

    if (avatarFile && profile) {
      const extension = avatarFile.name.split('.').pop() || 'jpg';
      const storagePath = `${profile.id}/avatar-${Date.now()}.${extension}`;
      const { error: avatarUploadError } = await supabase.storage.from('profile-avatars').upload(storagePath, avatarFile, { upsert: true });
      if (avatarUploadError) {
        setSaving(false);
        setError(avatarUploadError.message);
        return;
      }
      nextAvatarUrl = `storage:profile-avatars/${storagePath}`;
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: getPhoneStorageValue(phone) || null,
        avatar_url: nextAvatarUrl,
        zones,
        boat_types: boatTypes,
        languages,
        experience_years: experienceYears ? Number(experienceYears) : null,
        certifications: certifications.map((name) => ({ name, verified: false })),
        hourly_rate: hourlyRate || null,
        availability_note: availabilityNote || formatAvailabilitySummary(availabilitySlots),
        company_name: companyName || null,
        fleet_size: fleetSize ? Number(fleetSize) : null,
        city: city || null,
        bio,
      })
      .eq('id', profile!.id);

    if (!updErr && profile?.role === 'skipper') {
      const { error: deleteSlotsError } = await supabase
        .from('availability_slots')
        .delete()
        .eq('skipper_id', profile.id);

      if (deleteSlotsError) {
        setSaving(false);
        setError(deleteSlotsError.message);
        return;
      }

      if (availabilitySlots.length > 0) {
        const { error: insertSlotsError } = await supabase
          .from('availability_slots')
          .insert(
            availabilitySlots.map((slot) => ({
              skipper_id: profile.id,
              start_date: slot.start_date,
              end_date: slot.end_date,
            }))
          );

        if (insertSlotsError) {
          setSaving(false);
          setError(insertSlotsError.message);
          return;
        }
      }
    }

    setSaving(false);
    if (updErr) { setError(updErr.message); return; }
    const nextResolvedAvatar = await resolveAvatarUrl(supabase, nextAvatarUrl);
    setProfile((p) => (p ? {
      ...p,
      full_name: fullName,
      phone: getPhoneStorageValue(phone) || null,
      avatar_url: nextAvatarUrl,
      zones,
      boat_types: boatTypes,
      languages,
      experience_years: experienceYears ? Number(experienceYears) : null,
      certifications: certifications.map((name) => ({ name, verified: false })),
      hourly_rate: hourlyRate || null,
      availability_note: availabilityNote || formatAvailabilitySummary(availabilitySlots),
      availability_slots: availabilitySlots,
      company_name: companyName || null,
      fleet_size: fleetSize ? Number(fleetSize) : null,
      city: city || null,
      bio,
    } : p));
    setResolvedAvatarUrl(nextResolvedAvatar);
    setAvatarFile(null);
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
      setError(extra.profile.chooseDocument);
      return;
    }

    if (docFile.size > MAX_VERIFICATION_FILE_BYTES) {
      setError(extra.profile.docTooLarge);
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
    setVerificationMessage(extra.profile.docUploaded);
  }

  async function submitVerificationRequest() {
    setError('');
    setVerificationMessage('');

    if (!request) {
      setError(extra.profile.addDocBeforeSubmit);
      return;
    }

    if (request.status === 'submitted' || request.status === 'approved') {
      setError(extra.profile.cannotResubmit);
      return;
    }

    if (documents.length === 0) {
      setError(extra.profile.addDocBeforeSubmit);
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
    setVerificationMessage(extra.profile.requestSubmitted);
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;
  if (!profile) return <main className="max-w-md mx-auto px-6 py-10"><p>{copy.messages.connect}</p></main>;

  const safeAvatarUrl = resolvedAvatarUrl || (profile.avatar_url ? normalizeHttpsUrl(profile.avatar_url) : null);
  const availabilitySummary = availabilitySlots.length > 0 ? formatAvailabilitySummary(availabilitySlots) : profile.availability_note;

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      {!editing ? (
        <>
          <h1 className="font-display text-2xl font-bold mb-6">{copy.nav.profile}</h1>
          <div className="rounded-2xl p-6 mb-4 bg-white border border-navy/[0.08]">
            <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-navy/[0.08] bg-navyDeep font-bold text-white">
                {safeAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeAvatarUrl} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  initials(profile.full_name)
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-lightblue text-navy">
                {localizeRole(profile.role, locale)}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${profile.identity_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                {profile.identity_verified ? copy.common.yes : copy.common.no}
              </span>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm font-semibold text-navy">
                <Pencil size={14} /> {extra.profile.editProfile}
              </button>
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row label={copy.signup.fullName} value={profile.full_name} />
              <Row label={copy.common.email} value={email} />
              {reputation && <Row label={extra.common.review} value={`★ ${reputation.average.toFixed(1)} (${reputation.count})`} />}
              {profile.phone && <Row label={copy.common.phone} value={profile.phone} />}
              {profile.role !== 'skipper' && profile.company_name && <Row label={copy.signup.companyName} value={profile.company_name} />}
              {profile.role !== 'skipper' && profile.fleet_size !== null && <Row label={copy.signup.fleetSize} value={String(profile.fleet_size)} />}
              {profile.role !== 'skipper' && profile.city && <Row label={copy.signup.city} value={profile.city} />}
              {profile.role === 'skipper' && profile.experience_years !== null && <Row label={copy.skippers.experience} value={`${profile.experience_years}`} />}
              {profile.role === 'skipper' && profile.zones?.length > 0 && <Row label={copy.signup.zones} value={profile.zones.join(', ')} />}
              {profile.role === 'skipper' && profile.boat_types?.length > 0 && <Row label={copy.signup.boatTypes} value={profile.boat_types.join(', ')} />}
              {profile.role === 'skipper' && profile.languages?.length > 0 && <Row label={copy.signup.languages} value={profile.languages.join(', ')} />}
              {profile.role === 'skipper' && profile.certifications?.length > 0 && <Row label={copy.signup.certifications} value={profile.certifications.map((cert) => cert.name).join(', ')} />}
              {profile.role === 'skipper' && profile.hourly_rate && <Row label={copy.skippers.rate} value={`${profile.hourly_rate}`} />}
              {profile.role === 'skipper' && availabilitySummary && <Row label={copy.skippers.availability} value={availabilitySummary} />}
              {profile.role === 'skipper' && profile.bio && <Row label={copy.signup.bio} value={profile.bio} />}
            </dl>
          </div>
        </>
      ) : (
        <form onSubmit={handleSave}>
          <h1 className="font-display text-2xl font-bold mb-6">{extra.profile.editProfile}</h1>
          <ErrorBanner message={error} />
          <Field label={copy.signup.fullName}><TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
          <Field label={copy.common.phone}><PhoneInput value={phone} onChange={setPhone} /></Field>
          <Field label={copy.profile.photo}>
            <div className="space-y-3">
              <TextInput value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              <input type="file" accept="image/*" capture="user" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
          </Field>
          {profile.role !== 'skipper' && (
            <>
              <Field label={copy.signup.companyName}><TextInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
              <Field label={copy.signup.fleetSize}><TextInput type="number" min="0" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} /></Field>
              <Field label={copy.signup.city}><TextInput value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            </>
          )}
          {profile.role === 'skipper' && (
            <>
              <Field label={copy.signup.experienceYears}><TextInput type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} /></Field>
              <Field label={copy.signup.zones}>
                <MultiSelectTags label={copy.signup.zones} options={NAVIGATION_ZONES} selected={zones} onToggle={toggleZone} />
              </Field>
              <Field label={copy.signup.boatTypes}>
                <MultiSelectTags label={copy.signup.boatTypes} options={SKIPPER_BOAT_TYPES} selected={boatTypes} onToggle={toggleBoatType} />
              </Field>
              <Field label={copy.signup.languages}><LanguageSelect selected={languages} onAdd={(language) => setLanguages((current) => [...current, language])} onRemove={(language) => setLanguages((current) => current.filter((entry) => entry !== language))} /></Field>
              <Field label={copy.signup.certifications}><CertificationSelect selected={certifications} onToggle={toggleCertification} /></Field>
              <Field label={copy.signup.indicativeRate} hint={copy.signup.indicativeRateHint}><TextInput value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder={DEFAULT_INDICATIVE_RATE} /></Field>
              <Field label={copy.skippers.availability}><TextInput value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} /></Field>
              <Field label={copy.signup.availability}><AvailabilityEditor draftStart={availabilityStart} draftEnd={availabilityEnd} onDraftStartChange={setAvailabilityStart} onDraftEndChange={setAvailabilityEnd} onAdd={addAvailabilitySlot} slots={availabilitySlots} onRemove={removeAvailabilitySlot} onEdit={editAvailabilitySlot} editingSlotId={editingAvailabilitySlotId} onCancelEdit={cancelAvailabilityEdit} /></Field>
              <Field label={copy.signup.bio}><TextArea value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
            </>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} className="flex-1">{copy.common.cancel}</Button>
            <Button type="submit" disabled={saving} className="flex-1">{copy.common.save}</Button>
          </div>
        </form>
      )}

      <section className="rounded-2xl p-6 bg-white border border-navy/[0.08]">
        <h2 className="font-semibold mb-2">{extra.profile.verificationTitle}</h2>
        {verificationMessage && <p className="text-sm text-emerald-700 mb-2">{verificationMessage}</p>}
        {request?.status === 'rejected' && request.rejection_reason && (
          <p className="text-sm text-red-700 mb-2">{extra.profile.latestRejection}: {request.rejection_reason}</p>
        )}
        <p className="text-sm text-gray-500 mb-4">
          {extra.profile.currentStatus}: {request ? request.status : 'draft'}
        </p>

        <form onSubmit={handleUploadDocument} className="space-y-3">
          <Field label={extra.profile.documentType}>
            <select value={docType} onChange={(e) => setDocType(e.target.value as VerificationDocType)} className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-sm bg-white">
              <option value="identity">{extra.profile.docTypeIdentity}</option>
              <option value="license">{extra.profile.docTypeLicense}</option>
              <option value="certificate">{extra.profile.docTypeCertificate}</option>
              <option value="company">{extra.profile.docTypeCompany}</option>
              <option value="ownership">{extra.profile.docTypeOwnership}</option>
              <option value="mandate">{extra.profile.docTypeMandate}</option>
              <option value="other">{extra.profile.docTypeOther}</option>
            </select>
          </Field>

          <Field label={extra.profile.documentFile}>
            <input
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={uploading || request?.status === 'approved'}>
              {uploading ? '...' : extra.profile.uploadDocument}
            </Button>
            <Button type="button" variant="outline" disabled={submittingVerification || documents.length === 0 || request?.status === 'approved'} onClick={submitVerificationRequest}>
              {submittingVerification ? '...' : extra.profile.submitForVerification}
            </Button>
          </div>
        </form>

        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">{extra.profile.uploadDocument}</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">{extra.common.noUploadedDocuments}</p>
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
                    {extra.common.open}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl p-6 mt-4 bg-white border border-navy/[0.08]">
        <h2 className="font-semibold mb-2">{extra.profile.privacyAccount}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {extra.profile.privacyAccountBody}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/confidentialite" className="inline-flex items-center rounded-lg bg-lightblue px-3 py-2 text-sm font-semibold text-navy">
            {extra.profile.privacyPolicy}
          </Link>
          <Link href="/account" className="inline-flex items-center rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {extra.profile.accountDeletion}
          </Link>
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
