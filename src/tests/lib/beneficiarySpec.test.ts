import { describe, it, expect } from 'vitest';
import {
  BENEFICIARY_SPEC,
  getBeneficiaryNaturalKey,
  isBeneficiaryComplete,
  isSameBeneficiaryKey,
  validateBeneficiaryInput,
  type BeneficiaryInput,
} from '@/lib/beneficiaries/spec';
import { parseBeneficiary } from '@/lib/beneficiaries/schema';

// Minimal valid inputs per mode (used as a base then mutated per test).
const validAlipay: BeneficiaryInput = {
  payment_method: 'alipay',
  alias: 'Fournisseur Yiwu',
  name: '张伟',
  identifier: '138****5678',
  identifier_type: 'phone',
};

const validBank: BeneficiaryInput = {
  payment_method: 'bank_transfer',
  alias: 'Usine textile',
  name: '李明',
  bank_name: '中国工商银行',
  bank_account: '6222021234567890123',
};

const validCash: BeneficiaryInput = {
  payment_method: 'cash',
  alias: 'Contact Guangzhou',
  name: 'Wang Lei',
  phone: '+8613800000000',
};

describe('validateBeneficiaryInput — completeness per mode', () => {
  it('accepts a complete Alipay beneficiary (identifier channel)', () => {
    expect(isBeneficiaryComplete(validAlipay)).toBe(true);
  });

  it('accepts an Alipay beneficiary with QR but no identifier', () => {
    const input: BeneficiaryInput = {
      payment_method: 'alipay',
      alias: 'QR fournisseur',
      name: '张伟',
      qr_code_url: 'payment-proofs/qr/abc.png',
    };
    expect(isBeneficiaryComplete(input)).toBe(true);
  });

  it('accepts an Alipay beneficiary with email as the only channel', () => {
    const input: BeneficiaryInput = {
      payment_method: 'alipay', alias: 'Email fournisseur', name: '张伟', email: 'zhang@example.cn',
    };
    expect(isBeneficiaryComplete(input)).toBe(true);
  });

  it('accepts an Alipay beneficiary with phone as the only channel', () => {
    const input: BeneficiaryInput = {
      payment_method: 'alipay', alias: 'Tel fournisseur', name: '张伟', phone: '+8613800000000',
    };
    expect(isBeneficiaryComplete(input)).toBe(true);
  });

  it('rejects an Alipay beneficiary with no channel at all (no id/QR/email/phone)', () => {
    const input = { ...validAlipay, identifier: '', qr_code_url: '' };
    const errors = validateBeneficiaryInput(input);
    expect(errors.identifier).toBe('beneficiaries.errors.accountChannelRequired');
  });

  it('requires alias for every mode', () => {
    expect(validateBeneficiaryInput({ ...validAlipay, alias: '' }).alias).toBe(
      'beneficiaries.errors.aliasRequired',
    );
    expect(validateBeneficiaryInput({ ...validBank, alias: '  ' }).alias).toBe(
      'beneficiaries.errors.aliasRequired',
    );
    expect(validateBeneficiaryInput({ ...validCash, alias: '' }).alias).toBe(
      'beneficiaries.errors.aliasRequired',
    );
  });

  it('requires bank_name and bank_account for bank_transfer', () => {
    expect(validateBeneficiaryInput({ ...validBank, bank_name: '' }).bank_name).toBe(
      'beneficiaries.errors.bank_nameRequired',
    );
    expect(validateBeneficiaryInput({ ...validBank, bank_account: '' }).bank_account).toBe(
      'beneficiaries.errors.bank_accountRequired',
    );
  });

  it('requires phone for cash', () => {
    expect(validateBeneficiaryInput({ ...validCash, phone: '' }).phone).toBe(
      'beneficiaries.errors.phoneRequired',
    );
  });
});

describe('Chinese characters are accepted (validate structure, not script)', () => {
  it('accepts CJK holder name and bank name', () => {
    expect(isBeneficiaryComplete(validBank)).toBe(true); // 李明 / 中国工商银行
    const r = parseBeneficiary(validBank);
    expect(r.ok).toBe(true);
  });

  it('flags a name that exceeds the character cap', () => {
    const tooLong = '李'.repeat(200);
    expect(validateBeneficiaryInput({ ...validBank, name: tooLong }).name).toBe(
      'beneficiaries.errors.tooLong',
    );
  });
});

describe('natural key & duplicate detection', () => {
  it('keys Alipay on identifier, bank on account, cash on nothing', () => {
    expect(getBeneficiaryNaturalKey(validAlipay)?.column).toBe('identifier');
    expect(getBeneficiaryNaturalKey(validBank)?.column).toBe('bank_account');
    expect(getBeneficiaryNaturalKey(validCash)).toBeNull();
    expect(BENEFICIARY_SPEC.cash.naturalKeyColumn).toBeNull();
  });

  it('detects same-key collisions case/space-insensitively', () => {
    const a = { ...validAlipay, identifier: 'Zhang@Alipay.CN' };
    const b = { ...validAlipay, identifier: ' zhang@alipay.cn ' };
    expect(isSameBeneficiaryKey(a, b)).toBe(true);
  });

  it('does not collide across different modes', () => {
    const a = { ...validAlipay, identifier: 'x' };
    const b = { ...validBank, bank_account: 'x' };
    expect(isSameBeneficiaryKey(a, b)).toBe(false);
  });
});

describe('parseBeneficiary (Zod) mirrors the spec', () => {
  it('rejects invalid email on cash', () => {
    const r = parseBeneficiary({ ...validCash, email: 'not-an-email' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKey).toBe('beneficiaries.errors.emailInvalid');
  });

  it('accepts a blank optional email', () => {
    const r = parseBeneficiary({ ...validCash, email: '' });
    expect(r.ok).toBe(true);
  });

  it('rejects an incomplete bank beneficiary', () => {
    const r = parseBeneficiary({ ...validBank, bank_account: '' });
    expect(r.ok).toBe(false);
  });
});
