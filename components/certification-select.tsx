'use client';

import { CERTIFICATION_GROUPS } from '@/lib/profile-options';

export default function CertificationSelect({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {CERTIFICATION_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</div>
          <div>
            {group.options.map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToggle(option)}
                  className={`text-sm font-medium px-3.5 py-2 rounded-full mr-2 mb-2 border-[1.5px] transition ${
                    active ? 'bg-navy text-white border-navy' : 'bg-white text-anthracite border-gray-200'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
