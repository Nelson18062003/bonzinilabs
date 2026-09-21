// ============================================================
// RÉCEPTION DES COLIS — le vocabulaire partagé par les écrans du
// réceptionnaire, les hooks et, plus tard, les vues admin et client.
//
// Un DÉPÔT (parcel_deposits, « RC-000123 », un reçu) = un client (ou pas
// encore), un lieu, qui l'a apporté, qui l'a reçu, et des COLIS (parcels,
// « RC-000123-01 ») avec chacun photo, poids, dimensions, description.
// Tout ce qui est calculé ici l'est aussi côté SQL (cbm) — la vérité est
// en base, ceci ne sert qu'à l'affichage immédiat.
// ============================================================
import type { ShippingDestination } from '@/lib/customerCode';
import { getCurrentLocale } from '@/i18n';
import { normalizeCustomerCode } from '@/lib/customerCode';

export type ReceptionLocation = ShippingDestination; // 'warehouse' (Sea cargo) | 'office' (Air cargo)
export type BroughtBy = 'courier' | 'client' | 'representative' | 'pickup';
export type ParcelKind = 'carton' | 'bag' | 'bale' | 'roll' | 'pallet' | 'other';
export type DepositStatus = 'open' | 'closed' | 'cancelled';
export type ParcelStatus = 'received' | 'stored' | 'loaded' | 'shipped' | 'arrived' | 'delivered';

export const BROUGHT_BY: BroughtBy[] = ['courier', 'client', 'representative', 'pickup'];
export const PARCEL_KINDS: ParcelKind[] = ['carton', 'bag', 'bale', 'roll', 'pallet', 'other'];

/** L'identité d'un client, telle que la réception a le droit de la voir. Jamais un solde. */
export interface ReceptionClient {
  user_id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  city: string | null;
  country: string | null;
}

export interface Parcel {
  id: string;
  seq: number;
  parcel_no: string;
  kind: ParcelKind;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  cbm: number | null;
  description: string | null;
  courier_waybill: string | null;
  photo_path: string | null;
  status: ParcelStatus;
  /** La boîte (dossier Cargo) où le colis a été chargé — null tant qu'il attend à l'entrepôt. */
  shipment_id?: string | null;
  container_number?: string | null;
  created_at: string;
}

/** Un colis vu depuis le Cargo : avec son dépôt et son client. */
export interface ParcelWithDeposit extends Parcel {
  deposit_id: string;
  deposit_no: string;
  location?: ReceptionLocation;
  opened_at?: string;
  client: ReceptionClient | null;
}

/** Ce qui attend à l'entrepôt pour un client. */
export interface StockByClient {
  client: ReceptionClient | null;
  location: ReceptionLocation;
  parcels: number;
  weight_kg: number;
  cbm: number;
  deposits: number;
  last_at: string;
}

export interface StockStats { parcels: number; clients: number; weight_kg: number; cbm: number; pending: number }

/** Le travail d'un réceptionnaire sur une période. */
export interface ReceptionistRow {
  received_by: string;
  name: string | null;
  deposits: number;
  parcels: number;
  weight_kg: number;
  cbm: number;
  pending: number;
  incomplete: number;
}

export interface Deposit {
  id: string;
  deposit_no: string;
  client: ReceptionClient | null;
  location: ReceptionLocation;
  brought_by: BroughtBy;
  representative_name: string | null;
  representative_phone: string | null;
  status: DepositStatus;
  received_by: string;
  received_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  parcel_count: number;
  total_weight_kg: number;
  total_cbm: number;
  notes: string | null;
  parcels: Parcel[];
  /** Côté admin seulement (reception_overview) : l'état du devis du dépôt. */
  quote_status?: 'draft' | 'sent' | 'paid' | 'invoiced' | null;
  quote_no?: string | null;
  quote_total_xaf?: number | null;
  quote_paid_xaf?: number | null;
  invoice_no?: string | null;
}

export interface DayStats {
  deposits: number;
  parcels: number;
  weight_kg: number;
  cbm: number;
  open: number;
}

export const clientFullName = (c: Pick<ReceptionClient, 'first_name' | 'last_name'> | null | undefined): string =>
  c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '';

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Le volume d'un colis en m³ à partir de ses cm — la formule de la base. */
export function cbmOf(l: number | null | undefined, w: number | null | undefined, h: number | null | undefined): number | null {
  if (!l || !w || !h) return null;
  return Math.round((l * w * h) / 1_000_000 * 10_000) / 10_000;
}

/** « 84 kg », « 8,4 kg » — le poids tel qu'on le lit sur une balance. */
export function formatKg(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = Number(v);
  return `${n.toLocaleString(getCurrentLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`;
}

