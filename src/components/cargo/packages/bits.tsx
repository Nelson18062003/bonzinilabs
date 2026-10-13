// ============================================================
// Les pièces communes de la mise en paquets et de l'embarquement (ordinateur) :
// les mêmes gestes partout — Réception (colis, dépôts), Paquets avion, Avion.
//   · Btn          le bouton (principal, secondaire, danger, suppression) ;
//   · Tick         la case à cocher d'une ligne ;
//   · ChoiceCard   une destination à choisir (un paquet, un vol, « nouveau ») ;
//   · Excluded     ce qui a été écarté d'une sélection, avec la raison ;
//   · SelectionBar la barre qui apparaît dès qu'on coche quelque chose.
// ============================================================
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, DANGER_SOFT_PILL } from '@/desktop/designKit';

export function Btn({ kind = 'soft', size = 'md', onClick, disabled, loading, children, className, title }: {
  /** `destroy` : la confirmation d'une suppression (rouge plein). */
  kind?: 'primary' | 'soft' | 'danger' | 'destroy';
  /** `sm` : dans une barre ou une ligne de liste. */
  size?: 'md' | 'sm';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4',
        size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-3.5 text-[13px]',
        kind === 'primary' ? cn(PRIMARY_PILL, 'font-bold') : kind === 'danger' ? DANGER_SOFT_PILL
          : kind === 'destroy' ? 'rounded-md bg-red-600 font-bold text-white hover:bg-red-700' : SOFT_PILL,
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" /> : children}
    </button>
  );
}

/** La case d'une ligne. `mixed` : une partie seulement (l'en-tête d'un groupe). */
export function Tick({ on, mixed, label, onChange, disabled }: { on: boolean; mixed?: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-30',
        on || mixed ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/60 bg-background hover:border-foreground',
      )}
    >
      {on ? <Check className="h-3 w-3" strokeWidth={3.5} /> : mixed ? <span className="h-0.5 w-2 rounded bg-background" /> : null}
    </button>
  );
}

/**
 * La case d'un groupe (une page, un client, un état de paquet) : coche tout le
 * groupe, ou le décoche s'il l'est déjà en entier ; « mixte » quand une partie
 * seulement l'est.
 */
export function GroupTick({ ids, selected, setSelected, label }: { ids: readonly string[]; selected: ReadonlySet<string>; setSelected: Dispatch<SetStateAction<Set<string>>>; label: string }) {
  const n = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && n === ids.length;
  return (
    <Tick on={all} mixed={n > 0 && !all} label={label} disabled={ids.length === 0}
      onChange={() => setSelected((cur) => { const s = new Set(cur); for (const id of ids) { if (all) s.delete(id); else s.add(id); } return s; })} />
  );
}

/** Une destination : un paquet en cours, un vol en préparation, ou « nouveau ». */
export function ChoiceCard({ on, onClick, title, meta, children, disabled, icon }: {
  on: boolean;
  onClick: () => void;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border transition-colors', on ? 'border-foreground bg-accent/50 ring-1 ring-foreground' : 'border-border', disabled && 'opacity-50')}>
      <button type="button" role="radio" aria-checked={on} disabled={disabled} onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className={cn('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border', on ? 'border-foreground' : 'border-muted-foreground/60')}>
          {on && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
        </span>
        {icon}
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[13.5px] font-bold', TEXT.strong)}>{title}</span>
          {meta && <span className={cn('mt-0.5 block text-[12.5px] tabular-nums', TEXT.muted)}>{meta}</span>}
        </span>
      </button>
      {on && children && <div className="border-t border-border/70 px-4 py-3">{children}</div>}
    </div>
  );
}

/** Ce qui a été écarté de la sélection, et pourquoi — replié au-delà de quelques lignes. */
export function Excluded({ title, rows }: { title: string; rows: { key: string; label: ReactNode; reason: string }[] }) {
  if (rows.length === 0) return null;
  const list = (
    <ul className="mt-2 space-y-0.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-[12.5px]">
          <span className={cn('font-mono font-semibold', TEXT.strong)}>{r.label}</span>
          <span className="min-w-0 flex-1 truncate text-amber-800 dark:text-amber-300">{r.reason}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      {rows.length <= 4 ? (
        <>
          <p className="flex items-center gap-2 text-[13px] font-bold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" /> {title}</p>
          {list}
        </>
      ) : (
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" /> {title}</summary>
          {list}
        </details>
      )}
    </div>
  );
}

/** La barre de la sélection : ce qui est coché, et ce qu'on peut en faire. Collée en haut de la liste. */
export function SelectionBar({ label, meta, onClear, children }: { label: ReactNode; meta?: ReactNode; onClear: () => void; children: ReactNode }) {
  return (
    <div className="sticky top-0 z-[2] flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-accent px-5 py-2.5">
      <span className={cn('text-[13px] font-bold', TEXT.strong)}>{label}</span>
      {meta && <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{meta}</span>}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Btn size="sm" onClick={onClear}><X /> Désélectionner</Btn>
      </span>
    </div>
  );
}
