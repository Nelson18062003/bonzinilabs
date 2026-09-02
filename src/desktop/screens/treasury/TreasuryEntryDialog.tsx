/**
 * Saisir un achat ou une vente SANS quitter le module.
 *
 * Avant : cliquer « Achat » ou « Vente USDT » ouvrait une PAGE ENTIÈRE — quatre
 * cartes empilées, un récapitulatif collé à droite, une flèche retour. Retour
 * utilisateur, mot pour mot : « une longue formule inutile… trop
 * d'informations… mal structuré ». Et en sortant, la vue d'où l'on venait
 * (sa période, son filtre, sa ligne sélectionnée) était perdue.
 *
 * Ici, la fenêtre s'ouvre PAR-DESSUS la vue courante, qui reste visible
 * derrière un voile flouté — le même geste que « Nouveau client ». L'URL
 * (`/treasury/purchase`, `/treasury/sale`) ne change pas : elle reste
 * partageable, le bouton Précédent ferme la fenêtre, et la vue derrière n'est
 * pas remontée (voir `DesktopTreasuryScreen`, qui rend cette fenêtre lui-même
 * plutôt que de la laisser à une route à part).
 *
 * Le formulaire, lui, est réécrit autour de QUATRE décisions numérotées — qui,
 * quel compte, combien, quand — et d'un pied fixe qui montre l'effet sur le
 * stock. Ce qui n'aide pas à décider (note, référence) est replié.
 */
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { Dialog, DialogPortal, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LABEL, NUM, T, TONE } from './marketKit';

export function TreasuryEntryDialog({
  title,
  description,
  icon: Icon,
  tone,
  onClose,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  /** Achat = entrée de stock (indigo) ; vente = sortie (ambre). */
  tone: 'purchase' | 'sale';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        {/* Voile léger + flou : la vue derrière reste lisible, c'est le
            contexte qu'on ne veut pas perdre. Le `bg-black/80` de shadcn
            l'effacerait. */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(700px,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2',
            // En-tête et pied FIXES, seul le corps défile : l'effet sur le
            // stock et le bouton d'enregistrement restent sous les yeux quand
            // une répartition sur plusieurs comptes allonge le formulaire.
            'flex max-h-[88vh] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl font-ui',
            'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-6 py-4">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-md',
                tone === 'purchase' ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-amber-50 dark:bg-amber-950/40',
                tone === 'purchase' ? TONE.purchase : TONE.sale,
              )}
            >
              <Icon className="size-4" weight="bold" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className={cn('text-[17px] font-bold leading-tight tracking-[-0.02em]', T.ink)}>{title}</DialogTitle>
              <DialogDescription className={cn('mt-0.5 text-[12.5px]', T.muted)}>{description}</DialogDescription>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="-mr-2 -mt-1 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">{children}</div>
          </div>

          {footer && <footer className="border-t border-border bg-muted/40 px-6 py-3.5">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/* ── Une décision = une étape numérotée ──────────────────────────────
 *
 * Le numéro n'est pas décoratif : il dit qu'il y a QUATRE choses à faire, et
 * dans quel ordre — qui, quel compte, combien, quand. L'ancienne page les
 * présentait comme quatre cartes équivalentes, sans hiérarchie. */

export function EntryStep({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  /** Un réglage propre à l'étape (mode de saisie, « répartir sur plusieurs comptes »…). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
      <span
        className={cn(
          'mt-0.5 flex size-6 items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold',
          NUM,
          T.muted,
        )}
      >
        {n}
      </span>
      <div className="min-w-0 space-y-2.5">
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <h3 className={cn(LABEL, T.muted)}>{title}</h3>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}

/**
 * La grandeur DÉDUITE de la saisie — le taux quand on entre les deux montants,
 * le montant quand on entre un montant et le taux. Elle vit juste sous les
 * champs, parce que c'est la réponse à ce qu'on vient de taper.
 */
export function EntryComputed({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
      <span className={cn('text-[11.5px]', T.muted)}>{label}</span>
      <span className={cn(NUM, 'text-[14px] font-bold', T.ink)}>
        {value}
        <span className={cn('ml-1 text-[10px] font-normal', T.faint)}>{unit}</span>
      </span>
    </div>
  );
}

/** Un chiffre du pied de fenêtre — l'effet de la saisie sur le stock. */
export function EntryStat({
  label,
  value,
  unit,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="min-w-0">
      <div className={cn(LABEL, T.muted)}>{label}</div>
      <div
        className={cn(
          'mt-0.5 text-[13.5px] font-bold',
          NUM,
          tone === 'positive' ? TONE.positive : tone === 'negative' ? TONE.negative : T.ink,
        )}
      >
        {value}
        {unit && <span className={cn('ml-1 text-[10px] font-normal', T.faint)}>{unit}</span>}
      </div>
    </div>
  );
}

/** Lien d'action discret, dans l'en-tête d'une étape. */
export function EntryLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}