/** « 0,62 m³ » — trois décimales sous 0,1, deux au-delà : on lit la différence entre deux cartons. */
export function formatCbm(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = Number(v);
  return `${n.toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2, maximumFractionDigits: n < 0.1 ? 3 : 2 })} m³`;
}

export function formatDims(p: Pick<Parcel, 'length_cm' | 'width_cm' | 'height_cm'>): string {
  if (p.length_cm == null || p.width_cm == null || p.height_cm == null) return '—';
  const f = (v: number) => Number(v).toLocaleString(getCurrentLocale(), { maximumFractionDigits: 1 });
  return `${f(p.length_cm)} × ${f(p.width_cm)} × ${f(p.height_cm)} cm`;
}

/** Un colis auquel il manque ce qui sert à facturer (poids, volume) ou à prouver (photo). */
export function isParcelIncomplete(p: Parcel): boolean {
  return p.weight_kg == null || p.cbm == null || !p.photo_path;
}

/** Le ton d'une pastille d'état, tel que les deux kits (mobile, desktop) le comprennent. */
export type StageTone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

/**
 * Où en est un colis, en un mot, avec le numéro de sa boîte dès qu'il en a une.
 * C'est la seule table de correspondance statut → libellé : la fiche client,
 * le dépôt, le dossier Cargo et le panneau desktop la partagent. Le statut
 * suit la boîte grâce au trigger `parcels_follow_shipment` (migration) :
 * chargé → en mer → arrivé → livré, sans rien ressaisir.
 */
export function parcelStage(p: Pick<Parcel, 'status' | 'shipment_id' | 'container_number' | 'weight_kg' | 'cbm' | 'photo_path'>): { tone: StageTone; label: string; inBox: boolean } {
  const box = p.container_number ?? 'boîte';
  switch (p.status) {
    case 'loaded': return { tone: 'info', label: `Chargé · ${box}`, inBox: true };
    case 'shipped': return { tone: 'info', label: `En mer · ${box}`, inBox: true };
    case 'arrived': return { tone: 'pending', label: `Arrivé · ${box}`, inBox: true };
    case 'delivered': return { tone: 'success', label: `Livré · ${box}`, inBox: true };
    default:
      if (p.shipment_id) return { tone: 'info', label: `Chargé · ${box}`, inBox: true };
      return isParcelIncomplete(p as Parcel) ? { tone: 'pending', label: 'Incomplet', inBox: false } : { tone: 'success', label: "À l'entrepôt", inBox: false };
  }
}

/** L'état d'un dépôt entier, résumé depuis ses colis : tout chargé, en partie, ou encore à l'entrepôt. */
export function depositStage(parcels: ReadonlyArray<Pick<Parcel, 'status' | 'shipment_id' | 'container_number' | 'weight_kg' | 'cbm' | 'photo_path'>>): { tone: StageTone; label: string } {
  const inBox = parcels.filter((p) => parcelStage(p).inBox);
  if (parcels.length === 0) return { tone: 'neutral', label: 'Vide' };
  if (inBox.length === parcels.length) {
    const first = parcelStage(inBox[0]);
    return { tone: first.tone, label: first.label };
  }
  if (inBox.length > 0) return { tone: 'info', label: `${inBox.length}/${parcels.length} chargés` };
  return { tone: 'success', label: "À l'entrepôt" };
}

/** Le lieu du réceptionnaire, mémorisé sur l'appareil : on ne le redemande pas à chaque dépôt. */
const LOCATION_KEY = 'bonzini-reception-location';
export function readStoredLocation(): ReceptionLocation | null {
  try {
    const v = localStorage.getItem(LOCATION_KEY);
    return v === 'warehouse' || v === 'office' ? v : null;
  } catch {
    return null;
  }
}
export function storeLocation(loc: ReceptionLocation): void {
  try { localStorage.setItem(LOCATION_KEY, loc); } catch { /* stockage indisponible : on redemandera */ }
}

/**
 * Ce qu'un scan peut lire à la réception :
 *   · le QR du client (son app, ou une étiquette Bonzini) → un code BZ ;
 *   · n'importe quel autre code-barres (bordereau SF, YTO, ZTO…) → un numéro
 *     de transporteur, qu'on garde sur le colis pour le retrouver plus tard.
 */
export type ScanResult = { kind: 'customer'; code: string } | { kind: 'waybill'; value: string };
export function parseScan(raw: string): ScanResult | null {
  const text = raw.trim();
  if (!text) return null;
  const code = normalizeCustomerCode(text);
  if (code) return { kind: 'customer', code };
  const clean = text.replace(/\s+/g, '');
  if (clean.length >= 6 && clean.length <= 40 && /^[A-Za-z0-9-]+$/.test(clean)) return { kind: 'waybill', value: clean.toUpperCase() };
  return null;
}
