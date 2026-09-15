import { describe, it, expect } from 'vitest';
import { paymentMainAction } from '@/lib/paymentActions';

describe('paymentMainAction — le bouton principal ne propose que ce que la RPC accepte', () => {
  it('prêt à payer → commencer ; en cours → valider', () => {
    expect(paymentMainAction('ready_for_payment', true)).toBe('start_processing');
    expect(paymentMainAction('processing', true)).toBe('complete');
  });
  it('cash scanné : jamais « commencer » (process_payment refuse hors ready_for_payment)', () => {
    expect(paymentMainAction('cash_scanned', true)).toBeNull();
    expect(paymentMainAction('cash_pending', true)).toBeNull();
  });
  it('statuts clos ou sans droit : rien', () => {
    for (const s of ['completed', 'rejected', 'cancelled_by_admin', 'created', 'waiting_beneficiary_info']) expect(paymentMainAction(s, true)).toBeNull();
    expect(paymentMainAction('ready_for_payment', false)).toBeNull();
  });
});
