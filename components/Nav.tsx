'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useLocale } from '@/components/LocaleProvider';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/database.types';

const dashboardHref = (role: string) =>
  role === 'skipper' ? '/dashboard/skipper' : role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';

export default function Nav({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { copy } = useLocale();
  const isGuestHome = !profile && pathname === '/';
  const showGuestActions = !profile && !isGuestHome;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const links = profile
    ? [
        { href: dashboardHref(profile.role), label: copy.nav.dashboard },
        { href: '/skippers', label: copy.nav.skippers },
        ...(profile.role === 'skipper'
          ? [
              { href: '/missions', label: copy.nav.missions },
              { href: '/my-applications', label: copy.nav.myApplications },
            ]
          : [
              { href: '/missions/new', label: copy.nav.publishMission },
              { href: '/my-missions', label: copy.nav.myMissions },
            ]),
        { href: '/notifications', label: copy.nav.notifications },
        { href: '/messages', label: copy.nav.messages },
        { href: '/profile', label: copy.nav.profile },
      ]
    : isGuestHome
      ? []
      : [{ href: '/skippers', label: copy.nav.skippers }];

  return (
    <header className="border-b border-navy/[0.08] bg-offwhite/95 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
        <BrandLogo className="shrink-0" />

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-lightblue">
              {l.label}
            </Link>
          ))}
          {profile ? (
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-semibold ml-2 text-gray-500">
              <LogOut size={14} /> {copy.nav.logout}
            </button>
          ) : showGuestActions ? (
            <>
              <Link href="/login" className="text-sm font-semibold px-3.5 py-2 text-gray-500">{copy.nav.login}</Link>
              <Link href="/signup?role=skipper" className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-navyDeep text-white">
                {copy.nav.skipperCta}
              </Link>
            </>
          ) : null}
          <div className="ml-2">
            <LocaleSwitcher />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LocaleSwitcher />
          {(profile || links.length > 0 || showGuestActions) && (
            <button className="md:hidden" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
          )}
        </div>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-4 flex flex-col gap-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-semibold py-2">
              {l.label}
            </Link>
          ))}
          {profile ? (
            <button onClick={handleLogout} className="text-left text-sm font-semibold py-2 text-gray-500">{copy.nav.logout}</button>
          ) : showGuestActions ? (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-semibold py-2 text-gray-500">{copy.nav.login}</Link>
              <Link href="/signup?role=skipper" onClick={() => setOpen(false)} className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center bg-navyDeep text-white">
                {copy.nav.skipperCta}
              </Link>
            </>
          ) : null}
          <div className="pt-2">
            <LocaleSwitcher />
          </div>
        </div>
      )}
    </header>
  );
}
