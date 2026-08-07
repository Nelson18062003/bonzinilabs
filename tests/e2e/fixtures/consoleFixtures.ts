/**
 * Realistic (but entirely synthetic) fixtures for the desktop console
 * screenshot harness.
 *
 * The QA sweep (`desktop-qa.spec.ts`) answers every Supabase call with an empty
 * array, which is what you want for crash-testing but useless for reviewing a
 * design: empty states hide density problems, column widths and number
 * alignment. This module returns a small, coherent, deterministic dataset —
 * same clients across deposits, payments and ledgers — so the captures show the
 * console as an operator actually experiences it.
 *
 * Nothing here touches a real backend, and no real customer data is used.
 */

export const ADMIN_USER = {
  id: '00000000-0000-0000-0000-0000000000a1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'nelson@bonzini.test',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2024-01-01T00:00:00Z',
};

export const SESSION = {
  access_token: 'fixture-access-token',
  refresh_token: 'fixture-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4070908800,
  user: ADMIN_USER,
};

export const ROLE = {
  role: 'super_admin',
  first_name: 'Nelson',
  last_name: 'Eyenga',
  avatar_url: null,
  is_disabled: false,
};

/** Deterministic clock so captures are byte-stable across runs. */
const NOW = Date.parse('2026-08-07T14:20:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const NAMES: [string, string, string][] = [
  ['Aïcha', 'Diallo', '+237 6 55 12 04 88'],
  ['Kwame', 'Mensah', '+237 6 90 44 17 23'],
  ['Fatou', 'Ndiaye', '+237 6 77 81 30 55'],
  ['Ibrahim', 'Touré', '+241 0 66 21 09 14'],
  ['Mariam', 'Koné', '+237 6 99 03 76 41'],
  ['Chinedu', 'Okafor', '+235 6 63 55 20 08'],
  ['Awa', 'Sow', '+236 7 21 66 12 90'],
  ['Serge', 'Nkodo', '+242 0 55 74 38 11'],
  ['Halima', 'Barry', '+237 6 58 92 47 63'],
  ['Yannick', 'Mbarga', '+237 6 71 15 88 29'],
  ['Grace', 'Abena', '+237 6 82 60 33 74'],
  ['Ousmane', 'Traoré', '+237 6 94 27 51 06'],
];

export const CLIENTS = NAMES.map(([first, last, phone], i) => ({
  id: `c-${i}`,
  user_id: `u-${i}`,
  first_name: first,
  last_name: last,
  phone,
  email: `${first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${last.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@example.cm`,
  company_name: i % 3 === 0 ? `${last} Import & Cie` : null,
  avatar_url: null,
  status: 'ACTIVE',
  kyc_verified: i % 4 !== 0,
  country: 'Cameroun',
  city: 'Douala',
  created_at: ago(60 * 24 * (30 + i * 9)),
  updated_at: ago(60 * i),
}));

export const WALLETS = CLIENTS.map((c, i) => ({
  id: `w-${i}`,
  user_id: c.user_id,
  balance_xaf: [12_400_000, 8_150_000, 41_900_000, 2_750_000, 19_300_000, 640_000, 5_820_000, 0, 27_450_000, 1_180_000, 9_060_000, 3_310_000][i],
  created_at: c.created_at,
  updated_at: ago(i * 7),
}));

const DEPOSIT_METHODS = ['bank_transfer', 'agency_cash', 'om_transfer', 'mtn_transfer', 'wave', 'bank_cash'];
const DEPOSIT_STATUSES = [
  'proof_submitted', 'admin_review', 'validated', 'validated', 'proof_submitted',
  'rejected', 'validated', 'admin_review', 'validated', 'proof_submitted', 'validated', 'validated',
  'validated', 'proof_submitted', 'admin_review', 'validated', 'rejected', 'validated',
];

export const DEPOSITS = DEPOSIT_STATUSES.map((status, i) => ({
  id: `d-${i}`,
  reference: `BZ-DP-${2291 + i}`,
  user_id: CLIENTS[i % CLIENTS.length].user_id,
  amount_xaf: [2_500_000, 850_000, 3_400_000, 5_000_000, 1_200_000, 720_000, 14_800_000, 6_350_000, 940_000, 2_100_000, 11_600_000, 480_000, 7_900_000, 1_650_000, 3_050_000, 22_400_000, 610_000, 4_180_000][i],
  method: DEPOSIT_METHODS[i % DEPOSIT_METHODS.length],
  status,
  proof_count: i % 3 === 0 ? 2 : 1,
  admin_comment: null,
  created_at: ago([4, 25, 61, 92, 140, 190, 240, 310, 400, 520, 640, 810, 1_000, 1_260, 1_500, 1_900, 2_400, 3_000][i]),
  updated_at: ago(i * 3),
}));

