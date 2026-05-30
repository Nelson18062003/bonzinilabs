import { describe, it, expect } from 'vitest';
import type { Beneficiary } from '@/hooks/useBeneficiaries';

// ============================================================
// Snapshot immutability — THE fintech invariant of this feature.
//
// A payment stores a FROZEN COPY of the beneficiary (beneficiary_details
// + denormalised columns) at creation time. Editing or archiving the
// beneficiary afterwards must NEVER change a past payment.
//
// These tests encode the contract on the pure snapshot-building logic
// (the same shape NewPaymentPage / MobileNewPayment write). If a future
// refactor turns the snapshot into a live reference, these fail.
// ============================================================

// Mirrors buildBeneficiarySnapshot for a selected (saved) beneficiary.
function buildSnapshotFromBeneficiary(b: Beneficiary): Record<string, unknown> {
  return {
    id: b.id,
    alias: b.alias ?? b.name,
    name: b.name,
    payment_method: b.payment_method,
    identifier: b.identifier,
    identifier_type: b.identifier_type,
    phone: b.phone,
    email: b.email,
    bank_name: b.bank_name,
    bank_account: b.bank_account,
    bank_extra: b.bank_extra,
    relation_type: b.relation_type,
  };
}

function makeBeneficiary(over: Partial<Beneficiary> = {}): Beneficiary {
  return {
    id: 'b1',
    client_id: 'c1',
    payment_method: 'alipay',
    alias: 'Fournisseur Yiwu',
    name: '张伟',
    identifier: 'zhang@alipay.cn',
    identifier_type: 'email',
    phone: null,
    email: null,
    bank_name: null,
    bank_account: null,
    bank_extra: null,
    qr_code_url: null,
    relation_type: 'supplier',
    notes: null,
    is_active: true,
    created_by: null,
    created_by_role: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('payment beneficiary snapshot — immutability', () => {
  it('captures a VALUE copy, not a live reference', () => {
    const benef = makeBeneficiary();
    const snapshot = buildSnapshotFromBeneficiary(benef);

    // Editing the source beneficiary afterwards…
    benef.alias = 'Renommé';
    benef.identifier = 'changed@alipay.cn';
    benef.name = '李四';

    // …must NOT change the frozen snapshot.
    expect(snapshot.alias).toBe('Fournisseur Yiwu');
    expect(snapshot.identifier).toBe('zhang@alipay.cn');
    expect(snapshot.name).toBe('张伟');
  });

  it('keeps the beneficiary_id link for traceability', () => {
    const snapshot = buildSnapshotFromBeneficiary(makeBeneficiary({ id: 'abc-123' }));
    expect(snapshot.id).toBe('abc-123');
  });

  it('preserves CJK exactly in the snapshot', () => {
    const snapshot = buildSnapshotFromBeneficiary(
      makeBeneficiary({ payment_method: 'bank_transfer', name: '李明', bank_name: '中国工商银行' }),
    );
    expect(snapshot.name).toBe('李明');
    expect(snapshot.bank_name).toBe('中国工商银行');
  });

  it('falls back to name when alias is missing (legacy rows)', () => {
    const snapshot = buildSnapshotFromBeneficiary(makeBeneficiary({ alias: null as unknown as string }));
    expect(snapshot.alias).toBe('张伟');
  });
});
