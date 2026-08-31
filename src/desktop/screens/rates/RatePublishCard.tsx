/**
 * Taux — carte A « Publier les taux du jour » (docs/admin-redesign/06).
 *
 * L'acte le plus sensible du produit : chaque ligne montre l'ACTIF à côté du
 * NOUVEAU avec le delta calculé en direct et l'équivalence « ≈ X XAF/CNY »
 * (la saisie est TOUJOURS en CNY / 1M XAF — l'ancien segment de direction,
 * purement décoratif, publiait des valeurs fausses). La suggestion Binance
 * P2P est inline (ordres marchands dépliables). La publication passe par un
 * dialogue de confirmation avec récapitulatif ancien → nouveau ; un écart
 * > 10 % y est surligné en ambre.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseDecimal } from '@/lib/decimalInput';
import { rateEffectiveAt, RATE_DATE_OPTIONS, type RateDateOption } from '@/lib/rateEffectiveDate';
import { AlertTriangle, ArrowRight, ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import {
  useCreateDailyRates,
  useLatestSuggestion,
  useComputeSuggestion,
  useMarkSuggestionApplied,
} from '@/hooks/useDailyRates';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Chip,
  StatusPill,
  PrimaryPill,
  SoftPill,
  SecLabel,
  CenterDialog,
} from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';

const fmtRate = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Delta saisie vs actif — pastille verte/rouge, « = » neutre. */
function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="inline-block w-[64px]" aria-hidden />;
  if (delta === 0) {
    return (
      <span className={cn('inline-flex w-[64px] justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', SURFACE.holder, TEXT.muted)}>
        =
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex w-[64px] justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
        up
          ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
          : 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
      )}
    >
      {up ? '+' : ''}
      {fmtRate(delta)}
    </span>
  );
}

