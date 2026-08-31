/**
 * Taux — carte D « Tendance » (docs/admin-redesign/06).
 *
 * Le graphique n'est plus enterré dans un accordéon : c'est la surface de
 * surveillance du module. Périodes en chips dans l'en-tête — dont 1 AN, que
 * le hook supportait depuis toujours sans qu'aucune UI ne l'expose.
 * Courbes/stats/écarts : MultiCurveChart (Recharts) réutilisé tel quel.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useDailyRatesForChart, type ChartPeriod } from '@/hooks/useDailyRates';
import { TEXT, Card, CardHeader, Chip, ScreenLoader, ScreenError } from '@/desktop/designKit';
import { MultiCurveChart } from '@/mobile/screens/rates/components/MultiCurveChart';

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: '7d', label: '7J' },
  { key: '30d', label: '30J' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1A' },
];

export function RateTrendCard() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartData, isLoading, isError } = useDailyRatesForChart(period);

  return (
    <Card className="p-0">
      <CardHeader
        title="Tendance des taux"
        meta={
          <span className="inline-flex items-center gap-1.5">
            {PERIODS.map((p) => (
              <Chip key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
            ))}
          </span>
        }
      />
      <div className="p-4">
        {isLoading ? (
          <ScreenLoader />
        ) : isError ? (
          <ScreenError title="Erreur de chargement" description="Impossible de charger les données du graphique." />
        ) : chartData && chartData.length > 0 ? (
          <MultiCurveChart data={chartData} />
        ) : (
          <div className={cn('py-14 text-center text-[13px]', TEXT.muted)}>Aucune donnée pour cette période</div>
        )}
      </div>
    </Card>
  );
}
