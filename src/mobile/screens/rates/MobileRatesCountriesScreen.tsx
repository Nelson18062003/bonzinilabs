/**
 * Taux par pays (maquette 08-taux/09) et fiche d'un pays (10, feuille 11).
 *
 * Le Cameroun est la référence : les autres pays n'ont pas de taux propre,
 * seulement un écart (`rate_adjustments`), appliqué aux taux publiés
 * (`deriveCountryRates`, même arrondi que la RPC). La fiche montre les taux
 * dérivés avec ceux du Cameroun en rappel ; « Modifier » ouvre l'écart
 * (`update_rate_adjustment`, `canManageRates`) ; le bouton noir ouvre le
 * flyer du jour de ce pays.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calculator, FileText, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { formatCountryPct, type CountryRateSheet } from '@/lib/countryRates';
import type { PaymentMethodKey } from '@/types/rates';
import {
  ActionSheet, BigButton, Chip, Dock, EmptyLine, ItemList, ItemRow, KVBox, MoreButton, ScreenError, ScreenLoader, ScreenTop, Tag, TEXT,
  useSheet,
} from '@/mobile/designKit';
import { AdjustSheet } from './AdjustSheet';
import { ChipRow, FlagCircle, GroupCircle, GroupLabel } from './parts';
import { METHOD_ORDER, METHOD_SHORT, countryRows, elision, nb, rateGroups } from './rateFormat';
import { useRatesData } from './useRatesData';

export function MobileRatesCountriesScreen() {
  const navigate = useNavigate();
  const { sheets, isLoading, isError, activeRate } = useRatesData();
  const [method, setMethod] = useState<PaymentMethodKey>('alipay');

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Taux par pays" backTo="/m/more/rates" />
      <ChipRow className="pt-4">
        {METHOD_ORDER.map((k) => (
          <Chip key={k} label={METHOD_SHORT[k]} active={method === k} onClick={() => setMethod(k)} />
        ))}
      </ChipRow>
      <GroupLabel className="pt-5">Pour 1 000 000 XAF</GroupLabel>
      {isLoading ? (
        <ScreenLoader />
      ) : isError ? (
        <ScreenError title="Pays indisponibles" description="Réessayez dans un instant." />
      ) : sheets.length === 0 ? (
        <EmptyLine>Aucun pays</EmptyLine>
      ) : (
        <ItemList>
          {sheets.map((s) => (
            <ItemRow
              key={s.key}
              leading={<FlagCircle iso={s.iso} />}
              title={s.label}
              subtitle={s.isReference ? 'Référence' : `Écart ${formatCountryPct(s.percentage)}`}
              amount={activeRate ? <>¥&nbsp;{nb(s.rates[method])}</> : '—'}
              chevron
              onClick={() => navigate(`/m/more/rates/countries/${s.key}`)}
            />
          ))}
        </ItemList>
      )}
    </div>
  );
}

export function MobileRatesCountryScreen() {
  const navigate = useNavigate();
  const { key } = useParams<{ key: string }>();
  const more = useSheet();
  const edit = useSheet();
  const { sheets, activeRate, base, isLoading, canManage } = useRatesData();
  const update = useUpdateRateAdjustment();
  const sheet: CountryRateSheet | undefined = sheets.find((s) => s.key === key);

  if (isLoading) return <><ScreenTop title="Pays" backTo="/m/more/rates/countries" /><ScreenLoader /></>;
  if (!sheet) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Pays" backTo="/m/more/rates/countries" />
        <EmptyLine action={{ label: 'Taux par pays', onClick: () => navigate('/m/more/rates/countries') }}>Pays inconnu</EmptyLine>
      </div>
    );
  }

  const groups = activeRate ? rateGroups(sheet.rates, base) : [];
  const flyer = () => navigate(`/m/more/rates/flyer?country=${sheet.key}`);
  const editable = canManage && !sheet.isReference;

  const save = async (pct: number) => {
    try {
      await update.mutateAsync({ adjustmentId: sheet.adjustmentId, percentage: pct });
      edit.hide();
    } catch { /* toast déjà affiché par la mutation */ }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={sheet.label} backTo="/m/more/rates/countries" right={<MoreButton onClick={more.show} />} />

      <div className="px-5 pt-7 text-center">
        <FlagCircle iso={sheet.iso} size={64} className="mx-auto" />
        <div className={cn('mt-4 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>
          {activeRate ? <>¥&nbsp;{nb(sheet.rates.alipay)}</> : '—'}
        </div>
        <div className={cn('mt-2.5 text-[16px]', TEXT.muted)}>Alipay · pour 1 000 000 XAF</div>
        <Tag tone="neutral" className="mt-3">{sheet.isReference ? 'Référence' : `Écart ${formatCountryPct(sheet.percentage)}`}</Tag>
      </div>

      {activeRate ? (
        <ItemList className="pt-4">
          {groups.map((g) => (
            <ItemRow
              key={g.key}
              leading={<GroupCircle methods={g.methods} />}
              title={g.label}
              subtitle={!sheet.isReference && g.prev != null ? `Cameroun ${nb(g.prev)}` : undefined}
              amount={<>¥&nbsp;{nb(g.value)}</>}
            />
          ))}
        </ItemList>
      ) : (
        <EmptyLine>Aucun taux publié</EmptyLine>
      )}

      {!sheet.isReference && (
        <div className="px-5 pt-3">
          <KVBox
            rows={[{
              label: 'Écart vs Cameroun',
              value: (
                <span className="inline-flex items-center gap-5">
                  {formatCountryPct(sheet.percentage)}
                  {editable && (
                    <button type="button" onClick={edit.show} className={cn('-my-2 py-2 font-semibold underline underline-offset-[3px]', TEXT.strong)}>Modifier</button>
                  )}
                </span>
              ),
            }]}
          />
        </div>
      )}

      <Dock>
        <BigButton onClick={flyer}><FileText className="h-5 w-5" /> Flyer du jour · {sheet.label}</BigButton>
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Modifier l’écart', icon: Percent, onClick: edit.show, hidden: !editable },
          { label: `Simuler pour ${sheet.label}`, icon: Calculator, onClick: () => navigate(`/m/more/rates/simulator?country=${sheet.key}`) },
          { label: `Flyer du jour · ${sheet.label}`, icon: FileText, onClick: flyer },
        ]}
      />

      {editable && (
        <AdjustSheet
          open={edit.open}
          onClose={edit.hide}
          title={`Écart ${elision(sheet.label)}`}
          subtitle={`vs Cameroun · enregistré ${formatCountryPct(sheet.percentage)}`}
          current={sheet.percentage}
          rows={(pct) => countryRows(activeRate, sheet.percentage, pct)}
          note={`Paiements ${elision(sheet.label)} et flyer`}
          positiveWarning={`Écart positif : plus cher qu’au Cameroun`}
          onSave={save}
          saving={update.isPending}
        />
      )}
    </div>
  );
}
