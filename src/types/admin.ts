// ============================================
// BONZINI ADMIN - TYPE DEFINITIONS
// ============================================

// Import the source of truth for admin roles from AdminAuthContext
import type { AppRole, AdminStatus } from '@/contexts/AdminAuthContext';

// Re-export for convenience
export type { AppRole, AdminStatus };

// ============================================
// CLIENT MODULE
// ============================================

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_KYC';
export type ClientGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
}

export interface ClientTag {
  clientId: string;
  tagId: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  gender: ClientGender;
  whatsappNumber: string;
  email?: string;
  country: string;
  city?: string;
  tagIds: string[];
  status: ClientStatus;
  kycVerified: boolean;
  avatar?: string;
  notes?: string;
  totalDeposits: number;
  totalPayments: number;
  walletBalance: number;
  lastDepositAt?: Date;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientWithTags extends Omit<Client, 'tagIds'> {
  tags: Tag[];
}

// ============================================
// ADMIN AUDIT LOG
// ============================================

export type AdminActionType =
  | 'DEPOSIT_VALIDATED'
  | 'DEPOSIT_REJECTED'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_COMPLETED'
  | 'PROOF_UPLOADED'
  | 'RATE_UPDATED'
  | 'RATE_CREATED'
  | 'RATE_DELETED'
  | 'CLIENT_UPDATED'
  | 'CLIENT_SUSPENDED'
  | 'WALLET_CREDITED'
  | 'WALLET_DEBITED'
  | 'WALLET_ADJUSTED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'LOGIN'
  | 'LOGOUT';

export interface AdminLogEntry {
  id: string;
  adminUserId: string;
  adminUserName: string;
  actionType: AdminActionType;
  targetType: 'DEPOSIT' | 'PAYMENT' | 'CLIENT' | 'RATE' | 'WALLET' | 'AUTH' | 'USER';
  targetId?: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

// ============================================
// DEPOSIT MODULE
// ============================================

export type DepositMethod =
  | 'BANK_TRANSFER'
  | 'CASH_BANK'
  | 'ORANGE_MONEY'
  | 'MTN_MONEY'
  | 'WAVE'
  | 'AGENCY';

export type DepositStatus =
  | 'SUBMITTED'
  | 'PROOF_UPLOADED'
  | 'UNDER_VERIFICATION'
  | 'VALIDATED'
  | 'REJECTED';

export interface AdminDeposit {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  walletId: string;
  method: string;
  amountXAF: number;
  status: DepositStatus;
  reference?: string;
  notes?: string;
  adminComment?: string;
  proofUrl?: string;
  proofFileName?: string;
  assignedTo?: string;
  validatedBy?: string;
  validatedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositProof {
  id: string;
  depositId: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  fileSize?: number;
  uploadedAt: Date;
}

export type DepositTimelineStep =
  | 'SUBMITTED'
  | 'PROOF_UPLOADED'
  | 'UNDER_VERIFICATION'
  | 'VALIDATED'
  | 'REJECTED'
  | 'WALLET_CREDITED';

export interface DepositTimelineEvent {
  id: string;
  depositId: string;
  step: DepositTimelineStep;
  description: string;
  performedBy: 'CLIENT' | 'ADMIN' | 'SYSTEM';
  performedByName?: string;
  performedByAdminId?: string;
  timestamp: Date;
}

// ============================================
// PAYMENT MODULE
// ============================================

export type PaymentMethod = 'ALIPAY' | 'WECHAT' | 'BANK_TRANSFER' | 'CASH_COUNTER';

export type PaymentStatus =
  | 'SUBMITTED'
  | 'INFO_RECEIVED'
  | 'READY_TO_PAY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PROOF_AVAILABLE'
  | 'CANCELLED';

export interface AdminPayment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  walletId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  method: PaymentMethod | string;
  amountXAF: number;
  amountRMB: number;
  exchangeRate: number;
  fees: number;
  status: PaymentStatus | string;
  notes?: string;
  adminComment?: string;
  proofUrl?: string;
  proofFileName?: string;
  processedBy?: string;
  paidBy?: string;
  paidAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentBeneficiary {
  id: string;
  paymentId: string;
  method: PaymentMethod | string;
  alipayId?: string;
  wechatId?: string;
  qrCodeUrl?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  cashCounterLocation?: string;
  receiverName?: string;
  receiverIdNumber?: string;
  recipientName: string;
  recipientPhone?: string;
  createdAt: Date;
}

export interface PaymentProof {
  id: string;
  paymentId: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  fileSize?: number;
  uploadedAt: Date;
  uploadedByAdminId?: string;
}

export type PaymentTimelineStep =
  | 'SUBMITTED'
  | 'INFO_RECEIVED'
  | 'READY_TO_PAY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PROOF_UPLOADED'
  | 'PROOF_AVAILABLE'
  | 'CANCELLED'
  | 'WALLET_DEBITED';

export interface PaymentTimelineEvent {
  id: string;
  paymentId: string;
  step: PaymentTimelineStep;
  description: string;
  performedBy: 'CLIENT' | 'ADMIN' | 'SYSTEM';
  performedByName?: string;
  performedByAdminId?: string;
  timestamp: Date;
}

// ============================================
// WALLET MODULE
// ============================================

export interface Wallet {
  id: string;
  clientId: string;
  currentBalanceXAF: number;
  updatedAt: Date;
}

export type WalletOperationType = 'CREDIT' | 'DEBIT' | 'ADJUSTMENT';
export type WalletOperationSource = 'DEPOSIT' | 'PAYMENT' | 'MANUAL';

export interface WalletOperation {
  id: string;
  walletId: string;
  type: WalletOperationType;
  sourceType: WalletOperationSource;
  sourceId?: string;
  amountXAF: number;
  description: string;
  createdAt: Date;
  createdByAdminUserId?: string;
}

// ============================================
// DASHBOARD
// ============================================

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalWalletBalance: number;
  pendingDeposits: number;
  pendingPayments: number;
  todayDeposits: number;
  todayPayments: number;
  todayVolume: number;
  currentRate: number;
}

// ============================================
// NOTIFICATIONS
// ============================================

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'WHATSAPP' | 'EMAIL' | 'SMS';
  trigger: string;
  subject?: string;
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ADMIN MANAGEMENT MODULE (Feature A)
// ============================================

// Extended admin user with status and timestamps for admin management
export interface AdminUserWithStatus {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  status: AdminStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

// Data for creating a new admin
export interface CreateAdminData {
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
}

// Data for updating an admin
export interface UpdateAdminData {
  userId: string;
  firstName?: string;
  lastName?: string;
  role?: AppRole;
}

// Filter options for admin list
export interface AdminFilters {
  role?: AppRole | 'all';
  status?: AdminStatus | 'all';
  search?: string;
}

// Result from create-admin Edge Function
export interface CreateAdminResult {
  success: boolean;
  userId?: string;
  email?: string;
  tempPassword?: string;
  message?: string;
  error?: string;
}

// Result from reset-admin-password Edge Function
export interface ResetPasswordResult {
  success: boolean;
  tempPassword?: string;
  message?: string;
  error?: string;
}

// Result from RPC functions (toggle_admin_status, update_admin_role)
export interface AdminRpcResult {
  success: boolean;
  error?: string;
}

// ============================================
// LEDGER ENTRIES MODULE
// ============================================

export type LedgerEntryType =
  | 'DEPOSIT_VALIDATED'
  | 'DEPOSIT_REFUSED'
  | 'PAYMENT_RESERVED'
  | 'PAYMENT_EXECUTED'
  | 'PAYMENT_CANCELLED_REFUNDED'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT';

export interface LedgerEntry {
  id: string;
  walletId: string;
  userId: string;
  entryType: LedgerEntryType;
  amountXAF: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: 'deposit' | 'payment' | 'adjustment';
  referenceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdByAdminId?: string;
  createdByAdminName?: string;
  createdAt: Date;
}

export interface LedgerFilters {
  entryType?: LedgerEntryType | 'all';
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================
// WALLET ADJUSTMENTS MODULE
// ============================================

export type AdjustmentType = 'CREDIT' | 'DEBIT';

export interface WalletAdjustment {
  id: string;
  walletId: string;
  userId: string;
  adjustmentType: AdjustmentType;
  amountXAF: number;
  reason: string;
  proofUrls: string[];
  ledgerEntryId?: string;
  createdByAdminId: string;
  createdByAdminName?: string;
  createdAt: Date;
}

export interface CreateAdjustmentData {
  userId: string;
  adjustmentType: AdjustmentType;
  amountXAF: number;
  reason: string;
  proofUrls?: string[];
}

export interface AdjustmentResult {
  success: boolean;
  adjustmentId?: string;
  ledgerEntryId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  error?: string;
  currentBalance?: number;
  requestedAmount?: number;
}

// ============================================
// CLIENT CREATION MODULE
// ============================================

export interface CreateClientData {
  firstName: string;
  lastName: string;
  company?: string;
  gender?: ClientGender;
  whatsappNumber: string;
  email?: string;
  country: string;
  city?: string;
}

export interface CreateClientResult {
  success: boolean;
  clientId?: string;
  walletId?: string;
  email?: string;
  authEmail?: string;
  tempPassword?: string;
  message?: string;
  error?: string;
}

export interface ClientFilters {
  status?: ClientStatus | 'all';
  search?: string; // Searches name, phone, ID
}

// ============================================
// CLIENT WITH WALLET (for admin views)
// ============================================

export interface ClientWithWallet extends Client {
  walletId: string;
  currentBalance: number;
  lastLedgerEntry?: LedgerEntry;
}
