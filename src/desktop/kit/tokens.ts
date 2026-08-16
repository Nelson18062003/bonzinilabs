/**
 * Desktop design tokens — the layer the mobile kit deliberately does not have.
 *
 * `src/mobile/designKit` owns COLOUR and TONE, and stays the single source of
 * truth for both apps: a payment "en cours" must be the same amber on a phone
 * and on a 27" monitor. What it cannot own is DENSITY and WIDTH, because those
 * are the two things a desktop needs and a phone has no opinion about.
 *
 * So this module adds exactly that — row heights, column padding, panel widths,
 * breakpoint tiers — and re-exports nothing. Import both:
 *
 *     import { SURFACE, TEXT } from '@/mobile/designKit';
 *     import { DENSITY, LAYOUT }  from '@/desktop/kit';
 *
 * The old shell capped content at 1400px on every screen, so a 13" laptop and a
 * 34" ultrawide got an identical layout and ~900px of the ultrawide went unused.
 * `LAYOUT.tier()` replaces that single cap with three real tiers.
 */

/** Row density — an operator setting, not a constant. */
export type Density = 'comfortable' | 'compact';

export const DENSITY: Record<Density, {
  /** Vertical padding on a body cell. */
  cellY: string;
  /** Horizontal padding on the first/last cell (the table gutter). */
  cellXEdge: string;
  /** Horizontal padding on inner cells. */
  cellX: string;
  /** Body text size. */
  text: string;
  /** Approximate row height in px — used for scroll-into-view maths. */
  rowHeight: number;
}> = {
  comfortable: {
    cellY: 'py-3',
    cellXEdge: 'px-5',
    cellX: 'px-2.5',
    text: 'text-[13px]',
    rowHeight: 52,
  },
  compact: {
    cellY: 'py-1.5',
    cellXEdge: 'px-4',
    cellX: 'px-2',
    text: 'text-[12.5px]',
    rowHeight: 36,
  },
};

/** Width tiers. A desktop is not one size. */
export type Tier = 'compact' | 'standard' | 'wide';

export const BREAKPOINT = {
  /** Below this the mobile app is used (see useIsDesktop). */
  desktop: 1024,
  /** Laptops. Rail collapses, inspector overlays rather than splits. */
  standard: 1440,
  /** Large monitors. Inspector becomes a genuine third column. */
  wide: 1920,
} as const;

export const LAYOUT = {
  /** Navigation rail, expanded / collapsed. */
  railWidth: 240,
  railWidthCollapsed: 64,

  /**
   * Inspector width per tier. The screen this replaces was a flat
   * `w-[min(460px,40vw)]`, which is where the fiche paiement's cramped single
   * column came from — 460px is a phone.
   */
  inspectorWidth: { compact: 480, standard: 560, wide: 680 } as Record<Tier, number>,

  /** Minimum the queue may shrink to before the inspector overlays instead. */
  queueMinWidth: 620,

  /**
   * Content cap per tier. `null` = no cap; the workbench is meant to use the
   * monitor. Prose-heavy screens opt into a narrower measure themselves.
   */
  contentMax: { compact: 1280, standard: 1720, wide: null } as Record<Tier, number | null>,

  /** Sticky offsets so table headers land under the topbar, not behind it. */
  topbarHeight: 64,
} as const;

/** Which tier a viewport width falls into. */
export function tierFor(width: number): Tier {
  if (width >= BREAKPOINT.wide) return 'wide';
  if (width >= BREAKPOINT.standard) return 'standard';
  return 'compact';
}

/**
 * At `wide` the inspector sits beside the queue permanently; below that the
 * queue would drop under `queueMinWidth`, so the inspector overlays instead.
 */
export function inspectorFits(viewportWidth: number, tier: Tier, railWidth: number): boolean {
  return viewportWidth - railWidth - LAYOUT.inspectorWidth[tier] >= LAYOUT.queueMinWidth;
}
