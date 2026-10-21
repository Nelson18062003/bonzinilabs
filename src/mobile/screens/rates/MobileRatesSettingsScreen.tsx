/**
 * Écarts pays et paliers (maquette 08-taux/12, feuilles 11 et 13).
 *
 * Les deux réglages de `rate_adjustments` : l'écart de chaque pays vs le
 * Cameroun et le % de chaque palier de montant (≥ 1 M = référence). Toucher
 * une ligne ouvre sa feuille ; l'enregistrement passe par
 * `update_rate_adjustment` (`canManageRates`). Les lignes de référence ne se
 * modifient pas (comme l'ancien écran Réglages).
 */
import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { formatCountryPct } from '@/lib/countryRates';
import type { RateAdjustment } from '@/types/rates';
import { IconCircle, ItemList, ItemRow, ScreenError, ScreenLoader, ScreenTop, TEXT } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { AdjustSheet } from './AdjustSheet';
import { FlagCircle, GroupLabel } from './parts';
import { countryRows, elision, nb, rateGroups } from './rateFormat';
import { useRatesData } from './useRatesData';

const TIER_LABEL: Record<string, string> = {
  t3: '1 000 000 XAF et plus',
  t2: '400 000 à 999 999 XAF',
  t1: 'Moins de 400 000 XAF',
};
const TIER_ORDER = ['t3', 't2', 't1'];

type Editing = { kind: 'country'; key: string } | { kind: 'tier'; adj: RateAdjustment } | null;

export function MobileRatesSettingsScreen() {
  const { sheets, adjustments, activeRate, base, isLoading, isError, canManage } = useRatesData();
  const update = useUpdateRateAdjustment();
  const [editing, setEditing] = useState<Editing>(null);

  const tiers = useMemo(
    () => adjustments.filter((a) => a.type === 'tier').sort((a, b) => TIER_ORDER.indexOf(a.key) - TIER_ORDER.indexOf(b.key)),
    [adjustments],
  );

  const country = editing?.kind === 'country' ? sheets.find((s) => s.key === editing.key) ?? null : null;
  const tier = editing?.kind === 'tier' ? editing.adj : null;

  const save = (adjustmentId: string) => async (pct: number) => {
    try {
      await update.mutateAsync({ adjustmentId, percentage: pct });
      setEditing(null);
    } catch { /* toast déjà affiché par la mutation */ }
  };

  // Les taux du Cameroun pour un palier donné : base × (1 + palier).
  const tierRows = (from: number, to: number) => {
    if (!base) return [];
    const at = (pct: number) => ({
      alipay: Math.round(base.alipay * (1 + pct / 100) * 100) / 100,
      wechat: Math.round(base.wechat * (1 + pct / 100) * 100) / 100,
      virement: Math.round(base.virement * (1 + pct / 100) * 100) / 100,
      cash: Math.round(base.cash * (1 + pct / 100) * 100) / 100,
    });
    return rateGroups(at(to), at(from)).map((g) => ({
      label: g.label,
      before: g.prev != null && g.prev !== g.value ? nb(g.prev) : undefined,
      value: nb(g.value),
    }));
  };

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Écarts pays et paliers" backTo="/m/more/rates" />
      {isLoading ? (
        <ScreenLoader />
      ) : isError ? (
        <ScreenError title="Réglages indisponibles" description="Réessayez dans un instant." />
      ) : (
        <>
          <GroupLabel>Pays · vs Cameroun</GroupLabel>
          <ItemList>
            {sheets.map((s) => {
              const open = canManage && !s.isReference;
              return (
                <ItemRow
                  key={s.key}
                  leading={<FlagCircle iso={s.iso} />}
                  title={s.label}
                  subtitle={s.isReference ? 'Référence' : undefined}
                  right={<><span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{formatCountryPct(s.percentage)}</span>{!open && <span aria-hidden className="w-5 shrink-0" />}</>}
                  chevron={open}
                  onClick={open ? () => setEditing({ kind: 'country', key: s.key }) : undefined}
                />
              );
            })}
          </ItemList>

          <GroupLabel>Paliers · par montant</GroupLabel>
          <ItemList>
            {tiers.map((t) => {
              const pct = t.is_reference ? 0 : Number(t.percentage) || 0;
              const open = canManage && !t.is_reference;
              return (
                <ItemRow
                  key={t.id}
                  leading={<IconCircle icon={Layers} />}
                  title={TIER_LABEL[t.key] ?? t.label}
                  subtitle={t.is_reference ? 'Référence' : undefined}
                  right={<><span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{formatCountryPct(pct)}</span>{!open && <span aria-hidden className="w-5 shrink-0" />}</>}
                  chevron={open}
                  onClick={open ? () => setEditing({ kind: 'tier', adj: t }) : undefined}
                />
              );
            })}
          </ItemList>
        </>
      )}

      {country && (
        <AdjustSheet
          open
          onClose={() => setEditing(null)}
          title={`Écart ${elision(country.label)}`}
          subtitle={`vs Cameroun · enregistré ${formatCountryPct(country.percentage)}`}
          current={country.percentage}
          rows={(pct) => countryRows(activeRate, country.percentage, pct)}
          note={`Paiements ${elision(country.label)} et flyer`}
          positiveWarning="Écart positif : plus cher qu’au Cameroun"
          onSave={save(country.adjustmentId)}
          saving={update.isPending}
        />
      )}
      {tier && (
        <AdjustSheet
          open
          onClose={() => setEditing(null)}
          title={TIER_LABEL[tier.key] ?? tier.label}
          subtitle={`Tous les pays · enregistré ${formatCountryPct(Number(tier.percentage) || 0)}`}
          current={Number(tier.percentage) || 0}
          rows={(pct) => tierRows(Number(tier.percentage) || 0, pct)}
          note="Cameroun · s’affiche en rouge sur le flyer"
          positiveWarning="Palier positif : plus cher que 1 000 000 XAF et plus"
          onSave={save(tier.id)}
          saving={update.isPending}
        />
      )}
    </div>
  );
}
