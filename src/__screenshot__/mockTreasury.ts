/**
 * Fixtures de la Trésorerie pour le harnais de capture d'écran.
 *
 * Substitué à `@/hooks/useTreasury` par un alias Vite quand SCREENSHOT_MOCK=1
 * (voir vite.config.ts) — jamais actif en production ni en dev normal.
 *
 * Les valeurs imitent des données réelles : des taux d'achat autour de
 * 640 XAF/USDT, des ventes autour de 7,2 CNY/USDT, une opération annulée et
 * un achat réparti sur deux comptes — les cas qui font vivre l'interface.
 */
import type { Database } from '@/integrations/supabase/types';

type Result<T> = { data: T; isLoading: boolean; isError: boolean; refetch: () => Promise<unknown> };
const ok = <T,>(data: T): Result<T> => ({ data, isLoading: false, isError: false, refetch: async () => undefined });
// `mutate` répond comme le serveur : l'écran de réussite (le reçu) s'affiche.
const MUTATION_RESULT = { success: true, purchase_id: '3f2c9b12-7a41-4c1e-9d0b-1a2b3c4d5e6f', sale_id: '8e1d4a77-2b90-4f3a-a6c5-0f1e2d3c4b5a', id: 'c9' };
const noopMutation = () => ({
  mutate: (_args?: unknown, opts?: { onSuccess?: (r: typeof MUTATION_RESULT) => void }) => opts?.onSuccess?.(MUTATION_RESULT),
  mutateAsync: async () => MUTATION_RESULT,
  isPending: false,
});

const DAY = 86_400_000;
const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, (days * 17) % 60, 0, 0);
  return d.toISOString();
};

/* ── Comptes ─────────────────────────────────────────────────────── */

const ACCOUNTS = [
  { id: 'a1', entry_count: 14, last_entry_at: ago(4, 15), code: 'CM-OM', label: 'Orange Money Douala', currency: 'XAF', kind: 'mobile_money', balance: 4_850_000, sort_order: 1, is_active: true },
  { id: 'a2', entry_count: 38, last_entry_at: ago(3, 15), code: 'CM-UBA', label: 'UBA Cameroun', currency: 'XAF', kind: 'bank', balance: 12_300_000, sort_order: 2, is_active: true },
  { id: 'a3', entry_count: 22, last_entry_at: ago(2, 15), code: 'CM-CASH', label: 'Caisse Douala', currency: 'XAF', kind: 'cash', balance: 1_240_000, sort_order: 3, is_active: true },
  { id: 'a4', entry_count: 61, last_entry_at: ago(1, 15), code: 'POOL', label: 'Pool USDT', currency: 'USDT', kind: 'crypto_pool', balance: 8_420.5, sort_order: 4, is_active: true },
  { id: 'a5', entry_count: 19, last_entry_at: ago(4, 15), code: 'CN-ALI', label: 'Alipay Guangzhou', currency: 'CNY', kind: 'alipay', balance: 46_800, sort_order: 5, is_active: true },
  { id: 'a6', entry_count: 7, last_entry_at: ago(2, 15), code: 'CN-WX', label: 'WeChat Pay — papa', currency: 'CNY', kind: 'wechat', balance: 12_400, sort_order: 6, is_active: true },
  { id: 'a7', entry_count: 4, last_entry_at: ago(4, 15), code: 'CN-CASH', label: 'Cash Guangzhou', currency: 'CNY', kind: 'cash', balance: 8_900, sort_order: 7, is_active: true },
];

/* ── Contreparties ───────────────────────────────────────────────── */

