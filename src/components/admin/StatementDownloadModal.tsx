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
} from 'lucide-react';
import { generateStatementPDF, StatementOperation } from '@/lib/generateStatementPDF';
import { formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface StatementDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientPhone?: string;
  userId: string;
  operations: StatementOperation[];
  currentBalance: number;
}

type PeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

export function StatementDownloadModal({
  open,
  onOpenChange,
  clientName,
  clientPhone,
  operations,
  currentBalance,
}: StatementDownloadModalProps) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

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
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [operations, periodStart, periodEnd]);

  // Calculate initial balance (balance before first operation in period)
  const initialBalance = useMemo(() => {
    if (filteredOperations.length === 0) {
      return currentBalance;
    }
    return filteredOperations[0].balance_before;
  }, [filteredOperations, currentBalance]);

  // Calculate final balance (balance after last operation in period)
  const finalBalance = useMemo(() => {
    if (filteredOperations.length === 0) {
      return currentBalance;
    }
    return filteredOperations[filteredOperations.length - 1].balance_after;
  }, [filteredOperations, currentBalance]);

  const handleDownload = async () => {
    setIsGenerating(true);
    
    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      generateStatementPDF({
        clientName,
        clientPhone,
        periodStart,
        periodEnd,
        operations: filteredOperations,
        initialBalance,
        finalBalance,
      });
      
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const presets: { value: PeriodPreset; label: string }[] = [
    { value: 'this_month', label: 'Ce mois' },
    { value: 'last_month', label: 'Mois dernier' },
    { value: 'last_3_months', label: '3 derniers mois' },
    { value: 'custom', label: 'Personnalisé' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Télécharger le relevé
          </DialogTitle>
          <DialogDescription>
            Générer un relevé de compte PDF pour {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Period presets */}
          <div className="space-y-3">
            <Label>Période</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={periodPreset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodPreset(preset.value)}
                  className="justify-start"
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
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Période sélectionnée</span>
              <span className="font-medium">
                {format(periodStart, 'dd MMM yyyy', { locale: fr })} - {format(periodEnd, 'dd MMM yyyy', { locale: fr })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mouvements</span>
              <span className="font-medium">{filteredOperations.length}</span>
            </div>
            <div className="border-t pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Solde initial</span>
                <span>{formatXAF(initialBalance)} XAF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Solde final</span>
                <span className="font-bold text-primary">{formatXAF(finalBalance)} XAF</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleDownload} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Télécharger PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
