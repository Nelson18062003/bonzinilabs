import * as React from 'react';

/**
 * Returns a CSS height value that correctly represents the visible area of
 * the viewport (taking the on-screen keyboard into account), for use on
 * full-height chat-style screens where the input bar must always sit just
 * above the keyboard.
 *
 * Strategy by platform :
 *
 *   • Chrome Android / Edge Android (VirtualKeyboard API + overlaysContent=true,
 *     set globally by useVirtualKeyboardOverlay in KeyboardFocusManager) :
 *       the keyboard "overlays" the content, layout viewport doesn't shrink.
 *       → height = calc(100dvh - virtualKeyboard.boundingRect.height)
 *
 *   • iOS Safari + everywhere else :
 *       use `visualViewport.height + 'px'` directly. This is the EXACT visible
 *       area (excluding URL bar, keyboard, form helper bar, etc.) — no math
 *       required, no double-subtraction risk.
 *
 *   • Server-side / before mount :
 *       fallback to '100dvh'.
 *
 * Why we abandoned `calc(100dvh - useKeyboardInset())` :
 *   On iOS Safari 16.4+, the meta tag `interactive-widget=resizes-content`
 *   makes 100dvh ALREADY shrink when the keyboard opens. Subtracting an
 *   additional kbInset (from VisualViewport diff) was a double-subtraction
 *   that produced a visible gap between input and keyboard.
 *
 * Returns a CSS height string ready to be applied : `style={{ height }}`.
 */
export function useViewportContainerHeight(): string {
  const [height, setHeight] = React.useState<string>('100dvh');

  React.useEffect(() => {
    type VK = {
      boundingRect: DOMRect;
      addEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
      removeEventListener: (type: 'geometrychange', cb: (e: Event) => void) => void;
    };
    const vk = (navigator as unknown as { virtualKeyboard?: VK }).virtualKeyboard;

    // ─── Method 1 : VirtualKeyboard API (Chrome Android) ───
    // Le clavier overlays le contenu, le layout viewport ne shrink pas.
    // On doit soustraire la hauteur du clavier manuellement.
    if (vk?.boundingRect && 'addEventListener' in vk) {
      const onChange = () => {
        const kb = vk.boundingRect?.height ?? 0;
        setHeight(kb > 0 ? `calc(100dvh - ${kb}px)` : '100dvh');
      };
      onChange();
      vk.addEventListener('geometrychange', onChange);
      return () => vk.removeEventListener('geometrychange', onChange);
    }

    // ─── Method 2 : VisualViewport (iOS Safari + tout le reste) ───
    // On utilise directement vv.height qui représente l'aire visible
    // exacte. Pas de calcul, pas de risque de double-soustraction.
    const vv = window.visualViewport;
    if (vv) {
      const onChange = () => {
        setHeight(`${Math.round(vv.height)}px`);
      };
      onChange();
      vv.addEventListener('resize', onChange);
      vv.addEventListener('scroll', onChange);
      return () => {
        vv.removeEventListener('resize', onChange);
        vv.removeEventListener('scroll', onChange);
      };
    }

    // ─── Method 3 : crude fallback ───
    setHeight('100dvh');
  }, []);

  return height;
}
