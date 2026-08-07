/**
 * DataTable — the ONE list surface of the desktop console.
 *
 * Every module (dépôts, paiements, clients, opérations trésorerie, admins,
 * journaux…) renders its rows through this component, so an operator learns the
 * interaction once: click a row to open it in the inspector, ↑/↓ to move,
 * Enter to open, Home/End to jump. Columns are declared as data, which is what
 * lets a screen stay ~150 lines instead of 400 lines of <td> soup.
 *
 * Deliberately NOT a virtualised grid: the lists here are paginated (20–50 rows
 * per page) and a real <table> keeps semantics, copy/paste and Ctrl+F working.
 */
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DENSITY, type Density } from './tokens';
import { Skeleton } from './primitives';

export interface Column<T> {
  /** Stable key — also used as the sort id. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Keep it to one visual idea per column. */
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Fixed width, e.g. '120px' or '18%'. Omit to let the column breathe. */
  width?: string;
  sortable?: boolean;
  /** Hide below this container width (px) — lets a table live in a split view. */
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
  /** Rendered in place of the table when there are no rows. */
  empty?: React.ReactNode;
  /** Appended after the last row — pagination trigger, "load more", totals. */
  footer?: React.ReactNode;
  className?: string;
  /** Accessible name for the table. */
  label?: string;
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

  /** Roving focus: ↑/↓ walk the rows, Enter opens, Home/End jump. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const focusables = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('tr[data-row]') ?? []);
    const i = focusables.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      focusables[Math.max(0, Math.min(focusables.length - 1, n))]?.focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(focusables.length - 1);
  };

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  if (isLoading) {
    return (
      <div className={cn('overflow-hidden rounded-xl border', DS.card, DS.line, className)}>
        <div className={cn('flex items-center gap-4 border-b px-3.5', DS.line, d.head)}>
          {columns.map((c) => (
            <Skeleton key={c.key} className="h-2.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={cn('flex items-center gap-4 border-b px-3.5 last:border-0', DS.line, d.row)}>
            {columns.map((c) => (
              <Skeleton key={c.key} className="h-3 flex-1" style={{ opacity: 1 - i * 0.09 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return <div className={cn('rounded-xl border', DS.card, DS.line, className)}>{empty}</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border', DS.card, DS.line, className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left" aria-label={label}>
          <thead>
            <tr className={cn('border-b', DS.line, DS.well)}>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Arrow = !active ? ChevronsUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(DT.micro, DFG.faint, d.head, 'whitespace-nowrap font-bold', c.align === 'right' && 'text-right')}
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-[#15131F] dark:hover:text-[#F3F2F8]',
                          active && DFG.base,
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        <Arrow className="h-3 w-3" />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {rows.map((row) => {
              const id = getRowId(row);
              const isActive = activeId === id;
              return (
                <tr
                  key={id}
                  data-row
                  tabIndex={onRowClick ? 0 : -1}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
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
                    'border-b last:border-0 transition-colors',
                    DS.line,
                    d.row,
                    onRowClick && 'cursor-pointer outline-none',
                    isActive
                      ? DS.selected
                      : onRowClick &&
                          cn(DS.hover, 'focus-visible:bg-[#6B5BD2]/[0.06] dark:focus-visible:bg-[#A99BF0]/[0.10]'),
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(DT.body, DFG.base, d.cell, 'align-middle', c.align === 'right' && 'text-right')}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer ? <div className={cn('border-t px-3.5 py-2', DS.line)}>{footer}</div> : null}
    </div>
  );
}
