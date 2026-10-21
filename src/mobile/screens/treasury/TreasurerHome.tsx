/**
 * L'Accueil du trésorier (onglet « Accueil » de son rôle, rendu par /m) —
 * maquette 07-tresorerie/01 et 02.
 *
 * Façon Wave : le stock d'USDT en gros (avec son coût moyen et ce qui est
 * entré et sorti aujourd'hui), quatre gros ronds, puis « À faire » : les
 * inventaires en retard, les écarts non expliqués et, quand le stock est
 * négatif, l'achat qui manque. L'onglet « Trésorerie » montre, lui, la
 * valeur totale et les comptes : les deux écrans ne se répètent pas.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Bell, ClipboardCheck, Wallet } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminNotificationCount } from '@/hooks/useAdminNotifications';
import { useInventorySnapshots, useTreasuryAccountBalances, useTreasuryOperations, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { canInventory } from '@/desktop/screens/treasury/treasuryLabels';
import { viewOperation } from '@/desktop/screens/treasury/operationView';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import { MolaMascot } from '@/components/MolaMascot';
import { cn } from '@/lib/utils';
import {
  ActionCircles, EmptyLine, IconCircle, ItemList, ItemRow, RoundButton, SURFACE, SectionHead, TEXT, TabTop, type CircleAction, type Tone,
} from '@/mobile/designKit';
import { AccountLogo, AccountPickSheet, HeroCard, TetherCircle } from './parts';
import { agoLabel, bizDay, daysSince, dayLabel, fmtUsdt, hm, signed, tp, useFixedWindow, useRecentOperations, withCur } from './treasuryMobile';

/** Un inventaire de plus de 2 jours est « à faire ». */
const INVENTORY_DUE_DAYS = 2;
/** Un écart non expliqué reste dans « À faire » une semaine. */
const GAP_WINDOW_DAYS = 7;

interface Todo {
  key: string;
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  amount?: string;
  tag: { tone: Tone; label: string };
  go: () => void;
}

