'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Ship, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput, TextArea, Button, ErrorBanner, Badge } from '@/components/ui';
import type { Application, Mission, Profile } from '@/lib/database.types';

function missionStatusLabel(status: Mission['status']) {
  if (status === 'open') return 'Ouverte';
  if (status === 'assigned') return 'Assignée';
  if (status === 'completed') return 'Terminée';
  return 'Annulée';
}

function applicationStatusLabel(status: Application['status']) {
  if (status === 'pending') return 'Candidature envoyée';
  if (status === 'accepted') return 'Candidature acceptée';
  if (status === 'rejected') return 'Candidature refusée';
  return 'Candidature';
}

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyPhone, setApplyPhone] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [existingApplication, setExistingApplication] = useState<Application | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: missionData } = await supabase.from('missions').select('*').eq('id', id).single();
      setMission(missionData as Mission | null);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(profileData as Profile | null);
        setApplyPhone((profileData as Profile | null)?.phone || '');

        if ((profileData as Profile | null)?.role === 'skipper') {
          const { data: app } = await supabase
            .from('applications')
            .select('*')
            .eq('mission_id', id)
            .eq('skipper_id', user.id)
            .maybeSingle();
          setExistingApplication((app as Application | null) || null);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const supabase = createClient();
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
      setError(appErr.code === '23505' ? 'Vous avez déjà postulé à cette mission.' : appErr.message);
      return;
    }
    setApplied(true);
    setExistingApplication(appData as Application);
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;
  if (!mission) return <main className="max-w-lg mx-auto px-6 py-10"><p>Mission introuvable.</p></main>;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/missions')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> Retour aux missions
      </button>

      {!applied ? (
        <>
          <Badge>{mission.type}</Badge>
          <span className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-lightblue text-navy">
            {missionStatusLabel(mission.status)}
          </span>
          <h1 className="font-display text-2xl font-bold mt-3 mb-2">{mission.departure}{mission.destination ? ` → ${mission.destination}` : ''}</h1>
          <div className="flex flex-wrap gap-4 text-sm mb-6 text-gray-500">
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {mission.zone}</span>
            <span className="flex items-center gap-1.5"><Ship size={14} /> {mission.boat_type}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14} /> {mission.start_date} {mission.duration && `· ${mission.duration}`}</span>
          </div>
          {mission.description && <p className="mb-6 text-sm leading-relaxed">{mission.description}</p>}
          {mission.requirements && (
            <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Exigences</div>
              <p className="text-sm leading-relaxed text-anthracite">{mission.requirements}</p>
            </div>
          )}
          <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rémunération</span>
              <span className="font-bold text-navy">{mission.compensation || 'Sur devis'}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">Statut mission: {missionStatusLabel(mission.status)}</div>
          </div>

          {!profile ? (
            <Link href="/signup?role=skipper" className="block text-center w-full font-bold py-3 rounded-xl bg-navy text-white">
              Créer un compte skipper pour postuler
            </Link>
          ) : profile.role !== 'skipper' ? (
            <p className="text-center text-sm text-gray-500">Seuls les comptes skipper peuvent postuler.</p>
          ) : mission.status !== 'open' ? (
            <p className="text-center text-sm text-gray-500">Cette mission n&apos;est plus ouverte aux candidatures.</p>
          ) : existingApplication ? (
            <p className="text-center text-sm text-gray-500">{applicationStatusLabel(existingApplication.status)}.</p>
          ) : (
            <form onSubmit={handleApply}>
              <ErrorBanner message={error} />
              <Field label="Téléphone">
                <TextInput type="tel" value={applyPhone} onChange={(e) => setApplyPhone(e.target.value)} />
              </Field>
              <Field label="Message au demandeur">
                <TextArea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)} placeholder="Confirmez votre disponibilité..." />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2">
                {submitting && <Loader2 className="animate-spin" size={16} />} Postuler à cette mission
              </Button>
            </form>
          )}
        </>
      ) : (
        <div className="text-center py-14">
          <CheckCircle2 size={40} className="text-gold mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Candidature envoyée</h1>
          <p className="mb-8 text-gray-500">Le demandeur peut désormais vous contacter via la messagerie.</p>
          <Link href="/missions" className="font-semibold px-5 py-2.5 rounded-lg bg-navy text-white">Voir d&apos;autres missions</Link>
        </div>
      )}
    </main>
  );
}
