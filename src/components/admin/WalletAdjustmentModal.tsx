import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAdminAdjustWallet, AdjustmentType } from '@/hooks/useAdminAdjustWallet';
import { formatXAF } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface WalletAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  clientName: string;
  currentBalance: number;
}

export function WalletAdjustmentModal({
  open,
  onOpenChange,
  userId,
  clientName,
  currentBalance,
}: WalletAdjustmentModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const adjustWallet = useAdminAdjustWallet();

  const parsedAmount = parseInt(amount) || 0;
  const newBalance = adjustmentType === 'credit' 
    ? currentBalance + parsedAmount 
    : currentBalance - parsedAmount;

  const isDebitExceedsBalance = adjustmentType === 'debit' && parsedAmount > currentBalance;
  const canSubmit = parsedAmount > 0 && reason.trim().length >= 3 && !isDebitExceedsBalance;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await adjustWallet.mutateAsync({
      userId,
      amount: parsedAmount,
      adjustmentType,
      reason: reason.trim(),
    });

    // Reset form and close
    setAmount('');
    setReason('');
    setAdjustmentType('credit');
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!adjustWallet.isPending) {
      setAmount('');
      setReason('');
      setAdjustmentType('credit');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustement manuel</DialogTitle>
          <DialogDescription>
            Modifier le solde de {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current balance */}
          <div className="p-4 bg-secondary/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Solde actuel</p>
            <p className="text-2xl font-bold">{formatXAF(currentBalance)} XAF</p>
          </div>

          {/* Adjustment type */}
          <div className="space-y-3">
            <Label>Type d'ajustement</Label>
            <RadioGroup
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
              className="grid grid-cols-2 gap-4"
            >
              <label
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  adjustmentType === 'credit'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border hover:border-emerald-500/50'
                )}
              >
                <RadioGroupItem value="credit" className="sr-only" />
                <ArrowUpCircle className={cn(
                  'h-6 w-6',
                  adjustmentType === 'credit' ? 'text-emerald-500' : 'text-muted-foreground'
                )} />
                <div>
                  <p className="font-semibold">Crédit</p>
                  <p className="text-xs text-muted-foreground">Ajouter au solde</p>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  adjustmentType === 'debit'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-border hover:border-red-500/50'
                )}
              >
                <RadioGroupItem value="debit" className="sr-only" />
                <ArrowDownCircle className={cn(
                  'h-6 w-6',
                  adjustmentType === 'debit' ? 'text-red-500' : 'text-muted-foreground'
                )} />
                <div>
                  <p className="font-semibold">Débit</p>
                  <p className="text-xs text-muted-foreground">Retirer du solde</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Montant (XAF)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            />
            {parsedAmount > 0 && (
              <p className="text-sm text-muted-foreground">
                {formatXAF(parsedAmount)} XAF
              </p>
            )}
          </div>

          {/* Debit exceeds balance warning */}
          {isDebitExceedsBalance && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">Le montant dépasse le solde disponible</p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Ex: Geste commercial, correction d'erreur, remboursement..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">
              Ce motif sera visible sur le relevé du client
            </p>
          </div>

          {/* Preview new balance */}
          {parsedAmount > 0 && !isDebitExceedsBalance && (
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nouveau solde</span>
                <span className={cn(
                  'font-bold',
                  adjustmentType === 'credit' ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {formatXAF(newBalance)} XAF
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Variation</span>
                <span>
                  {adjustmentType === 'credit' ? '+' : '-'}{formatXAF(parsedAmount)} XAF
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={adjustWallet.isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || adjustWallet.isPending}
            className={cn(
              adjustmentType === 'credit' 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-red-600 hover:bg-red-700'
            )}
          >
            {adjustWallet.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                En cours...
              </>
            ) : (
              <>
                {adjustmentType === 'credit' ? (
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                )}
                Confirmer {adjustmentType === 'credit' ? 'le crédit' : 'le débit'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
