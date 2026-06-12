import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];
type LedgerSourceTable = Database['public']['Enums']['treasury_ledger_source_table'];

export type TreasuryAccount = Database['public']['Tables']['treasury_accounts']['Row'];
export type TreasuryCounterparty = Database['public']['Tables']['treasury_counterparties']['Row'];
export type TreasuryAccountBalance = Database['public']['Views']['treasury_account_balances']['Row'];

// ─── Accounts ────────────────────────────────────────────────

export function useTreasuryAccounts(currency?: 'XAF' | 'USDT' | 'CNY') {
  return useQuery({
    queryKey: ['treasury', 'accounts', currency ?? 'all'],
    queryFn: async () => {
      let query = supabaseAdmin
        .from('treasury_accounts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (currency) query = query.eq('currency', currency);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TreasuryAccount[];
    },
    staleTime: 60_000,
  });
}

export function useTreasuryAccountBalances() {
  return useQuery({
    queryKey: ['treasury', 'balances'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('treasury_account_balances')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as TreasuryAccountBalance[];
    },
    staleTime: 15_000,
  });
}

// ─── Counterparties ──────────────────────────────────────────

export function useCounterparties(type?: CounterpartyType, includeArchived = false) {
  return useQuery({
    queryKey: ['treasury', 'counterparties', type ?? 'all', includeArchived],
    queryFn: async () => {
      let query = supabaseAdmin
        .from('treasury_counterparties')
        .select('*')
        .order('display_name');
      if (type) query = query.eq('type', type);
      if (!includeArchived) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TreasuryCounterparty[];
    },
    staleTime: 30_000,
  });
}

interface CreateCounterpartyArgs {
  type: CounterpartyType;
  display_name: string;
  legal_name?: string;
  phone?: string;
  wechat_id?: string;
  notes?: string;
}

export function useCreateCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateCounterpartyArgs) => {
      const { data, error } = await supabaseAdmin.rpc('create_treasury_counterparty', {
        p_type: args.type,
        p_display_name: args.display_name,
        p_legal_name: args.legal_name,
        p_phone: args.phone,
        p_wechat_id: args.wechat_id,
        p_notes: args.notes,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; id?: string };
      if (!result.success) throw new Error(result.error ?? 'Erreur création contrepartie');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury', 'counterparties'] });
      toast.success('Contrepartie créée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

interface UpdateCounterpartyArgs {
  id: string;
  display_name?: string;
  legal_name?: string | null;
  phone?: string | null;
  wechat_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function useUpdateCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateCounterpartyArgs) => {
      const { data, error } = await supabaseAdmin.rpc('update_treasury_counterparty', {
        p_id: args.id,
        p_display_name: args.display_name ?? undefined,
        p_legal_name: args.legal_name ?? undefined,
        p_phone: args.phone ?? undefined,
        p_wechat_id: args.wechat_id ?? undefined,
        p_notes: args.notes ?? undefined,
        p_is_active: args.is_active ?? undefined,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error ?? 'Erreur mise à jour');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury', 'counterparties'] });
      toast.success('Contrepartie mise à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCounterparty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabaseAdmin.rpc('delete_treasury_counterparty', { p_id: id });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; operation_count?: number };
      if (!result.success) throw new Error(result.error ?? 'Erreur suppression');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury', 'counterparties'] });
      toast.success('Contrepartie supprimée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── USDT pool: WAC & stock ─────────────────────────────────

export function useUsdtWac() {
  return useQuery({
    queryKey: ['treasury', 'wac_usdt'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_wac_usdt', {});
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 10_000,
  });
}

export function useUsdtStock() {
  return useQuery({
    queryKey: ['treasury', 'stock_usdt'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_usdt_stock', {});
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 10_000,
  });
}

// ─── Purchases ──────────────────────────────────────────────

export interface AccountSplit {
  account_id: string;
  xaf_amount: number;
}

interface RecordPurchaseArgs {
  supplier_id: string;
  usdt_amount: number;
  /** One or more XAF accounts debited; total = sum of xaf_amount. */
  account_splits: AccountSplit[];
  occurred_at?: string;
  external_ref?: string;
  notes?: string;
}

interface PurchaseResult {
  success: boolean;
  error?: string;
  purchase_id?: string;
  total_xaf?: number;
  account_count?: number;
  implicit_rate?: number;
  new_wac?: number;
}

export function useRecordUsdtPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecordPurchaseArgs) => {
      const { data, error } = await supabaseAdmin.rpc('record_usdt_purchase', {
        p_supplier_id: args.supplier_id,
        p_usdt_amount: args.usdt_amount,
        p_account_splits: args.account_splits as unknown as Database['public']['Tables']['treasury_ledger_entries']['Row']['metadata'],
        p_occurred_at: args.occurred_at,
        p_external_ref: args.external_ref,
        p_notes: args.notes,
      });
      if (error) throw error;
      const result = data as PurchaseResult;
      if (!result.success) throw new Error(result.error ?? 'Erreur achat USDT');
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['treasury'] });
      toast.success(`Achat enregistré. Nouveau WAC: ${r.new_wac?.toFixed(4)} XAF/USDT`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** XAF debit ledger lines of a purchase, with account labels — for the multi-account breakdown. */
export function usePurchaseSplits(purchaseId: string | undefined) {
  return useQuery({
    queryKey: ['treasury', 'purchase-splits', purchaseId],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('treasury_ledger_entries')
        .select('id, amount, account:treasury_accounts!account_id(id,label,kind)')
        .eq('source_table', 'usdt_purchase')
        .eq('source_id', purchaseId!)
        .eq('entry_kind', 'usdt_purchase_debit_xaf');
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        amount: number;
        account: { id: string; label: string; kind: string } | null;
      }>;
    },
    enabled: !!purchaseId,
  });
}

// ─── Sales ──────────────────────────────────────────────────

interface RecordSaleArgs {
  buyer_id: string;
  /** Optional: when omitted, the sale is recorded without crediting any Bonzini CNY account. */
  cny_account_id?: string | null;
  usdt_amount: number;
  cny_amount: number;
  occurred_at?: string;
  external_ref?: string;
  notes?: string;
}

interface SaleResult {
  success: boolean;
  error?: string;
  sale_id?: string;
  implicit_rate?: number;
  wac_at_sale?: number;
  stock_usdt_after?: number;
  warning_negative_stock?: boolean;
}

export function useRecordUsdtSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecordSaleArgs) => {
      const { data, error } = await supabaseAdmin.rpc('record_usdt_sale', {
        p_buyer_id: args.buyer_id,
        p_cny_account_id: args.cny_account_id ?? undefined,
        p_usdt_amount: args.usdt_amount,
        p_cny_amount: args.cny_amount,
        p_occurred_at: args.occurred_at,
        p_external_ref: args.external_ref,
        p_notes: args.notes,
      });
      if (error) throw error;
      const result = data as SaleResult;
      if (!result.success) throw new Error(result.error ?? 'Erreur vente USDT');
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['treasury'] });
      if (r.warning_negative_stock) {
        toast.warning(`Vente enregistrée. ATTENTION: stock USDT négatif (${r.stock_usdt_after?.toFixed(2)})`);
      } else {
        toast.success(`Vente enregistrée. Stock USDT: ${r.stock_usdt_after?.toFixed(2)}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Inventory ──────────────────────────────────────────────

interface InventoryArgs {
  account_id: string;
  actual_balance: number;
  variance_reason?: string;
  snapshot_at?: string;
}

export function useRecordInventorySnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: InventoryArgs) => {
      const { data, error } = await supabaseAdmin.rpc('record_inventory_snapshot', {
        p_account_id: args.account_id,
        p_actual_balance: args.actual_balance,
        p_variance_reason: args.variance_reason,
        p_snapshot_at: args.snapshot_at,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; variance?: number };
      if (!result.success) throw new Error(result.error ?? 'Erreur inventaire');
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['treasury'] });
      toast.success(`Inventaire enregistré. Écart: ${r.variance?.toFixed(2) ?? '0'}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Manual account adjustment ─────────────────────────────

interface AdjustArgs {
  account_id: string;
  delta_amount: number;
  reason: string;
  occurred_at?: string;
}

export function useAdjustAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AdjustArgs) => {
      const { data, error } = await supabaseAdmin.rpc('adjust_treasury_account', {
        p_account_id: args.account_id,
        p_delta_amount: args.delta_amount,
        p_reason: args.reason,
        p_occurred_at: args.occurred_at,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; direction?: string };
      if (!result.success) throw new Error(result.error ?? 'Erreur ajustement');
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['treasury'] });
      toast.success(r.direction === 'credit' ? 'Compte approvisionné' : 'Compte débité');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Voiding ────────────────────────────────────────────────

interface VoidArgs {
  source_table: LedgerSourceTable;
  source_id: string;
  void_reason: string;
}

export function useVoidTreasuryOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: VoidArgs) => {
      const { data, error } = await supabaseAdmin.rpc('void_treasury_operation', {
        p_source_table: args.source_table,
        p_source_id: args.source_id,
        p_void_reason: args.void_reason,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error ?? 'Erreur annulation');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury'] });
      toast.success('Opération annulée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Dashboard ──────────────────────────────────────────────

export interface TreasuryDashboard {
  success: boolean;
  period: { from: string; to: string };
  balances: Array<{
    id: string;
    code: string;
    label: string;
    currency: 'XAF' | 'USDT' | 'CNY';
    kind: string;
    balance: number;
    is_active: boolean;
  }>;
  totals_by_currency: Record<string, { total: number; account_count: number }>;
  purchases: { count: number; total_xaf: number; total_usdt: number; weighted_avg_rate_xaf_per_usdt: number };
  sales: { count: number; total_usdt: number; total_cny: number; weighted_avg_rate_cny_per_usdt: number };
  client_rate: { count: number; total_xaf: number; total_cny: number; weighted_avg_rate_xaf_per_cny: number };
  wac_usdt_current: number;
  stock_usdt: number;
  is_stock_usdt_negative: boolean;
  spread_chain_xaf: number;
  spread_client_xaf: number;
  benefit_total_xaf: number;
  capital_immobilized_current_xaf: number;
  taux_de_revient_xaf_per_cny: number | null;
}

export function useTreasuryDashboard(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['treasury', 'dashboard', fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_treasury_dashboard', {
        p_from_date: fromIso,
        p_to_date: toIso,
      });
      if (error) throw error;
      return data as unknown as TreasuryDashboard;
    },
    staleTime: 30_000,
  });
}

// ─── Top counterparties ─────────────────────────────────────

export interface TopCounterpartyRow {
  id: string;
  display_name: string;
  phone: string | null;
  wechat_id: string | null;
  operation_count: number;
  total_usdt: number;
  total_xaf?: number;
  total_cny?: number;
  weighted_avg_rate: number;
  deviation_pct: number;
  last_op_at: string;
}

export interface TopCounterpartiesResult {
  success: boolean;
  type: CounterpartyType;
  overall_weighted_avg_rate: number;
  top: TopCounterpartyRow[];
}

export function useTopCounterparties(type: CounterpartyType, fromIso: string, toIso: string, limit = 5) {
  return useQuery({
    queryKey: ['treasury', 'top-counterparties', type, fromIso, toIso, limit],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_top_counterparties', {
        p_type: type,
        p_from_date: fromIso,
        p_to_date: toIso,
        p_limit: limit,
      });
      if (error) throw error;
      return data as unknown as TopCounterpartiesResult;
    },
    staleTime: 30_000,
  });
}

