// ============================================
// BONZINI MVP - TYPE DEFINITIONS
// ============================================

// User & Profile
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Wallet
export interface Wallet {
  id: string;
  userId: string;
  balanceXAF: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WalletOperationType = 'CREDIT' | 'DEBIT';

export interface WalletOperation {
  id: string;
  walletId: string;
  type: WalletOperationType;
  amountXAF: number;
  description: string;
  referenceType: 'DEPOSIT' | 'PAYMENT';
  referenceId: string;
  balanceAfter: number;
  createdAt: Date;
}

// Deposits
export type DepositMethod = 
  | 'BANK_TRANSFER'
  | 'CASH_DEPOSIT'
  | 'AGENCY_DEPOSIT'
  | 'ORANGE_MONEY_WITHDRAWAL'
  | 'ORANGE_MONEY_TRANSFER'
  | 'MTN_MONEY_WITHDRAWAL'
  | 'MTN_MONEY_TRANSFER'
  | 'WAVE';

export type DepositStatus = 
  | 'SUBMITTED'
  | 'PROOF_UPLOADED'
  | 'UNDER_VERIFICATION'
  | 'VALIDATED'
  | 'REJECTED';

export interface Deposit {
  id: string;
  userId: string;
  walletId: string;
  method: DepositMethod;
  amountXAF: number;
  status: DepositStatus;
  reference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositProof {
  id: string;
  depositId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
}

export interface DepositTimeline {
  id: string;
  depositId: string;
  status: DepositStatus;
  description: string;
  createdAt: Date;
}

// Payments
export type PaymentMethod = 
  | 'ALIPAY'
  | 'WECHAT'
  | 'BANK_TRANSFER'
  | 'CASH_COUNTER';

export type PaymentStatus = 
  | 'SUBMITTED'
  | 'INFO_RECEIVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PROOF_AVAILABLE'
  | 'CANCELLED';

export interface Beneficiary {
  id: string;
  userId: string;
  name: string;
  chineseName?: string;
  paymentMethod: PaymentMethod;
  // For Alipay/WeChat
  qrCodeUrl?: string;
  accountNumber?: string;
  // For Bank Transfer
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  // For Cash Counter
  idNumber?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  walletId: string;
  beneficiaryId: string;
  method: PaymentMethod;
  amountXAF: number;
  amountRMB: number;
  exchangeRate: number;
  fees: number;
  status: PaymentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProof {
  id: string;
  paymentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
}

export interface PaymentTimeline {
  id: string;
  paymentId: string;
  status: PaymentStatus;
  description: string;
  createdAt: Date;
}

// Rates
export interface ExchangeRate {
  id: string;
  date: Date;
  xafToRmb: number;
  rmbToXaf: number;
  createdAt: Date;
}

// Timeline Events (Unified)
export type TimelineEventType = 'DEPOSIT' | 'PAYMENT';

export interface TimelineEvent {
  id: string;
  userId: string;
  type: TimelineEventType;
  referenceId: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
}

// Deposit Method Info
export interface DepositMethodInfo {
  method: DepositMethod;
  label: string;
  icon: string;
  description: string;
  instructions: string[];
  accountInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    phone?: string;
    address?: string;
  };
}

// Payment Method Info
export interface PaymentMethodInfo {
  method: PaymentMethod;
  label: string;
  icon: string;
  description: string;
  requiredFields: string[];
}
