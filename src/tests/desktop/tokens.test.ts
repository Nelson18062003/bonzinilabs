/**
 * Width tiers replace the single 1024px switch + 1400px cap that made a 13"
 * laptop and a 34" ultrawide render identically.
 */
import { describe, it, expect } from 'vitest';
import { BREAKPOINT, LAYOUT, tierFor, inspectorFits } from '@/desktop/kit/tokens';

describe('tierFor', () => {
  it('maps real screen widths to the right tier', () => {
    expect(tierFor(1280)).toBe('compact');  // 13" laptop
    expect(tierFor(1440)).toBe('standard'); // 15" laptop
    expect(tierFor(1728)).toBe('standard'); // 16" MacBook Pro
    expect(tierFor(1920)).toBe('wide');     // 24" monitor
    expect(tierFor(2560)).toBe('wide');     // 27" monitor
    expect(tierFor(3440)).toBe('wide');     // ultrawide
  });

  it('is inclusive at each boundary', () => {
    expect(tierFor(BREAKPOINT.standard)).toBe('standard');
    expect(tierFor(BREAKPOINT.standard - 1)).toBe('compact');
    expect(tierFor(BREAKPOINT.wide)).toBe('wide');
    expect(tierFor(BREAKPOINT.wide - 1)).toBe('standard');
  });
});

describe('contentMax', () => {
  it('leaves the widest tier uncapped so the queue uses the monitor', () => {
    expect(LAYOUT.contentMax.wide).toBeNull();
  });

  it('caps narrower tiers, and never below the old 1400', () => {
    expect(LAYOUT.contentMax.compact).toBeLessThan(LAYOUT.contentMax.standard!);
    expect(LAYOUT.contentMax.standard).toBeGreaterThan(1400);
  });
});

describe('inspectorFits', () => {
  const rail = LAYOUT.railWidth;

  it('docks on a 27" monitor', () => {
    expect(inspectorFits(2560, 'wide', rail)).toBe(true);
  });

  it('docks on a 16" laptop', () => {
    expect(inspectorFits(1728, 'standard', rail)).toBe(true);
  });

  it('overlays on a 13" laptop rather than crushing the queue', () => {
    // 1280 − 240 rail − 480 panel = 560, under the 620 legible minimum.
    expect(inspectorFits(1280, 'compact', rail)).toBe(false);
  });

  it('docks on that same 13" screen once the rail is collapsed', () => {
    expect(inspectorFits(1280, 'compact', LAYOUT.railWidthCollapsed)).toBe(true);
  });

  it('never leaves the queue below its legible minimum when it reports a fit', () => {
    for (const [width, tier] of [[1280, 'compact'], [1440, 'standard'], [2560, 'wide']] as const) {
      if (inspectorFits(width, tier, rail)) {
        expect(width - rail - LAYOUT.inspectorWidth[tier]).toBeGreaterThanOrEqual(LAYOUT.queueMinWidth);
      }
    }
  });
});

describe('inspector width', () => {
  it('is wider than the 460px column it replaces, at every tier', () => {
    for (const tier of ['compact', 'standard', 'wide'] as const) {
      expect(LAYOUT.inspectorWidth[tier]).toBeGreaterThan(460);
    }
  });

  it('grows with the tier', () => {
    expect(LAYOUT.inspectorWidth.compact).toBeLessThan(LAYOUT.inspectorWidth.standard);
    expect(LAYOUT.inspectorWidth.standard).toBeLessThan(LAYOUT.inspectorWidth.wide);
  });
});
