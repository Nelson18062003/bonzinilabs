import { describe, it, expect } from 'vitest';
import {
  amountsCoherent,
  canCancelPayment,
  canEditPaymentAmounts,
  canEditPaymentBeneficiary,
  cancelRequiresReason,
  normalizeRateInt,
  rmbForXaf,
  walletDeltaForCorrection,
} from '@/lib/paymentEdits';

describe('annulation', () => {
  it('un paiement effectué reste annulable par le super admin, avec motif', () => {
    expect(canCancelPayment('completed', true)).toBe(true);
    expect(cancelRequiresReason('completed')).toBe(true);
    expect(cancelRequiresReason('processing')).toBe(false);
  });
  it('un paiement déjà remboursé ne s’annule pas deux fois', () => {
    expect(canCancelPayment('rejected', true)).toBe(false);
    expect(canCancelPayment('cancelled_by_admin', true)).toBe(false);
  });
  it('un opérateur non super admin ne peut pas annuler', () => {
    expect(canCancelPayment('processing', false)).toBe(false);
  });
});

describe('modification des montants', () => {
  it('tout agent habilité modifie un paiement en cours', () => {
    expect(canEditPaymentAmounts('ready_for_payment', true, false)).toBe(true);
    expect(canEditPaymentAmounts('processing', true, false)).toBe(true);
  });
  it('un paiement clos ne se corrige qu’en super admin', () => {
    expect(canEditPaymentAmounts('completed', true, false)).toBe(false);
    expect(canEditPaymentAmounts('completed', true, true)).toBe(true);
  });
  it('le bénéficiaire ne se modifie que tant que le paiement n’est pas parti, jamais en cash', () => {
    expect(canEditPaymentBeneficiary('waiting_beneficiary_info', 'alipay', true)).toBe(true);
    expect(canEditPaymentBeneficiary('processing', 'alipay', true)).toBe(false);
    expect(canEditPaymentBeneficiary('created', 'cash', true)).toBe(false);
  });
});

describe('cohérence XAF / ¥ / taux', () => {
  it('normalise un taux décimal historique', () => {
    expect(normalizeRateInt(0.01153)).toBe(11530);
    expect(normalizeRateInt(11530)).toBe(11530);
    expect(normalizeRateInt(null)).toBe(0);
  });
  it('accepte un arrondi de saisie, refuse un zéro de trop', () => {
    expect(rmbForXaf(1_000_000, 11530)).toBe(11530);
    expect(amountsCoherent(1_000_000, 11530, 11530)).toBe(true);
    expect(amountsCoherent(1_000_000, 11600, 11530)).toBe(true);
    expect(amountsCoherent(1_000_000, 115300, 11530)).toBe(false);
  });
});

describe('effet d’une correction sur le portefeuille', () => {
  it('débite le complément quand on augmente le XAF d’un paiement en cours', () => {
    expect(walletDeltaForCorrection('processing', 1_000_000, 1_200_000)).toEqual({ kind: 'debit', amount: 200_000 });
  });
  it('recrédite quand on baisse le XAF d’un paiement effectué', () => {
    expect(walletDeltaForCorrection('completed', 1_000_000, 900_000)).toEqual({ kind: 'credit', amount: 100_000 });
  });
  it('ne touche pas au portefeuille d’un paiement déjà remboursé', () => {
    expect(walletDeltaForCorrection('rejected', 1_000_000, 900_000)).toEqual({ kind: 'refunded' });
    expect(walletDeltaForCorrection('completed', 1_000_000, 1_000_000)).toEqual({ kind: 'none' });
  });
});
