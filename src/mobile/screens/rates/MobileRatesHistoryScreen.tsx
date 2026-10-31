/**
 * Historique des taux (maquettes 08-taux/17 à 21, et 05/15).
 *
 * En tête, la courbe sur 7 j / 30 j / 3 mois / 1 an : la méthode principale à
 * l'encre, une méthode de comparaison en gris (toucher une pastille l'ajoute,
 * la retoucher la passe en principale). Dessous, les publications par mois,
 * la publication active marquée « Actif », l'écart de cash sur la précédente.
 * Toucher une publication ouvre ses 4 taux ; avec `canManageRates` :
 * Corriger (`update_daily_rate`) et Supprimer (`delete_daily_rate`, la plus
 * récente restante redevient active).
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/decimalInput';
import { useDailyRatesForChart, useDeleteDailyRate, useUpdateDailyRate, type ChartPeriod } from '@/hooks/useDailyRates';
import { baseMethodRates } from '@/lib/countryRates';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import {
  BigButton, BottomSheet, Chip, ChartLegend, ConfirmSheet, EmptyLine, FOCUS_RING, ItemList, KVBox, LineChart, MethodCircle, SURFACE, ScreenLoader,
  ScreenTop, TEXT, Tag, TextInput,
} from '@/mobile/designKit';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import { ChipRow, GroupLabel } from './parts';
import { METHOD_NAME, METHOD_ORDER, METHOD_SHORT, dayTime, dec, nb, niceTicks, rateGroups, signed } from './rateFormat';
import { useRatesData } from './useRatesData';

const PERIODS: { key: ChartPeriod; label: string; long: string }[] = [
  { key: '7d', label: '7 j', long: '7 jours' },
  { key: '30d', label: '30 j', long: '30 jours' },
  { key: '3m', label: '3 mois', long: '3 mois' },
  { key: '1y', label: '1 an', long: '1 an' },
];

const rateOf = (r: DailyRate, k: PaymentMethodKey) => Number(r[`rate_${k}` as keyof DailyRate]) || 0;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function MobileRatesHistoryScreen() {
  const { history, activeRate, canManage, isLoading } = useRatesData();
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const [main, setMain] = useState<PaymentMethodKey>('alipay');
  const [compare, setCompare] = useState<PaymentMethodKey | null>('cash');
  const [sel, setSel] = useState<number | null>(null);
  const chart = useDailyRatesForChart(period);
  useEffect(() => setSel(null), [period, main, compare]);

  const points = chart.data ?? [];
  const mainValues = points.map((r) => rateOf(r, main));
  const cmpValues = compare ? points.map((r) => rateOf(r, compare)) : [];
  const last = mainValues[mainValues.length - 1];
  const first = mainValues[0];
  const change = points.length > 1 ? last - first : null;
  const pctChange = change != null && first > 0 ? (change / first) * 100 : null;

  const tapChip = (k: PaymentMethodKey) => {
    if (k === main) return;
    if (k === compare) { setCompare(main); setMain(k); return; }
    setCompare(k);
  };

  // ── Publications, par mois ───────────────────────────────────────────
  const months = useMemo(() => {
    const out: { key: string; label: string; rows: DailyRate[] }[] = [];
    for (const r of history) {
      const d = new Date(r.effective_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let m = out.find((x) => x.key === key);
      if (!m) { m = { key, label: format(d, 'MMMM yyyy', { locale: fr }), rows: [] }; out.push(m); }
      m.rows.push(r);
    }
    return out;
  }, [history]);
  const olderOf = (r: DailyRate) => history[history.findIndex((x) => x.id === r.id) + 1] ?? null;
  const newerOf = (r: DailyRate) => { const i = history.findIndex((x) => x.id === r.id); return i > 0 ? history[i - 1] : null; };

  const [open, setOpen] = useState<DailyRate | null>(null);
  const [editing, setEditing] = useState<DailyRate | null>(null);
  const [deleting, setDeleting] = useState<DailyRate | null>(null);
  const remove = useDeleteDailyRate();

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Historique des taux" backTo="/m/more/rates" />

      <ChipRow className="pt-4">
        {PERIODS.map((p) => <Chip key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />)}
      </ChipRow>

      <div className="px-5 pt-5">
        <div className={cn('text-[16px]', TEXT.muted)}>{METHOD_SHORT[main]} · {PERIODS.find((p) => p.key === period)?.long}</div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={cn('text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>
            {Number.isFinite(last) ? <>¥&nbsp;{nb(last)}</> : '—'}
          </span>
          {change != null && (
            <span className={cn('text-[18px] font-semibold tabular-nums', TEXT.strong)}>
              {signed(change)}{pctChange != null && ` · ${pctChange >= 0 ? '+' : '−'}${dec(Math.abs(pctChange), 1)} %`}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-8">
        {chart.isLoading ? (
          <ScreenLoader className="min-h-[220px]" />
        ) : points.length < 2 ? (
          <EmptyLine>Pas assez de publications sur la période</EmptyLine>
        ) : (
          <>
            <LineChart
              height={240}
              series={[
                { values: mainValues, tone: 'ink', label: METHOD_SHORT[main] },
                ...(compare ? [{ values: cmpValues, tone: 'grey' as const, label: METHOD_SHORT[compare] }] : []),
              ]}
              yTicks={niceTicks([...mainValues, ...cmpValues])}
              formatY={(v) => nb(v)}
              xLabels={{ 0: shortDate(points[0].effective_at), [points.length - 1]: shortDate(points[points.length - 1].effective_at) }}
              selected={sel}
              onSelect={setSel}
              ariaLabel="Évolution des taux"
            />
            {sel != null && points[sel] && (
              <div className={cn('mt-2 text-[15px] font-semibold', TEXT.muted)}>{dayTime(points[sel].effective_at)}</div>
            )}
            {compare && <ChartLegend items={[{ label: METHOD_SHORT[main], tone: 'ink' }, { label: METHOD_SHORT[compare], tone: 'grey' }]} />}
          </>
        )}
      </div>

      <GroupLabel className="pt-7">Comparer avec</GroupLabel>
      <ChipRow>
        {METHOD_ORDER.map((k) => (
          <Chip
            key={k}
            label={METHOD_SHORT[k]}
            active={k === main}
            onClick={() => tapChip(k)}
            className={k === compare ? 'ring-2 ring-inset ring-[#2C2C2C] dark:ring-[#E3E3E3]' : undefined}
          />
        ))}
      </ChipRow>

      {isLoading ? null : months.length === 0 ? (
        <EmptyLine>Aucune publication</EmptyLine>
      ) : (
        months.map((m) => (
          <div key={m.key}>
            <GroupLabel className="pt-8">{m.label} · {m.rows.length} publication{m.rows.length > 1 ? 's' : ''}</GroupLabel>
            <ItemList>
              {m.rows.map((r) => {
                const older = olderOf(r);
                const isActive = r.id === activeRate?.id;
                const d = older ? rateOf(r, 'cash') - rateOf(older, 'cash') : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpen(r)}
                    className={cn('flex w-full items-center gap-3 border-b py-3.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{dayTime(r.effective_at)}</span>
                      <span className={cn('mt-0.5 block truncate text-[15px] tabular-nums', TEXT.muted)}>Alipay {nb(r.rate_alipay)} · Cash {nb(r.rate_cash)}</span>
                    </span>
                    {isActive ? (
                      <Tag tone="success">Actif</Tag>
                    ) : d != null ? (
                      <span className="shrink-0 text-right">
                        <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{signed(d)}</span>
                        <span className={cn('block text-[15px]', TEXT.muted)}>cash</span>
                      </span>
                    ) : null}
                    <MoreHorizontal aria-hidden className={cn('ml-1 h-6 w-6 shrink-0', TEXT.strong)} strokeWidth={2.25} />
                  </button>
                );
              })}
            </ItemList>
          </div>
        ))
      )}

      {/* ── 19 · la publication ── */}
      <BottomSheet open={open != null} onClose={() => setOpen(null)}>
        {open && (
          <>
            <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{dayTime(open.effective_at)}</h3>
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>
              {open.id === activeRate?.id
                ? 'Active'
                : newerOf(open)
                  ? `Remplacée le ${format(new Date(newerOf(open)!.effective_at), 'd MMM, HH:mm', { locale: fr })}`
                  : 'Inactive'}
            </p>
            <KVBox className="mt-4" rows={rateGroups(baseMethodRates(open)).map((g) => ({ label: g.label, value: nb(g.value) }))} />
            {canManage && (
              <div className="mt-3">
                <SheetLine icon={Pencil} label="Corriger la publication" onClick={() => { setEditing(open); setOpen(null); }} />
                <SheetLine icon={Trash2} label="Supprimer la publication" danger onClick={() => { setDeleting(open); setOpen(null); }} />
              </div>
            )}
          </>
        )}
      </BottomSheet>

      {/* ── 20 · corriger ── */}
      <CorrectSheet rate={editing} onClose={() => setEditing(null)} />

      {/* ── 21 · supprimer ── */}
      {deleting && (() => {
        const isActive = deleting.id === activeRate?.id;
        const older = olderOf(deleting);
        return (
          <ConfirmSheet
            open
            danger
            onClose={() => setDeleting(null)}
            title={isActive ? 'Supprimer la publication active\u00A0?' : 'Supprimer la publication\u00A0?'}
            subtitle={dayTime(deleting.effective_at)}
            rows={[
              { label: 'Supprimée', value: `Alipay ${nb(deleting.rate_alipay)} · Cash ${nb(deleting.rate_cash)}` },
              ...(isActive && older
                ? [
                    { label: 'Redevient active', value: dayTime(older.effective_at) },
                    { label: 'Alipay du jour', before: nb(deleting.rate_alipay), value: nb(older.rate_alipay) },
                  ]
                : []),
            ]}
            confirmLabel="Supprimer"
            cancelLabel="Garder"
            loading={remove.isPending}
            onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          />
        );
      })()}
    </div>
  );
}

