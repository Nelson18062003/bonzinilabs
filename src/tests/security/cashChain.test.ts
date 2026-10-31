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
import { cashQrPayload, parseCashQRCode } from '@/hooks/useCashPayment';
import { clientCountryToRateKey } from '@/components/payment-form/paymentRateLogic';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
const CHAIN = readFileSync(join(MIGRATIONS_DIR, '20261021100000_cash_chain_and_money_fixes.sql'), 'utf8');

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
  it('scan_cash_payment exige canHandleCash', () => {
    const body = latestBody('scan_cash_payment');
    expect(body).toContain("admin_has_permission(auth.uid(), 'canHandleCash')");
    expect(body).not.toContain("'canProcessPayments'");
    expect(body).toContain('WHERE id = p_payment_id FOR UPDATE');
    expect(body).toContain("IN ('rejected', 'cancelled_by_admin')");
  });

  // Décision du propriétaire (31/10/2026) : l'administration (canProcessPayments)
  // valide la remise sans scan ni signature ; l'agent cash garde la chaîne complète.
  it('confirm_cash_payment : agent cash (canHandleCash) ou administration (canProcessPayments), clôture verrouillée', () => {
    const body = latestBody('confirm_cash_payment');
    expect(body).toContain("admin_has_permission(auth.uid(), 'canHandleCash')");
    expect(body).toContain("admin_has_permission(auth.uid(), 'canProcessPayments')");
    expect(body).toContain('_cash_payment_complete(');
    const core = latestBody('_cash_payment_complete');
    expect(core).toContain('WHERE id = p_payment_id FOR UPDATE');
    expect(core).toContain("IN ('rejected', 'cancelled_by_admin')");
    expect(core).toContain("v_payment.status = 'completed'");
    expect(core).toContain('_payment_debit_held(p_payment_id) <> v_payment.amount_xaf');
  });

  it('_cash_payment_complete n’est appelable que par les RPC (aucun EXECUTE pour anon / authenticated)', () => {
    const file = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).find((c) => c.includes('FUNCTION public._cash_payment_complete('));
    expect(file).toContain('REVOKE EXECUTE ON FUNCTION public._cash_payment_complete(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated');
  });

  it('scan_cash_payment(id, jeton) : seulement depuis cash_pending, jeton exact, montant réservé', () => {
    const body = latestBody('scan_cash_payment');
    expect(body).toMatch(/^CREATE OR REPLACE FUNCTION public\.scan_cash_payment\(p_payment_id uuid, p_qr_token text\)/);
    expect(body).toContain("v_payment.status <> 'cash_pending'");
    expect(body).toContain('btrim(p_qr_token) <> v_token');
    expect(body).toContain('_payment_debit_held(p_payment_id) <> v_payment.amount_xaf');
  });

  it('le 21/10, les anciennes signatures (sans jeton, URL publique) refusaient (le scan sans jeton refuse toujours)', () => {
    for (const sig of ['scan_cash_payment(p_payment_id uuid)', 'confirm_cash_payment(p_payment_id uuid, p_signature_url text, p_signed_by_name text)']) {
      const idx = CHAIN.indexOf(`CREATE OR REPLACE FUNCTION public.${sig}`);
      expect(idx, sig).toBeGreaterThan(-1);
      const body = CHAIN.slice(idx, CHAIN.indexOf('$function$;', idx));
      expect(body).toContain("'success', false");
      expect(body).not.toContain('UPDATE payments');
    }
  });

  it('confirm_cash_payment, agent cash : après le scan, fichier déposé par l’appelant pour CE paiement, nom déclaré', () => {
    const body = latestBody('confirm_cash_payment');
    expect(body).toMatch(/^CREATE OR REPLACE FUNCTION public\.confirm_cash_payment\(p_payment_id uuid, p_signature_path text, p_signed_by_name text, p_signer_id_number text\)/);
    // La chaîne stricte vit dans la branche « pas administration ».
    const agent = body.slice(body.indexOf('IF NOT v_admin THEN'));
    expect(agent).toContain("v_payment.status <> 'cash_scanned'");
    expect(agent).toContain('IF v_signed_by IS NULL');
    expect(agent).toContain('o.created_at >= v_payment.cash_scanned_at');
    // Une signature fournie, même par l'administration, est un vrai fichier de CE paiement, déposé par l'appelant.
    expect(body).toContain("o.bucket_id = 'cash-signatures'");
    expect(body).toContain('COALESCE(o.owner_id, o.owner::text) = auth.uid()::text');
    expect(body).toContain("p_payment_id::text || '/'");
  });

  it('l’ancienne confirmation (3 arguments) est réservée à l’administration', () => {
    const files3 = [...files].reverse().map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    const sig = 'CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id uuid, p_signature_url text, p_signed_by_name text)';
    const content = files3.find((c) => c.includes(sig))!;
    const body = content.slice(content.indexOf(sig), content.indexOf('$function$;', content.indexOf(sig)));
    expect(body).toContain("IF NOT public.admin_has_permission(auth.uid(), 'canProcessPayments') THEN");
    expect(body).toContain('_cash_payment_complete(');
  });

  it('ni le scan ni la confirmation ne sont exposés à Mola (caméra et signature devant le client)', () => {
    for (const sig of ['scan_cash_payment(uuid, text)', 'scan_cash_payment(uuid)', 'confirm_cash_payment(uuid, text, text, text)', 'confirm_cash_payment(uuid, text, text)']) {
      const m = new RegExp(`comment on function public\\.${sig.replace(/[()]/g, '\\$&')} is\\s+'@mola:\\{"expose":false`).exec(CHAIN);
      expect(m, sig).not.toBeNull();
    }
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

describe('SÉCURITÉ — le QR cash porte le secret du client', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const token = 'c0ffee'.repeat(10) + 'abcd';

  it('le QR dessiné par l’app client se relit, avec son jeton', () => {
    expect(parseCashQRCode(cashQrPayload(id, token))).toEqual({ paymentId: id, token, isValid: true });
  });

  it('l’identifiant seul ne suffit plus (ancien QR, ID copié, UUID collé, fiche admin)', () => {
    for (const s of [
      JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id, v: 1 }),
      id,
      `BONZINI_CASH_PAYMENT:${id}`,
      `https://bonzinilabs.com/pay?paymentId=${id}`,
      JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id, t: 'trop-court', v: 2 }),
      JSON.stringify({ type: 'AUTRE', id, t: token }),
    ]) {
      expect(parseCashQRCode(s).isValid, s).toBe(false);
    }
  });

  it('la table des jetons n’est lisible que par le client propriétaire (aucune politique staff)', () => {
    expect(CHAIN).toContain('CREATE TABLE IF NOT EXISTS public.payment_cash_tokens');
    expect(CHAIN).toContain('ALTER TABLE public.payment_cash_tokens ENABLE ROW LEVEL SECURITY');
    expect(CHAIN).toContain('p.user_id = auth.uid()');
    expect(CHAIN).toContain('REVOKE ALL ON public.payment_cash_tokens FROM PUBLIC, anon, authenticated');
    expect(CHAIN.match(/CREATE POLICY/g)?.length).toBe(1);
  });

  it('le jeton fait au moins 128 bits (deux UUID v4) et existe pour les cash déjà ouverts', () => {
    expect(CHAIN).toContain("replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')");
    expect(CHAIN).toMatch(/INSERT INTO public\.payment_cash_tokens \(payment_id, token\)\s+SELECT/);
  });
});

