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
          // On ne change QUE la densité : bordure, fond et anneau de focus
          // restent ceux du SelectTrigger shadcn. La version précédente était
          // sans bordure sur un gris plein — à côté d'un Input bordé, deux
          // champs de la même carte n'avaient pas le même habillage.
          'h-8 px-2.5 py-1 text-sm ring-offset-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-55',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-1.5 text-sm">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
