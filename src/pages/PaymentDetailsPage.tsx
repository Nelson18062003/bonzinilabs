// ============================================================
// APP CLIENT — « Coordonnées de paiement » : nos banques et nos numéros
// Mobile Money, à copier, ou à télécharger en PDF ou en images (portrait
// ou paysage). Tout le contenu vient de PaymentDetailsHub, partagé avec
// l'app de l'équipe.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { PaymentDetailsHub } from '@/components/payment-details/PaymentDetailsHub';

const PaymentDetailsPage = () => {
  const { t } = useTranslation('deposits');
  const navigate = useNavigate();
  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh] pb-8', SURFACE.canvas)}>
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('paymentDetails.back', { defaultValue: 'Retour' })}
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
          >
            <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
          </button>
          <h1 className={cn('flex-1 truncate text-[17px] font-black', TEXT.strong)}>{t('paymentDetails.title', { defaultValue: 'Coordonnées de paiement' })}</h1>
        </div>
        <div className="px-4 pt-3">
          <PaymentDetailsHub audience="client" />
        </div>
      </div>
    </MobileLayout>
  );
};

export default PaymentDetailsPage;
