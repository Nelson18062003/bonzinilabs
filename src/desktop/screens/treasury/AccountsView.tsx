/**
 * Trésorerie — Comptes : tous les soldes, et la fiche d'un compte.
 *
 * La liste regroupe les comptes par devise (jamais de total mêlant XAF et
 * CNY). Un compte s'ouvre sur SA page (`/accounts/:id`) : solde, gestes
 * (ajuster, inventorier), mouvements du grand livre avec le solde après
 * chaque mouvement, et ses inventaires passés — la question « d'où vient ce
 * solde ? » trouve enfin sa réponse à un seul endroit.
 */
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, SlidersHorizontal, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInventorySnapshots, useTreasuryAccountBalances, useTreasuryLedger, type TreasuryAccountBalance } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { BackLink, Card, CardHead, Empty, ErrorState, Loading, Money, OriginCell, RowButton, StatusPill, Td, Th } from './tkit';
import { useTreasuryActions } from './treasuryActions';
import { treasuryPaths } from './treasuryNav';
import { accountKindLabel, fmtAmount, fmtNum, fmtWhen, type TreasuryCurrency } from './treasuryFormat';
import { canInventory, entryKindLabel, plural } from './treasuryLabels';

const GROUPS: ReadonlyArray<{ cur: TreasuryCurrency; title: string; hint: string }> = [
  { cur: 'XAF', title: 'Comptes XAF', hint: 'D’où partent les paiements des achats d’USDT' },
  { cur: 'USDT', title: 'Pool USDT', hint: 'Le stock d’USDT : entre à l’achat, sort à la vente' },
  { cur: 'CNY', title: 'Comptes CNY', hint: 'Où arrivent les yuans des ventes' },
];

export function AccountsView({ accountId }: { accountId: string | null }) {
  const balances = useTreasuryAccountBalances();
  if (accountId) return <AccountDetail id={accountId} balances={balances} />;
  return <AccountList balances={balances} />;
}

type BalancesQuery = ReturnType<typeof useTreasuryAccountBalances>;

