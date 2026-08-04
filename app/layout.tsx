import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'Find a Skipper',
  description: 'La plateforme qui met en relation skippers professionnels et propriétaires, brokers, sociétés de charter.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data as Profile | null;
  }

  return (
    <html lang="fr">
      <body className={`${inter.variable} ${jakarta.variable} font-sans bg-offwhite text-anthracite`}>
        <Nav profile={profile} />
        {children}
      </body>
    </html>
  );
}
