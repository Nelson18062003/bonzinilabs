/**
 * Les formes du dossier conteneur — pour que chaque onglet se lise pareil.
 *
 * Règle de délimitation (02-foundation §1.5.2, « one card anatomy ») :
 *   Section      = carte + bandeau de titre (icône, titre, sous-titre, méta,
 *                  action) + filet dessous. C'est la SEULE façon de séparer
 *                  deux sujets dans la page dossier.
 *   Band         = bloc sans carte, séparé par un filet — pour la boîte
 *                  rapide, où empiler des cartes ferait du bruit.
 *   Fact         = paire label/valeur. Le label est `micro` (11px bold
 *                  majuscule espacé), la valeur `emph` (13px semi-gras).
 *   ToolButton   = le seul bouton secondaire du dossier (icône + libellé).
 *   IconButton   = action d'une ligne (ouvrir, modifier, supprimer).
 *
 * Refonte du 03/10/2026 : chaque section porte une ICÔNE dans un carré
 * teinté (la fiche était un mur de texte gris), le corps respire (20 px),
 * et l'intérieur d'une section se découpe en `SubBlock` plutôt qu'en
 * cartes imbriquées.
 */
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL } from '@/desktop/designKit';

/** Teintes des icônes de section : une par famille de sujet, jamais décoratives. */
export type SectionTone = 'neutral' | 'violet' | 'blue' | 'emerald' | 'amber' | 'orange' | 'rose' | 'slate';

export const TONE_ICON: Record<SectionTone, string> = {
  neutral: 'bg-muted text-foreground',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
};

