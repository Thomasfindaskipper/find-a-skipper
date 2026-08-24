'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui';
import type { Profile, VerificationDocument, VerificationRequest, VerificationStatus } from '@/lib/database.types';

type RequestRow = VerificationRequest & {
  profiles?: Pick<Profile, 'id' | 'full_name' | 'role' | 'identity_verified'>;
  verification_documents?: VerificationDocument[];
};

function statusLabel(status: VerificationStatus) {
  if (status === 'draft') return 'Brouillon';
  if (status === 'submitted') return 'Soumise';
  if (status === 'approved') return 'Approuvee';
  return 'Refusee';
}

export default function AdminVerificationReviewPage() {
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
        setError(err instanceof Error ? err.message : 'Impossible de charger les demandes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const pendingRows = useMemo(() => rows.filter((r) => r.status === 'submitted'), [rows]);

  async function updateStatus(row: RequestRow, nextStatus: 'approved' | 'rejected') {
    setError('');
    setUpdatingId(row.id);
    const supabase = createClient();

    const reason = (reasons[row.id] || '').trim();
    if (nextStatus === 'rejected' && !reason) {
      setUpdatingId(null);
      setError('Merci de saisir une raison de refus.');
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
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Verification des profils</h1>
      <p className="mb-6 text-gray-500">{pendingRows.length} demande{pendingRows.length !== 1 ? 's' : ''} en attente</p>
      <ErrorBanner message={error} />

      {rows.length === 0 ? (
        <div className="rounded-2xl p-5 bg-white border border-navy/[0.08] text-sm text-gray-500">Aucune demande pour le moment.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <section key={row.id} className="rounded-2xl p-5 bg-white border border-navy/[0.08]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-base">{row.profiles?.full_name || row.user_id}</h2>
                  <p className="text-sm text-gray-500">Role: {row.profiles?.role || 'inconnu'}</p>
                  <p className="text-xs text-gray-500 mt-1">Statut: {statusLabel(row.status)}</p>
                </div>
                <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${row.profiles?.identity_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-lightblue text-navy'}`}>
                  {row.profiles?.identity_verified ? 'Verifie' : 'Non verifie'}
                </div>
              </div>

              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-2">Justificatifs</h3>
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
                          Ouvrir
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Aucun document depose.</p>
                )}
              </div>

              {row.status === 'submitted' && (
                <div className="space-y-3">
                  <Field label="Raison de refus (obligatoire si refus)">
                    <TextInput value={reasons[row.id] || ''} onChange={(e) => setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="button" disabled={updatingId === row.id} onClick={() => updateStatus(row, 'approved')}>
                      {updatingId === row.id ? 'Mise a jour...' : 'Approuver'}
                    </Button>
                    <Button type="button" variant="outline" disabled={updatingId === row.id} onClick={() => updateStatus(row, 'rejected')}>
                      {updatingId === row.id ? 'Mise a jour...' : 'Refuser'}
                    </Button>
                  </div>
                </div>
              )}

              {row.status === 'rejected' && row.rejection_reason && (
                <p className="text-sm text-red-700 mt-2">Motif: {row.rejection_reason}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
