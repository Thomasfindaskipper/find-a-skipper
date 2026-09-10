'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { localizeRole } from '@/lib/i18n/options';
import { createClient } from '@/lib/supabase/client';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui';
import type { Profile, VerificationDocument, VerificationRequest } from '@/lib/database.types';

type RequestRow = VerificationRequest & {
  profiles?: Pick<Profile, 'id' | 'full_name' | 'role' | 'identity_verified'>;
  verification_documents?: VerificationDocument[];
};

export default function AdminVerificationReviewPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          router.replace('/login?next=/dashboard/admin/verifications');
          return;
        }

        const { data: me } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
        if (me?.role !== 'admin') {
          router.replace('/dashboard');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('verification_requests')
          .select('*, profiles:user_id(id, full_name, role, identity_verified), verification_documents(*)')
          .order('updated_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          setRows([]);
          setLoading(false);
          return;
        }

        setRows((data as unknown as RequestRow[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadRequests);
      } finally {
        setLoading(false);
      }
    })();
  }, [extra.errors.loadRequests, router]);

  const pendingRows = useMemo(() => rows.filter((r) => r.status === 'submitted'), [rows]);

  async function updateStatus(row: RequestRow, nextStatus: 'approved' | 'rejected') {
    setError('');
    setUpdatingId(row.id);
    const supabase = createClient();

    const reason = (reasons[row.id] || '').trim();
    if (nextStatus === 'rejected' && !reason) {
      setUpdatingId(null);
      setError(extra.profile.latestRejection);
      return;
    }

    const payload = {
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      rejection_reason: nextStatus === 'rejected' ? reason : null,
    };

    const { data: auth } = await supabase.auth.getUser();
    const { data, error: updErr } = await supabase
      .from('verification_requests')
      .update({ ...payload, reviewed_by: auth.user?.id ?? null })
      .eq('id', row.id)
      .select('*, profiles:user_id(id, full_name, role, identity_verified), verification_documents(*)')
      .single();

    setUpdatingId(null);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === row.id ? (data as unknown as RequestRow) : r)));
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">{extra.profile.verificationTitle}</h1>
      <p className="mb-6 text-gray-500">{pendingRows.length}</p>
      <ErrorBanner message={error} />

      {rows.length === 0 ? (
        <div className="rounded-2xl p-5 bg-white border border-navy/[0.08] text-sm text-gray-500">{copy.notifications.none}</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <section key={row.id} className="rounded-2xl p-5 bg-white border border-navy/[0.08]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-base">{row.profiles?.full_name || row.user_id}</h2>
                  <p className="text-sm text-gray-500">{copy.nav.dashboard}: {row.profiles?.role ? localizeRole(row.profiles.role, locale) : copy.common.no}</p>
                  <p className="text-xs text-gray-500 mt-1">{copy.missions.status}: {row.status}</p>
                </div>
                <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${row.profiles?.identity_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-lightblue text-navy'}`}>
                  {row.profiles?.identity_verified ? copy.common.yes : copy.common.no}
                </div>
              </div>

              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-2">{extra.profile.uploadDocument}</h3>
                {row.verification_documents && row.verification_documents.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {row.verification_documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-navy/[0.08]">
                        <span>{doc.doc_type}</span>
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            const supabase = createClient();
                            const { data } = await supabase.storage.from('verification-documents').createSignedUrl(doc.storage_path, 120);
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-xs font-semibold text-navy underline"
                        >
                          {extra.common.open}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{extra.common.noUploadedDocuments}</p>
                )}
              </div>

              {row.status === 'submitted' && (
                <div className="space-y-3">
                  <Field label={extra.profile.latestRejection}>
                    <TextInput value={reasons[row.id] || ''} onChange={(e) => setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="button" disabled={updatingId === row.id} onClick={() => updateStatus(row, 'approved')}>
                      {updatingId === row.id ? '...' : copy.common.yes}
                    </Button>
                    <Button type="button" variant="outline" disabled={updatingId === row.id} onClick={() => updateStatus(row, 'rejected')}>
                      {updatingId === row.id ? '...' : copy.common.no}
                    </Button>
                  </div>
                </div>
              )}

              {row.status === 'rejected' && row.rejection_reason && (
                <p className="text-sm text-red-700 mt-2">{extra.profile.latestRejection}: {row.rejection_reason}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
