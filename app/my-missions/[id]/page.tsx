'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { buildVerifyEmailPath, isEmailVerified } from '@/lib/auth';
import { Badge, Button, EmptyState, ErrorBanner } from '@/components/ui';
import type { Application, Mission, Review } from '@/lib/database.types';

function applicationStatusLabel(status: Application['status'], copy: ReturnType<typeof useLocale>['copy']) {
  if (status === 'pending') return copy.nav.myApplications;
  if (status === 'accepted') return copy.missions.assigned;
  if (status === 'rejected') return copy.common.cancel;
  return copy.nav.myApplications;
}

function missionStatusLabel(status: Mission['status'], copy: ReturnType<typeof useLocale>['copy']) {
  if (status === 'open') return copy.missions.statusOpen;
  if (status === 'assigned') return copy.missions.assigned;
  if (status === 'completed') return copy.missions.completed;
  return copy.missions.cancelled;
}

function stars(rating: number) {
  return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
}

export default function MissionApplicantsPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingMissionStatus, setUpdatingMissionStatus] = useState<Mission['status'] | null>(null);
  const [error, setError] = useState('');
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const ratingOptions = [5, 4, 3, 2, 1];

  const refreshApplications = useCallback(async (supabase = createClient()) => {
    const { data: apps } = await supabase
      .from('applications')
      .select('*, profiles:skipper_id(id, full_name)')
      .eq('mission_id', id);
    setApplications((apps as unknown as Application[]) || []);
  }, [id]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setError(extra.common.signInRequired);
        setLoading(false);
        return;
      }
      if (!isEmailVerified(user)) {
        router.replace(buildVerifyEmailPath(user.email || null, `/my-missions/${id}`));
        return;
      }
      setViewerId(user.id);

      const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setViewerRole(viewerProfile?.role ?? null);

      const { data: missionData } = await supabase.from('missions').select('*').eq('id', id).single();

      if (!missionData) {
        setMission(null);
        setLoading(false);
        return;
      }

      const isOwner = missionData.poster_id === user.id;
      const isAdmin = viewerProfile?.role === 'admin';
      if (!isOwner && !isAdmin) {
        setError(extra.common.accessDenied);
        setLoading(false);
        return;
      }

      setMission(missionData as Mission | null);
      await refreshApplications(supabase);

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('*')
        .eq('mission_id', id)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      setMyReview((existingReview as Review | null) || null);

      setLoading(false);
    })();
  }, [extra.common.accessDenied, extra.common.signInRequired, id, refreshApplications, router]);

  async function contact(skipperId: string) {
    setContactingId(skipperId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setContactingId(null); return; }
    if (!isEmailVerified(user)) {
      setContactingId(null);
      router.push(buildVerifyEmailPath(user.email || null, `/my-missions/${id}`));
      return;
    }

    const { data: missionData } = await supabase
      .from('missions')
      .select('poster_id')
      .eq('id', id)
      .single();

    if (!missionData || missionData.poster_id !== user.id) {
      setError(extra.common.accessDenied);
      setContactingId(null);
      return;
    }

    const { data: acceptedApp, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('mission_id', id)
      .eq('skipper_id', skipperId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (appError || !acceptedApp) {
      setError(appError?.message || extra.common.accessDenied);
      setContactingId(null);
      return;
    }

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('mission_id', id)
      .eq('skipper_id', skipperId)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ mission_id: id, demandeur_id: user.id, skipper_id: skipperId })
        .select()
        .single();
      if (error) { setContactingId(null); return; }
      convId = created.id;
    }
    router.push(`/messages?conversation=${convId}`);
  }

  async function updateApplicationStatus(applicationId: string, status: 'accepted' | 'rejected') {
    setError('');
    setUpdatingStatusId(applicationId);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUpdatingStatusId(null);
      setError(extra.common.signInRequired);
      return;
    }
    if (!isEmailVerified(user)) {
      setUpdatingStatusId(null);
      router.push(buildVerifyEmailPath(user.email || null, `/my-missions/${id}`));
      return;
    }

    const { data: missionGuard } = await supabase
      .from('missions')
      .select('poster_id')
      .eq('id', id)
      .single();

    if (!missionGuard || missionGuard.poster_id !== user.id) {
      setUpdatingStatusId(null);
      setError(extra.common.accessDenied);
      return;
    }

    const { error: updErr } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId)
      .select('*')
      .single();

    setUpdatingStatusId(null);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    await refreshApplications(supabase);
    const { data: missionData } = await supabase
      .from('missions')
      .select('*')
      .eq('id', id)
      .single();
    if (missionData) {
      setMission(missionData as Mission);
    }
  }

  async function updateMissionStatus(status: 'completed' | 'cancelled') {
    setError('');
    setUpdatingMissionStatus(status);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUpdatingMissionStatus(null);
      setError(extra.common.signInRequired);
      return;
    }
    if (!isEmailVerified(user)) {
      setUpdatingMissionStatus(null);
      router.push(buildVerifyEmailPath(user.email || null, `/my-missions/${id}`));
      return;
    }

    const { data: missionGuard } = await supabase
      .from('missions')
      .select('poster_id')
      .eq('id', id)
      .single();

    if (!missionGuard || missionGuard.poster_id !== user.id) {
      setUpdatingMissionStatus(null);
      setError(extra.common.accessDenied);
      return;
    }

    const { data, error: updErr } = await supabase
      .from('missions')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    setUpdatingMissionStatus(null);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    setMission(data as Mission);
  }

  async function submitReview() {
    setError('');
    if (!mission || !viewerId) return;

    const acceptedApplication = applications.find((application) => application.status === 'accepted');
    if (!acceptedApplication) {
      setError(extra.common.accessDenied);
      return;
    }

    if (mission.status !== 'completed') {
      setError(extra.common.accessDenied);
      return;
    }

    setSubmittingReview(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('reviews')
      .insert({
        mission_id: mission.id,
        reviewer_id: viewerId,
        reviewee_id: acceptedApplication.skipper_id,
        rating: Number(reviewRating),
        comment: reviewComment.trim() || null,
      })
      .select('*')
      .single();
    setSubmittingReview(false);

    if (insertError) {
      setError(insertError.code === '23505' ? extra.common.review : insertError.message);
      return;
    }

    setMyReview(data as Review);
    setReviewComment('');
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;
  if (!mission) return <main className="max-w-lg mx-auto px-6 py-10"><p>{copy.missions.noResult}</p></main>;

  const canManageMission = viewerId === mission.poster_id || viewerRole === 'admin';
  const acceptedApplication = applications.find((application) => application.status === 'accepted') || null;
  const canReview = mission.status === 'completed' && viewerId === mission.poster_id && !!acceptedApplication;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/my-missions')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> {copy.nav.myMissions}
      </button>
      <Badge>{mission.type}</Badge>
      <h1 className="font-display text-2xl font-bold mt-3 mb-1">{mission.departure}{mission.destination ? ` → ${mission.destination}` : ''}</h1>
      <p className="text-sm mb-6 text-gray-500">{applications.length} {copy.nav.myApplications.toLowerCase()}</p>
      <div className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{copy.missions.status}</span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-lightblue text-navy">{missionStatusLabel(mission.status, copy)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageMission && mission.status === 'open' && (
            <Button
              type="button"
              variant="outline"
              className="text-sm px-4 py-2"
              disabled={!!updatingMissionStatus}
              onClick={() => updateMissionStatus('cancelled')}
            >
              {updatingMissionStatus === 'cancelled' ? '...' : copy.missions.cancelled}
            </Button>
          )}
          {canManageMission && mission.status === 'assigned' && (
            <>
              <Button
                type="button"
                className="text-sm px-4 py-2"
                disabled={!!updatingMissionStatus}
                onClick={() => updateMissionStatus('completed')}
              >
                {updatingMissionStatus === 'completed' ? '...' : copy.missions.completed}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-sm px-4 py-2"
                disabled={!!updatingMissionStatus}
                onClick={() => updateMissionStatus('cancelled')}
              >
                {updatingMissionStatus === 'cancelled' ? '...' : copy.missions.cancelled}
              </Button>
            </>
          )}
        </div>
      </div>
      <ErrorBanner message={error} />

      {applications.length === 0 ? (
        <EmptyState text={copy.messages.empty} />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a.id} className="rounded-2xl p-5 bg-white border border-navy/[0.08]">
              <h4 className="font-bold text-[15px] mb-2">{a.profiles?.full_name}</h4>
              {a.status === 'accepted' && a.phone && <div className="flex items-center gap-1.5 text-xs mb-3 text-gray-500"><Phone size={12} /> {a.phone}</div>}
              {a.message && <p className="text-sm mb-3">{a.message}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-lightblue text-navy">{applicationStatusLabel(a.status, copy)}</span>
                {a.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => updateApplicationStatus(a.id, 'accepted')}
                      disabled={updatingStatusId === a.id || mission.status !== 'open'}
                      className="text-sm px-4 py-2"
                    >
                      {copy.common.yes}
                    </Button>
                    <Button
                      onClick={() => updateApplicationStatus(a.id, 'rejected')}
                      disabled={updatingStatusId === a.id || mission.status !== 'open'}
                      variant="outline"
                      className="text-sm px-4 py-2"
                    >
                      {copy.common.no}
                    </Button>
                  </>
                )}
                {a.status === 'accepted' && (
                  <Button onClick={() => contact(a.skipper_id)} disabled={contactingId === a.skipper_id} className="text-sm px-4 py-2">
                    {contactingId === a.skipper_id ? '...' : copy.messages.title}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canReview && (
        <section className="rounded-2xl p-5 mt-6 bg-white border border-navy/[0.08] space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{extra.common.review}</h2>
          {myReview ? (
            <>
              <div className="text-sm font-semibold text-navy">{stars(myReview.rating)} ({myReview.rating}/5)</div>
              {myReview.comment && <p className="text-sm text-gray-600">{myReview.comment}</p>}
              <p className="text-xs text-gray-500">{extra.common.published}</p>
            </>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">{extra.common.review}</span>
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(event.target.value)}
                  className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-sm bg-white"
                >
                  {ratingOptions.map((value) => (
                    <option key={value} value={String(value)}>{value} / 5</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-500">{copy.messages.title}</span>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2.5 text-sm min-h-[90px]"
                  placeholder={`${extra.common.review}...`}
                />
              </label>
              <Button type="button" onClick={submitReview} disabled={submittingReview} className="w-full">
                {submittingReview ? '...' : extra.common.publishReview}
              </Button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
