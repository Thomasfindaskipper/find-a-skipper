'use client';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';

export default function ConfidentialitePage() {
  const { locale } = useLocale();
  const content = getExtraCopy(locale).legal.privacy;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-navy mb-3">{content.title}</h1>
      <p className="text-sm text-gray-500 mb-8">{content.updated}</p>
      <section className="space-y-3 text-sm leading-7 text-anthracite">
        <p>{content.body}</p>
        <p>{content.rights}</p>
        <p>
          <Link href="/account" className="font-semibold text-navy hover:text-navyDeep">{content.account}</Link>
        </p>
      </section>
    </main>
  );
}