const COUNTERPARTIES = [
  { id: 'c1', short_id: 'F-001', type: 'usdt_supplier', display_name: 'Ibrahim Trading', legal_name: 'Ibrahim Sarl', phone: '+237 6 99 12 34 56', wechat_id: null, notes: 'Rapide, dispo le week-end', is_active: true },
  { id: 'c2', short_id: 'F-002', type: 'usdt_supplier', display_name: 'Douala Crypto', legal_name: null, phone: '+237 6 77 45 88 21', wechat_id: null, notes: null, is_active: true },
  { id: 'c3', short_id: 'F-003', type: 'usdt_supplier', display_name: 'Kevin P2P', legal_name: null, phone: '+237 6 55 03 77 10', wechat_id: null, notes: 'Petits volumes uniquement', is_active: true },
  { id: 'c4', short_id: 'F-004', type: 'usdt_supplier', display_name: 'Ancien fournisseur', legal_name: null, phone: null, wechat_id: null, notes: null, is_active: false },
  { id: 'c5', short_id: 'A-001', type: 'cny_buyer', display_name: 'Mr. Chen', legal_name: 'Guangzhou Chen Trading Co.', phone: '+86 138 0013 8000', wechat_id: 'chen_gz88', notes: 'Meilleur taux le matin', is_active: true },
  { id: 'c6', short_id: 'A-002', type: 'cny_buyer', display_name: 'Lily Wang', legal_name: null, phone: null, wechat_id: 'lily_wang_yw', notes: 'Yiwu', is_active: true },
];

/* ── Opérations ──────────────────────────────────────────────────── */

const supplier = (id: string) => {
  const c = COUNTERPARTIES.find((x) => x.id === id)!;
  return { id: c.id, short_id: c.short_id, display_name: c.display_name, phone: c.phone, wechat_id: c.wechat_id };
};
const account = (id: string) => {
  const a = ACCOUNTS.find((x) => x.id === id)!;
  return { id: a.id, code: a.code, label: a.label, kind: a.kind };
};

const PURCHASES = [
  { id: 'p1', occurred_at: ago(1, 9), supplier_id: 'c1', xaf_account_id: 'a2', xaf_amount: 3_200_000, usdt_amount: 5_000, implicit_rate: 640, external_ref: 'BIN-8842', notes: null, voided_at: null, void_reason: null },
  { id: 'p2', occurred_at: ago(3, 14), supplier_id: 'c2', xaf_account_id: null, xaf_amount: 1_930_000, usdt_amount: 3_000, implicit_rate: 643.33, external_ref: null, notes: 'Réparti UBA + Orange Money', voided_at: null, void_reason: null },
  { id: 'p3', occurred_at: ago(6, 11), supplier_id: 'c1', xaf_account_id: 'a1', xaf_amount: 1_275_000, usdt_amount: 2_000, implicit_rate: 637.5, external_ref: null, notes: null, voided_at: null, void_reason: null },
  { id: 'p4', occurred_at: ago(9, 16), supplier_id: 'c3', xaf_account_id: 'a3', xaf_amount: 655_000, usdt_amount: 1_000, implicit_rate: 655, external_ref: null, notes: null, voided_at: ago(8, 10), void_reason: 'Saisie en double du 22/08' },
  { id: 'p5', occurred_at: ago(13, 8), supplier_id: 'c2', xaf_account_id: 'a2', xaf_amount: 2_540_000, usdt_amount: 4_000, implicit_rate: 635, external_ref: 'BIN-8710', notes: null, voided_at: null, void_reason: null },
  { id: 'p6', occurred_at: ago(19, 15), supplier_id: 'c1', xaf_account_id: 'a2', xaf_amount: 1_896_000, usdt_amount: 3_000, implicit_rate: 632, external_ref: null, notes: null, voided_at: null, void_reason: null },
];

const SALES = [
  { id: 's1', occurred_at: ago(1, 15), buyer_id: 'c5', cny_account_id: 'a5', usdt_amount: 4_000, cny_amount: 28_960, implicit_rate: 7.24, wac_at_sale: 638.4, external_ref: null, notes: null, voided_at: null, void_reason: null },
  { id: 's2', occurred_at: ago(4, 10), buyer_id: 'c6', cny_account_id: null, usdt_amount: 2_500, cny_amount: 18_025, implicit_rate: 7.21, wac_at_sale: 637.9, external_ref: null, notes: 'Payé direct au fournisseur du client', voided_at: null, void_reason: null },
  { id: 's3', occurred_at: ago(7, 12), buyer_id: 'c5', cny_account_id: 'a6', usdt_amount: 3_000, cny_amount: 21_780, implicit_rate: 7.26, wac_at_sale: 636.2, external_ref: null, notes: null, voided_at: null, void_reason: null },
  { id: 's4', occurred_at: ago(12, 9), buyer_id: 'c6', cny_account_id: 'a5', usdt_amount: 1_800, cny_amount: 12_996, implicit_rate: 7.22, wac_at_sale: 634.8, external_ref: null, notes: null, voided_at: null, void_reason: null },
  { id: 's5', occurred_at: ago(18, 17), buyer_id: 'c5', cny_account_id: 'a5', usdt_amount: 2_600, cny_amount: 18_798, implicit_rate: 7.23, wac_at_sale: 632.5, external_ref: null, notes: null, voided_at: null, void_reason: null },
];

