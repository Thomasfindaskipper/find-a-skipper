'use client';

import type { AvailabilitySlot } from '@/lib/database.types';
import { useLocale } from '@/components/LocaleProvider';
import { Button, Field, TextInput } from '@/components/ui';

export default function AvailabilityEditor({
  draftStart,
  draftEnd,
  onDraftStartChange,
  onDraftEndChange,
  onAdd,
  slots,
  onRemove,
  onEdit,
  editingSlotId,
  onCancelEdit,
}: {
  draftStart: string;
  draftEnd: string;
  onDraftStartChange: (value: string) => void;
  onDraftEndChange: (value: string) => void;
  onAdd: () => void;
  slots: AvailabilitySlot[];
  onRemove: (id: string) => void;
  onEdit: (slot: AvailabilitySlot) => void;
  editingSlotId: string | null;
  onCancelEdit: () => void;
}) {
  const { copy } = useLocale();

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={copy.availability.start}>
          <TextInput type="date" value={draftStart} onChange={(event) => onDraftStartChange(event.target.value)} />
        </Field>
        <Field label={copy.availability.end}>
          <TextInput type="date" value={draftEnd} onChange={(event) => onDraftEndChange(event.target.value)} />
        </Field>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onAdd}>
          {editingSlotId ? copy.availability.update : copy.availability.add}
        </Button>
        {editingSlotId && (
          <Button type="button" variant="ghost" onClick={onCancelEdit}>
            {copy.availability.cancelEdit}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {slots.length === 0 ? (
          <p className="text-sm text-gray-500">{copy.availability.empty}</p>
        ) : (
          slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between rounded-xl border border-navy/[0.08] bg-white px-4 py-3 text-sm">
              <span>{slot.start_date === slot.end_date ? slot.start_date : `${slot.start_date} → ${slot.end_date}`}</span>
              <div className="flex items-center gap-3">
                <button type="button" className="font-semibold text-navy underline" onClick={() => onEdit(slot)}>
                  {copy.availability.edit}
                </button>
                <button type="button" className="font-semibold text-navy underline" onClick={() => onRemove(slot.id)}>
                  {copy.availability.remove}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}