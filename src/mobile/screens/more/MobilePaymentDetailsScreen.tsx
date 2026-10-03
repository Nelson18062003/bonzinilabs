// ============================================================
// APP ÉQUIPE — « Coordonnées de paiement » (mobile et bureau) : nos banques
// et nos numéros Mobile Money, à copier, ou à envoyer à un client en PDF ou
// en images, en portrait ou en paysage. Même contenu que la page client
// (PaymentDetailsHub). Ouvert à toute l'équipe : ce sont les coordonnées que
// nous donnons nous-mêmes aux clients.
// ============================================================
import { cn } from '@/lib/utils';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { TEXT } from '@/mobile/designKit';
import { PaymentDetailsHub } from '@/components/payment-details/PaymentDetailsHub';

const TITLE = 'Coordonnées de paiement';

export function MobilePaymentDetailsScreen({ desktop = false }: { desktop?: boolean } = {}) {
  if (desktop) {
    return (
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>{TITLE}</h2>
        </header>
        <PaymentDetailsHub audience="admin" />
      </div>
    );
  }
  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader title={TITLE} showBack />
      <div className="px-4 pb-8 pt-4">
        <PaymentDetailsHub audience="admin" />
      </div>
    </div>
  );
}