const PAYMENT_METHODS = ['alipay', 'wechat', 'bank_transfer', 'cash'];
const PAYMENT_STATUSES = [
  'ready_for_payment', 'processing', 'completed', 'completed', 'cash_scanned',
  'waiting_beneficiary_info', 'completed', 'processing', 'ready_for_payment', 'completed',
  'rejected', 'completed', 'processing', 'completed', 'cash_pending', 'completed',
];

export const PAYMENTS = PAYMENT_STATUSES.map((status, i) => ({
  id: `p-${i}`,
  reference: `BZ-PM-${5104 + i}`,
  user_id: CLIENTS[(i + 3) % CLIENTS.length].user_id,
  amount_rmb: [18_400, 6_250, 42_900, 9_800, 3_150, 27_600, 12_050, 5_400, 61_200, 8_750, 2_300, 33_800, 15_900, 7_100, 4_650, 21_400][i],
  amount_xaf: [1_700_000, 578_000, 3_968_000, 906_000, 291_000, 2_553_000, 1_114_000, 499_000, 5_661_000, 809_000, 213_000, 3_126_000, 1_471_000, 657_000, 430_000, 1_980_000][i],
  method: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
  status,
  rate: 92_500,
  proof_count: i % 4 === 0 ? 1 : 0,
  beneficiary_name: ['Guangzhou Yiwu Trading', 'Shenzhen Ludi Electronics', 'Foshan Ceramics Co.', 'Yiwu Beihua Textile'][i % 4],
  created_at: ago([12, 48, 95, 150, 220, 300, 380, 470, 600, 760, 950, 1_150, 1_400, 1_700, 2_100, 2_600][i]),
  updated_at: ago(i * 5),
}));

export const DAILY_RATE = {
  id: 'rate-1',
  rate_cash: 92.0,
  rate_alipay: 92.5,
  rate_wechat: 92.5,
  rate_virement: 93.0,
  is_active: true,
  effective_at: ago(310),
  created_at: ago(310),
};

export const DEPOSIT_STATS = {
  total: 318,
  to_process: 7,
  pending_correction: 2,
  validated: 296,
  rejected: 13,
  today_amount: 18_240_000,
  today_count: 9,
};

export const DASHBOARD_STATS = {
  totalClients: 412,
  activeClients: 268,
  totalWalletBalance: 128_400_000,
  pendingDeposits: 7,
  pendingPayments: 5,
  currentRate: 92.5,
  todayPaymentsAmount: 24_700_000,
  weekVolume: 342_000_000,
};

export const TREASURY_BALANCES = [
  { id: 'ta-1', code: 'UBA', label: 'UBA Cameroun', currency: 'XAF', kind: 'bank', balance: 64_200_000, entry_count: 184, last_entry_at: ago(120), is_active: true, sort_order: 1 },
  { id: 'ta-2', code: 'AFL', label: 'Afriland First Bank', currency: 'XAF', kind: 'bank', balance: 38_950_000, entry_count: 142, last_entry_at: ago(260), is_active: true, sort_order: 2 },
  { id: 'ta-3', code: 'OM', label: 'Orange Money', currency: 'XAF', kind: 'mobile_money', balance: 6_480_000, entry_count: 311, last_entry_at: ago(35), is_active: true, sort_order: 3 },
  { id: 'ta-4', code: 'CASH', label: 'Caisse Douala', currency: 'XAF', kind: 'cash', balance: 2_140_000, entry_count: 96, last_entry_at: ago(410), is_active: true, sort_order: 4 },
  { id: 'ta-5', code: 'BIN', label: 'Pool USDT Binance', currency: 'USDT', kind: 'crypto_pool', balance: 41_820.55, entry_count: 208, last_entry_at: ago(90), is_active: true, sort_order: 5 },
  { id: 'ta-6', code: 'ALI', label: 'Alipay marchand', currency: 'CNY', kind: 'alipay', balance: 186_450.2, entry_count: 264, last_entry_at: ago(55), is_active: true, sort_order: 6 },
  { id: 'ta-7', code: 'WEC', label: 'WeChat Pay', currency: 'CNY', kind: 'wechat', balance: 74_310.8, entry_count: 151, last_entry_at: ago(180), is_active: true, sort_order: 7 },
];

