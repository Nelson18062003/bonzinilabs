import * as React from 'react';
import { useVisualViewport } from './useVisualViewport';

/**
 * Estimated on-screen keyboard height in pixels. Returns 0 when the
 * keyboard is closed (or when the difference is negligible, below the
 * threshold, to ignore browser UI chrome changes).
 *
 * Derived from the delta between `layout viewport` (`window.innerHeight`)
 * and `visual viewport` (shrinks under the keyboard on iOS).
 *
 * Note: when `navigator.virtualKeyboard.overlaysContent = true` is enabled
 * (Chrome Android), the visual viewport does NOT shrink, so this hook
 * reports 0 even with a keyboard open. In that mode, read
 * `navigator.virtualKeyboard.boundingRect` directly instead.
 *
 * @param threshold Minimum delta (px) to consider the keyboard open. Default 120.
 */
export function useKeyboardHeight(threshold = 120): number {
  const vv = useVisualViewport();
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    if (!vv.supported) {
      setHeight(0);
      return;
    }
    const layoutHeight = window.innerHeight;
    const diff = Math.max(0, layoutHeight - vv.height - vv.offsetTop);
    setHeight(diff > threshold ? diff : 0);
  }, [vv, threshold]);

  return height;
}

/**
 * True when the on-screen keyboard is currently open. Derived from
 * `useKeyboardHeight() > 0`.
 */
export function useKeyboardOpen(threshold = 120): boolean {
  return useKeyboardHeight(threshold) > 0;
}
