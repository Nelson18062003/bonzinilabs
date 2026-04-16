import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { Sparkline } from '@/mobile/components/ui/Sparkline';
import { useCountUp } from '@/hooks/useCountUp';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  CalendarIcon,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { GlassCalendar } from '@/mobile/components/ui/GlassCalendar';
import { ResponsiveRateChart } from '@/components/admin/rates/ResponsiveRateChart';
import {
  useExchangeRates,
  useExchangeRatesForChart,
  useCurrentExchangeRate,
  useAddExchangeRate,
  useUpdateExchangeRate,
  useDeleteExchangeRate,
  useCheckRateUsage,
  type DateRangeFilter,
} from '@/hooks/useExchangeRates';
import { cn } from '@/lib/utils';
import { formatNumber, formatCompact, formatCurrencyRMB, formatRelativeDate } from '@/lib/formatters';
import { toast } from 'sonner';

export function MobileRatesScreen() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  // ── UI State ──
  const [simulatorMode, setSimulatorMode] = useState<'XAF' | 'CNY'>('XAF');
  const [xafAmount, setXafAmount] = useState<string>('1000000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [swapKey, setSwapKey] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('30d');

  // Form drawer state
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRate, setEditingRate] = useState<{
    id: string;
    rateRmbToXaf: number;
    effectiveAt: Date;
  } | null>(null);
  const [formRate, setFormRate] = useState<string>('');
  const [formInputMode, setFormInputMode] = useState<'cnyToXaf' | 'xafToCny'>('cnyToXaf');
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formTime, setFormTime] = useState<string>(format(new Date(), 'HH:mm'));
  const [datePreset, setDatePreset] = useState<'now' | 'today' | 'yesterday' | 'custom'>('now');

  // Delete drawer state
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<string | null>(null);

  // ── Data hooks ──
  const { data: rates, isLoading } = useExchangeRates(dateFilter, undefined);
  const { data: rawChartData } = useExchangeRatesForChart(dateFilter, undefined);
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: rateUsage } = useCheckRateUsage(rateToDelete || undefined);

  // Transform chart data
  const chartData = useMemo(
    () =>
      rawChartData?.map((rate) => ({
        date: rate.effective_at,
        xaf_to_cny: Math.round(1000000 * rate.rate_xaf_to_rmb),
      })) || [],
    [rawChartData]
  );

  // Sparkline data — last 7 CNY values for hero card
  const sparklineData = useMemo(() => {
    if (!rawChartData || rawChartData.length === 0) return [];
    // rawChartData is oldest→newest; take last 7 points
    const slice = rawChartData.slice(-7);
    return slice.map((r) => Math.round(1000000 * r.rate_xaf_to_rmb));
  }, [rawChartData]);

  // Mutation hooks
  const addRate = useAddExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const deleteRate = useDeleteExchangeRate();

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

  // ── Date/time helpers ──
  const handleDatePreset = (preset: 'now' | 'today' | 'yesterday') => {
    const now = new Date();
    setDatePreset(preset);
    if (preset === 'now') {
      setFormDate(now);
      setFormTime(format(now, 'HH:mm'));
    } else if (preset === 'today') {
      setFormDate(now);
      setFormTime('00:00');
    } else if (preset === 'yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      setFormDate(d);
      setFormTime('00:00');
    }
  };

  const adjustTime = (unit: 'h' | 'm', delta: number) => {
    const [h, m] = formTime.split(':').map(Number);
    if (unit === 'h') {
      const newH = ((h + delta + 24) % 24).toString().padStart(2, '0');
      setFormTime(`${newH}:${m.toString().padStart(2, '0')}`);
    } else {
      const newM = ((m + delta + 60) % 60).toString().padStart(2, '0');
      setFormTime(`${h.toString().padStart(2, '0')}:${newM}`);
    }
  };

  // ── Form handlers ──
  const handleCreateRate = () => {
    setFormMode('create');
    setEditingRate(null);
    setFormRate('');
    setFormInputMode('cnyToXaf');
    setFormDate(new Date());
    setFormTime(format(new Date(), 'HH:mm'));
    setDatePreset('now');
    setFormDrawerOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditRate = (rate: any) => {
    const rmbToXaf = Math.round(1 / rate.rate_xaf_to_rmb);
    setFormMode('edit');
    setEditingRate({
      id: rate.id,
      rateRmbToXaf: rmbToXaf,
      effectiveAt: parseISO(rate.effective_at),
    });
    setFormRate(rmbToXaf.toString());
    setFormInputMode('cnyToXaf');
    setFormDate(parseISO(rate.effective_at));
    setFormTime(format(parseISO(rate.effective_at), 'HH:mm'));
    setDatePreset('custom');
    setFormDrawerOpen(true);
  };

  const handleDeleteClick = (rateId: string) => {
    setRateToDelete(rateId);
    setDeleteDrawerOpen(true);
  };

  const handleFormSubmit = async () => {
    if (computedRateRmbToXaf === null) return;

    const [hours, minutes] = formTime.split(':').map(Number);
    const effectiveAt = new Date(formDate);
    effectiveAt.setHours(hours, minutes, 0, 0);

    try {
      if (formMode === 'create') {
        await addRate.mutateAsync({ rateRmbToXaf: computedRateRmbToXaf, effectiveAt });
        toast.success(t('rateCreated', { defaultValue: 'Taux créé' }));
      } else if (editingRate) {
        await updateRate.mutateAsync({
          rateId: editingRate.id,
          rateRmbToXaf: computedRateRmbToXaf,
          effectiveAt,
        });
        toast.success(t('rateModified', { defaultValue: 'Taux modifié' }));
      }
      setFormDrawerOpen(false);
      setEditingRate(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteConfirm = async () => {
    if (rateToDelete) {
      try {
        await deleteRate.mutateAsync(rateToDelete);
        toast.success(t('rateDeleted', { defaultValue: 'Taux supprimé' }));
      } catch {
        // Error handled by mutation
      }
    }
    setDeleteDrawerOpen(false);
    setRateToDelete(null);
  };

  // Form: computed canonical rate (XAF per 1 CNY) from raw input + mode
  const computedRateRmbToXaf = useMemo(() => {
    const raw = parseFloat(formRate);
    if (!formRate || isNaN(raw) || raw <= 0) return null;
    if (formInputMode === 'cnyToXaf') return raw;
    const computed = 1_000_000 / raw;
    return isFinite(computed) && computed > 0 ? computed : null;
  }, [formRate, formInputMode]);

  // Form preview calculations
  const formPreviewCNY = computedRateRmbToXaf !== null
    ? formatNumber(Math.round(1_000_000 / computedRateRmbToXaf))
    : '—';

  const formPreviewXafPerCny = computedRateRmbToXaf !== null
    ? formatNumber(Math.round(computedRateRmbToXaf))
    : '—';

  const formVariationPercent = useMemo(() => {
    if (computedRateRmbToXaf === null || !currentRmbToXaf) return null;
    const diff = ((computedRateRmbToXaf - currentRmbToXaf) / currentRmbToXaf) * 100;
    return diff;
  }, [computedRateRmbToXaf, currentRmbToXaf]);

  // Pull-to-refresh
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] }),
      queryClient.invalidateQueries({ queryKey: ['exchange-rates-chart'] }),
      queryClient.invalidateQueries({ queryKey: ['current-exchange-rate'] }),
    ]);
  };

  // Rate history with variation
  const ratesWithVariation = useMemo(() => {
    if (!rates) return [];
    return rates.map((rate, index) => {
      const cnyValue = Math.round(1000000 * rate.rate_xaf_to_rmb);
      const xafPerCny = Math.round(1 / rate.rate_xaf_to_rmb);
      const isActive = currentRate?.id === rate.id;

      let variationPercent: number | null = null;
      if (index < rates.length - 1) {
        const olderRate = rates[index + 1];
        const olderCny = Math.round(1000000 * olderRate.rate_xaf_to_rmb);
        if (olderCny !== 0) {
          variationPercent = ((cnyValue - olderCny) / olderCny) * 100;
        }
      }

      return { ...rate, cnyValue, xafPerCny, isActive, variationPercent };
    });
  }, [rates, currentRate]);

  // ── LOADING SKELETON ──
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <MobileHeader title={t('exchangeRate', { defaultValue: 'Taux de change' })} backTo="/m/more" showBack />
        <div className="flex-1 px-4 py-4 space-y-5">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title={t('exchangeRate', { defaultValue: 'Taux de change' })}
        backTo="/m/more"
        showBack
        rightElement={
          <button
            onClick={handleCreateRate}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        }
      />

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        <div className="px-4 pb-28 space-y-5">
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

            {/* Input field — "Vous envoyez" */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
                {t('youSend', { defaultValue: 'Vous envoyez' })}
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
                {t('youReceive', { defaultValue: 'Vous recevez' })}
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
                    // Highlight active chip
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
              {t('rateAppliedAtPayment', { defaultValue: 'Taux appliqué au moment du paiement' })}
            </p>
          </div>

          {/* ═══════════════════════════════════════════════
              C. TREND PREVIEW CARD
              ═══════════════════════════════════════════════ */}
          <div
            className="card-glass p-4 animate-slide-up"
            style={{ animationDelay: '140ms', animationFillMode: 'both' }}
          >
            <p className="text-sm font-semibold mb-3">{t('rateTrend', { defaultValue: 'Tendance du taux' })}</p>
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
                <p className="text-sm font-medium">{t('followRatesRealtime', { defaultValue: 'Suivez les taux en temps réel' })}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('ratesUpdatedDaily', { defaultValue: 'Les taux sont mis à jour chaque matin pour vous offrir le meilleur cours.' })}
                </p>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              E. RATE HISTORY
              ═══════════════════════════════════════════════ */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('rateHistory', { defaultValue: 'Historique des taux' })}</h3>

            {ratesWithVariation.length > 0 ? (
              <div className="space-y-2">
                {ratesWithVariation.map((rate, index) => (
                  <Drawer key={rate.id}>
                    <DrawerTrigger asChild>
                      <button
                        className="w-full card-glass p-4 text-left active:scale-[0.98] transition-transform animate-slide-up"
                        style={{
                          animationDelay: `${250 + index * 30}ms`,
                          animationFillMode: 'both',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className="font-medium"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                1M XAF = {formatNumber(rate.cnyValue)} CNY
                              </p>
                              {rate.isActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
                                  Actif
                                </span>
                              )}
                              {rate.variationPercent !== null && (
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5',
                                    rate.variationPercent > 0
                                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                      : rate.variationPercent < 0
                                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                        : 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {rate.variationPercent > 0 ? '+' : ''}
                                  {formatNumber(rate.variationPercent, 1)}%
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", {
                                locale: fr,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              1 CNY = {formatNumber(rate.xafPerCny)} XAF
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader>
                        <DrawerTitle>{t('rateDetails', { defaultValue: 'Détails du taux' })}</DrawerTitle>
                      </DrawerHeader>
                      <div className="px-4 pb-4 space-y-4">
                        <div className="p-4 rounded-xl bg-muted/50">
                          <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground">1 000 000 XAF</span>
                            <span className="font-bold">{formatNumber(rate.cnyValue)} CNY</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">1 CNY</span>
                            <span className="font-bold">{formatNumber(rate.xafPerCny)} XAF</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date d'effet</span>
                          <span>
                            {format(parseISO(rate.effective_at), "dd MMMM yyyy 'à' HH:mm", {
                              locale: fr,
                            })}
                          </span>
                        </div>
                        {rate.variationPercent !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Variation</span>
                            <span
                              className={cn(
                                'font-medium',
                                rate.variationPercent > 0
                                  ? 'text-green-600'
                                  : rate.variationPercent < 0
                                    ? 'text-red-600'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {rate.variationPercent > 0 ? '+' : ''}
                              {formatNumber(rate.variationPercent, 2)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <DrawerFooter className="flex-row gap-3">
                        <button
                          onClick={() => handleEditRate(rate)}
                          className="flex-1 h-12 rounded-xl border border-border flex items-center justify-center gap-2 font-medium"
                        >
                          <Pencil className="w-4 h-4" />
                          {t('edit', { defaultValue: 'Modifier' })}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(rate.id)}
                          className="flex-1 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center gap-2 font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('delete', { defaultValue: 'Supprimer' })}
                        </button>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t('noRatesForPeriod', { defaultValue: 'Aucun taux pour cette période' })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* ═══ RATE FORM DRAWER ═══ */}
      <Drawer open={formDrawerOpen} onOpenChange={setFormDrawerOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          {/* ── En-tête fixe ── */}
          <DrawerHeader className="flex-shrink-0 pb-2 border-b border-border/20">
            <DrawerTitle>
              {formMode === 'create' ? t('newExchangeRate', { defaultValue: 'Nouveau taux de change' }) : t('editRate', { defaultValue: 'Modifier le taux' })}
            </DrawerTitle>
          </DrawerHeader>

          {/* ── Zone scrollable ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            {/* Section 0: Input mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (formInputMode !== 'cnyToXaf') {
                    if (computedRateRmbToXaf !== null) {
                      setFormRate(Math.round(computedRateRmbToXaf).toString());
                    } else {
                      setFormRate('');
                    }
                    setFormInputMode('cnyToXaf');
                  }
                }}
                className={cn(
                  'h-11 rounded-xl text-sm font-medium transition-all active:scale-95',
                  'border',
                  formInputMode === 'cnyToXaf'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'bg-muted/50 text-foreground border-border/50',
                )}
              >
                1 CNY → XAF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (formInputMode !== 'xafToCny') {
                    if (computedRateRmbToXaf !== null) {
                      setFormRate(Math.round(1_000_000 / computedRateRmbToXaf).toString());
                    } else {
                      setFormRate('');
                    }
                    setFormInputMode('xafToCny');
                  }
                }}
                className={cn(
                  'h-11 rounded-xl text-sm font-medium transition-all active:scale-95',
                  'border',
                  formInputMode === 'xafToCny'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'bg-muted/50 text-foreground border-border/50',
                )}
              >
                1M XAF → CNY
              </button>
            </div>

            {/* Section 1: Rate Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {formInputMode === 'cnyToXaf' ? '1 CNY = ? XAF' : '1 000 000 XAF = ? CNY'}
              </label>
              <input
                type="text"
                inputMode={formInputMode === 'cnyToXaf' ? 'decimal' : 'numeric'}
                enterKeyHint="done"
                value={formRate}
                onChange={(e) => {
                  if (formInputMode === 'cnyToXaf') {
                    setFormRate(e.target.value.replace(/[^0-9.]/g, ''));
                  } else {
                    setFormRate(e.target.value.replace(/[^0-9]/g, ''));
                  }
                }}
                placeholder={formInputMode === 'cnyToXaf' ? 'Ex : 86.21' : 'Ex : 11 670'}
                className="w-full h-14 px-4 rounded-xl border border-border bg-background text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                {formInputMode === 'cnyToXaf'
                  ? 'Entrez combien de XAF pour 1 CNY'
                  : 'Entrez combien de CNY pour 1 000 000 XAF'}
              </p>
            </div>

            {/* Section 2: Live Preview */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              {formInputMode === 'cnyToXaf' ? (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">1 000 000 XAF</span>
                  <span className="text-sm font-bold">{formPreviewCNY} CNY</span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">1 CNY</span>
                  <span className="text-sm font-bold">{formPreviewXafPerCny} XAF</span>
                </div>
              )}
              {currentRmbToXaf > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Taux actuel</span>
                  <span className="text-xs text-muted-foreground">
                    1 CNY = {formatNumber(currentRmbToXaf)} XAF
                  </span>
                </div>
              )}
              {formVariationPercent !== null && Math.abs(formVariationPercent) > 0.01 && (
                <div
                  className={cn(
                    'flex items-center gap-2 mt-2 p-2 rounded-lg text-xs font-medium',
                    Math.abs(formVariationPercent) > 2
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : formVariationPercent > 0
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  )}
                >
                  {Math.abs(formVariationPercent) > 2 && '⚠ '}
                  Variation : {formVariationPercent > 0 ? '+' : ''}
                  {formatNumber(formVariationPercent, 2)}%
                  {Math.abs(formVariationPercent) > 2 && ' — variation importante'}
                </div>
              )}
            </div>

            {/* Section 3: Date & Heure — Smart presets */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Date d'effet</label>

              {/* Presets rapides */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Maintenant', value: 'now' },
                  { label: "Aujourd'hui", value: 'today' },
                  { label: 'Hier', value: 'yesterday' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleDatePreset(p.value as 'now' | 'today' | 'yesterday')}
                    className={cn(
                      'h-11 rounded-xl text-sm font-medium transition-all active:scale-95',
                      'border',
                      datePreset === p.value
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'bg-muted/50 text-foreground border-border/50',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Autre date — bouton toggle */}
              <button
                type="button"
                onClick={() => setDatePreset(datePreset === 'custom' ? 'now' : 'custom')}
                className={cn(
                  'w-full h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98]',
                  'flex items-center justify-center gap-2 border',
                  datePreset === 'custom'
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border-border/50',
                )}
              >
                <CalendarIcon className="w-4 h-4" />
                {datePreset === 'custom'
                  ? format(formDate, 'EEEE dd MMMM', { locale: fr })
                  : 'Autre date…'}
              </button>

              {/* Calendrier compact — visible seulement en mode "custom" */}
              {datePreset === 'custom' && (
                <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
                  <GlassCalendar
                    mode="single"
                    selected={formDate}
                    onSelect={(d) => d && setFormDate(d)}
                    showOutsideDays={false}
                  />
                </div>
              )}

              {/* Stepper heure */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/50">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground flex-1">Heure</span>
                <div className="flex items-center gap-2">
                  {/* Heures */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustTime('h', -1)}
                      className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-base font-bold tabular-nums select-none">
                      {formTime.split(':')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustTime('h', 1)}
                      className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xl font-bold text-muted-foreground leading-none">:</span>
                  {/* Minutes — pas de 5 en 5 */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustTime('m', -5)}
                      className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-base font-bold tabular-nums select-none">
                      {formTime.split(':')[1]}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustTime('m', 5)}
                      className="w-9 h-9 rounded-xl bg-background border border-border flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Résumé pill */}
              <div className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-primary/5 border border-primary/10">
                <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-medium text-primary">
                  {format(formDate, 'EEEE dd MMMM yyyy', { locale: fr })} à {formTime}
                </p>
              </div>
            </div>
          </div>

          {/* ── Bouton sticky en bas ── */}
          <div className="flex-shrink-0 px-4 pt-3 pb-6 border-t border-border/20 bg-background/80 backdrop-blur-sm">
            <button
              onClick={handleFormSubmit}
              disabled={
                addRate.isPending ||
                updateRate.isPending ||
                computedRateRmbToXaf === null
              }
              className="w-full btn-primary-gradient h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {addRate.isPending || updateRate.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('saving', { defaultValue: 'Enregistrement...' })}
                </>
              ) : formMode === 'create' ? (
                t('applyNewRate', { defaultValue: 'Appliquer le nouveau taux' })
              ) : (
                t('saveChanges', { defaultValue: 'Enregistrer les modifications' })
              )}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ═══ DELETE CONFIRMATION DRAWER ═══ */}
      <Drawer open={deleteDrawerOpen} onOpenChange={setDeleteDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('deleteRateConfirm', { defaultValue: 'Supprimer ce taux ?' })}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {rateUsage?.isUsed ? (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                Ce taux a été utilisé dans {rateUsage.usageCount} paiement(s) et ne peut pas être
                supprimé.
              </div>
            ) : (
              <p className="text-muted-foreground">
                Cette action est irréversible. Le taux sera définitivement supprimé.
              </p>
            )}
          </div>
          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <button className="flex-1 h-12 rounded-xl border border-border font-medium">
                {t('cancel', { defaultValue: 'Annuler' })}
              </button>
            </DrawerClose>
            <button
              onClick={handleDeleteConfirm}
              disabled={rateUsage?.isUsed || deleteRate.isPending}
              className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground font-medium disabled:opacity-50"
            >
              {deleteRate.isPending ? t('deleting', { defaultValue: 'Suppression...' }) : t('delete', { defaultValue: 'Supprimer' })}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
