/**
 * Le résultat d'une simulation. Une phrase avant un chiffre ; chaque ligne dit
 * sa confiance (vert : texte officiel ou DAU réelle ; ambre : estimé) ; le
 * rouge n'est jamais un montant, c'est une action.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { LEVIES } from '@/lib/customs/levies';
import type { LiquidationLine, Simulation } from '@/lib/customs/engine';
import type { TariffLine } from '@/lib/customs/nomenclature';
import { ConfidenceDot } from '../shared';
import { isSure, pct, ratePct, xaf } from '../format';
import { useLevyLabel, useNoteText } from '../useCustomsText';

/** La confiance d'une ligne de la DAU, compte tenu du code choisi. */
function lineSure(l: LiquidationLine, sim: Simulation, tariff: TariffLine): boolean {
  if (l.code === 'DDI') return tariff.rateHow === 0 && tariff.rateMin === tariff.rateMax;
  if (l.code === 'DAC') return isSure(sim.excise.confidence) && sim.excise.certainty === 'sure';
  if (l.code === 'TVA' || l.code === 'CAC') return sim.vat.exempt !== 'maybe';
  return isSure(LEVIES[l.code].confidence);
}

function LevyRow({ line, sure, note }: { line: LiquidationLine; sure: boolean; note?: string }) {
  const { t } = useTranslation('customs');
  const label = useLevyLabel()(line);
  const rate = line.rate == null ? t('sim.fixed') : line.code === 'TVA' && line.rate === 0 ? t('sim.exempt') : ratePct(line.rate);
  return (
    <li className={cn('flex items-start gap-3 border-b py-2.5 last:border-b-0', SURFACE.divider)}>
      <ConfidenceDot sure={sure} className="mt-2" />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[16px] font-medium leading-snug', TEXT.strong)}>{label}</span>
        <span className={cn('block text-[14px] leading-snug', TEXT.muted)}>
          {rate}{note ? ` · ${note}` : ''}
        </span>
      </span>
      <span className={cn('shrink-0 text-[16px] font-semibold tabular-nums', TEXT.strong)}>{xaf(line.amount)}</span>
    </li>
  );
}

export function SimulationResult({ sim, tariff }: { sim: Simulation; tariff: TariffLine }) {
  const { t } = useTranslation('customs');
  const noteText = useNoteText();
  const warnings = sim.notes.filter((n) => n.kind !== 'action');
  const actions = sim.notes.filter((n) => n.kind === 'action');
  const outsideTotal = sim.outside.reduce((n, l) => n + l.amount, 0);

  return (
    <div className="space-y-4">
      {/* La phrase, puis le chiffre. */}
      <Card className="space-y-3 p-5">
        <p className={cn(TYPE.body, TEXT.muted)}>{t('sim.headline')}</p>
        <p className={cn('text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>{xaf(sim.dau.total)}</p>
        <p className={cn(TYPE.body, TEXT.body)}>{t('sim.sharePct', { pct: pct(sim.effectiveRate) })}</p>
        {outsideTotal > 0 && (
          <p className={cn(TYPE.body, TEXT.body)}>{t('sim.withOutside', { amount: xaf(sim.totalToPay) })}</p>
        )}
        <div className={cn('flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5', SURFACE.inset)}>
          <span className={cn(TYPE.body, TEXT.body)}>{t('sim.landed')}</span>
          <span className={cn('text-[18px] font-semibold tabular-nums', TEXT.strong)}>{xaf(sim.landedXaf)}</span>
        </div>
      </Card>

      {/* La valeur taxée : ce que la douane additionne avant de calculer. */}
      <Card>
        <h3 className={cn('mb-1', TYPE.bodyStrong, TEXT.strong)}>{t('sim.valueTitle')}</h3>
        <dl className="text-[16px]">
          {[
            [t('sim.goods'), sim.goodsXaf],
            [t('sim.freightLine'), sim.freightXaf],
            [sim.insuranceEstimated ? t('sim.insuranceEstimated') : t('sim.insuranceLine'), sim.insuranceXaf],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-3 py-1">
              <dt className={TEXT.muted}>{k}</dt>
              <dd className={cn('tabular-nums', TEXT.body)}>{xaf(Number(v))}</dd>
            </div>
          ))}
          <div className={cn('mt-1 flex justify-between gap-3 border-t pt-2', SURFACE.divider)}>
            <dt className={cn('font-semibold', TEXT.strong)}>{t('sim.customsValue')}</dt>
            <dd className={cn('font-semibold tabular-nums', TEXT.strong)}>{xaf(sim.customsValue)}</dd>
          </div>
        </dl>
      </Card>

      {/* Les lignes de la DAU. */}
      <Card>
        <h3 className={cn('mb-1', TYPE.bodyStrong, TEXT.strong)}>{t('sim.dauTitle')}</h3>
        <ul>
          {sim.dau.lines.map((l) => (
            <LevyRow
              key={l.code}
              line={l}
              sure={lineSure(l, sim, tariff)}
              note={l.code === 'DAC' && sim.excise.rate > 0 ? sim.excise.basis.split(' — ')[0] : undefined}
            />
          ))}
        </ul>
        <div className={cn('mt-1 flex justify-between gap-3 border-t pt-2', SURFACE.divider)}>
          <span className={cn('font-semibold', TEXT.strong)}>{t('sim.total')}</span>
          <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{xaf(sim.dau.total)}</span>
        </div>
      </Card>

      {sim.outside.length > 0 && (
        <Card>
          <h3 className={cn('mb-1', TYPE.bodyStrong, TEXT.strong)}>{t('sim.outsideTitle')}</h3>
          <ul>
            {sim.outside.map((l) => (
              <LevyRow key={l.code} line={l} sure={isSure(LEVIES[l.code].confidence)} note={l.code === 'PRE' ? t('sim.creditable') : undefined} />
            ))}
          </ul>
        </Card>
      )}

      {warnings.length > 0 && (
        <section className="space-y-2">
          <h3 className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('sim.notesWarn')}</h3>
          <ul className="space-y-2">
            {warnings.map((n, i) => (
              <li key={`${n.id}-${i}`} className={cn('flex gap-3 rounded-lg p-3', n.kind === 'warning' ? 'bg-[#FFF1C2] dark:bg-[#522504]' : SURFACE.inset)}>
                {n.kind === 'warning'
                  ? <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#975102] dark:text-[#E8B931]" />
                  : <Info aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', TEXT.muted)} />}
                <span className={cn('text-[16px] leading-snug', n.kind === 'warning' ? 'text-[#682D03] dark:text-[#FFF1C2]' : TEXT.body)}>{noteText(n)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actions.length > 0 && (
        <Card className="space-y-2 border-[#FDD3D0] dark:border-[#900B09]">
          <h3 className={cn('flex items-center gap-2', TYPE.bodyStrong, 'text-[#C00F0C] dark:text-[#FCB3AD]')}>
            <ShieldCheck aria-hidden className="h-5 w-5" /> {t('sim.notesAction')}
          </h3>
          <ul className="list-disc space-y-2 pl-5">
            {actions.map((n) => (
              <li key={n.id} className={cn('text-[16px] leading-snug', TEXT.body)}>{noteText(n)}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className={cn('space-y-2 text-[14px] leading-snug', TEXT.muted)}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-2"><ConfidenceDot sure /> {t('sim.legendSure')}</span>
          <span className="inline-flex items-center gap-2"><ConfidenceDot sure={false} /> {t('sim.legendEstimate')}</span>
        </p>
        <p>{t('sim.disclaimer')}</p>
        <p>{t('sim.sources')}</p>
      </div>
    </div>
  );
}
