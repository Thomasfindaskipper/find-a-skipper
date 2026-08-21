import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardRouter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

  if (!profile) redirect('/login');

  if (profile.role === 'skipper') redirect('/dashboard/skipper');
  if (profile.role === 'admin') redirect('/dashboard/admin');
  redirect('/dashboard/demandeur');
}
