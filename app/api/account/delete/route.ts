import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || null;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 });
  }

  const serviceRoleKey = getServiceRoleKey();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: 'Suppression indisponible: variable serveur SUPABASE_SERVICE_ROLE_KEY manquante.' },
      { status: 503 }
    );
  }

  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey);
  const { error } = await adminClient.auth.admin.deleteUser(user.id, false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
