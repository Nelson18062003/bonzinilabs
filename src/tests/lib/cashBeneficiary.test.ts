import { describe, it, expect } from 'vitest';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';

const profile = { first_name: 'Ibrahim', last_name: 'Touré' };

describe('cashBeneficiaryName', () => {
  it('un tiers nommé', () => {
    expect(cashBeneficiaryName({ cash_beneficiary_type: 'other', cash_beneficiary_first_name: 'Li', cash_beneficiary_last_name: 'Wei', profile })).toBe('Li Wei');
  });
  it('le client lui-même : son nom, jamais « — »', () => {
    expect(cashBeneficiaryName({ cash_beneficiary_type: 'self', profile })).toBe('Ibrahim Touré');
  });
  it('ancien enregistrement sans type : le client, sinon les noms saisis', () => {
    expect(cashBeneficiaryName({ cash_beneficiary_type: null, profile })).toBe('Ibrahim Touré');
    expect(cashBeneficiaryName({ cash_beneficiary_type: null, cash_beneficiary_first_name: 'Li', cash_beneficiary_last_name: 'Wei' })).toBe('Li Wei');
  });
  it('replis : beneficiary_name puis tiret', () => {
    expect(cashBeneficiaryName({ cash_beneficiary_type: 'other', beneficiary_name: 'Zhang' })).toBe('Zhang');
    expect(cashBeneficiaryName({})).toBe('—');
    expect(cashBeneficiaryName(null)).toBe('—');
  });
});
