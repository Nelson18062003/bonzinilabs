// Constantes & helpers partagés des écrans de la centrale d'achat.
// Évite la duplication (champ texte, formatage par devise, libellés, options).
import type {
  ByCurrency, ProcCurrency, ProcPoStatus, ProcProductionStatus,
  ProcSupplierKind, ProcVerificationStatus, ProcMissionStatus,
} from '@/integrations/supabase/procurement';

/** Champ texte standard des formulaires (hauteur/rayon/fond cohérents). */
export const PROC_INPUT =
  'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';

/** Plafond anti-faute de frappe (aligné sur les RPC). Pas un cap métier. */
export const MAX_PROC_AMOUNT = 10_000_000_000;

/** Montant saisi valide : fini (pas NaN/Infinity), strictement positif, sous le plafond. */
export function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < MAX_PROC_AMOUNT;
}

/** Montants par devise → "1 000 CNY · 500 XAF" (vide → '—'). */
export function formatByCurrency(by: ByCurrency, separator = ' · '): string {
  const e = (Object.entries(by) as [ProcCurrency, number][]).filter(([, v]) => Math.abs(v) > 0.000001);
  return e.length === 0 ? '—' : e.map(([c, v]) => `${v.toLocaleString('fr-FR')} ${c}`).join(separator);
}

export const PO_STATUS_LABEL: Record<ProcPoStatus, string> = {
  open: 'Ouverte', closed: 'Soldée', cancelled: 'Annulée',
};
export const MISSION_STATUS_LABEL: Record<ProcMissionStatus, string> = {
  active: 'Active', closed: 'Clôturée', archived: 'Archivée',
};
export const PROD_STATUS_LABEL: Record<ProcProductionStatus, string> = {
  po_confirmed: 'Commande confirmée', materials_purchased: 'Matières achetées', in_production: 'En production',
  production_done: 'Production terminée', ready_for_qc: 'Prête pour QC', shipped: 'Expédiée',
};
export const PROD_STATUS_OPTIONS = (Object.entries(PROD_STATUS_LABEL) as [ProcProductionStatus, string][])
  .map(([value, label]) => ({ value, label }));

export const SUPPLIER_KIND_LABEL: Record<ProcSupplierKind, string> = {
  factory: 'Usine', trading_company: 'Négociant', unknown: 'À qualifier',
};
export const SUPPLIER_KIND_OPTIONS = (Object.entries(SUPPLIER_KIND_LABEL) as [ProcSupplierKind, string][])
  .map(([value, label]) => ({ value, label }));

export const VERIF_LABEL: Record<ProcVerificationStatus, string> = {
  unverified: 'Non vérifié', docs_seen: 'Docs vus', visited: 'Visité', audited: 'Audité',
};
export const VERIF_OPTIONS = (Object.entries(VERIF_LABEL) as [ProcVerificationStatus, string][])
  .map(([value, label]) => ({ value, label }));
