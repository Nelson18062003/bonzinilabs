// ============================================================
// MODULE TAUX — sous-module « Marché Binance » (mobile)
// Même vue que l'onglet desktop (P2PMarketView), empilée : les filtres se
// replient au-dessus du graphique. Gardé par canManageRates, comme l'edge
// function `binance-p2p-book` qui sert le carnet.
// ============================================================
import { cn } from '@/lib/utils';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE } from '@/mobile/designKit';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { P2PMarketView } from '@/components/rates/market/P2PMarketView';

export function MobileRatesMarketScreen() {
  const { hasPermission } = useAdminAuth();
  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title="Marché Binance" showBack backTo="/m/more/rates" className={SURFACE.canvas} />
      <div className="p-4 pb-24">
        {hasPermission('canManageRates')
          ? <P2PMarketView compact />
          : <p className="py-16 text-center text-[16px] text-muted-foreground">Accès réservé à la gestion des taux.</p>}
      </div>
    </div>
  );
}
