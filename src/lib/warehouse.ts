// ============================================================
// L'ENTREPÔT DE DOUALA — le modèle partagé de la sous-app « /w ».
//
// Ce que l'agent voit : les arrivées à pointer (avion ou boîte), un colis
// avec son pointage (présent, abîmé, manquant) et sa place, le client qui
// se présente avec ses colis prêts — et ce qui bloque la remise : un devis
// non soldé. La base fait foi (RPC warehouse_*) ; ici les types, les
// libellés et les petits calculs.
// ============================================================
import type { Tone } from '@/mobile/designKit';
import type { ParcelWithDeposit, ReceptionClient } from '@/lib/reception';
import type { QuoteStatus } from '@/lib/cargoQuote';
import { xaf } from '@/lib/cargoQuote';

export type ParcelCondition = 'ok' | 'damaged' | 'missing';

/** Un colis vu de Douala : le colis, son transport, son pointage, son devis. */
export interface WarehouseParcel extends ParcelWithDeposit {
  container_number?: string | null;
  air_shipment_id?: string | null;
  awb_number?: string | null;
  checked_in_at: string | null;
  warehouse_location: string | null;
  condition: ParcelCondition | null;
  condition_note: string | null;
  delivered_at: string | null;
  release_id: string | null;
  release_no?: string | null;
  quote_id?: string | null;
  quote_status?: QuoteStatus | null;
  quote_no?: string | null;
  quote_total_xaf?: number | null;
  quote_paid_xaf?: number | null;
  invoice_no?: string | null;
}

export interface WarehouseArrival {
  kind: 'air' | 'sea';
  id: string;
  ref: string;
  label: string;
  sub: string | null;
  arrived_at: string | null;
  expected: number;
  checked: number;
  missing: number;
  delivered: number;
}

export interface WaitingClient {
  client: ReceptionClient | null;
  parcels: number;
  weight_kg: number;
  since: string;
  unpaid: boolean;
  balance_xaf: number;
}

export interface ReleaseSummary {
  id: string;
  release_no: string;
  released_at: string;
  picked_by_name: string;
  parcel_count: number;
  client?: ReceptionClient | null;
}

export interface WarehouseDay {
  day: string;
  stats: { to_checkin: number; waiting: number; missing: number; delivered_today: number };
  arrivals: WarehouseArrival[];
  waiting_by_client: WaitingClient[];
  releases_today: ReleaseSummary[];
}

export interface ClientQuoteSummary {
  id: string;
  quote_no: string;
  deposit_id: string;
  deposit_no: string;
  status: QuoteStatus;
  total_xaf: number;
  amount_paid_xaf: number;
  balance_xaf: number;
  invoice_no: string | null;
}

export interface ClientAtWarehouse {
  client: ReceptionClient;
  ready: WarehouseParcel[];
  not_ready: WarehouseParcel[];
  quotes: ClientQuoteSummary[];
  releases: ReleaseSummary[];
}

export interface Release extends ReleaseSummary {
  picked_by_phone: string | null;
  signature_path: string | null;
  note: string | null;
  released_by_name: string | null;
  client: ReceptionClient | null;
  parcels: WarehouseParcel[];
}

/** Le transport d'un colis, en un mot : « LTA 071-… » ou « MSKU 482913-7 ». */
export function transportLabel(p: Pick<WarehouseParcel, 'awb_number' | 'container_number' | 'air_shipment_id'>): string {
  if (p.air_shipment_id) return `LTA ${p.awb_number ?? ''}`.trim();
  return p.container_number ?? 'boîte';
}

/** Où en est le colis, vu de Douala. */
export function warehouseStage(p: Pick<WarehouseParcel, 'status' | 'checked_in_at' | 'condition' | 'delivered_at' | 'release_no'>): { tone: Tone; label: string } {
  if (p.delivered_at) return { tone: 'neutral', label: `Remis${p.release_no ? ` · ${p.release_no}` : ''}` };
  if (p.condition === 'missing') return { tone: 'danger', label: 'Manquant' };
  if (p.checked_in_at) return p.condition === 'damaged' ? { tone: 'pending', label: 'Pointé · abîmé' } : { tone: 'success', label: 'Pointé' };
  if (p.status === 'arrived') return { tone: 'pending', label: 'À pointer' };
  if (p.status === 'shipped') return { tone: 'info', label: 'En route' };
  return { tone: 'neutral', label: 'En Chine' };
}

/** Le devis du colis, en un mot pour l'agent : payé, reste …, sans prix. */
export function quoteWord(p: Pick<WarehouseParcel, 'quote_total_xaf' | 'quote_paid_xaf' | 'invoice_no'>): { text: string; ok: boolean } {
  const total = Number(p.quote_total_xaf ?? 0); const paid = Number(p.quote_paid_xaf ?? 0);
  if (total <= 0) return { text: 'Sans prix', ok: false };
  if (paid >= total) return { text: p.invoice_no ? 'Facturé' : 'Payé', ok: true };
  return { text: `Reste ${xaf(total - paid)}`, ok: false };
}