export function TreasurerHome() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { data: notifCount } = useAdminNotificationCount();
  const canManage = hasPermission('canManageTreasury');
  const stock = useUsdtStock();
  const wac = useUsdtWac();
  const today = useFixedWindow('today');
  const todayOps = useTreasuryOperations(today.fromIso, today.toIso);
  const recent = useRecentOperations();
  const balances = useTreasuryAccountBalances();
  const snaps = useInventorySnapshots(undefined, 100);
  const [pickCount, setPickCount] = useState(false);

  const s = stock.data;
  const negative = s !== undefined && s < 0;
  const day = bizDay(new Date());
  const active = (todayOps.data ?? []).map(viewOperation).filter((o) => !o.voided && bizDay(o.at) === day);
  const bought = active.filter((o) => o.kind === 'purchase').reduce((t, o) => t + o.usdt, 0);
  const sold = active.filter((o) => o.kind === 'sale').reduce((t, o) => t + o.usdt, 0);
  // La vente qui a fait passer le stock sous zéro : la plus récente.
  const lastSale = negative ? (recent.data ?? []).map(viewOperation).find((o) => o.kind === 'sale' && !o.voided) : undefined;

  const todos = useMemo<Todo[]>(() => {
    const out: Todo[] = [];
    if (negative && s !== undefined) {
      out.push({
        key: 'missing',
        leading: <TetherCircle />,
        title: 'Achat manquant',
        subtitle: `Au moins ${fmtNum(-s, 2)} USDT`,
        tag: { tone: 'danger', label: 'Urgent' },
        go: () => navigate(tp.newPurchase),
      });
    }
    const accounts = (balances.data ?? []).filter((b) => b.id && b.is_active !== false && canInventory(b.kind));
    for (const a of accounts) {
      const last = (snaps.data ?? []).find((x) => x.account_id === a.id);
      if (last && daysSince(last.snapshot_at) <= INVENTORY_DUE_DAYS) continue;
      out.push({
        key: `inv-${a.id}`,
        leading: <AccountLogo kind={a.kind} label={a.label} currency={a.currency} />,
        title: `Inventaire ${(a.label ?? '').split(' ')[0]}`.trim(),
        subtitle: last ? `Dernier ${agoLabel(last.snapshot_at)}` : 'Jamais compté',
        tag: { tone: 'pending', label: 'À faire' },
        go: () => navigate(tp.count(a.id as string)),
      });
    }
    for (const g of snaps.data ?? []) {
      const v = Number(g.variance ?? 0);
      if (v === 0 || g.variance_reason || daysSince(g.snapshot_at) > GAP_WINDOW_DAYS) continue;
      const cur = g.account?.currency ?? 'XAF';
      out.push({
        key: `gap-${g.id}`,
        leading: <AccountLogo kind={g.account?.kind} label={g.account?.label} currency={cur} />,
        title: `Écart ${(g.account?.label ?? '').split(' ')[0]}`.trim(),
        subtitle: `${dayLabel(g.snapshot_at)} · non expliqué`,
        amount: signed(v, withCur(Math.abs(v), cur)),
        tag: { tone: 'danger', label: 'Écart' },
        go: () => navigate(tp.inventoriesOf(g.account_id)),
      });
    }
    return out;
  }, [negative, s, balances.data, snaps.data, navigate]);

  const actions: CircleAction[] = [];
  if (canManage) {
    actions.push({ label: 'Acheter USDT', icon: ArrowDownToLine, onClick: () => navigate(tp.newPurchase) });
    actions.push({ label: 'Vendre USDT', icon: ArrowUpFromLine, onClick: () => navigate(tp.newSale) });
    actions.push({ label: 'Inventaire', icon: ClipboardCheck, onClick: () => setPickCount(true) });
  }
  actions.push({ label: 'Comptes', icon: Wallet, onClick: () => navigate(tp.accounts), primary: !canManage });

  return (
    <div className="flex min-h-full flex-col pb-4">
      <TabTop
        title={`Bonjour ${currentUser?.firstName ?? ''}`.trim()}
        right={
          <>
            <RoundButton ariaLabel="Mola" onClick={() => navigate('/m/assistant')}>
              <MolaMascot small alt="" className="h-full w-full object-cover" />
            </RoundButton>
            <RoundButton icon={Bell} ariaLabel="Notifications" dot={(notifCount ?? 0) > 0} onClick={() => navigate('/m/more/notifications')} />
          </>
        }
      />

      <div className="space-y-3 px-5 pt-3.5">
        <HeroCard
          label="Stock USDT"
          tag={negative ? { tone: 'danger', label: 'Négatif' } : undefined}
          value={stock.isLoading ? '—' : stock.isError ? 'Indisponible' : `${negative ? '−' : ''}${fmtNum(Math.abs(s ?? 0), 2)}`}
          unit={stock.isError ? undefined : 'USDT'}
          line={<>Coût moyen <b className="font-bold">{wac.data ? fmtNum(wac.data, 2) : '—'}</b> XAF/USDT</>}
          rows={negative ? undefined : [
            { label: 'Achetés aujourd’hui', value: bought > 0 ? `+${fmtNum(bought, 2)}` : fmtNum(0, 2) },
            { label: 'Vendus aujourd’hui', value: sold > 0 ? `−${fmtNum(sold, 2)}` : fmtNum(0, 2) },
          ]}
          onClick={() => navigate(tp.analysis)}
        />
        {negative && lastSale && (
          <button
            type="button"
            onClick={() => navigate(tp.operation('sale', lastSale.id))}
            className={cn('flex w-full items-center gap-3.5 rounded-lg border px-4 py-3.5 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}
          >
            <IconCircle icon={AlertTriangle} tone="danger" />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>Vente sans stock</span>
              <span className={cn('block truncate text-[15px]', TEXT.muted)}>
                {fmtUsdt(lastSale.usdt)} USDT · {lastSale.counterpartyName} · {hm(lastSale.at)}
              </span>
            </span>
            <span className={cn('shrink-0 text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Voir</span>
          </button>
        )}
      </div>

      <ActionCircles actions={actions} />

      <SectionHead title="À faire" />
      {snaps.isError || balances.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => { void snaps.refetch(); void balances.refetch(); } }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : todos.length === 0 && !snaps.isLoading ? (
        <EmptyLine>Rien à faire.</EmptyLine>
      ) : (
        <ItemList>
          {todos.map((t) => (
            <ItemRow key={t.key} leading={t.leading} title={t.title} subtitle={t.subtitle} amount={t.amount} tag={t.tag} onClick={t.go} />
          ))}
        </ItemList>
      )}

      <AccountPickSheet open={pickCount} onClose={() => setPickCount(false)} mode="inventory" onPick={(id) => navigate(tp.count(id))} />
    </div>
  );
}
