'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/database.types';

const dashboardHref = (role: string) =>
  role === 'skipper' ? '/dashboard/skipper' : role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';

export default function Nav({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const links = profile
    ? [
        { href: dashboardHref(profile.role), label: 'Tableau de bord' },
        { href: '/skippers', label: 'Skippers' },
        ...(profile.role === 'skipper'
          ? [
              { href: '/missions', label: 'Missions' },
              { href: '/my-applications', label: 'Mes candidatures' },
            ]
          : [
              { href: '/missions/new', label: 'Publier une mission' },
              { href: '/my-missions', label: 'Mes missions' },
            ]),
        { href: '/notifications', label: 'Notifications' },
        { href: '/messages', label: 'Messages' },
        { href: '/profile', label: 'Mon profil' },
      ]
    : [{ href: '/skippers', label: 'Skippers' }];

  return (
    <header className="border-b border-navy/[0.08] bg-offwhite/95 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex items-center justify-center rounded-xl p-1 bg-lightblue">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Find a Skipper" className="h-[42px] w-[42px] rounded-[10px] object-cover" />
          </span>
          <span className="font-display font-bold text-lg text-navy">Find a Skipper</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-lightblue">
              {l.label}
            </Link>
          ))}
          {profile ? (
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-semibold ml-2 text-gray-500">
              <LogOut size={14} /> Déconnexion
            </button>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold px-3.5 py-2 text-gray-500">Connexion</Link>
              <Link href="/signup?role=skipper" className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-navyDeep text-white">
                Je suis skipper
              </Link>
            </>
          )}
        </nav>

        <button className="md:hidden" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-4 flex flex-col gap-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-semibold py-2">
              {l.label}
            </Link>
          ))}
          {profile ? (
            <button onClick={handleLogout} className="text-left text-sm font-semibold py-2 text-gray-500">Déconnexion</button>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-semibold py-2 text-gray-500">Connexion</Link>
              <Link href="/signup?role=skipper" onClick={() => setOpen(false)} className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center bg-navyDeep text-white">
                Je suis skipper
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