/** Carré d'icône teinté — la marque visuelle d'une section ou d'une ligne. */
export function IconTile({ icon: Icon, tone = 'neutral', size = 'md', className }: { icon: ElementType; tone?: SectionTone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-md' : size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-9 w-9 rounded-lg';
  const ic = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-[18px] w-[18px]';
  return (
    <span className={cn('flex shrink-0 items-center justify-center', box, TONE_ICON[tone], className)}>
      <Icon className={ic} />
    </span>
  );
}

/** Bandeau de titre : icône, titre 14px bold, sous-titre, méta à droite, filet dessous. */
export function SectionHead({
  title, subtitle, meta, action, icon, tone = 'neutral',
}: {
  title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; action?: ReactNode; icon?: ElementType; tone?: SectionTone;
}) {
  return (
    // `flex-wrap` : sur un téléphone, les actions passent sous le titre au lieu de l'écraser mot par mot.
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-b border-black/[0.06] px-5 py-3.5 max-sm:px-4 dark:border-white/[0.06]">
      <div className="flex min-w-[200px] flex-1 items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} />}
        <div className="min-w-0">
          <div className={cn('text-[14px] max-lg:text-[16px] font-bold leading-5', TEXT.strong)}>{title}</div>
          {subtitle != null && <div className={cn('mt-0.5 text-[12px] max-lg:text-[14px] leading-4', TEXT.muted)}>{subtitle}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta != null && <span className={cn('text-[12px] max-lg:text-[14px] tabular-nums', TEXT.muted)}>{meta}</span>}
        {action}
      </div>
    </div>
  );
}

export function Section({
  title, subtitle, meta, action, icon, tone, children, className, bodyClassName, id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  icon?: ElementType;
  tone?: SectionTone;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('overflow-hidden rounded-[14px]', SURFACE.card, SURFACE.shadow, className)}>
      <SectionHead title={title} subtitle={subtitle} meta={meta} action={action} icon={icon} tone={tone} />
      <div className={cn('px-5 py-5 max-sm:px-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Un sous-bloc dans une section : un libellé micro, un filet au-dessus (sauf le premier). */
export function SubBlock({ title, meta, action, children, first, className }: { title?: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; first?: boolean; className?: string }) {
  return (
    <div className={cn(!first && 'mt-5 border-t border-black/[0.06] pt-5 dark:border-white/[0.06]', className)}>
      {(title != null || action != null) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className={cn('text-[11px] max-lg:text-[14px] font-bold uppercase tracking-wider max-lg:normal-case max-lg:tracking-normal', TEXT.muted)}>{title}</span>
          <span className="flex items-center gap-2">
            {meta != null && <span className={cn('text-[12px] max-lg:text-[14px] tabular-nums', TEXT.muted)}>{meta}</span>}
            {action}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/** Bloc de la boîte rapide : un filet au-dessus, jamais de carte imbriquée. */
export function Band({ title, meta, children, first }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <div className={cn('px-5 py-4', !first && 'border-t border-black/[0.06] dark:border-white/[0.06]')}>
      {title != null && (
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <span className={cn('text-[11px] max-lg:text-[16px] font-bold uppercase tracking-wider max-lg:normal-case max-lg:tracking-normal', TEXT.muted)}>{title}</span>
          {meta != null && <span className={cn('text-[12px] max-lg:text-[16px] tabular-nums', TEXT.muted)}>{meta}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Paire label / valeur. */
export function Fact({ label, value, hint, className, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; className?: string; icon?: ElementType }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('flex items-center gap-1.5 text-[11px] max-lg:text-[14px] font-bold uppercase tracking-wider max-lg:normal-case max-lg:tracking-normal', TEXT.muted)}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={cn('mt-1 text-[13.5px] max-lg:text-[16px] font-semibold leading-snug tabular-nums', TEXT.strong)}>{value}</div>
      {hint != null && <div className={cn('mt-0.5 text-[12px] max-lg:text-[14px] font-normal leading-snug', TEXT.muted)}>{hint}</div>}
    </div>
  );
}

/** Grille de faits — 3 colonnes, 2 en dessous de 1024px. */
export function Facts({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={cn('grid gap-x-6 gap-y-5', cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4 max-lg:grid-cols-2' : 'grid-cols-3 max-lg:grid-cols-2')}>
      {children}
    </div>
  );
}

/** État vide honnête : ce qui manque, et pourquoi — avec, si possible, l'action qui le règle. */
export function Empty({ title, children, icon: Icon, action }: { title: string; children?: ReactNode; icon?: ElementType; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {Icon && <IconTile icon={Icon} size="lg" className="mb-3" />}
      <p className={cn('text-[14px] max-lg:text-[16px] font-semibold', TEXT.strong)}>{title}</p>
      {children != null && <p className={cn('mx-auto mt-1 max-w-md text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.muted)}>{children}</p>}
      {action != null && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Le bouton secondaire du dossier : icône + libellé, 32 px (40 sur mobile). */
export function ToolButton({
  icon: Icon, children, onClick, primary, danger, disabled, className, type = 'button', title,
}: {
  icon?: ElementType; children?: ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; className?: string; type?: 'button' | 'submit'; title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 max-lg:h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[12.5px] max-lg:text-[15px] font-semibold disabled:opacity-50',
        primary ? PRIMARY_PILL : SOFT_PILL,
        danger && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 max-lg:h-4 max-lg:w-4" />}
      {children}
    </button>
  );
}

/** Action d'une ligne, en icône seule. Toujours avec un libellé accessible. */
export function IconButton({ icon: Icon, label, onClick, danger, className }: { icon: ElementType; label: string; onClick?: () => void; danger?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-7 w-7 max-lg:h-10 max-lg:w-10 shrink-0 items-center justify-center rounded-md transition-colors',
        danger ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 max-lg:h-[18px] max-lg:w-[18px]" />
    </button>
  );
}

/** Petite pastille d'état (compteur, « manquant », « à confirmer »…). */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info'; className?: string }) {
  const t = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
    danger: 'bg-destructive/10 text-destructive',
    info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
  }[tone];
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] max-lg:text-[13px] font-bold tabular-nums', t, className)}>{children}</span>;
}

/** Libellé de champ dans un formulaire de dossier. */
export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className={cn('text-[12px] max-lg:text-[14px] font-semibold', TEXT.strong)}>{children}</span>
      {hint != null && <span className={cn('text-[11.5px] max-lg:text-[13px]', TEXT.muted)}>{hint}</span>}
    </label>
  );
}
