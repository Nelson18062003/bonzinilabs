// Currency formatting
export function formatCurrency(amountXAF: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountXAF) + ' XAF';
}

export function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}

export function formatRMB(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyRMB(amountRMB: number): string {
  return '¥ ' + new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountRMB) + ' RMB';
}

// Date formatting
export function formatDate(date: string | Date, format: 'short' | 'long' | 'datetime' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (format === 'datetime') {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (format === 'long') {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
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

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return formatDateShort(d);
}

// Number formatting (no currency suffix)
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('fr-FR', {
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

// Exchange rate display: "1 RMB = 86 XAF" or "1 XAF = 0,01167 RMB"
export function formatRateXAFPerRMB(rate: number): string {
  return `${formatNumber(Math.round(rate))} XAF`;
}

export function formatRateCNY(value: number): string {
  return `${formatNumber(Math.round(value))} CNY`;
}

// Convert XAF to RMB
export function convertXAFtoRMB(amountXAF: number, rate: number = 0.01167): number {
  return Math.round(amountXAF * rate * 100) / 100;
}

export function convertRMBtoXAF(amountRMB: number, rate: number = 85.69): number {
  return Math.round(amountRMB * rate);
}

// Status labels
export function getDepositStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: 'Créé',
    awaiting_proof: 'En attente de preuve',
    proof_submitted: 'Preuve envoyée',
    admin_review: 'En vérification',
    validated: 'Validé',
    rejected: 'Rejeté',
    // Legacy uppercase
    SUBMITTED: 'Soumis',
    PROOF_UPLOADED: 'Preuve envoyée',
    UNDER_VERIFICATION: 'En vérification',
    VALIDATED: 'Validé',
    REJECTED: 'Rejeté',
  };
  return labels[status] || status;
}

export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUBMITTED: 'Soumis',
    INFO_RECEIVED: 'Infos reçues',
    PROCESSING: 'En cours',
    COMPLETED: 'Effectué',
    PROOF_AVAILABLE: 'Preuve dispo',
    CANCELLED: 'Annulé',
  };
  return labels[status] || status;
}

export function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    bank_transfer: 'Virement bancaire',
    bank_cash: 'Dépôt cash banque',
    agency_cash: 'Agence Bonzini',
    om_transfer: 'Orange Money (transfert)',
    om_withdrawal: 'Orange Money (retrait)',
    mtn_transfer: 'MTN Money (transfert)',
    mtn_withdrawal: 'MTN Money (retrait)',
    wave: 'Wave',
    ALIPAY: 'Alipay',
    WECHAT: 'WeChat',
    BANK_TRANSFER: 'Virement',
    CASH_COUNTER: 'Cash Counter',
  };
  return labels[method] || method;
}
