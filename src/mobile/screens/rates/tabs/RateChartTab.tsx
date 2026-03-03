import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MultiCurveChart } from '../components/MultiCurveChart';
import { useDailyRatesForChart, type ChartPeriod } from '@/hooks/useDailyRates';

export function RateChartTab() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const { data: chartData, isLoading } = useDailyRatesForChart(period);

  const PERIODS: { key: ChartPeriod; label: string }[] = [
    { key: '7d', label: '7J' },
    { key: '30d', label: '30J' },
    { key: '3m', label: '3M' },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex bg-white rounded-xl p-0.5 shadow-sm">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer border-0 transition-colors ${
              period === p.key
                ? 'bg-purple-600 text-white'
                : 'bg-transparent text-muted-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : chartData && chartData.length > 0 ? (
        <MultiCurveChart data={chartData} />
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-muted-foreground text-sm">Aucune donnee pour cette periode</div>
        </div>
      )}
    </div>
  );
}