// ─── Operations feed (purchases + sales merged) ────────────

export type PurchaseRow = Database['public']['Tables']['usdt_purchases']['Row'] & {
  supplier?: Pick<TreasuryCounterparty, 'id' | 'display_name' | 'phone' | 'wechat_id'> | null;
  xaf_account?: Pick<TreasuryAccount, 'id' | 'code' | 'label'> | null;
};

export type SaleRow = Database['public']['Tables']['usdt_sales']['Row'] & {
  buyer?: Pick<TreasuryCounterparty, 'id' | 'display_name' | 'phone' | 'wechat_id'> | null;
  cny_account?: Pick<TreasuryAccount, 'id' | 'code' | 'label' | 'kind'> | null;
};

export type OperationRow =
  | (PurchaseRow & { kind: 'purchase' })
  | (SaleRow & { kind: 'sale' });

export function useTreasuryOperations(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['treasury', 'operations', fromIso, toIso],
    queryFn: async () => {
      const [purchases, sales] = await Promise.all([
        supabaseAdmin
          .from('usdt_purchases')
          .select('*, supplier:treasury_counterparties!supplier_id(id,display_name,phone,wechat_id), xaf_account:treasury_accounts!xaf_account_id(id,code,label)')
          .gte('occurred_at', fromIso)
          .lte('occurred_at', toIso)
          .order('occurred_at', { ascending: false }),
        supabaseAdmin
          .from('usdt_sales')
          .select('*, buyer:treasury_counterparties!buyer_id(id,display_name,phone,wechat_id), cny_account:treasury_accounts!cny_account_id(id,code,label,kind)')
          .gte('occurred_at', fromIso)
          .lte('occurred_at', toIso)
          .order('occurred_at', { ascending: false }),
      ]);
      if (purchases.error) throw purchases.error;
      if (sales.error) throw sales.error;

      const merged: OperationRow[] = [
        ...((purchases.data ?? []) as PurchaseRow[]).map((p) => ({ ...p, kind: 'purchase' as const })),
        ...((sales.data ?? []) as SaleRow[]).map((s) => ({ ...s, kind: 'sale' as const })),
      ];
      merged.sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
      return merged;
    },
    staleTime: 15_000,
  });
}

