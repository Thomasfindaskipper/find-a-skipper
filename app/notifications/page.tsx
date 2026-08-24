'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, EmptyState } from '@/components/ui';
import type { Notification } from '@/lib/database.types';

function labelForType(type: string) {
  if (type === 'application_created') return 'Nouvelle candidature';
  if (type === 'application_accepted') return 'Candidature acceptée';
  if (type === 'application_rejected') return 'Candidature refusée';
  if (type === 'mission_assigned') return 'Mission assignée';
  if (type === 'mission_status_changed') return 'Statut mission modifié';
  if (type === 'message_new') return 'Nouveau message';
  return 'Notification';
}

function messageForNotification(n: Notification) {
  const payload = (n.payload || {}) as Record<string, unknown>;
  const missionId = typeof payload.mission_id === 'string' ? payload.mission_id : null;
  const status = typeof payload.new_status === 'string' ? payload.new_status : null;

  if (n.type === 'application_created') {
    return missionId ? `Un skipper a postule a votre mission (${missionId.slice(0, 8)}...).` : 'Un skipper a postule a votre mission.';
  }
  if (n.type === 'application_accepted') {
    return missionId ? `Votre candidature a ete acceptee (${missionId.slice(0, 8)}...).` : 'Votre candidature a ete acceptee.';
  }
  if (n.type === 'application_rejected') {
    return missionId ? `Votre candidature a ete refusee (${missionId.slice(0, 8)}...).` : 'Votre candidature a ete refusee.';
  }
  if (n.type === 'mission_assigned') {
    return missionId ? `Vous avez ete assigne a une mission (${missionId.slice(0, 8)}...).` : 'Vous avez ete assigne a une mission.';
  }
  if (n.type === 'mission_status_changed') {
    return status ? `Le statut de la mission est maintenant ${status}.` : 'Le statut de la mission a change.';
  }
  if (n.type === 'message_new') {
    return 'Vous avez recu un nouveau message.';
  }
  return 'Nouvelle notification.';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRows([]);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          setRows([]);
          return;
        }

        setRows((data as Notification[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossible de charger les notifications.');
        setRows([]);
      }
    })();
  }, []);

  const unreadCount = useMemo(() => (rows || []).filter((n) => !n.read).length, [rows]);

  async function markAsRead(id: string) {
    setMarkingId(id);
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('read', false)
      .select('id')
      .single();

    setMarkingId(null);

    if (updErr && updErr.code !== 'PGRST116') {
      setError(updErr.message);
      return;
    }

    setRows((prev) => (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-1">Notifications</h1>
      <p className="mb-8 text-gray-500">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>

      {rows === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>
      ) : error ? (
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">
          Impossible de charger vos notifications. {error}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState text="Aucune notification pour l'instant." />
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <article key={n.id} className={`rounded-2xl p-5 bg-white border ${n.read ? 'border-navy/[0.08]' : 'border-navy/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-sm">{labelForType(n.type)}</h2>
                  <p className="text-sm text-gray-600 mt-1">{messageForNotification(n)}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs px-3 py-1.5"
                    disabled={markingId === n.id}
                    onClick={() => markAsRead(n.id)}
                  >
                    {markingId === n.id ? '...' : 'Marquer comme lu'}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
