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
 *   2. iOS Safari + browsers without VirtualKeyboard API — we compute the
 *      keyboard height from `visualViewport`. BUT iOS Safari's URL bar also
 *      affects visualViewport.height : when the URL bar is expanded, the diff
 *      `innerHeight - vv.height` is ~88px even with no keyboard open. We
 *      gate the value behind "an input or textarea is currently focused" to
 *      avoid mistaking the URL bar collapse for the keyboard.
 *
 * Use this hook on screens where the layout must visually adapt to the keyboard
 * (chat detail page, full-height forms). Subtract the returned value from your
 * container height : `style={{ height: 'calc(100dvh - ' + inset + 'px)' }}`.
 */
export function useKeyboardInset(threshold = 100): number {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    type VK = {
      boundingRect: DOMRect;
      addEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
      removeEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
    };
    const vk = (navigator as unknown as { virtualKeyboard?: VK }).virtualKeyboard;

    // ─── Method 1 : VirtualKeyboard API (Chrome Android, Edge Android) ───
    // Fire-and-forget : sur Chrome Android, ce geometrychange event ne se
    // déclenche QUE quand le clavier change vraiment. Pas de bruit URL bar.
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
    // On vérifie qu'un input est focusé, sinon on retourne 0 (sinon on
    // confond URL bar et clavier sur iOS Safari).
    const isInputFocused = (): boolean => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.isContentEditable
      );
    };

    const vv = window.visualViewport;
    if (vv) {
      const onChange = () => {
        if (!isInputFocused()) {
          setHeight(0);
          return;
        }
        const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setHeight(diff > threshold ? diff : 0);
      };
      const onBlur = () => setHeight(0);

      onChange();
      vv.addEventListener('resize', onChange);
      vv.addEventListener('scroll', onChange);
      document.addEventListener('focusin', onChange);
      document.addEventListener('focusout', onBlur);
      return () => {
        vv.removeEventListener('resize', onChange);
        vv.removeEventListener('scroll', onChange);
        document.removeEventListener('focusin', onChange);
        document.removeEventListener('focusout', onBlur);
      };
    }

    // ─── Method 3 : crude fallback (window.resize) ───
    let lastHeight = window.innerHeight;
    const onResize = () => {
      const delta = lastHeight - window.innerHeight;
      if (delta > threshold && isInputFocused()) setHeight(delta);
      else setHeight(0);
      lastHeight = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [threshold]);

  return height;
}
