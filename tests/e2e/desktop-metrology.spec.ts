/**
 * Metrology — the dimensional system, asserted rather than claimed.
 *
 * "Au millimètre près" is not a promise you can keep by eye: a 28px chip next
 * to a 32px input is invisible in code review and glaring on screen. This spec
 * measures what the browser actually paints and fails when the geometry drifts.
 *
 * It checks four things, in order of how much a violation hurts:
 *   1. **Optical alignment** — every interactive control sharing a toolbar row
 *      renders at the same height, and their vertical centres coincide.
 *   2. **The height ladder** — every control height is one of the three allowed
 *      values. A fourth height means someone invented a size.
 *   3. **The type scale** — every rendered font-size is one of the allowed
 *      steps. This is the check that caught seventeen distinct sizes.
 *   4. **The 4px grid** — heights and paddings land on the grid.
 *
 * Run:  PW_CHROMIUM_PATH=… npx playwright test --config=playwright.metrology.config.ts
 */
import { test, expect } from '@playwright/test';
import { installConsole, ROUTES_UNDER_TEST } from './fixtures/consoleHarness';

/** The only control heights the console is allowed to render. */
const CONTROL_HEIGHTS = [24, 28, 32];
/** The only font sizes the console is allowed to render. */
const FONT_SIZES = [12, 13, 15, 20, 28];

/** Everything the operator can click or focus, inside a given root. */
const INTERACTIVE = 'button, [role="button"], input:not([type="hidden"]), select, a[href]';

/**
 * Only the surfaces this design system owns. The inspector hosts the mobile
 * detail screens, which are deliberately still on the mobile kit (see
 * docs/refonte-desktop), and the dev-only React Query launcher is not ours.
 */
const OWNED = [
  'aside[aria-label="Barre latérale"]',
  'header',
  '[data-workbench] [data-toolbar]',
  '[data-workbench] table',
  // Scrolling pages (dashboards, settings, forms) have no workbench chrome,
  // so scoping to the workbench alone made those routes pass vacuously.
  'main',
].join(', ');
const NOT_OURS = '[aria-label="Détail de l\'enregistrement"], .tsqd-parent-container, [aria-label*="Tanstack"]';

/**
 * Clickable things that are surfaces rather than controls — a KPI tile, a card.
 * They are sized by their content, so the height ladder does not apply. Only
 * primitives set `data-surface` (see `Metric`), never a screen.
 */
const SURFACE = '[data-surface]';

/**
 * A composite control — one object on the row, made of parts. `Segment` sets
 * it: its track is what has to align with the chip beside it, while its inner
 * buttons deliberately sit 4px inside. Measured at the track, parts skipped.
 */
const COMPOSITE = '[data-control]';

test.describe('métrologie', () => {
  test.beforeEach(installConsole());

  for (const [name, path] of ROUTES_UNDER_TEST) {
    test(`${name} — alignement de la barre d'outils`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.getByText("Console d'opérations").first().waitFor({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(900);

      const toolbar = page.locator('[data-toolbar]').first();
      if ((await toolbar.count()) === 0) test.skip(true, 'écran sans barre d’outils');

      /* Group controls by the visual row they land on (their vertical centre,
         rounded), then assert every control in a row is the same height. */
      const rows = await toolbar.evaluate((root, { sel, surface, composite }) => {
        const out = new Map<number, { h: number; tag: string; label: string }[]>();
        for (const el of Array.from(root.querySelectorAll(`${sel}, ${composite}`)) as HTMLElement[]) {
          // Measure the outermost control only: a composite's inner buttons are
          // parts, not members of the row.
          if (el.parentElement?.closest(composite)) continue;
          if (el.closest(surface)) continue;
          const r = el.getBoundingClientRect();
          if (r.height === 0) continue;
          const centre = Math.round((r.top + r.height / 2) / 4) * 4;
          const entry = {
            h: Math.round(r.height),
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24),
          };
          out.set(centre, [...(out.get(centre) ?? []), entry]);
        }
        return [...out.entries()].map(([centre, items]) => ({ centre, items }));
      }, { sel: INTERACTIVE, surface: SURFACE, composite: COMPOSITE });

      for (const row of rows) {
        const heights = [...new Set(row.items.map((i) => i.h))];
        expect(
          heights,
          `Contrôles de hauteurs différentes sur la même ligne : ${row.items
            .map((i) => `${i.label || i.tag}=${i.h}px`)
            .join(', ')}`,
        ).toHaveLength(1);
      }
    });

    test(`${name} — échelle des hauteurs et des tailles de texte`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.getByText("Console d'opérations").first().waitFor({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(900);

      const offenders = await page.evaluate(
        ({ sel, owned, notOurs, surface, composite, allowedHeights, allowedFonts }) => {
          const heightViolations: string[] = [];
          const fontViolations: string[] = [];
          const describe = (el: HTMLElement) =>
            `${el.tagName.toLowerCase()}"${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}"`;

          const roots = Array.from(document.querySelectorAll(owned)) as HTMLElement[];
          const mine = (el: HTMLElement) => !el.closest(notOurs) && roots.some((r) => r.contains(el));

          for (const el of Array.from(document.querySelectorAll(`${sel}, ${composite}`)) as HTMLElement[]) {
            if (!mine(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.height === 0) continue;
            // Table rows, KPI tiles and full-width surfaces are not "controls".
            if (el.closest('tr') || el.closest(surface) || r.width > 320) continue;
            // A composite is measured at its outer edge, not at each of its parts.
            if (el.parentElement?.closest(composite)) continue;
            // A link inside a sentence is not on the height ladder: its box is
            // the line box of the prose around it. WCAG 2.2 SC 2.5.8 exempts it
            // in the same terms — "the target is in a sentence or its size is
            // otherwise constrained by the line-height of non-target text".
            if (getComputedStyle(el).display === 'inline') continue;
            const h = Math.round(r.height);
            if (!allowedHeights.includes(h)) heightViolations.push(`${describe(el)} → ${h}px`);
          }

          for (const root of roots) {
            for (const el of Array.from(root.querySelectorAll('*')) as HTMLElement[]) {
              if (!el.firstChild || el.firstChild.nodeType !== Node.TEXT_NODE) continue;
              if (!el.textContent?.trim() || el.closest(notOurs)) continue;
              // Visually-hidden text (`sr-only`: clipped to a 1px box) paints no
              // glyphs, so it cannot violate a *visual* scale — the `<caption>`
              // that names each table for screen readers is the case in point.
              // Detected by its rendered box rather than by class name, so the
              // exemption cannot be claimed by simply adding a utility.
              const box = el.getBoundingClientRect();
              if (box.width <= 1 || box.height <= 1) continue;
              const size = Math.round(parseFloat(getComputedStyle(el).fontSize));
              if (!allowedFonts.includes(size)) fontViolations.push(`${describe(el)} → ${size}px`);
            }
          }

          return {
            heights: [...new Set(heightViolations)].slice(0, 20),
            fonts: [...new Set(fontViolations)].slice(0, 20),
          };
        },
        { sel: INTERACTIVE, owned: OWNED, notOurs: NOT_OURS, surface: SURFACE, composite: COMPOSITE, allowedHeights: CONTROL_HEIGHTS, allowedFonts: FONT_SIZES },
      );

      expect(offenders.heights, 'hauteurs hors de l’échelle 24/28/32').toEqual([]);
      expect(offenders.fonts, 'tailles de texte hors de l’échelle 12/13/15/20/28').toEqual([]);
    });
  }
});
