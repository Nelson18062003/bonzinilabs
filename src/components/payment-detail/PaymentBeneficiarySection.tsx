// ============================================================
// Read-only beneficiary section. Renders the appropriate display
// for cash / alipay-wechat / bank, with a "Modifier" affordance
// when the payment is still editable.
// ============================================================
import { useTranslation } from 'react-i18next';
import { AlertCircle, Banknote, Edit2, Lock, User } from 'lucide-react';
import { CopyableField } from '@/mobile/components/payments/CopyableField';
import { Button } from '@/components/ui/button';
import type { Payment } from '@/hooks/usePayments';
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
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <User className="w-4 h-4" />
          {t('detail.beneficiary')}
        </h3>
        {isLocked ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            {t('detail.locked')}
          </span>
        ) : canEdit && hasBeneficiaryInfo && payment.method !== 'cash' ? (
          <button
            onClick={onEdit}
            className="text-xs font-medium text-primary active:scale-95 transition-transform flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {t('detail.edit')}
          </button>
        ) : null}
      </div>

      {/* Cash branch */}
      {payment.method === 'cash' && (
        <div className="text-center py-4">
          <Banknote className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">{t('detail.cashPayment')}</p>
          <p className="text-xs text-muted-foreground">{t('detail.cashQrWillBeGenerated')}</p>
          {payment.cash_qr_code && (
            <div className="mt-3">
              <img
                src={payment.cash_qr_code}
                alt="QR Code Cash"
                className="w-32 h-32 mx-auto rounded-lg border"
              />
            </div>
          )}
        </div>
      )}

      {/* Empty state for non-cash */}
      {payment.method !== 'cash' && !hasBeneficiaryInfo && (
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <p className="font-medium">{t('detail.missingInfo')}</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t('detail.addBeneficiaryPrompt')}
          </p>
          {canEdit && <Button onClick={onEdit}>{t('detail.addInfo')}</Button>}
        </div>
      )}

      {/* Filled state for non-cash */}
      {payment.method !== 'cash' && hasBeneficiaryInfo && (
        <div>
          {payment.beneficiary_qr_code_url && ['alipay', 'wechat'].includes(payment.method) && (
            <div className="flex justify-center mb-4">
              <button
                onClick={() => onViewQr(payment.beneficiary_qr_code_url!)}
                className="active:scale-[0.98] transition-transform"
              >
                <img
                  src={payment.beneficiary_qr_code_url}
                  alt={t('detail.form.qrBeneficiary')}
                  className="w-[200px] h-[200px] rounded-xl border-2 border-border object-contain bg-white"
                />
                <p className="text-xs text-primary mt-2 text-center">
                  {t('detail.tapToEnlarge')}
                </p>
              </button>
            </div>
          )}

          <div className="space-y-2.5 text-sm">
            {payment.beneficiary_name && (
              <CopyableField
                label={t('detail.fields.name')}
                value={payment.beneficiary_name}
                copyLabel={t('detail.fields.beneficiaryName')}
              />
            )}
            {payment.beneficiary_identifier && (
              <CopyableField
                label={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
                value={payment.beneficiary_identifier}
                copyLabel={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
              />
            )}
            {payment.beneficiary_phone && (
              <CopyableField
                label={t('detail.fields.phone')}
                value={payment.beneficiary_phone}
                copyLabel={t('detail.fields.beneficiaryPhone')}
              />
            )}
            {payment.beneficiary_email && (
              <CopyableField
                label={t('detail.fields.email')}
                value={payment.beneficiary_email}
                copyLabel={t('detail.fields.beneficiaryEmail')}
              />
            )}
            {payment.beneficiary_bank_name && (
              <CopyableField
                label={t('detail.fields.bank')}
                value={payment.beneficiary_bank_name}
                copyLabel={t('detail.fields.bank')}
              />
            )}
            {payment.beneficiary_bank_account && (
              <CopyableField
                label={t('detail.fields.accountNumber')}
                value={payment.beneficiary_bank_account}
                copyLabel={t('detail.fields.accountNumber')}
              />
            )}
            {payment.beneficiary_bank_extra && (
              <CopyableField
                label="SWIFT / IBAN"
                value={payment.beneficiary_bank_extra}
                copyLabel="SWIFT / IBAN"
              />
            )}
            {payment.beneficiary_notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">{t('detail.fields.notes')}</p>
                <p className="text-sm">{payment.beneficiary_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
