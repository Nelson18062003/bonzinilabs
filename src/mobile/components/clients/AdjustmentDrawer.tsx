import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateAdjustment } from '@/hooks/useClientManagement';
import { formatCurrency } from '@/lib/formatters';
import { isValidXafAmount } from '@/lib/amountLimits';
import { cn } from '@/lib/utils';
import { AmountField, TextArea } from '@/components/form';
import {
  AlertTriangle,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import type { AdjustmentType } from '@/types/admin';
import {
  SURFACE,
  TEXT,
  Amount,
  BottomSheet,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';

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
  // Même garde d'entier que dépôts et paiements ; pas de plafond.
  const isValid = isValidXafAmount(amount) && reason.trim().length > 0 && !isInsufficientBalance;

  const handleSubmit = async () => {
    // isPending : un double-tap pendant la mutation créerait deux ajustements.
    if (!isValid || createAdjustmentMutation.isPending) return;

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
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={
        isDebit ? (
          <span className="flex items-center gap-2">
            <MinusCircle className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />
            {t('manualDebit', { defaultValue: 'Débit manuel' })}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[#02542D] dark:text-[#CFF7D3]" />
            {t('manualCredit', { defaultValue: 'Crédit manuel' })}
          </span>
        )
      }
    >
      <div className="space-y-4">
        {/* Current Balance */}
        <div className={cn('rounded-lg p-3', SURFACE.canvas)}>
          <p className={cn('text-[14px]', TEXT.muted)}>{t('currentBalance', { defaultValue: 'Solde actuel' })}</p>
          <Amount value={formatCurrency(currentBalance)} size="md" className="mt-0.5" />
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
            <p className={cn('mt-2 text-[14px]', TEXT.muted)}>
              {t('newBalance', { defaultValue: 'Nouveau solde' })}: {formatCurrency(currentBalance - amount)}
            </p>
          )}

          {!isDebit && amount > 0 && (
            <p className={cn('mt-2 text-[14px]', TEXT.muted)}>
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
        <div className="flex gap-2 rounded-lg bg-[#FFF1C2] p-3 dark:bg-[#522504]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#682D03] dark:text-[#FFF1C2]" />
          <p className="text-[14px] text-[#682D03] dark:text-[#FFF1C2]">
            {t('actionCannotBeUndone', { defaultValue: 'Cette action sera enregistrée avec votre nom et ne peut pas être annulée.' })}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <PrimaryPill
          onClick={handleSubmit}
          disabled={!isValid}
          loading={createAdjustmentMutation.isPending}
          danger={isDebit}
          className="w-full"
        >
          {isDebit ? t('debit', { defaultValue: 'Débiter' }) : t('credit', { defaultValue: 'Créditer' })} {amount > 0 && formatCurrency(amount)}
        </PrimaryPill>
        <SoftPill onClick={handleClose} className="w-full">
          {t('cancel', { defaultValue: 'Annuler' })}
        </SoftPill>
      </div>
    </BottomSheet>
  );
}