// ─── Single operation lookup (for detail / void) ───────────

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: ['treasury', 'purchase', id],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('usdt_purchases')
        .select('*, supplier:treasury_counterparties!supplier_id(*), xaf_account:treasury_accounts!xaf_account_id(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as PurchaseRow | null;
    },
    enabled: !!id,
  });
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: ['treasury', 'sale', id],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('usdt_sales')
        .select('*, buyer:treasury_counterparties!buyer_id(*), cny_account:treasury_accounts!cny_account_id(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as SaleRow | null;
    },
    enabled: !!id,
  });
}

// ─── WAC time series (for chart) ────────────────────────────
// Replays purchases + non-voided sales chronologically and emits
// a WAC point at each event. Computed client-side to avoid an
// extra RPC; trivial for typical Tier 2 volumes.

export interface WacPoint {
  at: string;
  wac: number;
  stock: number;
  event: 'purchase' | 'sale';
}

export function useWacEvolution(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['treasury', 'wac-evolution', fromIso, toIso],
    queryFn: async (): Promise<WacPoint[]> => {
      // Need full history up to `toIso` to compute correct WAC, not just within period.
      const [purchases, sales] = await Promise.all([
        supabaseAdmin
          .from('usdt_purchases')
          .select('occurred_at, xaf_amount, usdt_amount, voided_at')
          .lte('occurred_at', toIso)
          .order('occurred_at', { ascending: true }),
        supabaseAdmin
          .from('usdt_sales')
          .select('occurred_at, usdt_amount, wac_at_sale, voided_at')
          .lte('occurred_at', toIso)
          .order('occurred_at', { ascending: true }),
      ]);
      if (purchases.error) throw purchases.error;
      if (sales.error) throw sales.error;

      const events: { at: string; type: 'purchase' | 'sale'; xafDelta: number; usdtDelta: number }[] = [];
      for (const p of purchases.data ?? []) {
        if (p.voided_at) continue;
        events.push({ at: p.occurred_at, type: 'purchase', xafDelta: Number(p.xaf_amount), usdtDelta: Number(p.usdt_amount) });
      }
      for (const s of sales.data ?? []) {
        if (s.voided_at) continue;
        events.push({
          at: s.occurred_at,
          type: 'sale',
          xafDelta: -(Number(s.usdt_amount) * Number(s.wac_at_sale)),
          usdtDelta: -Number(s.usdt_amount),
        });
      }
      events.sort((a, b) => a.at.localeCompare(b.at));

      let totalXaf = 0;
      let totalUsdt = 0;
      const series: WacPoint[] = [];
      for (const e of events) {
        totalXaf += e.xafDelta;
        totalUsdt += e.usdtDelta;
        const wac = totalUsdt > 0 ? totalXaf / totalUsdt : 0;
        // Only emit points within the requested window.
        if (e.at >= fromIso && e.at <= toIso) {
          series.push({ at: e.at, wac, stock: totalUsdt, event: e.type });
        }
      }
      return series;
    },
    staleTime: 30_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Marché USDT — évolution des prix Binance P2P (table rate_snapshots,
// alimentée par l'edge function monitor-rates toutes les ~15 min).
//   xaf_ask           : coût d'acquisition USDT au Cameroun (VWAP des asks)
//   cny_bid_adjusted  : prix de vente USDT en Chine (VWAP des bids - OTC spread)
//
// On retourne une série brute (un point par snapshot) — le composant graph
// peut ensuite agréger par jour/heure selon la durée affichée.
// ────────────────────────────────────────────────────────────────────────────

export interface MarketRatePoint {
  at: string;
  cost_xaf: number;        // XAF par USDT (achat Cameroun)
  price_cny: number;       // CNY par USDT (vente Chine)
}

export function useMarketRateEvolution(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['treasury', 'market-rate-evolution', fromIso, toIso],
    queryFn: async (): Promise<MarketRatePoint[]> => {
      const { data, error } = await supabaseAdmin
        .from('rate_snapshots')
        .select('created_at, xaf_ask, cny_bid_adjusted')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.created_at && r.xaf_ask != null && r.cny_bid_adjusted != null)
        .map((r) => ({
          at: r.created_at as string,
          cost_xaf: Number(r.xaf_ask),
          price_cny: Number(r.cny_bid_adjusted),
        }));
    },
    staleTime: 30_000,
  });
}
