import * as React from 'react';

/**
 * Single source of truth for the VISIBLE viewport geometry.
 *
 * Writes two CSS custom properties on the document root, updated from ONE
 * rAF-throttled listener (so the on-screen keyboard animation never triggers a
 * React re-render):
 *
 *   --vvh : height of the visual viewport, in px. Shrinks to the area ABOVE the
 *           on-screen keyboard — provided the page is NOT in VirtualKeyboard
 *           `overlaysContent` mode (see KeyboardFocusManager). True on both iOS
 *           Safari and Android Chrome in default / resize modes.
 *   --vvt : offsetTop of the visual viewport, in px. ~0 when the document is
 *           locked, but anchors a fixed shell correctly during transitions.
 *
 * Consumers (e.g. <ViewportShell>) anchor to `var(--vvh)` / `var(--vvt)`.
 * Before this runs, or on browsers without the VisualViewport API, consumers
 * fall back to `100dvh` / `0px` (the :root fallbacks in index.css).
 *
 * Mount ONCE at the app root.
 *
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 */
export function useVisibleViewportSync(): void {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const h = vv ? vv.height : window.innerHeight;
      const t = vv ? vv.offsetTop : 0;
      root.style.setProperty('--vvh', `${Math.round(h)}px`);
      root.style.setProperty('--vvt', `${Math.round(t)}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    if (vv) {
      vv.addEventListener('resize', schedule);
      vv.addEventListener('scroll', schedule);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      }
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);
}
