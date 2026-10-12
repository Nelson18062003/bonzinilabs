// ============================================================
// LE RELEVÉ DES COLIS D'UN CLIENT — la réponse écrite à « quels sont tous mes
// colis qui sont chez vous ? » (une cliente, 12/10/2026). Tout ce que Bonzini
// détient encore pour lui, rangé par où c'est :
//   · à Guangzhou (reçu, pas encore parti) ;
//   · en route (chargé dans un conteneur ou sur un vol), avec l'arrivée ;
//   · à Douala, à retirer ;
// et ce qui reste à payer, dépôt par dépôt. Les colis déjà remis n'y sont
// plus (on les compte, sans les lister). Fonctions pures, testées : le PDF
// (ClientStatementPDF) ne fait que dessiner ce qui est calculé ici.
// ============================================================
import type { Deposit, DepositTransport, Parcel, ReceptionClient } from '@/lib/reception';

export type StatementStage = 'guangzhou' | 'transit' | 'douala' | 'delivered';

/** Où est un colis, pour le client. Douala parle en premier : remis, puis pointé ou arrivé. */
export function statementStage(p: Pick<Parcel, 'status' | 'shipment_id' | 'air_shipment_id' | 'checked_in_at' | 'delivered_at' | 'release_id'>): StatementStage {
  if (p.delivered_at || p.release_id || p.status === 'delivered') return 'delivered';
  if (p.checked_in_at || p.status === 'arrived') return 'douala';
  if (p.shipment_id || p.air_shipment_id || p.status === 'loaded' || p.status === 'shipped') return 'transit';
  return 'guangzhou';
}

export interface StatementParcel { parcel: Parcel; deposit: Deposit }

/** Un moyen de transport et les colis du client qui y voyagent. */
export interface StatementTransport {
  key: string;
  mode: 'sea' | 'air';
  ref: string;
  info: DepositTransport | null;
  parcels: StatementParcel[];
}

/** Ce qui reste à payer sur un dépôt dont des colis sont encore chez nous. */
export interface StatementDue {
  deposit_no: string;
  quote_no: string | null;
  invoice_no: string | null;
  total: number;
  paid: number;
  balance: number;
  /** Pas encore de prix : le montant viendra. */
  unpriced: boolean;
}

export interface ClientStatement {
  client: ReceptionClient | null;
  guangzhou: StatementParcel[];
  transit: StatementTransport[];
  douala: StatementParcel[];
  /** Les colis déjà remis : comptés, pas listés. */
  deliveredCount: number;
  held: { parcels: number; kg: number; cbm: number };
  dues: StatementDue[];
  dueTotal: number;
}

const bySeq = (a: StatementParcel, b: StatementParcel) =>
  (a.deposit.opened_at < b.deposit.opened_at ? -1 : a.deposit.opened_at > b.deposit.opened_at ? 1 : 0) || a.parcel.seq - b.parcel.seq;

/** Le relevé d'un client, à partir de tous ses dépôts (reception_client_deposits). Les dépôts supprimés n'y sont pas. */
export function buildClientStatement(deposits: readonly Deposit[]): ClientStatement {
  const live = deposits.filter((d) => d.status !== 'cancelled');
  const all = live.flatMap((deposit) => deposit.parcels.map((parcel) => ({ parcel, deposit })));
  const guangzhou: StatementParcel[] = [];
  const douala: StatementParcel[] = [];
  const transports = new Map<string, StatementTransport>();
  let deliveredCount = 0;
  for (const item of all) {
    const stage = statementStage(item.parcel);
    if (stage === 'delivered') { deliveredCount += 1; continue; }
    if (stage === 'guangzhou') { guangzhou.push(item); continue; }
    if (stage === 'douala') { douala.push(item); continue; }
    const air = !!item.parcel.air_shipment_id;
    const ref = (air ? item.parcel.awb_number : item.parcel.container_number) ?? '';
    const key = `${air ? 'air' : 'sea'}:${ref || item.parcel.shipment_id || item.parcel.air_shipment_id || '?'}`;
    const list = air ? item.deposit.flights : item.deposit.containers;
    const info = (list ?? []).find((t) => t.ref === ref) ?? null;
    const group = transports.get(key) ?? { key, mode: air ? 'air' : 'sea', ref, info, parcels: [] };
    if (!group.info && info) group.info = info;
    group.parcels.push(item);
    transports.set(key, group);
  }
  const heldList = [...guangzhou, ...douala, ...[...transports.values()].flatMap((t) => t.parcels)];
  const held = {
    parcels: heldList.length,
    kg: heldList.reduce((s, x) => s + Number(x.parcel.weight_kg ?? 0), 0),
    cbm: heldList.reduce((s, x) => s + Number(x.parcel.cbm ?? 0), 0),
  };
  // Ce qui reste à payer : les dépôts dont au moins un colis est encore chez nous.
  const heldDeposits = new Set(heldList.map((x) => x.deposit.id));
  const dues: StatementDue[] = live
    .filter((d) => heldDeposits.has(d.id))
    .map((d) => {
      const total = Math.round(Number(d.quote_total_xaf ?? 0));
      const paid = Math.round(Number(d.quote_paid_xaf ?? 0));
      return { deposit_no: d.deposit_no, quote_no: d.quote_no ?? null, invoice_no: d.invoice_no ?? null, total, paid, balance: Math.max(0, total - paid), unpriced: total <= 0 };
    })
    .filter((x) => x.unpriced || x.balance > 0)
    .sort((a, b) => a.deposit_no.localeCompare(b.deposit_no));
  // Les transports : le plus proche de l'arrivée d'abord ; sans date, à la fin.
  const transit = [...transports.values()]
    .map((t) => ({ ...t, parcels: t.parcels.sort(bySeq) }))
    .sort((a, b) => (a.info?.eta ?? '9999').localeCompare(b.info?.eta ?? '9999') || a.ref.localeCompare(b.ref));
  return {
    client: live.find((d) => d.client)?.client ?? null,
    guangzhou: guangzhou.sort(bySeq),
    transit,
    douala: douala.sort(bySeq),
    deliveredCount,
    held,
    dues,
    dueTotal: dues.reduce((s, x) => s + x.balance, 0),
  };
}
