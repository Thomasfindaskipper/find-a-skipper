import Link from 'next/link';
import { MapPin, User, Ship, CheckCircle2, ShieldCheck, MessageCircle, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data as Profile | null;
  }

  const primaryHref = profile?.role === 'skipper' ? '/missions' : profile ? '/missions/new' : '/signup?role=skipper';
  const primaryLabel = profile?.role === 'skipper' ? 'Voir les missions →' : 'Je suis skipper →';
  const secondaryHref = profile && profile.role !== 'skipper' ? '/missions/new' : '/signup?role=owner';

  return (
    <>
      <section
        className="relative flex items-end min-h-[600px] text-white text-center px-6 pt-28 pb-16"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(11,37,69,0.35) 0%, rgba(11,37,69,0.15) 45%, rgba(11,37,69,0.80) 100%), url('/hero-boat.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 45%',
        }}
      >
        <div className="max-w-xl mx-auto w-full fade-in">
          <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
            Plateforme des skippers professionnels
          </div>
          <h1 className="font-display font-bold text-[42px] leading-[1.1] mb-4" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}>
            Trouvez le skipper idéal pour votre prochaine mission.
          </h1>
          <p className="mb-8 text-[17px] text-white/90" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
            La plateforme qui met en relation les skippers professionnels, propriétaires, brokers et sociétés de charter.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Link href={primaryHref} className="font-bold px-7 py-3.5 rounded-xl w-full max-w-xs bg-navyDeep text-white shadow-lg">
              {primaryLabel}
            </Link>
            <Link href={secondaryHref} className="font-bold px-7 py-3.5 rounded-xl w-full max-w-xs bg-white text-navyDeep border-2 border-navyDeep">
              Publier une mission →
            </Link>
          </div>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm font-medium flex-wrap text-white/90" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
            <MapPin size={15} /> Disponible sur la Côte d&apos;Azur pour propriétaires, brokers et sociétés de charter — mise en relation rapide
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            [User, 'Créez votre profil', 'Skipper ou demandeur, en quelques minutes.'],
            [Ship, 'Recevez ou publiez une mission', 'À la journée, à la semaine, saisonnière ou convoyage.'],
            [CheckCircle2, 'Trouvez le bon skipper en quelques minutes', 'Comparez les profils et échangez directement.'],
          ].map(([Icon, t, d], i) => {
            const IconComp = Icon as typeof User;
            return (
              <div key={i} className={`rounded-2xl p-6 text-left lift-card fade-in fade-in-${i + 1} bg-white border border-navy/[0.08]`}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-lightblue">
                  <IconComp size={20} className="text-navyDeep" />
                </div>
                <h3 className="font-bold mb-1.5">{t as string}</h3>
                <p className="text-sm text-gray-500">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold mb-2">Pourquoi Find a Skipper ?</h2>
          <p className="text-sm text-gray-500">Une plateforme pensée pour la simplicité et la confiance.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            [ShieldCheck, 'Skippers vérifiés', 'Profils contrôlés : expérience, permis et zones de navigation.'],
            [MessageCircle, 'Contact direct', 'Aucun intermédiaire inutile, vous échangez directement avec le skipper.'],
            [Calendar, 'Missions flexibles', 'À la journée, à la semaine, saisonnières ou en convoyage.'],
            [MapPin, "Côte d'Azur aujourd'hui, bientôt partout", "Le service s'étend progressivement à de nouvelles régions."],
          ].map(([Icon, t, d], i) => {
            const IconComp = Icon as typeof ShieldCheck;
            return (
              <div key={i} className={`flex items-start gap-3 p-5 rounded-2xl lift-card fade-in fade-in-${i + 1} bg-white border border-navy/[0.08]`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-lightblue">
                  <IconComp size={17} className="text-navyDeep" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] mb-1">{t as string}</h3>
                  <p className="text-sm text-gray-500">{d as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-20 bg-lightblue">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-2xl font-bold">Zones desservies</h2>
          <p className="text-sm mt-2 text-gray-500">Aujourd&apos;hui sur la Côte d&apos;Azur, bientôt partout dans le monde.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {['Nice', 'Cannes', 'Antibes', 'Saint-Tropez', 'Monaco'].map((city, i) => (
              <span key={city} className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full fade-in fade-in-${(i % 3) + 1} bg-white text-navyDeep`}>
                <MapPin size={13} /> {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-center text-xs py-8 text-gray-500">© 2026 Find a Skipper — Propulsé par Supabase</footer>
    </>
  );
}