export function RatePublishCard({ activeRate }: { activeRate: DailyRate | null | undefined }) {
  const [rates, setRates] = useState<Record<PaymentMethodKey, string>>({
    cash: '', alipay: '', wechat: '', virement: '',
  });
  const [dateOption, setDateOption] = useState<RateDateOption>('now');
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customHour, setCustomHour] = useState(new Date().getHours());
  const [customMin, setCustomMin] = useState(0);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createRates = useCreateDailyRates();
  const { data: suggestion } = useLatestSuggestion();
  const computeSuggestion = useComputeSuggestion();
  const markApplied = useMarkSuggestionApplied();

  // Pré-remplit quand le taux actif arrive après le montage — sans écraser
  // une saisie en cours (même contrat que le mobile).
  useEffect(() => {
    if (!activeRate) return;
    setRates((prev) => ({
      cash: prev.cash || activeRate.rate_cash?.toString() || '',
      alipay: prev.alipay || activeRate.rate_alipay?.toString() || '',
      wechat: prev.wechat || activeRate.rate_wechat?.toString() || '',
      virement: prev.virement || activeRate.rate_virement?.toString() || '',
    }));
  }, [activeRate]);

  const rows = useMemo(
    () =>
      PAYMENT_METHODS.map((pm) => {
        const active = activeRate ? (activeRate[`rate_${pm.key}` as keyof DailyRate] as number) : null;
        const parsed = parseDecimal(rates[pm.key]);
        const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        return {
          pm,
          active,
          value,
          changed: value !== null && (active === null || value !== active),
          delta: value !== null && active !== null ? Math.round((value - active) * 100) / 100 : null,
          // Ce que coûte 1 CNY au nouveau taux — le repère mental des admins.
          perCny: value !== null ? 1_000_000 / value : null,
        };
      }),
    [activeRate, rates],
  );

  const allValid = rows.every((r) => r.value !== null);
  // Republier les mêmes valeurs avec une AUTRE prise d'effet est un usage
  // légitime (dater le jeu du jour) — seul le no-op strict est bloqué.
  const anyChange = !activeRate || dateOption !== 'now' || rows.some((r) => r.changed);

  const effectiveLabel =
    dateOption === 'now'
      ? 'maintenant'
      : dateOption === 'today'
        ? "aujourd'hui à 00:00"
        : dateOption === 'yesterday'
          ? 'hier à 00:00'
          : `le ${customDate.split('-').reverse().join('/')} à ${String(customHour).padStart(2, '0')}:${String(customMin).padStart(2, '0')}`;

  const doPublish = () => {
    if (!allValid || createRates.isPending) return;
    const suggestionId = suggestion && !suggestion.applied ? suggestion.id : null;
    createRates.mutate(
      {
        rate_cash: parseDecimal(rates.cash),
        rate_alipay: parseDecimal(rates.alipay),
        rate_wechat: parseDecimal(rates.wechat),
        rate_virement: parseDecimal(rates.virement),
        effective_at: rateEffectiveAt(dateOption, customDate, customHour, customMin),
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          if (suggestionId && result.rate_id) {
            markApplied.mutate({ suggestionId, rateId: result.rate_id });
          }
        },
      },
    );
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    const v = suggestion.suggested_rate.toString();
    setRates({ cash: v, alipay: v, wechat: v, virement: v });
  };

  const activeSince = activeRate?.effective_at
    ? new Date(activeRate.effective_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card className="overflow-visible p-0">
      <CardHeader
        title="Publier les taux du jour"
        meta={
          <span className="inline-flex items-center gap-2">
            {activeRate && <StatusPill tone="success" label="En ligne" />}
            {activeSince && <span>depuis le {activeSince}</span>}
          </span>
        }
      />

      <div className="space-y-4 p-4">
        {/* ── Saisie : actif → nouveau, delta et équivalence en direct ── */}
        <div>
          <div className={cn('mb-1.5 grid grid-cols-[minmax(0,1fr)_76px_16px_112px_64px] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider', TEXT.muted)}>
            <span>Mode</span>
            <span className="text-right">Actif</span>
            <span aria-hidden />
            <span className="text-right">Nouveau</span>
            <span className="text-center">Δ</span>
          </div>
          <div className="space-y-1.5">
            {rows.map(({ pm, active, delta, perCny }) => (
              <div
                key={pm.key}
                className={cn('grid grid-cols-[minmax(0,1fr)_76px_16px_112px_64px] items-center gap-2 rounded-2xl px-2 py-1.5', SURFACE.canvas)}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <MethodLogo method={pm.key} size={30} />
                  <div className="min-w-0 leading-[15px]">
                    <div className={cn('text-[13px] font-bold', TEXT.strong)}>{pm.label}</div>
                    <div className={cn('truncate text-[10.5px] tabular-nums', TEXT.muted)}>
                      {perCny ? `1 CNY ≈ ${perCny.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} XAF` : 'CNY / 1M XAF'}
                    </div>
                  </div>
                </div>
                <span className={cn('text-right text-[13px] font-semibold tabular-nums', TEXT.muted)}>
                  {active !== null ? fmtRate(active) : '—'}
                </span>
                <ArrowRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
                <TextField
                  variant="decimal"
                  size="sm"
                  value={rates[pm.key]}
                  onChange={(e) => setRates((prev) => ({ ...prev, [pm.key]: e.target.value }))}
                  wrapperClassName="w-[112px]"
                  controlClassName="h-9 text-right text-[15px] font-black tabular-nums"
                  aria-label={`Nouveau taux ${pm.label}`}
                />
                <div className="text-center">
                  <DeltaChip delta={delta} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Suggestion Binance P2P ── */}
        <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </span>
              {suggestion ? (
                <div className="min-w-0 leading-[16px]">
                  <div className="text-[15px] font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
                    {fmtRate(suggestion.suggested_rate)} <span className="text-[11px] font-bold">CNY / 1M XAF</span>
                  </div>
                  <div className="truncate text-[10.5px] text-amber-700/70 dark:text-amber-400/70">
                    Binance P2P · il y a {formatDistanceToNow(new Date(suggestion.computed_at), { locale: fr })}
                    {suggestion.applied && ' · déjà appliqué'}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-amber-700/80 dark:text-amber-400/80">
                  Aucune suggestion — recalculez depuis Binance P2P.
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => computeSuggestion.mutate()}
                disabled={computeSuggestion.isPending}
                aria-label="Recalculer la suggestion"
                title="Recalculer depuis Binance P2P"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/15 text-amber-700 transition disabled:opacity-60 dark:text-amber-400"
              >
                {computeSuggestion.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
              {suggestion && (
                <button
                  type="button"
                  onClick={useSuggestion}
                  className="rounded-full bg-amber-600 px-3 py-1.5 text-[11.5px] font-bold text-white"
                >
                  Pré-remplir
                </button>
              )}
            </div>
          </div>

          {suggestion && (
            <>
              <button
                type="button"
                onClick={() => setOrdersOpen((v) => !v)}
                aria-expanded={ordersOpen}
                className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80"
              >
                Détail du calcul ({suggestion.cmr_orders.length + suggestion.chn_orders.length} ordres)
                <ChevronDown className={cn('h-3 w-3 transition-transform', !ordersOpen && '-rotate-90')} />
              </button>
              {ordersOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        title: `CMR · max + ${suggestion.cmr_margin_xaf} XAF`,
                        value: `${fmtRate(suggestion.cmr_rate_max + suggestion.cmr_margin_xaf)} XAF/USDT`,
                        orders: suggestion.cmr_orders,
                        unit: 'XAF',
                      },
                      {
                        title: 'CHN · moyenne',
                        value: `${suggestion.chn_rate_avg.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} CNY/USDT`,
                        orders: suggestion.chn_orders,
                        unit: 'CNY',
                      },
                    ] as const
                  ).map((side) => (
                    <div key={side.title} className={cn('rounded-xl px-2.5 py-2', SURFACE.card)}>
                      <div className={cn('text-[9px] font-bold uppercase tracking-wider', TEXT.muted)}>{side.title}</div>
                      <div className={cn('text-[12px] font-bold tabular-nums', TEXT.strong)}>{side.value}</div>
                      <div className="mt-1.5 space-y-0.5">
                        {side.orders.slice(0, 4).map((o, i) => (
                          <div key={i} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                            <span className={cn('truncate', TEXT.muted)}>{o.name}</span>
                            <span className={cn('shrink-0 font-semibold tabular-nums', TEXT.strong)}>
                              {o.price.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                        ))}
                        {side.orders.length > 4 && (
                          <div className={cn('text-[10px]', TEXT.muted)}>+ {side.orders.length - 4} autres</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Prise d'effet ── */}
        <div>
          <SecLabel>Prise d'effet</SecLabel>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {RATE_DATE_OPTIONS.map((d) => (
              <Chip key={d.key} label={d.label} active={dateOption === d.key} onClick={() => setDateOption(d.key)} />
            ))}
          </div>
          {dateOption === 'custom' && (
            <div className="mt-2.5">
              <BzDateTimeField
                value={`${customDate}T${String(customHour).padStart(2, '0')}:${String(customMin).padStart(2, '0')}`}
                onChange={(v) => {
                  const [d, t] = v.split('T');
                  if (!d || !t) return;
                  const [h, m] = t.split(':').map(Number);
                  setCustomDate(d);
                  setCustomHour(Number.isNaN(h) ? 0 : h);
                  setCustomMin(Number.isNaN(m) ? 0 : m);
                }}
                accent="#8B5CF6"
                disableFuture={false}
              />
            </div>
          )}
        </div>

        {/* ── Publier — derrière confirmation ── */}
        <PrimaryPill
          onClick={() => setConfirmOpen(true)}
          disabled={!allValid || !anyChange}
          className="w-full py-3 text-[14px]"
        >
          Publier les taux…
        </PrimaryPill>
        {allValid && !anyChange && (
          <p className={cn('!mt-2 text-center text-[11px]', TEXT.muted)}>
            Valeurs identiques aux taux actifs — modifiez un taux ou choisissez une autre prise d'effet.
          </p>
        )}
      </div>

      {/* ── Récapitulatif de publication ── */}
      <CenterDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doPublish}
        title="Confirmer la publication"
        width={460}
        footer={
          <>
            <PrimaryPill onClick={doPublish} loading={createRates.isPending} className="flex-1">
              Publier {effectiveLabel === 'maintenant' ? 'maintenant' : ''}
            </PrimaryPill>
            <SoftPill onClick={() => setConfirmOpen(false)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <div className="space-y-1.5">
          {rows.map(({ pm, active, value, delta }) => {
            // Un écart > 10 % vs l'actif mérite un second regard avant de
            // changer les prix de tous les clients.
            const big = active !== null && active > 0 && value !== null && Math.abs(value - active) / active > 0.1;
            return (
              <div
                key={pm.key}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2',
                  big ? 'bg-[#F8EFD8] dark:bg-[#372D14]' : SURFACE.canvas,
                )}
              >
                <span className="flex items-center gap-2">
                  <MethodLogo method={pm.key} size={22} />
                  <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{pm.label}</span>
                  {big && <AlertTriangle className="h-3.5 w-3.5 text-[#9A6B12] dark:text-[#E7C083]" />}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className={cn('text-[13px]', TEXT.muted)}>{active !== null ? fmtRate(active) : '—'}</span>
                  <ArrowRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
                  <span className={cn('text-[14px] font-bold', TEXT.strong)}>{value !== null ? fmtRate(value) : '—'}</span>
                  <DeltaChip delta={delta} />
                </span>
              </div>
            );
          })}
        </div>
        <p className={cn('mt-3 text-[13px]', TEXT.muted)}>
          Prise d'effet <b className={TEXT.strong}>{effectiveLabel}</b>. Les nouveaux taux remplacent
          immédiatement les taux actifs pour tous les clients.
        </p>
      </CenterDialog>
    </Card>
  );
}
