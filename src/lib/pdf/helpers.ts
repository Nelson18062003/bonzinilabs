import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { colors } from './styles';

export const formatXAF = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
};

export const formatRMB = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
};

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

// Format du taux de change pour l'affichage dans les reçus.
// exchange_rate est stocké en RMB/XAF (ex: 0.01153).
// Affichage : "11 530 XAF/M" = 11 530 RMB pour 1 million de XAF.
export const formatRateDisplay = (exchangeRate: number): string => {
  const value = Math.round(exchangeRate * 1_000_000);
  return `${formatXAF(value)} XAF/M`;
};

export const getDepositMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    bank_transfer: 'Virement bancaire',
    bank_cash: 'Dépôt cash banque',
    agency_cash: 'Cash agence Bonzini',
    om_transfer: 'Orange Money — Transfert',
    om_withdrawal: 'Orange Money — Retrait',
    mtn_transfer: 'MTN MoMo — Transfert',
    mtn_withdrawal: 'MTN MoMo — Retrait',
    wave: 'Wave',
  };
  return labels[method] || method;
};

export const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    alipay: 'Alipay',
    wechat: 'WeChat Pay',
    bank_transfer: 'Virement bancaire',
    cash: 'Cash',
  };
  return labels[method] || method;
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
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
  };
  return labels[status] || status;
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
