'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, initials } from '@/components/ui';
import type { Profile } from '@/lib/database.types';

export default function SkipperProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [skipper, setSkipper] = useState<Profile | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
      setSkipper(data as Profile | null);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: viewer } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setViewerRole(viewer?.role ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;
  if (!skipper) return <main className="max-w-lg mx-auto px-6 py-10"><p>Profil introuvable.</p></main>;

  const isDemandeur = viewerRole && viewerRole !== 'skipper' && viewerRole !== 'admin';

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <button onClick={() => router.push('/skippers')} className="text-sm font-semibold mb-4 flex items-center gap-1 text-gray-500">
        <ArrowLeft size={14} /> Retour à l&apos;annuaire
      </button>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 font-bold text-lg bg-navyDeep text-white overflow-hidden">
        {skipper.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={skipper.avatar_url} alt={skipper.full_name} className="h-full w-full object-cover" />
        ) : (
          initials(skipper.full_name)
        )}
      </div>
      <h1 className="font-display text-2xl font-bold mb-1">{skipper.full_name}</h1>
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-4 bg-lightblue text-navy">
        <ShieldCheck size={12} /> {skipper.identity_verified ? 'Profil vérifié' : 'Profil skipper'}
      </span>

      <div className="rounded-2xl p-5 mb-6 space-y-3 bg-white border border-navy/[0.08]">
        {skipper.avatar_url && <Row label="Photo" value={skipper.avatar_url} />}
        {skipper.experience_years && <Row label="Expérience" value={`${skipper.experience_years} ans`} />}
        {skipper.zones?.length > 0 && <Row label="Zones" value={skipper.zones.join(', ')} />}
        {skipper.boat_types?.length > 0 && <Row label="Bateaux" value={skipper.boat_types.join(', ')} />}
        {skipper.languages?.length > 0 && <Row label="Langues" value={skipper.languages.join(', ')} />}
        {skipper.certifications?.length > 0 && <Row label="Certifications" value={skipper.certifications.map((cert) => cert.name).join(', ')} />}
        {skipper.permits && <Row label="Permis" value={skipper.permits} />}
        {skipper.availability_note && <Row label="Disponibilité" value={skipper.availability_note} />}
        {skipper.hourly_rate && <Row label="Tarif" value={skipper.hourly_rate} />}
      </div>

      {skipper.bio && <p className="text-sm mb-6 leading-relaxed">{skipper.bio}</p>}

      {isDemandeur ? (
        <Button onClick={() => router.push('/missions/new')} className="w-full">Publier une mission pour ce skipper</Button>
      ) : (
        <Button onClick={() => router.push('/signup?role=owner')} className="w-full">Créer un compte pour contacter ce skipper</Button>
      )}
      <p className="text-xs text-center mt-2 text-gray-500">Les coordonnées ne sont visibles qu&apos;après candidature à une mission.</p>
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
