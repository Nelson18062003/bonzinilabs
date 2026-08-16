/**
 * Row-selection maths for the desktop queues.
 *
 * The audit found no checkbox, no selection set and no bulk action anywhere in
 * `src/desktop` — every deposit is validated one at a time even when twenty
 * arrive from the same bank in the same hour. This is the primitive that unlocks
 * that, kept pure and separate from the table component so the range/anchor
 * behaviour (the part users notice when it is wrong) is testable.
 *
 * Selection lives at the ID level, never the index level: rows re-order when the
 * operator sorts and re-flow when a page loads, and an index-based selection
 * would silently point at different records after either.
 */

export interface SelectionState {
  /** Selected row ids. */
  ids: ReadonlySet<string>;
  /** Last row the operator clicked — the anchor a shift-click ranges from. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { ids: new Set(), anchor: null };

/** Toggle one row, and make it the new anchor. */
export function toggleRow(state: SelectionState, id: string): SelectionState {
  const ids = new Set(state.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
}

/**
 * Shift-click: add every row between the anchor and `id` inclusive.
 *
 * Adds rather than replaces, so an operator can build a selection out of several
 * ranges. Falls back to a plain toggle when there is no anchor yet, or when
 * either end has scrolled out of the currently loaded page.
 */
export function selectRange(
  state: SelectionState,
  id: string,
  orderedIds: readonly string[],
): SelectionState {
  if (!state.anchor) return toggleRow(state, id);

  const from = orderedIds.indexOf(state.anchor);
  const to = orderedIds.indexOf(id);
  if (from === -1 || to === -1) return toggleRow(state, id);

  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const ids = new Set(state.ids);
  for (let i = lo; i <= hi; i++) ids.add(orderedIds[i]);

  // Anchor stays put so a second shift-click re-ranges from the same origin.
  return { ids, anchor: state.anchor };
}

/**
 * Header checkbox. Selects every loaded row, or clears if all are already
 * selected — the "all" here is deliberately "all loaded", never "all matching
 * the filter", because a bulk action must only ever touch rows the operator can
 * actually see.
 */
export function toggleAll(state: SelectionState, orderedIds: readonly string[]): SelectionState {
  if (orderedIds.length > 0 && orderedIds.every((id) => state.ids.has(id))) {
    return EMPTY_SELECTION;
  }
  return { ids: new Set(orderedIds), anchor: state.anchor };
}

/** Header checkbox state: none, some, or all of the loaded rows. */
export function headerCheckState(
  state: SelectionState,
  orderedIds: readonly string[],
): 'none' | 'some' | 'all' {
  if (orderedIds.length === 0 || state.ids.size === 0) return 'none';
  const selectedHere = orderedIds.filter((id) => state.ids.has(id)).length;
  if (selectedHere === 0) return 'none';
  return selectedHere === orderedIds.length ? 'all' : 'some';
}

/**
 * Drop ids that are no longer in the list.
 *
 * Called after a refetch: a payment the operator had selected may have been
 * processed by a colleague and filtered out. Leaving it selected would let a
 * bulk action fire against a record that is no longer on screen.
 */
export function pruneSelection(
  state: SelectionState,
  orderedIds: readonly string[],
): SelectionState {
  const present = new Set(orderedIds);
  const ids = new Set([...state.ids].filter((id) => present.has(id)));
  if (ids.size === state.ids.size) return state; // unchanged — keep the reference
  return { ids, anchor: state.anchor && present.has(state.anchor) ? state.anchor : null };
}

/** Move a cursor by `delta`, clamped. Returns the id to land on, or null. */
export function moveCursor(
  currentId: string | null,
  orderedIds: readonly string[],
  delta: number,
): string | null {
  if (orderedIds.length === 0) return null;
  const index = currentId ? orderedIds.indexOf(currentId) : -1;
  if (index === -1) return orderedIds[delta > 0 ? 0 : orderedIds.length - 1];
  const next = Math.min(orderedIds.length - 1, Math.max(0, index + delta));
  return orderedIds[next];
}
