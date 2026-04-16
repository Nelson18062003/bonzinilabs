import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateAdjustment } from '@/hooks/useClientManagement';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import type { AdjustmentType } from '@/types/admin';

interface AdjustmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: AdjustmentType;
  userId: string;
  currentBalance: number;
  onSuccess?: () => void;
}

export function AdjustmentDrawer({
  open,
  onOpenChange,
  type,
  userId,
  currentBalance,
  onSuccess,
}: AdjustmentDrawerProps) {
  const { t } = useTranslation('common');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const createAdjustmentMutation = useCreateAdjustment();

  const amountNumber = parseInt(amount.replace(/\D/g, ''), 10) || 0;
  const isDebit = type === 'DEBIT';
  const isInsufficientBalance = isDebit && amountNumber > currentBalance;
  const isValid = amountNumber > 0 && reason.trim().length > 0 && !isInsufficientBalance;

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      await createAdjustmentMutation.mutateAsync({
        userId,
        adjustmentType: type,
        amountXAF: amountNumber,
        reason: reason.trim(),
      });

      // Reset form
      setAmount('');
      setReason('');
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '');
    setAmount(numericValue);
  };

  const handleClose = () => {
    if (!createAdjustmentMutation.isPending) {
      setAmount('');
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            {isDebit ? (
              <>
                <MinusCircle className="w-5 h-5 text-red-500" />
                {t('manualDebit', { defaultValue: 'Débit manuel' })}
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5 text-green-500" />
                {t('manualCredit', { defaultValue: 'Crédit manuel' })}
              </>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Current Balance */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm text-muted-foreground">{t('currentBalance', { defaultValue: 'Solde actuel' })}</p>
            <p className="text-xl font-bold">{formatCurrency(currentBalance)}</p>
          </div>

          {/* Amount Input */}
          <div>
            <Label htmlFor="amount">{t('amountXAF', { defaultValue: 'Montant (XAF)' })} *</Label>
            <div className="relative mt-1.5">
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={amount ? formatCurrency(amountNumber).replace(' XAF', '') : ''}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className={cn(
                  'text-lg font-medium',
                  isInsufficientBalance && 'border-red-500 focus-visible:ring-red-500'
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                XAF
              </span>
            </div>

            {/* Balance Warning */}
            {isDebit && amountNumber > 0 && (
              <div className={cn(
                'mt-2 p-2 rounded-lg text-sm',
                isInsufficientBalance
                  ? 'bg-red-50 text-red-700'
                  : 'bg-muted text-muted-foreground'
              )}>
                {isInsufficientBalance ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t('insufficientBalance', { defaultValue: 'Solde insuffisant' })}
                  </div>
                ) : (
                  <span>
                    {t('newBalance', { defaultValue: 'Nouveau solde' })}: {formatCurrency(currentBalance - amountNumber)}
                  </span>
                )}
              </div>
            )}

            {!isDebit && amountNumber > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('newBalance', { defaultValue: 'Nouveau solde' })}: {formatCurrency(currentBalance + amountNumber)}
              </p>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <Label htmlFor="reason">{t('reason', { defaultValue: 'Motif' })} *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrivez la raison de cet ajustement..."
              className="mt-1.5 min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Le motif sera enregistré dans l'historique et visible par le client.
            </p>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Cette action sera enregistrée avec votre nom et ne peut pas être annulée.
            </p>
          </div>
        </div>

        <DrawerFooter>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createAdjustmentMutation.isPending}
            className={cn(
              'w-full',
              isDebit
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {createAdjustmentMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                {isDebit ? 'Débiter' : 'Créditer'} {amountNumber > 0 && formatCurrency(amountNumber)}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
