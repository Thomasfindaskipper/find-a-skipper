import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import LegalFooter from '@/components/LegalFooter';
import { LocaleProvider } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';
import { getRequestCopy, getRequestLocale } from '@/lib/i18n/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-jakarta' });

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getRequestCopy();

  return {
    title: {
      default: copy.brand.name,
      template: `%s | ${copy.brand.name}`,
    },
    description: copy.brand.description,
    icons: {
      icon: '/logo.png',
      shortcut: '/logo.png',
      apple: '/logo.png',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data as Profile | null;
  }

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${jakarta.variable} font-sans bg-offwhite text-anthracite`}>
        <LocaleProvider initialLocale={locale}>
          <div className="min-h-screen flex flex-col">
            <Nav profile={profile} />
            <div className="flex-1">{children}</div>
            <LegalFooter />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
