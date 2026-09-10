'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Badge, EmptyState, Button } from '@/components/ui';
import type { Application, Review } from '@/lib/database.types';

function stars(rating: number) {
  return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
}

export default function MyApplicationsPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const statusLabel = (status: Application['status']) => {
    if (status === 'pending') return copy.nav.myApplications;
    if (status === 'accepted') return copy.missions.assigned;
    if (status === 'rejected') return copy.common.cancel;
    return copy.nav.myApplications;
  };
  const [rows, setRows] = useState<Application[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reviewsByMission, setReviewsByMission] = useState<Record<string, Review>>({});
  const [reviewRatings, setReviewRatings] = useState<Record<string, string>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [submittingReviewMissionId, setSubmittingReviewMissionId] = useState<string | null>(null);
  const ratingOptions = [5, 4, 3, 2, 1];

  const fetchApplications = useCallback(async (targetUserId: string, supabase = createClient()) => {
    const { data, error: fetchError } = await supabase
      .from('applications')
      .select('*, missions(*)')
      .eq('skipper_id', targetUserId)
      .order('applied_at', { ascending: false });

    if (fetchError) {
      setLoadError(fetchError.message);
      setRows([]);
      return;
    }

    setLoadError('');
    const nextRows = (data as unknown as Application[]) || [];
    setRows(nextRows);

    const missionIds = nextRows.map((row) => row.mission_id);
    if (missionIds.length === 0) {
      setReviewsByMission({});
      return;
    }

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewer_id', targetUserId)
      .in('mission_id', missionIds);

    const nextReviews = ((reviewRows as Review[]) || []).reduce<Record<string, Review>>((accumulator, review) => {
      accumulator[review.mission_id] = review;
      return accumulator;
    }, {});
    setReviewsByMission(nextReviews);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRows([]);
          return;
        }
        setUserId(user.id);
        await fetchApplications(user.id, supabase);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : extra.errors.loadApplications);
        setRows([]);
      }
    })();
  }, [extra.errors.loadApplications, fetchApplications]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`my-applications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `skipper_id=eq.${userId}` }, async () => {
        await fetchApplications(userId, supabase);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchApplications]);

  async function cancelApplication(application: Application) {
    if (application.status !== 'pending') return;

    const confirmed = window.confirm(`${copy.common.cancel}?`);
    if (!confirmed) return;

    setActionError('');
    setCancellingId(application.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setCancellingId(null);
      setActionError(extra.common.signInRequired);
      return;
    }

    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', application.id)
      .eq('skipper_id', user.id)
      .eq('status', 'pending');

    setCancellingId(null);

    if (deleteError) {
      setActionError(deleteError.message);
      return;
    }

    setRows((prev) => (prev || []).filter((row) => row.id !== application.id));
  }

  async function submitReview(application: Application) {
    if (!userId || !application.missions || application.status !== 'accepted' || application.missions.status !== 'completed') return;

    const revieweeId = application.missions.poster_id;
    const missionId = application.mission_id;
    const rating = Number(reviewRatings[missionId] || '5');
    const comment = (reviewComments[missionId] || '').trim();

    setActionError('');
    setSubmittingReviewMissionId(missionId);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('reviews')
      .insert({
        mission_id: missionId,
        reviewer_id: userId,
        reviewee_id: revieweeId,
        rating,
        comment: comment || null,
      })
      .select('*')
      .single();

    setSubmittingReviewMissionId(null);

    if (insertError) {
      setActionError(insertError.code === '23505' ? extra.common.review : insertError.message);
      return;
    }

    const createdReview = data as Review;
    setReviewsByMission((current) => ({ ...current, [missionId]: createdReview }));
    setReviewComments((current) => ({ ...current, [missionId]: '' }));
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{copy.nav.myApplications}</h1>
      <p className="mb-8 text-gray-500">{rows ? rows.length : '…'} {copy.missions.title.toLowerCase()}</p>

      {actionError && (
        <div className="rounded-2xl p-5 mb-6 bg-white border border-red-200 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {rows === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>
      ) : loadError ? (
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState text={copy.missions.noResult} actionLabel={copy.missions.title} actionHref="/missions" />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="rounded-2xl p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border border-navy/[0.08]">
              <div>
                <div className="mb-1"><Badge>{a.missions!.type}</Badge></div>
                <h4 className="font-bold text-[15px]">{a.missions!.departure}{a.missions!.destination ? ` → ${a.missions!.destination}` : ''}</h4>
                <div className="text-xs text-gray-500">{a.missions!.zone} · {a.missions!.start_date}</div>
                <div className="text-xs text-gray-500 mt-1">{copy.missions.status}: {a.missions!.status}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-lightblue text-navy">{statusLabel(a.status)}</span>
                <Link href={`/missions/${a.mission_id}`}>
                  <Button type="button" variant="outline" className="text-sm px-4 py-2">{copy.missions.title}</Button>
                </Link>
                {a.status === 'pending' && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-sm px-4 py-2"
                    disabled={cancellingId === a.id}
                    onClick={() => cancelApplication(a)}
                  >
                    {cancellingId === a.id ? '...' : copy.common.cancel}
                  </Button>
                )}
              </div>

              {a.status === 'accepted' && a.missions?.status === 'completed' && (
                <div className="w-full rounded-xl border border-navy/[0.08] bg-white/70 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{extra.common.review}</div>
                  {reviewsByMission[a.mission_id] ? (
                    <>
                      <div className="text-sm font-semibold text-navy">{stars(reviewsByMission[a.mission_id].rating)} ({reviewsByMission[a.mission_id].rating}/5)</div>
                      {reviewsByMission[a.mission_id].comment && <p className="text-sm text-gray-600 mt-1">{reviewsByMission[a.mission_id].comment}</p>}
                      <p className="text-xs text-gray-500 mt-1">{extra.common.published}</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={reviewRatings[a.mission_id] || '5'}
                        onChange={(event) => setReviewRatings((current) => ({ ...current, [a.mission_id]: event.target.value }))}
                        className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2 text-sm bg-white"
                      >
                        {ratingOptions.map((value) => (
                          <option key={value} value={String(value)}>{value} / 5</option>
                        ))}
                      </select>
                      <textarea
                        value={reviewComments[a.mission_id] || ''}
                        onChange={(event) => setReviewComments((current) => ({ ...current, [a.mission_id]: event.target.value }))}
                        className="w-full border border-gray-200 rounded-[10px] px-3.5 py-2 text-sm min-h-[80px]"
                        placeholder={`${extra.common.review}...`}
                      />
                      <Button
                        type="button"
                        className="text-sm px-4 py-2"
                        disabled={submittingReviewMissionId === a.mission_id}
                        onClick={() => submitReview(a)}
                      >
                        {submittingReviewMissionId === a.mission_id ? '...' : extra.common.publishReview}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