describe('SÉCURITÉ — hors RPC, l’API ne crée ni ne fait avancer aucun paiement', () => {
  const guard = latestBody('guard_cash_payment_status');

  it('refuse INSERT et DELETE directs, pour anon / authenticated seulement', () => {
    expect(guard).toContain("current_user NOT IN ('anon', 'authenticated')");
    expect(guard).toContain("TG_OP = 'INSERT'");
    expect(guard).toContain("TG_OP = 'DELETE'");
    expect(CHAIN).toMatch(/CREATE OR REPLACE TRIGGER payments_cash_chain_guard\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.payments/);
    expect(CHAIN).toMatch(/ALTER POLICY "Users can create own payments" ON public\.payments\s+WITH CHECK \(false\)/);
  });

  it('refuse de rouvrir un paiement clos et tout changement de statut d’un cash', () => {
    expect(guard).toContain("OLD.status IN ('completed', 'rejected', 'cancelled_by_admin')");
    expect(guard).toContain("OLD.method = 'cash' OR NEW.method = 'cash'");
  });

  it('ne laisse modifier directement QUE les coordonnées du bénéficiaire (ce qu’écrivent les écrans)', () => {
    const allowed = /c_direct_ok CONSTANT text\[\] := ARRAY\[([^\]]*)\]/.exec(guard)?.[1] ?? '';
    const cols = [...allowed.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(cols).toEqual([
      'beneficiary_bank_account', 'beneficiary_bank_extra', 'beneficiary_bank_name', 'beneficiary_details',
      'beneficiary_email', 'beneficiary_id', 'beneficiary_identifier', 'beneficiary_identifier_type',
      'beneficiary_name', 'beneficiary_notes', 'beneficiary_phone', 'beneficiary_qr_code_url', 'updated_at',
    ]);
    for (const forbidden of ['status', 'amount_xaf', 'amount_rmb', 'exchange_rate', 'rate_is_custom', 'user_id', 'method']) {
      expect(cols).not.toContain(forbidden);
    }
    expect(cols.some((c) => c.startsWith('cash_'))).toBe(false);
  });

  it('les écrans n’écrivent directement dans payments que des colonnes permises', () => {
    const allowed = new Set([
      'beneficiary_name', 'beneficiary_phone', 'beneficiary_email', 'beneficiary_qr_code_url', 'beneficiary_bank_name',
      'beneficiary_bank_account', 'beneficiary_bank_extra', 'beneficiary_notes', 'beneficiary_identifier',
      'beneficiary_identifier_type', 'beneficiary_id', 'beneficiary_details', 'updated_at',
    ]);
    for (const file of ['src/hooks/useAdminPayments.ts', 'src/hooks/usePayments.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      for (const m of src.matchAll(/\.from\('payments'\)\s*\.update\(\{([^}]*)\}/g)) {
        for (const k of m[1].matchAll(/(\w+):/g)) expect(allowed.has(k[1]), `${file} écrit ${k[1]}`).toBe(true);
      }
    }
  });
});

