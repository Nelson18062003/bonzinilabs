/**
 * L'onglet « Trésorerie » (/m/more/treasury) — maquette 05-tresorerie-taux/01
 * et 02.
 *
 * Ce que j'ai, toutes devises : la valeur totale en XAF (comptes XAF + stock
 * d'USDT au coût moyen + yuans convertis — le « capital immobilisé » de
 * `get_treasury_dashboard`), puis XAF / USDT / CNY. Quatre ronds, les
 * dernières opérations, et le « … » qui range le reste du module (grand
 * livre, inventaires, contreparties, visuel des soldes, analyse).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowUpFromLine, BarChart3, BookOpen, ClipboardCheck, History, Image as ImageIcon, List, SlidersHorizontal, Users, Wallet,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances, useTreasuryDashboard, useUsdtStock } from '@/hooks/useTreasury';
import { viewOperation } from '@/desktop/screens/treasury/operationView';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import {
  ActionCircles, ActionSheet, EmptyLine, ItemList, MoreButton, SectionHead, TabTop, useSheet, type CircleAction,
} from '@/mobile/designKit';
import { AccountPickSheet, HeroCard, OpRow, TreasuryGate } from './parts';
import { hm, tp, useFixedWindow, useRecentOperations } from './treasuryMobile';

export function TreasuryTab() {
  return (
    <TreasuryGate>
      <TreasuryTabBody />
    </TreasuryGate>
  );
}

function TreasuryTabBody() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const more = useSheet();
  const [pick, setPick] = useState<'adjust' | 'inventory' | null>(null);
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const today = useFixedWindow('today');
  const dash = useTreasuryDashboard(today.fromIso, today.toIso);
  const ops = useRecentOperations();

  const total = (cur: 'XAF' | 'CNY') => (balances.data ?? []).filter((b) => b.currency === cur && b.is_active !== false).reduce((s, b) => s + Number(b.balance ?? 0), 0);
  const xaf = total('XAF');
  const cny = total('CNY');
  const ready = !balances.isLoading && !dash.isLoading;
  const value = ready && dash.data ? xaf + Number(dash.data.capital_immobilized_current_xaf ?? 0) : null;
  const recent = (ops.data ?? []).slice(0, 3).map(viewOperation);

  const actions: CircleAction[] = [];
  if (canManage) {
    actions.push({ label: 'Acheter USDT', icon: ArrowDownToLine, onClick: () => navigate(tp.newPurchase) });
    actions.push({ label: 'Vendre USDT', icon: ArrowUpFromLine, onClick: () => navigate(tp.newSale) });
  }
  actions.push({ label: 'Comptes', icon: Wallet, onClick: () => navigate(tp.accounts), primary: !canManage });
  actions.push({ label: 'Opérations', icon: List, onClick: () => navigate(tp.operations()) });

  return (
    <div className="flex min-h-full flex-col pb-4">
      <TabTop title="Trésorerie" right={<MoreButton bordered onClick={more.show} />} />

      <div className="px-5 pt-3.5">
        <HeroCard
          label="Valeur totale"
          value={value === null ? (balances.isError || dash.isError ? 'Indisponible' : '—') : fmtNum(value, 0)}
          unit={value === null ? undefined : 'XAF'}
          rows={[
            { label: 'XAF', value: balances.isLoading ? '—' : fmtNum(xaf, 0) },
            { label: 'USDT', value: stock.data === undefined ? '—' : fmtNum(stock.data, 2) },
            { label: 'CNY', value: balances.isLoading ? '—' : `¥ ${fmtNum(cny, 2)}` },
          ]}
          onClick={() => navigate(tp.accounts)}
        />
      </div>

      <ActionCircles actions={actions} />

      <SectionHead title="Dernières opérations" link={{ label: 'Tout voir', onClick: () => navigate(tp.operations()) }} />
      {ops.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void ops.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : !ops.isLoading && recent.length === 0 ? (
        <EmptyLine>Aucune opération récente.</EmptyLine>
      ) : (
        <ItemList>
          {recent.map((o) => (
            <OpRow
              key={o.id}
              op={o}
              below="kind"
              subtitle={`${o.kind === 'purchase' ? 'Achat' : 'Vente'} · ${o.accounts === '—' ? 'sans compte' : o.accounts} · ${hm(o.at)}`}
              onClick={() => navigate(tp.operation(o.kind, o.id))}
            />
          ))}
        </ItemList>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Ajuster un solde', icon: SlidersHorizontal, onClick: () => setPick('adjust'), hidden: !canManage },
          { label: 'Faire un inventaire', hint: 'Caisse, Alipay, WeChat', icon: ClipboardCheck, onClick: () => setPick('inventory'), hidden: !canManage },
          { label: 'Fournisseurs et acheteurs', icon: Users, onClick: () => navigate(tp.counterparties()) },
          { label: 'Grand livre', icon: BookOpen, onClick: () => navigate(tp.ledger) },
          { label: 'Inventaires passés', icon: History, onClick: () => navigate(tp.inventory) },
          { label: 'Visuel des soldes', hint: 'Image ou PDF', icon: ImageIcon, onClick: () => navigate(tp.visual) },
          { label: 'Analyse trésorerie', icon: BarChart3, onClick: () => navigate(tp.analysis) },
        ]}
      />
      <AccountPickSheet
        open={pick !== null}
        mode={pick ?? 'adjust'}
        onClose={() => setPick(null)}
        onPick={(id) => navigate(pick === 'inventory' ? tp.count(id) : tp.adjust(id))}
      />
    </div>
  );
}
