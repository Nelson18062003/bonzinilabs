// ============================================================
// MODULE DEPOTS — Types & Constants (from scratch)
// ============================================================

// ---------- DB enums ----------

export type DepositMethod =
  | 'bank_transfer'
  | 'bank_cash'
  | 'agency_cash'
  | 'om_transfer'
  | 'om_withdrawal'
  | 'mtn_transfer'
  | 'mtn_withdrawal'
  | 'wave';

export type DepositStatus =
  | 'created'
  | 'awaiting_proof'
  | 'proof_submitted'
  | 'admin_review'
  | 'validated'
  | 'rejected'
  | 'pending_correction'
  | 'cancelled'
  | 'cancelled_by_admin';

// ---------- UI-level method hierarchy ----------

export type DepositMethodFamily =
  | 'BANK'
  | 'AGENCY_BONZINI'
  | 'ORANGE_MONEY'
  | 'MTN_MONEY'
  | 'WAVE';

export type DepositSubMethod =
  | 'BANK_TRANSFER'
  | 'BANK_CASH_DEPOSIT'
  | 'OM_TRANSFER'
  | 'OM_WITHDRAWAL'
  | 'MTN_TRANSFER'
  | 'MTN_WITHDRAWAL'
  | 'AGENCY_CASH'
  | 'WAVE_TRANSFER';

export type BankOption =
  | 'ECOBANK'
  | 'CCA'
  | 'UBA'
  | 'AFRILAND'
  | 'OTHER';

export type AgencyOption =
  | 'DOUALA_BONAPRISO'
  | 'DOUALA_BONAMOUSSADI'
  | 'YAOUNDE_CENTRE';

// ---------- Data-layer interfaces ----------

export interface MethodFamilyInfo {
  family: DepositMethodFamily;
  label: string;
  icon: string;
  description: string;
}

export interface SubMethodInfo {
  subMethod: DepositSubMethod;
  family: DepositMethodFamily;
  label: string;
  description: string;
}

export interface BankInfo {
  bank: BankOption;
  label: string;
  bonziniAccount: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    iban: string;
    swift: string;
    codeBanque: string;
    codeAgence: string;
    cleRib: string;
  };
}

export interface AgencyInfo {
  agency: AgencyOption;
  label: string;
  address: string;
  hours: string;
}

export interface MobileMoneyInfo {
  phone: string;
  accountName: string;
}

export interface MerchantInfo {
  accountName: string;
  merchantCode: string;
}

// ---------- DB row types ----------

export interface Deposit {
  id: string;
  user_id: string;
  reference: string;
  amount_xaf: number;
  method: DepositMethod;
  bank_name: string | null;
  agency_name: string | null;
  client_phone: string | null;
  status: DepositStatus;
  admin_comment: string | null;
  rejection_reason: string | null;
  confirmed_amount_xaf: number | null;
  rejection_category: string | null;
  admin_internal_note: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositWithProfile extends Deposit {
  profiles: {
    user_id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    company_name?: string | null;
  } | null;
  proof_count?: number;
}

export interface DepositProof {
  id: string;
  deposit_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_by_type: 'client' | 'admin' | null;
  is_visible_to_client: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
}

export interface DepositProofWithUrl extends DepositProof {
  signedUrl: string | null;
}

export interface DepositTimelineEvent {
  id: string;
  deposit_id: string;
  event_type: string;
  description: string;
  performed_by: string | null;
  created_at: string;
}

// ---------- Mutation inputs ----------

export interface CreateDepositData {
  amount_xaf: number;
  method: DepositMethod;
  bank_name?: string;
  agency_name?: string;
  client_phone?: string;
}

export interface AdminCreateDepositData {
  user_id: string;
  amount_xaf: number;
  method: DepositMethod;
  bank_name?: string;
  agency_name?: string;
  client_phone?: string;
  admin_comment?: string;
  proofFiles?: File[];
}

// ---------- Stats ----------

export interface DepositStats {
  total: number;
  awaiting_proof: number;
  proof_submitted: number;
  pending_correction: number;
  admin_review: number;
  validated: number;
  rejected: number;
  to_process: number;
  today_validated: number;
  today_amount: number;
}

// ---------- Mapping: UI sub-method → DB method ----------

export const SUB_METHOD_TO_DB_METHOD: Record<DepositSubMethod, DepositMethod> = {
  BANK_TRANSFER: 'bank_transfer',
  BANK_CASH_DEPOSIT: 'bank_cash',
  OM_TRANSFER: 'om_transfer',
  OM_WITHDRAWAL: 'om_withdrawal',
  MTN_TRANSFER: 'mtn_transfer',
  MTN_WITHDRAWAL: 'mtn_withdrawal',
  AGENCY_CASH: 'agency_cash',
  WAVE_TRANSFER: 'wave',
};

// ---------- Display labels ----------

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  created: 'Demande créée',
  awaiting_proof: 'En attente de preuve',
  proof_submitted: 'Preuve envoyée',
  admin_review: 'En vérification',
  validated: 'Validé',
  rejected: 'Rejeté',
  pending_correction: 'À corriger',
  cancelled: 'Annulé',
  cancelled_by_admin: 'Annulé (admin)',
};

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  bank_transfer: 'Virement bancaire',
  bank_cash: 'Dépôt cash banque',
  agency_cash: 'Cash agence Bonzini',
  om_transfer: 'Orange Money – Transfert',
  om_withdrawal: 'Orange Money – Retrait',
  mtn_transfer: 'MTN MoMo – Transfert',
  mtn_withdrawal: 'MTN MoMo – Retrait',
  wave: 'Wave',
};

