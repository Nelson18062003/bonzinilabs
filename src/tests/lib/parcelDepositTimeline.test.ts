import { describe, expect, it } from 'vitest';
import { depositTimeline } from '@/lib/parcelDepositTimeline';
import type { Parcel } from '@/lib/reception';

const parcel = (over: Partial<Parcel>): Parcel => ({
  id: 'p1', seq: 1, parcel_no: 'RC-000005-01', kind: 'carton', weight_kg: 1.05, length_cm: null, width_cm: null, height_cm: null, cbm: null,
  description: null, courier_waybill: null, photo_path: null, status: 'received', created_at: '2026-09-21T05:18:00Z', ...over,
});

describe("l'historique d'un dépôt de colis", () => {
  it("raconte, dans l'ordre, l'ouverture, la fin, le devis, les encaissements, le transport, Douala et la remise", () => {
    const ev = depositTimeline({
      opened_at: '2026-09-21T05:17:48Z', closed_at: '2026-09-21T05:22:57Z', received_by_name: 'Augustin Tcheumassom Tchiakoua',
      parcels: [
        parcel({ id: 'p1', awb_number: 'ET 071-12340011', checked_in_at: '2026-09-25T09:40:00Z', warehouse_location: 'B3', delivered_at: '2026-09-26T11:05:00Z', release_no: 'BR-000007', release_id: 'rel1' }),
        parcel({ id: 'p2', seq: 2, parcel_no: 'RC-000005-02', awb_number: 'ET 071-12340011', checked_in_at: '2026-09-25T09:42:00Z', condition: 'damaged', delivered_at: '2026-09-26T11:05:00Z', release_no: 'BR-000007', release_id: 'rel1' }),
        parcel({ id: 'p3', seq: 3, parcel_no: 'RC-000005-03', awb_number: 'ET 071-12340011', checked_in_at: '2026-09-25T09:42:00Z', condition: 'missing' }),
      ],
    }, {
      quote_no: 'DV-000005', total_xaf: 45000, sent_at: '2026-09-21T08:00:00Z', invoiced_at: '2026-09-26T11:00:00Z', invoice_no: 'FA-000005',
      payments: [
        { id: 'pay1', receipt_no: 'RE-000010', amount_xaf: 20000, method: 'mobile_money', place: 'guangzhou', paid_at: '2026-09-22T10:00:00Z', reference: null, proof_path: null, note: null, received_by: null, received_by_name: 'Tina', created_at: '2026-09-22T10:00:00Z', cancelled_at: null, cancel_reason: null },
        { id: 'pay2', receipt_no: 'RE-000011', amount_xaf: 25000, method: 'cash', place: 'douala', paid_at: '2026-09-26T10:50:00Z', reference: null, proof_path: null, note: null, received_by: null, received_by_name: null, created_at: '2026-09-26T10:50:00Z', cancelled_at: null, cancel_reason: null },
      ],
    });
    expect(ev.map((e) => e.kind)).toEqual(['opened', 'closed', 'loaded', 'quote_sent', 'payment', 'checked_in', 'missing', 'payment', 'invoice', 'delivered']);
    expect(ev[0].text).toBe('Dépôt ouvert par Augustin Tcheumassom Tchiakoua');
    expect(ev[1].text).toBe('3 colis enregistrés, dépôt terminé');
    expect(ev[2].text).toBe('3 colis chargés sur la LTA ET 071-12340011');
    expect(ev[4].text).toBe('20\u202f000 XAF encaissé à Guangzhou');
    expect(ev[4].detail).toBe('Reçu RE-000010 · Tina');
    expect(ev[5].text).toBe('3 colis pointés à Douala · 1 abîmé');
    expect(ev[5].detail).toBe('B3');
    expect(ev[6].tone).toBe('danger');
    expect(ev[9].text).toBe('2 colis remis au client');
    expect(ev[9].detail).toBe('Bon de retrait BR-000007');
  });

  it("ne dit que ce qui s'est passé : un dépôt ouvert sans devis n'a qu'un événement", () => {
    const ev = depositTimeline({ opened_at: '2026-09-21T05:16:07Z', closed_at: null, received_by_name: null, parcels: [] }, null);
    expect(ev).toHaveLength(1);
    expect(ev[0].text).toBe('Dépôt ouvert');
  });

  it('marque un encaissement annulé en rouge, avec son motif', () => {
    const ev = depositTimeline({ opened_at: '2026-09-21T05:16:07Z', closed_at: null, received_by_name: null, parcels: [] }, {
      quote_no: 'DV-1', total_xaf: 1000, sent_at: null, invoiced_at: null, invoice_no: null,
      payments: [{ id: 'x', receipt_no: 'RE-1', amount_xaf: 1000, method: 'cash', place: 'other', paid_at: '2026-09-22T10:00:00Z', reference: null, proof_path: null, note: null, received_by: null, created_at: '2026-09-22T10:00:00Z', cancelled_at: '2026-09-22T12:00:00Z', cancel_reason: 'Erreur de montant' }],
    });
    expect(ev.map((e) => e.kind)).toEqual(['opened', 'payment', 'payment_cancelled']);
    expect(ev[1].tone).toBe('danger');
    expect(ev[2].detail).toBe('Erreur de montant');
  });
});