/** Comptes XAF débités par achat — p2 est réparti sur deux comptes. */
const DEBITS: Record<string, Array<{ id: string; amount: number }>> = {
  p2: [
    { id: 'a2', amount: 1_200_000 },
    { id: 'a1', amount: 730_000 },
  ],
};
const debitsOf = (p: (typeof PURCHASES)[number]) => DEBITS[p.id] ?? (p.xaf_account_id ? [{ id: p.xaf_account_id, amount: p.xaf_amount }] : []);

const OPERATIONS = [
  ...PURCHASES.map((p) => ({
    ...p,
    kind: 'purchase' as const,
    supplier: supplier(p.supplier_id),
    xaf_account: p.xaf_account_id ? account(p.xaf_account_id) : null,
    debit_accounts: debitsOf(p).map((d) => ({ id: d.id, label: account(d.id).label, amount: d.amount })),
  })),
  ...SALES.map((s) => ({ ...s, kind: 'sale' as const, buyer: supplier(s.buyer_id), cny_account: s.cny_account_id ? account(s.cny_account_id) : null })),
].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

/* ── Hooks substitués ────────────────────────────────────────────── */

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

export const useTreasuryAccounts = (currency?: 'XAF' | 'USDT' | 'CNY') =>
  ok(ACCOUNTS.filter((a) => !currency || a.currency === currency) as never[]);

export const useTreasuryAccountBalances = () => ok(ACCOUNTS as never[]);

export const useCounterparties = (type?: CounterpartyType, includeArchived = false) =>
  ok(COUNTERPARTIES.filter((c) => (!type || c.type === type) && (includeArchived || c.is_active)) as never[]);

export const useUsdtWac = () => ok(638.42);
export const useUsdtStock = () => ok(8_420.5);

export const usePurchaseSplits = (purchaseId: string | undefined) =>
  ok(
    purchaseId === 'p2'
      ? ([
          { id: 'l1', amount: -1_200_000, account: { id: 'a2', label: 'UBA Cameroun', kind: 'bank' } },
          { id: 'l2', amount: -730_000, account: { id: 'a1', label: 'Orange Money Douala', kind: 'mobile_money' } },
        ] as never[])
      : ([] as never[]),
  );

export const useTreasuryOperations = () => ok(OPERATIONS as never[]);
export const usePurchase = (id: string | undefined) => ok((PURCHASES.find((p) => p.id === id) ?? null) as never);
export const useSale = (id: string | undefined) => ok((SALES.find((s) => s.id === id) ?? null) as never);

export const useTreasuryDashboard = () =>
  ok({
    success: true,
    period: { from: ago(30), to: ago(0) },
    balances: [],
    totals_by_currency: {},
    purchases: { count: 5, total_xaf: 10_841_000, total_usdt: 17_000, weighted_avg_rate_xaf_per_usdt: 637.7 },
    sales: { count: 5, total_usdt: 13_900, total_cny: 100_559, weighted_avg_rate_cny_per_usdt: 7.2345 },
    client_rate: { count: 42, total_xaf: 9_640_000, total_cny: 104_800, weighted_avg_rate_xaf_per_cny: 92.0 },
    wac_usdt_current: 638.42,
    stock_usdt: 8_420.5,
    is_stock_usdt_negative: false,
    spread_chain_xaf: 1_240_000,
    spread_client_xaf: 980_000,
    benefit_total_xaf: 1_284_500,
    capital_immobilized_current_xaf: 11_620_000,
    taux_de_revient_xaf_per_cny: 88.24,
  } as never);

