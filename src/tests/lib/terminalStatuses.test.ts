import { describe, it, expect } from 'vitest';
import { TERMINAL_DEPOSIT_STATUSES, TERMINAL_PAYMENT_STATUSES, isTerminalDeposit, isTerminalPayment } from '@/lib/terminalStatuses';
import { getDepositSlaLevel } from '@/lib/depositTimeline';

describe('statuts terminaux — une seule liste', () => {
  it('les annulations par un admin (déjà recréditées) sont terminales', () => {
    expect(TERMINAL_DEPOSIT_STATUSES).toContain('cancelled_by_admin');
    expect(TERMINAL_PAYMENT_STATUSES).toContain('cancelled_by_admin');
    expect(isTerminalDeposit('cancelled_by_admin')).toBe(true);
    expect(isTerminalPayment('cancelled_by_admin')).toBe(true);
    expect(isTerminalPayment('processing')).toBe(false);
  });

  it('pas de phrase d’urgence sur un dépôt annulé ou entre les mains du client', () => {
    const old = new Date(Date.now() - 72 * 3_600_000).toISOString();
    expect(getDepositSlaLevel(old, 'cancelled_by_admin')).toBeNull();
    expect(getDepositSlaLevel(old, 'pending_correction')).toBeNull();
    expect(getDepositSlaLevel(old, 'proof_submitted')).toBe('overdue');
  });
});
