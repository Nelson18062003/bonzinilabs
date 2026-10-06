// ============================================================
// ESPACE COMMERCIAL — les classes du langage visuel de « /v » (inspiré de
// beautifului.dev). Les couleurs, ombres et animations vivent dans
// src/index.css, sous `.sales-ui` (posée par CommercialShell) ; ici, les
// gabarits (hauteur, rayon, taille du texte) qui les accompagnent.
//
// Échelle « téléphone » : les primitives d'origine sont dessinées pour un
// bureau (13 px, contrôles de 28 px) ; le commercial travaille debout, au
// soleil, d'une main — texte de 15 à 17 px, cibles de 44 px au moins.
// ============================================================
import { cn } from '@/lib/utils';
import type { ProspectStatus } from '@/lib/sales';

export type BtnVariant = 'ink' | 'quiet' | 'ghost' | 'danger' | 'red' | 'whatsapp';
export type BtnSize = 'xl' | 'lg' | 'md' | 'sm' | 'icon' | 'icon-sm';

const BTN_SIZE: Record<BtnSize, string> = {
  xl: 'h-14 rounded-2xl px-6 text-[17px]',
  lg: 'h-12 rounded-[14px] px-5 text-[16px]',
  md: 'h-11 rounded-xl px-4 text-[15px]',
  sm: 'h-9 rounded-[10px] px-3 text-[14px]',
  icon: 'h-11 w-11 shrink-0 rounded-full',
  'icon-sm': 'h-9 w-9 shrink-0 rounded-full',
};

/** Un bouton (ou un lien qui en a l'air) : `btn('ink', 'xl')`. */
export function btn(variant: BtnVariant, size: BtnSize = 'md', extra?: string): string {
  return cn('s-btn', `s-btn-${variant}`, BTN_SIZE[size], extra);
}

/** La carte : surface blanche, filet d'un pixel, ombre en couches. */
export const CARD = 's-card rounded-[18px]';
/** Le champ d'une ligne : rempli, sans bord, 52 px. */
export const FIELD = 's-input h-[52px] w-full rounded-[14px] px-4 text-[17px]';
/** Le champ long. */
export const AREA = 's-input block w-full resize-none rounded-[14px] px-4 py-3.5 text-[17px] leading-relaxed';
/** Une pastille à choisir (intérêts, villes, libellés). */
export const CHIP = 's-chip inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium';
/** L'identifiant de l'erreur ou de l'indice d'un champ (`Field`) : à poser en `aria-describedby` sur le contrôle. */
export const descId = (htmlFor: string) => `${htmlFor}-desc`;
/** Le titre d'une section de carte. */
export const SECTION_TITLE = 'text-[13px] font-semibold uppercase tracking-[0.06em] s-ink-3';

/** La couleur de l'étiquette d'un statut (« À contacter » bleu, « Contacté » ambre, « Intéressé » violet…). */
export const STATUS_TONE: Record<ProspectStatus, 'info' | 'pending' | 'accent' | 'success' | 'neutral'> = {
  new: 'info',
  contacted: 'pending',
  interested: 'accent',
  won: 'success',
  lost: 'neutral',
};
