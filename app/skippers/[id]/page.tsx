'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Button, initials } from '@/components/ui';
import { formatDateForLocale } from '@/lib/i18n/format';
import { formatAvailabilitySummary, indicativeRateLabel, normalizeProfileCertifications } from '@/lib/profile';
import { resolveAvatarUrl } from '@/lib/media';
import type { Profile, Review } from '@/lib/database.types';

function stars(rating: number) {
  return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
}

type PublicReview = Review & {
  reviewer?: { full_name: string }[] | { full_name: string } | null;
};

function reviewerName(review: PublicReview) {
  if (!review.reviewer) return 'User';
  if (Array.isArray(review.reviewer)) return review.reviewer[0]?.full_name || 'User';
  return review.reviewer.full_name;
}

export default function SkipperProfilePage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [skipper, setSkipper] = useState<Profile | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [reputation, setReputation] = useState<{ average: number; count: number } | null>(null);
  const [recentReviews, setRecentReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: profileError } = await supabase.from('profiles').select('*, availability_slots(*)').eq('id', id).maybeSingle();
        if (profileError) {
          setError(profileError.message);
          setSkipper(null);
          return;
        }

        setSkipper(data as Profile | null);
        setAvatarUrl(await resolveAvatarUrl(supabase, data?.avatar_url));

        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', id);

        const ratingRows = (reviewRows as Array<{ rating: number }>) || [];
        if (ratingRows.length > 0) {
          const total = ratingRows.reduce((accumulator, row) => accumulator + row.rating, 0);
          setReputation({ average: total / ratingRows.length, count: ratingRows.length });
        } else {
          setReputation(null);
        }

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('id, mission_id, reviewer_id, reviewee_id, rating, comment, created_at, reviewer:reviewer_id(full_name)')
          .eq('reviewee_id', id)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentReviews((reviewsData as PublicReview[]) || []);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError && !/Auth session missing/i.test(userError.message)) {
          setError(userError.message);
          return;
        }

        if (user) {
          const { data: viewer, error: viewerError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
          if (viewerError) {
            setError(viewerError.message);
            return;
          }
          setViewerRole(viewer?.role ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadProfile);
      } finally {
        setLoading(false);
      }
    })();
  }, [extra.errors.loadProfile, id]);

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;
  if (error) {
    return (
      <main className="max-w-lg mx-auto px-6 py-10">
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">{error}</div>
      </main>
    );
  }
  if (!skipper) return <main className="max-w-lg mx-auto px-6 py-10"><p>{copy.skippers.noResult}</p></main>;

  const galleryUrls = skipper.gallery_urls || [];
  const certifications = normalizeProfileCertifications(skipper.certifications);
  const availabilitySummary = skipper.availability_slots?.length ? formatAvailabilitySummary(skipper.availability_slots) : skipper.availability_note;

  const isDemandeur = viewerRole && viewerRole !== 'skipper' && viewerRole !== 'admin';

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/skippers')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> {copy.skippers.title}
      </button>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 font-bold text-lg bg-navyDeep text-white overflow-hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={skipper.full_name} className="h-full w-full object-cover" />
        ) : (
          initials(skipper.full_name)
        )}
      </div>
      <h1 className="font-display text-2xl font-bold mb-1">{skipper.full_name}</h1>
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-4 bg-lightblue text-navy">
        <ShieldCheck size={12} /> {skipper.identity_verified ? copy.common.yes : copy.common.no}
      </span>
      {reputation ? (
        <p className="text-sm mb-4 text-gray-600">★ {reputation.average.toFixed(1)} ({reputation.count})</p>
      ) : (
        <p className="text-sm mb-4 text-gray-500">{copy.notifications.none}</p>
      )}

      <div className="rounded-2xl p-5 mb-6 space-y-3 bg-white border border-navy/[0.08]">
        {skipper.experience_years !== null && <Row label={copy.skippers.experience} value={`${skipper.experience_years}`} />}
        {skipper.zones?.length > 0 && <Row label={copy.skippers.zone} value={skipper.zones.join(', ')} />}
        {skipper.boat_types?.length > 0 && <Row label={copy.skippers.boatType} value={skipper.boat_types.join(', ')} />}
        {skipper.languages?.length > 0 && <Row label={copy.skippers.language} value={skipper.languages.join(', ')} />}
        {certifications.length > 0 && <Row label={copy.signup.certifications} value={certifications.map((cert) => cert.name).join(', ')} />}
        {skipper.permits && <Row label={copy.signup.permits} value={skipper.permits} />}
        {availabilitySummary && <Row label={copy.skippers.availability} value={availabilitySummary} />}
        {skipper.hourly_rate && <Row label={copy.skippers.rate} value={indicativeRateLabel(skipper.hourly_rate)} />}
      </div>

      {galleryUrls.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{copy.profile.photo}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {galleryUrls.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl border border-navy/[0.08] bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${skipper.full_name} - photo ${index + 1}`} className="h-44 w-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      {skipper.bio && <p className="text-sm mb-6 leading-relaxed">{skipper.bio}</p>}

      {recentReviews.length > 0 && (
        <section className="rounded-2xl p-5 mb-6 bg-white border border-navy/[0.08]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{extra.common.review}</h2>
          <div className="space-y-3">
            {recentReviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-navy/[0.06] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-navy">{stars(review.rating)} ({review.rating}/5)</p>
                  <p className="text-xs text-gray-500">{formatDateForLocale(review.created_at, locale)}</p>
                </div>
                {review.comment && <p className="text-sm mt-1 text-gray-700">{review.comment}</p>}
                <p className="text-xs mt-1 text-gray-500">{reviewerName(review)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {isDemandeur ? (
        <Button onClick={() => router.push('/missions/new')} className="w-full">{copy.nav.publishMission}</Button>
      ) : (
        <Button onClick={() => router.push('/signup?role=owner')} className="w-full">{copy.signup.title}</Button>
      )}
      <p className="text-xs text-center mt-2 text-gray-500">{copy.messages.verifyFirst}</p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
