'use client';

interface MultiSelectTagsProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

export default function MultiSelectTags({ label, options, selected, onToggle }: MultiSelectTagsProps) {
  return (
    <div aria-label={label}>
      {options.map((option) => {
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
  );
}
