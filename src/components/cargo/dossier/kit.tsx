/**
 * Les trois seules formes du dossier — pour que chaque écran se lise pareil.
 *
 * Règle de délimitation (02-foundation §1.5.2, « one card anatomy ») :
 *   Section      = carte + bandeau de titre + filet dessous. C'est la SEULE
 *                  façon de séparer deux sujets dans la page dossier.
 *   Band         = bloc sans carte, séparé par un filet — pour la boîte
 *                  rapide, où empiler des cartes ferait du bruit.
 *   Fact         = paire label/valeur. Le label est `micro` (11px bold
 *                  majuscule espacé), la valeur `emph` (13px semi-gras).
 * Aucune autre géométrie n'est autorisée dans le dossier.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';

/** Bandeau de titre : 13px bold à gauche, méta 12px sourde à droite, filet dessous. */
export function SectionHead({ title, meta, action }: { title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
      <span className={cn('text-[13px] font-bold', TEXT.strong)}>{title}</span>
      <span className="flex items-center gap-2">
        {meta != null && <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{meta}</span>}
        {action}
      </span>
    </div>
  );
}

export function Section({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-[14px]', SURFACE.card, SURFACE.shadow, className)}>
      <SectionHead title={title} meta={meta} action={action} />
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Bloc de la boîte rapide : un filet au-dessus, jamais de carte imbriquée. */
export function Band({ title, meta, children, first }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <div className={cn('px-5 py-4', !first && 'border-t border-black/[0.06] dark:border-white/[0.06]')}>
      {title != null && (
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{title}</span>
          {meta != null && <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{meta}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Paire label / valeur. `wide` occupe deux colonnes de la grille. */
export function Fact({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{label}</div>
      <div className={cn('mt-1 text-[13px] font-semibold leading-snug tabular-nums', TEXT.strong)}>{value}</div>
      {hint != null && <div className={cn('mt-0.5 text-[11.5px] font-normal', TEXT.muted)}>{hint}</div>}
    </div>
  );
}

/** Grille de faits — 3 colonnes, 2 en dessous de 900px. */
export function Facts({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={cn('grid gap-x-5 gap-y-4', cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4 max-lg:grid-cols-2' : 'grid-cols-3 max-lg:grid-cols-2')}>
      {children}
    </div>
  );
}

/** État vide honnête : ce qui manque, et pourquoi. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className={cn('text-[13px] font-semibold', TEXT.strong)}>{title}</p>
      {children != null && <p className={cn('mx-auto mt-1 max-w-sm text-[12.5px]', TEXT.muted)}>{children}</p>}
    </div>
  );
}
