// ============================================================
// Status-driven narrative cards: "ready for processing", rejection
// reason, and the optional client-visible Bonzini comment.
// ============================================================
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import type { Payment } from '@/hooks/usePayments';

interface Props {
  payment: Payment;
}

export function PaymentStatusMessages({ payment }: Props) {
  const { t } = useTranslation('payments');

  return (
    <>
      {payment.status === 'ready_for_payment' && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-primary">{t('detail.readyForProcessing')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('detail.bonziniWillProcess')}</p>
            </div>
          </div>
        </div>
      )}

      {payment.status === 'rejected' && payment.rejection_reason && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-5 border border-red-200 dark:border-red-800">
          <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">
            {t('detail.rejectionReason')}
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">{payment.rejection_reason}</p>
        </div>
      )}

      {payment.client_visible_comment && (
        <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-5 border border-green-200 dark:border-green-800">
          <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-1">
            {t('detail.bonziniMessage')}
          </p>
          <p className="text-sm text-green-700 dark:text-green-300">{payment.client_visible_comment}</p>
        </div>
      )}
    </>
  );
}
