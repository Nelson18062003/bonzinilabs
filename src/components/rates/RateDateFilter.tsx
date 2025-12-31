import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangeFilter } from '@/hooks/useExchangeRates';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

interface DateRange {
  from: Date;
  to: Date;
}

interface RateDateFilterProps {
  filter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (range: DateRange) => void;
  showCustom?: boolean;
}

const filterOptions: { value: DateRangeFilter; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '3m', label: '3 mois' },
  { value: '12m', label: '12 mois' },
];

export function RateDateFilter({
  filter,
  onFilterChange,
  customRange,
  onCustomRangeChange,
  showCustom = true,
}: RateDateFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filterOptions.map((option) => (
        <Button
          key={option.value}
          variant={filter === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
      
      {showCustom && onCustomRangeChange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filter === 'custom' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'justify-start text-left font-normal',
                filter === 'custom' && 'bg-primary text-primary-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filter === 'custom' && customRange ? (
                <>
                  {format(customRange.from, 'dd/MM/yy', { locale: fr })} -{' '}
                  {format(customRange.to, 'dd/MM/yy', { locale: fr })}
                </>
              ) : (
                'Personnalisé'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: customRange?.from,
                to: customRange?.to,
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onCustomRangeChange({ from: range.from, to: range.to });
                  onFilterChange('custom');
                }
              }}
              locale={fr}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
