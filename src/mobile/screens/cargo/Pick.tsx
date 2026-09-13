/** Un choix parmi quelques mots : des boutons de 40 px, celui qui est choisi en encre. */
import { cn } from '@/lib/utils';
import { PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';

export function Pick<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={o === value}
          className={cn('h-10 px-3 text-[16px] font-medium', o === value ? PRIMARY_PILL : SOFT_PILL)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}
