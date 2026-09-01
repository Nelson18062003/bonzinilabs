/**
 * Desktop admin — Trésorerie : UN MÉTIER PAR VUE
 * (docs/admin-redesign/07-treasury-module.md), habillage « salle des
 * marchés » (marketKit.tsx) retenu sur maquette.
 *
 * Remplace l'ancien accueil, qui était un lanceur de 10 tuiles vers 10 pages —
 * le menu du téléphone posé sur un écran large. Ici le module est UN écran :
 * la barre d'état (stock, WAC, soldes) reste visible, et des onglets
 * SOULIGNÉS montrent une seule vue à la fois.
 *
 *   · Opérations (défaut) — le poste de travail : table triable + détail latéral.
 *   · Analyse   — les quatre chiffres du métier + l'historique des taux.
 *   · Comptes   — soldes, ajustements ET inventaire (même objet : un compte).
 *   · Contreparties — fournisseurs USDT / acheteurs CNY.
 *
 * Les deux saisies restent des pages dédiées (profondément liables).
 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLineDown as ArrowDownToLine, ArrowLineUp as ArrowUpFromLine } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { T, MTabs, MButton, MIcons, M_PAGE } from './marketKit';
import { TreasuryStatusBar } from './TreasuryStatusBar';
import { TreasuryOperationsWorkbench } from './TreasuryOperationsWorkbench';
import { TreasuryAccountsView } from './TreasuryAccountsView';
import { TreasuryCounterpartiesView } from './TreasuryCounterpartiesView';
import { TreasuryAnalysisView } from './TreasuryAnalysisView';
import { DateRangeProvider } from '@/lib/analytics/DateRangeContext';
import { TREASURY_DEFAULT_PRESET } from './treasuryPeriod';
import type { TreasuryCurrency } from './treasuryFormat';
import { TREASURY_VIEWS, viewFromPath, treasuryPaths, type TreasuryView } from './treasuryNav';
import { TreasuryInventoryView } from './TreasuryInventoryView';
import { TreasuryLedgerView } from './TreasuryLedgerView';

export function DesktopTreasuryScreen() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasPermission } = useAdminAuth();

  // L'URL EST l'état. Plus de `useState` : c'est ce qui cassait le bouton
  // Retour, le marque-page et le rafraîchissement.
  const view: TreasuryView = viewFromPath(pathname) ?? 'operations';
  const current = TREASURY_VIEWS.find((v) => v.key === view);

  const { data: balances } = useTreasuryAccountBalances();
  const { data: wac } = useUsdtWac();
  const { data: stockUsdt } = useUsdtStock();

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }
  const canManage = hasPermission('canManageTreasury');

  const totals = (balances ?? []).reduce<Partial<Record<TreasuryCurrency, { total: number; count: number }>>>(
    (acc, b) => {
      const cur = (b.currency ?? 'XAF') as TreasuryCurrency;
      const entry = acc[cur] ?? { total: 0, count: 0 };
      entry.total += Number(b.balance ?? 0);
      entry.count += 1;
      acc[cur] = entry;
      return acc;
    },
    {},
  );

  return (
    // `font-ui` = Inter : le module bascule sur la typo de la direction
    // retenue sans toucher aux autres écrans de l'admin (portée décidée :
    // Trésorerie d'abord, extension ensuite).
    <MIcons>
    <div className={cn(M_PAGE, 'space-y-4', T.ink)}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn('text-[19px] font-bold tracking-[-0.02em]', T.ink)}>Trésorerie</h2>
          {/* Le sous-titre dit ce que la VUE COURANTE sert à faire, pas une
              généralité sur le module : c'est l'information utile quand on
              vient d'arriver sur un onglet. */}
          <p className={cn('mt-0.5 text-[12.5px]', T.muted)}>{current?.purpose ?? 'Pont USDT · XAF → USDT → CNY'}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <MButton onClick={() => navigate(treasuryPaths.newPurchase)}>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Achat
            </MButton>
            <MButton variant="primary" onClick={() => navigate(treasuryPaths.newSale)}>
              <ArrowUpFromLine className="h-3.5 w-3.5" /> Vente USDT
            </MButton>
          </div>
        )}
      </header>

      <TreasuryStatusBar stockUsdt={stockUsdt} wac={wac} totals={totals} />

      {/* Changer d'onglet NAVIGUE. La vue devient donc partageable,
          marque-pageable, et le Retour du navigateur revient à l'onglet
          précédent au lieu de sortir du module. */}
      <MTabs
        tabs={TREASURY_VIEWS.map((v) => ({ key: v.key, label: v.label }))}
        value={view}
        onChange={(k) => navigate(TREASURY_VIEWS.find((v) => v.key === k)!.path)}
        ariaLabel="Vues du module Trésorerie"
      />

      {/* UNE période pour tout le module : choisie dans Opérations, elle est
          encore là dans Analyse. Chaque vue se fournit son propre contexte
          quand elle est montée seule (`TreasuryPeriodScope`). */}
      <DateRangeProvider defaultPreset={TREASURY_DEFAULT_PRESET}>
        {view === 'operations' && <TreasuryOperationsWorkbench canManage={canManage} />}
        {view === 'analysis' && <TreasuryAnalysisView />}
        {view === 'accounts' && <TreasuryAccountsView canManage={canManage} />}
        {view === 'inventory' && <TreasuryInventoryView canManage={canManage} />}
        {view === 'counterparties' && <TreasuryCounterpartiesView canManage={canManage} />}
        {view === 'ledger' && <TreasuryLedgerView />}
      </DateRangeProvider>
    </div>
    </MIcons>
  );
}