function SheetLine({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex min-h-[64px] w-full items-center gap-3.5 border-b py-2.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', danger ? 'bg-[#FDD3D0] text-[#C00F0C]' : SURFACE.holder)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className={cn('text-[17px] font-semibold', danger ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{label}</span>
    </button>
  );
}

type Draft = Record<PaymentMethodKey, string>;

/** Corriger une publication : ses 4 taux et sa date d'effet (`update_daily_rate`). */
function CorrectSheet({ rate, onClose }: { rate: DailyRate | null; onClose: () => void }) {
  const update = useUpdateDailyRate();
  const [draft, setDraft] = useState<Draft>({ alipay: '', wechat: '', virement: '', cash: '' });
  const [when, setWhen] = useState('');
  useEffect(() => {
    if (!rate) return;
    setDraft(Object.fromEntries(METHOD_ORDER.map((k) => [k, String(rateOf(rate, k)).replace('.', ',')])) as Draft);
    setWhen(format(new Date(rate.effective_at), "yyyy-MM-dd'T'HH:mm"));
  }, [rate]);

  if (!rate) return <BottomSheet open={false} onClose={onClose}><span /></BottomSheet>;

  const values = Object.fromEntries(METHOD_ORDER.map((k) => [k, parseDecimal(draft[k])])) as Record<PaymentMethodKey, number>;
  const valid = METHOD_ORDER.every((k) => Number.isFinite(values[k]) && values[k] > 0 && values[k] < 1_000_000);
  const at = when ? new Date(when) : null;
  const dateChanged = at != null && !Number.isNaN(at.getTime()) && Math.abs(at.getTime() - new Date(rate.effective_at).getTime()) >= 60_000;
  const dirty = METHOD_ORDER.some((k) => values[k] !== rateOf(rate, k)) || dateChanged;

  const save = () => {
    if (!valid || !dirty) return;
    update.mutate(
      {
        rateId: rate.id,
        rate_alipay: values.alipay,
        rate_wechat: values.wechat,
        rate_virement: values.virement,
        rate_cash: values.cash,
        effective_at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <BottomSheet open onClose={update.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Corriger le {format(new Date(rate.effective_at), 'd MMM, HH:mm', { locale: fr })}</h3>
      <div className="mt-3">
        {METHOD_ORDER.map((k) => {
          const changed = Number.isFinite(values[k]) && values[k] !== rateOf(rate, k);
          return (
            <div key={k} className={cn('flex items-center gap-3.5 border-b py-3 last:border-b-0', SURFACE.divider)}>
              <MethodCircle method={k} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{METHOD_NAME[k]}</span>
                {changed && <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>Avant {nb(rateOf(rate, k))}</span>}
              </span>
              <TextInput
                inputMode="decimal"
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                aria-label={`Taux ${METHOD_NAME[k]}`}
                className="w-[136px] h-14 text-right text-[20px] font-bold tabular-nums"
              />
            </div>
          );
        })}
      </div>
      <div className={cn('mt-4 rounded-lg border p-1', SURFACE.divider)}>
        <div className={cn('px-3 pt-2 text-[15px]', TEXT.muted)}>Date d’effet</div>
        <BzDateTimeField value={when} onChange={setWhen} accent="#2C2C2C" disableFuture={false} />
      </div>
      <div className="mt-5">
        <BigButton onClick={save} disabled={!valid || !dirty} loading={update.isPending}>Enregistrer la correction</BigButton>
      </div>
    </BottomSheet>
  );
}
