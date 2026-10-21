/**
 * Opérations v2 — les mots et les tons des listes et des fiches : un seul
 * vocabulaire (À valider, Crédité, À payer, Payé, Refusé, Annulé) au lieu
 * des libellés techniques (« Prêt », « Info att. », « Cash att. »).
 */
import { differenceInCalendarDays, format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Tone } from '@/mobile/designKit';
import { DEPOSIT_METHOD_LABELS } from '@/types/deposit';

export interface TagSpec { tone: Tone; label: string }

export function depositTag(status: string): TagSpec {
  switch (status) {
    case 'proof_submitted':
    case 'admin_review':
      return { tone: 'pending', label: 'À valider' };
    case 'pending_correction':
      return { tone: 'pending', label: 'À corriger' };
    case 'validated':
      return { tone: 'success', label: 'Crédité' };
    case 'rejected':
      return { tone: 'danger', label: 'Refusé' };
    case 'cancelled':
    case 'cancelled_by_admin':
      return { tone: 'neutral', label: 'Annulé' };
    case 'awaiting_proof':
      return { tone: 'neutral', label: 'Sans preuve' };
    default:
      return { tone: 'neutral', label: 'Créé' };
  }
}

export function paymentTag(status: string): TagSpec {
  switch (status) {
    case 'ready_for_payment':
      return { tone: 'pending', label: 'À payer' };
    case 'processing':
      return { tone: 'neutral', label: 'En cours' };
    case 'completed':
      return { tone: 'success', label: 'Payé' };
    case 'rejected':
      return { tone: 'danger', label: 'Refusé' };
    case 'cancelled_by_admin':
      return { tone: 'neutral', label: 'Annulé' };
    case 'waiting_beneficiary_info':
      return { tone: 'pending', label: 'Sans fournisseur' };
    case 'cash_pending':
      return { tone: 'neutral', label: 'Au bureau' };
    case 'cash_scanned':
      return { tone: 'pending', label: 'QR lu' };
    default:
      return { tone: 'neutral', label: 'Créé' };
  }
}

/** « Orange Money », « MTN MoMo », « UBA » : le moyen d'un dépôt, court. */
export function depositMethodName(method: string, bankName?: string | null, agencyName?: string | null): string {
  switch (method) {
    case 'om_transfer':
    case 'om_withdrawal':
      return 'Orange Money';
    case 'mtn_transfer':
    case 'mtn_withdrawal':
      return 'MTN MoMo';
    case 'wave':
      return 'Wave';
    case 'agency_cash':
      return agencyName || 'Agence';
    case 'bank_transfer':
    case 'bank_cash':
      return bankName ? bankName.replace(/ Cameroun$/i, '') : 'Banque';
    default:
      return (DEPOSIT_METHOD_LABELS as Record<string, string>)[method] ?? method;
  }
}

/** Le groupe d'une ligne datée : Aujourd'hui · Hier · Cette semaine · Ce mois · le mois. */
export function dayGroup(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = differenceInCalendarDays(now, d);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (d >= startOfWeek(now, { weekStartsOn: 1 })) return 'Cette semaine';
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'Ce mois';
  const label = format(d, d.getFullYear() === now.getFullYear() ? 'MMMM' : 'MMMM yyyy', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Regroupe une liste déjà triée par groupe de jours, dans l'ordre d'arrivée. */
export function groupByDay<T>(rows: T[], dateOf: (r: T) => string): { label: string; rows: T[] }[] {
  const out: { label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const label = dayGroup(dateOf(r));
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}

/** « il y a 2 h », « hier », « 14 oct. » — le temps court des lignes. */
export function shortWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  const days = differenceInCalendarDays(now, d);
  if (days === 0) return `il y a ${h} h`;
  if (days === 1) return 'hier';
  return format(d, d.getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy', { locale: fr });
}

/** « 1 213 450 » : les milliers avec une espace insécable (lisible en gros). */
export function n0(v: number | null | undefined): string {
  const x = Math.round(Number(v) || 0);
  const s = Math.abs(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return x < 0 ? `−${s}` : s;
}

/** « ¥ 7 493 » (décimales seulement si elles existent). */
export function yuan(v: number | null | undefined): string {
  const x = Number(v) || 0;
  const int = Math.trunc(x);
  const dec = Math.round(Math.abs(x - int) * 100);
  return `¥\u00A0${n0(int)}${dec ? `,${String(dec).padStart(2, '0')}` : ''}`;
}

export const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null, fallback = 'Client'): string =>
  (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '') || fallback;

export const firstName = (p?: { first_name?: string | null } | null, fallback = 'le client'): string =>
  (p?.first_name ?? '').trim() || fallback;
