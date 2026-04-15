import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { colors } from './styles';

export const formatXAF = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
};

export const formatRMB = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
};

/**
 * Format a date for PDF display.
 * Pass the current i18n language to get locale-appropriate formatting.
 */
export const formatDate = (date: Date | string, language = 'fr'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = language.startsWith('fr') ? fr : enUS;
  const separator = language.startsWith('fr') ? ' à ' : ' at ';
  return format(d, `dd MMMM yyyy'${separator}'HH:mm`, { locale });
};

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

// Format du taux de change pour l'affichage dans les reçus.
// Rétro-compatible : anciens paiements clients stockent en décimal (ex: 0.01153),
// paiements admin en entier (ex: 11530). Les deux signifient "1M XAF = ¥11 530".
export const formatRateDisplay = (exchangeRate: number): string => {
  const value = exchangeRate < 1
    ? Math.round(exchangeRate * 1_000_000)
    : Math.round(exchangeRate);
  return `1M XAF = ¥${formatXAF(value)}`;
};

// ---------------------------------------------------------------------------
// Status and method label maps — keyed by language for PDF generation
// ---------------------------------------------------------------------------

const DEPOSIT_METHOD_MAP: Record<string, Record<string, string>> = {
  fr: {
    bank_transfer: 'Virement bancaire',
    bank_cash: 'Dépôt cash banque',
    agency_cash: 'Cash agence Bonzini',
    om_transfer: 'Orange Money — Transfert',
    om_withdrawal: 'Orange Money — Retrait',
    mtn_transfer: 'MTN MoMo — Transfert',
    mtn_withdrawal: 'MTN MoMo — Retrait',
    wave: 'Wave',
  },
  en: {
    bank_transfer: 'Bank Transfer',
    bank_cash: 'Bank Cash Deposit',
    agency_cash: 'Bonzini Agency Cash',
    om_transfer: 'Orange Money — Transfer',
    om_withdrawal: 'Orange Money — Withdrawal',
    mtn_transfer: 'MTN MoMo — Transfer',
    mtn_withdrawal: 'MTN MoMo — Withdrawal',
    wave: 'Wave',
  },
};

const PAYMENT_METHOD_MAP: Record<string, Record<string, string>> = {
  fr: {
    alipay: 'Alipay',
    wechat: 'WeChat Pay',
    bank_transfer: 'Virement bancaire',
    cash: 'Cash',
  },
  en: {
    alipay: 'Alipay',
    wechat: 'WeChat Pay',
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
  },
};

const STATUS_MAP: Record<string, Record<string, string>> = {
  fr: {
    created: 'Créé',
    awaiting_proof: 'En attente de preuve',
    proof_submitted: 'Preuve soumise',
    admin_review: 'En vérification',
    validated: 'Validé',
    rejected: 'Refusé',
    pending_correction: 'Correction demandée',
    cancelled: 'Annulé',
    waiting_beneficiary_info: 'En attente infos',
    ready_for_payment: 'Prêt à payer',
    processing: 'En cours',
    completed: 'Effectué',
    cash_pending: 'QR Généré',
    cash_scanned: 'Scanné',
  },
  en: {
    created: 'Created',
    awaiting_proof: 'Awaiting proof',
    proof_submitted: 'Proof submitted',
    admin_review: 'Under review',
    validated: 'Validated',
    rejected: 'Rejected',
    pending_correction: 'Correction required',
    cancelled: 'Cancelled',
    waiting_beneficiary_info: 'Awaiting info',
    ready_for_payment: 'Ready to pay',
    processing: 'Processing',
    completed: 'Completed',
    cash_pending: 'QR Generated',
    cash_scanned: 'Scanned',
  },
};

export const getDepositMethodLabel = (method: string, language = 'fr'): string => {
  const lang = language.startsWith('fr') ? 'fr' : 'en';
  return DEPOSIT_METHOD_MAP[lang]?.[method] ?? method;
};

export const getPaymentMethodLabel = (method: string, language = 'fr'): string => {
  const lang = language.startsWith('fr') ? 'fr' : 'en';
  return PAYMENT_METHOD_MAP[lang]?.[method] ?? method;
};

export const getStatusLabel = (status: string, language = 'fr'): string => {
  const lang = language.startsWith('fr') ? 'fr' : 'en';
  return STATUS_MAP[lang]?.[status] ?? status;
};

// Couleur principale du badge de statut (nouvelle palette Bonzini)
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    validated: colors.green,
    completed: colors.violet,
    rejected: '#ef4444',
    cancelled: '#ef4444',
    processing: colors.gold,
    pending_correction: colors.gold,
    cash_pending: '#06b6d4',
    cash_scanned: colors.orange,
  };
  return statusColors[status] || colors.muted;
};

// Couleur de fond du badge de statut
export const getStatusBgColor = (status: string): string => {
  const bgColors: Record<string, string> = {
    validated: colors.greenLight,
    completed: colors.violetLight,
    rejected: '#fef2f2',
    cancelled: '#fef2f2',
    processing: colors.goldLight,
    pending_correction: colors.goldLight,
    cash_pending: '#ecfeff',
    cash_scanned: colors.orangeLight,
  };
  return bgColors[status] || '#f3f4f6';
};
