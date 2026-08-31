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
          'h-9 rounded-[10px] border-0 bg-[#F6F5FB] px-3 text-[13px] font-medium ring-1 ring-black/[0.06] ring-offset-0 focus:ring-2 focus:ring-[#6B5BD2] data-[placeholder]:font-normal data-[placeholder]:text-[#8E8BA0] dark:bg-[#2A2836] dark:ring-white/[0.06] dark:focus:ring-[#A99BF0] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-50',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-[10px]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-[6px] py-2 text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
