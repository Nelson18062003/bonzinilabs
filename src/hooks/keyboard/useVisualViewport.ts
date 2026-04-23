import * as React from 'react';

export interface VisualViewportState {
  /** Height of the visual viewport (shrinks when the keyboard opens on iOS). */
  height: number;
  /** Width of the visual viewport. */
  width: number;
  /** Offset of the visual viewport from the top of the layout viewport. */
  offsetTop: number;
  /** Offset of the visual viewport from the left of the layout viewport. */
  offsetLeft: number;
  /** Pinch-zoom scale. 1 when not zoomed. */
  scale: number;
  /** True when the VisualViewport API is available in this browser. */
  supported: boolean;
}

/**
 * Subscribes to `window.visualViewport` and returns its current geometry.
 *
 * On iOS Safari and Android Chrome, when the on-screen keyboard opens, the
 * visual viewport shrinks while the layout viewport stays the same — this
 * hook exposes the delta so you can position UI above the keyboard.
 *
 * Fallback: on browsers without VisualViewport (old Edge, very old Safari),
 * returns `window.innerHeight`/`Width` and `supported: false`.
 *
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = React.useState<VisualViewportState>(() => snapshot());

  React.useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) {
      // No VisualViewport API. Fall back to window resize.
      const onResize = () => setState(snapshot());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    const update = () => setState(snapshot());
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // Prime once in case the initial snapshot was taken before paint.
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}

function snapshot(): VisualViewportState {
  if (typeof window === 'undefined') {
    return { height: 0, width: 0, offsetTop: 0, offsetLeft: 0, scale: 1, supported: false };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
      supported: false,
    };
  }
  return {
    height: vv.height,
    width: vv.width,
    offsetTop: vv.offsetTop,
    offsetLeft: vv.offsetLeft,
    scale: vv.scale,
    supported: true,
  };
}
