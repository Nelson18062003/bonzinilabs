// ============================================================
// MODULE TAUX — RateHistoryCard (ligne d'historique compacte)
// Disposition fidèle à la maquette validée rates.tsx : UNE ligne
// par jour (holder + date + « Actif »/variation + valeurs ¥ en
// ligne), regroupées dans une seule carte (séparateur ténu). Le
// détail par mode (vrais logos + libellés) se déplie au tap →
// aucune info perdue.
// Logique 100% préservée : date formatée, variation (cash vs
// précédent), valeurs par mode.
// ============================================================
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { SURFACE, TEXT, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from './MethodLogo';

interface RateHistoryCardProps {
  rate: DailyRate;
  previousRate?: DailyRate;
  /** Pas de séparateur sous la dernière ligne de la carte. */
  isLast?: boolean;
}

export function RateHistoryCard({ rate, previousRate, isLast }: RateHistoryCardProps) {
  const [open, setOpen] = useState(false);
  const dateStr = format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr });

  // Variation basée sur le taux cash vs précédent
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
    <div className={cn(!isLast && 'border-b border-black/[0.05] dark:border-white/[0.06]')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        {/* Holder neutre (maquette) */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#2A2738]">
          <ArrowLeftRight className={cn('h-4 w-4', TEXT.strong)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('text-[14px] font-bold', TEXT.strong)}>{dateStr}</span>
            {rate.is_active && <StatusPill tone="success" label="Actif" />}
            {variationStr && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                  isPositive
                    ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
                    : 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
                )}
              >
                {variationStr}
              </span>
            )}
          </div>
          <div className={cn('mt-0.5 truncate text-[12px] tabular-nums', TEXT.muted)}>
            ¥ {PAYMENT_METHODS.map((pm) => rateValues[pm.key].toLocaleString('fr-FR')).join(' · ')}
          </div>
        </div>

        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, !open && '-rotate-90')} />
      </button>

      {/* Détail par mode — déplié (vrais logos + libellés, aucune info perdue) */}
      {open && (
        <div className="grid grid-cols-2 gap-2 pb-3">
          {PAYMENT_METHODS.map((pm) => (
            <div key={pm.key} className={cn('flex items-center gap-2 rounded-xl px-2.5 py-2', SURFACE.canvas)}>
              <MethodLogo method={pm.key} size={26} />
              <div className="min-w-0">
                <div className={cn('text-[11px]', TEXT.muted)}>{pm.label}</div>
                <div className={cn('text-[14px] font-bold tabular-nums', TEXT.strong)}>
                  {rateValues[pm.key].toLocaleString('fr-FR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
