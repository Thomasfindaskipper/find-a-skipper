'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { LANGUAGE_OPTIONS } from '@/lib/profile-options';
import { Select } from '@/components/ui';

export default function LanguageSelect({
  selected,
  onAdd,
  onRemove,
}: {
  selected: string[];
  onAdd: (language: string) => void;
  onRemove: (language: string) => void;
}) {
  const available = useMemo(() => LANGUAGE_OPTIONS.filter((language) => !selected.includes(language)), [selected]);
  const { copy } = useLocale();

  return (
    <div>
      <Select defaultValue="" onChange={(event) => {
        if (!event.target.value) return;
        onAdd(event.target.value);
        event.target.value = '';
      }}>
        <option value="">{copy.signup.addLanguage}</option>
        {available.map((language) => (
          <option key={language} value={language}>{language}</option>
        ))}
      </Select>
      <div className="mt-3 flex flex-wrap gap-2">
        {selected.map((language) => (
          <button
            key={language}
            type="button"
            onClick={() => onRemove(language)}
            className="rounded-full border border-navy/10 bg-lightblue px-3 py-1.5 text-sm font-medium text-navy"
          >
            {language} ×
          </button>
        ))}
      </div>
    </div>
  );
}
