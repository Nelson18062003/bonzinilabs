/**
 * L'historique d'un paiement (maquette 02-operations/09) : les événements
 * réels de `payment_timeline_events`, datés, puis l'étape en cours et
 * celle qui reste. Les mots sont ceux de la v2.
 */
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { StepItem } from '@/mobile/screens/operations/parts';
import { sinceSentence } from '@/lib/plainTime';
import { paymentTag } from '@/mobile/screens/operations/opsLabels';

interface Ev { id: string; event_type: string; description?: string | null; created_at: string }

const LABEL: Record<string, string> = {
  created: 'Créé',
  waiting_info: 'Sans fournisseur',
  info_provided: 'Fournisseur ajouté',
  beneficiary_updated: 'Fournisseur modifié',
  admin_beneficiary_update: 'Fournisseur modifié',
  ready_for_payment: 'À payer',
  processing: 'En cours',
  completed: 'Payé',
  rejected: 'Refusé',
  cancelled_by_admin: 'Annulé',
  cash_pending: 'Au bureau',
  cash_scanned: 'QR lu',
  cash_paid: 'Remis',
  admin_corrected: 'Montant corrigé',
  proof_uploaded: 'Preuve ajoutée',
  instructions_uploaded: 'Instruction ajoutée',
  proof_deleted: 'Preuve supprimée',
  claim: 'Pris en charge',
};

export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = format(d, 'HH:mm');
  if (isToday(d)) return `aujourd'hui ${t}`;
  if (isYesterday(d)) return `hier ${t}`;
  return format(d, "d MMM 'à' HH:mm", { locale: fr });
}

export function paymentSteps(p: { status: string; method: string; updated_at?: string | null; created_at: string }, events: Ev[]): StepItem[] {
  const out: StepItem[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const title = LABEL[e.event_type] ?? (e.description || e.event_type);
    const bad = e.event_type === 'rejected' || e.event_type === 'cancelled_by_admin';
    const desc = e.description && e.description !== title ? `${e.description} · ` : '';
    out.push({ key: e.id, title, sub: `${desc}${stamp(e.created_at)}`, state: bad ? 'bad' : 'done' });
    seen.add(e.event_type);
  }
  if (out.length === 0) out.push({ key: 'created', title: 'Créé', sub: stamp(p.created_at), state: 'done' });

  const terminal = ['completed', 'rejected', 'cancelled_by_admin'].includes(p.status);
  if (!terminal) {
    const label = paymentTag(p.status).label;
    const last = out[out.length - 1];
    const since = p.updated_at ? sinceSentence(p.updated_at) : '';
    const sub = since ? since.charAt(0).toUpperCase() + since.slice(1) : undefined;
    if (last && last.title === label) { last.state = 'current'; last.sub = sub ?? last.sub; }
    else out.push({ key: 'now', title: label, sub, state: 'current' });
    out.push({ key: 'end', title: p.method === 'cash' ? 'Remis' : 'Payé', state: 'todo' });
  } else if (p.status === 'completed' && !seen.has('completed') && !seen.has('cash_paid')) {
    out.push({ key: 'end', title: p.method === 'cash' ? 'Remis' : 'Payé', state: 'done' });
  }
  return out;
}
