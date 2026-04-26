import { describe, it, expect } from 'vitest';
import {
  MAX_AMOUNT_XAF,
  MIN_AMOUNT_XAF,
  deriveIdentifierType,
  makeAmountStepSchema,
  methodStepSchema,
  validateBeneficiaryStep,
} from '@/components/payment-form/paymentSchemas';
import type { NewBeneficiaryDraft } from '@/components/payment-form/types';

const emptyDraft: NewBeneficiaryDraft = {
  name: '',
  phone: '',
  email: '',
  idType: 'qr',
  identifier: '',
  bankName: '',
  bankAccount: '',
  bankExtra: '',
};

describe('methodStepSchema', () => {
  it('accepts the four supported methods', () => {
    expect(methodStepSchema.safeParse({ selectedMethod: 'alipay' }).success).toBe(true);
    expect(methodStepSchema.safeParse({ selectedMethod: 'wechat' }).success).toBe(true);
    expect(methodStepSchema.safeParse({ selectedMethod: 'bank_transfer' }).success).toBe(true);
    expect(methodStepSchema.safeParse({ selectedMethod: 'cash' }).success).toBe(true);
  });

  it('rejects null / unknown methods', () => {
    expect(methodStepSchema.safeParse({ selectedMethod: null }).success).toBe(false);
    expect(methodStepSchema.safeParse({ selectedMethod: 'paypal' }).success).toBe(false);
    expect(methodStepSchema.safeParse({}).success).toBe(false);
  });
});

describe('makeAmountStepSchema', () => {
  const schema = makeAmountStepSchema({ walletBalanceXaf: 5_000_000 });

  it('accepts an amount in [MIN, MAX] within the wallet balance', () => {
    expect(schema.safeParse({ amountXAF: MIN_AMOUNT_XAF }).success).toBe(true);
    expect(schema.safeParse({ amountXAF: 1_000_000 }).success).toBe(true);
    expect(schema.safeParse({ amountXAF: 5_000_000 }).success).toBe(true);
  });

  it('rejects an amount below MIN_AMOUNT_XAF', () => {
    const result = schema.safeParse({ amountXAF: 5_000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.amountTooHigh');
    }
  });

  it('rejects an amount above MAX_AMOUNT_XAF', () => {
    const big = makeAmountStepSchema({ walletBalanceXaf: Number.MAX_SAFE_INTEGER });
    const result = big.safeParse({ amountXAF: MAX_AMOUNT_XAF + 1 });
    expect(result.success).toBe(false);
  });

  it('rejects amounts above the wallet balance with insufficientBalance', () => {
    const result = schema.safeParse({ amountXAF: 6_000_000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.insufficientBalance');
    }
  });

  it('rejects non-integer amounts', () => {
    expect(schema.safeParse({ amountXAF: 1_000_000.5 }).success).toBe(false);
  });

  it('rejects unsafe-integer amounts', () => {
    expect(
      schema.safeParse({ amountXAF: Number.MAX_SAFE_INTEGER + 1 }).success,
    ).toBe(false);
  });
});

describe('validateBeneficiaryStep', () => {
  it('returns null when a saved beneficiary is selected', () => {
    expect(
      validateBeneficiaryStep({
        method: 'alipay',
        draft: emptyDraft,
        hasQrFile: false,
        hasSelectedBeneficiary: true,
      }),
    ).toBeNull();
  });

  describe('cash', () => {
    it('accepts self with no extra info', () => {
      expect(
        validateBeneficiaryStep({
          method: 'cash',
          draft: emptyDraft,
          hasQrFile: false,
          cashType: 'self',
        }),
      ).toBeNull();
    });

    it('requires name and phone for an "other" recipient', () => {
      expect(
        validateBeneficiaryStep({
          method: 'cash',
          draft: emptyDraft,
          hasQrFile: false,
          cashType: 'other',
        }),
      ).toBe('form.beneficiary.fullNameRequired');

      expect(
        validateBeneficiaryStep({
          method: 'cash',
          draft: { ...emptyDraft, name: 'Jean' },
          hasQrFile: false,
          cashType: 'other',
        }),
      ).toBe('form.beneficiary.phoneRequired');

      expect(
        validateBeneficiaryStep({
          method: 'cash',
          draft: { ...emptyDraft, name: 'Jean', phone: '+86 138 ...' },
          hasQrFile: false,
          cashType: 'other',
        }),
      ).toBeNull();
    });
  });

  describe('alipay / wechat', () => {
    it('rejects when no channel at all is provided', () => {
      expect(
        validateBeneficiaryStep({
          method: 'alipay',
          draft: emptyDraft,
          hasQrFile: false,
        }),
      ).toBe('detail.validation.atLeastOneContact');

      expect(
        validateBeneficiaryStep({
          method: 'wechat',
          draft: emptyDraft,
          hasQrFile: false,
        }),
      ).toBe('detail.validation.atLeastOneContact');
    });

    it.each(['identifier', 'phone', 'email'] as const)(
      'accepts when only %s is provided',
      (field) => {
        const draft = { ...emptyDraft, [field]: 'value' };
        expect(
          validateBeneficiaryStep({
            method: 'alipay',
            draft,
            hasQrFile: false,
          }),
        ).toBeNull();
      },
    );

    it('accepts when only a QR file is attached', () => {
      expect(
        validateBeneficiaryStep({
          method: 'wechat',
          draft: emptyDraft,
          hasQrFile: true,
        }),
      ).toBeNull();
    });
  });

  describe('bank_transfer', () => {
    it('requires name then bank then account', () => {
      expect(
        validateBeneficiaryStep({
          method: 'bank_transfer',
          draft: emptyDraft,
          hasQrFile: false,
        }),
      ).toBe('form.beneficiary.nameRequired');

      expect(
        validateBeneficiaryStep({
          method: 'bank_transfer',
          draft: { ...emptyDraft, name: 'Sun Yat-sen' },
          hasQrFile: false,
        }),
      ).toBe('form.beneficiary.bankRequired');

      expect(
        validateBeneficiaryStep({
          method: 'bank_transfer',
          draft: { ...emptyDraft, name: 'X', bankName: 'ICBC' },
          hasQrFile: false,
        }),
      ).toBe('form.beneficiary.accountRequired');

      expect(
        validateBeneficiaryStep({
          method: 'bank_transfer',
          draft: { ...emptyDraft, name: 'X', bankName: 'ICBC', bankAccount: '6222' },
          hasQrFile: false,
        }),
      ).toBeNull();
    });
  });
});

describe('deriveIdentifierType', () => {
  it('returns null for non-alipay/wechat methods', () => {
    expect(
      deriveIdentifierType('cash', { ...emptyDraft, identifier: 'foo' }),
    ).toBeNull();
    expect(
      deriveIdentifierType('bank_transfer', { ...emptyDraft, identifier: 'foo' }),
    ).toBeNull();
  });

  it('returns null when the identifier field is empty', () => {
    expect(deriveIdentifierType('alipay', emptyDraft)).toBeNull();
    expect(deriveIdentifierType('wechat', { ...emptyDraft, identifier: '   ' })).toBeNull();
  });

  it('returns the chosen idType for alipay/wechat with an identifier set', () => {
    expect(
      deriveIdentifierType('alipay', {
        ...emptyDraft,
        idType: 'id',
        identifier: 'my-id',
      }),
    ).toBe('id');

    expect(
      deriveIdentifierType('wechat', {
        ...emptyDraft,
        idType: 'phone',
        identifier: '+86...',
      }),
    ).toBe('phone');
  });
});
