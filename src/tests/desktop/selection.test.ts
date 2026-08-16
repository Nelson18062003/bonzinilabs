/**
 * Row selection drives bulk actions against money, so the anchor/range
 * behaviour is pinned here rather than discovered in production.
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_SELECTION,
  headerCheckState,
  moveCursor,
  pruneSelection,
  selectRange,
  toggleAll,
  toggleRow,
  type SelectionState,
} from '@/desktop/kit/selection';

const ROWS = ['a', 'b', 'c', 'd', 'e'];
const sel = (ids: string[], anchor: string | null = null): SelectionState => ({
  ids: new Set(ids),
  anchor,
});

describe('toggleRow', () => {
  it('adds, then removes, and always moves the anchor', () => {
    const one = toggleRow(EMPTY_SELECTION, 'b');
    expect([...one.ids]).toEqual(['b']);
    expect(one.anchor).toBe('b');

    const none = toggleRow(one, 'b');
    expect(none.ids.size).toBe(0);
    expect(none.anchor).toBe('b');
  });

  it('never mutates the previous state', () => {
    const before = sel(['a']);
    toggleRow(before, 'b');
    expect([...before.ids]).toEqual(['a']);
  });
});

describe('selectRange', () => {
  it('fills from the anchor to the clicked row, inclusive', () => {
    const next = selectRange(sel(['b'], 'b'), 'd', ROWS);
    expect([...next.ids].sort()).toEqual(['b', 'c', 'd']);
  });

  it('works upwards as well as downwards', () => {
    const next = selectRange(sel(['d'], 'd'), 'b', ROWS);
    expect([...next.ids].sort()).toEqual(['b', 'c', 'd']);
  });

  it('adds to the selection rather than replacing it, so several ranges compose', () => {
    const first = selectRange(sel(['a'], 'a'), 'b', ROWS);
    const second = selectRange({ ids: first.ids, anchor: 'd' }, 'e', ROWS);
    expect([...second.ids].sort()).toEqual(['a', 'b', 'd', 'e']);
  });

  it('keeps the anchor put so a second shift-click re-ranges from the same origin', () => {
    const wide = selectRange(sel(['b'], 'b'), 'e', ROWS);
    expect(wide.anchor).toBe('b');
    const narrowed = selectRange(wide, 'c', ROWS);
    expect(narrowed.anchor).toBe('b');
  });

  it('degrades to a plain toggle with no anchor', () => {
    const next = selectRange(EMPTY_SELECTION, 'c', ROWS);
    expect([...next.ids]).toEqual(['c']);
  });

  it('degrades to a plain toggle when an end is no longer in the loaded page', () => {
    const next = selectRange(sel(['z'], 'z'), 'c', ROWS);
    expect([...next.ids].sort()).toEqual(['c', 'z']);
  });
});

describe('toggleAll', () => {
  it('selects every loaded row', () => {
    expect([...toggleAll(EMPTY_SELECTION, ROWS).ids].sort()).toEqual(ROWS);
  });

  it('clears when everything loaded is already selected', () => {
    expect(toggleAll(sel(ROWS), ROWS).ids.size).toBe(0);
  });

  it('selects all from a partial selection rather than clearing', () => {
    expect([...toggleAll(sel(['a', 'b']), ROWS).ids].sort()).toEqual(ROWS);
  });

  it('is a no-op safe path on an empty list', () => {
    expect(toggleAll(EMPTY_SELECTION, []).ids.size).toBe(0);
  });
});

describe('headerCheckState', () => {
  it('reports none / some / all', () => {
    expect(headerCheckState(EMPTY_SELECTION, ROWS)).toBe('none');
    expect(headerCheckState(sel(['a', 'b']), ROWS)).toBe('some');
    expect(headerCheckState(sel(ROWS), ROWS)).toBe('all');
  });

  it('reports none when the selection is entirely off this page', () => {
    expect(headerCheckState(sel(['x', 'y']), ROWS)).toBe('none');
  });

  it('reports all when this page is covered, even if more is selected elsewhere', () => {
    expect(headerCheckState(sel([...ROWS, 'x']), ROWS)).toBe('all');
  });
});

describe('pruneSelection', () => {
  it('drops rows a refetch removed — a colleague processed them', () => {
    const next = pruneSelection(sel(['a', 'z'], 'z'), ROWS);
    expect([...next.ids]).toEqual(['a']);
    expect(next.anchor).toBeNull();
  });

  it('keeps the anchor when it survived', () => {
    expect(pruneSelection(sel(['a', 'z'], 'a'), ROWS).anchor).toBe('a');
  });

  it('returns the SAME reference when nothing changed, so React skips the render', () => {
    const before = sel(['a', 'b'], 'a');
    expect(pruneSelection(before, ROWS)).toBe(before);
  });
});

describe('moveCursor', () => {
  it('steps forward and back', () => {
    expect(moveCursor('b', ROWS, 1)).toBe('c');
    expect(moveCursor('b', ROWS, -1)).toBe('a');
  });

  it('clamps at both ends instead of wrapping', () => {
    expect(moveCursor('e', ROWS, 1)).toBe('e');
    expect(moveCursor('a', ROWS, -1)).toBe('a');
  });

  it('lands on the first row going down from nothing, last going up', () => {
    expect(moveCursor(null, ROWS, 1)).toBe('a');
    expect(moveCursor(null, ROWS, -1)).toBe('e');
  });

  it('handles a cursor pointing at a row that has gone', () => {
    expect(moveCursor('gone', ROWS, 1)).toBe('a');
  });

  it('returns null on an empty list', () => {
    expect(moveCursor('a', [], 1)).toBeNull();
  });
});
