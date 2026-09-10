import type { AvailabilitySlot, Profile, ProfileCertification } from '@/lib/database.types';

export function normalizeProfileCertifications(value: Profile['certifications'] | null | undefined): ProfileCertification[] {
  return (value || [])
    .map((entry) => {
      if (!entry?.name) return null;
      return {
        name: entry.name,
        verified: Boolean(entry.verified),
        authority: entry.authority || null,
      };
    })
    .filter(Boolean) as ProfileCertification[];
}

export function normalizeLanguages(value: string[] | null | undefined) {
  return (value || []).filter(Boolean);
}

export function formatAvailabilitySummary(slots: AvailabilitySlot[]) {
  if (slots.length === 0) return 'Disponibilité non renseignée';

  return slots
    .slice()
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .map((slot) => {
      if (slot.start_date === slot.end_date) return slot.start_date;
      return `${slot.start_date} → ${slot.end_date}`;
    })
    .join(' • ');
}

export function topCertifications(certifications: ProfileCertification[], limit = 2) {
  return certifications.slice(0, limit).map((entry) => entry.name);
}

export function indicativeRateLabel(rate: string | null | undefined) {
  if (!rate) return '350 € indicatif';
  return `${rate} indicatif`;
}
