/**
 * Desktop admin — Trésorerie : UN MÉTIER PAR VUE
 * (docs/admin-redesign/07-treasury-module.md).
 *
 * Remplace l'ancien accueil, qui était un lanceur de 10 tuiles vers 10 pages —
 * le menu du téléphone posé sur un écran large. Ici le module est UN écran :
 * la barre d'état (stock, WAC, soldes) reste visible, et le sélecteur montre
 * une seule vue à la fois.
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
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT, PRIMARY_PILL, SOFT_PILL } from '@/desktop/designKit';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { TreasuryStatusBar } from './TreasuryStatusBar';
import { TreasuryOperationsWorkbench } from './TreasuryOperationsWorkbench';
import { TreasuryAccountsView } from './TreasuryAccountsView';
import { TreasuryCounterpartiesView } from './TreasuryCounterpartiesView';
import { TreasuryAnalysisView } from './TreasuryAnalysisView';
import type { TreasuryCurrency } from './treasuryFormat';

export type TreasuryView = 'operations' | 'analysis' | 'accounts' | 'counterparties';

const VIEWS: ReadonlyArray<{ key: TreasuryView; label: string }> = [
  { key: 'operations', label: 'Opérations' },
  { key: 'analysis', label: 'Analyse' },
  { key: 'accounts', label: 'Comptes' },
  { key: 'counterparties', label: 'Contreparties' },
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
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[20px] font-bold tracking-tight', TEXT.strong)}>Trésorerie</h2>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>
            Le pont USDT : XAF → USDT → CNY. Coût du stock, marge et opérations.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/m/more/treasury/purchase')}
              className={cn('inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-bold', SOFT_PILL)}
            >
              <ArrowDownToLine className="h-4 w-4" /> Achat USDT
            </button>
            <button
              type="button"
              onClick={() => navigate('/m/more/treasury/sale')}
              className={cn('inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-bold', PRIMARY_PILL)}
            >
              <ArrowUpFromLine className="h-4 w-4" /> Vente USDT
            </button>
          </div>
        )}
      </header>

      <TreasuryStatusBar stockUsdt={stockUsdt} wac={wac} totals={totals} />

      <nav className="flex items-center gap-1.5" aria-label="Vues du module Trésorerie">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            aria-current={view === v.key ? 'page' : undefined}
            className={cn('h-9 rounded-full px-4 text-[13px] font-bold transition-colors', view === v.key ? PRIMARY_PILL : SOFT_PILL)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === 'operations' && <TreasuryOperationsWorkbench canManage={canManage} />}
      {view === 'analysis' && <TreasuryAnalysisView />}
      {view === 'accounts' && <TreasuryAccountsView canManage={canManage} />}
      {view === 'counterparties' && <TreasuryCounterpartiesView canManage={canManage} />}
    </div>
  );
}
