import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  FileDown, 
  Calendar as CalendarIcon,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { generateStatementPDF, isCreditOperation, typeLabel, loadLogoBase64, StatementOperation } from '@/lib/generateStatementPDF';
import { formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface ClientStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientPhone?: string;
  operations: StatementOperation[];
  currentBalance: number;
}

type PeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom';

const OPERATION_TYPE_LABELS: Record<string, string> = {
  deposit: 'Dépôt',
  payment: 'Paiement',
  adjustment: 'Ajustement',
  DEPOSIT_VALIDATED: 'Dépôt',
  DEPOSIT_REFUSED: 'Dépôt refusé',
  PAYMENT_EXECUTED: 'Paiement',
  PAYMENT_RESERVED: 'Paiement réservé',
  PAYMENT_CANCELLED_REFUNDED: 'Remboursement',
  ADMIN_CREDIT: 'Crédit admin',
  ADMIN_DEBIT: 'Débit admin',
};

export function ClientStatementModal({
  open,
  onOpenChange,
  clientName,
  clientPhone,
  operations,
  currentBalance,
}: ClientStatementModalProps) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOperations, setShowOperations] = useState(false);

  // Calculate period dates based on preset
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    
    switch (periodPreset) {
      case 'this_month':
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return {
          periodStart: startOfMonth(lastMonth),
          periodEnd: endOfMonth(lastMonth),
        };
      case 'last_3_months':
        return {
          periodStart: startOfMonth(subMonths(now, 2)),
          periodEnd: endOfMonth(now),
        };
      case 'last_6_months':
        return {
          periodStart: startOfMonth(subMonths(now, 5)),
          periodEnd: endOfMonth(now),
        };
      case 'this_year':
        return {
          periodStart: new Date(now.getFullYear(), 0, 1),
          periodEnd: new Date(now.getFullYear(), 11, 31),
        };
      case 'custom':
        return {
          periodStart: customStartDate || startOfMonth(now),
          periodEnd: customEndDate || endOfMonth(now),
        };
      default:
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
    }
  }, [periodPreset, customStartDate, customEndDate]);

  // Filter operations for the selected period
  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      const opDate = parseISO(op.created_at);
      return isWithinInterval(opDate, { start: periodStart, end: periodEnd });
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [operations, periodStart, periodEnd]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalCredits = 0;
    let totalDebits = 0;
    let depositCount = 0;
    let paymentCount = 0;
    let adjustmentCount = 0;

    filteredOperations.forEach(op => {
      const isCredit = isCreditOperation(op.operation_type, op.balance_before, op.balance_after);

      if (isCredit) {
        totalCredits += op.amount_xaf;
        depositCount++;
      } else {
        totalDebits += op.amount_xaf;
        paymentCount++;
      }

      const label = typeLabel(op.operation_type);
      if (label === 'Ajustement' || label === 'Credit admin' || label === 'Debit admin') {
        adjustmentCount++;
      }
    });

    return { totalCredits, totalDebits, depositCount, paymentCount, adjustmentCount };
  }, [filteredOperations]);

  // Calculate initial balance (balance before first operation in period)
  const initialBalance = useMemo(() => {
    if (filteredOperations.length === 0) {
      return currentBalance;
    }
    // Sort ascending to get first operation
    const sorted = [...filteredOperations].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted[0].balance_before;
  }, [filteredOperations, currentBalance]);

  // Calculate final balance (balance after last operation in period)
  const finalBalance = useMemo(() => {
    if (filteredOperations.length === 0) {
      return currentBalance;
    }
    // Sort ascending to get last operation
    const sorted = [...filteredOperations].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted[sorted.length - 1].balance_after;
  }, [filteredOperations, currentBalance]);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);

    try {
      const logoBase64 = await loadLogoBase64();

      // Sort ascending for PDF
      const sortedOps = [...filteredOperations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      generateStatementPDF({
        clientName,
        clientPhone,
        periodStart,
        periodEnd,
        operations: sortedOps,
        initialBalance,
        finalBalance,
        logoBase64,
      });

      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const presets: { value: PeriodPreset; label: string }[] = [
    { value: 'this_month', label: 'Ce mois' },
    { value: 'last_month', label: 'Mois dernier' },
    { value: 'last_3_months', label: '3 mois' },
    { value: 'last_6_months', label: '6 mois' },
    { value: 'this_year', label: 'Cette année' },
    { value: 'custom', label: 'Personnalisé' },
  ];

  const variation = finalBalance - initialBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mon relevé de compte
          </DialogTitle>
          <DialogDescription>
            Téléchargez votre historique d'opérations en PDF
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Period presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Période</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={periodPreset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          {periodPreset === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customStartDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'dd/MM/yyyy') : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      locale={fr}
                      initialFocus
                      showOutsideDays={false}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customEndDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'dd/MM/yyyy') : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      locale={fr}
                      initialFocus
                      showOutsideDays={false}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">Solde initial</p>
              <p className="text-lg font-semibold">{formatXAF(initialBalance)} XAF</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Solde final</p>
              <p className="text-lg font-semibold text-primary">{formatXAF(finalBalance)} XAF</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Crédits</span>
              </div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                +{formatXAF(stats.totalCredits)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-red-600" />
                <span className="text-xs text-red-700 dark:text-red-400">Débits</span>
              </div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mt-1">
                -{formatXAF(stats.totalDebits)}
              </p>
            </div>
            <div className={cn(
              "p-3 rounded-lg border",
              variation >= 0 
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" 
                : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
            )}>
              <div className="flex items-center gap-2">
                {variation >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={cn(
                  "text-xs",
                  variation >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                )}>Variation</span>
              </div>
              <p className={cn(
                "text-sm font-semibold mt-1",
                variation >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
              )}>
                {variation >= 0 ? '+' : ''}{formatXAF(variation)}
              </p>
            </div>
          </div>

          {/* Operation type breakdown */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {filteredOperations.length} opération{filteredOperations.length > 1 ? 's' : ''}
            </Badge>
            {stats.depositCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                {stats.depositCount} dépôt{stats.depositCount > 1 ? 's' : ''}
              </Badge>
            )}
            {stats.paymentCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {stats.paymentCount} paiement{stats.paymentCount > 1 ? 's' : ''}
              </Badge>
            )}
            {stats.adjustmentCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                {stats.adjustmentCount} ajustement{stats.adjustmentCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Operations list toggle */}
          {filteredOperations.length > 0 && (
            <div className="border rounded-lg">
              <Button
                variant="ghost"
                className="w-full justify-between px-4 py-3 h-auto"
                onClick={() => setShowOperations(!showOperations)}
              >
                <span className="text-sm font-medium">
                  Voir les opérations
                </span>
                <span className="text-xs text-muted-foreground">
                  {showOperations ? 'Masquer' : 'Afficher'}
                </span>
              </Button>
              
              {showOperations && (
                <ScrollArea className="h-48 border-t">
                  <div className="divide-y">
                    {filteredOperations.map((op) => {
                      const isCredit = isCreditOperation(op.operation_type, op.balance_before, op.balance_after);
                      const opLabel = typeLabel(op.operation_type);
                      const isCreditType = isCredit;
                      const isRefund = opLabel === 'Remboursement';

                      return (
                        <div key={op.id} className="px-4 py-2 flex items-center justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  isCreditType && !isRefund && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                  !isCreditType && "bg-blue-50 text-blue-700 border-blue-200",
                                  isRefund && "bg-amber-50 text-amber-700 border-amber-200"
                                )}
                              >
                                {OPERATION_TYPE_LABELS[op.operation_type] || op.operation_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(op.created_at), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            {op.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {op.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className={cn(
                              "font-medium",
                              isCredit ? "text-emerald-600" : "text-red-600"
                            )}>
                              {isCredit ? '+' : '-'}{formatXAF(op.amount_xaf)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Period info */}
          <div className="text-xs text-muted-foreground text-center">
            Période: {format(periodStart, 'dd MMM yyyy', { locale: fr })} → {format(periodEnd, 'dd MMM yyyy', { locale: fr })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button 
            onClick={handleDownloadPDF} 
            disabled={isGenerating || filteredOperations.length === 0}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Télécharger PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
