/**
 * « À faire » — la boîte d'actions douane du client (le « task management » de
 * Flexport). Rien n'est stocké : chaque tâche se déduit de l'état de ses
 * dossiers, donc elle disparaît d'elle-même quand elle est faite.
 *
 *   now   — quelqu'un attend le client (le commissionnaire, un délai qui court) ;
 *   soon  — une étape utile est prête (faire signer, faire relire, lire un dépôt) ;
 *   later — à savoir (un avis de veille sur ses produits).
 */
import type { AuditSummary, ClassificationSummary } from './files';
import { noticesForCodes, phaseOf, type Notice } from './notices';

export type TaskKind =
  | 'answer_broker' | 'sign_code' | 'retry_read' | 'review_dau' | 'claim_deadline'
  | 'supplier_docs' | 'supplier_waiting' | 'read_notice';
export type Urgency = 'now' | 'soon' | 'later';

export interface InviteSummary {
  id: string;
  supplier_name: string;
  status: 'open' | 'revoked' | 'expired';
  due_on: string | null;
  last_upload_at: string | null;
  created_at: string;
  documents: { id: string; created_at: string }[];
}

export interface CustomsTask {
  id: string;
  kind: TaskKind;
  urgency: Urgency;
  /** Le texte, en français ; `params` sert aux autres langues. */
  fr: string;
  params: Record<string, string | number>;
  path: string;
  /** AAAA-MM-JJ, quand une date compte. */
  due?: string | null;
}

const DAY = 86_400_000;
const days = (iso: string, today: Date) => Math.round((Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / DAY);
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ');

export function customsTasks(input: {
  classifications?: ClassificationSummary[];
  audits?: AuditSummary[];
  invites?: InviteSummary[];
  notices?: Notice[];
  today?: Date;
}): CustomsTask[] {
  const today = input.today ?? new Date();
  const out: CustomsTask[] = [];

  for (const c of input.classifications ?? []) {
    if (c.status === 'needs_info') {
      out.push({ id: `c-${c.id}`, kind: 'answer_broker', urgency: 'now', path: `/douane/classer/${c.id}`,
        fr: `Le commissionnaire attend votre réponse sur « ${c.product_name} ».`, params: { product: c.product_name } });
    } else if (c.status === 'draft' && c.proposed_code) {
      out.push({ id: `c-${c.id}`, kind: 'sign_code', urgency: 'soon', path: `/douane/classer/${c.id}`,
        fr: `Faites signer le code de « ${c.product_name} » par un commissionnaire agréé.`, params: { product: c.product_name } });
    }
  }

  for (const a of input.audits ?? []) {
    const label = a.dau_number ?? a.ref;
    if (a.status === 'failed' || a.status === 'uploaded') {
      out.push({ id: `a-${a.id}`, kind: 'retry_read', urgency: 'now', path: `/douane/audit/${a.id}`,
        fr: `La lecture de la déclaration ${label} n'a pas abouti : relancez-la ou envoyez-la au commissionnaire.`, params: { dau: label } });
    } else if (a.status === 'read' && (a.overpaid_xaf ?? 0) > 0) {
      out.push({ id: `a-${a.id}`, kind: 'review_dau', urgency: 'soon', path: `/douane/audit/${a.id}`,
        fr: `Déclaration ${label} : ${fmt(a.overpaid_xaf!)} F en jeu. Faites-la relire par un commissionnaire agréé.`, params: { dau: label, amount: a.overpaid_xaf! } });
    } else if (a.status === 'reviewed' && (a.recoverable_xaf ?? 0) > 0 && a.claim_deadline) {
      const left = days(a.claim_deadline, today);
      if (left >= 0 && left <= 365) {
        out.push({ id: `a-${a.id}`, kind: 'claim_deadline', urgency: left <= 90 ? 'now' : 'soon', path: `/douane/audit/${a.id}`, due: a.claim_deadline,
          fr: `Réclamez ${fmt(a.recoverable_xaf!)} F sur la déclaration ${label} : il reste ${left} jour${left > 1 ? 's' : ''}.`,
          params: { dau: label, amount: a.recoverable_xaf!, days: left } });
      }
    }
  }

  for (const i of input.invites ?? []) {
    if (i.status !== 'open') continue;
    const fresh = i.documents.filter((d) => days(d.created_at, today) >= -7);
    if (fresh.length > 0) {
      out.push({ id: `i-${i.id}`, kind: 'supplier_docs', urgency: 'soon', path: '/douane/fournisseurs',
        fr: `${i.supplier_name} a déposé ${fresh.length} document${fresh.length > 1 ? 's' : ''}.`, params: { supplier: i.supplier_name, count: fresh.length } });
    } else if (i.documents.length === 0 && i.due_on && days(i.due_on, today) <= 2) {
      const late = days(i.due_on, today) < 0;
      out.push({ id: `i-${i.id}`, kind: 'supplier_waiting', urgency: late ? 'now' : 'soon', path: '/douane/fournisseurs', due: i.due_on,
        fr: `${i.supplier_name} n'a encore rien déposé${late ? ' et l’échéance est passée' : ''} : relancez-le.`, params: { supplier: i.supplier_name, late: late ? 1 : 0 } });
    }
  }

  const codes = (input.classifications ?? []).map((c) => c.final_code ?? c.proposed_code);
  for (const { notice } of noticesForCodes((input.notices ?? []).filter((n) => n.published && phaseOf(n, today) !== 'past'), codes)) {
    out.push({ id: `n-${notice.id}`, kind: 'read_notice', urgency: 'later', path: `/douane/veille#${notice.slug}`,
      fr: `Veille : « ${notice.title} » concerne vos produits.`, params: { title: notice.title } });
  }

  const rank: Record<Urgency, number> = { now: 0, soon: 1, later: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
}
