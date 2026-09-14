import * as React from 'react';

/**
 * Single source of truth for the VISIBLE viewport geometry.
 *
 * Writes CSS custom properties on the document root, updated from ONE
 * rAF-throttled listener (so the on-screen keyboard animation never triggers a
 * React re-render):
 *
 *   --vvh : height of the visual viewport, in px. Shrinks to the area ABOVE the
 *           on-screen keyboard — provided the page is NOT in VirtualKeyboard
 *           `overlaysContent` mode (see KeyboardFocusManager). True on both iOS
 *           Safari and Android Chrome in default / resize modes.
 *   --vvt : offsetTop of the visual viewport, in px. ~0 when the document is
 *           locked, but anchors a fixed shell correctly during transitions.
 *   --vvk : estimated height of the on-screen keyboard, in px (0 when closed).
 *           Lets a composer drop the tab-bar clearance while the keyboard is up.
 *
 * Also toggles `html.kb-open` while an editable control has the focus and the
 * visible height has shrunk (the tab bar hides itself under that class).
 *
 * iOS Safari quirks this guards against (seen on device, 13/09/2026 : shell
 * stuck ~200 px down and cut to the keyboard-open height after the keyboard
 * closed) :
 *   • `visualViewport.offsetTop` is reset AFTER the `resize` event, without a
 *     matching `scroll` event → every event re-reads the geometry again a few
 *     frames later (settle timers), and `focusout` re-reads it too.
 *   • With the document locked (`html.viewport-locked`), Safari can still pan
 *     the document programmatically to reveal the focused input, and leaves it
 *     panned → once the keyboard is gone we scroll the locked document back to 0.
 *   • Any touch re-reads the geometry: the user's first tap after a stale state
 *     repairs it.
 *
 * Consumers (e.g. <ViewportShell>) anchor to `var(--vvh)` / `var(--vvt)`.
 * Before this runs, or on browsers without the VisualViewport API, consumers
 * fall back to `100dvh` / `0px` (the :root fallbacks in index.css).
 *
 * Mount ONCE at the app root.
 *
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 */

/** Delays (ms) at which the geometry is re-read after any event. */
export const SETTLE_DELAYS_MS = [80, 260, 600] as const;

/** Below this shrink (px) we do not call it a keyboard (URL bar dance, etc.). */
export const KEYBOARD_MIN_PX = 100;

export interface ViewportSample {
  /** visualViewport.height (or window.innerHeight). */
  height: number;
  /** visualViewport.offsetTop (or 0). */
  offsetTop: number;
  /** Does an editable control (input/textarea/select/contenteditable) have the focus ? */
  editableFocused: boolean;
  /** Visible height last seen with NO editable focused — the "keyboard closed" height. */
  baseHeight: number;
}

export interface ViewportVars {
  vvh: number;
  vvt: number;
  vvk: number;
  keyboardOpen: boolean;
  /** Updated base height to carry to the next sample. */
  baseHeight: number;
}

/** Pure geometry rule — unit-tested in src/tests/lib/visibleViewport.test.ts. */
export function computeViewportVars(s: ViewportSample): ViewportVars {
  const h = Math.round(s.height);
  const t = Math.round(s.offsetTop);
  // Keyboard closed (no editable focused) : whatever we see is the base height.
  // Keyboard open : the base can only grow (rotation), never shrink to the
  // keyboard-open height, otherwise the keyboard would read as 0 px.
  const baseHeight = s.editableFocused ? Math.max(s.baseHeight, h) : h;
  const shrink = Math.max(0, baseHeight - h);
  const keyboardOpen = s.editableFocused && shrink >= KEYBOARD_MIN_PX;
  const vvk = keyboardOpen ? shrink : 0;
  return { vvh: h, vvt: t, vvk, keyboardOpen, baseHeight };
}

export function isEditableElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    return type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'file' && type !== 'checkbox' && type !== 'radio' && type !== 'range';
  }
  return el.isContentEditable;
}

export function useVisibleViewportSync(): void {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let raf = 0;
    let timers: number[] = [];
    let baseHeight = vv ? vv.height : window.innerHeight;

    const apply = () => {
      raf = 0;
      const vars = computeViewportVars({
        height: vv ? vv.height : window.innerHeight,
        offsetTop: vv ? vv.offsetTop : 0,
        editableFocused: isEditableElement(document.activeElement),
        baseHeight,
      });
      baseHeight = vars.baseHeight;
      root.style.setProperty('--vvh', `${vars.vvh}px`);
      root.style.setProperty('--vvt', `${vars.vvt}px`);
      root.style.setProperty('--vvk', `${vars.vvk}px`);
      root.classList.toggle('kb-open', vars.keyboardOpen);
      // Locked document (chat shells) : nothing may stay panned once the
      // keyboard is gone — Safari does not undo its own programmatic pan.
      if (!vars.keyboardOpen && root.classList.contains('viewport-locked') && (window.scrollY !== 0 || window.scrollX !== 0)) {
        window.scrollTo(0, 0);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    // Re-read a few frames later : iOS finishes moving the visual viewport
    // after the event that announced it.
    const settle = () => {
      schedule();
      timers.forEach((id) => window.clearTimeout(id));
      timers = SETTLE_DELAYS_MS.map((ms) => window.setTimeout(schedule, ms));
    };

    apply();
    if (vv) {
      vv.addEventListener('resize', settle);
      vv.addEventListener('scroll', settle);
    }
    window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    document.addEventListener('focusin', settle);
    document.addEventListener('focusout', settle);
    window.addEventListener('touchstart', schedule, { passive: true });
    window.addEventListener('touchend', schedule, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      if (vv) {
        vv.removeEventListener('resize', settle);
        vv.removeEventListener('scroll', settle);
      }
      window.removeEventListener('resize', settle);
      window.removeEventListener('orientationchange', settle);
      document.removeEventListener('focusin', settle);
      document.removeEventListener('focusout', settle);
      window.removeEventListener('touchstart', schedule);
      window.removeEventListener('touchend', schedule);
      root.classList.remove('kb-open');
      root.style.removeProperty('--vvk');
    };
  }, []);
}
