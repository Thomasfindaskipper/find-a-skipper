'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { LOCALES, type SupportedLocale } from '@/lib/i18n/locales';
import { useLocale } from '@/components/LocaleProvider';

export default function LocaleSwitcher() {
  const { locale, setLocale, copy } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-navy/10 bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-lightblue"
        aria-label={copy.localeSwitcher.ariaLabel}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{copy.localeSwitcher.shortLabel}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-navy/[0.08] bg-white p-2 shadow-xl">
          {LOCALES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLocale(item.code as SupportedLocale);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${locale === item.code ? 'bg-lightblue text-navy' : 'text-anthracite hover:bg-offwhite'}`}
            >
              <span>{item.flag} {item.label}</span>
              {locale === item.code && <span className="text-xs font-bold">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
