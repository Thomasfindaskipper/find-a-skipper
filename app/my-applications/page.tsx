'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Badge, Button, EmptyState, ErrorBanner } from '@/components/ui';
import type { Application } from '@/lib/database.types';

function statusLabel(status: Application['status']) {
  if (status === 'pending') return 'Candidature envoyée';
  if (status === 'accepted') return 'Candidature acceptée';
  if (status === 'rejected') return 'Candidature refusée';
  return 'Candidature retirée';
}

export default function MyApplicationsPage() {
  const [rows, setRows] = useState<Application[] | null>(null);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('*, missions(*)')
        .eq('skipper_id', user.id)
        .order('applied_at', { ascending: false });
      setRows((data as unknown as Application[]) || []);
    })();
  }, []);

  async function withdraw(applicationId: string) {
    setError('');
    setUpdatingId(applicationId);
    const supabase = createClient();
    const { data, error: updErr } = await supabase
      .from('applications')
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .select('*')
      .single();
    setUpdatingId(null);
    if (updErr) {
      setError(updErr.message);
      return;
    }

    setRows((prev) => {
      if (!prev) return prev;
      return prev.map((row) => (row.id === applicationId ? { ...row, ...(data as Application) } : row));
    });
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Mes candidatures</h1>
      <p className="mb-8 text-gray-500">{rows ? rows.length : '…'} mission{rows?.length !== 1 ? 's' : ''} suivie{rows?.length !== 1 ? 's' : ''}</p>
      <ErrorBanner message={error} />

      {rows === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : rows.length === 0 ? (
        <EmptyState text="Vous n'avez pas encore postulé à une mission." actionLabel="Voir les missions" actionHref="/missions" />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="rounded-2xl p-5 flex items-center justify-between bg-white border border-navy/[0.08]">
              <div>
                <div className="mb-1"><Badge>{a.missions!.type}</Badge></div>
                <h4 className="font-bold text-[15px]">{a.missions!.departure}{a.missions!.destination ? ` → ${a.missions!.destination}` : ''}</h4>
                <div className="text-xs text-gray-500">{a.missions!.zone} · {a.missions!.start_date}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-lightblue text-navy">{statusLabel(a.status)}</span>
                {a.status === 'pending' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs px-3 py-1.5"
                    disabled={updatingId === a.id}
                    onClick={() => withdraw(a.id)}
                  >
                    Retirer
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
