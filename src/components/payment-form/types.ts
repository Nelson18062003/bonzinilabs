// ============================================================
// Shared types for the new-payment form (4-step wizard).
// Extracted from NewPaymentPage so each step component can
// import only the types it needs without coupling to the page.
// ============================================================

export type Step = 'method' | 'amount' | 'beneficiary' | 'confirm';

export type Currency = 'XAF' | 'RMB';

export type PaymentMethodType = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

export type IdentificationType = 'qr' | 'id' | 'email' | 'phone';

export const STEP_KEYS: readonly Step[] = ['method', 'amount', 'beneficiary', 'confirm'] as const;

export const PAYMENT_METHOD_IDS: readonly PaymentMethodType[] = [
  'alipay',
  'wechat',
  'bank_transfer',
  'cash',
] as const;

export const QUICK_XAF: readonly number[] = [100_000, 250_000, 500_000, 1_000_000] as const;
export const QUICK_RMB: readonly number[] = [1_000, 2_500, 5_000, 10_000] as const;

/**
 * Holds every "new beneficiary" field across the three method
 * variants (cash / alipay-wechat / bank). Each step only reads
 * and writes the subset that applies to the current method.
 */
export interface NewBeneficiaryDraft {
  name: string;
  phone: string;
  email: string;
  idType: IdentificationType;
  identifier: string;
  bankName: string;
  bankAccount: string;
  bankExtra: string;
}

export interface NewBeneficiaryDraftSetters {
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
  setIdType: (v: IdentificationType) => void;
  setIdentifier: (v: string) => void;
  setBankName: (v: string) => void;
  setBankAccount: (v: string) => void;
  setBankExtra: (v: string) => void;
}
