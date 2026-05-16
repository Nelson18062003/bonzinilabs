import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];
type ChannelXaf = Database['public']['Enums']['treasury_channel_xaf'];
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

interface RecordPurchaseArgs {
  supplier_id: string;
  xaf_account_id: string;
  xaf_amount: number;
  usdt_amount: number;
  channel: ChannelXaf;
  occurred_at?: string;
  external_ref?: string;
  notes?: string;
}

interface PurchaseResult {
  success: boolean;
  error?: string;
  purchase_id?: string;
  implicit_rate?: number;
  new_wac?: number;
}

export function useRecordUsdtPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecordPurchaseArgs) => {
      const { data, error } = await supabaseAdmin.rpc('record_usdt_purchase', {
        p_supplier_id: args.supplier_id,
        p_xaf_account_id: args.xaf_account_id,
        p_xaf_amount: args.xaf_amount,
        p_usdt_amount: args.usdt_amount,
        p_channel: args.channel,
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

// ─── Sales ──────────────────────────────────────────────────

interface RecordSaleArgs {
  buyer_id: string;
  cny_account_id: string;
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
        p_cny_account_id: args.cny_account_id,
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
