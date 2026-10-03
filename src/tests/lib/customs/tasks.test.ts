// ============================================================
// « À faire » : chaque tâche se déduit de l'état des dossiers, et disparaît
// quand elle est faite.
// ============================================================
import { describe, it, expect } from 'vitest';
import { customsTasks, type InviteSummary } from '@/lib/customs/tasks';
import type { AuditSummary, ClassificationSummary } from '@/lib/customs/files';
import type { Notice } from '@/lib/customs/notices';

const today = new Date('2026-09-30T08:00:00Z');
const cl = (id: string, status: ClassificationSummary['status'], code: string | null = null, final: string | null = null): ClassificationSummary =>
  ({ id, ref: `CL-${id}`, product_name: `Produit ${id}`, status, proposed_code: code, final_code: final, broker_company: null, created_at: '', updated_at: '' });
const au = (id: string, over: Partial<AuditSummary>): AuditSummary =>
  ({ id, ref: `AU-${id}`, dau_number: `DAU-${id}`, status: 'read', overpaid_xaf: null, recoverable_xaf: null, claim_deadline: null, created_at: '', updated_at: '', ...over });
const inv = (id: string, over: Partial<InviteSummary>): InviteSummary =>
  ({ id, supplier_name: `Fournisseur ${id}`, status: 'open', due_on: null, last_upload_at: null, created_at: '2026-09-20T00:00:00Z', documents: [], ...over });

describe('les tâches douane', () => {
  it('le commissionnaire attend : en premier ; une proposition prête : faire signer', () => {
    const t = customsTasks({ classifications: [cl('1', 'draft', '850440'), cl('2', 'needs_info', '940180'), cl('3', 'draft'), cl('4', 'approved', '850440', '850440')], today });
    expect(t.map((x) => [x.kind, x.urgency])).toEqual([['answer_broker', 'now'], ['sign_code', 'soon']]);
    expect(t[0].path).toBe('/douane/classer/2');
  });

  it('les déclarations : relancer une lecture, faire relire un enjeu, réclamer avant le délai', () => {
    const t = customsTasks({ today, audits: [
      au('1', { status: 'failed' }),
      au('2', { status: 'read', overpaid_xaf: 307_078 }),
      au('3', { status: 'read', overpaid_xaf: 0 }),
      au('4', { status: 'reviewed', recoverable_xaf: 58_136, claim_deadline: '2026-11-15' }),
      au('5', { status: 'reviewed', recoverable_xaf: 12_000, claim_deadline: '2029-09-17' }),
      au('6', { status: 'reviewed', recoverable_xaf: 9_000, claim_deadline: '2026-09-01' }),
    ] });
    expect(t.map((x) => [x.id, x.kind, x.urgency])).toEqual([
      ['a-4', 'claim_deadline', 'now'], ['a-1', 'retry_read', 'now'], ['a-2', 'review_dau', 'soon'],
    ]);
    expect(t[0].fr).toContain('58 136 F');
    expect(t[0].fr).toContain('46 jours');
  });

  it('les fournisseurs : un dépôt récent à lire ; un silence à l’échéance à relancer', () => {
    const t = customsTasks({ today, invites: [
      inv('1', { documents: [{ id: 'd', created_at: '2026-09-29T10:00:00Z' }] }),
      inv('2', { due_on: '2026-09-28' }),
      inv('3', { due_on: '2026-10-20' }),
      inv('4', { status: 'revoked', due_on: '2026-09-01' }),
    ] });
    expect(t.map((x) => [x.id, x.kind, x.urgency])).toEqual([['i-2', 'supplier_waiting', 'now'], ['i-1', 'supplier_docs', 'soon']]);
  });

  it('la veille : un avis sur un produit classé, à lire', () => {
    const notice = { id: 'n', slug: 'tec-ceeac-2026', kind: 'regulation', title: 'TEC CEEAC', status: 'in_force', published: true, hs_specs: ['6704'], starts_on: '2026-01-01', ends_on: null } as unknown as Notice;
    const t = customsTasks({ today, classifications: [cl('1', 'approved', '670420', '670420')], notices: [notice] });
    expect(t.map((x) => [x.kind, x.path])).toEqual([['read_notice', '/douane/veille#tec-ceeac-2026']]);
  });

  it('rien à faire : rien d’affiché', () => {
    expect(customsTasks({ today })).toEqual([]);
  });
});
