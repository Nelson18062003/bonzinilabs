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
        <div className="rounded-2xl bg-[#FDF1DD] p-5 dark:bg-[#3A2F1A]">
          <div className="flex items-start gap-3">
            <ScanLine className="mt-0.5 h-5 w-5 text-[#9A6B12] dark:text-[#E0B978]" />
            <div>
              <p className="text-[15px] font-bold text-[#9A6B12] dark:text-[#E0B978]">{t('detail.qrScannedAtOffice')}</p>
              <p className="mt-1 text-[13px] text-[#8A6320] dark:text-[#D0AC78]">{t('detail.processingAtOffice')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completed with signature */}
      {payment.status === 'completed' && payment.cash_signature_url && (
        <div className="rounded-2xl bg-[#DEEFE5] p-5 dark:bg-[#1E3A2C]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#2E7D52] dark:text-[#7FCBA0]" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#2E7D52] dark:text-[#7FCBA0]">{t('detail.cashPaymentCompleted')}</p>
              <p className="mt-1 text-[13px] text-[#3E7D5E] dark:text-[#86C9A4]">
                {t('detail.signatureRecordedOn')}{' '}
                {payment.cash_signature_timestamp &&
                  format(new Date(payment.cash_signature_timestamp), 'dd MMMM yyyy à HH:mm', {
                    locale: fr,
                  })}
              </p>
              {payment.cash_signed_by_name && (
                <p className="text-[13px] text-[#3E7D5E] dark:text-[#86C9A4]">
                  {t('detail.signedBy')}: {payment.cash_signed_by_name}
                </p>
              )}

              <div className="mt-3 rounded-xl bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold text-[#8E8BA0]">
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
