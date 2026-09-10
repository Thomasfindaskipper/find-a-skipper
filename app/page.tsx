import Link from 'next/link';
import { MapPin, ShieldCheck, MessageCircle, Calendar, Globe2, Waves, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';
import { getRequestCopy } from '@/lib/i18n/server';

export default async function HomePage() {
  const supabase = await createClient();
  const copy = await getRequestCopy();
  const { data: { user } } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data as Profile | null;
  }

  const primaryHref = profile?.role === 'skipper' ? '/missions' : profile ? '/missions/new' : '/signup?role=skipper';
  const primaryLabel = profile?.role === 'skipper' ? copy.home.primaryCtaSkipper : copy.home.primaryCtaGuest;
  const secondaryHref = profile && profile.role !== 'skipper' ? '/missions/new' : '/signup?role=owner';
  const whyCards = [ShieldCheck, MessageCircle, Calendar, MapPin].map((icon, index) => ({
    icon,
    title: copy.home.whyCards[index][0],
    description: copy.home.whyCards[index][1],
  }));
  const heroPills = [
    { icon: Globe2, label: copy.home.heroPills[0] },
    { icon: Compass, label: copy.home.heroPills[1] },
    { icon: Waves, label: copy.home.heroPills[2] },
  ];

  return (
    <>
      <section
        className="relative overflow-hidden px-6 pt-24 pb-14 text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(7,28,52,0.82) 0%, rgba(11,37,69,0.62) 35%, rgba(13,78,112,0.28) 100%), url('/hero-boat.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 42%',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(186,220,255,0.16),transparent_26%)]" />
        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-3xl rounded-[32px] border border-white/12 bg-white/8 p-8 shadow-[0_24px_80px_rgba(7,28,52,0.28)] backdrop-blur-sm md:p-12 fade-in">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 mb-5">
              {copy.home.eyebrow}
            </div>
            <h1 className="font-display font-bold text-[40px] leading-[1.02] md:text-[62px] max-w-2xl mb-5" style={{ textShadow: '0 2px 18px rgba(0,0,0,0.28)' }}>
              {copy.home.title}
            </h1>
            <p className="max-w-xl mb-8 text-[16px] leading-7 text-white/86 md:text-[18px]">
              {copy.home.description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href={primaryHref} className="font-bold px-7 py-3.5 rounded-xl w-full sm:w-auto text-center bg-navyDeep text-white shadow-lg shadow-black/15">
                {primaryLabel}
              </Link>
              <Link href={secondaryHref} className="font-bold px-7 py-3.5 rounded-xl w-full sm:w-auto text-center bg-white text-navyDeep border border-white/30">
                {copy.home.secondaryCta}
              </Link>
            </div>
            {!profile && (
              <div className="mt-3">
                <Link href="/login" className="inline-flex text-sm font-semibold text-white/88 hover:text-white">
                  {copy.home.loginCta}
                </Link>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-2.5">
              {heroPills.map(({ icon: IconComp, label }) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-white/88">
                  <IconComp size={14} /> {label}
                </span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-medium flex-wrap text-white/78">
              <MapPin size={15} /> {copy.home.speedStrip}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pt-14 pb-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold mb-2">{copy.home.whyTitle.trim()}</h2>
          <p className="text-sm text-gray-500">{copy.home.whyDescription}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {whyCards.map(({ icon: IconComp, title, description }, i) => {
            return (
              <div key={i} className={`flex items-start gap-3 rounded-3xl p-5 lift-card fade-in fade-in-${i + 1} bg-white border border-navy/[0.08] shadow-[0_18px_40px_rgba(11,37,69,0.06)]`}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-lightblue">
                  <IconComp size={17} className="text-navyDeep" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] mb-1">{title}</h3>
                  <p className="text-sm text-gray-500">{description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-20 bg-[linear-gradient(180deg,#e6f0f8_0%,#f8fbfd_100%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-2xl font-bold">{copy.home.worldTitle}</h2>
          <p className="text-sm mt-2 text-gray-500">{copy.home.worldDescription}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {copy.home.worldAreas.map((area, i) => (
              <span key={area} className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full fade-in fade-in-${(i % 3) + 1} bg-white text-navyDeep border border-navy/[0.06]`}>
                <MapPin size={13} /> {area}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
