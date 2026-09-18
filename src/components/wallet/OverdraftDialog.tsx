/**
 * Autoriser / modifier / retirer le découvert d'un client — super admin.
 *
 * Même formulaire sur mobile (feuille basse) et desktop (fenêtre centrée) :
 * le solde et le découvert actuels, quatre paliers, un montant libre, un
 * motif obligatoire, et un bouton « Retirer le découvert » quand il y en a
 * un. La RPC `admin_set_wallet_overdraft` refuse de descendre le plafond
 * sous le découvert déjà utilisé ; le formulaire le dit avant d'envoyer.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { isValidXafAmount } from '@/lib/amountLimits';
import { OVERDRAFT_PRESETS_XAF, overdraftUsedXaf } from '@/lib/overdraft';
import { useSetWalletOverdraft } from '@/hooks/useClientManagement';
import { AmountField, TextArea } from '@/components/form';
import { SURFACE, TEXT, TYPE, Amount, BottomSheet, Chip, PrimaryPill, SoftPill, Button } from '@/mobile/designKit';
import { CenterDialog } from '@/desktop/designKit';

interface OverdraftDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  clientName: string;
  currentBalance: number;
  currentLimit: number;
  currentNote?: string | null;
  onSuccess?: () => void;
  variant?: 'sheet' | 'dialog';
}

export function OverdraftDialog({
  open, onClose, userId, clientName, currentBalance, currentLimit, currentNote, onSuccess, variant = 'sheet',
}: OverdraftDialogProps) {
  const { t } = useTranslation('common');
  const setOverdraft = useSetWalletOverdraft();
  const [limit, setLimit] = useState<number | null>(currentLimit > 0 ? currentLimit : null);
  const [reason, setReason] = useState(currentNote ?? '');

  useEffect(() => {
    if (open) {
      setLimit(currentLimit > 0 ? currentLimit : null);
      setReason(currentNote ?? '');
    }
  }, [open, currentLimit, currentNote]);

  const used = overdraftUsedXaf(currentBalance);
  const amount = limit ?? 0;
  const belowUsed = amount < used;
  const unchanged = amount === currentLimit && reason.trim() === (currentNote ?? '').trim();
  const isValid = isValidXafAmount(amount) && reason.trim().length > 0 && !belowUsed && !unchanged;

  const submit = async (value: number, note: string) => {
    if (setOverdraft.isPending) return;
    try {
      await setOverdraft.mutateAsync({ userId, limitXaf: value, reason: note });
      onSuccess?.();
      onClose();
    } catch {
      /* toast déjà affiché par la mutation */
    }
  };

  const body = (
    <div className="space-y-4">
      <div className={cn('grid grid-cols-2 gap-3 rounded-lg p-3', SURFACE.inset)}>
        <div>
          <p className={cn(TYPE.small, TEXT.muted)}>{t('overdraft.currentBalance')}</p>
          <Amount value={formatCurrency(currentBalance)} size="md" className={cn('mt-0.5', currentBalance < 0 && 'text-[#C00F0C] dark:text-[#FCB3AD]')} />
        </div>
        <div>
          <p className={cn(TYPE.small, TEXT.muted)}>{t('overdraft.currentLimit')}</p>
          <Amount value={currentLimit > 0 ? formatCurrency(currentLimit) : t('overdraft.none')} size="md" className="mt-0.5" />
        </div>
      </div>

      <div className="space-y-2">
        <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('overdraft.newLimit')}</p>
        <div className="flex flex-wrap gap-2">
          {OVERDRAFT_PRESETS_XAF.map((preset) => (
            <Chip key={preset} label={formatCurrency(preset)} active={limit === preset} onClick={() => setLimit(preset)} className="h-10 text-[14px]" />
          ))}
        </div>
        <AmountField
          id="overdraft-limit"
          label={t('overdraft.customLimit')}
          currency="XAF"
          value={limit}
          onValueChange={setLimit}
          max={null}
          error={belowUsed ? t('overdraft.belowUsed', { amount: formatCurrency(used) }) : undefined}
        />
        {amount > 0 && !belowUsed && (
          <p className={cn(TYPE.small, TEXT.muted)}>
            {t('overdraft.floorHint', { amount: formatCurrency(-amount) })}
          </p>
        )}
      </div>

      <TextArea
        id="overdraft-reason"
        label={`${t('overdraft.reason')} *`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('overdraft.reasonPlaceholder')}
        controlClassName="min-h-[88px]"
      />

      <div className="flex gap-2 rounded-lg bg-[#FFF1C2] p-3 dark:bg-[#522504]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#682D03] dark:text-[#FFF1C2]" />
        <p className="text-[14px] leading-relaxed text-[#682D03] dark:text-[#FFF1C2]">{t('overdraft.warning', { name: clientName })}</p>
      </div>
    </div>
  );

  const primary = (
    <PrimaryPill onClick={() => void submit(amount, reason.trim())} disabled={!isValid} loading={setOverdraft.isPending} className="w-full">
      {currentLimit > 0 ? t('overdraft.update') : t('overdraft.grant')}
    </PrimaryPill>
  );
  const remove = currentLimit > 0 && used === 0 ? (
    <Button variant="dangerSubtle" onClick={() => void submit(0, '')} disabled={setOverdraft.isPending} className="w-full">
      {t('overdraft.remove')}
    </Button>
  ) : null;

  if (variant === 'dialog') {
    return (
      <CenterDialog
        open={open}
        onClose={onClose}
        onConfirm={() => void submit(amount, reason.trim())}
        title={t('overdraft.title')}
        width={520}
        footer={
          <>
            {primary}
            <SoftPill onClick={onClose} className="flex-1">{t('cancel')}</SoftPill>
          </>
        }
      >
        {body}
        {remove && <div className="mt-3">{remove}</div>}
      </CenterDialog>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('overdraft.title')}>
      {body}
      <div className="mt-5 flex flex-col gap-2">
        {primary}
        {remove}
        <SoftPill onClick={onClose} className="w-full">{t('cancel')}</SoftPill>
      </div>
    </BottomSheet>
  );
}
