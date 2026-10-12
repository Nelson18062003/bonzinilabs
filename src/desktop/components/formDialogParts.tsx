/**
 * Les pièces des fenêtres de saisie (nouveau dépôt, nouveau paiement) — une
 * seule grammaire pour que les deux formulaires se lisent pareil :
 *
 *   · Section : un intitulé court, une action à droite, l'erreur dessous ;
 *   · Choice : un choix d'une liste courte, en bouton (méthode, banque…) —
 *     un clic au lieu d'un menu déroulant ;
 *   · BigAmount : le montant, grand, en chiffres séparés par milliers ;
 *   · Disclosure : ce qui sert rarement (date antidatée, note), replié.
 */
import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';

export function Section({
  label,
  hint,
  action,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={cn('text-[13.5px] font-bold', TEXT.strong)}>
          {label}
          {hint && <span className={cn('ml-1.5 text-[12.5px] font-normal', TEXT.muted)}>{hint}</span>}
        </label>
        {action}
      </div>
      {children}
      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}

export function Choice({
  active,
  onClick,
  icon,
  children,
  meta,
  className,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-left text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-foreground text-background ring-1 ring-foreground'
          : cn(SURFACE.card, TEXT.strong, 'ring-1 ring-black/[0.12] hover:ring-black/30 dark:ring-white/[0.15]'),
        className,
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block leading-tight">{children}</span>
        {meta && <span className={cn('block text-[11.5px] font-normal leading-tight', active ? 'opacity-75' : TEXT.muted)}>{meta}</span>}
      </span>
      {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Un montant entier, grand, en chiffres groupés. `null` = vide. */
export function BigAmount({
  id,
  value,
  onChange,
  currency,
  invalid,
  placeholder = '0',
  ariaLabel,
  disabled,
  right,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  currency: string;
  invalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Un bouton dans le champ (« Max »…). */
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-14 items-center gap-2 rounded-2xl px-4 transition focus-within:ring-2 focus-within:ring-ring',
        SURFACE.card,
        invalid ? 'ring-2 ring-red-500' : 'ring-1 ring-black/[0.12] hover:ring-black/25 dark:ring-white/[0.15]',
        disabled && 'opacity-60',
      )}
    >
      <input
        id={id}
        // Sans `size`, un champ réclame ~20 caractères de large et fait déborder sa colonne.
        size={1}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={value === null ? '' : group(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
          const n = digits ? Number(digits) : null;
          onChange(n !== null && Number.isSafeInteger(n) ? n : value);
        }}
        className={cn('h-full min-w-0 flex-1 bg-transparent text-[24px] font-extrabold tabular-nums tracking-[-0.01em] outline-none placeholder:font-semibold placeholder:text-muted-foreground/50', TEXT.strong)}
      />
      {right}
      <span className={cn('shrink-0 text-[13px] font-bold', TEXT.muted)}>{currency}</span>
    </div>
  );
}

/** Une ligne repliée : « Plus d'options · résumé ». */
export function Disclosure({ title, summary, defaultOpen = false, children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn('text-[13.5px] font-bold', TEXT.strong)}>
          {title}
          {summary && !open && <span className={cn('ml-2 text-[12.5px] font-normal', TEXT.muted)}>{summary}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Une case à cocher sur une ligne, avec son explication. */
export function CheckRow({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 rounded-xl py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md transition',
          checked ? 'bg-foreground text-background' : 'ring-2 ring-inset ring-black/25 dark:ring-white/30',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 leading-snug">
        <span className={cn('block text-[13px] font-semibold', TEXT.strong)}>{title}</span>
        {hint && <span className={cn('block text-[12px]', TEXT.muted)}>{hint}</span>}
      </span>
    </button>
  );
}
