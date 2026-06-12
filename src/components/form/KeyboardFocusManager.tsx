import { useScrollIntoViewOnFocus, useVisibleViewportSync } from '@/hooks/keyboard';

/**
 * Headless root-level manager for mobile keyboard behaviour. Mount once inside
 * the App shell.
 *
 *   - `useVisibleViewportSync`: single source of truth for the visible viewport
 *     geometry (CSS vars --vvh / --vvt). Consumed by <ViewportShell>.
 *   - `useScrollIntoViewOnFocus`: on document-scroll screens (forms), keeps the
 *     focused input visible above the keyboard. No-op inside a locked
 *     <ViewportShell> (the document can't scroll there, so window.scrollBy is
 *     a non-op).
 *
 * NOTE: we deliberately DO NOT enable VirtualKeyboard `overlaysContent` mode.
 * Overlay mode stops `visualViewport.height` from shrinking on Android, which
 * is exactly what broke keyboard-following chat layouts. In the default /
 * resize mode, `visualViewport.height` tracks the visible area above the
 * keyboard on both iOS and Android — see docs/audit-fondation-mobile-assistant.md.
 */
export function KeyboardFocusManager() {
  useVisibleViewportSync();
  useScrollIntoViewOnFocus();
  return null;
}
