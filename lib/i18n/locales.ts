export const LOCALE_COOKIE_NAME = 'fas-locale';
export const DEFAULT_LOCALE = 'fr';

export const LOCALES = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
  { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
  { code: 'no', flag: '🇳🇴', label: 'Norsk' },
  { code: 'da', flag: '🇩🇰', label: 'Dansk' },
] as const;

export type SupportedLocale = (typeof LOCALES)[number]['code'];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return LOCALES.some((locale) => locale.code === value);
}

export function resolveLocale(value: string | null | undefined): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
