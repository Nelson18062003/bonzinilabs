import { useState, useMemo } from 'react';
import { parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  Plus,
  TrendingUp,
  Calculator,
  ArrowRightLeft,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { ResponsiveRateChart } from '@/components/admin/rates/ResponsiveRateChart';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DATE_FILTERS: { value: DateRangeFilter; label: string }[] = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '3m' },
  { value: '1y', label: '1an' },
];

export function MobileRatesScreen() {
  // UI State
  const [xafAmount, setXafAmount] = useState<string>('1000000');
  const [rmbAmount, setRmbAmount] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('30d');

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRate, setEditingRate] = useState<{
    id: string;
    rateRmbToXaf: number;
    effectiveAt: Date;
  } | null>(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<string | null>(null);

  // Data hooks
  const { data: rates, isLoading } = useExchangeRates(dateFilter, undefined);
  const { data: rawChartData } = useExchangeRatesForChart(dateFilter, undefined);
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: rateUsage } = useCheckRateUsage(rateToDelete || undefined);

  // Transform chart data
  const chartData = useMemo(() =>
    rawChartData?.map(rate => ({
      date: rate.effective_at,
      xaf_to_cny: Math.round(1000000 * rate.rate_xaf_to_rmb),
    })) || []
  , [rawChartData]);

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

  const handleEditRate = (rate: any) => {
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
    setDeleteDrawerOpen(true);
  };

  const handleFormSubmit = async (data: { rateRmbToXaf: number; effectiveAt: Date }) => {
    try {
      if (formMode === 'create') {
        await addRate.mutateAsync(data);
        toast.success('Taux créé');
      } else if (editingRate) {
        await updateRate.mutateAsync({
          rateId: editingRate.id,
          ...data,
        });
        toast.success('Taux modifié');
      }
      setFormDialogOpen(false);
      setEditingRate(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteConfirm = async () => {
    if (rateToDelete) {
      try {
        await deleteRate.mutateAsync(rateToDelete);
        toast.success('Taux supprimé');
      } catch {
        // Error handled by mutation
      }
    }
    setDeleteDrawerOpen(false);
    setRateToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <MobileHeader title="Taux de change" backTo="/m/more" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Taux de change"
        backTo="/m/more"
        showBack
        rightElement={
          <button
            onClick={handleCreateRate}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Current Rate */}
        <div className="px-4 py-4">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux actuel</p>
                <p className="text-2xl font-bold mt-1">
                  1M XAF = {Math.round(1000000 * currentXafToRmb).toLocaleString()} CNY
                </p>
                <p className="text-sm text-muted-foreground">
                  1 CNY = {currentRmbToXaf} XAF
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
            </div>
            {currentRate && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-primary/10">
                Mis à jour le{' '}
                {format(parseISO(currentRate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            )}
          </div>
        </div>

        {/* Date filter chips */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  dateFilter === filter.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <ResponsiveRateChart
              data={chartData}
              title="Évolution (1M XAF → CNY)"
            />
          </div>
        </div>

        {/* Converter */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Convertisseur</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">XAF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={xafAmount ? parseInt(xafAmount).toLocaleString('fr-FR') : ''}
                  onChange={(e) => handleXafChange(e.target.value.replace(/\D/g, ''))}
                  placeholder="1 000 000"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-center">
                <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">CNY</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmbAmount ? parseFloat(rmbAmount).toLocaleString('fr-FR') : ''}
                  onChange={(e) => handleRmbChange(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="11 670"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate History */}
        <div className="px-4 pb-6">
          <h3 className="font-semibold mb-3">Historique des taux</h3>
          <div className="space-y-2">
            {rates?.map((rate) => {
              const cnyValue = Math.round(1000000 * rate.rate_xaf_to_rmb);
              const xafPerCny = Math.round(1 / rate.rate_xaf_to_rmb);
              const isActive = currentRate?.id === rate.id;

              return (
                <Drawer key={rate.id}>
                  <DrawerTrigger asChild>
                    <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            1M XAF = {cnyValue.toLocaleString()} CNY
                          </p>
                          {isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Actif
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Détails du taux</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="p-4 rounded-xl bg-muted/50">
                        <div className="flex justify-between mb-2">
                          <span className="text-muted-foreground">1 000 000 XAF</span>
                          <span className="font-bold">{cnyValue.toLocaleString()} CNY</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">1 CNY</span>
                          <span className="font-bold">{xafPerCny.toLocaleString()} XAF</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Date d'effet</span>
                        <span>{format(parseISO(rate.effective_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                      </div>
                    </div>
                    <DrawerFooter className="flex-row gap-3">
                      <button
                        onClick={() => handleEditRate(rate)}
                        className="flex-1 h-12 rounded-xl border border-border flex items-center justify-center gap-2 font-medium"
                      >
                        <Pencil className="w-4 h-4" />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteClick(rate.id)}
                        className="flex-1 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center gap-2 font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              );
            })}

            {(!rates || rates.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Aucun taux pour cette période
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rate Form Dialog */}
      <RateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSubmit={handleFormSubmit}
        isLoading={addRate.isPending || updateRate.isPending}
        mode={formMode}
        initialData={editingRate || undefined}
      />

      {/* Delete Confirmation Drawer */}
      <Drawer open={deleteDrawerOpen} onOpenChange={setDeleteDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Supprimer ce taux ?</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {rateUsage?.isUsed ? (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                Ce taux a été utilisé dans {rateUsage.usageCount} paiement(s) et ne peut pas être supprimé.
              </div>
            ) : (
              <p className="text-muted-foreground">
                Cette action est irréversible. Le taux sera définitivement supprimé.
              </p>
            )}
          </div>
          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <button className="flex-1 h-12 rounded-xl border border-border font-medium">
                Annuler
              </button>
            </DrawerClose>
            <button
              onClick={handleDeleteConfirm}
              disabled={rateUsage?.isUsed || deleteRate.isPending}
              className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground font-medium disabled:opacity-50"
            >
              {deleteRate.isPending ? 'Suppression...' : 'Supprimer'}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
