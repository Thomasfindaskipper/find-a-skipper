'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { localizeBoatType, localizeZone } from '@/lib/i18n/options';
import { createClient } from '@/lib/supabase/client';
import { Button, ErrorBanner, Field, TextArea, TextInput } from '@/components/ui';
import PhoneInput from '@/components/phone-input';
import type { Profile } from '@/lib/database.types';
import { phoneValueFromStored, getPhoneStorageValue, validatePhoneValue, type PhoneValue } from '@/lib/phone';
import { dashboardHrefForRole, isRoleProfileReady, missingRoleFields } from '@/lib/onboarding';
import { NAVIGATION_ZONES, SKIPPER_BOAT_TYPES } from '@/lib/profile-options';

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

export default function OnboardingPage() {
  const router = useRouter();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState<PhoneValue>(phoneValueFromStored(null));
  const [companyName, setCompanyName] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [boatTypes, setBoatTypes] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login?next=/onboarding');
        return;
      }

      const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileError || !data) {
        setError(profileError?.message || extra.errors.loadProfile);
        setLoading(false);
        return;
      }

      const p = data as Profile;
      if (p.onboarding_completed_at) {
        router.replace(dashboardHrefForRole(p.role));
        return;
      }

      setProfile(p);
      setPhone(phoneValueFromStored(p.phone));
      setCompanyName(p.company_name || '');
      setFleetSize(p.fleet_size?.toString() || '');
      setZones(p.zones || []);
      setBoatTypes(p.boat_types || []);
      setBio(p.bio || '');
      setLoading(false);
    })();
  }, [extra.errors.loadProfile, router]);

  const previewProfile = useMemo<Profile | null>(() => {
    if (!profile) return null;
    return {
      ...profile,
      phone: getPhoneStorageValue(phone) || null,
      company_name: companyName || null,
      fleet_size: fleetSize ? Number(fleetSize) : null,
      zones,
      boat_types: boatTypes,
      bio,
    };
  }, [profile, phone, companyName, fleetSize, zones, boatTypes, bio]);

  const missing = previewProfile ? missingRoleFields(previewProfile) : [];

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  async function saveProfile(markDone: boolean) {
    if (!profile) return;
    setSaving(true);
    setError('');

    const supabase = createClient();

    const updates: Record<string, unknown> = {
      phone: getPhoneStorageValue(phone) || null,
      company_name: companyName || null,
      fleet_size: fleetSize ? Number(fleetSize) : null,
      zones,
      boat_types: boatTypes,
      bio: bio || null,
      onboarding_step: markDone ? 'done' : 'role_details',
      onboarding_completed_at: markDone ? new Date().toISOString() : null,
    };

    if (markDone && previewProfile && !isRoleProfileReady(previewProfile)) {
      setSaving(false);
      setError(extra.onboarding.completeRequired);
      return;
    }

    const phoneError = validatePhoneValue(phone, profile.role !== 'skipper', locale);
    if (phoneError) {
      setSaving(false);
      setError(phoneError);
      return;
    }

    const { error: updErr } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    setSaving(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    if (markDone) {
      router.replace(dashboardHrefForRole(profile.role));
      return;
    }

    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-gray-500">
        <Loader2 className="animate-spin" size={20} /> {copy.common.loading}
      </div>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-md mx-auto px-6 py-10">
        <p>{extra.onboarding.profileNotFound}</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-2">{copy.nav.profile}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {copy.nav.profile}
      </p>
      <ErrorBanner message={error} />

      <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
        <h2 className="font-semibold mb-2">{copy.nav.profile}</h2>
        {missing.length === 0 ? (
          <p className="text-sm text-emerald-700">{extra.onboarding.ready}</p>
        ) : (
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        <Field label={copy.common.phone}>
          <PhoneInput value={phone} onChange={setPhone} required={profile.role !== 'skipper'} />
        </Field>

        {(profile.role === 'broker' || profile.role === 'charter_company') && (
          <>
            <Field label={copy.signup.companyName}>
              <TextInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <Field label={copy.signup.fleetSize}>
              <TextInput type="number" min="0" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} />
            </Field>
          </>
        )}

        {profile.role === 'skipper' && (
          <>
            <Field label={copy.signup.zones}>
              <div>{NAVIGATION_ZONES.map((zone) => <Tag key={zone} label={localizeZone(zone, locale)} active={zones.includes(zone)} onClick={() => toggle(zones, setZones, zone)} />)}</div>
            </Field>
            <Field label={copy.signup.boatTypes}>
              <div>{SKIPPER_BOAT_TYPES.map((boat) => <Tag key={boat} label={localizeBoatType(boat, locale)} active={boatTypes.includes(boat)} onClick={() => toggle(boatTypes, setBoatTypes, boat)} />)}</div>
            </Field>
            <Field label={copy.signup.bio}>
              <TextArea value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <Button type="button" variant="outline" onClick={() => saveProfile(false)} disabled={saving}>
            {copy.common.save}
          </Button>
          <Button type="button" onClick={() => saveProfile(true)} disabled={saving}>
            {saving ? '...' : extra.onboarding.finish}
          </Button>
        </div>
      </form>
    </main>
  );
}
