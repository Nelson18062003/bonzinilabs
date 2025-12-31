import { useState } from 'react';
import { parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  TrendingUp,
  Calculator,
  ArrowRightLeft,
  Loader2,
  Pencil,
  Trash2,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { RateChart } from '@/components/rates/RateChart';
import { RateDateFilter } from '@/components/rates/RateDateFilter';
import { RateFormDialog } from '@/components/rates/RateFormDialog';
import {
  useExchangeRates,
  useExchangeRatesForChart,
  useCurrentExchangeRate,
  useAddExchangeRate,
  useUpdateExchangeRate,
  useDeleteExchangeRate,
  useCheckRateUsage,
  DateRangeFilter,
} from '@/hooks/useExchangeRates';

interface DateRange {
  from: Date;
  to: Date;
}

export function AdminRatesPage() {
  // UI State
  const [xafAmount, setXafAmount] = useState<string>('1000000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRate, setEditingRate] = useState<{
    id: string;
    rateRmbToXaf: number;
    effectiveAt: Date;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<string | null>(null);

  // Data hooks
  const { data: rates, isLoading } = useExchangeRates(dateFilter, customRange);
  const { data: chartData } = useExchangeRatesForChart(dateFilter, customRange);
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: rateUsage } = useCheckRateUsage(rateToDelete || undefined);
  
  // Mutation hooks
  const addRate = useAddExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const deleteRate = useDeleteExchangeRate();

  // Calculations
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

  const handleCreateRate = () => {
    setFormMode('create');
    setEditingRate(null);
    setFormDialogOpen(true);
  };

  const handleEditRate = (rate: typeof rates extends (infer T)[] ? T : never) => {
    setFormMode('edit');
    setEditingRate({
      id: rate.id,
      rateRmbToXaf: Math.round(1 / rate.rate_xaf_to_rmb),
      effectiveAt: parseISO(rate.effective_at),
    });
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (rateId: string) => {
    setRateToDelete(rateId);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (data: { rateRmbToXaf: number; effectiveAt: Date }) => {
    if (formMode === 'create') {
      await addRate.mutateAsync(data);
    } else if (editingRate) {
      await updateRate.mutateAsync({
        rateId: editingRate.id,
        ...data,
      });
    }
    setFormDialogOpen(false);
    setEditingRate(null);
  };

  const handleDeleteConfirm = async () => {
    if (rateToDelete) {
      await deleteRate.mutateAsync(rateToDelete);
    }
    setDeleteDialogOpen(false);
    setRateToDelete(null);
  };

  const getRateStatus = (rate: typeof rates extends (infer T)[] ? T : never) => {
    if (currentRate?.id === rate.id) {
      return { label: 'Actif', variant: 'default' as const };
    }
    return null;
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
            <p className="text-muted-foreground">Gestion des taux XAF ↔ CNY</p>
          </div>
          <Button onClick={handleCreateRate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau taux
          </Button>
        </div>

        {/* Current Rate Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux actuel</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  1 000 000 XAF = {Math.round(1000000 * currentXafToRmb).toLocaleString()} CNY
                </p>
                <p className="text-lg text-muted-foreground">
                  (1 CNY = {currentRmbToXaf} XAF)
                </p>
                {currentRate && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mis à jour le{' '}
                    {format(parseISO(currentRate.effective_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart with filters */}
        <div className="space-y-4">
          <RateDateFilter
            filter={dateFilter}
            onFilterChange={setDateFilter}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <RateChart
            data={chartData || []}
            title="Évolution du taux (1 000 000 XAF → CNY)"
            height={350}
          />
        </div>

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
                  placeholder="1000000"
                />
              </div>
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 w-full">
                <Label>Montant CNY</Label>
                <Input
                  type="number"
                  value={rmbAmount}
                  onChange={(e) => handleRmbChange(e.target.value)}
                  placeholder="11600"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Taux appliqué: 1 CNY = {currentRmbToXaf} XAF
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Heure</TableHead>
                      <TableHead className="text-right">1 000 000 XAF</TableHead>
                      <TableHead className="text-right">1 CNY</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => {
                      const status = getRateStatus(rate);
                      const cnyValue = Math.round(1000000 / (1 / rate.rate_xaf_to_rmb));
                      const xafPerCny = Math.round(1 / rate.rate_xaf_to_rmb);
                      
                      return (
                        <TableRow key={rate.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {cnyValue.toLocaleString()} CNY
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {xafPerCny.toLocaleString()} XAF
                          </TableCell>
                          <TableCell>
                            {status && (
                              <Badge variant={status.variant}>{status.label}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditRate(rate)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(rate.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Aucun taux enregistré pour cette période
              </p>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <RateFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          onSubmit={handleFormSubmit}
          isLoading={addRate.isPending || updateRate.isPending}
          mode={formMode}
          initialData={editingRate || undefined}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce taux ?</AlertDialogTitle>
              <AlertDialogDescription>
                {rateUsage?.isUsed ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <Lock className="h-4 w-4" />
                    Ce taux a été utilisé dans {rateUsage.usageCount} paiement(s) et ne peut pas être supprimé.
                  </div>
                ) : (
                  'Cette action est irréversible. Le taux sera définitivement supprimé.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={rateUsage?.isUsed || deleteRate.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteRate.isPending ? 'Suppression...' : 'Supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
