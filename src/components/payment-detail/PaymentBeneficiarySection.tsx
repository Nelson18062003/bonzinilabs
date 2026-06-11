// ============================================================
// Read-only beneficiary section. Refonte « Direction A » (designKit) :
// carte blanche ombre douce, « Verrouillé » en pastille neutre, lien
// Modifier violet, état vide en ambre. CopyableField conservé.
// Logique 100% PRÉSERVÉE (branches cash / alipay-wechat / bank, édition).
// ============================================================
import { useTranslation } from 'react-i18next';
import { AlertCircle, Banknote, Edit2, Lock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyableField } from '@/mobile/components/payments/CopyableField';
import type { Payment } from '@/hooks/usePayments';
import { SURFACE, TEXT, PrimaryPill } from '@/mobile/designKit';
import { isStatusEditable, isStatusLocked } from './types';

interface Props {
  payment: Payment;
  onEdit: () => void;
  onViewQr: (url: string) => void;
}

export function PaymentBeneficiarySection({ payment, onEdit, onViewQr }: Props) {
  const { t } = useTranslation('payments');

  const canEdit = isStatusEditable(payment.status);
  const isLocked = isStatusLocked(payment.status);

  // "Has any beneficiary info" — drives the empty-state vs filled-state branch.
  const hasBeneficiaryInfo =
    payment.method === 'cash' ||
    payment.beneficiary_qr_code_url ||
    payment.beneficiary_name ||
    payment.beneficiary_phone ||
    payment.beneficiary_email ||
    payment.beneficiary_bank_account;

  return (
    <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cn('flex items-center gap-2 text-[15px] font-bold', TEXT.strong)}>
          <User className={cn('h-4 w-4', TEXT.muted)} />
          {t('detail.beneficiary')}
        </h3>
        {isLocked ? (
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>
            <Lock className="h-3 w-3" />
            {t('detail.locked')}
          </span>
        ) : canEdit && hasBeneficiaryInfo && payment.method !== 'cash' ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[12px] font-bold text-[#5B4CC4] transition-transform active:scale-95 dark:text-[#B5AAF0]"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t('detail.edit')}
          </button>
        ) : null}
      </div>

      {/* Cash branch */}
      {payment.method === 'cash' && (
        <div className="py-4 text-center">
          <div className={cn('mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full', SURFACE.holder)}>
            <Banknote className="h-6 w-6" />
          </div>
          <p className={cn('text-[14px] font-bold', TEXT.strong)}>{t('detail.cashPayment')}</p>
          <p className={cn('text-[12px]', TEXT.muted)}>{t('detail.cashQrWillBeGenerated')}</p>
          {payment.cash_qr_code && (
            <div className="mt-3">
              <img src={payment.cash_qr_code} alt="QR Code Cash" className="mx-auto h-32 w-32 rounded-lg" />
            </div>
          )}
        </div>
      )}

      {/* Empty state for non-cash */}
      {payment.method !== 'cash' && !hasBeneficiaryInfo && (
        <div className="rounded-2xl bg-[#FDF1DD] py-6 text-center dark:bg-[#3A2F1A]">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[#9A6B12] dark:text-[#E0B978]" />
          <p className={cn('text-[15px] font-bold', TEXT.strong)}>{t('detail.missingInfo')}</p>
          <p className={cn('mb-4 mt-1 text-[13px]', TEXT.muted)}>{t('detail.addBeneficiaryPrompt')}</p>
          {canEdit && (
            <div className="flex justify-center">
              <PrimaryPill onClick={onEdit}>{t('detail.addInfo')}</PrimaryPill>
            </div>
          )}
        </div>
      )}

      {/* Filled state for non-cash */}
      {payment.method !== 'cash' && hasBeneficiaryInfo && (
        <div>
          {payment.beneficiary_qr_code_url && ['alipay', 'wechat'].includes(payment.method) && (
            <div className="mb-4 flex justify-center">
              <button onClick={() => onViewQr(payment.beneficiary_qr_code_url!)} className="transition-transform active:scale-[0.98]">
                <img
                  src={payment.beneficiary_qr_code_url}
                  alt={t('detail.form.qrBeneficiary')}
                  className="h-[200px] w-[200px] rounded-xl bg-white object-contain"
                />
                <p className="mt-2 text-center text-[12px] font-semibold text-[#5B4CC4] dark:text-[#B5AAF0]">
                  {t('detail.tapToEnlarge')}
                </p>
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {payment.beneficiary_name && (
              <CopyableField label={t('detail.fields.name')} value={payment.beneficiary_name} copyLabel={t('detail.fields.beneficiaryName')} />
            )}
            {payment.beneficiary_identifier && (
              <CopyableField
                label={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
                value={payment.beneficiary_identifier}
                copyLabel={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
              />
            )}
            {payment.beneficiary_phone && (
              <CopyableField label={t('detail.fields.phone')} value={payment.beneficiary_phone} copyLabel={t('detail.fields.beneficiaryPhone')} />
            )}
            {payment.beneficiary_email && (
              <CopyableField label={t('detail.fields.email')} value={payment.beneficiary_email} copyLabel={t('detail.fields.beneficiaryEmail')} />
            )}
            {payment.beneficiary_bank_name && (
              <CopyableField label={t('detail.fields.bank')} value={payment.beneficiary_bank_name} copyLabel={t('detail.fields.bank')} />
            )}
            {payment.beneficiary_bank_account && (
              <CopyableField label={t('detail.fields.accountNumber')} value={payment.beneficiary_bank_account} copyLabel={t('detail.fields.accountNumber')} />
            )}
            {payment.beneficiary_bank_extra && (
              <CopyableField label="SWIFT / IBAN" value={payment.beneficiary_bank_extra} copyLabel="SWIFT / IBAN" />
            )}
            {payment.beneficiary_notes && (
              <div className="border-t border-black/[0.06] pt-2 dark:border-white/[0.08]">
                <p className={cn('mb-1 text-[11px]', TEXT.muted)}>{t('detail.fields.notes')}</p>
                <p className={cn('text-[14px]', TEXT.strong)}>{payment.beneficiary_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
