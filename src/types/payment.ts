// ============================================================
// MODULE PAIEMENTS — Types & Constants
// Centralized payment display labels, colors, and configuration
// ============================================================

import type { Database } from '@/integrations/supabase/types';

// ---------- DB enums ----------

export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];

// ---------- Display labels ----------

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  created: 'Créé',
  waiting_beneficiary_info: 'Info att.',
  ready_for_payment: 'Prêt',
  processing: 'En cours',
  completed: 'Terminé',
  rejected: 'Rejeté',
  cash_pending: 'Cash att.',
  cash_scanned: 'Cash scanné',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  created: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  waiting_beneficiary_info: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  ready_for_payment: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cash_pending: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  cash_scanned: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
};

// Extended status config for detail screen (includes label + color together)
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  created: { label: 'Créé', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  waiting_beneficiary_info: { label: 'En attente infos', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  ready_for_payment: { label: 'Prêt à payer', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  cash_pending: { label: 'QR Généré', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  cash_scanned: { label: 'Scanné', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  processing: { label: 'En cours', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  completed: { label: 'Effectué', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  rejected: { label: 'Refusé', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

// ---------- Method configuration ----------

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
  bank_transfer: 'Virement',
  cash: 'Cash',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  alipay: '支',
  wechat: '微',
  bank_transfer: '🏦',
  cash: '💵',
};

// ---------- Filters ----------

// Composite filter for "à traiter" KPI card
export const TO_PROCESS_STATUSES: PaymentStatus[] = ['ready_for_payment', 'cash_scanned'];

// ---------- Rejection ----------

export const PAYMENT_REJECTION_REASONS = [
  'Bénéficiaire introuvable',
  'Compte bancaire incorrect',
  'QR code expiré ou invalide',
  'Montant incorrect',
  'Informations incomplètes',
  'Refus du bénéficiaire',
  'Problème technique',
  'Autre',
] as const;
