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
import { isParcelWaiting, type Deposit, type Parcel, type ReceptionClient } from '@/lib/reception';
import { parseDecimal } from '@/lib/decimalInput';
import { awbLabel } from '@/lib/airShipment';

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

/** Le poids d'un paquet dans une liste : pesé s'il est fermé, sinon ses colis. */
export const packageKg = (k: Pick<AirPackage, 'gross_weight_kg' | 'net_weight_kg'>): number => Number(k.gross_weight_kg ?? k.net_weight_kg ?? 0);

/** Ce qu'il reste à faire d'un paquet : le remplir, le renvoyer, le mettre sur un vol, attendre le départ — ou rien (parti). */
export type PackageQueue = 'open' | 'refused' | 'ready' | 'assigned' | 'gone';

export function packageQueue(p: Pick<AirPackage, 'status' | 'air_shipment_id' | 'air_status'>): PackageQueue {
  if (p.status === 'open') return 'open';
  if (p.status === 'refused') return 'refused';
  if (p.status === 'sealed' && !p.air_shipment_id) return 'ready';
  if ((p.status === 'sealed' || p.status === 'handed_over') && p.air_shipment_id && (p.air_status == null || p.air_status === 'PLANNED')) return 'assigned';
  return 'gone';
}

/** « LTA 071-12345675 · Vol ET 607 · départ 15/10 » — le vol qui attend le paquet ; null s'il n'est sur aucun. */
export function expeditionLine(p: Pick<AirPackage, 'air_shipment_id' | 'awb_number' | 'flight_no' | 'etd'>): string | null {
  if (!p.air_shipment_id) return null;
  const parts = [p.awb_number ? awbLabel({ awb_number: p.awb_number }) : 'LTA à venir'];
  if (p.flight_no) parts.push(`Vol ${p.flight_no}`);
  if (p.etd) parts.push(`départ ${new Date(`${p.etd.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`);
  return parts.join(' · ');
}

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

/* ── Remplir un paquet depuis l'ordinateur ─────────────────────────────── */

/**
 * Pourquoi un colis du bureau n'entre pas encore dans un paquet. Le miroir des
 * refus « à corriger » de air_package_add_parcel ; les autres (bateau, déjà
 * parti, dépôt supprimé) écartent le colis de la liste.
 */
export type PackBlock = 'no_client' | 'no_weight' | 'too_heavy';
export const PACK_BLOCK_LABEL: Record<PackBlock, string> = { no_client: 'sans client', no_weight: 'pas pesé', too_heavy: 'plus de 32 kg' };

/** Le plafond d'un paquet (air_packages.max_weight_kg, 32 par défaut) : un colis plus lourd ne tiendra dans aucun. */
export const PACKAGE_MAX_KG = 32;

export interface PackableParcel {
  parcel: Parcel;
  deposit: Deposit;
}

export interface PackableBoard {
  /** Prêts : au bureau, attribués, pesés, dans aucun paquet. */
  ready: PackableParcel[];
  /** Au bureau mais pas encore prêts — la raison dit quoi corriger. */
  blocked: (PackableParcel & { reason: PackBlock })[];
}

/**
 * Les colis avion du bureau, triés pour la mise en paquets — à partir des
 * dépôts de la réception (reception_board, en stock). Mêmes règles que le
 * serveur : bureau seulement (l'entrepôt part en bateau), dépôt vivant, colis
 * qui attend encore (ni chargé, ni pointé, ni remis).
 */
export function packableParcels(deposits: readonly Deposit[]): PackableBoard {
  const out: PackableBoard = { ready: [], blocked: [] };
  for (const deposit of deposits) {
    if (deposit.status === 'cancelled' || deposit.location !== 'office') continue;
    for (const parcel of deposit.parcels) {
      if (!isParcelWaiting(parcel) || parcel.checked_in_at || parcel.delivered_at) continue;
      if (parcel.air_package_id) continue;
      const item = { parcel, deposit };
      if (!deposit.client) out.blocked.push({ ...item, reason: 'no_client' });
      else if (!(Number(parcel.weight_kg) > 0)) out.blocked.push({ ...item, reason: 'no_weight' });
      else if (!fitsInPackage({ net_weight_kg: 0, max_weight_kg: PACKAGE_MAX_KG }, parcel.weight_kg)) out.blocked.push({ ...item, reason: 'too_heavy' });
      else out.ready.push(item);
    }
  }
  // Des numéros RC-000123-01 : l'ordre des caractères suffit.
  const byNo = (a: PackableParcel, b: PackableParcel) => (a.parcel.parcel_no < b.parcel.parcel_no ? -1 : a.parcel.parcel_no > b.parcel.parcel_no ? 1 : 0);
  out.ready.sort(byNo);
  out.blocked.sort(byNo);
  return out;
}

export interface PackableGroup {
  key: string;
  client: ReceptionClient | null;
  items: PackableParcel[];
  kg: number;
  /** Un client dont des colis sont déjà dans le paquet ouvert : il passe en tête. */
  inPackage: boolean;
}

/**
 * Les colis prêts, par client : ceux déjà présents dans le paquet en tête (on
 * garde les colis d'un client ensemble), puis par code client.
 */
export function packableGroups(items: readonly PackableParcel[], inPackage: ReadonlySet<string> = new Set()): PackableGroup[] {
  const by = new Map<string, PackableGroup>();
  for (const it of items) {
    const key = it.deposit.client?.user_id ?? '—';
    const g = by.get(key) ?? { key, client: it.deposit.client, items: [], kg: 0, inPackage: inPackage.has(key) };
    g.items.push(it);
    g.kg += Number(it.parcel.weight_kg) || 0;
    by.set(key, g);
  }
  const code = (g: PackableGroup) => g.client?.customer_code ?? '';
  return [...by.values()].sort((a, b) => Number(b.inPackage) - Number(a.inPackage) || code(a).localeCompare(code(b)));
}

export interface PackageClientGroup {
  key: string;
  client: ReceptionClient | null;
  parcels: AirPackageParcel[];
  kg: number;
}

/** Les colis d'un paquet, par client, dans l'ordre où le serveur les donne. */
export function packageClientGroups(parcels: readonly AirPackageParcel[] | null | undefined): PackageClientGroup[] {
  const by = new Map<string, PackageClientGroup>();
  for (const p of parcels ?? []) {
    const key = p.client?.user_id ?? '—';
    const g = by.get(key) ?? { key, client: p.client, parcels: [], kg: 0 };
    g.parcels.push(p);
    g.kg += Number(p.weight_kg) || 0;
    by.set(key, g);
  }
  return [...by.values()];
}

/** Le colis tient-il encore dans le paquet ? Même calcul que le serveur (colis + ce colis ≤ 32 kg), au gramme près. */
export function fitsInPackage(p: Pick<AirPackage, 'net_weight_kg' | 'max_weight_kg'>, kg: number | null | undefined): boolean {
  const max = Number(p.max_weight_kg) || 32;
  return Math.round(((Number(p.net_weight_kg) || 0) + (Number(kg) || 0)) * 1000) <= Math.round(max * 1000);
}

export type SealGrossError = 'required' | 'over' | 'under';

export interface SealCheck {
  grossError: SealGrossError | null;
  dimsError: 'invalid' | null;
  valid: boolean;
  /** Ce qui part au serveur (poids au centième, dimensions au millimètre) — seulement si `valid`. */
  input: { grossWeightKg: number; lengthCm: number | null; widthCm: number | null; heightCm: number | null } | null;
}

/**
 * La pesée d'un paquet qu'on ferme, contrôlée comme air_package_seal : un
 * poids > 0, au plus 32 kg, pas moins que ses colis (0,5 kg de tolérance) ;
 * des dimensions facultatives entre 0 et 400 cm. Les valeurs sont arrondies
 * AVANT le contrôle : ce qui est vérifié est ce qui part.
 */
export function sealCheck(gross: string, dims: readonly [string, string, string], p: Pick<AirPackage, 'net_weight_kg' | 'max_weight_kg'>): SealCheck {
  const g = weightGauge(p);
  const kg = Math.round(parseDecimal(gross) * 100) / 100;
  const cm = dims.map((v) => (v.trim() ? Math.round(parseDecimal(v) * 10) / 10 : null));
  // En centièmes de kilo, comme le NUMERIC du serveur : 7,8 kg pour 8,3 kg de colis passe (0,5 de tolérance tout juste).
  const c = (v: number) => Math.round(v * 100);
  const grossError: SealGrossError | null = !gross.trim() ? null
    : !(kg > 0) ? 'required'
    : c(kg) > c(g.max) ? 'over'
    : c(kg) < c(g.net) - 50 ? 'under'
    : null;
  const dimsError = cm.some((v) => v != null && !(v > 0 && v <= 400)) ? 'invalid' as const : null;
  const valid = gross.trim() !== '' && kg > 0 && !grossError && !dimsError;
  return { grossError, dimsError, valid, input: valid ? { grossWeightKg: kg, lengthCm: cm[0], widthCm: cm[1], heightCm: cm[2] } : null };
}
