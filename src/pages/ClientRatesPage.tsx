import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Sparkline } from '@/mobile/components/ui/Sparkline';
import { ResponsiveRateChart } from '@/components/admin/rates/ResponsiveRateChart';
import { useCountUp } from '@/hooks/useCountUp';
import {
  useCurrentExchangeRate,
  useExchangeRatesForChart,
  useExchangeRates,
  type DateRangeFilter,
} from '@/hooks/useExchangeRates';
import { cn } from '@/lib/utils';
import { formatNumber, formatCompact, formatRelativeDate } from '@/lib/formatters';

export function ClientRatesPage() {
  const queryClient = useQueryClient();

  // ── UI State ──
  const [simulatorMode, setSimulatorMode] = useState<'XAF' | 'CNY'>('XAF');
  const [xafAmount, setXafAmount] = useState<string>('1000000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [swapKey, setSwapKey] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('30d');

  // ── Data hooks ──
  const { data: currentRate, isLoading } = useCurrentExchangeRate();
  const { data: rawChartData } = useExchangeRatesForChart(dateFilter);
  const { data: rates } = useExchangeRates(dateFilter, undefined);

  // Transform chart data for ResponsiveRateChart
  const chartData = useMemo(
    () =>
      rawChartData?.map((rate) => ({
        date: rate.effective_at,
        xaf_to_cny: Math.round(1000000 * rate.rate_xaf_to_rmb),
      })) || [],
    [rawChartData]
  );

  // Sparkline data — last 7 CNY values
  const sparklineData = useMemo(() => {
    if (!rawChartData || rawChartData.length === 0) return [];
    const slice = rawChartData.slice(-7);
    return slice.map((r) => Math.round(1000000 * r.rate_xaf_to_rmb));
  }, [rawChartData]);

  // ── Calculations ──
  const currentRmbToXaf = currentRate ? Math.round(1 / currentRate.rate_xaf_to_rmb) : 86;
  const currentXafToRmb = currentRate?.rate_xaf_to_rmb ?? 0.01163;
  const heroCnyValue = Math.round(1000000 * currentXafToRmb);

  // Animated values
  const animatedCny = useCountUp(heroCnyValue, { enabled: !isLoading });
  const animatedRmbToXaf = useCountUp(currentRmbToXaf, { enabled: !isLoading });

  // Simulator animated output
  const simulatorOutputRaw = useMemo(() => {
    if (simulatorMode === 'XAF') {
      const xaf = parseInt(xafAmount);
      return isNaN(xaf) ? 0 : Math.round(xaf * currentXafToRmb);
    } else {
      const rmb = parseFloat(rmbAmount);
      return isNaN(rmb) ? 0 : Math.round(rmb / currentXafToRmb);
    }
  }, [simulatorMode, xafAmount, rmbAmount, currentXafToRmb]);
  const animatedOutput = useCountUp(simulatorOutputRaw, { enabled: true });

  // Variation logic
  const variation = useMemo(() => {
    if (!rates || rates.length < 2 || !currentRate) return null;
    const prev = rates[1];
    const prevCny = Math.round(1000000 * prev.rate_xaf_to_rmb);
    const diff = heroCnyValue - prevCny;
    const percent = prevCny !== 0 ? (diff / prevCny) * 100 : 0;
    return { diff, percent };
  }, [rates, currentRate, heroCnyValue]);

  // ── Converter logic ──
  const convertXafToRmb = (xaf: number) => Math.round(xaf * currentXafToRmb);
  const convertRmbToXaf = (rmb: number) => Math.round(rmb / currentXafToRmb);

  const handleXafChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    setXafAmount(clean);
    if (clean && !isNaN(Number(clean))) {
      setRmbAmount(convertXafToRmb(Number(clean)).toString());
    } else {
      setRmbAmount('');
    }
  };

  const handleRmbChange = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '');
    setRmbAmount(clean);
    if (clean && !isNaN(Number(clean))) {
      setXafAmount(convertRmbToXaf(Number(clean)).toString());
    } else {
      setXafAmount('');
    }
  };

  const handleSwap = () => {
    setSimulatorMode((m) => (m === 'XAF' ? 'CNY' : 'XAF'));
    setSwapKey((k) => k + 1);
  };

  // Initialize converter on rate change
  useEffect(() => {
    if (xafAmount && !isNaN(Number(xafAmount))) {
      setRmbAmount(convertXafToRmb(Number(xafAmount)).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentXafToRmb]);

  // Quick chip amounts
  const XAF_CHIPS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000];
  const CNY_CHIPS = [1_000, 5_000, 10_000, 20_000];

  const handleQuickChip = (amount: number) => {
    if (simulatorMode === 'XAF') {
      handleXafChange(amount.toString());
    } else {
      handleRmbChange(amount.toString());
    }
  };

  // ── LOADING ──
  if (isLoading) {
    return (
      <MobileLayout>
        <PageHeader title="Taux de change" showBack />
        <div className="space-y-5 pb-24">
          <div className="card-glass p-5 animate-pulse">
            <div className="h-3 w-16 bg-muted-foreground/10 rounded mb-4" />
            <div className="h-8 w-48 bg-muted-foreground/10 rounded mb-3" />
            <div className="h-4 w-32 bg-muted-foreground/10 rounded" />
          </div>
          <div className="card-glass p-5 animate-pulse space-y-3">
            <div className="h-10 bg-muted-foreground/10 rounded-lg" />
            <div className="h-14 bg-muted-foreground/10 rounded-xl" />
            <div className="h-14 bg-muted-foreground/10 rounded-xl" />
          </div>
          <div className="card-glass p-4 animate-pulse">
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-1 h-8 bg-muted-foreground/10 rounded-md" />
              ))}
            </div>
            <div className="h-[200px] bg-muted-foreground/10 rounded" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader title="Taux de change" showBack />

      <div className="space-y-5 pb-24">
        {/* ═══════════════════════════════════════════════
            A. HERO "LIQUID GLASS" RATE CARD
            ═══════════════════════════════════════════════ */}
        <div
          className={cn(
            'card-glass p-5',
            'border border-primary/15',
            'shadow-[0_0_30px_-10px_hsl(var(--primary)/0.15)]',
            'animate-kpi-entrance'
          )}
          style={{ animationFillMode: 'both' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">
                XAF → CNY
              </p>
              <p
                className="text-2xl sm:text-3xl font-bold tracking-tight mt-2"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatNumber(1_000_000)} XAF = {formatNumber(animatedCny)}{' '}
                <span className="text-sm font-medium text-muted-foreground">CNY</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                1 CNY = {formatNumber(animatedRmbToXaf)} XAF
              </p>
            </div>
            {sparklineData.length >= 2 && (
              <Sparkline
                data={sparklineData}
                width={80}
                height={28}
                color="hsl(var(--primary))"
              />
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
            {currentRate && (
              <span className="text-xs text-muted-foreground/60">
                {formatRelativeDate(currentRate.effective_at)}
              </span>
            )}
            {variation && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  variation.percent > 0
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : variation.percent < 0
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {variation.percent > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : variation.percent < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                {variation.percent > 0 ? '+' : ''}
                {formatNumber(variation.percent, 1)}%
                <span className="text-muted-foreground/60 font-normal ml-0.5">(30j)</span>
              </span>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            B. SIMULATOR CARD — "Binance-style"
            ═══════════════════════════════════════════════ */}
        <div
          className="card-glass p-5 animate-slide-up"
          style={{ animationDelay: '80ms', animationFillMode: 'both' }}
        >
          {/* Segment Control */}
          <div className="bg-muted rounded-lg p-1 flex mb-4">
            <button
              onClick={() => setSimulatorMode('XAF')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                simulatorMode === 'XAF'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              Par XAF
            </button>
            <button
              onClick={() => setSimulatorMode('CNY')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                simulatorMode === 'CNY'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              Par CNY
            </button>
          </div>

          {/* Input — "Vous envoyez" */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
              Vous envoyez
            </p>
            <div className="flex items-baseline gap-2">
              <input
                type="text"
                inputMode={simulatorMode === 'CNY' ? 'decimal' : 'numeric'}
                value={
                  simulatorMode === 'XAF'
                    ? xafAmount
                      ? formatNumber(parseInt(xafAmount))
                      : ''
                    : rmbAmount
                      ? formatNumber(parseFloat(rmbAmount))
                      : ''
                }
                onChange={(e) => {
                  if (simulatorMode === 'XAF') {
                    handleXafChange(e.target.value.replace(/\D/g, ''));
                  } else {
                    handleRmbChange(e.target.value.replace(/[^0-9.]/g, ''));
                  }
                }}
                placeholder={simulatorMode === 'XAF' ? '1 000 000' : '11 670'}
                className={cn(
                  'flex-1 text-2xl font-bold bg-transparent',
                  'border-b-2 border-border/50 focus:border-primary',
                  'py-2 outline-none transition-colors',
                )}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {simulatorMode === 'XAF' ? 'XAF' : 'CNY'}
              </span>
            </div>
          </div>

          {/* Swap button */}
          <div className="flex justify-center my-3">
            <button
              key={swapKey}
              onClick={handleSwap}
              className={cn(
                'w-10 h-10 rounded-full bg-primary/10',
                'flex items-center justify-center',
                'active:scale-90 transition-transform'
              )}
              style={{
                animation: swapKey > 0 ? 'springSwap 0.5s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
              }}
            >
              <ArrowUpDown className="w-5 h-5 text-primary" />
            </button>
          </div>

          {/* Output — "Vous recevez" */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
              Vous recevez
            </p>
            <div className="flex items-baseline gap-2">
              <p
                className="flex-1 text-2xl font-bold text-primary py-2"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatNumber(animatedOutput)}
              </p>
              <span className="text-sm font-medium text-muted-foreground">
                {simulatorMode === 'XAF' ? 'CNY' : 'XAF'}
              </span>
            </div>
          </div>

          {/* Quick chips */}
          <div
            className={cn(
              'mt-4',
              simulatorMode === 'XAF' ? 'grid grid-cols-5 gap-2' : 'grid grid-cols-4 gap-2'
            )}
          >
            {(simulatorMode === 'XAF' ? XAF_CHIPS : CNY_CHIPS).map((amount) => (
              <button
                key={amount}
                onClick={() => handleQuickChip(amount)}
                className={cn(
                  'h-9 rounded-xl text-xs font-medium transition-all',
                  'bg-muted/60 hover:bg-muted active:scale-95',
                  simulatorMode === 'XAF' && parseInt(xafAmount) === amount && 'bg-primary/10 text-primary ring-1 ring-primary/20',
                  simulatorMode === 'CNY' && parseFloat(rmbAmount) === amount && 'bg-primary/10 text-primary ring-1 ring-primary/20',
                )}
              >
                {simulatorMode === 'CNY' ? '¥' : ''}{formatCompact(amount)}
              </button>
            ))}
          </div>

          {/* Trust line */}
          <p className="text-xs text-muted-foreground/60 text-center mt-4 italic">
            Taux appliqué au moment du paiement
          </p>
        </div>

        {/* ═══════════════════════════════════════════════
            C. TREND PREVIEW CARD
            ═══════════════════════════════════════════════ */}
        <div
          className="card-glass p-4 animate-slide-up"
          style={{ animationDelay: '140ms', animationFillMode: 'both' }}
        >
          <p className="text-sm font-semibold mb-3">Tendance du taux</p>
          <ResponsiveRateChart
            data={chartData}
            activePeriod={dateFilter}
            onPeriodChange={setDateFilter}
          />
        </div>

        {/* ═══════════════════════════════════════════════
            D. GAMIFICATION MICRO-CARD
            ═══════════════════════════════════════════════ */}
        <div
          className={cn(
            'bg-gradient-to-r from-primary/5 to-primary/10',
            'rounded-2xl border border-primary/10 p-4',
            'animate-fade-in'
          )}
          style={{ animationDelay: '200ms', animationFillMode: 'both' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Suivez les taux en temps réel</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Les taux sont mis à jour chaque matin pour vous offrir le meilleur cours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
