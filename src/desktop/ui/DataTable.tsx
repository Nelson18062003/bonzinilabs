/**
 * DataTable — the ONE list surface of the desktop console.
 *
 * Every module (dépôts, paiements, clients, opérations trésorerie, admins,
 * journaux…) renders its rows through this component, so an operator learns the
 * interaction once: click a row to open it in the inspector, ↑/↓ to move,
 * Enter to open, Home/End to jump. Columns are declared as data, which is what
 * lets a screen stay ~150 lines instead of 400 lines of <td> soup.
 *
 * Layout decisions that matter:
 *  · **`table-fixed` + `<colgroup>`.** Under `table-layout: auto` the declared
 *    widths are only hints, so columns visibly re-proportion between the
 *    skeleton, the first page and every infinite-scroll page. Fixed layout
 *    makes the geometry deterministic — and is what lets the sticky header stay
 *    aligned with the body.
 *  · **The component owns its vertical scroll.** A sticky `<th>` needs a
 *    scrollport; if the scrollport is two ancestors up (the Workbench body) the
 *    header simply scrolls away. So the card is a flex column, the table
 *    wrapper scrolls, and `footer` pins to the bottom instead of being
 *    unreachable at the end of a 200-row list.
 *  · **One tab stop.** Roving tabindex, not 50 tab stops.
 *  · **`footer` renders in every state.** It carries the infinite-scroll
 *    trigger; dropping it on an empty result set meant a client-side filter
 *    that matched nothing on page 1 could never load page 2.
 *
 * Deliberately NOT a virtualised grid: lists here are paginated and a real
 * <table> keeps semantics, copy/paste and Ctrl+F working.
 */
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS, DENSITY, type Density } from './tokens';
import { Skeleton } from './primitives';

export interface Column<T> {
  /** Stable key — also used as the sort id. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Keep it to one visual idea per column. */
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Fixed width, e.g. '120px' or '18%'. Omit to let the column take the slack. */
  width?: string;
  sortable?: boolean;
  /** Drop the column when the table is narrower than this (px). */
  hideBelow?: number;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Id of the row currently open in the inspector. */
  activeId?: string | null;
  sort?: SortState | null;
  onSortChange?: (s: SortState) => void;
  density?: Density;
  isLoading?: boolean;
  /** Rendered in place of the rows when there are none. */
  empty?: React.ReactNode;
  /** Pinned under the table in every state — pagination trigger, totals. */
  footer?: React.ReactNode;
  className?: string;
  /** Accessible name for the table. Required in practice. */
  label?: string;
}

/** Width of the scroll container, for `hideBelow`. */
function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState<number>(Number.POSITIVE_INFINITY);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  activeId,
  sort,
  onSortChange,
  density = 'cosy',
  isLoading,
  empty,
  footer,
  className,
  label,
}: DataTableProps<T>) {
  const d = DENSITY[density];
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const [scrollRef, width] = useElementWidth<HTMLDivElement>();

  const cols = React.useMemo(
    () => columns.filter((c) => !c.hideBelow || width >= c.hideBelow),
    [columns, width],
  );

  /** Roving focus: ↑/↓ walk the rows, Enter opens, Home/End jump. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (!onRowClick) return;
    const focusables = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('tr[data-row]') ?? []);
    if (focusables.length === 0) return;
    // Focus may sit on a control inside a cell — resolve back to its row.
    const current = (document.activeElement as HTMLElement | null)?.closest('tr[data-row]') as HTMLElement | null;
    const i = current ? focusables.indexOf(current) : -1;

    const go = (n: number) => {
      const target = Math.max(0, Math.min(focusables.length - 1, n));
      // Only swallow the key when it actually moves — otherwise ↓ on the last
      // row blocks the page scroll for nothing.
      if (target === i) return;
      e.preventDefault();
      focusables[target]?.focus({ preventScroll: true });
      focusables[target]?.scrollIntoView({ block: 'nearest' });
    };

    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(focusables.length - 1);
    else if (e.key === 'PageDown') go(i + 10);
    else if (e.key === 'PageUp') go(i - 10);
  };

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const head = (
    <thead>
      <tr className={DS.well}>
        {cols.map((c) => {
          const active = sort?.key === c.key;
          const Arrow = !active ? ChevronsUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
          return (
            <th
              key={c.key}
              scope="col"
              className={cn(
                DT.micro,
                DFG.muted,
                d.head,
                // A collapsed border on a sticky cell is painted by the table and
                // scrolls away with it — an inset shadow travels with the cell.
                'sticky top-0 z-10 whitespace-nowrap font-bold shadow-[inset_0_-1px_0_rgba(28,24,54,0.10)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.10)]',
                DS.well,
                c.align === 'right' && 'text-right',
              )}
              aria-sort={c.sortable ? (active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
            >
              {c.sortable && onSortChange ? (
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded transition-colors hover:text-[#15131F] dark:hover:text-[#F3F2F8]',
                    active && DFG.base,
                    c.align === 'right' && 'flex-row-reverse',
                    DFOCUS,
                  )}
                >
                  {c.header}
                  <Arrow className="h-3 w-3" aria-hidden />
                  <span className="sr-only">Trier</span>
                </button>
              ) : (
                c.header
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  const colgroup = (
    <colgroup>
      {cols.map((c) => (
        <col key={c.key} style={c.width ? { width: c.width } : undefined} />
      ))}
    </colgroup>
  );

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border', DS.card, DS.line, className)} aria-busy={!!isLoading}>
      <p className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Chargement…' : `${rows.length} résultat${rows.length > 1 ? 's' : ''}`}
      </p>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" tabIndex={0} role="region" aria-label={label}>
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">{label}</caption>
          {colgroup}
          {head}
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {isLoading
              ? /* Same markup as a real row, so nothing shifts when data lands. */
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={cn('border-b last:border-0', DS.line, d.row)}>
                    {cols.map((c) => (
                      <td key={c.key} className={cn(d.cell, 'align-middle')}>
                        <Skeleton className={cn('h-3', c.align === 'right' ? 'ml-auto w-2/3' : 'w-4/5')} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  const isActive = activeId === id;
                  return (
                    <tr
                      key={id}
                      data-row
                      // One tab stop for the whole grid: the open row, or the first.
                      tabIndex={onRowClick ? (isActive || (!activeId && id === getRowId(rows[0])) ? 0 : -1) : -1}
                      aria-selected={onRowClick ? isActive : undefined}
                      onClick={
                        onRowClick
                          ? () => {
                              // Don't navigate when the operator was selecting text.
                              if (window.getSelection()?.toString()) return;
                              onRowClick(row);
                            }
                          : undefined
                      }
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      className={cn(
                        'scroll-mt-9 border-b last:border-0 transition-colors',
                        DS.line,
                        d.row,
                        onRowClick && cn('cursor-pointer', DS.hover, DFOCUS),
                        isActive && DS.selected,
                      )}
                    >
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={cn(DT.body, DFG.base, d.cell, 'truncate align-middle', c.align === 'right' && 'text-right')}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && rows.length === 0 && empty ? empty : null}
      </div>

      {footer ? <div className={cn('shrink-0 border-t px-3.5 py-2', DS.line)}>{footer}</div> : null}
    </div>
  );
}
