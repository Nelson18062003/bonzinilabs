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
import { AmountField, TextArea } from '@/components/form';
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
  const [amountNumber, setAmountNumber] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const createAdjustmentMutation = useCreateAdjustment();

  const amount = amountNumber ?? 0;
  const isDebit = type === 'DEBIT';
  const isInsufficientBalance = isDebit && amount > currentBalance;
  const isValid = amount > 0 && reason.trim().length > 0 && !isInsufficientBalance;

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      await createAdjustmentMutation.mutateAsync({
        userId,
        adjustmentType: type,
        amountXAF: amount,
        reason: reason.trim(),
      });

      // Reset form
      setAmountNumber(null);
      setReason('');
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    if (!createAdjustmentMutation.isPending) {
      setAmountNumber(null);
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
            <AmountField
              id="amount"
              label={`${t('amountXAF', { defaultValue: 'Montant (XAF)' })} *`}
              currency="XAF"
              value={amountNumber}
              onValueChange={setAmountNumber}
              enterKeyHint="next"
              error={isInsufficientBalance ? t('insufficientBalance', { defaultValue: 'Solde insuffisant' }) : undefined}
            />

            {/* Balance preview */}
            {isDebit && amount > 0 && !isInsufficientBalance && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('newBalance', { defaultValue: 'Nouveau solde' })}: {formatCurrency(currentBalance - amount)}
              </p>
            )}

            {!isDebit && amount > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('newBalance', { defaultValue: 'Nouveau solde' })}: {formatCurrency(currentBalance + amount)}
              </p>
            )}
          </div>

          {/* Reason Input */}
          <TextArea
            id="reason"
            label={`${t('reason', { defaultValue: 'Motif' })} *`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('adjustmentReasonPlaceholder', { defaultValue: 'Décrivez la raison de cet ajustement...' })}
            controlClassName="min-h-[100px]"
            hint={t('reasonRecordedNote', { defaultValue: "Le motif sera enregistré dans l'historique et visible par le client." })}
          />

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {t('actionCannotBeUndone', { defaultValue: 'Cette action sera enregistrée avec votre nom et ne peut pas être annulée.' })}
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
                {t('processing', { defaultValue: 'Traitement...' })}
              </>
            ) : (
              <>
                {isDebit ? t('debit', { defaultValue: 'Débiter' }) : t('credit', { defaultValue: 'Créditer' })} {amount > 0 && formatCurrency(amount)}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            {t('cancel', { defaultValue: 'Annuler' })}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
