import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BonziniCard } from '@/components/ui/bonzini-card';

interface ResponsiveRateChartProps {
  data: Array<{
    date: string;
    xaf_to_cny: number;
  }>;
  title?: string;
}

export const ResponsiveRateChart = ({ data, title = "Évolution du taux (1 000 000 XAF → CNY)" }: ResponsiveRateChartProps) => {
  const chartData = useMemo(() =>
    data.map(rate => ({
      date: format(parseISO(rate.date), 'dd/MM', { locale: fr }),
      fullDate: format(parseISO(rate.date), 'dd MMMM yyyy', { locale: fr }),
      value: rate.xaf_to_cny,
    })),
    [data]
  );

  return (
    <BonziniCard variant="admin" className="p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">
        {title}
      </h2>

      {/* Chart responsive : 250px mobile, 300px tablet, 350px desktop */}
      <div className="w-full h-[250px] sm:h-[300px] lg:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '14px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`${Math.round(value).toLocaleString()} CNY`, '1 000 000 XAF']}
              labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </BonziniCard>
  );
};
