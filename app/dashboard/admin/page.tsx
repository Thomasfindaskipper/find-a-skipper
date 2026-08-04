import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-center">
      <ShieldAlert size={36} className="text-navyDeep mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold mb-2">Espace administrateur</h1>
      <p className="text-sm text-gray-500">
        Cette interface n&apos;est pas encore développée. Le schéma de la base de données est déjà prêt pour :
        vérifier les skippers, gérer les signalements, mettre en avant des missions, et consulter des statistiques.
      </p>
    </main>
  );
}