describe('ARGENT — le prix d’un paiement client est recalculé par le serveur', () => {
  const body = latestBody('create_payment');

  it('la nouvelle signature (21 paramètres, sans défauts) porte la logique ; l’ancienne l’enveloppe', () => {
    expect(body).toContain('p_beneficiary_bank_extra text, p_beneficiary_identifier text, p_beneficiary_identifier_type text)');
    expect(body).not.toContain('DEFAULT');
    expect(CHAIN).toContain('SELECT public.create_payment(');
  });

  it('recalcule le ¥ au taux publié, refuse au-delà de 1 ¥, jamais « perso »', () => {
    expect(body).toContain('FROM public.daily_rates WHERE is_active = TRUE');
    expect(body).toContain('public._rate_country_key(v_country)');
    expect(body).toContain('<= 1 THEN');
    expect(body).toMatch(/p_beneficiary_id, p_beneficiary_details, false\s*\)/);
    expect(body).toContain('p_amount_xaf IS NULL OR p_amount_xaf <= 0');
    expect(body).toContain('b.client_id = v_user_id');
  });

  it('la clé pays SQL suit clientCountryToRateKey pour chaque alias connu', () => {
    const fn = latestBody('_rate_country_key');
    const pairs = [...fn.matchAll(/\('([^']+)', '([a-z]+)'\)/g)].map((m) => [m[1], m[2]] as const);
    expect(pairs.length).toBeGreaterThan(10);
    for (const [alias, key] of pairs) expect(clientCountryToRateKey(alias), alias).toBe(key);
    // Saisies réelles : même résultat que la règle SQL (accents, majuscules, « / »).
    for (const [label, key] of [['Cameroun', 'cameroun'], ['GABON', 'gabon'], ['République centrafricaine', 'rca'],
      ['Guinée Équatoriale', 'guinee'], ['Congo / Brazzaville', 'congo'], ['Guinée', 'cameroun'], ['RD Congo', 'cameroun'], ['', 'cameroun']] as const) {
      expect(clientCountryToRateKey(label), label).toBe(key);
    }
  });

  it.each(['create_admin_payment', 'create_payment_batch'])('%s refuse un taux nul (plus de COALESCE à 0)', (fn) => {
    const b = latestBody(fn);
    expect(b).not.toContain("COALESCE(NULLIF(v_line->>'exchange_rate','')::numeric, 0)");
    expect(b).toMatch(/exchange_rate.*<= 0/);
  });
});

describe('Divers', () => {
  it('cancel_deposit : étiquette Mola sur la vraie garde (super admin)', () => {
    expect(CHAIN).toMatch(/comment on function public\.cancel_deposit\(uuid\) is\s+'@mola:\{"expose":true,"kind":"write","permission":"canManageUsers"/);
  });

  it('le client est prévenu dès la création d’un paiement cash', () => {
    expect(CHAIN).toMatch(/CREATE OR REPLACE TRIGGER on_cash_payment_created\s+AFTER INSERT ON public\.payments\s+FOR EACH ROW WHEN \(NEW\.status = 'cash_pending'::payment_status\)/);
  });

  it('les cash restés sur l’ancien chemin passent en cash_pending', () => {
    expect(CHAIN).toMatch(/SET status = 'cash_pending'[\s\S]*AND status IN \('ready_for_payment', 'processing'\)/);
  });
});
