/**
 * The desktop queue: one table primitive for payments, deposits, clients,
 * treasury operations and support.
 *
 * Replaces the hand-rolled `<table>` markup each Desktop* screen carried its own
 * copy of — none of which had selection, keyboard navigation, sticky headers or
 * a density control. Those four are the difference between reading a list and
 * working through a queue.
 *
 * Interaction contract:
 *   ↑ / ↓ / J / K   move the cursor          Enter  open the cursor row
 *   X               toggle selection         Esc    clear selection
 *   Shift+click     range-select             ⇧      (from the last click)
 *
 * The cursor is deliberately separate from the selection: an operator scans with
 * J/K reading each record in the inspector, and only marks the ones needing a
 * bulk action with X. Merging the two would make every scroll a selection.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { DENSITY, LAYOUT, type Density } from './tokens';
import { useShortcuts } from './shortcuts';
import {
  headerCheckState,
  moveCursor,
  selectRange,
  toggleAll,
  toggleRow,
  type SelectionState,
} from './selection';

export interface Column<T> {
  /** Stable key — also the sort key when `sortable`. */
  key: string;
  header: string;
  /** Cell content. Keep it presentational; the row is already clickable. */
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Fixed width, e.g. `'11rem'`. Omit to let the column size to content. */
  width?: string;
  sortable?: boolean;
  /** Hide below this tier width, so narrow laptops drop the least useful columns. */
  minWidth?: number;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  /** Stable identity. Selection and cursor are keyed on this, never on index. */
  rowId: (row: T) => string;

  /** Row currently open in the inspector — highlighted, and the cursor origin. */
  activeId?: string | null;
  onOpen?: (row: T) => void;

  /** Omit both to get a read-only table with no checkboxes. */
  selection?: SelectionState;
  onSelectionChange?: (next: SelectionState) => void;

  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  density?: Density;
  isLoading?: boolean;
  /** Shown when `rows` is empty and not loading. */
  empty?: React.ReactNode;
  /** Rendered under the last row — the infinite-scroll trigger goes here. */
  footer?: React.ReactNode;
  /** Bind the window keyboard handlers. False while a dialog is open. */
  keyboardEnabled?: boolean;
  /** Accessible name for the table. */
  label: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  activeId = null,
  onOpen,
  selection,
  onSelectionChange,
  sortKey,
  sortDir = 'desc',
  onSort,
  density = 'comfortable',
  isLoading = false,
  empty,
  footer,
  keyboardEnabled = true,
  label,
}: Props<T>) {
  const d = DENSITY[density];
  const orderedIds = useMemo(() => rows.map(rowId), [rows, rowId]);
  const selectable = !!selection && !!onSelectionChange;

  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Keep the cursor row in view when it moves by keyboard. Mouse-driven changes
  // are already visible, but scrollIntoView with 'nearest' is a no-op then.
  useEffect(() => {
    if (!activeId) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const rowByIdRef = useRef(new Map<string, T>());
  rowByIdRef.current = new Map(rows.map((row) => [rowId(row), row]));

  const openId = useCallback(
    (id: string | null) => {
      if (!id || !onOpen) return;
      const row = rowByIdRef.current.get(id);
      if (row) onOpen(row);
    },
    [onOpen],
  );

  const move = useCallback(
    (delta: number) => openId(moveCursor(activeId, orderedIds, delta)),
    [activeId, orderedIds, openId],
  );

  useShortcuts(
    [
      { key: 'j', description: 'Ligne suivante', handler: () => move(1) },
      { key: 'ArrowDown', description: 'Ligne suivante', handler: () => move(1) },
      { key: 'k', description: 'Ligne précédente', handler: () => move(-1) },
      { key: 'ArrowUp', description: 'Ligne précédente', handler: () => move(-1) },
      {
        key: 'x',
        description: 'Sélectionner la ligne',
        handler: () => {
          if (!selectable || !activeId) return;
          onSelectionChange!(toggleRow(selection!, activeId));
        },
      },
      {
        key: 'Escape',
        description: 'Vider la sélection',
        handler: () => {
          if (!selectable || selection!.ids.size === 0) return;
          onSelectionChange!({ ids: new Set(), anchor: null });
        },
      },
    ],
    keyboardEnabled && rows.length > 0,
  );

  const handleRowClick = (event: React.MouseEvent, id: string) => {
    if (selectable && event.shiftKey) {
      // Shift-click is a range selection, not a navigation — suppress the text
      // selection the browser would otherwise paint across the rows.
      window.getSelection()?.removeAllRanges();
      onSelectionChange!(selectRange(selection!, id, orderedIds));
      return;
    }
    openId(id);
  };

  const checkState = selectable ? headerCheckState(selection!, orderedIds) : 'none';

  if (!isLoading && rows.length === 0 && empty) {
    return <div className={cn('rounded-[18px]', SURFACE.card, SURFACE.shadow)}>{empty}</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-[18px]', SURFACE.card, SURFACE.shadow)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-label={label}>
          <thead>
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className={cn(
                    'sticky z-10 w-10 bg-inherit',
                    d.cellXEdge,
                    'py-2.5',
                  )}
                  style={{ top: LAYOUT.topbarHeight }}
                >
                  <CheckBox
                    state={checkState}
                    label="Tout sélectionner"
                    onChange={() => onSelectionChange!(toggleAll(selection!, orderedIds))}
                  />
                </th>
              )}
              {columns.map((col, i) => {
                const first = i === 0 && !selectable;
                const last = i === columns.length - 1;
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width, top: LAYOUT.topbarHeight }}
                    className={cn(
                      'sticky z-10 bg-inherit py-2.5 text-[11px] font-bold uppercase tracking-wider',
                      first || last ? d.cellXEdge : d.cellX,
                      col.align === 'right' && 'text-right',
                      TEXT.muted,
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition hover:opacity-70',
                          active && 'text-[#6B5BD2] dark:text-[#A99BF0]',
                        )}
                      >
                        {col.header}
                        {active &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody ref={bodyRef}>
            {rows.map((row) => {
              const id = rowId(row);
              const isActive = id === activeId;
              const isSelected = selectable && selection!.ids.has(id);
              return (
                <tr
                  key={id}
                  data-row-id={id}
                  tabIndex={0}
                  aria-selected={isSelected || undefined}
                  onClick={(e) => handleRowClick(e, id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      openId(id);
                    }
                  }}
                  className={cn(
                    'cursor-pointer border-t border-black/[0.05] outline-none transition dark:border-white/[0.05]',
                    'hover:bg-[#EDEAFA]/40 focus-visible:bg-[#EDEAFA]/60',
                    'dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]',
                    isSelected && 'bg-[#EDEAFA]/55 dark:bg-white/[0.05]',
                    // The cursor row gets a violet edge rather than only a tint,
                    // so it stays findable when several rows are also selected.
                    isActive && 'bg-[#EDEAFA]/80 dark:bg-white/[0.07]',
                  )}
                  style={
                    isActive
                      ? { boxShadow: 'inset 3px 0 0 0 #6B5BD2' }
                      : undefined
                  }
                >
                  {selectable && (
                    <td className={cn(d.cellXEdge, d.cellY)} onClick={(e) => e.stopPropagation()}>
                      <CheckBox
                        state={isSelected ? 'all' : 'none'}
                        label="Sélectionner la ligne"
                        onChange={(e) =>
                          onSelectionChange!(
                            e.shiftKey
                              ? selectRange(selection!, id, orderedIds)
                              : toggleRow(selection!, id),
                          )
                        }
                      />
                    </td>
                  )}
                  {columns.map((col, i) => {
                    const first = i === 0 && !selectable;
                    const last = i === columns.length - 1;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          d.cellY,
                          d.text,
                          first || last ? d.cellXEdge : d.cellX,
                          col.align === 'right' && 'text-right',
                        )}
                      >
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className={cn(d.cellXEdge, 'py-3')}>{footer}</div>}
    </div>
  );
}

/** Tri-state checkbox — `some` is what makes a partial page selection legible. */
function CheckBox({
  state,
  label,
  onChange,
}: {
  state: 'none' | 'some' | 'all';
  label: string;
  onChange: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'flex h-[17px] w-[17px] items-center justify-center rounded-[5px] transition',
        state === 'none'
          ? 'ring-1 ring-inset ring-black/20 hover:ring-black/35 dark:ring-white/25 dark:hover:ring-white/40'
          : 'bg-[#6B5BD2] text-white',
      )}
    >
      {state === 'all' && <Check className="h-3 w-3" strokeWidth={3.5} />}
      {state === 'some' && <Minus className="h-3 w-3" strokeWidth={3.5} />}
    </button>
  );
}
