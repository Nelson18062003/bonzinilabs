import { useState } from 'react';
import { 
  Plus, 
  TrendingUp,
  Calculator,
  ArrowRightLeft,
  Loader2,
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
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useExchangeRates, useAddExchangeRate } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';

export function AdminRatesPage() {
  const [xafAmount, setXafAmount] = useState<string>('100000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [newRateDialogOpen, setNewRateDialogOpen] = useState(false);
  const [newRate, setNewRate] = useState<string>('87');

  const { data: rates, isLoading } = useExchangeRates();
  const addRate = useAddExchangeRate();

  const currentRate = rates?.[0]?.rate_xaf_to_rmb ?? 0.01167;
  const rmbToXaf = 1 / currentRate;

  const convertXafToRmb = (xaf: number) => Math.round(xaf * currentRate);
  const convertRmbToXaf = (rmb: number) => Math.round(rmb / currentRate);

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

  const handleAddRate = async () => {
    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue <= 0) return;
    
    // Convert from RMB to XAF rate to XAF to RMB rate
    const xafToRmbRate = 1 / rateValue;
    
    await addRate.mutateAsync(xafToRmbRate);
    setNewRateDialogOpen(false);
    setNewRate('87');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
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
                  <Button onClick={handleAddRate} disabled={addRate.isPending}>
                    {addRate.isPending ? 'Enregistrement...' : 'Enregistrer'}
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
                  1 RMB = {rmbToXaf.toFixed(2)} XAF
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Mis à jour le {rates?.[0] ? formatDate(rates[0].effective_date) : 'N/A'}
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
              Taux appliqué: 1 RMB = {rmbToXaf.toFixed(2)} XAF
            </p>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des taux</CardTitle>
          </CardHeader>
          <CardContent>
            {rates && rates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>1 RMB = XAF</TableHead>
                    <TableHead>1 XAF = RMB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {formatDate(rate.effective_date, 'long')}
                      </TableCell>
                      <TableCell>{(1 / rate.rate_xaf_to_rmb).toFixed(2)}</TableCell>
                      <TableCell>{rate.rate_xaf_to_rmb.toFixed(5)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun taux enregistré</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}