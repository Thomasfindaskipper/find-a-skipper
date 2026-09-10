import type { SupportedLocale } from '@/lib/i18n/locales';

const INTL_LOCALE_BY_APP_LOCALE: Record<SupportedLocale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  it: 'it-IT',
  de: 'de-DE',
  pt: 'pt-PT',
  nl: 'nl-NL',
  el: 'el-GR',
  no: 'nb-NO',
  da: 'da-DK',
};

export function toIntlLocale(locale: SupportedLocale) {
  return INTL_LOCALE_BY_APP_LOCALE[locale];
}

export function formatDateForLocale(
  value: string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(parsed);
}

export function formatDateTimeForLocale(
  value: string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(parsed);
}
