/**
 * La fiche d'un compte — maquettes 07-tresorerie/16 et 17 (Afriland :
 * 05-tresorerie-taux/09).
 *
 * Le solde en gros, le nombre de mouvements, puis les mouvements avec le
 * solde APRÈS chacun (chaque ligne ouvre son opération) et la carte des
 * inventaires du compte. Le « … » : ajuster le solde, faire l'inventaire
 * (caisse, Alipay, WeChat), grand livre et inventaires du compte.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ClipboardCheck, History, SlidersHorizontal } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useInventorySnapshots, useTreasuryAccountBalances, useTreasuryLedger } from '@/hooks/useTreasury';
import { canInventory, plural, sourcePath } from '@/desktop/screens/treasury/treasuryLabels';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigFigure, EmptyLine, IconCircle, ItemList, ItemRow, MoreButton, SURFACE, ScreenTop, SectionHead, TEXT, useSheet,
} from '@/mobile/designKit';
import { AccountLogo, AmountStack, GapTag, TreasuryGate } from './parts';
import { balancesAfter, entryIcon, entryTitle, fmtCur, signed, tp, useOriginNames, whenShort, withCur } from './treasuryMobile';

const SHOWN = 8;

export function AccountScreen() {
  return (
    <TreasuryGate>
      <AccountBody />
    </TreasuryGate>
  );
}

function AccountBody() {
  const navigate = useNavigate();
  const { accountId: id = '' } = useParams<{ accountId: string }>();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const balances = useTreasuryAccountBalances();
  const ledger = useTreasuryLedger({ accountId: id, limit: 300 });
  const snaps = useInventorySnapshots(id, 20);
  const names = useOriginNames();
  const more = useSheet();

  const acc = (balances.data ?? []).find((b) => b.id === id);
  if (!acc) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Compte" backTo={tp.accounts} />
        {balances.isLoading ? <EmptyLine>Chargement…</EmptyLine> : balances.isError ? (
          <EmptyLine action={{ label: 'Réessayer', onClick: () => void balances.refetch() }}>Le compte n’a pas pu être chargé.</EmptyLine>
        ) : <EmptyLine>Compte introuvable.</EmptyLine>}
      </div>
    );
  }

  const cur = acc.currency ?? 'XAF';
  const balance = Number(acc.balance ?? 0);
  const entries = ledger.data ?? [];
  const after = balancesAfter(entries, balances.data);
  const inventoriable = canInventory(acc.kind);
  const snapList = snaps.data ?? [];
  const gaps = snapList.filter((s) => Number(s.variance ?? 0) !== 0).length;

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Compte" backTo={tp.accounts} right={<MoreButton onClick={more.show} />} />
      <div className="flex flex-col items-center px-5 pt-5 text-center">
        <AccountLogo kind={acc.kind} label={acc.label} currency={cur} size={64} />
        <BigFigure className="mt-4" center value={cur === 'CNY' ? `¥ ${fmtCur(balance, cur)}` : fmtCur(balance, cur)} delta={balance < 0 ? { tone: 'danger', label: 'Négatif' } : undefined} />
        <p className={cn('mt-2 text-[16px]', TEXT.muted)}>
          {cur} · {acc.label} · {plural(acc.entry_count ?? 0, 'mouvement')}
        </p>
      </div>

      <SectionHead title="Mouvements" link={{ label: 'Grand livre', onClick: () => navigate(tp.ledgerOf(id, cur as 'XAF')) }} />
      {ledger.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void ledger.refetch() }}>Les mouvements n’ont pas pu être chargés.</EmptyLine>
      ) : !ledger.isLoading && entries.length === 0 ? (
        <EmptyLine>Aucun mouvement.</EmptyLine>
      ) : (
        <ItemList>
          {entries.slice(0, SHOWN).map((e) => {
            const path = sourcePath(e.source_table, e.source_id);
            const a = Number(e.amount);
            const af = after.get(e.id);
            return (
              <ItemRow
                key={e.id}
                leading={<IconCircle icon={entryIcon(e)} />}
                title={entryTitle(e, names)}
                subtitle={whenShort(e.occurred_at)}
                right={<AmountStack main={signed(a, fmtCur(Math.abs(a), cur))} sub={af === undefined ? undefined : fmtCur(af, cur)} />}
                onClick={path ? () => navigate(path) : undefined}
              />
            );
          })}
        </ItemList>
      )}

      {(inventoriable || snapList.length > 0) && (
        <div className={cn('mx-5 mt-6 rounded-lg border px-4 pb-1 pt-4', SURFACE.divider)}>
          <div className="flex items-baseline justify-between">
            <h3 className={cn('text-[18px] font-semibold', TEXT.strong)}>Inventaires</h3>
            <button type="button" onClick={() => navigate(tp.inventoriesOf(id))} className={cn('text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Tout voir</button>
          </div>
          {snapList.length === 0 ? (
            <p className={cn('py-4 text-[16px]', TEXT.muted)}>Aucun inventaire.</p>
          ) : (
            snapList.slice(0, 2).map((s) => {
              const v = Number(s.variance ?? 0);
              return (
                <div key={s.id} className={cn('flex items-center justify-between gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
                  <span className="min-w-0">
                    <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{whenShort(s.snapshot_at)}</span>
                    <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>
                      {v === 0 ? `Compté ${withCur(Number(s.actual_balance), cur)}` : `${fmtCur(Number(s.actual_balance), cur)} · attendu ${fmtCur(Number(s.theoretical_balance), cur)}`}
                    </span>
                  </span>
                  <GapTag gap={v} text={signed(v, fmtCur(Math.abs(v), cur))} />
                </div>
              );
            })
          )}
        </div>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Ajuster le solde', hint: 'Créditer ou débiter, avec motif', icon: SlidersHorizontal, onClick: () => navigate(tp.adjust(id)), hidden: !canManage },
          { label: 'Faire l’inventaire', hint: `Attendu ${withCur(balance, cur)}`, icon: ClipboardCheck, onClick: () => navigate(tp.count(id)), hidden: !canManage || !inventoriable },
          { label: 'Grand livre du compte', icon: BookOpen, onClick: () => navigate(tp.ledgerOf(id, cur as 'XAF')) },
          { label: 'Inventaires du compte', hint: `${plural(snapList.length, 'inventaire')} · ${plural(gaps, 'écart')}`, icon: History, onClick: () => navigate(tp.inventoriesOf(id)), hidden: !inventoriable && snapList.length === 0 },
        ]}
      />
    </div>
  );
}