/** Ce qui bloque la remise d'une sélection : les devis non soldés, avec leur reste. */
export function releaseBlockers(parcels: WarehouseParcel[], quotes: ClientQuoteSummary[]): ClientQuoteSummary[] {
  const depositIds = new Set(parcels.map((p) => p.deposit_id));
  const blockers = quotes.filter((q) => depositIds.has(q.deposit_id) && (q.total_xaf <= 0 || q.balance_xaf > 0));
  // Un dépôt sans devis du tout bloque aussi.
  const withQuote = new Set(quotes.map((q) => q.deposit_id));
  for (const id of depositIds) {
    if (!withQuote.has(id)) {
      const p = parcels.find((x) => x.deposit_id === id)!;
      blockers.push({ id: `none-${id}`, quote_no: '', deposit_id: id, deposit_no: p.deposit_no, status: 'draft', total_xaf: 0, amount_paid_xaf: 0, balance_xaf: 0, invoice_no: null });
    }
  }
  return blockers;
}

/** Le contenu d'un QR ou d'une saisie : un code client, un numéro de colis, ou rien de connu. */
export function parseWarehouseScan(text: string): { kind: 'customer'; code: string } | { kind: 'parcel'; no: string } | null {
  const t = (text ?? '').trim();
  const parcel = /(\d{6})[^0-9]{0,3}(\d{2})\b/.exec(t.toUpperCase());
  if (/RC[^0-9]{0,3}\d{6}/i.test(t) && parcel) return { kind: 'parcel', no: `RC-${parcel[1]}-${parcel[2]}` };
  const cust = /BZ[^0-9]{0,3}([1-9][0-9]{5})/i.exec(t);
  if (cust) return { kind: 'customer', code: `BZ-${cust[1]}` };
  const digits = t.replace(/[^0-9]/g, '');
  if (/^[1-9][0-9]{5}$/.test(digits)) return { kind: 'customer', code: `BZ-${digits}` };
  if (parcel) return { kind: 'parcel', no: `RC-${parcel[1]}-${parcel[2]}` };
  return null;
}

/** Les colis d'une arrivée, client par client (l'ordre d'arrivée est conservé). */
export function groupParcelsByClient(parcels: WarehouseParcel[]): { client: ReceptionClient | null; parcels: WarehouseParcel[] }[] {
  const by = new Map<string, { client: ReceptionClient | null; parcels: WarehouseParcel[] }>();
  for (const p of parcels) {
    const k = p.client?.user_id ?? '∅';
    const g = by.get(k) ?? { client: p.client, parcels: [] };
    g.parcels.push(p);
    by.set(k, g);
  }
  return [...by.values()];
}

/** Un colis encore à pointer : arrivé, pas vu, pas remis, pas déclaré manquant. */
export function isPending(p: Pick<WarehouseParcel, 'checked_in_at' | 'delivered_at' | 'condition'>): boolean {
  return !p.checked_in_at && !p.delivered_at && p.condition !== 'missing';
}

/** Le bilan d'un pointage : ce qui est vu (bon état, abîmé), remis, manquant, jamais vu. */
export function checkinSummary(parcels: ReadonlyArray<Pick<WarehouseParcel, 'checked_in_at' | 'delivered_at' | 'condition'>>) {
  const s = { total: parcels.length, ok: 0, damaged: 0, delivered: 0, missing: 0, pending: 0 };
  for (const p of parcels) {
    if (p.delivered_at) s.delivered += 1;
    else if (p.condition === 'missing') s.missing += 1;
    else if (p.checked_in_at) { if (p.condition === 'damaged') s.damaged += 1; else s.ok += 1; }
    else s.pending += 1;
  }
  return { ...s, seen: s.ok + s.damaged + s.delivered, done: s.pending === 0 };
}

/** « 3 colis », « 1 colis » — le mot ne change pas, mais on centralise. */
export function nParcels(n: number): string {
  return `${n} colis`;
}

/** La phrase du bas de l'écran « ses colis » : ce qui bloque, ou ce qui part. */
export function releaseWord(chosen: number, blockers: ClientQuoteSummary[]): { tone: 'good' | 'warn' | 'bad'; text: string } {
  if (chosen === 0) return { tone: 'warn', text: 'Choisissez au moins un colis' };
  const unpriced = blockers.filter((q) => q.total_xaf <= 0);
  if (unpriced.length > 0) return { tone: 'bad', text: `Sans prix : ${unpriced.map((q) => q.deposit_no).join(', ')}. Appelez les opérations.` };
  const due = blockers.reduce((s, q) => s + q.balance_xaf, 0);
  if (due > 0) return { tone: 'warn', text: `Reste à payer ${xaf(due)} avant la remise` };
  return { tone: 'good', text: `${nParcels(chosen)} prêts à partir` };
}
