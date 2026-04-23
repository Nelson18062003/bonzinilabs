import * as React from 'react';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportCsv, type CsvRow, type CsvExportOptions } from '@/lib/analytics/csvExport';
import { useDateRange } from '@/lib/analytics/DateRangeContext';

export interface ExportButtonProps {
  /** Base filename without extension — the selected date range is appended. */
  filename: string;
  /** Rows to export, or a factory that lazily produces them on click. */
  rows: CsvRow[] | (() => CsvRow[] | Promise<CsvRow[]>);
  /** CSV column definition. When omitted, keys from the first row are used. */
  columns?: CsvExportOptions['columns'];
  /** Disables the button (e.g. while data is loading). */
  disabled?: boolean;
  /** Separator. Default ';' for French Excel compatibility. */
  separator?: CsvExportOptions['separator'];
  className?: string;
  label?: string;
}

/**
 * Compact "Export CSV" button wired to the shared DateRange context.
 * The filename automatically includes the selected period so downloads
 * stay self-documenting (e.g. `tpv_2026-04-01_2026-04-30.csv`).
 */
export function ExportButton({
  filename,
  rows,
  columns,
  disabled,
  separator,
  className,
  label = 'Exporter',
}: ExportButtonProps) {
  const { range } = useDateRange();
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = typeof rows === 'function' ? await rows() : rows;
      const suffix = `${format(range.from, 'yyyy-MM-dd')}_${format(range.to, 'yyyy-MM-dd')}`;
      exportCsv(`${filename}_${suffix}.csv`, data, { columns, separator });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm',
        'hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      aria-label={label}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
