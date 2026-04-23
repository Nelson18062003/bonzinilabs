import * as React from 'react';

/**
 * Opts into the VirtualKeyboard API `overlaysContent` mode on supported
 * browsers (Chrome Android 108+, Edge). In overlay mode the on-screen
 * keyboard floats above the content instead of resizing the viewport,
 * which makes `dvh`/`svh`/`lvh` behave correctly and removes the need
 * for manual padding hacks.
 *
 * Safari iOS does not support this API (as of 2026). The hook is a no-op
 * there and you should rely on `useKeyboardSafePadding` / VisualViewport
 * math instead.
 *
 * Mount once at the app root.
 *
 * Spec: https://github.com/WICG/virtual-keyboard
 */
export function useVirtualKeyboardOverlay(enabled = true): void {
  React.useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vk = (navigator as any).virtualKeyboard;
    if (!vk || typeof vk.overlaysContent !== 'boolean') return;
    const previous = vk.overlaysContent as boolean;
    vk.overlaysContent = true;
    return () => {
      vk.overlaysContent = previous;
    };
  }, [enabled]);
}
