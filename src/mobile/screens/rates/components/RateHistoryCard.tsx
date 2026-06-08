// ============================================================
// MODULE TAUX — RateHistoryCard
// Présentation migrée sur le design kit (Ofspace/Mola), calquée
// sur la maquette validée rates.tsx : carte douce, en-tête date +
// StatusPill « Actif » + pilule de variation, grille des 4 modes
// avec vrais logos et gros chiffres.
// Logique 100% préservée : date formatée, variation (cash vs
// précédent), valeurs par mode.
// ============================================================
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { SURFACE, TEXT, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from './MethodLogo';

interface RateHistoryCardProps {
  rate: DailyRate;
  previousRate?: DailyRate;
}

export function RateHistoryCard({ rate, previousRate }: RateHistoryCardProps) {
  const dateStr = format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr });

  // Calculate variation based on cash rate vs previous
  const variation = previousRate
    ? ((rate.rate_cash - previousRate.rate_cash) / previousRate.rate_cash) * 100
    : null;
  const variationStr = variation !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : null;
  const isPositive = variation !== null && variation >= 0;

  const rateValues: Record<string, number> = {
    cash: rate.rate_cash,
    alipay: rate.rate_alipay,
    wechat: rate.rate_wechat,
    virement: rate.rate_virement,
  };

  return (
    <div
      className={cn('rounded-[18px] p-4', SURFACE.card, SURFACE.shadow)}
      style={rate.is_active ? { boxShadow: '0 0 0 2px #8B5CF6' } : undefined}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className={cn('text-[13px]', TEXT.muted)}>{dateStr}</span>
        <div className="flex gap-1.5">
          {rate.is_active && <StatusPill tone="success" label="Actif" />}
          {variationStr && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                isPositive
                  ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
                  : 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
              )}
            >
              {variationStr}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((pm) => (
          <div
            key={pm.key}
            className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2', SURFACE.canvas)}
          >
            <MethodLogo method={pm.key} size={28} />
            <div className="min-w-0">
              <div className={cn('text-[11px]', TEXT.muted)}>{pm.label}</div>
              <div className={cn('text-[14px] font-bold tabular-nums', TEXT.strong)}>
                {rateValues[pm.key].toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
