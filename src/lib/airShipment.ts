// ============================================================
// L'EXPÉDITION AÉRIENNE — le modèle partagé (mobile, desktop, manifeste).
//
// Une LTA (lettre de transport aérien), une compagnie, un vol, deux dates ;
// des colis chargés dedans, qui la suivent : chargé → en vol → arrivé →
// remis. Les jalons se posent à la main (pas d'API compagnie) : « Parti »,
// « Arrivé ». La base fait foi (RPC cargo_air_*) ; ici les types, les
// libellés et l'arithmétique des totaux.
// ============================================================
import type { Tone } from '@/mobile/designKit';
import type { ParcelWithDeposit } from '@/lib/reception';
import type { QuoteStatus } from '@/lib/cargoQuote';

export type AirStatus = 'PLANNED' | 'DEPARTED' | 'ARRIVED' | 'DELIVERED';

/** Un colis vu depuis l'avion : son dépôt, son client, et où en est le devis (payé ou non). */
export interface AirParcel extends ParcelWithDeposit {
  awb_number?: string | null;
  quote_status?: QuoteStatus | null;
  quote_no?: string | null;
  quote_total_xaf?: number | null;
  quote_paid_xaf?: number | null;
  invoice_no?: string | null;
}

export interface AirShipment {
  id: string;
  awb_number: string;
  airline: string | null;
  flight_no: string | null;
  origin: string;
  destination: string;
  status: AirStatus;
  etd: string | null;
  eta: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  freight_usd: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  parcel_count: number;
  total_weight_kg: number;
  total_cbm: number;
  client_count: number;
  unpaid_count: number;
  /** Présent quand on a demandé la fiche complète (cargo_air_get). */
  parcels?: AirParcel[] | null;
}

export const AIR_STATUS_META: Record<AirStatus, { label: string; tone: Tone; short: string }> = {
  PLANNED: { label: 'En préparation', tone: 'pending', short: 'Préparation' },
  DEPARTED: { label: 'En vol', tone: 'info', short: 'En vol' },
  ARRIVED: { label: 'Arrivé à Douala', tone: 'success', short: 'Arrivé' },
  DELIVERED: { label: 'Tout remis', tone: 'neutral', short: 'Remis' },
};

export function airStatusMeta(status: string | null | undefined): { label: string; tone: Tone; short: string } {
  return AIR_STATUS_META[(status as AirStatus) in AIR_STATUS_META ? (status as AirStatus) : 'PLANNED'];
}

/** « LTA 071-12345675 » — l'identité de l'expédition, partout. */
export function awbLabel(a: Pick<AirShipment, 'awb_number'>): string {
  return `LTA ${formatAwb(a.awb_number)}`;
}

/** 07112345675 → 071-12345675 (le tiret après le code compagnie, comme sur le document). */
export function formatAwb(raw: string): string {
  const s = (raw ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d{11}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

/** La phrase du vol : « ET 607 · Ethiopian » ou « Vol à préciser ». */
export function flightSentence(a: Pick<AirShipment, 'flight_no' | 'airline'>): string {
  const parts = [a.flight_no, a.airline].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Vol à préciser';
}

/** Une date « 2026-09-25 » → « 25 sept. 2026 ». */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Le jalon suivant, celui que le bouton propose : parti, puis arrivé. */
export function nextAirStep(status: AirStatus): { to: 'DEPARTED' | 'ARRIVED'; label: string } | null {
  if (status === 'PLANNED') return { to: 'DEPARTED', label: "L'avion est parti" };
  if (status === 'DEPARTED') return { to: 'ARRIVED', label: "L'avion est arrivé à Douala" };
  return null;
}

/** Les colis groupés par client, dans l'ordre du manifeste. */
export function groupByClient(parcels: AirParcel[]): { key: string; client: AirParcel['client']; parcels: AirParcel[]; kg: number; cbm: number; unpaid: boolean }[] {
  const by = new Map<string, { key: string; client: AirParcel['client']; parcels: AirParcel[] }>();
  for (const p of parcels) {
    const key = p.client?.user_id ?? '∅';
    const g = by.get(key) ?? { key, client: p.client, parcels: [] };
    g.parcels.push(p);
    by.set(key, g);
  }
  return [...by.values()].map((g) => ({
    ...g,
    kg: g.parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0),
    cbm: g.parcels.reduce((s, p) => s + Number(p.cbm ?? 0), 0),
    unpaid: g.parcels.some((p) => parcelUnpaid(p)),
  }));
}

/** Un colis dont le devis n'est pas soldé (ou n'existe pas) : Douala ne le remettra pas. */
export function parcelUnpaid(p: Pick<AirParcel, 'quote_total_xaf' | 'quote_paid_xaf'>): boolean {
  const total = Number(p.quote_total_xaf ?? 0); const paid = Number(p.quote_paid_xaf ?? 0);
  return total <= 0 || paid < total;
}
