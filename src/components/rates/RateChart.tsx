import { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';

interface RateChartProps {
  data: Array<{
    id: string;
    rate_xaf_to_rmb: number;
    effective_at: string;
  }>;
  title?: string;
  height?: number;
  showHeader?: boolean;
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  value: number;
  formattedDate: string;
  formattedTime: string;
  rawDate: Date;
  change?: number;
  changePercent?: number;
}

export function RateChart({ data, title = "Historique des taux", height = 350, showHeader = true }: RateChartProps) {
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];

    const sorted = [...data].sort((a, b) =>
      new Date(a.effective_at).getTime() - new Date(b.effective_at).getTime()
    );

    return sorted.map((rate, index) => {
      const date = parseISO(rate.effective_at);
      const cnyValue = Math.round(1000000 * rate.rate_xaf_to_rmb);

      // Calculate change from previous rate
      let change = 0;
      let changePercent = 0;
      if (index > 0) {
        const prevValue = Math.round(1000000 * sorted[index - 1].rate_xaf_to_rmb);
        change = cnyValue - prevValue;
        changePercent = ((change / prevValue) * 100);
      }

      return {
        date: rate.effective_at,
        timestamp: date.getTime(),
        value: cnyValue,
        formattedDate: format(date, 'dd MMM yyyy', { locale: fr }),
        formattedTime: format(date, 'HH:mm', { locale: fr }),
        rawDate: date,
        change,
        changePercent,
      };
    });
  }, [data]);

  const { minValue, maxValue, avgValue, trend } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, avgValue: 0, trend: 'stable' };

    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate overall trend
    const firstValue = chartData[0].value;
    const lastValue = chartData[chartData.length - 1].value;
    const overallChange = ((lastValue - firstValue) / firstValue) * 100;

    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (overallChange > 0.5) trendDirection = 'up';
    else if (overallChange < -0.5) trendDirection = 'down';

    return {
      minValue: min,
      maxValue: max,
      avgValue: Math.round(avg),
      trend: trendDirection,
    };
  }, [chartData]);

  // Calculate Y axis domain with SMALLER padding for better visibility
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const range = maxValue - minValue;

    // Use smaller padding: 3% if there's variation, otherwise add fixed amount
    const padding = range > 0 ? range * 0.03 : 50;

    return [
      Math.floor(minValue - padding),
      Math.ceil(maxValue + padding)
    ];
  }, [minValue, maxValue, chartData.length]);

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Aucune donnée disponible pour cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              {title}
            </div>
            <div className="text-sm font-normal text-muted-foreground">
              {chartData.length} point{chartData.length > 1 ? 's' : ''} de données
            </div>
          </CardTitle>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              Min: <strong className="text-red-500">{formatNumber(minValue)} ¥</strong>
            </span>
            <span>
              Max: <strong className="text-green-500">{formatNumber(maxValue)} ¥</strong>
            </span>
            <span>
              Moy: <strong className="text-foreground">{formatNumber(avgValue)} ¥</strong>
            </span>
            {maxValue !== minValue && (
              <span>
                Variation: <strong className="text-primary">
                  {formatNumber((maxValue - minValue) / minValue * 100, 2)}%
                </strong>
              </span>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--muted-foreground))"
              opacity={0.2}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(timestamp: number) => {
                const date = new Date(timestamp);
                return format(date, 'dd/MM', { locale: fr });
              }}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))', opacity: 0.5 }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))', opacity: 0.5 }}
              height={40}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(value: number) => `${formatNumber(value)} ¥`}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))', opacity: 0.5 }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))', opacity: 0.5 }}
              width={80}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-foreground text-sm">
                      {data.formattedDate}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {data.formattedTime}
                    </p>
                    <p className="text-primary font-bold text-xl">
                      {formatNumber(data.value)} ¥
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      pour 1 000 000 FCFA
                    </p>
                    {data.change !== undefined && data.change !== 0 && (
                      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                        data.change > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {data.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {data.change > 0 ? '+' : ''}{formatNumber(data.change)} ¥
                        ({data.changePercent && data.changePercent > 0 ? '+' : ''}
                        {formatNumber(data.changePercent || 0, 2)}%)
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {/* Average reference line */}
            <ReferenceLine
              y={avgValue}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
              label={{
                value: 'Moyenne',
                position: 'right',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11
              }}
            />
            {/* Area under the line */}
            <Area
              type="monotone"
              dataKey="value"
              fill="url(#colorValue)"
              stroke="none"
            />
            {/* Main line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{
                fill: 'hsl(var(--primary))',
                strokeWidth: 2,
                r: 5,
                stroke: 'hsl(var(--background))'
              }}
              activeDot={{
                r: 8,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 3
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
