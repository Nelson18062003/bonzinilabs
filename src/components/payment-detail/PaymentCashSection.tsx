// ============================================================
// Cash-method specific blocks: the QR to present at the office,
// the "scanned" notice, and the completed-with-signature card.
// Renders nothing when the payment method is not cash.
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { CashQRCode } from '@/components/cash/CashQRCode';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import type { Payment } from '@/hooks/usePayments';

interface Props {
  payment: Payment;
}

export function PaymentCashSection({ payment }: Props) {
  const { t } = useTranslation('payments');

  if (payment.method !== 'cash') return null;

  const isFinalised = payment.status === 'completed' || payment.status === 'rejected';

  return (
    <>
      {/* QR to present at the office, while still actionable */}
      {!isFinalised && (
        <CashQRCode
          paymentId={payment.id}
          paymentReference={payment.reference}
          amountRMB={payment.amount_rmb}
          beneficiaryName={payment.beneficiary_name || 'Client'}
        />
      )}

      {/* Scanned notice */}
      {payment.status === 'cash_scanned' && (
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-2xl p-5 border border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-3">
            <ScanLine className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-600">{t('detail.qrScannedAtOffice')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('detail.processingAtOffice')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completed with signature */}
      {payment.status === 'completed' && payment.cash_signature_url && (
        <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-5 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-600">{t('detail.cashPaymentCompleted')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('detail.signatureRecordedOn')}{' '}
                {payment.cash_signature_timestamp &&
                  format(new Date(payment.cash_signature_timestamp), 'dd MMMM yyyy à HH:mm', {
                    locale: fr,
                  })}
              </p>
              {payment.cash_signed_by_name && (
                <p className="text-sm text-muted-foreground">
                  {t('detail.signedBy')}: {payment.cash_signed_by_name}
                </p>
              )}

              <div className="mt-3 p-3 bg-white rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  {t('detail.beneficiarySignature')}
                </p>
                <img
                  src={payment.cash_signature_url}
                  alt={t('detail.beneficiarySignature')}
                  className="w-full max-w-xs h-auto rounded"
                  style={{ maxHeight: '120px', objectFit: 'contain' }}
                />
              </div>

              <div className="mt-3">
                <CashReceiptDownloadButton
                  payment={payment}
                  variant="outline"
                  size="sm"
                  label={t('detail.downloadReceiptPDF')}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
