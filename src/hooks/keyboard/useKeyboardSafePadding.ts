import * as React from 'react';
import { useKeyboardHeight } from './useKeyboardHeight';

/**
 * Returns a `React.CSSProperties` object with `paddingBottom` equal to
 * the current keyboard height. Spread it on a container to guarantee
 * that the content above the keyboard remains fully scrollable.
 *
 * Example:
 *   const pad = useKeyboardSafePadding();
 *   <div style={pad}>…long form…</div>
 */
export function useKeyboardSafePadding(extra = 0): React.CSSProperties {
  const height = useKeyboardHeight();
  return React.useMemo(
    () =>
      height > 0
        ? { paddingBottom: `calc(${height}px + ${extra}px + env(safe-area-inset-bottom))` }
        : { paddingBottom: `calc(${extra}px + env(safe-area-inset-bottom))` },
    [height, extra],
  );
}
