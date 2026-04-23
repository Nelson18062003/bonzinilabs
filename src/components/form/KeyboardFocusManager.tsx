import {
  useScrollIntoViewOnFocus,
  useVirtualKeyboardOverlay,
} from '@/hooks/keyboard';

/**
 * Headless root-level manager that keeps focused inputs visible above
 * the on-screen keyboard. Mount once inside the App shell.
 *
 * What it does:
 *   - Chrome Android / Edge: enables `navigator.virtualKeyboard.overlaysContent`
 *     so dvh units behave and content isn't resized by the keyboard.
 *   - iOS Safari: subscribes to `focusin` globally and scrolls the active
 *     input into view when it's hidden behind the keyboard — handles the
 *     case where iOS' native scroll-into-view fails inside fixed containers
 *     like drawers and modals.
 */
export function KeyboardFocusManager() {
  useVirtualKeyboardOverlay();
  useScrollIntoViewOnFocus();
  return null;
}
