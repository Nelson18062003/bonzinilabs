// ============================================================
// Centrale d'achat — couche d'accès typée (data layer)
//
// POURQUOI CE FICHIER EXISTE : on construit l'UI procurement AVANT
// de déployer les migrations. Les types `proc_*` n'arriveront dans
// `types.ts` qu'après `gen-types` (post-déploiement). En attendant,
// ce module porte les types à la main + des wrappers RPC typés.
//
// Le SEUL endroit non typé est `callProcRpc` (cast de `rpc`), car
// le client est `SupabaseClient<Database>` et ne connaît pas encore
// les fonctions `proc_*`. Tout le reste de l'app reste 100% typé.
// Quand les types seront régénérés, ces wrappers continueront de
// fonctionner tels quels (le cast reste inoffensif).
//
// Convention (.claude/rules/supabase-clients.md) : module ADMIN →
// TOUJOURS `supabaseAdmin`.
// ============================================================
import { supabaseAdmin } from './client';

// ── Enums (miroir des types SQL proc_*) ──
export type ProcCurrency = 'CNY' | 'XAF';
export type ProcSupplierKind = 'factory' | 'trading_company' | 'unknown';
export type ProcVerificationStatus = 'unverified' | 'docs_seen' | 'visited' | 'audited';
export type ProcMissionStatus = 'active' | 'closed' | 'archived';
export type ProcIncoterm =
  | 'EXW' | 'FCA' | 'FAS' | 'FOB' | 'CFR' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';
export type ProcPoStatus = 'open' | 'closed' | 'cancelled';
export type ProcPaymentLeg = 'deposit' | 'balance' | 'final' | 'extra';
export type ProcPaymentMethod = 'cash' | 'alipay' | 'wechat' | 'bank_transfer' | 'other';
export type ProcSettlementMode = 'attestation' | 'rail';
export type ProcPaidBy = 'client_direct' | 'father_onsite' | 'bonzini';
export type ProcProductionStatus =
  | 'po_confirmed' | 'materials_purchased' | 'in_production' | 'production_done' | 'ready_for_qc' | 'shipped';
export type ProcQcType = 'PPI' | 'DUPRO' | 'PSI' | 'loading';
export type ProcQcInspectorKind = 'internal' | 'third_party';
export type ProcQcResult = 'pass' | 'fail' | 'conditional';
export type ProcCommissionMode = 'percentage' | 'fixed_amount';
export type ProcDocumentEntity =
  | 'mission' | 'supplier' | 'purchase_order' | 'supplier_payment' | 'qc' | 'order_line';
export type ProcDocumentType =
  | 'invoice_photo' | 'payment_receipt' | 'pi' | 'contract' | 'qc_report'
  | 'packing_list' | 'bill_of_lading' | 'wechat_screenshot' | 'product_photo' | 'other';
export type ProcUploadedByKind = 'father' | 'admin' | 'client';
export type ProcExpenseCategory = 'hotel' | 'transport' | 'driver' | 'meals' | 'other';

/** Toutes les RPC renvoient ce contrat (jsonb_build_object 'success' …). */
export type ProcResult<T> = ({ success: true } & T) | { success: false; error: string };

/** Montants par devise (clé = code devise). */
export type ByCurrency = Partial<Record<ProcCurrency, number>>;

// ── Shapes de lecture ──
export interface ProcClientHeader {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  kyc_verified: boolean | null;
}

export interface ProcOrderLine {
  id: string;
  description: string;
  specs: Record<string, unknown>;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  moq: number | null;
  lead_time_days: number | null;
  hs_code: string | null;
}

export interface ProcPaymentRead {
  id: string;
  reference: string;
  leg: ProcPaymentLeg;
  amount: number;
  currency: ProcCurrency;
  method: ProcPaymentMethod;
  occurred_at: string;
  settlement_mode: ProcSettlementMode;
  rail_payment_id: string | null;
  paid_by: ProcPaidBy | null;
  external_ref: string | null;
}

export interface ProcQcRead {
  id: string;
  inspection_type: ProcQcType;
  inspector_kind: ProcQcInspectorKind;
  inspector_name: string | null;
  aql_level: string | null;
  result: ProcQcResult;
  occurred_at: string;
}

export interface ProcCommissionRead {
  id: string;
  input_mode: ProcCommissionMode;
  input_value: number;
  base_amount?: number;
  computed_amount: number | null;
  computed_pct: number | null;
  currency: ProcCurrency;
  client_visible: boolean;
  notes?: string | null;
}

export interface ProcReportPurchaseOrder {
  purchase_order_id: string;
  reference: string;
  currency: ProcCurrency;
  total_amount: number;
  deposit_pct: number;
  incoterm: ProcIncoterm | null;
  status: ProcPoStatus;
  expected_ready_date: string | null;
  total_cbm: number | null;
  notes: string | null;
  order_lines: ProcOrderLine[];
  payments: ProcPaymentRead[];
  qc: ProcQcRead[];
  production_status: ProcProductionStatus | null;
  commission: ProcCommissionRead | null;
  paid_amount: number;
  outstanding_amount: number;
}

