/**
 * CSV Export Utility
 * Exports data arrays to CSV format and triggers download
 */

export interface CSVColumn<T> {
  key: keyof T | string;
  header: string;
  formatter?: (value: unknown, row: T) => string;
}

/**
 * Escapes a value for CSV (handles commas, quotes, newlines)
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/**
 * Converts data array to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  // Header row
  const headers = columns.map((col) => escapeCSVValue(col.header)).join(',');

  // Data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = getNestedValue(row, col.key as string);
        const value = col.formatter ? col.formatter(rawValue, row) : rawValue;
        return escapeCSVValue(value);
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Triggers a CSV file download in the browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * High-level function: converts data to CSV and downloads
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  const csvContent = toCSV(data, columns);
  downloadCSV(csvContent, filename);
}

/**
 * Format date for CSV export (ISO format)
 */
export function formatDateForCSV(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Format datetime for CSV export
 */
export function formatDateTimeForCSV(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS
}

/**
 * Format currency for CSV export (no formatting, just number)
 */
export function formatCurrencyForCSV(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  return String(amount);
}
