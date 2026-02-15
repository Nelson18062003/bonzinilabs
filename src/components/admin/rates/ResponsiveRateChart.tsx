import { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DateRangeFilter } from '@/hooks/useExchangeRates';

const PERIOD_TABS: { value: DateRangeFilter; label: string }[] = [
  { value: '7d', label: '7J' },
  { value: '30d', label: '30J' },
  { value: '3m', label: '3M' },
  { value: '12m', label: '1A' },
];

interface ChartDataPoint {
  date: string;
  timestamp: number;
  value: number;
  formattedDate: string;
  formattedTime: string;
  change: number;
  changePercent: number;
}

interface ResponsiveRateChartProps {
  data: Array<{
    date: string;
    xaf_to_cny: number;
  }>;
  activePeriod: DateRangeFilter;
  onPeriodChange: (period: DateRangeFilter) => void;
}

export function ResponsiveRateChart({ data, activePeriod, onPeriodChange }: ResponsiveRateChartProps) {
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];

    return data.map((rate, index) => {
      const date = parseISO(rate.date);
      const value = rate.xaf_to_cny;

      let change = 0;
      let changePercent = 0;
      if (index > 0) {
        const prevValue = data[index - 1].xaf_to_cny;
        change = value - prevValue;
        changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;
      }

      return {
        date: rate.date,
        timestamp: date.getTime(),
        value,
        formattedDate: format(date, 'dd MMM yyyy', { locale: fr }),
        formattedTime: format(date, 'HH:mm', { locale: fr }),
        change,
        changePercent,
      };
    });
  }, [data]);

  const { minValue, maxValue, avgValue, yDomain } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, avgValue: 0, yDomain: [0, 100] as [number, number] };

    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    const range = max - min;
    const padding = range > 0 ? range * 0.1 : 50;

    return {
      minValue: min,
      maxValue: max,
      avgValue: avg,
      yDomain: [Math.floor(min - padding), Math.ceil(max + padding)] as [number, number],
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="space-y-4">
        {/* Period Tabs */}
        <div className="bg-muted rounded-lg p-1 flex">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onPeriodChange(tab.value)}
              className={cn(
                'flex-1 py-1.5 text-sm font-medium rounded-md transition-all',
                activePeriod === tab.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          Aucune donnée pour cette période
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Tabs — iOS segmented control */}
      <div className="bg-muted rounded-lg p-1 flex">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onPeriodChange(tab.value)}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-md transition-all',
              activePeriod === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts: number) => format(new Date(ts), 'dd/MM', { locale: fr })}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              height={30}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v: number) => `${formatNumber(v)}`}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload as ChartDataPoint;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-foreground text-sm">{d.formattedDate}</p>
                    <p className="text-xs text-muted-foreground mb-2">{d.formattedTime}</p>
                    <p className="text-primary font-bold text-xl">
                      {formatNumber(d.value)} ¥
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">pour 1 000 000 XAF</p>
                    {d.change !== 0 && (
                      <div className={cn(
                        'flex items-center gap-1 mt-2 text-xs font-medium',
                        d.change > 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        {d.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {d.change > 0 ? '+' : ''}{formatNumber(d.change)} ¥
                        ({d.changePercent > 0 ? '+' : ''}{formatNumber(d.changePercent, 2)}%)
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={avgValue}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="value"
              fill="url(#rateGradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{
                fill: 'hsl(var(--primary))',
                strokeWidth: 2,
                r: 4,
                stroke: 'hsl(var(--background))',
              }}
              activeDot={{
                r: 7,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 3,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-muted-foreground">
          Min: <strong className="text-red-500">{formatNumber(minValue)} ¥</strong>
        </span>
        <span className="text-muted-foreground">
          Moy: <strong className="text-foreground">{formatNumber(avgValue)} ¥</strong>
        </span>
        <span className="text-muted-foreground">
          Max: <strong className="text-green-500">{formatNumber(maxValue)} ¥</strong>
        </span>
      </div>
    </div>
  );
}
