// ============================================================
// Ventes — le vocabulaire commun à l'espace commercial (« /v ») et au
// pilotage dans « Mes équipes » : statuts d'un prospect, intérêts, objectifs
// du mois, mois de Douala. Les chiffres viennent du serveur
// (commercial_dashboard, commercial_clients, sales_overview).
// ============================================================
import type { Tone } from '@/mobile/designKit/tokens';

export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'won' | 'lost';
export type Interest = 'payments' | 'air' | 'sea';
export type ObjectiveMetric = 'new_clients' | 'payments_xaf' | 'air_kg' | 'sea_cbm' | 'prospects_new' | 'prospects_won';

export const PROSPECT_STATUS: Record<ProspectStatus, { label: string; tone: Tone }> = {
  new: { label: 'À contacter', tone: 'info' },
  contacted: { label: 'Contacté', tone: 'pending' },
  interested: { label: 'Intéressé', tone: 'pending' },
  won: { label: 'Devenu client', tone: 'success' },
  lost: { label: 'Perdu', tone: 'neutral' },
};

/** Les statuts qu'un commercial pose lui-même (« devenu client » vient du compte créé). */
export const SETTABLE_STATUSES: Exclude<ProspectStatus, 'won'>[] = ['new', 'contacted', 'interested', 'lost'];
export const OPEN_STATUSES: ProspectStatus[] = ['new', 'contacted', 'interested'];

export const INTERESTS: { value: Interest; label: string }[] = [
  { value: 'payments', label: 'Payer ses fournisseurs' },
  { value: 'air', label: 'Fret avion' },
  { value: 'sea', label: 'Fret bateau' },
];

export const OBJECTIVES: { metric: ObjectiveMetric; label: string; unit: 'count' | 'xaf' | 'kg' | 'cbm' }[] = [
  { metric: 'new_clients', label: 'Nouveaux clients', unit: 'count' },
  { metric: 'payments_xaf', label: 'Paiements de ses clients', unit: 'xaf' },
  { metric: 'air_kg', label: 'Fret avion', unit: 'kg' },
  { metric: 'sea_cbm', label: 'Fret bateau', unit: 'cbm' },
  { metric: 'prospects_new', label: 'Prospects ajoutés', unit: 'count' },
  { metric: 'prospects_won', label: 'Prospects devenus clients', unit: 'count' },
];

export interface SalesMetrics {
  clients: number;
  new_clients: number;
  active_clients: number;
  payments_xaf: number;
  payments_count: number;
  deposits_xaf: number;
  deposits_count: number;
  air_parcels: number;
  air_kg: number;
  sea_parcels: number;
  sea_cbm: number;
  prospects_open: number;
  prospects_new: number;
  prospects_won: number;
  prospects_due: number;
}

export interface Objective {
  metric: ObjectiveMetric;
  target: number;
  actual: number;
}

export interface CommercialCard {
  source: { id: string; label: string; phone: string | null; is_active: boolean };
  staff: { user_id: string; name: string; is_disabled: boolean } | null;
  metrics: SalesMetrics;
  objectives: Objective[];
}

export interface CommercialClient {
  user_id: string;
  name: string;
  company: string | null;
  customer_code: string | null;
  phone: string | null;
  created_at: string;
  source_set_at: string | null;
  payments_xaf: number;
  payments_count: number;
  air_parcels: number;
  air_kg: number;
  sea_parcels: number;
  sea_cbm: number;
}

const nf = (n: number, d = 0) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const fmtXaf = (n: number) => `${nf(Math.round(n))} XAF`;
export const fmtKg = (n: number) => `${nf(n, 1)} kg`;
export const fmtCbm = (n: number) => `${nf(n, 2)} m³`;
export const fmtCount = (n: number) => nf(n);

export function fmtObjective(unit: 'count' | 'xaf' | 'kg' | 'cbm', n: number): string {
  if (unit === 'xaf') return fmtXaf(n);
  if (unit === 'kg') return fmtKg(n);
  if (unit === 'cbm') return fmtCbm(n);
  return fmtCount(n);
}

/** Avancement d'un objectif, borné à [0, 1]. */
export function progress(o: Pick<Objective, 'target' | 'actual'>): number {
  if (!o.target || o.target <= 0) return 0;
  return Math.max(0, Math.min(1, o.actual / o.target));
}

/** Le mois en cours à Douala, au format « AAAA-MM-01 ». */
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === 'month')?.value ?? String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** « octobre 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Un numéro tapé (« 699 12 34 56 ») au format international ; le Cameroun par défaut. */
export function toE164(raw: string, defaultCountry = '237'): string | null {
  let v = raw.replace(/[\s.()-]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+') && /^[62]\d{8}$/.test(v)) v = `+${defaultCountry}${v}`;
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

/** Lien WhatsApp vers un numéro international. */
export function whatsappLink(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, '')}`;
}
