/**
 * Les inventaires passés — maquette 07-tresorerie/23.
 *
 * Tous les comptes ou un seul, sur la période ; le nombre d'inventaires et
 * ceux avec écart ; chaque comptage par jour : juste, ou l'écart (avec
 * « non expliqué » quand il n'a pas de motif). Toucher une ligne montre
 * l'attendu, le compté et le motif. « Faire un inventaire » en bas.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useInventorySnapshots, useTreasuryAccountBalances, type InventorySnapshot } from '@/hooks/useTreasury';
import { canInventory } from '@/desktop/screens/treasury/treasuryLabels';
import {
  BigButton, BottomSheet, Chip, DayLabel, Dock, EmptyLine, ItemList, ItemRow, KVBox, ScreenTop, TEXT, useSheet,
} from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { AccountLogo, AccountPickSheet, GapTag, PeriodChip, PeriodSheet, PickerSheet, StatGrid, TreasuryGate } from './parts';
import { fmtCur, groupByDay, signed, tp, usePeriod, whenFull, withCur } from './treasuryMobile';

export function InventoriesScreen() {
  return (
    <TreasuryGate>
      <InventoriesBody />
    </TreasuryGate>
  );
}

function InventoriesBody() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const [params, setParams] = useSearchParams();
  const accountId = params.get('account') ?? '';
  const period = usePeriod();
  const periodSheet = useSheet();
  const accountSheet = useSheet();
  const [pickCount, setPickCount] = useState(false);
  const [open, setOpen] = useState<InventorySnapshot | null>(null);
  const balances = useTreasuryAccountBalances();
  const snaps = useInventorySnapshots(accountId || undefined, 200);

  const rows = (snaps.data ?? []).filter((s) => s.snapshot_at >= period.fromIso && s.snapshot_at <= period.toIso);
  const withGap = rows.filter((s) => Number(s.variance ?? 0) !== 0).length;
  const accounts = (balances.data ?? []).filter((b) => b.id && b.is_active !== false && canInventory(b.kind));
  const current = accounts.find((a) => a.id === accountId);
  const money = (n: number, cur: string) => (cur === 'CNY' ? `¥ ${fmtCur(n, cur)}` : withCur(n, cur));

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Inventaires" backTo={tp.root} />
      <div className="space-y-3 px-5 pt-4">
        <div className="flex flex-wrap gap-2">
          <PeriodChip onClick={periodSheet.show} />
          <Chip label={<span className="inline-flex items-center gap-1.5">{current?.label ?? 'Tous les comptes'}<ChevronDown className="h-4 w-4" /></span>} active={!!accountId} onClick={accountSheet.show} />
        </div>
        <StatGrid items={[{ label: 'Inventaires', value: rows.length }, { label: 'Avec écart', value: withGap }]} />
      </div>

      {snaps.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void snaps.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : snaps.isLoading ? (
        <EmptyLine>Chargement…</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine>Aucun inventaire sur cette période.</EmptyLine>
      ) : (
        groupByDay(rows, (s) => s.snapshot_at).map((g) => (
          <div key={g.key}>
            <DayLabel>{g.label}</DayLabel>
            <ItemList>
              {g.items.map((s) => {
                const cur = s.account?.currency ?? 'XAF';
                const v = Number(s.variance ?? 0);
                return (
                  <ItemRow
                    key={s.id}
                    leading={<AccountLogo kind={s.account?.kind} label={s.account?.label} currency={cur} />}
                    title={s.account?.label ?? '—'}
                    subtitle={
                      v === 0
                        ? `Compté ${money(Number(s.actual_balance), cur)}`
                        : s.variance_reason
                          ? `${money(Number(s.actual_balance), cur)} · attendu ${money(Number(s.theoretical_balance), cur)}`
                          : `${money(Number(s.actual_balance), cur)} · non expliqué`
                    }
                    right={<GapTag gap={v} text={signed(v, money(Math.abs(v), cur))} />}
                    onClick={() => setOpen(s)}
                  />
                );
              })}
            </ItemList>
          </div>
        ))
      )}

      {canManage && (
        <Dock>
          <BigButton onClick={() => (current ? navigate(tp.count(current.id as string)) : setPickCount(true))}>Faire un inventaire</BigButton>
        </Dock>
      )}

      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
      <PickerSheet
        open={accountSheet.open}
        onClose={accountSheet.hide}
        title="Compte"
        value={accountId}
        onPick={(v) => setParams(v ? { account: v } : {}, { replace: true })}
        options={[
          { value: '', label: 'Tous les comptes' },
          ...accounts.map((a) => ({ value: a.id as string, label: a.label ?? '—', leading: <AccountLogo kind={a.kind} label={a.label} currency={a.currency} /> })),
        ]}
      />
      <AccountPickSheet open={pickCount} onClose={() => setPickCount(false)} mode="inventory" onPick={(id) => navigate(tp.count(id))} />
      <BottomSheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>{open.account?.label ?? 'Inventaire'}</h3>
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{whenFull(open.snapshot_at)}</p>
            <KVBox
              className="mt-4"
              rows={[
                { label: 'Attendu', value: money(Number(open.theoretical_balance), open.account?.currency ?? 'XAF') },
                { label: 'Compté', value: money(Number(open.actual_balance), open.account?.currency ?? 'XAF') },
                {
                  label: 'Écart',
                  value: <GapTag gap={Number(open.variance ?? 0)} text={signed(Number(open.variance ?? 0), money(Math.abs(Number(open.variance ?? 0)), open.account?.currency ?? 'XAF'))} />,
                },
                { label: 'Motif', value: open.variance_reason ?? (Number(open.variance ?? 0) === 0 ? '—' : 'Non expliqué') },
              ]}
            />
            <BigButton variant="soft" className="mt-5" onClick={() => { setOpen(null); navigate(tp.account(open.account_id)); }}>Voir le compte</BigButton>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
