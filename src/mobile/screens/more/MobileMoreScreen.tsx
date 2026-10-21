/**
 * « Plus » — refonte v2 (maquette 01-navigation/01). La carte Moi en tête,
 * puis tous les modules en grille de ronds, sans description, filtrés par
 * permission. Langue, thème et préférences sont dans Réglages ; Face ID,
 * notifications et mises à jour dans Moi.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, Banknote, FileText, History, Landmark, MessageCircle, Newspaper, Route, Search, Settings, TrendingUp, UsersRound, Wallet,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { MolaMascot } from '@/components/MolaMascot';
import { ItemList, ModuleGrid, RoundButton, TabTop, type ModuleTile } from '@/mobile/designKit';
import { LogoutRow } from './LogoutRow';
import { ProfileCard } from './ProfileCard';

export function MobileMoreScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { currentUser, hasPermission, canManageUsers } = useAdminAuth();
  const role = currentUser?.role;
  const canChat = hasPermission('canAccessSupportChat');
  const { data: convs } = useAdminConversations();
  // La loupe : la recherche globale (clients, BZ-DP-…, BZ-PY-…) — refonte v2, 01/07.
  const canSearch = hasPermission('canViewClients') || hasPermission('canViewDeposits') || hasPermission('canViewPayments');
  const unread = canChat ? (convs ?? []).reduce((sum, c) => sum + (c.unread_count_admin || 0), 0) : 0;

  const tiles = useMemo<ModuleTile[]>(() => {
    const go = (path: string) => () => navigate(path);
    if (role === 'customs_broker') {
      return [
        { key: 'veille', label: 'Veille', icon: Newspaper, onClick: go('/m/douane/veille') },
        { key: 'routes', label: 'Routes', icon: Route, onClick: go('/m/douane/routes') },
        { key: 'settings', label: 'Réglages', icon: Settings, onClick: go('/m/more/settings') },
      ];
    }
    const list: (ModuleTile & { show: boolean })[] = [
      { key: 'treasury', label: 'Trésorerie', icon: Wallet, onClick: go('/m/more/treasury'), show: hasPermission('canViewTreasury') && role !== 'treasurer' },
      { key: 'rates', label: 'Taux du jour', icon: TrendingUp, onClick: go('/m/more/rates'), show: hasPermission('canManageRates') },
      // Comme avant la refonte : les analyses sont ouvertes à toute l'équipe (la route n'a pas de garde).
      { key: 'analytics', label: 'Analyses', icon: BarChart3, onClick: go('/m/dashboard'), show: true },
      { key: 'support', label: 'Messages clients', icon: MessageCircle, onClick: go('/m/support'), badge: unread, show: canChat },
      { key: 'customs', label: 'Douane', icon: Landmark, onClick: go('/m/douane'), show: hasPermission('canViewCustoms') },
      {
        key: 'mola',
        label: 'Mola',
        visual: <MolaMascot small alt="" className="h-full w-full object-cover" />,
        onClick: go('/m/assistant'),
        show: role !== 'treasurer',
      },
      { key: 'details', label: 'Coordonnées de paiement', icon: Banknote, onClick: go('/m/more/payment-details'), show: role !== 'treasurer' },
      { key: 'team', label: 'Équipe & ventes', icon: UsersRound, onClick: go('/m/equipe'), show: canManageUsers || hasPermission('canManageSales') },
      { key: 'logs', label: 'Journal', icon: History, onClick: go('/m/more/history'), show: hasPermission('canViewLogs') },
      { key: 'proofs', label: 'Justificatifs', icon: FileText, onClick: go('/m/more/proofs'), show: hasPermission('canViewDeposits') },
      { key: 'briefs', label: 'Veille', icon: Newspaper, onClick: go('/m/more/briefs'), show: true },
      { key: 'settings', label: 'Réglages', icon: Settings, onClick: go('/m/more/settings'), show: true },
    ];
    return list.filter((x) => x.show);
  }, [canChat, canManageUsers, hasPermission, navigate, role, unread]);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop
        title={t('more', { defaultValue: 'Plus' })}
        right={canSearch ? <RoundButton icon={Search} ariaLabel="Rechercher" onClick={() => navigate('/m/recherche')} /> : undefined}
      />
      <div className="px-5 pt-2">
        <ProfileCard webPath="/m/more/profile" />
      </div>
      <ModuleGrid tiles={tiles} className="pt-7" />
      <ItemList className="mt-8">
        <LogoutRow loginPath="/m/login" />
      </ItemList>
    </div>
  );
}
