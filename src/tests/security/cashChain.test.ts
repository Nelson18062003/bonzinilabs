// ============================================================
// Test de non-régression SÉCURITÉ — la chaîne cash est réelle.
//
// Constat du 21/10/2026 en production : 27 paiements cash effectués en
// 90 jours, 0 scanné, 0 signé. Ils naissaient en `ready_for_payment` et
// process_payment les terminait sans QR ni signature ; l'agent cash, lui,
// avait `canProcessPayments` et pouvait donc traiter un paiement Alipay ou
// un virement par appel direct.
//
// Décision : scan du QR du client ET signature du bénéficiaire
// OBLIGATOIRES ; l'agent cash n'a que `canHandleCash`. Ce test lit la
// DERNIÈRE redéfinition de chaque fonction dans les migrations.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

/** Corps de la dernière redéfinition complète de `fn` (jusqu'au $function$; qui la ferme). */
function latestBody(fn: string): string {
  for (const file of [...files].reverse()) {
    const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const idx = content.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    if (idx === -1) continue;
    const end = content.indexOf('$function$;', idx);
    return content.slice(idx, end === -1 ? undefined : end);
  }
  throw new Error(`${fn} introuvable dans les migrations`);
}

describe('SÉCURITÉ — chaîne cash : scan puis signature, par canHandleCash', () => {
  it.each(['scan_cash_payment', 'confirm_cash_payment'])('%s exige canHandleCash', (fn) => {
    const body = latestBody(fn);
    expect(body).toContain("admin_has_permission(auth.uid(), 'canHandleCash')");
    expect(body).not.toContain("'canProcessPayments'");
    expect(body).toContain('WHERE id = p_payment_id FOR UPDATE');
    expect(body).toContain("IN ('rejected', 'cancelled_by_admin')");
  });

  it('scan_cash_payment : seulement depuis cash_pending (ou les anciens ready_for_payment / processing)', () => {
    expect(latestBody('scan_cash_payment')).toContain("NOT IN ('cash_pending', 'ready_for_payment', 'processing')");
  });

  it('confirm_cash_payment : seulement après le scan, avec signature et nom du signataire', () => {
    const body = latestBody('confirm_cash_payment');
    expect(body).toContain("v_payment.status <> 'cash_scanned'");
    expect(body).toContain("position('/cash-signatures/' in v_signature_url) = 0");
    expect(body).toContain('IF v_signed_by IS NULL');
  });

  it('process_payment refuse de commencer ou valider un paiement cash (le refus reste permis)', () => {
    const body = latestBody('process_payment');
    expect(body).toContain("v_payment.method = 'cash' AND p_action IN ('start_processing', 'complete')");
  });

  it.each(['create_admin_payment', 'create_payment'])('%s crée un paiement cash en cash_pending', (fn) => {
    expect(latestBody(fn)).toMatch(/IF p_method = 'cash' THEN\s+v_status := 'cash_pending';/);
  });

  it('create_payment_batch crée chaque ligne cash en cash_pending', () => {
    expect(latestBody('create_payment_batch')).toContain("WHEN v_method = 'cash' THEN 'cash_pending'::payment_status");
  });

  it('la notification « cash à remettre » vise canHandleCash (l’agent cash n’a plus canProcessPayments)', () => {
    const body = latestBody('staff_push_on_payment');
    expect(body).toMatch(/send_staff_push_k\('payments', 'canHandleCash', 'Paiement cash à remettre'[\s\S]*array\['cash_agent'\]/);
  });
});

describe('ARGENT — annuler un dépôt reprend ce qui a été crédité', () => {
  it('cancel_deposit reprend l’écriture DEPOSIT_VALIDATED, à défaut le montant confirmé', () => {
    const body = latestBody('cancel_deposit');
    expect(body).toContain("le.entry_type = 'DEPOSIT_VALIDATED'");
    expect(body).toContain('COALESCE(v_reversal, v_deposit.confirmed_amount_xaf, v_deposit.amount_xaf)');
    // Plus aucun débit calculé sur le seul montant déclaré.
    expect(body).not.toContain('balance_xaf - v_deposit.amount_xaf');
    // Plancher de découvert (security.md), jamais 0.
    expect(body).toContain('-COALESCE(v_wallet.overdraft_limit_xaf, 0)');
  });
});
