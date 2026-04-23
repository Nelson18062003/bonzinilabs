/**
 * Minimal CSV export helper — no dependency, Excel-friendly.
 *
 * Produces a UTF-8 BOM-prefixed, CRLF-separated, RFC 4180-ish CSV.
 * Fields containing commas, quotes, or newlines are quoted; embedded
 * quotes are doubled. The BOM is there so Excel opens the file in
 * UTF-8 on Windows without mojibake on French accents.
 */

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export interface CsvExportOptions {
  /** Column order + labels. When omitted, keys from the first row are used verbatim. */
  columns?: Array<{ key: string; label: string }>;
  /** Field separator — ';' for French Excel, ',' for international. Default ';'. */
  separator?: ',' | ';' | '\t';
}

function escapeField(value: unknown, separator: string): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(separator) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: CsvRow[], options: CsvExportOptions = {}): string {
  const separator = options.separator ?? ';';
  if (rows.length === 0) {
    return '﻿';
  }

  const columns =
    options.columns ?? Object.keys(rows[0]).map((key) => ({ key, label: key }));

  const header = columns.map((c) => escapeField(c.label, separator)).join(separator);
  const body = rows
    .map((row) => columns.map((c) => escapeField(row[c.key], separator)).join(separator))
    .join('\r\n');

  return `﻿${header}\r\n${body}`;
}

/**
 * Triggers a download of the given CSV content as a .csv file.
 * Works in all modern browsers.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * One-liner: exports `rows` as a downloadable CSV file.
 */
export function exportCsv(filename: string, rows: CsvRow[], options?: CsvExportOptions): void {
  const csv = rowsToCsv(rows, options);
  downloadCsv(filename, csv);
}
