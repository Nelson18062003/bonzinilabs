/**
 * Design kit — SINGLE source of truth for the mobile app's visual language,
 * distilled from the validated Ofspace/Mola reference:
 *   soft tinted canvas · white cards with a soft diffuse shadow (no hard border)
 *   · NEUTRAL round holders · dark pills · big neutral figures · restrained color
 *   (color carries meaning only). No gradients, no divider lines.
 *
 * Phase 0 of the refonte (docs/audit-refonte-mobile.md). Screens migrate onto
 * these tokens module by module so the whole app speaks ONE language.
 */

/** App surfaces. */
export const SURFACE = {
  /** Calm screen background. */
  canvas: 'bg-[#ECEAF7] dark:bg-[#141320]',
  /** Primary elevated surface. */
  card: 'bg-white dark:bg-[#211F2B]',
  /** Surface delineation: a crisp hairline ring — flat, no drop shadows.
   *  (Was a soft diffuse shadow; removed app-wide on the founder's decision —
   *  the diffuse blur under every surface read as disorganised. Borders give
   *  the same separation with more structure.) */
  shadow: 'ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
  /** Neutral round holder for icons/initials. */
  holder: 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]',
  /** « surface-2 » : encart posé SUR une carte (valeur calculée, récapitulatif,
   *  en-tête de table). Spécifiée par 02-foundation.md §1.1 ; les écrans la
   *  bricolaient jusqu'ici en `bg-muted/60`, qui dérive d'un écran à l'autre. */
  inset: 'bg-[#F6F5FB] dark:bg-[#2A2836]',
} as const;

/** Foreground text tokens (neutral-first). */
export const TEXT = {
  strong: 'text-[#1B1A24] dark:text-[#F2F1F7]',
  /** Gris intermédiaire — 02-foundation.md §1.1 : « une table où chaque
   *  cellule est soit noir-gras soit gris-pâle produit un damier ». Le corps
   *  de texte porte le gros des cellules. */
  body: 'text-[#4A475C] dark:text-[#C9C6D6]',
  muted: 'text-[#8E8BA0] dark:text-[#9B98AD]',
} as const;

/** Dark "pill" — the ONE primary action of a screen. */
export const PRIMARY_PILL =
  'rounded-full bg-[#1C1B22] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#C9C2F0] dark:bg-[#F2F1F7] dark:text-[#1B1A24] dark:focus-visible:ring-[#4A4660]';
/** Soft secondary pill. */
export const SOFT_PILL =
  'rounded-full bg-[#EDEAFA] text-[#2C2740] outline-none focus-visible:ring-2 focus-visible:ring-[#C9C2F0] dark:bg-[#2F2C3D] dark:text-[#E7E5F0] dark:focus-visible:ring-[#4A4660]';

/** Semantic tones — color ONLY where it carries meaning. */
export type Tone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

/** Soft status-pill classes per tone (bg + text, light + dark). */
export const TONE_PILL: Record<Tone, string> = {
  success: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
  pending: 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]',
  danger: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
  info: 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]',
  neutral: 'bg-muted text-muted-foreground',
};

/** Soft holder classes per tone (tinted bg + colored glyph) — for result/status icons. */
export const TONE_HOLDER: Record<Tone, string> = {
  success: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
  pending: 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]',
  danger: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
  info: 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]',
  neutral: SURFACE.holder,
};
