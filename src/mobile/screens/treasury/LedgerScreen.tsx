/**
 * Le grand livre — maquette 07-tresorerie/24.
 *
 * Une devise à la fois (un total qui additionne XAF et CNY ne veut rien
 * dire), un compte ou tous, la période. Écritures, entrées, sorties ; chaque
 * ligne : nature, compte, heure, montant et solde du compte après — elle
 * ouvre l'opération d'origine. Les 300 écritures les plus récentes, comme
 * sur ordinateur.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useTreasuryAccountBalances, useTreasuryAccounts, useTreasuryLedger } from '@/hooks/useTreasury';
import type { TreasuryCurrency } from '@/desktop/screens/treasury/treasuryFormat';
import { sourcePath } from '@/desktop/screens/treasury/treasuryLabels';
import {
  BoxSegmented, Chip, DayLabel, EmptyLine, IconCircle, ItemList, ItemRow, ScreenTop, useSheet,
} from '@/mobile/designKit';
import { AccountLogo, AmountStack, PeriodChip, PeriodSheet, PickerSheet, TotalsStrip, TreasuryGate } from './parts';
import { balancesAfter, entryIcon, entryNature, fmtCur, groupByDay, hm, signed, useOriginNames, usePeriod } from './treasuryMobile';

const LIMIT = 300;

export function LedgerScreen() {
  return (
    <TreasuryGate>
      <LedgerBody />
    </TreasuryGate>
  );
}

function LedgerBody() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cur = (['XAF', 'USDT', 'CNY'].includes(params.get('cur') ?? '') ? params.get('cur') : 'XAF') as TreasuryCurrency;
  const accountId = params.get('account') ?? '';
  const period = usePeriod();
  const periodSheet = useSheet();
  const accountSheet = useSheet();
  const accounts = useTreasuryAccounts(cur);
  const balances = useTreasuryAccountBalances();
  const ledger = useTreasuryLedger({ currency: cur, accountId: accountId || undefined, limit: LIMIT });
  const names = useOriginNames();

  const all = ledger.data ?? [];
  const after = balancesAfter(all, balances.data);
  const rows = all.filter((e) => e.occurred_at >= period.fromIso && e.occurred_at <= period.toIso);
  const inflow = rows.filter((e) => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0);
  const outflow = rows.filter((e) => Number(e.amount) < 0).reduce((s, e) => s + Number(e.amount), 0);
  const account = (accounts.data ?? []).find((a) => a.id === accountId);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === 'cur') next.delete('account');
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Grand livre" />
      <div className="space-y-3 px-5 pt-4">
        <BoxSegmented
          ariaLabel="Devise"
          value={cur}
          onChange={(c) => set('cur', c === 'XAF' ? '' : c)}
          options={[
            { value: 'XAF', label: 'XAF' },
            { value: 'USDT', label: 'USDT' },
            { value: 'CNY', label: 'CNY' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Chip label={<span className="inline-flex items-center gap-1.5">{account?.label ?? 'Tous les comptes'}<ChevronDown className="h-4 w-4" /></span>} active={!!accountId} onClick={accountSheet.show} />
          <PeriodChip onClick={periodSheet.show} />
        </div>
        {!ledger.isLoading && !ledger.isError && (
          <TotalsStrip
            items={[
              { label: 'Écritures', value: rows.length },
              { label: 'Entrées', value: signed(inflow, fmtCur(inflow, cur)) },
              { label: 'Sorties', value: signed(outflow, fmtCur(Math.abs(outflow), cur)) },
            ]}
          />
        )}
      </div>

      {ledger.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void ledger.refetch() }}>Le grand livre n’a pas pu être chargé.</EmptyLine>
      ) : ledger.isLoading ? (
        <EmptyLine>Chargement…</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine>Aucune écriture sur cette période.</EmptyLine>
      ) : (
        groupByDay(rows, (e) => e.occurred_at).map((g) => (
          <div key={g.key}>
            <DayLabel>{g.label}</DayLabel>
            <ItemList>
              {g.items.map((e) => {
                const a = Number(e.amount);
                const path = sourcePath(e.source_table, e.source_id);
                const af = after.get(e.id);
                const who = e.source_id ? names.get(e.source_id) : undefined;
                return (
                  <ItemRow
                    key={e.id}
                    leading={<IconCircle icon={entryIcon(e)} />}
                    title={entryNature(e)}
                    subtitle={[e.account?.label, who, hm(e.occurred_at)].filter(Boolean).join(' · ')}
                    right={<AmountStack main={signed(a, fmtCur(Math.abs(a), cur))} sub={af === undefined ? undefined : fmtCur(af, cur)} />}
                    onClick={path ? () => navigate(path) : undefined}
                  />
                );
              })}
            </ItemList>
          </div>
        ))
      )}
      {all.length >= LIMIT && <EmptyLine>Les {LIMIT} écritures les plus récentes.</EmptyLine>}

      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
      <PickerSheet
        open={accountSheet.open}
        onClose={accountSheet.hide}
        title="Compte"
        value={accountId}
        onPick={(v) => set('account', v)}
        options={[
          { value: '', label: 'Tous les comptes' },
          ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.label, leading: <AccountLogo kind={a.kind} label={a.label} currency={a.currency} /> })),
        ]}
      />
    </div>
  );
}
