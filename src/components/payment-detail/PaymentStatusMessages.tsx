// ============================================================
// Status-driven narrative cards.
// Renders zero or more PaymentStatusCards depending on the current
// payment state and any client-visible message Bonzini left.
// ============================================================
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import type { Payment } from '@/hooks/usePayments';
import { PaymentStatusCard } from './PaymentStatusCard';

interface Props {
  payment: Payment;
}

export function PaymentStatusMessages({ payment }: Props) {
  const { t } = useTranslation('payments');

  return (
    <>
      {payment.status === 'ready_for_payment' && (
        <PaymentStatusCard
          variant="info"
          title={t('detail.readyForProcessing')}
          description={t('detail.bonziniWillProcess')}
        />
      )}

      {payment.status === 'processing' && (
        <PaymentStatusCard
          variant="progress"
          spinIcon
          title={t('statusConfig.processing')}
          description={t('detail.bonziniWillProcess')}
        />
      )}

      {payment.status === 'completed' && payment.method !== 'cash' && (
        <PaymentStatusCard
          variant="success"
          title={t('statusConfig.completed')}
        />
      )}

      {payment.status === 'rejected' && payment.rejection_reason && (
        <PaymentStatusCard
          variant="rejected"
          title={t('detail.rejectionReason')}
          description={payment.rejection_reason}
        />
      )}

      {payment.status === 'cancelled_by_admin' && (
        <PaymentStatusCard
          variant="cancelled"
          icon={Lock}
          title={t('statusConfig.cancelled_by_admin')}
        />
      )}

      {payment.client_visible_comment && (
        <PaymentStatusCard
          variant="message"
          title={t('detail.bonziniMessage')}
          description={payment.client_visible_comment}
        />
      )}
    </>
  );
}
