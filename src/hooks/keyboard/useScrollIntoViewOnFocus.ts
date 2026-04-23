import * as React from 'react';

export interface ScrollIntoViewOnFocusOptions {
  /** Extra px kept above/below the focused control. Default 80. */
  padding?: number;
  /** Delay (ms) before scrolling, to let iOS finish opening the keyboard. Default 320. */
  delay?: number;
  /** Scroll behavior. Default 'smooth'. */
  behavior?: ScrollBehavior;
  /** Disable the hook when false. Default true. */
  enabled?: boolean;
}

/**
 * Listens to `focusin` on the entire document and scrolls the focused
 * input/textarea/select into view ABOVE the on-screen keyboard.
 *
 * Why a global listener: iOS Safari often fails to auto-scroll inputs that
 * are inside fixed-position containers (drawers, bottom sheets, modals).
 * This hook does the scroll math explicitly using VisualViewport geometry.
 *
 * Mount once, ideally at the app root.
 */
export function useScrollIntoViewOnFocus({
  padding = 80,
  delay = 320,
  behavior = 'smooth',
  enabled = true,
}: ScrollIntoViewOnFocusOptions = {}): void {
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !isEditable(target)) return;

      // Wait for the keyboard to finish opening before measuring.
      const timer = window.setTimeout(() => {
        const vv = window.visualViewport;
        const rect = target.getBoundingClientRect();
        const viewportBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
        const overflow = rect.bottom + padding - viewportBottom;
        if (overflow > 0) {
          // The element is hidden behind the keyboard — scroll it into view.
          window.scrollBy({ top: overflow, left: 0, behavior });
        } else if (rect.top < (vv?.offsetTop ?? 0) + padding) {
          // Above the fold — scroll it down into the visible area.
          const deficit = (vv?.offsetTop ?? 0) + padding - rect.top;
          window.scrollBy({ top: -deficit, left: 0, behavior });
        }
      }, delay);

      // If the user blurs before the timer fires, cancel.
      const cancel = () => window.clearTimeout(timer);
      target.addEventListener('blur', cancel, { once: true });
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [padding, delay, behavior, enabled]);
}

function isEditable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    // Exclude non-keyboard inputs.
    return type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'file' && type !== 'checkbox' && type !== 'radio' && type !== 'range';
  }
  return el.isContentEditable;
}
