import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

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
}

export function RateChart({ data, title = "Historique des taux", height = 300, showHeader = true }: RateChartProps) {
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];
    
    return data.map((rate) => {
      const date = parseISO(rate.effective_at);
      const cnyValue = Math.round(1000000 / (1 / rate.rate_xaf_to_rmb));
      
      return {
        date: rate.effective_at,
        timestamp: date.getTime(),
        value: cnyValue,
        formattedDate: format(date, 'dd MMM yyyy', { locale: fr }),
        formattedTime: format(date, 'HH:mm', { locale: fr }),
        rawDate: date,
      };
    });
  }, [data]);

  const { minValue, maxValue, avgValue } = useMemo(() => {
    if (chartData.length === 0) return { minValue: 0, maxValue: 0, avgValue: 0 };
    
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    return {
      minValue: min,
      maxValue: max,
      avgValue: Math.round(avg),
    };
  }, [chartData]);

  // Calculate Y axis domain with padding
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    const padding = (maxValue - minValue) * 0.1 || 50;
    return [Math.floor(minValue - padding), Math.ceil(maxValue + padding)];
  }, [minValue, maxValue, chartData.length]);

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
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Min: <strong className="text-foreground">{minValue.toLocaleString()} CNY</strong></span>
            <span>Max: <strong className="text-foreground">{maxValue.toLocaleString()} CNY</strong></span>
            <span>Moy: <strong className="text-foreground">{avgValue.toLocaleString()} CNY</strong></span>
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(timestamp: number) => {
                const date = new Date(timestamp);
                return format(date, 'dd/MM', { locale: fr });
              }}
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(value: number) => value.toLocaleString()}
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              className="text-muted-foreground"
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-foreground">
                      {data.formattedDate} à {data.formattedTime}
                    </p>
                    <p className="text-primary font-bold text-lg">
                      {data.value.toLocaleString()} CNY
                    </p>
                    <p className="text-sm text-muted-foreground">
                      pour 1 000 000 XAF
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={avgValue}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
