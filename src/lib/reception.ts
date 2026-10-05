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
import { isProvisionalAwb } from '@/lib/airShipment';

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
  /** Le compte cargo (PRC, Simon…) qui regroupe ce client, s'il y en a un. */
  account_id?: string | null;
  account_name?: string | null;
  account_code?: string | null;
}

/** Fournisseur (l'usine, le vendeur) ou agent d'achat qui envoie pour le client. */
export type SupplierKind = 'supplier' | 'buying_agent';
export const SUPPLIER_KINDS: SupplierKind[] = ['supplier', 'buying_agent'];

/** Ce que Tina relève sur son bon d'entrée : qui a envoyé les cartons. Un par dépôt. */
export interface SupplierInfo {
  kind: SupplierKind;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  wechat?: string | null;
  address?: string | null;
}

/** Une photo d'un colis. La première (position 0) est la couverture, recopiée dans `Parcel.photo_path`. */
export interface ParcelPhoto {
  id: string;
  path: string;
  position: number;
  created_at: string;
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
  /** La couverture : la première des `photos`. */
  photo_path: string | null;
  /** Toutes les photos, couverture en tête (migration 20261002100000). */
  photos?: ParcelPhoto[];
  status: ParcelStatus;
  /** La boîte (dossier Cargo) où le colis a été chargé — null tant qu'il attend à l'entrepôt. */
  shipment_id?: string | null;
  container_number?: string | null;
  /** L'expédition aérienne (LTA) où le colis a été chargé — l'autre chemin vers Douala. */
  air_shipment_id?: string | null;
  awb_number?: string | null;
  /** Le paquet avion de 32 kg où le colis est emballé (reception_deposit_json, 05/10). */
  air_package_id?: string | null;
  package_no?: string | null;
  /** À Douala (phase 4) : pointé, sa place, son état, remis. */
  checked_in_at?: string | null;
  warehouse_location?: string | null;
  condition?: 'ok' | 'damaged' | 'missing' | null;
  condition_note?: string | null;
  delivered_at?: string | null;
  release_id?: string | null;
  release_no?: string | null;
  created_at: string;
  updated_at?: string;
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
  supplier_kind?: SupplierKind | null;
  supplier_name?: string | null;
  supplier_contact?: string | null;
  supplier_phone?: string | null;
  supplier_email?: string | null;
  supplier_wechat?: string | null;
  supplier_address?: string | null;
  status: DepositStatus;
  received_by: string;
  received_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  updated_at?: string;
  /** Un dépôt supprimé : quand, par qui, pourquoi (il se rétablit). */
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  cancelled_by_name?: string | null;
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
export function parcelStage(p: Pick<Parcel, 'status' | 'shipment_id' | 'container_number' | 'weight_kg' | 'cbm' | 'photo_path'> & { air_shipment_id?: string | null; awb_number?: string | null; checked_in_at?: string | null; warehouse_location?: string | null; condition?: string | null; delivered_at?: string | null; release_no?: string | null }): { tone: StageTone; label: string; inBox: boolean } {
  const air = !!p.air_shipment_id;
  const box = air ? (isProvisionalAwb(p.awb_number) ? 'LTA à venir' : `LTA ${p.awb_number ?? ''}`.trim()) : p.container_number ?? 'boîte';
  // Douala parle en premier : remis, manquant, pointé.
  if (p.delivered_at || p.status === 'delivered') return { tone: 'success', label: `Remis · ${p.release_no ?? box}`, inBox: true };
  if (p.condition === 'missing') return { tone: 'danger', label: 'Manquant à Douala', inBox: true };
  if (p.checked_in_at) return { tone: 'pending', label: `À Douala${p.warehouse_location ? ` · ${p.warehouse_location}` : ''}${p.condition === 'damaged' ? ' · abîmé' : ''}`, inBox: true };
  switch (p.status) {
    case 'loaded': return { tone: 'info', label: `Chargé · ${box}`, inBox: true };
    case 'shipped': return { tone: 'info', label: `${air ? 'En vol' : 'En mer'} · ${box}`, inBox: true };
    case 'arrived': return { tone: 'pending', label: `Arrivé · ${box}`, inBox: true };
    default:
      if (p.shipment_id || air) return { tone: 'info', label: `Chargé · ${box}`, inBox: true };
      return isParcelIncomplete(p as Parcel) ? { tone: 'pending', label: 'Incomplet', inBox: false } : { tone: 'success', label: "À l'entrepôt", inBox: false };
  }
}

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

/** Le fournisseur d'un dépôt, ou null s'il n'a pas été relevé. */
export function depositSupplier(d: Pick<Deposit, 'supplier_kind' | 'supplier_name' | 'supplier_contact' | 'supplier_phone' | 'supplier_email' | 'supplier_wechat' | 'supplier_address'>): SupplierInfo | null {
  if (!d.supplier_name) return null;
  return { kind: d.supplier_kind ?? 'supplier', name: d.supplier_name, contact: d.supplier_contact, phone: d.supplier_phone, email: d.supplier_email, wechat: d.supplier_wechat, address: d.supplier_address };
}

/** « 广州鞋业 · Li Wei · 138… » : le fournisseur en une ligne, pour une liste. */
export function supplierLine(s: SupplierInfo | null | undefined): string {
  if (!s) return '';
  return [s.name, s.contact, s.phone].filter((v) => v && v.trim()).join(' · ');
}

// ── Les photos, les verrous, la recherche — partagés par la console ──────

/** Vingt photos au plus par colis — la même limite qu'en base (reception_attach_photos). */
export const MAX_PARCEL_PHOTOS = 20;
/** Les photos de colis : JPEG, PNG ou WebP (le seau et validateUploadFile n'acceptent rien d'autre). */
const PARCEL_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Ce qu'on garde d'une sélection de fichiers : les images acceptées, dans la
 * limite de la place qui reste. Renvoie aussi ce qui a été écarté, pour le dire.
 */
export function pickParcelPhotos(files: Iterable<File>, room: number): { kept: File[]; rejected: number; overflow: number } {
  const all = Array.from(files);
  const valid = all.filter((f) => PARCEL_PHOTO_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024);
  const kept = valid.slice(0, Math.max(room, 0));
  return { kept, rejected: all.length - valid.length, overflow: valid.length - kept.length };
}

/** Les colis d'un dépôt dans l'ordre de leurs numéros. */
export const sortedParcels = <P extends Pick<Parcel, 'seq'>>(parcels: ReadonlyArray<P>): P[] => [...parcels].sort((a, b) => a.seq - b.seq);

/** Les photos enregistrées d'un colis, couverture en tête ; la seule couverture pour une donnée d'avant les photos multiples (sans id). */
export function parcelSavedPhotos(p: Pick<Parcel, 'photo_path' | 'photos'>): { id?: string; path: string }[] {
  if (p.photos && p.photos.length > 0) return [...p.photos].sort((a, b) => a.position - b.position);
  return p.photo_path ? [{ path: p.photo_path }] : [];
}

/** Les chemins des photos d'un colis, couverture en tête (la couverture seule pour une donnée d'avant les photos multiples). */
export function parcelPhotoPaths(p: Pick<Parcel, 'photo_path' | 'photos'>): string[] {
  return parcelSavedPhotos(p).map((ph) => ph.path);
}

/**
 * Pourquoi ce colis ne se modifie plus d'ici — ou null s'il se modifie.
 * Miroir de `reception_parcel_locked` (SQL) : la base refuse de toute façon,
 * l'écran le dit avant le clic.
 */
export function parcelLockReason(p: Pick<Parcel, 'delivered_at' | 'release_id' | 'checked_in_at' | 'shipment_id' | 'air_shipment_id' | 'air_package_id' | 'package_no'>): string | null {
  if (p.delivered_at || p.release_id) return 'Remis au client';
  if (p.checked_in_at) return 'Déjà arrivé à Douala';
  if (p.shipment_id) return 'Chargé dans un conteneur : retirez-le d\'abord de la boîte';
  if (p.air_shipment_id) return 'Chargé dans une LTA : retirez-le d\'abord de l\'expédition';
  if (p.air_package_id) return `Dans le paquet ${p.package_no ?? 'avion'} : retirez-le d'abord du paquet`;
  return null;
}

/** Le colis attend-il encore ici (reçu, pas chargé) ? */
export function isParcelWaiting(p: Pick<Parcel, 'status' | 'shipment_id' | 'air_shipment_id'>): boolean {
  return !p.shipment_id && !p.air_shipment_id && (p.status === 'received' || p.status === 'stored');
}

/** « 5 » colis, ou « 3 / 5 » quand une partie du dépôt est déjà partie. */
export function parcelsHere(d: Pick<Deposit, 'parcels'>): string {
  const here = d.parcels.filter(isParcelWaiting).length;
  return here === d.parcels.length ? String(d.parcels.length) : `${here} / ${d.parcels.length}`;
}

/** La date d'un dépôt : sa fermeture (le reçu), sinon son ouverture. */
export const depositDate = (d: Pick<Deposit, 'closed_at' | 'opened_at'>): string => d.closed_at ?? d.opened_at;

/** Le rang de chaque colis dans son dépôt (1…n, dans l'ordre des numéros) — « 3 / 10 » sur l'étiquette. */
export function labelPosition(parcels: ReadonlyArray<Pick<Parcel, 'id' | 'seq'>>, id: string): number {
  return sortedParcels(parcels).findIndex((p) => p.id === id) + 1;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * La recherche de la console : un numéro de dépôt ou de colis (RC-…), un code
 * client (BZ-…), un nom, un téléphone, un bordereau transporteur, ce qu'il y
 * a dedans, le fournisseur, le réceptionnaire. Tous les mots doivent se
 * retrouver quelque part dans le dépôt.
 */
export function depositMatches(d: Deposit, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold([
    d.deposit_no, d.client ? clientFullName(d.client) : '', d.client?.customer_code, d.client?.phone, d.client?.company_name, d.client?.account_name,
    d.supplier_name, d.supplier_contact, d.representative_name, d.received_by_name, d.notes,
    ...d.parcels.flatMap((p) => [p.parcel_no, p.description, p.courier_waybill]),
  ].filter(Boolean).join(' '));
  const digits = query.replace(/\D/g, '');
  return words.every((w) => hay.includes(w)) || (digits.length >= 6 && hay.replace(/\D/g, '').includes(digits));
}

/** Les files de la console : ce qu'on cherche à voir en premier. */
export type ReceptionQueue = 'all' | 'waiting' | 'loaded' | 'pending' | 'incomplete' | 'nophoto' | 'open';
export const RECEPTION_QUEUES: ReceptionQueue[] = ['all', 'waiting', 'loaded', 'pending', 'incomplete', 'nophoto', 'open'];

/** Un colis est-il dans cette file ? (Un dépôt y est s'il y a au moins un de ses colis — ou, pour pending/open, par son état.) */
export function parcelInQueue(p: Parcel, d: Pick<Deposit, 'client' | 'status'>, q: ReceptionQueue): boolean {
  switch (q) {
    case 'all': return true;
    case 'waiting': return isParcelWaiting(p);
    case 'loaded': return !isParcelWaiting(p);
    case 'pending': return !d.client;
    case 'incomplete': return isParcelIncomplete(p);
    case 'nophoto': return parcelPhotoPaths(p).length === 0;
    case 'open': return d.status === 'open';
  }
}

export function depositInQueue(d: Deposit, q: ReceptionQueue): boolean {
  if (q === 'all') return true;
  if (q === 'pending') return !d.client;
  if (q === 'open') return d.status === 'open';
  return d.parcels.some((p) => parcelInQueue(p, d, q));
}
