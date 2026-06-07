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
  /** Soft diffuse shadow (replaces hard borders). Dark mode: ring instead. */
  shadow: 'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.18)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
  /** Neutral round holder for icons/initials. */
  holder: 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]',
} as const;

/** Foreground text tokens (neutral-first). */
export const TEXT = {
  strong: 'text-[#1B1A24] dark:text-[#F2F1F7]',
  muted: 'text-[#8E8BA0] dark:text-[#9B98AD]',
} as const;

/** Dark "pill" — the ONE primary action of a screen. */
export const PRIMARY_PILL =
  'rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]';
/** Soft secondary pill. */
export const SOFT_PILL =
  'rounded-full bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]';

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