export const DEPOSIT_METHOD_LABELS_SHORT: Record<DepositMethod, string> = {
  bank_transfer: 'Virement',
  bank_cash: 'Cash banque',
  agency_cash: 'Cash agence',
  om_transfer: 'Orange UV',
  om_withdrawal: 'Orange code',
  mtn_transfer: 'MTN Float',
  mtn_withdrawal: 'MTN code',
  wave: 'Wave',
};

export const DEPOSIT_STATUS_COLORS: Record<DepositStatus, string> = {
  created: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  awaiting_proof: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  proof_submitted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  admin_review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  pending_correction: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  validated: 'bg-green-500/10 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  cancelled_by_admin: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

// ---------- Timeline method families ----------

export type TimelineMethodFamily = 'standard' | 'withdrawal' | 'agency';

export function getTimelineMethodFamily(method: string): TimelineMethodFamily {
  if (method === 'agency_cash') return 'agency';
  if (method === 'om_withdrawal' || method === 'mtn_withdrawal') return 'withdrawal';
  return 'standard';
}

export const TIMELINE_STEP_KEYS = ['created', 'proof_submitted', 'admin_review', 'validated'] as const;

export const TIMELINE_STEP_LABELS: Record<TimelineMethodFamily, Record<string, { label: string; description: string }>> = {
  standard: {
    created: { label: 'Dépôt déclaré', description: 'Votre dépôt a été enregistré' },
    proof_submitted: { label: 'Preuve envoyée', description: 'En attente de vérification' },
    admin_review: { label: 'En vérification', description: "L'équipe Bonzini vérifie votre dépôt" },
    validated: { label: 'Validé — Solde crédité', description: 'Votre wallet a été crédité' },
  },
  withdrawal: {
    created: { label: 'Retrait déclaré', description: 'Votre retrait a été enregistré' },
    proof_submitted: { label: 'Code fourni', description: 'Code de retrait transmis' },
    admin_review: { label: 'En vérification', description: "L'équipe Bonzini vérifie le retrait" },
    validated: { label: 'Validé — Solde crédité', description: 'Votre wallet a été crédité' },
  },
  agency: {
    created: { label: 'Dépôt en agence', description: 'Dépôt déclaré en agence Bonzini' },
    proof_submitted: { label: 'Reçu confirmé', description: "Reçu de l'agence enregistré" },
    admin_review: { label: 'En vérification', description: 'Validation en cours' },
    validated: { label: 'Validé — Solde crédité', description: 'Votre wallet a été crédité' },
  },
};

// ---------- Rejection reasons (admin picks one) ----------

export const REJECTION_REASONS = [
  'Montant incorrect',
  'Preuve illisible',
  'Référence absente',
  'Mauvais compte bancaire',
  'Document non conforme',
  'Suspicion / incohérence',
  'Autre',
] as const;

export const PROOF_DELETE_REASONS = [
  'Upload incorrect',
  'Mauvais dépôt',
  'Doublon',
  'Image illisible',
  'Autre',
] as const;
