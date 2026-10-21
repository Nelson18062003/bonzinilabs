/**
 * Les chiffres des ventes pour les écrans v2 : un indicateur, sa valeur sur
 * la période (sales_series, sinon le tableau du mois), son unité, et
 * l'avancement de l'objectif du mois.
 */
import type { SalesTotals } from '@/hooks/useSales';
import type { CommercialCard, ObjectiveMetric, SalesMetrics } from '@/lib/sales';
import { num, type SalesMetricKey } from '@/lib/salesSeries';
import { shortXaf } from '@/mobile/screens/clients/parts';

/** Les 8 indicateurs qu'on fait défiler en touchant le gros chiffre. */
export const BOARD_METRICS: { key: SalesMetricKey; label: string; objective?: ObjectiveMetric }[] = [
  { key: 'payments_xaf', label: 'Paiements apportés', objective: 'payments_xaf' },
  { key: 'deposits_xaf', label: 'Dépôts de leurs clients' },
  { key: 'new_clients', label: 'Nouveaux clients', objective: 'new_clients' },
  { key: 'clients_total', label: 'Clients apportés' },
  { key: 'prospects_new', label: 'Prospects ajoutés', objective: 'prospects_new' },
  { key: 'air_kg', label: 'Fret avion', objective: 'air_kg' },
  { key: 'flights', label: 'Vols' },
  { key: 'sea_cbm', label: 'Fret bateau', objective: 'sea_cbm' },
];

const UNIT: Partial<Record<SalesMetricKey, string>> = { payments_xaf: 'XAF', deposits_xaf: 'XAF', air_kg: 'kg', sea_cbm: 'm³' };

/** La valeur d'un indicateur depuis le tableau du mois (repli quand sales_series ne répond pas). */
export function fromMetrics(m: SalesMetrics | undefined, key: SalesMetricKey): number | null {
  if (!m) return null;
  switch (key) {
    case 'clients_total': return num(m.clients);
    case 'flights': return null;
    case 'prospects_lost': return null;
    default: return key in m ? num((m as unknown as Record<string, unknown>)[key]) : null;
  }
}

export function fromTotals(t: SalesTotals | undefined, key: SalesMetricKey): number | null {
  return t ? num(t[key]) : null;
}

/** « 48,6 M » + « XAF » ; « 212 » + « kg » ; « 7,4 » + « m³ ». */
export function figure(key: SalesMetricKey, v: number | null): { value: string; unit?: string } {
  if (v == null) return { value: '—' };
  if (key === 'payments_xaf' || key === 'deposits_xaf') return { value: shortXaf(v), unit: 'XAF' };
  const d = key === 'sea_cbm' ? 1 : 0;
  return { value: v.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/\u202F/g, '\u00A0'), unit: UNIT[key] };
}

/** L'avancement (en %) de l'objectif d'un indicateur, sur une ou plusieurs fiches ; null sans objectif. */
export function objectivePct(cards: CommercialCard[] | undefined, metric: ObjectiveMetric | undefined): number | null {
  if (!cards || !metric) return null;
  let target = 0;
  let actual = 0;
  for (const c of cards) {
    const o = c.objectives.find((x) => x.metric === metric);
    if (o && o.target > 0) { target += num(o.target); actual += num(o.actual); }
  }
  return target > 0 ? Math.round((actual / target) * 100) : null;
}
