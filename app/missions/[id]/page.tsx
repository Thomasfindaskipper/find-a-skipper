'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Ship, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import { buildVerifyEmailPath, isEmailVerified } from '@/lib/auth';
import { getExtraCopy } from '@/lib/i18n/extra';
import { formatDateForLocale } from '@/lib/i18n/format';
import { localizeBoatType, localizeMissionType, localizeZone } from '@/lib/i18n/options';
import { Field, TextInput, TextArea, Button, ErrorBanner, Badge } from '@/components/ui';
import type { Application, Mission, Profile } from '@/lib/database.types';

export default function MissionDetailPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const missionStatusLabel = (status: Mission['status']) => {
    if (status === 'open') return copy.missions.statusOpen;
    if (status === 'assigned') return copy.missions.assigned;
    if (status === 'completed') return copy.missions.completed;
    return copy.missions.cancelled;
  };
  const applicationStatusLabel = (status: Application['status']) => {
    if (status === 'pending') return copy.nav.myApplications;
    if (status === 'accepted') return copy.missions.assigned;
    if (status === 'rejected') return copy.common.cancel;
    return copy.nav.myApplications;
  };
  const [mission, setMission] = useState<Mission | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [existingApplication, setExistingApplication] = useState<Application | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: missionData, error: missionError } = await supabase.from('missions').select('*').eq('id', id).single();
        if (missionError) {
          setError(missionError.message);
          return;
        }

        setMission(missionData as Mission | null);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profileError) {
            setError(profileError.message);
            return;
          }

          setProfile(profileData as Profile | null);
          setApplyPhone((profileData as Profile | null)?.phone || '');

          if ((profileData as Profile | null)?.role === 'skipper') {
            const { data: app, error: appError } = await supabase
              .from('applications')
              .select('*')
              .eq('mission_id', id)
              .eq('skipper_id', user.id)
              .maybeSingle();
            if (appError) {
              setError(appError.message);
              return;
            }
            setExistingApplication((app as Application | null) || null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadMissionDetails);
      } finally {
        setLoading(false);
      }
    })();
  }, [extra.errors.loadMissionDetails, id, setError]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile) {
      setSubmitting(false);
      router.push('/login?next=/missions');
      return;
    }

    if (!isEmailVerified(user)) {
      setSubmitting(false);
      router.push(buildVerifyEmailPath(user.email || null, `/missions/${id}`));
      return;
    }

    const { data: appData, error: appErr } = await supabase
      .from('applications')
      .insert({
        mission_id: id,
        skipper_id: profile!.id,
        phone: applyPhone,
        message: applyMessage,
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (appErr) {
      setError(appErr.code === '23505' ? copy.nav.myApplications : appErr.message);
      return;
    }
    setApplied(true);
    setExistingApplication(appData as Application);
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;
  if (error) return <main className="max-w-lg mx-auto px-6 py-10"><div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">{error}</div></main>;
  if (!mission) return <main className="max-w-lg mx-auto px-6 py-10"><p>{copy.missions.noResult}</p></main>;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/missions')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> {copy.messages.back}
      </button>

      {!applied ? (
        <>
          <Badge>{localizeMissionType(mission.type, locale)}</Badge>
          <span className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-lightblue text-navy">
            {missionStatusLabel(mission.status)}
          </span>
          <h1 className="font-display text-2xl font-bold mt-3 mb-2">{mission.departure}{mission.destination ? ` → ${mission.destination}` : ''}</h1>
          <div className="flex flex-wrap gap-4 text-sm mb-6 text-gray-500">
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {localizeZone(mission.zone, locale)}</span>
            <span className="flex items-center gap-1.5"><Ship size={14} /> {localizeBoatType(mission.boat_type, locale)}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDateForLocale(mission.start_date, locale)} {mission.duration && `· ${mission.duration}`}</span>
          </div>
          {mission.description && <p className="mb-6 text-sm leading-relaxed">{mission.description}</p>}
          {mission.requirements && (
            <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{extra.missionsNew.requirements}</div>
              <p className="text-sm leading-relaxed text-anthracite">{mission.requirements}</p>
            </div>
          )}
          <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{extra.missionsNew.compensation}</span>
              <span className="font-bold text-navy">{mission.compensation || copy.missions.quote}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">{copy.missions.status}: {missionStatusLabel(mission.status)}</div>
          </div>

          {!profile ? (
            <Link href="/signup?role=skipper" className="block text-center w-full font-bold py-3 rounded-xl bg-navy text-white">
              {copy.skippers.createSkipper}
            </Link>
          ) : profile.role !== 'skipper' ? (
            <p className="text-center text-sm text-gray-500">{extra.common.accessDenied}</p>
          ) : mission.status !== 'open' ? (
            <p className="text-center text-sm text-gray-500">{copy.missions.cancelled}</p>
          ) : existingApplication ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-500">{applicationStatusLabel(existingApplication.status)}.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/my-applications" className="block text-center font-semibold px-4 py-2.5 rounded-lg border border-navy text-navy">
                  {copy.nav.myApplications}
                </Link>
                <Link href={`/missions/${id}`} className="block text-center font-semibold px-4 py-2.5 rounded-lg bg-lightblue text-navy">
                  {copy.missions.title}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleApply}>
              <ErrorBanner message={error} />
              <Field label={copy.common.phone}>
                <TextInput type="tel" value={applyPhone} onChange={(e) => setApplyPhone(e.target.value)} />
              </Field>
              <Field label={copy.messages.title}>
                <TextArea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)} placeholder={copy.messages.placeholder} />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2">
                {submitting && <Loader2 className="animate-spin" size={16} />} {copy.nav.myApplications}
              </Button>
            </form>
          )}
        </>
      ) : (
        <div className="text-center py-14">
          <CheckCircle2 size={40} className="text-gold mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">{copy.nav.myApplications}</h1>
          <p className="mb-8 text-gray-500">{copy.messages.title}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/my-applications" className="font-semibold px-5 py-2.5 rounded-lg bg-navy text-white">{copy.nav.myApplications}</Link>
            <Link href={`/missions/${id}`} className="font-semibold px-5 py-2.5 rounded-lg bg-lightblue text-navy">{copy.missions.title}</Link>
          </div>
          <Link href="/missions" className="inline-block mt-3 text-sm font-semibold text-navy">{copy.missions.title}</Link>
        </div>
      )}
    </main>
  );
}
