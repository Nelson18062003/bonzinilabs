// ============================================================
// LES PAQUETS AVION DE 32 KG — le modèle partagé (Guangzhou /r, expédition
// /m/cargo/avion, Douala /w). La base fait foi (RPC air_package_*) ; ici les
// types, les libellés, la lecture d'un code PQ-… et la jauge de poids.
//
// Cycle : ouvert (on y met des colis) → fermé (pesé, étiquette) → affecté à
// une expédition → scanné au départ → [refusé à l'aéroport → ré-affecté] →
// reçu à Douala → ouvert (ses colis se pointent un par un).
// ============================================================
import type { Tone } from '@/mobile/designKit/tokens';
import type { ReceptionClient } from '@/lib/reception';

export type AirPackageStatus = 'open' | 'sealed' | 'handed_over' | 'refused' | 'received' | 'opened';

export interface AirPackageParcel {
  id: string;
  seq: number;
  parcel_no: string;
  kind: string;
  weight_kg: number | null;
  cbm: number | null;
  description: string | null;
  status: string;
  photo_path: string | null;
  checked_in_at: string | null;
  warehouse_location: string | null;
  condition: 'ok' | 'damaged' | 'missing' | null;
  delivered_at: string | null;
  deposit_no: string;
  deposit_id: string;
  client: ReceptionClient | null;
}

export interface AirPackage {
  id: string;
  package_no: string;
  status: AirPackageStatus;
  air_shipment_id: string | null;
  awb_number: string | null;
  air_status: string | null;
  etd: string | null;
  flight_no: string | null;
  max_weight_kg: number;
  gross_weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  notes: string | null;
  net_weight_kg: number;
  parcel_count: number;
  client_count: number;
  checked_count: number;
  missing_count: number;
  sealed_at: string | null;
  handed_over_at: string | null;
  refused_at: string | null;
  refusal_reason: string | null;
  refused_air_shipment_id: string | null;
  received_at: string | null;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
  /** Présent sur la fiche complète (air_package_get, ajout / retrait d'un colis). */
  parcels?: AirPackageParcel[] | null;
}

export const PACKAGE_STATUS_META: Record<AirPackageStatus, { label: string; tone: Tone }> = {
  open: { label: 'En cours', tone: 'pending' },
  sealed: { label: 'Fermé', tone: 'info' },
  handed_over: { label: 'Remis au départ', tone: 'info' },
  refused: { label: 'Refusé à l’aéroport', tone: 'danger' },
  received: { label: 'Reçu à Douala', tone: 'success' },
  opened: { label: 'Ouvert à Douala', tone: 'success' },
};

export function packageStatusMeta(s: string | null | undefined): { label: string; tone: Tone } {
  return PACKAGE_STATUS_META[(s as AirPackageStatus) in PACKAGE_STATUS_META ? (s as AirPackageStatus) : 'open'];
}

/** « PQ-000123 », « pq123 », une étiquette entière → « PQ-000123 » ; sinon null. Même règle que air_package_code (SQL). */
export function parsePackageCode(text: string | null | undefined): string | null {
  const m = /PQ[\s-]?(\d{1,9})/i.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return `PQ-${n < 1_000_000 ? String(n).padStart(6, '0') : String(n)}`;
}

/** Le texte encodé dans le QR et le code-barres de l'étiquette d'un paquet. */
export function packageQrPayload(packageNo: string): string {
  return packageNo;
}

export interface WeightGauge {
  /** Poids des colis (net), en kg. */
  net: number;
  max: number;
  /** Ce qu'on peut encore y mettre. */
  left: number;
  /** Remplissage, borné à [0, 1]. */
  ratio: number;
  tone: 'ok' | 'near' | 'full';
}

/** La jauge d'un paquet : vert jusqu'à 85 %, ambre au-delà, plein à partir de 99 %. */
export function weightGauge(p: Pick<AirPackage, 'net_weight_kg' | 'max_weight_kg'>): WeightGauge {
  const net = Number(p.net_weight_kg) || 0;
  const max = Number(p.max_weight_kg) || 32;
  const ratio = Math.max(0, Math.min(1, net / max));
  return { net, max, left: Math.max(0, Math.round((max - net) * 10) / 10), ratio, tone: ratio >= 0.99 ? 'full' : ratio >= 0.85 ? 'near' : 'ok' };
}

/** « 27,9 kg » — espace insécable : le nombre et l'unité ne se séparent jamais en fin de ligne. */
export const fmtKg1 = (n: number | null | undefined) => `${(Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}\u00a0kg`;

/** Un paquet peut-il encore partir (être affecté à une expédition) ? */
export function isAssignable(p: Pick<AirPackage, 'status' | 'air_shipment_id'>): boolean {
  return (p.status === 'sealed' || p.status === 'refused') && !p.air_shipment_id;
}

/** Les codes clients d'un paquet, dans l'ordre (étiquette, listes). */
export function packageClientCodes(parcels: readonly Pick<AirPackageParcel, 'client'>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parcels) {
    const code = p.client?.customer_code;
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}
