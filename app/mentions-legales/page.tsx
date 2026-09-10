'use client';

import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';

export default function MentionsLegalesPage() {
  const { locale } = useLocale();
  const content = getExtraCopy(locale).legal.legalNotice;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-navy mb-3">{content.title}</h1>
      <p className="text-sm text-gray-500 mb-8">{content.updated}</p>
      <div className="space-y-8">
        {content.sections.map((section) => (
          <section key={section.heading} className="space-y-3 text-sm leading-7 text-anthracite">
            <h2 className="font-semibold text-base text-navy">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
