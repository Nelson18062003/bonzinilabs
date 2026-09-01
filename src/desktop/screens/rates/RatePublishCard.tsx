/**
 * Taux — vue « Publier » (docs/admin-redesign/06, v3 après retour
 * utilisateur : rangées écrasées, suggestion Binance inutile, trop de texte).
 *
 * Une seule chose : quatre grandes rangées ACTIF → NOUVEAU avec le delta en
 * direct, la prise d'effet, PUBLIER. La suggestion Binance a été retirée du
 * desktop à la demande de l'utilisateur (le mobile la garde). La publication
 * reste derrière un dialogue de confirmation — un écart > 10 % y est
 * surligné en ambre.
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import { parseDecimal } from '@/lib/decimalInput';
import { rateEffectiveAt, RATE_DATE_OPTIONS, type RateDateOption } from '@/lib/rateEffectiveDate';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import { useCreateDailyRates } from '@/hooks/useDailyRates';
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
  if (delta === null) return <span className="inline-block w-[72px]" aria-hidden />;
  if (delta === 0) {
    return (
      <span className={cn('inline-flex w-[72px] justify-center rounded-md px-2 py-1 text-[12px] font-bold tabular-nums', SURFACE.holder, TEXT.muted)}>
        =
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex w-[72px] justify-center rounded-md px-2 py-1 text-[12px] font-bold tabular-nums',
        up
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createRates = useCreateDailyRates();

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
        };
      }),
    [activeRate, rates],
  );

  const allValid = rows.every((r) => r.value !== null);
  // Republier les mêmes valeurs avec une AUTRE prise d'effet est un usage
  // légitime — seul le no-op strict (mêmes valeurs, maintenant) est bloqué.
  const canPublish = allValid && (!activeRate || dateOption !== 'now' || rows.some((r) => r.changed));

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
    createRates.mutate(
      {
        rate_cash: parseDecimal(rates.cash),
        rate_alipay: parseDecimal(rates.alipay),
        rate_wechat: parseDecimal(rates.wechat),
        rate_virement: parseDecimal(rates.virement),
        effective_at: rateEffectiveAt(dateOption, customDate, customHour, customMin),
      },
      { onSuccess: () => setConfirmOpen(false) },
    );
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

      <div className="space-y-5 p-5">
        {/* ── Quatre grandes rangées : actif → nouveau ── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <SecLabel>Nouveaux taux</SecLabel>
            <span className={cn('text-[11px] tabular-nums', TEXT.muted)}>CNY / 1 000 000 XAF</span>
          </div>
          <div className="space-y-2">
            {rows.map(({ pm, active, delta }) => (
              <div key={pm.key} className={cn('flex items-center gap-4 rounded-2xl p-3.5', SURFACE.canvas)}>
                <MethodLogo method={pm.key} size={40} />
                <span className={cn('min-w-0 flex-1 text-[15px] font-bold', TEXT.strong)}>{pm.label}</span>
                <span className={cn('text-[15px] font-semibold tabular-nums', TEXT.muted)}>
                  {active !== null ? fmtRate(active) : '—'}
                </span>
                <ArrowRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                <TextField
                  variant="decimal"
                  value={rates[pm.key]}
                  onChange={(e) => setRates((prev) => ({ ...prev, [pm.key]: e.target.value }))}
                  wrapperClassName="w-[150px]"
                  controlClassName="h-12 text-right text-[20px] font-black tabular-nums"
                  aria-label={`Nouveau taux ${pm.label}`}
                />
                <DeltaChip delta={delta} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Prise d'effet ── */}
        <div>
          <SecLabel className="mb-2 px-1">Prise d'effet</SecLabel>
          <div className="flex flex-wrap items-center gap-1.5">
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
        <PrimaryPill onClick={() => setConfirmOpen(true)} disabled={!canPublish} className="w-full py-3.5 text-[15px]">
          Publier les taux…
        </PrimaryPill>
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
              Publier
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
                  big ? 'bg-amber-50 dark:bg-amber-950/50' : SURFACE.canvas,
                )}
              >
                <span className="flex items-center gap-2">
                  <MethodLogo method={pm.key} size={22} />
                  <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{pm.label}</span>
                  {big && <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />}
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
          Prise d'effet <b className={TEXT.strong}>{effectiveLabel}</b>.
        </p>
      </CenterDialog>
    </Card>
  );
}
