// ============================================================
// MODULE TAUX — RateChartTab (tendance des taux)
// Présentation migrée sur le design kit (Ofspace/Mola) : sélecteur
// de période en pilules, conteneurs en cartes douces, états via
// ScreenError. Recharts conservé (MultiCurveChart).
// Logique 100% préservée : useDailyRatesForChart(period), périodes.
// ============================================================
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiCurveChart } from '../components/MultiCurveChart';
import { useDailyRatesForChart, type ChartPeriod } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, ScreenError } from '@/mobile/designKit';

export function RateChartTab() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartData, isLoading, isError } = useDailyRatesForChart(period);

  const PERIODS: { key: ChartPeriod; label: string }[] = [
    { key: '7d', label: '7J' },
    { key: '30d', label: '30J' },
    { key: '3m', label: '3M' },
  ];

  return (
    <div className="space-y-4">
      {/* Sélecteur de période — pilule */}
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
                active ? 'bg-[#8B5CF6] text-white' : TEXT.muted,
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
        </div>
      ) : isError ? (
        <ScreenError
          title="Erreur de chargement"
          description="Impossible de charger les données du graphique. Vérifiez que la migration SQL a été exécutée."
        />
      ) : chartData && chartData.length > 0 ? (
        <MultiCurveChart data={chartData} />
      ) : (
        <div className={cn('rounded-2xl p-8 text-center', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('text-[14px]', TEXT.muted)}>Aucune donnée pour cette période</div>
        </div>
      )}
    </div>
  );
}
