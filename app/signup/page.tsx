'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Anchor, Briefcase, Building2, Ship as ShipIcon, Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner } from '@/components/ui';
import CertificationSelect from '@/components/certification-select';
import LanguageSelect from '@/components/language-select';
import MultiSelectTags from '@/components/multi-select-tags';
import PasswordInput from '@/components/password-input';
import PhoneInput from '@/components/phone-input';
import { buildEmailRedirectTo, buildVerifyEmailPath } from '@/lib/auth';
import { localizeRole } from '@/lib/i18n/options';
import { createEmptyPhoneValue, getPhoneStorageValue, validatePhoneValue } from '@/lib/phone';
import { DEFAULT_INDICATIVE_RATE, NAVIGATION_ZONES, SKIPPER_BOAT_TYPES } from '@/lib/profile-options';
import type { Role } from '@/lib/database.types';

const ROLE_OPTIONS: { value: Role; icon: typeof Anchor }[] = [
  { value: 'skipper', icon: Anchor },
  { value: 'owner', icon: Briefcase },
  { value: 'broker', icon: Building2 },
  { value: 'charter_company', icon: ShipIcon },
];

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

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const initialRole = (params.get('role') as Role) || 'skipper';

  const [role, setRole] = useState<Role>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState(createEmptyPhoneValue('FR'));
  // skipper fields
  const [experienceYears, setExperienceYears] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [boatTypes, setBoatTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [permits, setPermits] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_INDICATIVE_RATE);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [bio, setBio] = useState('');
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
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
    if (!fullName || !email || !password || !confirmPassword) {
      setError(copy.verifyEmail.invalidEmail);
      return;
    }

    if (password.length < 10) {
      setError(copy.common.password);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.common.confirmPassword);
      return;
    }

    if (!acceptedLegal) {
      setError(`${copy.signup.legalIntro} CGU ${copy.signup.legalAnd} ${copy.signup.legalPrivacy}.`);
      return;
    }

    const phoneError = validatePhoneValue(phone, false, locale);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    const normalizedAvatarUrl = normalizeHttpsUrl(avatarUrl);
    if (role === 'skipper' && avatarUrl.trim() && !normalizedAvatarUrl) {
      setError(extra.profile.photoHttps);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildEmailRedirectTo(window.location.origin, '/dashboard'),
        data: {
          role,
          full_name: fullName,
          phone: getPhoneStorageValue(phone) || null,
          company_name: role === 'broker' || role === 'charter_company' ? companyName : null,
          fleet_size: role === 'broker' || role === 'charter_company' ? fleetSize : null,
          city: role === 'owner' ? city : null,
          experience_years: role === 'skipper' ? experienceYears : null,
          zones: role === 'skipper' ? zones : [],
          boat_types: role === 'skipper' ? boatTypes : [],
          languages: role === 'skipper' ? languages : [],
          permits: role === 'skipper' ? permits : null,
          avatar_url: role === 'skipper' ? normalizedAvatarUrl : null,
          hourly_rate: role === 'skipper' ? hourlyRate : null,
          availability_note: role === 'skipper' ? availabilityNote : null,
          certifications: role === 'skipper' ? selectedCertifications.map((name) => ({ name, verified: false })) : [],
          bio: role === 'skipper' ? bio : null,
        },
      },
    });
    setLoading(false);
    if (signErr) {
      if (/fetch|network|Failed to fetch/i.test(signErr.message)) {
        setError(copy.login.unavailable);
      } else {
        setError(signErr.message);
      }
      return;
    }
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      router.replace(buildVerifyEmailPath(email, '/dashboard'));
    }
  }

  const isDemandeur = role !== 'skipper';

  return (
    <>
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-2 mb-6">
        {ROLE_OPTIONS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            className={`flex items-center gap-2 p-3 rounded-xl justify-center text-sm font-semibold border-[1.5px] ${
              role === value ? 'bg-navy text-white border-navy' : 'bg-white text-anthracite border-gray-200'
            }`}
          >
            <Icon size={15} /> {localizeRole(value, locale)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <Field label={role === 'skipper' ? copy.signup.fullName : copy.signup.contactName}>
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        {(role === 'broker' || role === 'charter_company') && (
          <>
            <Field label={copy.signup.companyName}>
              <TextInput required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <Field label={copy.signup.fleetSize}>
              <TextInput type="number" min="0" value={fleetSize} onChange={(e) => setFleetSize(e.target.value)} />
            </Field>
          </>
        )}
        {role === 'owner' && (
          <Field label={copy.signup.city}>
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        )}

        <Field label={copy.common.email}>
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={copy.common.password}>
          <PasswordInput required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={copy.common.confirmPassword}>
          <PasswordInput required minLength={10} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <Field label={copy.common.phone}>
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>

        <label className="flex items-start gap-2.5 mb-4">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm text-gray-600 leading-6">
            {copy.signup.legalIntro}{' '}
            <Link href="/cgu" className="font-semibold text-navy underline">
              CGU
            </Link>{' '}{copy.signup.legalAnd}{' '}
            <Link href="/confidentialite" className="font-semibold text-navy underline">
              {copy.signup.legalPrivacy}
            </Link>
            . {copy.signup.legalRead}{' '}
            <Link href="/cookies" className="font-semibold text-navy underline">
              {copy.signup.legalCookies}
            </Link>
            .
          </span>
        </label>

        {role === 'skipper' && (
          <>
            <Field label={copy.signup.experienceYears}>
              <TextInput type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
            </Field>
            <Field label={copy.signup.zones}>
              <MultiSelectTags label={copy.signup.zones} options={NAVIGATION_ZONES} selected={zones} onToggle={(value) => toggle(zones, setZones, value)} />
            </Field>
            <Field label={copy.signup.boatTypes}>
              <MultiSelectTags label={copy.signup.boatTypes} options={SKIPPER_BOAT_TYPES} selected={boatTypes} onToggle={(value) => toggle(boatTypes, setBoatTypes, value)} />
            </Field>
            <Field label={copy.signup.permits}>
              <TextInput value={permits} onChange={(e) => setPermits(e.target.value)} />
            </Field>
            <Field label={copy.signup.languages}>
              <LanguageSelect selected={languages} onAdd={(language) => setLanguages((current) => [...current, language])} onRemove={(language) => setLanguages((current) => current.filter((entry) => entry !== language))} />
            </Field>
            <Field label={copy.signup.certifications}>
              <CertificationSelect selected={selectedCertifications} onToggle={(value) => setSelectedCertifications((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value])} />
            </Field>
            <Field label={copy.signup.avatarUrl}>
              <TextInput value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            </Field>
            <Field label={copy.signup.indicativeRate} hint={copy.signup.indicativeRateHint}>
              <TextInput value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder={DEFAULT_INDICATIVE_RATE} />
            </Field>
            <Field label={copy.signup.availability}>
              <TextInput value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} placeholder={copy.skippers.available} />
            </Field>
            <Field label={copy.signup.bio}>
              <TextArea value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
          </>
        )}

        <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 mt-2">
          {loading && <Loader2 className="animate-spin" size={16} />} {copy.signup.submit}
        </Button>
      </form>
      {isDemandeur && (
        <p className="text-xs text-center mt-3 text-gray-500">
          {copy.signup.demandeurNote}
        </p>
      )}
    </>
  );
}

export default function SignupPage() {
  const { copy } = useLocale();

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <div className="mb-6 flex justify-center"><BrandLogo /></div>
      <h1 className="font-display text-2xl font-bold mb-6 text-center">{copy.signup.title}</h1>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
