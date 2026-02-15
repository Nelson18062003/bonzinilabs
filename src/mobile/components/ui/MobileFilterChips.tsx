import { cn } from '@/lib/utils';

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface MobileFilterChipsProps<T extends string> {
  filters: FilterOption<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
}

export function MobileFilterChips<T extends string>({
  filters,
  activeKey,
  onChange,
  className,
}: MobileFilterChipsProps<T>) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide', className)}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            activeKey === filter.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {filter.label}
          {filter.count != null && (
            <span className="ml-1.5 opacity-70">({filter.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
