import i18n, { t } from 'i18next';
import { getCurrentLocale } from '@/i18n';

// ── Currency formatting ─────────────────────────────────────────────────────
export function formatCurrency(amountXAF: number): string {
  const locale = getCurrentLocale();
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountXAF) + ' XAF';
}

export function formatXAF(amount: number): string {
  return new Intl.NumberFormat(getCurrentLocale()).format(amount);
}

export function formatRMB(amount: number): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyRMB(amountRMB: number): string {
  return '¥ ' + new Intl.NumberFormat(getCurrentLocale(), {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountRMB);
}

// ── Date formatting ─────────────────────────────────────────────────────────
export function formatDate(date: string | Date, format: 'short' | 'long' | 'datetime' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = getCurrentLocale();
  if (format === 'datetime') {
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (format === 'long') {
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('relativeTime.justNow', { ns: 'common' });
  if (diffMins < 60) return t('relativeTime.minutesAgo', { ns: 'common', count: diffMins });
  if (diffHours < 24) return t('relativeTime.hoursAgo', { ns: 'common', count: diffHours });
  if (diffDays < 7) return t('relativeTime.daysAgo', { ns: 'common', count: diffDays });

  return formatDateShort(d);
}

// ── Number formatting ───────────────────────────────────────────────────────
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Compact number formatting: 12 500 000 → "12,5M" | 950 000 → "950K" | 500 → "500"
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${formatNumber(amount / 1_000_000, 1)}M`;
  if (amount >= 1_000) return `${formatNumber(amount / 1_000, 0)}K`;
  return formatNumber(amount);
}

// Exchange rate display
export function formatRateXAFPerRMB(rate: number): string {
  return `${formatNumber(Math.round(rate))} XAF`;
}

export function formatRateCNY(value: number): string {
  return `${formatNumber(Math.round(value))} CNY`;
}

// ── Conversions ─────────────────────────────────────────────────────────────
export function convertXAFtoRMB(amountXAF: number, rate: number = 0.01167): number {
  return Math.round(amountXAF * rate * 100) / 100;
}

export function convertRMBtoXAF(amountRMB: number, rate: number = 85.69): number {
  return Math.round(amountRMB * rate);
}

// ── Status & Method labels (i18n) ───────────────────────────────────────────
export function getDepositStatusLabel(status: string): string {
  const key = `depositStatus.${status}`;
  const translated = i18n.t(key, { ns: 'formatters' });
  // If i18next returns the key itself, fall back to raw status
  return translated === key ? status : translated;
}

export function getPaymentStatusLabel(status: string): string {
  const key = `paymentStatus.${status}`;
  const translated = i18n.t(key, { ns: 'formatters' });
  return translated === key ? status : translated;
}

export function getMethodLabel(method: string): string {
  const key = `method.${method}`;
  const translated = i18n.t(key, { ns: 'formatters' });
  return translated === key ? method : translated;
}
