'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { formatDateTimeForLocale } from '@/lib/i18n/format';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { Button, EmptyState } from '@/components/ui';
import type { Notification } from '@/lib/database.types';

function labelForType(type: string, labels: ReturnType<typeof getExtraCopy>['notifications']) {
  if (type === 'new_application') return labels.newApplication;
  if (type === 'application_accepted') return labels.applicationAccepted;
  if (type === 'application_rejected') return labels.applicationRejected;
  if (type === 'mission_assigned') return labels.missionAssigned;
  if (type === 'mission_status_changed') return labels.missionStatusChanged;
  if (type === 'new_message') return labels.newMessage;
  return labels.generic;
}

function messageForNotification(n: Notification, notifications: ReturnType<typeof getExtraCopy>['notifications']) {
  const payload = (n.payload || {}) as Record<string, unknown>;
  const missionId = typeof payload.mission_id === 'string' ? payload.mission_id : null;
  const status = typeof payload.new_status === 'string' ? payload.new_status : null;
  const shortMissionId = missionId ? ` (${missionId.slice(0, 8)}...)` : '';

  if (n.type === 'new_application') return `${notifications.msgNewApplication}${shortMissionId}.`;
  if (n.type === 'application_accepted') return `${notifications.msgApplicationAccepted}${shortMissionId}.`;
  if (n.type === 'application_rejected') return `${notifications.msgApplicationRejected}${shortMissionId}.`;
  if (n.type === 'mission_assigned') return `${notifications.msgMissionAssigned}${shortMissionId}.`;
  if (n.type === 'mission_status_changed') return status ? `${notifications.msgMissionStatusNow} ${status}.` : notifications.msgMissionStatusChanged;
  if (n.type === 'new_message') return notifications.msgNewMessage;
  return notifications.msgGeneric;
}

export default function NotificationsPage() {
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
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
        setError(err instanceof Error ? err.message : extra.errors.loadNotifications);
        setRows([]);
      }
    })();
  }, [extra.errors.loadNotifications]);

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
      <h1 className="font-display text-3xl font-bold mb-1">{copy.notifications.title}</h1>
      <p className="mb-8 text-gray-500">{unreadCount} {unreadCount > 1 ? copy.notifications.unreadPlural : copy.notifications.unread}</p>

      {rows === null ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>
      ) : error ? (
        <div className="rounded-2xl p-5 bg-white border border-red-200 text-sm text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState text={copy.notifications.none} />
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <article key={n.id} className={`rounded-2xl p-5 bg-white border ${n.read ? 'border-navy/[0.08]' : 'border-navy/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-sm">{labelForType(n.type, extra.notifications)}</h2>
                  <p className="text-sm text-gray-600 mt-1">{messageForNotification(n, extra.notifications)}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatDateTimeForLocale(n.created_at, locale)}</p>
                </div>
                {!n.read && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs px-3 py-1.5"
                    disabled={markingId === n.id}
                    onClick={() => markAsRead(n.id)}
                  >
                    {markingId === n.id ? '...' : copy.notifications.markRead}
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