function AccountList({ balances }: { balances: BalancesQuery }) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();

  if (balances.isLoading) return <Card><Loading rows={8} /></Card>;
  if (balances.isError) return <Card><ErrorState onRetry={() => void balances.refetch()} /></Card>;
  const all = (balances.data ?? []).filter((b) => b.is_active !== false);
  if (all.length === 0) return <Card><Empty icon={Wallet} title="Aucun compte de trésorerie" /></Card>;

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const rows = all.filter((b) => b.currency === g.cur);
        if (rows.length === 0) return null;
        const total = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0);
        return (
          <Card key={g.cur} className="overflow-hidden">
            <CardHead
              title={g.title}
              meta={`${plural(rows.length, 'compte')} · ${g.hint}`}
              action={
                <div className="text-right">
                  <div className="text-[12px] text-muted-foreground">Total</div>
                  <Money value={total} cur={g.cur} size="lg" />
                </div>
              }
              className="py-3"
            />
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Compte</Th>
                  <Th>Nature</Th>
                  <Th align="right">Mouvements</Th>
                  <Th>Dernier mouvement</Th>
                  <Th align="right">Solde</Th>
                  {actions.canManage && <Th align="right"><span className="sr-only">Actions</span></Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <RowButton key={r.id ?? r.code} onOpen={() => r.id && navigate(treasuryPaths.account(r.id))} label={`Ouvrir le compte ${r.label}`}>
                    <Td className="font-semibold">{r.label}</Td>
                    <Td muted>{accountKindLabel(r.kind)}</Td>
                    <Td align="right" muted className={TK.num}>{fmtNum(r.entry_count ?? 0, 0)}</Td>
                    <Td muted>{r.last_entry_at ? fmtWhen(r.last_entry_at) : 'Jamais'}</Td>
                    <Td align="right">
                      <Money value={Number(r.balance ?? 0)} cur={g.cur} showCur={false} className={Number(r.balance ?? 0) < 0 ? TK.out : ''} />
                    </Td>
                    {actions.canManage && (
                      <Td align="right" className="py-2">
                        <RowActions row={r} />
                      </Td>
                    )}
                  </RowButton>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

/** Les gestes d'une ligne — sans ouvrir la fiche (le clic ne remonte pas). */
function RowActions({ row }: { row: TreasuryAccountBalance }) {
  const actions = useTreasuryActions();
  if (!row.id) return null;
  const id = row.id;
  return (
    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" className={cn(BTN.ghost, 'h-8 px-2.5 text-[13px]')} onClick={() => actions.adjust(id)}>
        <SlidersHorizontal className="h-3.5 w-3.5" /> Ajuster
      </button>
      {canInventory(row.kind) && (
        <button type="button" className={cn(BTN.ghost, 'h-8 px-2.5 text-[13px]')} onClick={() => actions.inventory(id)}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Inventorier
        </button>
      )}
    </div>
  );
}

/* ── Fiche d'un compte ─────────────────────────────────────────────────── */

function AccountDetail({ id, balances }: { id: string; balances: BalancesQuery }) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  const ledger = useTreasuryLedger({ accountId: id, limit: 300 });
  const snapshots = useInventorySnapshots(id, 20);

  const back = <BackLink onClick={() => navigate(treasuryPaths.accounts)}>Tous les comptes</BackLink>;

  if (balances.isLoading) return <div className="space-y-3">{back}<Card><Loading rows={6} /></Card></div>;
  if (balances.isError) return <div className="space-y-3">{back}<Card><ErrorState onRetry={() => void balances.refetch()} /></Card></div>;
  const acc = (balances.data ?? []).find((b) => b.id === id);
  if (!acc) return <div className="space-y-3">{back}<Card><Empty icon={Wallet} title="Compte introuvable">Ce compte n’existe pas ou a été retiré.</Empty></Card></div>;

  const cur = (acc.currency ?? 'XAF') as TreasuryCurrency;
  const balance = Number(acc.balance ?? 0);
  // Solde après chaque mouvement : les mouvements arrivent du plus récent au
  // plus ancien ; le solde après le n-ième = solde actuel − les plus récents.
  let after = balance;
  const lines = (ledger.data ?? []).map((e) => {
    const line = { e, after };
    after -= Number(e.amount);
    return line;
  });

  return (
    <div className="space-y-4">
      {back}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-extrabold tracking-tight">{acc.label}</h2>
              <StatusPill tone="neutral">{accountKindLabel(acc.kind)}</StatusPill>
            </div>
            <div className="mt-3">
              <Money value={balance} cur={cur} size="xl" className={balance < 0 ? TK.out : ''} />
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {plural(acc.entry_count ?? 0, 'mouvement')} · dernier {acc.last_entry_at ? fmtWhen(acc.last_entry_at).toLowerCase() : 'jamais'}
            </div>
          </div>
          {actions.canManage && (
            <div className="flex gap-2">
              <button type="button" className={BTN.soft} onClick={() => actions.adjust(id)}>
                <SlidersHorizontal className="h-4 w-4" /> Ajuster le solde
              </button>
              {canInventory(acc.kind) && (
                <button type="button" className={BTN.soft} onClick={() => actions.inventory(id)}>
                  <ClipboardCheck className="h-4 w-4" /> Faire l’inventaire
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHead title="Mouvements" meta={ledger.data && ledger.data.length >= 300 ? 'Les 300 derniers' : 'Du plus récent au plus ancien'} />
          {ledger.isLoading ? (
            <Loading rows={6} />
          ) : ledger.isError ? (
            <ErrorState onRetry={() => void ledger.refetch()} />
          ) : lines.length === 0 ? (
            <Empty title="Aucun mouvement sur ce compte" />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Nature</Th>
                  <Th>Origine</Th>
                  <Th align="right">Montant</Th>
                  <Th align="right">Solde après</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ e, after: a }) => {
                  return (
                    <tr key={e.id}>
                      <Td muted>{fmtWhen(e.occurred_at)}</Td>
                      <Td>{entryKindLabel(e.entry_kind)}</Td>
                      <Td>
                        <OriginCell source={e.source_table} id={e.source_id} onOpen={navigate} />
                      </Td>
                      <Td align="right">
                        <Money value={Number(e.amount)} cur={cur} sign tone size="sm" showCur={false} />
                      </Td>
                      <Td align="right">
                        <Money value={a} cur={cur} size="sm" showCur={false} className="text-muted-foreground" />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHead title="Inventaires" meta={canInventory(acc.kind) ? 'Comptages de ce compte' : 'Ce compte se réconcilie sur relevé'} />
          {snapshots.isLoading ? (
            <Loading rows={3} />
          ) : snapshots.isError ? (
            <ErrorState onRetry={() => void snapshots.refetch()} />
          ) : (snapshots.data ?? []).length === 0 ? (
            <Empty icon={ClipboardCheck} title="Aucun inventaire" />
          ) : (
            <ul className="divide-y divide-border/70">
              {(snapshots.data ?? []).map((s) => {
                const v = Number(s.variance);
                return (
                  <li key={s.id} className="px-5 py-3 text-[13.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{fmtWhen(s.snapshot_at)}</span>
                      {v === 0 ? <StatusPill tone="ok">Juste</StatusPill> : <Money value={v} cur={cur} sign tone size="sm" />}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                      Compté {fmtAmount(Number(s.actual_balance), cur)} · attendu {fmtAmount(Number(s.theoretical_balance), cur)}
                    </div>
                    {s.variance_reason && <div className="mt-1 text-[12.5px]">{s.variance_reason}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
