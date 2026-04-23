/**
 * iOS Safari auto-zoom regression test.
 *
 * iOS Safari zooms into any <input>/<textarea>/<select> whose computed
 * font-size is < 16px when it receives focus. The page never zooms back
 * out on blur, which breaks the layout. This test walks every screen
 * that hosts form controls and asserts the 16px floor — on both iPhone
 * and iPad emulation, because shadcn's default `text-base sm:text-sm`
 * drops to 14px above the 640px breakpoint.
 *
 * If any input drops below 16px, the test fails with the control's
 * selector + actual size, so the offending element is obvious.
 */

import { test, expect, type Page } from '@playwright/test';

const IOS_MIN_FONT_SIZE = 16;

/**
 * Asserts every enabled <input>/<textarea>/<select> on the current page
 * has computedStyle.fontSize >= 16px. Skips file/checkbox/radio/range/
 * hidden/button/submit/reset/color/image inputs — those never trigger
 * the zoom.
 */
async function assertNoIOSZoomRisk(page: Page, screenLabel: string) {
  const offenders = await page.evaluate((minPx) => {
    const SKIPPED_INPUT_TYPES = new Set([
      'file', 'checkbox', 'radio', 'range', 'hidden',
      'button', 'submit', 'reset', 'color', 'image',
    ]);
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('input, textarea, select'),
    );
    const bad: Array<{ selector: string; fontSize: number; tag: string; type: string }> = [];
    for (const el of nodes) {
      if (el.tagName === 'INPUT') {
        const type = (el as HTMLInputElement).type || 'text';
        if (SKIPPED_INPUT_TYPES.has(type)) continue;
      }
      const cs = window.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (Number.isNaN(fs) || fs < minPx) {
        // Build a debug selector so failures pinpoint the control.
        const id = el.id ? `#${el.id}` : '';
        const name = (el as HTMLInputElement).name;
        const nameSel = name ? `[name="${name}"]` : '';
        const placeholder = (el as HTMLInputElement).placeholder;
        const phSel = placeholder ? `[placeholder="${placeholder}"]` : '';
        const aria = el.getAttribute('aria-label');
        const ariaSel = aria ? `[aria-label="${aria}"]` : '';
        bad.push({
          selector:
            `${el.tagName.toLowerCase()}${id}${nameSel}${phSel}${ariaSel}` || el.tagName.toLowerCase(),
          fontSize: fs,
          tag: el.tagName.toLowerCase(),
          type: el.tagName === 'INPUT' ? (el as HTMLInputElement).type : el.tagName.toLowerCase(),
        });
      }
    }
    return bad;
  }, IOS_MIN_FONT_SIZE);

  expect(
    offenders,
    `Screen "${screenLabel}" has ${offenders.length} control(s) with font-size < ${IOS_MIN_FONT_SIZE}px — iOS Safari will auto-zoom on focus:\n` +
      offenders.map((o) => `  • ${o.selector} → ${o.fontSize}px`).join('\n'),
  ).toEqual([]);
}

/**
 * Focuses each input/textarea/select on the page in turn — the test
 * passes only if none of them reduced below 16px on focus (some CSS
 * rules apply `:focus` styles that change size).
 */
async function assertFocusDoesNotShrink(page: Page, screenLabel: string) {
  const locators = page.locator('input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=color]):not([type=image]), textarea, select');
  const count = await locators.count();
  for (let i = 0; i < count; i++) {
    const el = locators.nth(i);
    if (!(await el.isEditable().catch(() => false))) continue;
    await el.focus({ timeout: 2_000 }).catch(() => { /* some elements refuse focus — ignore */ });
    const fontSize = await el.evaluate((node) =>
      parseFloat(window.getComputedStyle(node as HTMLElement).fontSize),
    );
    expect(
      fontSize,
      `Screen "${screenLabel}" → input ${i} shrinks to ${fontSize}px on focus (≥ ${IOS_MIN_FONT_SIZE}px required).`,
    ).toBeGreaterThanOrEqual(IOS_MIN_FONT_SIZE);
    await el.blur().catch(() => {});
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Screens to cover — every public/dev route that hosts form controls.
// ────────────────────────────────────────────────────────────────────────────

const PUBLIC_SCREENS: Array<{ label: string; path: string }> = [
  { label: 'Landing', path: '/' },
  { label: 'Client auth', path: '/auth' },
  { label: 'Mobile admin login', path: '/m/login' },
  { label: 'Agent cash login', path: '/a/login' },
  { label: 'Form primitives showcase (dev-only)', path: '/dev/form-showcase' },
];

for (const { label, path } of PUBLIC_SCREENS) {
  test(`${label} — every input ≥ ${IOS_MIN_FONT_SIZE}px`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // Give the app a moment to hydrate & render lazy-loaded screens.
    await page.waitForLoadState('networkidle').catch(() => {});
    await assertNoIOSZoomRisk(page, label);
  });

  test(`${label} — no input shrinks below ${IOS_MIN_FONT_SIZE}px on focus`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await assertFocusDoesNotShrink(page, label);
  });
}
