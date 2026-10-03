import { describe, expect, it } from 'vitest';
import { LEGAL_NAME, companyBankAccounts } from '@/lib/companyIdentity';
import { METHOD_LABEL } from '@/lib/cargoQuote';
import { LEGAL_NAME as LABEL_LEGAL_NAME } from '@/lib/warehouseLabelCanvas';

describe("l'identité officielle sur les documents", () => {
  it('est la raison sociale, pas la marque', () => {
    expect(LEGAL_NAME).toBe('NORTON GAUSS BONZINI SARL');
    expect(LABEL_LEGAL_NAME).toBe(LEGAL_NAME);
  });
  it('donne les comptes bancaires au nom de la société, avec IBAN et SWIFT', () => {
    const accounts = companyBankAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(4);
    for (const a of accounts) {
      expect(a.accountName).toBe(LEGAL_NAME);
      expect(a.iban).toMatch(/^CM21 /);
      expect(a.swift).toMatch(/^[A-Z]{6,11}$/);
    }
  });
  it('sait dire « Solde Bonzini » pour un règlement depuis le portefeuille', () => {
    expect(METHOD_LABEL.wallet).toBe('Solde Bonzini');
  });
});
