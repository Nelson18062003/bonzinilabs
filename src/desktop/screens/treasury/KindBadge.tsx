/**
 * Achat / Vente / Annulé — le type d'une opération, lisible sans la couleur :
 * une icône et un mot. Vert = des USDT entrent (achat), indigo = des USDT
 * sortent (vente). Une opération annulée est grisée et le dit.
 */
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export function KindBadge({ kind, voided }: { kind: 'purchase' | 'sale'; voided?: boolean }) {
  const purchase = kind === 'purchase';
  const Icon = purchase ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md',
          voided
            ? 'bg-muted text-muted-foreground'
            : purchase
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
              : 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={voided ? 'text-muted-foreground' : ''}>{purchase ? 'Achat' : 'Vente'}</span>
      {voided && <span className="rounded bg-muted px-1.5 text-[11.5px] font-semibold text-muted-foreground">Annulée</span>}
    </span>
  );
}

/** Le type d'une opération en pastille ronde, pour les listes. */
export function OpIcon({ kind, voided }: { kind: 'purchase' | 'sale'; voided?: boolean }) {
  const purchase = kind === 'purchase';
  const Icon = purchase ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        voided
          ? 'bg-muted text-muted-foreground'
          : purchase
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