export const AUDIT_LOGS = [
  ['validate_deposit', 'deposit', 'Dépôt BZ-DP-2291 validé — 2 500 000 XAF crédités'],
  ['process_payment', 'payment', 'Paiement BZ-PM-5106 marqué comme effectué'],
  ['set_daily_rate', 'rate', 'Taux du jour publié — Alipay 92,5 XAF/¥'],
  ['create_client', 'client', 'Nouveau client créé — Halima Barry'],
  ['reject_deposit', 'deposit', 'Dépôt BZ-DP-2288 rejeté — preuve illisible'],
  ['record_usdt_purchase', 'treasury', 'Achat 12 000 USDT — 7 428 000 XAF'],
  ['adjust_wallet', 'client', 'Crédit manuel 150 000 XAF — régularisation'],
  ['toggle_admin_status', 'admin', 'Compte administrateur désactivé'],
  ['record_usdt_sale', 'treasury', 'Vente 8 500 USDT → 61 200 CNY'],
  ['update_client', 'client', 'Coordonnées mises à jour — Ibrahim Touré'],
].map(([action_type, target_type, description], i) => ({
  id: `log-${i}`,
  admin_user_id: i % 3 === 0 ? ADMIN_USER.id : `u-admin-${i % 4}`,
  action_type,
  target_type,
  target_id: `t-${i}`,
  description,
  metadata: {},
  created_at: ago(20 + i * 47),
}));

export const ADMIN_ROLES = [
  { id: 'r-0', user_id: ADMIN_USER.id, email: 'nelson@bonzini.test', first_name: 'Nelson', last_name: 'Eyenga', role: 'super_admin', is_disabled: false, created_at: ago(60 * 24 * 640) },
  { id: 'r-1', user_id: 'u-admin-1', email: 'sandrine@bonzini.test', first_name: 'Sandrine', last_name: 'Ateba', role: 'ops', is_disabled: false, created_at: ago(60 * 24 * 380) },
  { id: 'r-2', user_id: 'u-admin-2', email: 'joel@bonzini.test', first_name: 'Joël', last_name: 'Fotso', role: 'treasurer', is_disabled: false, created_at: ago(60 * 24 * 240) },
  { id: 'r-3', user_id: 'u-admin-3', email: 'linda@bonzini.test', first_name: 'Linda', last_name: 'Ngo', role: 'support', is_disabled: false, created_at: ago(60 * 24 * 190) },
  { id: 'r-4', user_id: 'u-admin-4', email: 'patrick@bonzini.test', first_name: 'Patrick', last_name: 'Owona', role: 'cash_agent', is_disabled: false, created_at: ago(60 * 24 * 120) },
  { id: 'r-5', user_id: 'u-admin-5', email: 'clarisse@bonzini.test', first_name: 'Clarisse', last_name: 'Mbia', role: 'customer_success', is_disabled: false, created_at: ago(60 * 24 * 75) },
  { id: 'r-6', user_id: 'u-admin-6', email: 'ancien@bonzini.test', first_name: 'Éric', last_name: 'Mvondo', role: 'ops', is_disabled: true, created_at: ago(60 * 24 * 500) },
];

export const CONVERSATIONS = [
  ['Retard sur mon paiement BZ-PM-5104', 3, 'open'],
  ['Preuve de dépôt refusée', 1, 'open'],
  ['Modifier mon bénéficiaire Alipay', 0, 'open'],
  ['Question sur le taux du jour', 0, 'closed'],
  ['Facture pour ma comptabilité', 2, 'open'],
].map(([subject, unread, status], i) => ({
  id: `conv-${i}`,
  client_user_id: CLIENTS[i].user_id,
  subject,
  status,
  unread_count_admin: unread,
  assigned_admin_id: i % 2 === 0 ? 'r-3' : null,
  last_message_at: ago(15 + i * 90),
  created_at: ago(600 + i * 300),
}));

export const TREASURY_DASHBOARD = {
  balances: TREASURY_BALANCES,
  totals_by_currency: { XAF: 111_770_000, USDT: 41_820.55, CNY: 260_761 },
  purchases: { count: 24, total_xaf: 186_400_000, total_usdt: 301_450, weighted_avg_rate_xaf_per_usdt: 618.34 },
  sales: { count: 31, total_usdt: 289_600, total_cny: 2_063_400, weighted_avg_rate_cny_per_usdt: 7.125 },
  client_rate: { count: 214, total_xaf: 214_800_000, total_cny: 2_312_000, weighted_avg_rate_xaf_per_cny: 92.9 },
  taux_de_revient_xaf_per_cny: 86.78,
  wac_usdt_current: 618.34,
  stock_usdt: 41_820.55,
  is_stock_usdt_negative: false,
  spread_chain_xaf: 6.12,
  spread_client_xaf: 6.12,
  benefit_total_xaf: 14_180_000,
  capital_immobilized_current_xaf: 25_856_000,
};

export const CHAT_STATS = {
  period_days: 7,
  open_conversations: 4,
  closed_conversations: 18,
  unassigned_open: 2,
  total_messages: 214,
  client_messages: 118,
  admin_messages: 96,
  avg_response_seconds_global: 412,
  median_response_seconds_global: 188,
  per_admin: [],
  daily_volume: [],
  response_buckets: { under_1min: 34, one_to_five: 41, five_to_fifteen: 15, over_fifteen: 6 },
};
