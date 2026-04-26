// ============================================================
// Zod schemas for the 4-step new-payment wizard.
// Each schema returns either a parsed payload or a localised error
// key the caller can pass to t() for display.
//
// Pure functions, no React, so they can be unit-tested in isolation.
// ============================================================
import { z } from 'zod';
import type {
  IdentificationType,
  NewBeneficiaryDraft,
  PaymentMethodType,
} from './types';

// ──────────────────────────────────────────────────────────────────
// Amount caps (mirror the security rule documented in
// .claude/rules/security.md: 50M XAF max, safe integer required)
// ──────────────────────────────────────────────────────────────────
export const MIN_AMOUNT_XAF = 10_000;
export const MAX_AMOUNT_XAF = 50_000_000;

// ──────────────────────────────────────────────────────────────────
// Step 1 — method
// ──────────────────────────────────────────────────────────────────

export const methodStepSchema = z.object({
  selectedMethod: z.enum(['alipay', 'wechat', 'bank_transfer', 'cash'] as const),
});

export type MethodStepValues = z.infer<typeof methodStepSchema>;

// ──────────────────────────────────────────────────────────────────
// Step 2 — amount (depends on wallet balance, hence a factory)
// ──────────────────────────────────────────────────────────────────

interface AmountStepInput {
  walletBalanceXaf: number;
}

/**
 * Returns a schema that validates the computed XAF amount against
 * the configured caps and the current wallet balance. Errors are
 * i18n keys that exist under `payments.form.*`.
 */
export function makeAmountStepSchema({ walletBalanceXaf }: AmountStepInput) {
  return z.object({
    amountXAF: z
      .number({ invalid_type_error: 'form.amountTooHigh' })
      .int('form.amountTooHigh')
      .min(MIN_AMOUNT_XAF, 'form.amountTooHigh')
      .max(MAX_AMOUNT_XAF, 'form.amountTooHigh')
      .refine((value) => Number.isSafeInteger(value), {
        message: 'form.amountTooHigh',
      })
      .refine((value) => value <= walletBalanceXaf, {
        message: 'form.insufficientBalance',
      }),
  });
}

// ──────────────────────────────────────────────────────────────────
// Step 3 — beneficiary (method-specific)
// ──────────────────────────────────────────────────────────────────

interface BeneficiaryInput {
  method: PaymentMethodType;
  draft: NewBeneficiaryDraft;
  hasQrFile: boolean;
  /** Cash sub-flow — when 'self' the form needs no extra input. */
  cashType?: 'self' | 'other';
  /** Whether the user picked a saved beneficiary instead of typing one. */
  hasSelectedBeneficiary?: boolean;
}

/**
 * Soft validation: returns null when the data looks complete enough
 * to move forward. Returns an i18n key otherwise so the caller can
 * disable the CTA / show a hint.
 *
 * The wizard always lets the user skip the beneficiary step
 * (the "complete later" affordance), so a null return doesn't gate
 * navigation — it just signals "the data on this step is coherent".
 */
export function validateBeneficiaryStep(input: BeneficiaryInput): string | null {
  const { method, draft, hasQrFile, cashType, hasSelectedBeneficiary } = input;

  if (hasSelectedBeneficiary) return null;

  if (method === 'cash') {
    if (cashType === 'self') return null;
    if (cashType === 'other') {
      if (!draft.name.trim()) return 'form.beneficiary.fullNameRequired';
      if (!draft.phone.trim()) return 'form.beneficiary.phoneRequired';
      return null;
    }
    return null;
  }

  if (method === 'alipay' || method === 'wechat') {
    const hasAnyChannel =
      hasQrFile ||
      draft.identifier.trim() ||
      draft.phone.trim() ||
      draft.email.trim();
    return hasAnyChannel ? null : 'detail.validation.atLeastOneContact';
  }

  if (method === 'bank_transfer') {
    if (!draft.name.trim()) return 'form.beneficiary.nameRequired';
    if (!draft.bankName.trim()) return 'form.beneficiary.bankRequired';
    if (!draft.bankAccount.trim()) return 'form.beneficiary.accountRequired';
    return null;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────
// Identifier-type helper used at submit time
// ──────────────────────────────────────────────────────────────────

export function deriveIdentifierType(
  method: PaymentMethodType,
  draft: NewBeneficiaryDraft,
): IdentificationType | null {
  if (method !== 'alipay' && method !== 'wechat') return null;
  if (!draft.identifier.trim()) return null;
  return draft.idType;
}
