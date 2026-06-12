// DEV-ONLY screenshot fixtures for the Taux module. Aliased over
// `@/hooks/useDailyRates` only when SCREENSHOT_MOCK=1 (see vite.config.ts),
// so the harness can render the real MobileRatesScreen with believable data
// (active rate + adjustments + history) without a Supabase session.
// Never bundled in production. tsc/ESLint still type-check consumers against
// the REAL hook module (tsconfig paths), so this file only needs to be valid
// standalone TS and export the same names.
import type { DailyRate, RateAdjustment, CalculationResult } from '@/types/rates';

export type ChartPeriod = '7d' | '30d' | '3m' | '1y';

const now = new Date();
const iso = (daysAgo: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

const ACTIVE_RATE: DailyRate = {
  id: 'rate-active',
  rate_cash: 11530,
  rate_alipay: 11480,
  rate_wechat: 11350,
  rate_virement: 11200,
  effective_at: iso(0),
  created_at: iso(0),
  created_by: null,
  is_active: true,
};

const HISTORY: DailyRate[] = [
  ACTIVE_RATE,
  { id: 'r1', rate_cash: 11510, rate_alipay: 11460, rate_wechat: 11330, rate_virement: 11180, effective_at: iso(1), created_at: iso(1), created_by: null, is_active: false },
  { id: 'r2', rate_cash: 11490, rate_alipay: 11440, rate_wechat: 11310, rate_virement: 11160, effective_at: iso(2), created_at: iso(2), created_by: null, is_active: false },
  { id: 'r3', rate_cash: 11470, rate_alipay: 11420, rate_wechat: 11290, rate_virement: 11140, effective_at: iso(3), created_at: iso(3), created_by: null, is_active: false },
  { id: 'r4', rate_cash: 11450, rate_alipay: 11400, rate_wechat: 11270, rate_virement: 11120, effective_at: iso(5), created_at: iso(5), created_by: null, is_active: false },
];

const ADJUSTMENTS: RateAdjustment[] = [
  { id: 'c1', type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true, sort_order: 0, updated_at: iso(0), updated_by: null },
  { id: 'c2', type: 'country', key: 'gabon', label: 'Gabon', percentage: -0.5, is_reference: false, sort_order: 1, updated_at: iso(0), updated_by: null },
  { id: 'c3', type: 'country', key: 'tchad', label: 'Tchad', percentage: -1, is_reference: false, sort_order: 2, updated_at: iso(0), updated_by: null },
  { id: 'c4', type: 'country', key: 'rca', label: 'Centrafrique', percentage: -1.5, is_reference: false, sort_order: 3, updated_at: iso(0), updated_by: null },
  { id: 'c5', type: 'country', key: 'congo', label: 'Congo', percentage: -0.8, is_reference: false, sort_order: 4, updated_at: iso(0), updated_by: null },
  { id: 'c6', type: 'country', key: 'guinee', label: 'Guinée Équatoriale', percentage: -1.2, is_reference: false, sort_order: 5, updated_at: iso(0), updated_by: null },
  { id: 't3', type: 'tier', key: 't3', label: '≥ 1 000 000 XAF', percentage: 0, is_reference: true, sort_order: 0, updated_at: iso(0), updated_by: null },
  { id: 't2', type: 'tier', key: 't2', label: '400 000 – 999 999 XAF', percentage: -1, is_reference: false, sort_order: 1, updated_at: iso(0), updated_by: null },
  { id: 't1', type: 'tier', key: 't1', label: '10 000 – 399 999 XAF', percentage: -2, is_reference: false, sort_order: 2, updated_at: iso(0), updated_by: null },
];

function query<T>(data: T) {
  return { data, isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {} };
}

function mutation<T>(fixture: T) {
  return {
    mutate: () => {},
    mutateAsync: async () => fixture,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: () => {},
    data: undefined as T | undefined,
  };
}

export function useActiveDailyRate() {
  return query<DailyRate | null>(ACTIVE_RATE);
}

export function useDailyRatesHistory(limit = 20) {
  return query<DailyRate[]>(HISTORY.slice(0, limit));
}

export function useDailyRatesForChart(_period: ChartPeriod) {
  return query<DailyRate[]>([...HISTORY].reverse());
}

export function useCreateDailyRates() {
  return mutation<{ success: boolean; rate_id?: string }>({ success: true, rate_id: 'rate-active' });
}

export function useRateAdjustments() {
  return query<RateAdjustment[]>(ADJUSTMENTS);
}

export function useUpdateRateAdjustment() {
  return mutation<{ success: boolean; key?: string; percentage?: number }>({ success: true });
}

export function useClientRates() {
  return query<{ activeRate: DailyRate | null; adjustments: RateAdjustment[] }>({
    activeRate: ACTIVE_RATE,
    adjustments: ADJUSTMENTS,
  });
}

export function useClientRatesChart(_period: ChartPeriod) {
  return query<Pick<DailyRate, 'id' | 'rate_cash' | 'effective_at'>[]>(
    [...HISTORY].reverse().map((r) => ({ id: r.id, rate_cash: r.rate_cash, effective_at: r.effective_at })),
  );
}

export function useCalculateRate() {
  return mutation<CalculationResult>({
    success: true,
    base_rate: 11530,
    country_adjustment: 0,
    tier_adjustment: 0,
    tier: 't3',
    final_rate: 11530,
    amount_xaf: 1_000_000,
    amount_cny: 11530,
    rate_id: 'rate-active',
  });
}