export const useTopCounterparties = (type: CounterpartyType) =>
  ok(
    (type === 'usdt_supplier'
      ? {
          success: true,
          type,
          overall_weighted_avg_rate: 637.7,
          top: [
            { id: 'c1', display_name: 'Ibrahim Trading', phone: '+237 6 99 12 34 56', wechat_id: null, operation_count: 3, total_usdt: 10_000, weighted_avg_rate: 638.6, deviation_pct: 0.14, last_op_at: ago(1) },
            { id: 'c2', display_name: 'Douala Crypto', phone: '+237 6 77 45 88 21', wechat_id: null, operation_count: 2, total_usdt: 7_000, weighted_avg_rate: 635.0, deviation_pct: -0.42, last_op_at: ago(3) },
            { id: 'c3', display_name: 'Kevin P2P', phone: '+237 6 55 03 77 10', wechat_id: null, operation_count: 1, total_usdt: 1_000, weighted_avg_rate: 655, deviation_pct: 2.71, last_op_at: ago(9) },
          ],
        }
      : {
          success: true,
          type,
          overall_weighted_avg_rate: 7.2345,
          top: [
            { id: 'c5', display_name: 'Mr. Chen', phone: '+86 138 0013 8000', wechat_id: 'chen_gz88', operation_count: 3, total_usdt: 9_600, weighted_avg_rate: 7.243, deviation_pct: 0.12, last_op_at: ago(1) },
            { id: 'c6', display_name: 'Lily Wang', phone: null, wechat_id: 'lily_wang_yw', operation_count: 2, total_usdt: 4_300, weighted_avg_rate: 7.214, deviation_pct: -0.28, last_op_at: ago(4) },
          ],
        }) as never,
  );

export const useWacEvolution = () =>
  ok(
    [
      { at: ago(19), wac: 632.0, stock: 3_000, event: 'purchase' },
      { at: ago(18), wac: 632.0, stock: 400, event: 'sale' },
      { at: ago(13), wac: 634.4, stock: 4_400, event: 'purchase' },
      { at: ago(12), wac: 634.8, stock: 2_600, event: 'sale' },
      { at: ago(9), wac: 640.2, stock: 3_600, event: 'purchase' },
      { at: ago(7), wac: 636.2, stock: 600, event: 'sale' },
      { at: ago(6), wac: 637.1, stock: 2_600, event: 'purchase' },
      { at: ago(4), wac: 637.9, stock: 100, event: 'sale' },
      { at: ago(3), wac: 641.2, stock: 3_100, event: 'purchase' },
      { at: ago(1), wac: 638.42, stock: 8_420.5, event: 'purchase' },
    ] as never[],
  );

export const useUsdtFlowEvolution = () =>
  ok({
    purchases: PURCHASES.filter((p) => !p.voided_at).map((p) => ({ at: p.occurred_at, rate: p.implicit_rate, usdt: p.usdt_amount })),
    sales: SALES.map((s) => ({ at: s.occurred_at, rate: s.implicit_rate, usdt: s.usdt_amount })),
  } as never);

export const useCreateCounterparty = noopMutation;
export const useUpdateCounterparty = noopMutation;
export const useDeleteCounterparty = noopMutation;
export const useRecordUsdtPurchase = noopMutation;
export const useRecordUsdtSale = noopMutation;
export const useRecordInventorySnapshot = noopMutation;
export const useAdjustAccount = noopMutation;
export const useVoidTreasuryOperation = noopMutation;

/* Types réexportés depuis le vrai module — le mock ne les redéfinit pas. */
export type {
  TreasuryAccount,
  TreasuryCounterparty,
  TreasuryAccountBalance,
  AccountSplit,
  OperationRow,
  PurchaseRow,
  SaleRow,
  TopCounterpartyRow,
  TopCounterpartiesResult,
  TreasuryDashboard,
  WacPoint,
  FlowPoint,
} from '@/hooks/useTreasury';

/* ── Inventaires et grand livre ─────────────────────────────────────
 *
 * Ce module est substitué à `@/hooks/useTreasury` : il doit en être un
 * SUR-ENSEMBLE. Ajouter un hook au module réel sans l'ajouter ici casse le
 * harnais au chargement (« does not provide an export named … »), ce qui
 * s'est produit en introduisant ces deux vues. */

