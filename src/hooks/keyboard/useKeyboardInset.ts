import * as React from 'react';

/**
 * Returns the on-screen keyboard height in pixels, working correctly in BOTH
 * mainstream modes used by browsers in 2026:
 *
 *   1. Chrome Android (and other Blink-based) with `navigator.virtualKeyboard.
 *      overlaysContent = true` — the layout viewport does NOT shrink, so we
 *      MUST read `navigator.virtualKeyboard.boundingRect.height` to know how
 *      much of the screen the keyboard hides.
 *
 *   2. iOS Safari + browsers without VirtualKeyboard API — the keyboard floats
 *      ON TOP of the layout viewport ; the visual viewport shrinks. We compute
 *      keyboard height as `window.innerHeight - visualViewport.height - vv.offsetTop`.
 *
 * The existing `useKeyboardHeight` hook in this codebase only handles case (2),
 * which is the bug seen on Android Chrome : it reports 0 even when the keyboard
 * is open, because `overlaysContent=true` is enabled globally by
 * `useVirtualKeyboardOverlay` in `KeyboardFocusManager`.
 *
 * Use this hook on screens where the layout must visually adapt to the keyboard
 * (chat detail page, full-height forms). Subtract the returned value from your
 * container height : `style={{ height: 'calc(100dvh - ' + inset + 'px)' }}`.
 */
export function useKeyboardInset(threshold = 80): number {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    // ─── Method 1 : VirtualKeyboard API (Chrome Android, Edge Android) ───
    type VK = {
      boundingRect: DOMRect;
      addEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
      removeEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
    };
    const vk = (navigator as unknown as { virtualKeyboard?: VK }).virtualKeyboard;

    if (vk?.boundingRect && 'addEventListener' in vk) {
      const onGeometryChange = () => {
        const h = vk.boundingRect?.height ?? 0;
        setHeight(h > threshold ? h : 0);
      };
      onGeometryChange();
      vk.addEventListener('geometrychange', onGeometryChange);
      return () => vk.removeEventListener('geometrychange', onGeometryChange);
    }

    // ─── Method 2 : VisualViewport (iOS Safari, fallback) ───
    const vv = window.visualViewport;
    if (vv) {
      const onChange = () => {
        const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setHeight(diff > threshold ? diff : 0);
      };
      onChange();
      vv.addEventListener('resize', onChange);
      vv.addEventListener('scroll', onChange);
      return () => {
        vv.removeEventListener('resize', onChange);
        vv.removeEventListener('scroll', onChange);
      };
    }

    // ─── Method 3 : crude fallback (window.resize) ───
    let lastHeight = window.innerHeight;
    const onResize = () => {
      const delta = lastHeight - window.innerHeight;
      if (delta > threshold) setHeight(delta);
      else setHeight(0);
      lastHeight = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [threshold]);

  return height;
}