export interface ProcReportSupplier {
  supplier_id: string;
  display_name: string;
  supplier_kind: ProcSupplierKind;
  verification_status: ProcVerificationStatus;
  city: string | null;
  province: string | null;
  wechat_id: string | null;
  phone: string | null;
  purchase_orders: ProcReportPurchaseOrder[];
}

export interface ProcExpenseRead {
  id: string;
  category: ProcExpenseCategory;
  amount: number;
  currency: ProcCurrency;
  occurred_at: string;
  billable_to_client: boolean;
  notes: string | null;
}

export interface ProcMissionReport {
  mission: {
    id: string;
    reference: string;
    label: string;
    location: string | null;
    started_on: string | null;
    ended_on: string | null;
    status: ProcMissionStatus;
    summary_note: string | null;
    created_at: string;
    client: ProcClientHeader;
  };
  suppliers: ProcReportSupplier[];
  mission_commissions: ProcCommissionRead[];
  expenses: ProcExpenseRead[];
  totals: {
    ordered_by_currency: ByCurrency;
    paid_by_currency: ByCurrency;
    outstanding_by_currency: ByCurrency;
    expenses_by_currency: ByCurrency;
    commission_by_currency: ByCurrency;
  };
  generated_at: string;
}

export interface ProcOutstandingRow {
  purchase_order_id: string;
  reference: string;
  mission_id: string;
  mission_reference: string;
  mission_label: string;
  supplier_id: string;
  supplier_name: string;
  currency: ProcCurrency;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: ProcPoStatus;
}

export interface ProcMissionSummary {
  id: string;
  reference: string;
  label: string;
  location: string | null;
  started_on: string | null;
  client_user_id: string;
}

export interface ProcDashboard {
  active_missions: ProcMissionSummary[];
  active_mission_count: number;
  outstanding_by_currency: ByCurrency;
  alerts: {
    balance_without_qc_pass: Array<{
      purchase_order_id: string; reference: string; supplier_name: string; mission_reference: string;
    }>;
    production_overdue: Array<{
      purchase_order_id: string; reference: string; supplier_name: string;
      expected_ready_date: string | null; mission_reference: string;
    }>;
  };
  recent_payments: Array<{
    id: string; reference: string; amount: number; currency: ProcCurrency; leg: ProcPaymentLeg;
    method: ProcPaymentMethod; occurred_at: string; po_reference: string; supplier_name: string;
  }>;
}

