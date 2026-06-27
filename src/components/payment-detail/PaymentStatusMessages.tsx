// ============================================================
// Messages de statut — fiche v7 : la narration générique (prêt /
// en cours / terminé) vit désormais dans le Suivi ; ne restent ici
// que les cartes porteuses d'information : motif de rejet,
// annulation admin et message de Bonzini (client_visible_comment,
// toujours prioritaire — piège #10).
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
