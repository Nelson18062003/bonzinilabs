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
/**
 * Refonte v2 (21/10/2026) : les champs et les pastilles de « /v » prennent
 * ceux du kit mobile — blanc, bord #949494, rayon 8, 56 px ; pastille grise,
 * noire quand elle est choisie.
 */
const V2_FIELD =
  'border border-[#949494] bg-white text-[#1E1E1E] outline-none transition-colors placeholder:text-[#757575] focus:border-[#2C2C2C] focus:ring-1 focus:ring-[#2C2C2C] ' +
  'aria-[invalid=true]:border-[#C00F0C] disabled:opacity-55 dark:border-[#6E6E6E] dark:bg-[#2C2C2C] dark:text-[#F5F5F5] dark:placeholder:text-[#B3B3B3] dark:focus:border-[#E3E3E3] dark:focus:ring-[#E3E3E3]';
/** Le champ d'une ligne : 56 px. */
export const FIELD = cn(V2_FIELD, 'h-14 w-full rounded-lg px-4 text-[17px]');
/** Le champ long. */
export const AREA = cn(V2_FIELD, 'block w-full resize-none rounded-lg px-4 py-3.5 text-[17px] leading-relaxed');
/** Une pastille à choisir (intérêts, villes, libellés). */
export const CHIP =
  'inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#F5F5F5] px-3 text-[16px] font-semibold text-[#303030] transition-colors active:bg-[#E6E6E6] ' +
  'aria-pressed:bg-[#2C2C2C] aria-pressed:text-[#F5F5F5] aria-checked:bg-[#2C2C2C] aria-checked:text-[#F5F5F5] dark:bg-[#383838] dark:text-[#E3E3E3]';
/** L'identifiant de l'erreur ou de l'indice d'un champ (`Field`) : à poser en `aria-describedby` sur le contrôle. */
export const descId = (htmlFor: string) => `${htmlFor}-desc`;
/** Le titre d'une section de carte. */
export const SECTION_TITLE = 'text-[13px] font-semibold uppercase tracking-[0.06em] s-ink-3';

/**
 * La couleur de l'étiquette d'un statut (« À contacter » bleu, « Contacté »
 * ambre, « Intéressé » violet, « À vérifier » orange — la direction doit
 * trancher —, « Devenu client » vert, « Perdu » gris).
 */
export const STATUS_TONE: Record<ProspectStatus, 'info' | 'pending' | 'accent' | 'warn' | 'success' | 'neutral'> = {
  new: 'info',
  contacted: 'pending',
  interested: 'accent',
  to_verify: 'warn',
  won: 'success',
  lost: 'neutral',
};
