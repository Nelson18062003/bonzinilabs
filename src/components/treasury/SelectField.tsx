import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectFieldOption {
  value: string;
  label: string;
}

/**
 * Styled dropdown built on the real Radix Select (@/components/ui/select) —
 * animated, accessible popover with check marks. Replaces the native <select>
 * (the dated "90s" control) everywhere in Treasury. "Soft" filled aesthetic to
 * match the chosen direction.
 */
export function SelectField({
  value,
  onChange,
  options,
  label,
  placeholder = 'Sélectionner…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-[13px] font-semibold text-muted-foreground">{label}</label>}
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-[52px] rounded-2xl border-0 bg-muted/70 px-4 text-[15px] font-medium ring-offset-0 focus:ring-2 focus:ring-bonzini-violet/40 data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground [&>svg]:h-5 [&>svg]:w-5 [&>svg]:opacity-50">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="rounded-xl py-2.5 text-[15px]">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
