/**
 * Liste déroulante — géométrie DESKTOP (36px), sur le même Radix Select que
 * `components/treasury/SelectField` (52px, tactile). Même comportement et
 * même accessibilité ; seule la densité change (02-foundation.md §1.3).
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface TreasurySelectOption {
  value: string;
  label: string;
}

export function TreasurySelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: TreasurySelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className={cn(
          'h-8 rounded-[6px] border border-[#E4E4E7] bg-white px-2.5 text-[12.5px] font-medium ring-offset-0 focus:ring-2 focus:ring-[#4F46E5] data-[placeholder]:font-normal data-[placeholder]:text-[#A1A1AA] dark:border-[#27272A] dark:bg-[#18181B] dark:focus:ring-[#818CF8] [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-55',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-[6px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-[4px] py-1.5 text-[12.5px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
