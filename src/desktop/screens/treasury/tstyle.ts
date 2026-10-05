/**
 * Trésorerie desktop — jetons, recettes de boutons et lecture des montants.
 * Séparé de `tkit.tsx` (qui n'exporte que des composants) pour que le
 * rechargement à chaud de Vite fonctionne.
 */
import { cn } from '@/lib/utils';

/* ── Jetons ─────────────────────────────────────────────────────────────── */

export const TK = {
  card: 'rounded-[12px] border border-border bg-card',
  inset: 'rounded-[10px] border border-border/70 bg-muted/50',
  ink: 'text-foreground',
  body: 'text-foreground/85',
  muted: 'text-muted-foreground',
  num: 'tabular-nums',
  label: 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground',
  in: 'text-emerald-700 dark:text-emerald-400',
  out: 'text-red-700 dark:text-red-400',
  warn: 'text-amber-700 dark:text-amber-400',
  focus: 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
} as const;

const BTN_BASE =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-[13.5px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50';

export const BTN = {
  primary: cn(BTN_BASE, TK.focus, 'bg-primary text-primary-foreground hover:bg-primary/90'),
  soft: cn(BTN_BASE, TK.focus, 'border border-border bg-card text-foreground hover:bg-accent'),
  ghost: cn(BTN_BASE, TK.focus, 'text-foreground hover:bg-accent'),
  danger: cn(BTN_BASE, TK.focus, 'border border-red-200 bg-card text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40'),
  dangerSolid: cn(BTN_BASE, TK.focus, 'bg-red-600 text-white hover:bg-red-700'),
  icon: cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent', TK.focus),
} as const;

/** Champ de saisie : 44 px de haut, bordure qui se renforce au survol. */
export const INPUT =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring';


/**
 * Lecture d'un montant tapé à la française, sans piège :
 *   « 1 000 000 », « 1.000.000 », « 1 000 000,50 », « 7266000 » → nombre.
 * Un point suivi de EXACTEMENT trois chiffres est un séparateur de milliers
 * (l'ancien champ lisait « 1.000.000 » comme 1). Le signe « − » est refusé.
 */
export function parseAmount(raw: string, decimals: number): number | null {
  let s = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(s) && decimals === 0) s = s.replace(/,/g, '');
  s = s.replace(',', '.');
  const parts = s.split('.');
  if (parts.length > 2) s = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
  const n = Number(s);
  // Au-delà de 2^53 le nombre n'est plus exact : refusé plutôt qu'arrondi.
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}


/** Longueur minimale d'un motif (ajustement, écart d'inventaire, annulation). */
export const REASON_MIN = 10;

/** Message d'un motif trop court ; rien tant qu'on n'a rien tapé ni validé. */
export function reasonError(reason: string, tried: boolean): string | null {
  const n = reason.trim().length;
  if (n >= REASON_MIN || (!tried && n === 0)) return null;
  return n === 0 ? 'Le motif est obligatoire.' : `Encore ${REASON_MIN - n} caractère${REASON_MIN - n > 1 ? 's' : ''}.`;
}

/** Opérations par page dans les tables. */
export const PAGE_SIZE = 25;
