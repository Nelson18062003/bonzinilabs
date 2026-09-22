// ============================================================
// Le solde du client, quand on règle un devis « depuis le solde » : ce
// qu'il a sur son compte Bonzini, ce qu'on va lui prendre, et le geste
// pour recharger d'abord (le dépôt, comme dans le module Paiements).
// ============================================================
import { useNavigate } from 'react-router-dom';
import { Wallet, PlusCircle } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import { xaf } from '@/lib/cargoQuote';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, SoftPill } from '@/mobile/designKit';

export function WalletBalanceCard({ userId, amount }: { userId: string | null | undefined; amount: number }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: wallet, isLoading } = useAdminWalletByUserId(userId ?? undefined);
  const balance = Math.round(Number(wallet?.balance_xaf ?? 0));
  const after = balance - amount;
  const short = amount > balance;
  if (!userId) return <p className={cn(TYPE.small, 'text-[#975102] dark:text-[#E8B931]')}>Ce dépôt n'est attribué à aucun client : attribuez-le avant de régler depuis un solde.</p>;
  return (
    <div className={cn('space-y-3 rounded-lg px-4 py-3', SURFACE.inset)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><Wallet className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block', TYPE.small, TEXT.muted)}>Solde du client</span>
          <span className={cn('block text-[22px] font-semibold leading-tight tabular-nums', short ? 'text-[#C00F0C] dark:text-[#EC221F]' : TEXT.strong)}>{isLoading ? '…' : xaf(balance)}</span>
        </span>
        <span className={cn('text-right tabular-nums', TYPE.small, TEXT.muted)}>
          <span className="block">après : {xaf(after)}</span>
        </span>
      </div>
      {short && <p className={cn(TYPE.small, 'text-[#C00F0C] dark:text-[#EC221F]')}>Il manque {xaf(amount - balance)}. Rechargez d'abord le compte (un dépôt), ou réduisez le montant.</p>}
      {hasPermission('canProcessDeposits') && (
        <SoftPill onClick={() => navigate(`/m/deposits/new?clientId=${userId}`)} className="h-11 w-full text-[15px]"><PlusCircle /> Recharger le compte (dépôt)</SoftPill>
      )}
      <p className={cn(TYPE.small, TEXT.muted)}>Le montant est retiré du portefeuille et apparaît dans l'historique du client comme « Frais de transport ». Annuler l'encaissement le lui rend.</p>
    </div>
  );
}
