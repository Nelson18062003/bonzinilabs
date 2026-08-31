/**
 * Taux — carte C « Historique » (docs/admin-redesign/06).
 *
 * Sur mobile chaque jour est une ligne dépliable ; sur desktop c'est une
 * vraie table : une colonne par mode, la variation (cash vs précédent) en
 * pastille, la ligne active surlignée. Tout est lisible sans un seul clic.
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useDailyRatesHistory } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, Card, CardHeader, Holder, ScreenLoader, ScreenError, StatusPill, Th, Td } from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';

function variationOf(rate: DailyRate, previous?: DailyRate): number | null {
  if (!previous || !previous.rate_cash) return null;
  return ((rate.rate_cash - previous.rate_cash) / previous.rate_cash) * 100;
}

export function DesktopRateHistory() {
  const { data: history, isLoading, isError } = useDailyRatesHistory(20);

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0">
      <CardHeader title="Historique" meta={history ? `${history.length} publications` : undefined} />
      {isLoading ? (
        <ScreenLoader />
      ) : isError ? (
        <ScreenError title="Erreur de chargement" description="Impossible de charger l'historique." />
      ) : !history || history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Holder icon={Clock} size="lg" />
          <p className={cn('mt-3 text-[13px]', TEXT.muted)}>Aucun historique de taux</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
              <tr>
                <Th first>Date</Th>
                {PAYMENT_METHODS.map((pm) => (
                  <Th key={pm.key} align="right">
                    <span className="inline-flex items-center gap-1">
                      <MethodLogo method={pm.key} size={14} />
                      {pm.label}
                    </span>
                  </Th>
                ))}
                <Th last align="right">Δ cash</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((rate, i) => {
                const variation = variationOf(rate, history[i + 1]);
                const up = variation !== null && variation >= 0;
                return (
                  <tr key={rate.id} className={cn(rate.is_active && 'bg-[#EDEAFA]/50 dark:bg-white/[0.05]')}>
                    <Td first>
                      <div className="leading-[15px]">
                        <div className={cn('flex items-center gap-1.5 text-[12px] font-bold', TEXT.strong)}>
                          {format(parseISO(rate.effective_at), 'dd MMM yyyy', { locale: fr })}
                          {rate.is_active && <StatusPill tone="success" label="Actif" />}
                        </div>
                        <div className={cn('text-[10.5px] tabular-nums', TEXT.muted)}>
                          {format(parseISO(rate.effective_at), 'HH:mm')}
                        </div>
                      </div>
                    </Td>
                    <Td align="right" className={cn('text-[12.5px] font-semibold tabular-nums', TEXT.strong)}>
                      {rate.rate_cash.toLocaleString('fr-FR')}
                    </Td>
                    <Td align="right" className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>
                      {rate.rate_alipay.toLocaleString('fr-FR')}
                    </Td>
                    <Td align="right" className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>
                      {rate.rate_wechat.toLocaleString('fr-FR')}
                    </Td>
                    <Td align="right" className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>
                      {rate.rate_virement.toLocaleString('fr-FR')}
                    </Td>
                    <Td last align="right">
                      {variation !== null ? (
                        <span
                          className={cn(
                            'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            up
                              ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
                              : 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
                          )}
                        >
                          {up ? '+' : ''}
                          {variation.toFixed(1)}%
                        </span>
                      ) : (
                        <span className={cn('text-[11px]', TEXT.muted)}>—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
