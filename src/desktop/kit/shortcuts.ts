/**
 * Keyboard layer for the desktop admin.
 *
 * The audit found exactly one `onKeyDown` in the whole of `src/desktop` — Enter
 * on a table row. Everything else was click-only, on a machine that has a
 * keyboard. This is the registry every desktop screen binds against.
 *
 * The matching logic is pure and lives in `matchesShortcut` so it can be tested
 * without a DOM: the subtle bugs here (a bare `j` firing while the operator
 * types "jean" into the search box, `⌘K` also matching plain `k`) are exactly
 * the kind that only show up in real use.
 */

import { useEffect, useRef } from 'react';

export interface Shortcut {
  /** Single character or a named key: `j`, `Enter`, `Escape`, `/`, `?`. Case-insensitive. */
  key: string;
  /** Require ⌘ on macOS / Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  /**
   * Fire even while a text field has focus. Off by default — otherwise typing
   * a client's name into the search box would drive the row cursor.
   */
  allowInInput?: boolean;
  /** Shown in the shortcuts help sheet. Omit to hide from help. */
  description?: string;
  handler: (event: KeyboardEvent) => void;
}

/** `true` when the event originated in something the user is typing into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  // `isContentEditable` is absent on elements in some engines (and in jsdom),
  // so coerce — the declared return type is boolean and callers branch on it.
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true
  );
}

/**
 * Does this event satisfy this shortcut?
 *
 * Modifiers are matched EXACTLY, not "at least": a shortcut declaring no `mod`
 * must not fire on ⌘+key, or every plain-letter shortcut would also hijack the
 * browser's own ⌘-combinations (⌘R reload, ⌘L address bar).
 */
export function matchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
  shortcut: Shortcut,
): boolean {
  if (event.altKey) return false; // Alt combinations are the OS's, not ours.

  const wantMod = shortcut.mod === true;
  const hasMod = event.metaKey || event.ctrlKey;
  if (wantMod !== hasMod) return false;

  const wantShift = shortcut.shift === true;
  // `?` and other shifted punctuation arrive with shiftKey set but are declared
  // by their resulting character, so only enforce shift for single letters.
  const isLetter = shortcut.key.length === 1 && /[a-z]/i.test(shortcut.key);
  if (isLetter && wantShift !== event.shiftKey) return false;

  return event.key.toLowerCase() === shortcut.key.toLowerCase();
}

/**
 * Bind a set of shortcuts for as long as the component is mounted and `enabled`.
 *
 * Shortcuts are held in a ref so the listener is attached once and does not
 * re-bind on every parent render — the same reason `usePasteFiles` does it.
 */
export function useShortcuts(shortcuts: Shortcut[], enabled = true): void {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      for (const shortcut of ref.current) {
        if (typing && !shortcut.allowInInput) continue;
        if (!matchesShortcut(event, shortcut)) continue;
        event.preventDefault();
        shortcut.handler(event);
        return; // first match wins — no accidental double-fire
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Render a shortcut the way the platform writes it: `⌘K` on macOS, `Ctrl+K` elsewhere. */
export function shortcutLabel(shortcut: Pick<Shortcut, 'key' | 'mod' | 'shift'>): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const parts: string[] = [];
  if (shortcut.mod) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Maj');
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return isMac ? parts.join('') : parts.join('+');
}
