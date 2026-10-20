import type { MediaTypeFilter } from '../types';

export interface TypeFilterOption {
  value: MediaTypeFilter | '';
  label: string;
}

export const TYPE_FILTERS: TypeFilterOption[] = [
  { value: '', label: 'All' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
  { value: 'other', label: 'Other' },
];

export function TypeFilters({
  value,
  onChange,
}: {
  value: MediaTypeFilter | '';
  onChange: (value: MediaTypeFilter | '') => void;
}) {
  return (
    <div className="filter-group" role="group" aria-label="Filter by file type">
      {TYPE_FILTERS.map((option) => (
        <button
          key={option.value || 'all'}
          type="button"
          className="filter-chip"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
