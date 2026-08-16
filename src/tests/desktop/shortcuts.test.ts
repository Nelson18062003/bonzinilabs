/**
 * The two bugs this pins: a bare-letter shortcut firing while the operator types
 * a client's name into the search box, and a plain-letter shortcut hijacking the
 * browser's own ⌘-combinations.
 */
import { describe, it, expect } from 'vitest';
import { matchesShortcut, isTypingTarget, type Shortcut } from '@/desktop/kit/shortcuts';

const ev = (over: Partial<KeyboardEvent> & { key: string }) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

const sc = (over: Partial<Shortcut> & { key: string }): Shortcut => ({
  handler: () => {},
  ...over,
});

describe('matchesShortcut', () => {
  it('matches a plain letter', () => {
    expect(matchesShortcut(ev({ key: 'j' }), sc({ key: 'j' }))).toBe(true);
  });

  it('is case-insensitive on the declared key', () => {
    expect(matchesShortcut(ev({ key: 'J' }), sc({ key: 'j' }))).toBe(true);
  });

  it('matches named keys', () => {
    expect(matchesShortcut(ev({ key: 'Escape' }), sc({ key: 'Escape' }))).toBe(true);
    expect(matchesShortcut(ev({ key: 'ArrowDown' }), sc({ key: 'ArrowDown' }))).toBe(true);
  });

  it('does NOT fire a plain-letter shortcut when a modifier is held', () => {
    // Otherwise `k` would hijack ⌘K, and `r` would swallow reload.
    expect(matchesShortcut(ev({ key: 'k', metaKey: true }), sc({ key: 'k' }))).toBe(false);
    expect(matchesShortcut(ev({ key: 'r', ctrlKey: true }), sc({ key: 'r' }))).toBe(false);
  });

  it('requires the modifier when the shortcut declares one', () => {
    expect(matchesShortcut(ev({ key: 'k' }), sc({ key: 'k', mod: true }))).toBe(false);
    expect(matchesShortcut(ev({ key: 'k', metaKey: true }), sc({ key: 'k', mod: true }))).toBe(true);
  });

  it('accepts Ctrl as the modifier off macOS', () => {
    expect(matchesShortcut(ev({ key: 'k', ctrlKey: true }), sc({ key: 'k', mod: true }))).toBe(true);
  });

  it('never matches when Alt is held — those combinations belong to the OS', () => {
    expect(matchesShortcut(ev({ key: 'j', altKey: true }), sc({ key: 'j' }))).toBe(false);
  });

  it('enforces shift for letters', () => {
    expect(matchesShortcut(ev({ key: 'e', shiftKey: true }), sc({ key: 'e' }))).toBe(false);
    expect(matchesShortcut(ev({ key: 'e', shiftKey: true }), sc({ key: 'e', shift: true }))).toBe(true);
  });

  it('ignores shift for punctuation, which arrives already shifted', () => {
    // `?` is Shift+/ on most layouts — declaring it as `?` must be enough.
    expect(matchesShortcut(ev({ key: '?', shiftKey: true }), sc({ key: '?' }))).toBe(true);
    expect(matchesShortcut(ev({ key: '/' }), sc({ key: '/' }))).toBe(true);
  });

  it('rejects a different key', () => {
    expect(matchesShortcut(ev({ key: 'x' }), sc({ key: 'j' }))).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('recognises the fields an operator types into', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      const el = document.createElement(tag.toLowerCase());
      expect(isTypingTarget(el)).toBe(true);
    }
  });

  it('recognises contenteditable', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(isTypingTarget(el)).toBe(true);
  });

  it('lets shortcuts through everywhere else', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
