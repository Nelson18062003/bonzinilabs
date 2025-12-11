// ============================================
// DEPOSIT FLOW - TYPE DEFINITIONS
// ============================================

// Method families (Level 1)
export type DepositMethodFamily = 
  | 'BANK'
  | 'AGENCY_BONZINI'
  | 'ORANGE_MONEY'
  | 'MTN_MONEY'
  | 'WAVE';

// Sub-methods (Level 2)
export type DepositSubMethod = 
  // Bank sub-methods
  | 'BANK_TRANSFER'
  | 'BANK_CASH_DEPOSIT'
  // Orange Money sub-methods
  | 'OM_TRANSFER'
  | 'OM_WITHDRAWAL'
  // MTN sub-methods
  | 'MTN_TRANSFER'
  | 'MTN_WITHDRAWAL'
  // Agency - no sub-methods needed
  | 'AGENCY_CASH'
  // Wave - no sub-methods needed
  | 'WAVE_TRANSFER';

// Banks available
export type BankOption = 
  | 'AFRILAND'
  | 'ECOBANK'
  | 'UBA'
  | 'CCA'
  | 'ADVANS'
  | 'OTHER';

// Bonzini agencies
export type AgencyOption = 
  | 'DOUALA_BONAPRISO'
  | 'DOUALA_BONAMOUSSADI'
  | 'YAOUNDE_CENTRE';

// Method family info for UI
export interface MethodFamilyInfo {
  family: DepositMethodFamily;
  label: string;
  icon: string;
  description: string;
}

// Sub-method info for UI
export interface SubMethodInfo {
  subMethod: DepositSubMethod;
  family: DepositMethodFamily;
  label: string;
  description: string;
}

// Bank info for selection
export interface BankInfo {
  bank: BankOption;
  label: string;
  bonziniAccount: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };
}

// Agency info for selection
export interface AgencyInfo {
  agency: AgencyOption;
  label: string;
  address: string;
  hours: string;
}

// Mobile money account info
export interface MobileMoneyInfo {
  phone: string;
  accountName: string;
}

// Deposit request (what we create when user declares a deposit)
export interface DepositRequest {
  id: string;
  clientId: string;
  amountXAF: number;
  methodFamily: DepositMethodFamily;
  subMethod: DepositSubMethod;
  bank?: BankOption;
  agency?: AgencyOption;
  clientPhone?: string; // For OM/MTN withdrawal
  clientName?: string;
  reference: string; // Generated reference code
  status: 'DRAFT' | 'AWAITING_PROOF' | 'SUBMITTED' | 'UNDER_VERIFICATION' | 'VALIDATED' | 'REJECTED';
  createdAt: Date;
}

// Instructions data for the bordereau screen
export interface DepositInstructions {
  title: string;
  steps: string[];
  bonziniInfo: {
    name: string;
    details: string;
    reference: string;
    additionalInfo?: string;
  };
}
