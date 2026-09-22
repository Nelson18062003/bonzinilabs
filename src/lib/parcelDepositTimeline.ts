// ============================================================
// L'HISTORIQUE D'UN DÉPÔT DE COLIS — reconstitué à partir de ce que la base sait
// déjà (dépôt, colis, devis, encaissements, remises), sans table de plus.
// Chaque événement porte une date, une phrase, et de quoi le reconnaître.
// Trié du plus ancien au plus récent : on lit l'histoire du colis.
// ============================================================
import type { Deposit, Parcel } from '@/lib/reception';
import type { Quote, QuotePayment } from '@/lib/cargoQuote';
import { PLACE_SHORT, xaf } from '@/lib/cargoQuote';

export type TimelineKind = 'opened' | 'closed' | 'quote_sent' | 'payment' | 'payment_cancelled' | 'invoice' | 'loaded' | 'checked_in' | 'missing' | 'delivered';

export interface TimelineEvent {
  kind: TimelineKind;
  at: string;
  /** La phrase, courte : « Acompte de 50 000 XAF encaissé à Guangzhou ». */
  text: string;
  /** Un complément discret : le reçu, le bon, la boîte. */
  detail?: string | null;
  /** Ce qui est en cours ou terminé : pour la couleur. */
  tone: 'neutral' | 'info' | 'pending' | 'success' | 'danger';
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 && !w.endsWith('s') ? 's' : ''}`;

function byGroup<T>(items: readonly T[], key: (t: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it); if (!k) continue; const g = m.get(k) ?? []; g.push(it); m.set(k, g); }
  return m;
}

/** Les événements d'un dépôt, du plus ancien au plus récent. */
export function depositTimeline(deposit: Pick<Deposit, 'opened_at' | 'closed_at' | 'received_by_name' | 'parcels'> & { parcels: readonly Parcel[] }, quote?: Pick<Quote, 'sent_at' | 'invoiced_at' | 'invoice_no' | 'quote_no' | 'total_xaf' | 'payments'> | null): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  const parcels = deposit.parcels;
  ev.push({ kind: 'opened', at: deposit.opened_at, text: `Dépôt ouvert${deposit.received_by_name ? ` par ${deposit.received_by_name}` : ''}`, tone: 'neutral' });
  if (deposit.closed_at) ev.push({ kind: 'closed', at: deposit.closed_at, text: `${plural(parcels.length, 'colis')} enregistré${parcels.length > 1 ? 's' : ''}, dépôt terminé`, tone: 'neutral' });

  if (quote?.sent_at) ev.push({ kind: 'quote_sent', at: quote.sent_at, text: `Devis ${quote.quote_no} envoyé · ${xaf(quote.total_xaf)}`, tone: 'info' });
  for (const p of quote?.payments ?? []) {
    const pay = p as QuotePayment;
    ev.push({ kind: 'payment', at: pay.paid_at, text: `${xaf(pay.amount_xaf)} encaissé à ${PLACE_SHORT[pay.place] ?? pay.place}`, detail: `Reçu ${pay.receipt_no}${pay.received_by_name ? ` · ${pay.received_by_name}` : ''}`, tone: pay.cancelled_at ? 'danger' : 'success' });
    if (pay.cancelled_at) ev.push({ kind: 'payment_cancelled', at: pay.cancelled_at, text: `Encaissement ${pay.receipt_no} annulé`, detail: pay.cancel_reason, tone: 'danger' });
  }
  if (quote?.invoiced_at) ev.push({ kind: 'invoice', at: quote.invoiced_at, text: `Facture acquittée ${quote.invoice_no ?? ''}`.trim(), tone: 'success' });

  // Le transport : les colis chargés dans une boîte ou une LTA (la base ne date pas le chargement ; on le dit sans date propre).
  for (const [ref, ps] of byGroup(parcels, (p) => p.container_number ?? p.awb_number ?? null)) {
    const air = !!ps[0].awb_number;
    ev.push({ kind: 'loaded', at: deposit.closed_at ?? deposit.opened_at, text: `${plural(ps.length, 'colis')} chargé${ps.length > 1 ? 's' : ''} ${air ? 'sur la LTA' : 'dans le conteneur'} ${ref}`, tone: 'info' });
  }

  // Douala : pointés (regroupés par jour), manquants, remis (par bon de retrait).
  const seen = parcels.filter((p) => p.checked_in_at);
  for (const [day, ps] of byGroup(seen, (p) => p.checked_in_at!.slice(0, 10))) {
    const at = ps.map((p) => p.checked_in_at!).sort()[0];
    const damaged = ps.filter((p) => p.condition === 'damaged').length;
    ev.push({ kind: 'checked_in', at, text: `${plural(ps.length, 'colis')} pointé${ps.length > 1 ? 's' : ''} à Douala${damaged ? ` · ${plural(damaged, 'abîmé')}` : ''}`, detail: [...new Set(ps.map((p) => p.warehouse_location).filter(Boolean))].join(', ') || null, tone: damaged ? 'pending' : 'info' });
    void day;
  }
  const missing = parcels.filter((p) => p.condition === 'missing' && !p.delivered_at);
  if (missing.length) ev.push({ kind: 'missing', at: missing[0].checked_in_at ?? deposit.closed_at ?? deposit.opened_at, text: `${plural(missing.length, 'colis')} déclaré${missing.length > 1 ? 's' : ''} manquant${missing.length > 1 ? 's' : ''} à Douala`, detail: missing.map((p) => p.parcel_no).join(', '), tone: 'danger' });
  for (const [no, ps] of byGroup(parcels.filter((p) => p.delivered_at), (p) => p.release_no ?? 'sans-bon')) {
    const at = ps.map((p) => p.delivered_at!).sort()[0];
    ev.push({ kind: 'delivered', at, text: `${plural(ps.length, 'colis')} remis au client`, detail: no === 'sans-bon' ? null : `Bon de retrait ${no}`, tone: 'success' });
  }

  return ev.sort((a, b) => a.at.localeCompare(b.at));
}
