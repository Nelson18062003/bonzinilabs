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
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
import type { TreasuryCurrency } from './treasuryFormat';

export type TreasuryView = 'operations' | 'analysis' | 'accounts' | 'counterparties';

const VIEWS = [
  { key: 'operations' as const, label: 'Opérations' },
  { key: 'analysis' as const, label: 'Analyse' },
  { key: 'accounts' as const, label: 'Comptes' },
  { key: 'counterparties' as const, label: 'Contreparties' },
];

export function DesktopTreasuryScreen({ initialView = 'operations' }: { initialView?: TreasuryView } = {}) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [view, setView] = useState<TreasuryView>(initialView);

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
          <p className={cn('mt-0.5 text-[12.5px]', T.muted)}>Pont USDT · XAF → USDT → CNY</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <MButton onClick={() => navigate('/m/more/treasury/purchase')}>
              <ArrowDownToLine className="h-3.5 w-3.5" /> Achat
            </MButton>
            <MButton variant="primary" onClick={() => navigate('/m/more/treasury/sale')}>
              <ArrowUpFromLine className="h-3.5 w-3.5" /> Vente USDT
            </MButton>
          </div>
        )}
      </header>

      <TreasuryStatusBar stockUsdt={stockUsdt} wac={wac} totals={totals} />

      <MTabs tabs={VIEWS} value={view} onChange={setView} ariaLabel="Vues du module Trésorerie" />

      {view === 'operations' && <TreasuryOperationsWorkbench canManage={canManage} />}
      {view === 'analysis' && <TreasuryAnalysisView />}
      {view === 'accounts' && <TreasuryAccountsView canManage={canManage} />}
      {view === 'counterparties' && <TreasuryCounterpartiesView canManage={canManage} />}
    </div>
    </MIcons>
  );
}