export interface ProcSupplierRecord {
  id: string;
  display_name: string;
  legal_name: string | null;
  supplier_kind: ProcSupplierKind;
  category: string[];
  city: string | null;
  province: string | null;
  address: string | null;
  wechat_id: string | null;
  phone: string | null;
  email: string | null;
  verification_status: ProcVerificationStatus;
  verification_notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProcSupplier360 {
  supplier: ProcSupplierRecord;
  purchase_orders: Array<{
    purchase_order_id: string; reference: string; mission_id: string; mission_reference: string;
    mission_label: string; currency: ProcCurrency; total_amount: number; status: ProcPoStatus;
    paid_amount: number | null; outstanding_amount: number | null; expected_ready_date: string | null;
    created_at: string;
  }>;
  totals: {
    purchase_order_count: number;
    mission_count: number;
    ordered_by_currency: ByCurrency;
    outstanding_by_currency: ByCurrency;
  };
}

// ── Le seul point de jonction non typé (cast de rpc) ──
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

async function callProcRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<ProcResult<T>> {
  const rpc = supabaseAdmin.rpc as unknown as RpcFn;
  const { data, error } = await rpc(fn, args);
  if (error) return { success: false, error: error.message };
  if (!data || typeof data !== 'object') return { success: false, error: 'Réponse vide du serveur' };
  return data as ProcResult<T>;
}

// ── API typée (1 méthode par RPC ; clés p_* identiques au SQL) ──
export const proc = {
  // Écriture
  createMission: (a: {
    p_client_user_id: string; p_label: string; p_location?: string | null;
    p_started_on?: string | null; p_ended_on?: string | null; p_summary_note?: string | null;
  }) => callProcRpc<{ mission_id: string; reference: string }>('proc_create_mission', a),

  updateMission: (a: {
    p_mission_id: string; p_label?: string | null; p_location?: string | null;
    p_started_on?: string | null; p_ended_on?: string | null;
    p_status?: ProcMissionStatus | null; p_summary_note?: string | null;
  }) => callProcRpc<{ mission_id: string }>('proc_update_mission', a),

  upsertSupplier: (a: {
    p_display_name: string; p_id?: string | null; p_legal_name?: string | null;
    p_supplier_kind?: ProcSupplierKind; p_category?: string[] | null; p_city?: string | null;
    p_province?: string | null; p_address?: string | null; p_wechat_id?: string | null;
    p_phone?: string | null; p_email?: string | null;
    p_verification_status?: ProcVerificationStatus | null; p_verification_notes?: string | null;
  }) => callProcRpc<{ supplier_id: string; created: boolean }>('proc_upsert_supplier', a),

  createPurchaseOrder: (a: {
    p_mission_id: string; p_supplier_id: string; p_currency?: ProcCurrency;
    p_total_amount?: number; p_deposit_pct?: number; p_incoterm?: ProcIncoterm | null;
    p_expected_ready_date?: string | null; p_total_cbm?: number | null; p_notes?: string | null;
  }) => callProcRpc<{ purchase_order_id: string; reference: string }>('proc_create_purchase_order', a),

  updatePurchaseOrder: (a: {
    p_purchase_order_id: string; p_total_amount?: number | null; p_deposit_pct?: number | null;
    p_incoterm?: ProcIncoterm | null; p_status?: ProcPoStatus | null;
    p_expected_ready_date?: string | null; p_total_cbm?: number | null; p_notes?: string | null;
  }) => callProcRpc<{ purchase_order_id: string }>('proc_update_purchase_order', a),

  addOrderLine: (a: {
    p_purchase_order_id: string; p_description: string; p_quantity?: number; p_unit?: string | null;
    p_unit_price?: number; p_specs?: Record<string, unknown>; p_moq?: number | null;
    p_lead_time_days?: number | null; p_hs_code?: string | null;
  }) => callProcRpc<{ order_line_id: string }>('proc_add_order_line', a),

  recordSupplierPayment: (a: {
    p_purchase_order_id: string; p_leg: ProcPaymentLeg; p_amount: number; p_method: ProcPaymentMethod;
    p_occurred_at?: string; p_currency?: ProcCurrency; p_settlement_mode?: ProcSettlementMode;
    p_rail_payment_id?: string | null; p_paid_by?: ProcPaidBy | null;
    p_external_ref?: string | null; p_notes?: string | null;
  }) => callProcRpc<{
    payment_id: string; reference: string; outstanding_after: number; warning_no_qc_pass: boolean;
  }>('proc_record_supplier_payment', a),

  setCommission: (a: {
    p_mission_id: string; p_input_mode: ProcCommissionMode; p_input_value: number;
    p_purchase_order_id?: string | null; p_base_amount?: number; p_factory_cost?: number | null;
    p_client_price?: number | null; p_negotiated_discount?: number | null;
    p_client_visible?: boolean; p_currency?: ProcCurrency; p_notes?: string | null;
  }) => callProcRpc<{ commission_id: string; computed_amount: number | null; computed_pct: number | null }>(
    'proc_set_commission', a),

  attachDocument: (a: {
    p_entity_type: ProcDocumentEntity; p_entity_id: string; p_file_url: string;
    p_doc_type?: ProcDocumentType; p_file_name?: string | null; p_file_type?: string | null;
    p_caption?: string | null; p_uploaded_by_kind?: ProcUploadedByKind | null;
  }) => callProcRpc<{ document_id: string }>('proc_attach_document', a),

  recordQc: (a: {
    p_purchase_order_id: string; p_inspection_type: ProcQcType; p_inspector_kind: ProcQcInspectorKind;
    p_result: ProcQcResult; p_occurred_at?: string; p_inspector_name?: string | null;
    p_aql_level?: string | null; p_defects?: Record<string, unknown>;
    p_report_document_id?: string | null; p_notes?: string | null;
  }) => callProcRpc<{ qc_id: string; result: ProcQcResult }>('proc_record_qc', a),

  logProductionEvent: (a: {
    p_purchase_order_id: string; p_status: ProcProductionStatus; p_occurred_at?: string;
    p_note?: string | null; p_evidence_document_id?: string | null;
  }) => callProcRpc<{ event_id: string; status: ProcProductionStatus }>('proc_log_production_event', a),

  recordExpense: (a: {
    p_mission_id: string; p_category: ProcExpenseCategory; p_amount: number; p_occurred_at?: string;
    p_currency?: ProcCurrency; p_billable_to_client?: boolean; p_receipt_document_id?: string | null;
    p_notes?: string | null;
  }) => callProcRpc<{ expense_id: string }>('proc_record_expense', a),

  voidRecord: (a: { p_record_kind: 'supplier_payment' | 'qc' | 'expense'; p_id: string; p_reason: string }) =>
    callProcRpc<{ record_kind: string; id: string }>('proc_void_record', a),

  // Lecture
  outstandingBalances: (a: { p_mission_id?: string | null } = {}) =>
    callProcRpc<{ rows: ProcOutstandingRow[]; outstanding_by_currency: ByCurrency }>(
      'proc_outstanding_balances', a),

  supplier360: (a: { p_supplier_id: string }) =>
    callProcRpc<ProcSupplier360>('proc_supplier_360', a),

  missionReport: (a: { p_mission_id: string }) =>
    callProcRpc<ProcMissionReport>('proc_mission_report', a),

  dashboard: (a: { p_client_user_id?: string | null } = {}) =>
    callProcRpc<ProcDashboard>('proc_procurement_dashboard', a),
};
