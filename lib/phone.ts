import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js';
import { resolveLocale, type SupportedLocale } from '@/lib/i18n/locales';

export interface PhoneValue {
  country: CountryCode;
  number: string;
  e164: string;
  international: string;
  isValid: boolean;
}

export interface CountryOption {
  code: CountryCode;
  label: string;
  callingCode: string;
}

const DEFAULT_COUNTRY: CountryCode = 'FR';

const PHONE_COPY: Record<SupportedLocale, { required: string; invalid: string; placeholder: string }> = {
  fr: { required: 'Le numero de telephone est requis.', invalid: 'Le numero de telephone n est pas valide pour le pays selectionne.', placeholder: '06 12 34 56 78' },
  en: { required: 'Phone number is required.', invalid: 'Phone number is not valid for the selected country.', placeholder: '06 12 34 56 78' },
  es: { required: 'El numero de telefono es obligatorio.', invalid: 'El numero de telefono no es valido para el pais seleccionado.', placeholder: '06 12 34 56 78' },
  it: { required: 'Il numero di telefono e obbligatorio.', invalid: 'Il numero di telefono non e valido per il paese selezionato.', placeholder: '06 12 34 56 78' },
  de: { required: 'Telefonnummer ist erforderlich.', invalid: 'Die Telefonnummer ist fur das ausgewahlte Land ungueltig.', placeholder: '06 12 34 56 78' },
  pt: { required: 'O numero de telefone e obrigatorio.', invalid: 'O numero de telefone nao e valido para o pais selecionado.', placeholder: '06 12 34 56 78' },
  nl: { required: 'Telefoonnummer is verplicht.', invalid: 'Telefoonnummer is niet geldig voor het geselecteerde land.', placeholder: '06 12 34 56 78' },
  el: { required: 'Ο αριθμος τηλεφωνου ειναι υποχρεωτικος.', invalid: 'Ο αριθμος τηλεφωνου δεν ειναι εγκυρος για τη χωρα που επιλεχθηκε.', placeholder: '06 12 34 56 78' },
  no: { required: 'Telefonnummer er obligatorisk.', invalid: 'Telefonnummeret er ikke gyldig for valgt land.', placeholder: '06 12 34 56 78' },
  da: { required: 'Telefonnummer er paakraevet.', invalid: 'Telefonnummeret er ikke gyldigt for det valgte land.', placeholder: '06 12 34 56 78' },
};

function asCountryCode(value?: string | null): CountryCode {
  return (value && getCountries().includes(value as CountryCode) ? value : DEFAULT_COUNTRY) as CountryCode;
}

export function createEmptyPhoneValue(country: string = DEFAULT_COUNTRY): PhoneValue {
  return {
    country: asCountryCode(country),
    number: '',
    e164: '',
    international: '',
    isValid: false,
  };
}

export function formatPhoneValue(input: string, country: string): PhoneValue {
  const selectedCountry = asCountryCode(country);
  const formatter = new AsYouType(selectedCountry);
  const formatted = formatter.input(input);
  const parsed = formatter.getNumber();

  return {
    country: selectedCountry,
    number: formatted,
    e164: parsed?.number || '',
    international: parsed?.formatInternational() || '',
    isValid: parsed?.isValid() || false,
  };
}

export function phoneValueFromStored(value: string | null | undefined, country: string = DEFAULT_COUNTRY): PhoneValue {
  if (!value) return createEmptyPhoneValue(country);

  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) {
    return formatPhoneValue(value, country);
  }

  return {
    country: asCountryCode(parsed.country || country),
    number: parsed.formatNational(),
    e164: parsed.number,
    international: parsed.formatInternational(),
    isValid: parsed.isValid(),
  };
}

export function getPhoneStorageValue(value: PhoneValue) {
  return value.isValid ? value.e164 : value.number.trim();
}

export function validatePhoneValue(value: PhoneValue, required = false, locale?: string) {
  const copy = PHONE_COPY[resolveLocale(locale)];
  if (!value.number.trim()) {
    return required ? copy.required : '';
  }

  return value.isValid ? '' : copy.invalid;
}

export function getPhonePlaceholder(locale?: string) {
  return PHONE_COPY[resolveLocale(locale)].placeholder;
}

export function getCountryOptions(locale: string = 'fr'): CountryOption[] {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([locale], { type: 'region' })
    : null;

  return getCountries()
    .map((code) => ({
      code,
      label: displayNames?.of(code) || code,
      callingCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}