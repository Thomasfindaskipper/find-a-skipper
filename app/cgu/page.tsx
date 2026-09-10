'use client';

import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';

export default function CguPage() {
  const { locale } = useLocale();
  const content = getExtraCopy(locale).legal.cgu;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-navy mb-3">{content.title}</h1>
      <p className="text-sm text-gray-500 mb-8">{content.updated}</p>
      <section className="space-y-3 text-sm leading-7 text-anthracite">
        <p>{content.intro}</p>
        <ul className="list-disc pl-5 space-y-1">
          {content.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
