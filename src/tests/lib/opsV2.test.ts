/**
 * Opérations v2 (mobile) : la traduction des puces et filtres en filtres
 * serveur, les mots des statuts, et le champ unique « ID » d'un nouveau
 * fournisseur.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, activeFilterCount, depositFilters, paymentFilters } from '@/mobile/screens/operations/opsFilters';
import { depositTag, groupByDay, paymentTag, yuan } from '@/mobile/screens/operations/opsLabels';
import { withAccount } from '@/mobile/screens/payments/supplierDraft';
import { draftErrors, draftPayload, emptyDraft } from '@/lib/beneficiaries/contact';

describe('filtres de la liste Opérations', () => {
  it('« À payer » couvre les paiements prêts, au bureau et QR lu ; « En cours » le traitement', () => {
    expect(paymentFilters('to_pay', DEFAULT_FILTERS, '').statuses).toEqual(['ready_for_payment', 'cash_pending', 'cash_scanned']);
    expect(paymentFilters('in_progress', DEFAULT_FILTERS, '').statuses).toEqual(['processing']);
    expect(paymentFilters('paid', DEFAULT_FILTERS, '').statuses).toEqual(['completed']);
    expect(paymentFilters('all', DEFAULT_FILTERS, '').statuses).toBeUndefined();
  });

  it('un statut rare choisi dans la feuille l’emporte sur la puce', () => {
    const f = { ...DEFAULT_FILTERS, payExtra: 'waiting_beneficiary_info' as const };
    expect(paymentFilters('to_pay', f, '').statuses).toEqual(['waiting_beneficiary_info']);
    expect(activeFilterCount(f, 'payments')).toBe(1);
  });

  it('le moyen d’un dépôt filtre par famille côté serveur (le filtre était sans effet)', () => {
    const f = { ...DEFAULT_FILTERS, depFamily: 'ORANGE_MONEY' as const };
    expect(depositFilters('all', f, '').methods).toEqual(['om_transfer', 'om_withdrawal']);
    expect(depositFilters('to_validate', DEFAULT_FILTERS, '').statuses).toEqual(['proof_submitted', 'admin_review', 'pending_correction']);
  });

  it('le tri « Montant » et la recherche passent au serveur', () => {
    const f = { ...DEFAULT_FILTERS, sort: 'amount_asc' as const };
    expect(paymentFilters('all', f, ' Fatou ')).toMatchObject({ sortField: 'amount_rmb', sortAscending: true, search: 'Fatou' });
    expect(depositFilters('all', f, '')).toMatchObject({ sortField: 'amount_xaf', sortAscending: true });
  });
});

describe('les mots des statuts', () => {
  it('dépôts et paiements parlent la langue de la v2', () => {
    expect(depositTag('proof_submitted').label).toBe('À valider');
    expect(depositTag('validated')).toEqual({ tone: 'success', label: 'Crédité' });
    expect(paymentTag('ready_for_payment').label).toBe('À payer');
    expect(paymentTag('completed')).toEqual({ tone: 'success', label: 'Payé' });
    expect(paymentTag('cash_pending').label).toBe('Au bureau');
  });

  it('groupe par jour dans l’ordre d’arrivée', () => {
    const now = new Date();
    const rows = [{ d: now.toISOString() }, { d: now.toISOString() }, { d: new Date(now.getTime() - 86_400_000 * 40).toISOString() }];
    const g = groupByDay(rows, (r) => r.d);
    expect(g[0].label).toBe("Aujourd'hui");
    expect(g[0].rows).toHaveLength(2);
    expect(g).toHaveLength(2);
  });

  it('écrit le ¥ devant, sans décimales inutiles', () => {
    expect(yuan(7493)).toBe('¥ 7 493');
    expect(yuan(12.5)).toBe('¥ 12,50');
  });
});

describe('le champ unique « ID » d’un nouveau fournisseur', () => {
  it('Alipay : un mobile chinois devient un compte téléphone valide', () => {
    const d = withAccount('alipay', { ...emptyDraft('alipay'), name: 'Guangzhou Hengtai' }, '13802194471');
    expect(d.accountKind).toBe('phone');
    expect(draftErrors('alipay', d).account).toBeUndefined();
    expect(draftPayload('alipay', d)).toMatchObject({ identifier_type: 'phone' });
  });

  it('Alipay : une adresse devient un e-mail ; WeChat : un ID reste un ID', () => {
    expect(withAccount('alipay', emptyDraft('alipay'), 'hengtai_gz@163.com').accountKind).toBe('email');
    const w = withAccount('wechat', { ...emptyDraft('wechat'), name: 'Chen Xiaoli' }, 'wxid_chenxl88');
    expect(w.accountKind).toBe('id');
    expect(draftPayload('wechat', w)).toMatchObject({ identifier: 'wxid_chenxl88', identifier_type: 'id' });
  });
});
