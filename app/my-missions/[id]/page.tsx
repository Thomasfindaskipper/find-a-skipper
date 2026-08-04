'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Badge, Button, EmptyState } from '@/components/ui';
import type { Application, Mission } from '@/lib/database.types';

export default function MissionApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: missionData } = await supabase.from('missions').select('*').eq('id', id).single();
      setMission(missionData as Mission | null);
      const { data: apps } = await supabase
        .from('applications')
        .select('*, profiles:skipper_id(id, full_name)')
        .eq('mission_id', id);
      setApplications((apps as unknown as Application[]) || []);
      setLoading(false);
    })();
  }, [id]);

  async function contact(skipperId: string) {
    setContactingId(skipperId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;
  if (!mission) return <main className="max-w-lg mx-auto px-6 py-10"><p>Mission introuvable.</p></main>;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/my-missions')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> Retour à mes missions
      </button>
      <Badge>{mission.type}</Badge>
      <h1 className="font-display text-2xl font-bold mt-3 mb-1">{mission.departure}{mission.destination ? ` → ${mission.destination}` : ''}</h1>
      <p className="text-sm mb-6 text-gray-500">{applications.length} candidature{applications.length !== 1 ? 's' : ''} reçue{applications.length !== 1 ? 's' : ''}</p>

      {applications.length === 0 ? (
        <EmptyState text="Aucune candidature pour l'instant." />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a.id} className="rounded-2xl p-5 bg-white border border-navy/[0.08]">
              <h4 className="font-bold text-[15px] mb-2">{a.profiles?.full_name}</h4>
              {a.phone && <div className="flex items-center gap-1.5 text-xs mb-3 text-gray-500"><Phone size={12} /> {a.phone}</div>}
              {a.message && <p className="text-sm mb-3">{a.message}</p>}
              <Button onClick={() => contact(a.skipper_id)} disabled={contactingId === a.skipper_id} className="text-sm px-4 py-2">
                {contactingId === a.skipper_id ? 'Ouverture...' : 'Contacter'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
