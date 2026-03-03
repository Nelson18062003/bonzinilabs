import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';

interface RateHistoryCardProps {
  rate: DailyRate;
  previousRate?: DailyRate;
}

export function RateHistoryCard({ rate, previousRate }: RateHistoryCardProps) {
  const dateStr = format(parseISO(rate.effective_at), "dd MMM yyyy 'a' HH:mm", { locale: fr });

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
      className="bg-white rounded-[14px] p-4 shadow-sm"
      style={{
        border: rate.is_active ? '2px solid #7c3aed' : '1px solid #f0f0f0',
      }}
    >
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[13px] text-muted-foreground">{dateStr}</span>
        <div className="flex gap-1.5">
          {rate.is_active && (
            <span className="bg-green-100 text-green-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Actif
            </span>
          )}
          {variationStr && (
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
              }`}
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
            className="flex items-center gap-1.5 px-2.5 py-2 bg-muted/50 rounded-lg"
          >
            <span className="text-base">{pm.icon}</span>
            <div>
              <div className="text-[11px] text-muted-foreground">{pm.label}</div>
              <div className="text-sm font-bold text-foreground">
                {rateValues[pm.key].toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
