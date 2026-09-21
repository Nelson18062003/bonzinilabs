// ============================================================
// LE DEVIS D'UN DÉPÔT — le modèle partagé (mobile, desktop, PDF).
//
// Une ligne par colis, au kilo (Air cargo), au mètre cube (Sea cargo) ou à
// un montant fixe ; des lignes libres pour les frais et les remises. Les
// montants sont en XAF, entiers. La base fait foi (RPC cargo_quote_*) ; ici
// ne vivent que les types, l'arithmétique pure et les libellés.
// ============================================================
import { formatXAF } from '@/lib/formatters';
import type { ParcelKind, ReceptionClient, ReceptionLocation } from '@/lib/reception';

export type QuoteBasis = 'per_kg' | 'per_cbm' | 'fixed';
export type QuoteLineKind = 'parcel' | 'fee' | 'discount';
export type QuoteStatus = 'draft' | 'sent' | 'paid' | 'invoiced';

export interface CargoPricing {
  air_per_kg_xaf: number;
  sea_per_cbm_xaf: number;
  currency: string;
  updated_at?: string | null;
}

export interface QuoteLine {
  id: string;
  seq: number;
  kind: QuoteLineKind;
  label: string;
  basis: QuoteBasis;
  quantity: number | null;
  unit_price_xaf: number | null;
  amount_xaf: number;
  parcel_id: string | null;
  parcel_no?: string | null;
  parcel_seq?: number | null;
  kind_of_parcel?: ParcelKind | null;
  description?: string | null;
  weight_kg?: number | null;
  cbm?: number | null;
}

export interface Quote {
  id: string;
  quote_no: string;
  deposit_id: string;
  status: QuoteStatus;
  currency: string;
  total_xaf: number;
  amount_paid_xaf: number;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  deposit_no: string;
  location: ReceptionLocation;
  opened_at: string;
  closed_at: string | null;
  client: ReceptionClient | null;
  lines: QuoteLine[];
}

/** Le montant d'une ligne, tel que la base le calcule : quantité × prix unitaire, arrondi à l'unité ; ou le montant fixe. */
export function lineAmount(basis: QuoteBasis, quantity: number | null | undefined, unitPrice: number | null | undefined, fixed: number | null | undefined): number {
  if (basis === 'fixed') return Math.round(Number(fixed ?? 0));
  return Math.round(Number(quantity ?? 0) * Number(unitPrice ?? 0));
}

/** La base naturelle d'un dépôt : le kilo au bureau (Air cargo), le m³ à l'entrepôt (Sea cargo). */
export function defaultBasis(location: ReceptionLocation): QuoteBasis {
  return location === 'office' ? 'per_kg' : 'per_cbm';
}

export function defaultUnitPrice(location: ReceptionLocation, pricing: CargoPricing | null | undefined): number {
  if (!pricing) return 0;
  return location === 'office' ? Number(pricing.air_per_kg_xaf ?? 0) : Number(pricing.sea_per_cbm_xaf ?? 0);
}

/** Une ligne au kilo ou au m³ sans quantité : le colis n'a pas été pesé ou mesuré — on ne peut pas la chiffrer. */
export function lineNeedsMeasure(l: Pick<QuoteLine, 'kind' | 'basis' | 'quantity'>): boolean {
  return l.kind === 'parcel' && l.basis !== 'fixed' && (l.quantity == null || Number(l.quantity) <= 0);
}

export const BASIS_LABEL: Record<QuoteBasis, string> = { per_kg: 'au kilo', per_cbm: 'au m³', fixed: 'fixe' };
export const BASIS_UNIT: Record<QuoteBasis, string> = { per_kg: 'kg', per_cbm: 'm³', fixed: '' };

export function quoteStatusMeta(status: QuoteStatus | null | undefined): { tone: 'neutral' | 'info' | 'pending' | 'success'; label: string; short: string } {
  switch (status) {
    case 'sent': return { tone: 'info', label: 'Devis envoyé', short: 'Envoyé' };
    case 'paid': return { tone: 'success', label: 'Payé', short: 'Payé' };
    case 'invoiced': return { tone: 'success', label: 'Facturé', short: 'Facturé' };
    case 'draft': return { tone: 'pending', label: 'Devis en cours', short: 'En cours' };
    default: return { tone: 'neutral', label: 'Sans prix', short: 'Sans prix' };
  }
}

/** « 45 000 XAF » */
export function xaf(amount: number | null | undefined): string {
  return `${formatXAF(Math.round(Number(amount ?? 0)))} XAF`;
}

/** Le total d'une liste de lignes (pour l'aperçu avant que la base ait répondu). */
export function quoteTotal(lines: ReadonlyArray<Pick<QuoteLine, 'amount_xaf'>>): number {
  return lines.reduce((s, l) => s + Math.round(Number(l.amount_xaf ?? 0)), 0);
}
