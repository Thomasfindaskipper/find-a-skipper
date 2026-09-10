'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { getCountryOptions, getPhonePlaceholder, formatPhoneValue, type PhoneValue } from '@/lib/phone';
import { Select, TextInput } from '@/components/ui';

function subscribeToClientRender() {
  return () => {};
}

export default function PhoneInput({
  value,
  onChange,
  locale,
  required = false,
}: {
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  locale?: string;
  required?: boolean;
}) {
  const { locale: activeLocale } = useLocale();
  const isClient = useSyncExternalStore(subscribeToClientRender, () => true, () => false);
  const resolvedLocale = locale || activeLocale;
  const options = useMemo(() => (isClient ? getCountryOptions(resolvedLocale) : []), [isClient, resolvedLocale]);

  return (
    <div className="grid grid-cols-[minmax(0,172px)_1fr] gap-3">
      <Select
        value={value.country}
        onChange={(event) => onChange(formatPhoneValue(value.number, event.target.value))}
      >
        {options.length === 0 ? (
          <option value={value.country}>{value.country}</option>
        ) : (
          options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label} ({option.callingCode})
            </option>
          ))
        )}
      </Select>
      <TextInput
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        value={value.number}
        onChange={(event) => onChange(formatPhoneValue(event.target.value, value.country))}
        placeholder={getPhonePlaceholder(resolvedLocale)}
      />
    </div>
  );
}