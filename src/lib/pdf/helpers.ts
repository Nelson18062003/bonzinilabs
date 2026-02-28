import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { colors } from './styles';

export const formatXAF = (amount: number): string => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const formatRMB = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
};

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

export const getDepositMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    bank_transfer: 'Virement bancaire',
    bank_cash: 'Dépôt cash banque',
    agency_cash: 'Cash agence Bonzini',
    om_transfer: 'Orange Money - Transfert',
    om_withdrawal: 'Orange Money - Retrait',
    mtn_transfer: 'MTN MoMo - Transfert',
    mtn_withdrawal: 'MTN MoMo - Retrait',
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

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    validated: colors.success,
    completed: colors.success,
    rejected: colors.danger,
    cancelled: colors.danger,
    processing: colors.warning,
    pending_correction: colors.warning,
  };
  return statusColors[status] || colors.muted;
};
