import { describe, it, expect } from 'vitest';
import { cashHandoverStep, paymentMainAction } from '@/lib/paymentActions';

describe('paymentMainAction — le bouton principal ne propose que ce que la RPC accepte', () => {
  it('prêt à payer → commencer ; en cours → valider', () => {
    expect(paymentMainAction('ready_for_payment', true)).toBe('start_processing');
    expect(paymentMainAction('processing', true)).toBe('complete');
  });
  it('cash scanné : jamais « commencer » (process_payment refuse hors ready_for_payment)', () => {
    expect(paymentMainAction('cash_scanned', true)).toBeNull();
    expect(paymentMainAction('cash_pending', true)).toBeNull();
  });
  it('cash : jamais « Commencer » ni « Valider », quel que soit le statut (scan + signature obligatoires)', () => {
    expect(paymentMainAction('ready_for_payment', true, 'cash')).toBeNull();
    expect(paymentMainAction('processing', true, 'cash')).toBeNull();
    expect(paymentMainAction('ready_for_payment', true, 'alipay')).toBe('start_processing');
  });
  it('statuts clos ou sans droit : rien', () => {
    for (const s of ['completed', 'rejected', 'cancelled_by_admin', 'created', 'waiting_beneficiary_info']) expect(paymentMainAction(s, true)).toBeNull();
    expect(paymentMainAction('ready_for_payment', false)).toBeNull();
  });
});

describe('cashHandoverStep — la remise cash suit scan_cash_payment puis confirm_cash_payment', () => {
  it('à scanner : cash_pending, et les anciens ready_for_payment / processing', () => {
    for (const s of ['cash_pending', 'ready_for_payment', 'processing']) expect(cashHandoverStep(s)).toBe('scan');
  });
  it('à signer : seulement après le scan', () => {
    expect(cashHandoverStep('cash_scanned')).toBe('sign');
  });
  it('rien à faire sur un paiement clos', () => {
    for (const s of ['completed', 'rejected', 'cancelled_by_admin', 'created', 'waiting_beneficiary_info']) expect(cashHandoverStep(s)).toBeNull();
  });
});
