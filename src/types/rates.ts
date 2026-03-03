export interface DailyRate {
  id: string;
  rate_cash: number;
  rate_alipay: number;
  rate_wechat: number;
  rate_virement: number;
  effective_at: string;
  created_at: string;
  created_by: string | null;
  is_active: boolean;
}

export interface RateAdjustment {
  id: string;
  type: 'country' | 'tier';
  key: string;
  label: string;
  percentage: number;
  is_reference: boolean;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
}

export type PaymentMethodKey = 'cash' | 'alipay' | 'wechat' | 'virement';

export interface CalculationResult {
  success: boolean;
  error?: string;
  base_rate: number;
  country_adjustment: number;
  tier_adjustment: number;
  tier: string;
  final_rate: number;
  amount_xaf: number;
  amount_cny: number;
  rate_id: string;
}

export const PAYMENT_METHODS = [
  { key: 'cash' as const, label: 'Cash', icon: '\u{1F4B5}', color: '#10b981', chartColor: '#10b981' },
  { key: 'alipay' as const, label: 'Alipay', icon: '\u{1F535}', color: '#1677ff', chartColor: '#3b82f6' },
  { key: 'wechat' as const, label: 'WeChat', icon: '\u{1F7E2}', color: '#07c160', chartColor: '#f59e0b' },
  { key: 'virement' as const, label: 'Virement', icon: '\u{1F3E6}', color: '#8b5cf6', chartColor: '#8b5cf6' },
] as const;

export const COUNTRIES = [
  { key: 'cameroun' as const, label: 'Cameroun', flag: '\u{1F1E8}\u{1F1F2}' },
  { key: 'gabon' as const, label: 'Gabon', flag: '\u{1F1EC}\u{1F1E6}' },
  { key: 'tchad' as const, label: 'Tchad', flag: '\u{1F1F9}\u{1F1E9}' },
  { key: 'rca' as const, label: 'Centrafrique', flag: '\u{1F1E8}\u{1F1EB}' },
  { key: 'congo' as const, label: 'Congo', flag: '\u{1F1E8}\u{1F1EC}' },
  { key: 'guinee' as const, label: 'Guin\u{00E9}e \u{00C9}quatoriale', flag: '\u{1F1EC}\u{1F1F6}' },
] as const;

export const TIERS = [
  { key: 't3' as const, label: '\u{2265} 1 000 000 XAF', shortLabel: '\u{2265}1M', min: 1_000_000 },
  { key: 't2' as const, label: '400 000 \u{2013} 999 999 XAF', shortLabel: '400K\u{2013}999K', min: 400_000 },
  { key: 't1' as const, label: '10 000 \u{2013} 399 999 XAF', shortLabel: '10K\u{2013}399K', min: 10_000 },
] as const;

export const MIN_AMOUNT_XAF = 10_000;
