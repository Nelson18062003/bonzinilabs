import { useState } from 'react';
import { parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, ArrowRightLeft, RefreshCw, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { RateChart } from '@/components/rates/RateChart';
import { RateDateFilter } from '@/components/rates/RateDateFilter';
import {
  useCurrentExchangeRate,
  useExchangeRatesForChart,
  DateRangeFilter,
} from '@/hooks/useExchangeRates';
import { Link } from 'react-router-dom';

type ClientDateFilter = '7d' | '30d' | '3m';

export function ClientRatesPage() {
  const [dateFilter, setDateFilter] = useState<ClientDateFilter>('30d');
  const [xafAmount, setXafAmount] = useState<string>('1000000');
  const [rmbAmount, setRmbAmount] = useState<string>('');

  const { data: currentRate, isLoading, refetch } = useCurrentExchangeRate();
  const { data: chartData, isLoading: chartLoading } = useExchangeRatesForChart(dateFilter as DateRangeFilter);

  const currentRmbToXaf = currentRate ? Math.round(1 / currentRate.rate_xaf_to_rmb) : 86;
  const currentXafToRmb = currentRate?.rate_xaf_to_rmb ?? 0.01163;

  const convertXafToRmb = (xaf: number) => Math.round(xaf * currentXafToRmb);
  const convertRmbToXaf = (rmb: number) => Math.round(rmb / currentXafToRmb);

  const handleXafChange = (value: string) => {
    setXafAmount(value);
    if (value && !isNaN(Number(value))) {
      setRmbAmount(convertXafToRmb(Number(value)).toString());
    } else {
      setRmbAmount('');
    }
  };

  const handleRmbChange = (value: string) => {
    setRmbAmount(value);
    if (value && !isNaN(Number(value))) {
      setXafAmount(convertRmbToXaf(Number(value)).toString());
    } else {
      setXafAmount('');
    }
  };

  const handleFilterChange = (filter: DateRangeFilter) => {
    if (filter === '7d' || filter === '30d' || filter === '3m') {
      setDateFilter(filter);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader title="Taux de change" showBack />
      
      <div className="p-4 space-y-4 pb-24">
        {/* Current Rate Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Taux actuel Bonzini
                </p>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    1 000 000 XAF
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    = {Math.round(1000000 * currentXafToRmb).toLocaleString()} CNY
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  1 CNY = {currentRmbToXaf} XAF
                </p>
                {currentRate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mis à jour le{' '}
                    {format(parseISO(currentRate.effective_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trust message */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  Taux utilisé pour vos paiements
                </p>
                <p className="text-muted-foreground mt-1">
                  Ce taux est appliqué automatiquement lors de vos transferts vers la Chine. 
                  Le taux est verrouillé au moment de la création de chaque paiement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Converter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Simulateur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Montant XAF</Label>
                <Input
                  type="number"
                  value={xafAmount}
                  onChange={(e) => handleXafChange(e.target.value)}
                  className="text-center"
                />
              </div>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground mb-2" />
              <div className="space-y-2">
                <Label className="text-xs">Montant CNY</Label>
                <Input
                  type="number"
                  value={rmbAmount}
                  onChange={(e) => handleRmbChange(e.target.value)}
                  className="text-center"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Évolution du taux</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant={dateFilter === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('7d')}
            >
              7 jours
            </Button>
            <Button
              variant={dateFilter === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('30d')}
            >
              1 mois
            </Button>
            <Button
              variant={dateFilter === '3m' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('3m')}
            >
              3 mois
            </Button>
          </div>
          
          {chartLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center h-[250px]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : (
            <RateChart
              data={chartData || []}
              height={250}
              showHeader={false}
            />
          )}
        </div>

        {/* Link to payments */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Le taux utilisé pour chaque paiement est visible dans le détail de celui-ci.
            </p>
            <Link to="/payments">
              <Button variant="outline" className="w-full">
                Voir mes paiements
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
