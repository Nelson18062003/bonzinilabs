import { useState } from 'react';
import { 
  Plus, 
  TrendingUp,
  Edit,
  Trash2,
  Calculator,
  ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { exchangeRatesHistory, dashboardStats } from '@/data/adminMockData';
import { formatDate } from '@/data/mockData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function AdminRatesPage() {
  const [xafAmount, setXafAmount] = useState<string>('100000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [newRateDialogOpen, setNewRateDialogOpen] = useState(false);
  const [newRate, setNewRate] = useState<string>('87');

  const currentRate = dashboardStats.currentRate;

  const convertXafToRmb = (xaf: number) => Math.round(xaf / currentRate);
  const convertRmbToXaf = (rmb: number) => Math.round(rmb * currentRate);

  const chartData = exchangeRatesHistory.map((rate) => ({
    date: rate.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    rate: rate.rmbToXaf,
  }));

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Taux de change</h1>
          <p className="text-muted-foreground">Gestion des taux XAF ↔ RMB</p>
        </div>
        <Dialog open={newRateDialogOpen} onOpenChange={setNewRateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau taux
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Définir un nouveau taux</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Taux (1 RMB = ? XAF)</Label>
                <Input
                  type="number"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="87"
                />
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Aperçu:</p>
                <p className="text-lg font-semibold">
                  1 RMB = {newRate} XAF
                </p>
                <p className="text-sm text-muted-foreground">
                  100,000 XAF = {Math.round(100000 / Number(newRate || 1)).toLocaleString()} RMB
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setNewRateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => setNewRateDialogOpen(false)}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Rate */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taux actuel</p>
              <p className="text-3xl font-bold text-foreground mt-1">
                1 RMB = {currentRate} XAF
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Mis à jour le {formatDate(new Date())}
              </p>
            </div>
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Converter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulateur de conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <Label>Montant XAF</Label>
              <Input
                type="number"
                value={xafAmount}
                onChange={(e) => handleXafChange(e.target.value)}
                placeholder="100000"
              />
            </div>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 w-full">
              <Label>Montant RMB</Label>
              <Input
                type="number"
                value={rmbAmount}
                onChange={(e) => handleRmbChange(e.target.value)}
                placeholder="1149"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Taux appliqué: 1 RMB = {currentRate} XAF
          </p>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution du taux (10 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des taux</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>1 RMB = XAF</TableHead>
                <TableHead>1 XAF = RMB</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exchangeRatesHistory.slice().reverse().map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">
                    {rate.date.toLocaleDateString('fr-FR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </TableCell>
                  <TableCell>{rate.rmbToXaf}</TableCell>
                  <TableCell>{rate.xafToRmb.toFixed(4)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
