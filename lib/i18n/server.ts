import { cookies } from 'next/headers';
import { getCopy } from '@/lib/i18n/copy';
import { LOCALE_COOKIE_NAME, resolveLocale, type SupportedLocale } from '@/lib/i18n/locales';

export async function getRequestLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getRequestCopy() {
  return getCopy(await getRequestLocale());
}