const acc = (id: string) => {
  const a = ACCOUNTS.find((x) => x.id === id)!;
  return { id: a.id, label: a.label, currency: a.currency, kind: a.kind };
};

const INVENTORY_SNAPSHOTS = [
  { id: 'inv-1', account_id: 'a3', snapshot_at: ago(2, 18), theoretical_balance: 1_240_000, actual_balance: 1_240_000, variance: 0, variance_reason: null, created_at: ago(2, 18), account: acc('a3') },
  { id: 'inv-2', account_id: 'a3', snapshot_at: ago(9, 18), theoretical_balance: 980_000, actual_balance: 975_000, variance: -5_000, variance_reason: 'Appoint non tracé sur un retrait', created_at: ago(9, 18), account: acc('a3') },
  { id: 'inv-3', account_id: 'a7', snapshot_at: ago(11, 10), theoretical_balance: 8_900, actual_balance: 8_900, variance: 0, variance_reason: null, created_at: ago(11, 10), account: acc('a7') },
  { id: 'inv-4', account_id: 'a5', snapshot_at: ago(15, 10), theoretical_balance: 31_200, actual_balance: 31_150, variance: -50, variance_reason: null, created_at: ago(15, 10), account: acc('a5') },
];

/** Le grand livre, déduit des opérations : mêmes énumérations que la base. */
type Entry = { id: string; account_id: string; currency: string; amount: number; occurred_at: string; entry_kind: string; source_table: string | null; source_id: string | null; created_at: string; account: { id: string; label: string; currency: string } };
const entry = (id: string, accountId: string, amount: number, at: string, kind: string, table: string | null, source: string | null): Entry => {
  const a = acc(accountId);
  return { id, account_id: accountId, currency: a.currency, amount, occurred_at: at, entry_kind: kind, source_table: table, source_id: source, created_at: at, account: { id: a.id, label: a.label, currency: a.currency } };
};

const LEDGER: Entry[] = [
  ...PURCHASES.flatMap((p) => [
    ...debitsOf(p).map((d, i) => entry(`${p.id}-d${i}`, d.id, -d.amount, p.occurred_at, 'usdt_purchase_debit_xaf', 'usdt_purchase', p.id)),
    entry(`${p.id}-c`, 'a4', p.usdt_amount, p.occurred_at, 'usdt_purchase_credit_usdt', 'usdt_purchase', p.id),
    ...(p.voided_at
      ? [
          ...debitsOf(p).map((d, i) => entry(`${p.id}-vd${i}`, d.id, d.amount, p.voided_at!, 'void', 'void', p.id)),
          entry(`${p.id}-vc`, 'a4', -p.usdt_amount, p.voided_at, 'void', 'void', p.id),
        ]
      : []),
  ]),
  ...SALES.flatMap((s) => [
    entry(`${s.id}-d`, 'a4', -s.usdt_amount, s.occurred_at, 'usdt_sale_debit_usdt', 'usdt_sale', s.id),
    ...(s.cny_account_id ? [entry(`${s.id}-c`, s.cny_account_id, s.cny_amount, s.occurred_at, 'usdt_sale_credit_cny', 'usdt_sale', s.id)] : []),
  ]),
  entry('adj-1', 'a1', 1_275_000, ago(5, 11), 'inventory_adjustment', 'manual_adjustment', null),
  entry('inv-led-2', 'a3', -5_000, ago(9, 18), 'inventory_adjustment', 'inventory_snapshot', 'inv-2'),
].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

export const useInventorySnapshots = (accountId?: string) =>
  ok((accountId ? INVENTORY_SNAPSHOTS.filter((s) => s.account_id === accountId) : INVENTORY_SNAPSHOTS) as never[]);

export const useTreasuryLedger = (params?: { accountId?: string; currency?: string }) =>
  ok(
    LEDGER.filter(
      (e) =>
        (!params?.accountId || e.account_id === params.accountId) &&
        (!params?.currency || e.currency === params.currency),
    ) as never[],
  );

export const useOperationEntries = (sourceId: string | undefined) =>
  ok(LEDGER.filter((e) => e.source_id === sourceId).sort((a, b) => a.created_at.localeCompare(b.created_at)) as never[]);
