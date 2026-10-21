/**
 * Les comptes — maquette 05-tresorerie-taux/08. Une devise à la fois (jamais
 * de total qui additionne des XAF et des CNY), le total de la devise, puis
 * chaque compte avec son vrai logo, son dernier mouvement et son solde ; un
 * solde négatif porte le tag rouge. Chaque ligne ouvre la fiche du compte.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ClipboardCheck, SlidersHorizontal } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryAccountBalances } from '@/hooks/useTreasury';
import type { TreasuryCurrency } from '@/desktop/screens/treasury/treasuryFormat';
import { plural } from '@/desktop/screens/treasury/treasuryLabels';
import {
  ActionSheet, BoxSegmented, EmptyLine, ItemList, ItemRow, MoreButton, ScreenTop, useSheet,
} from '@/mobile/designKit';
import { AccountLogo, AccountPickSheet, AmountStack, HeroCard, TreasuryGate } from './parts';
import { fmtCur, tp, whenShort } from './treasuryMobile';

export function AccountsScreen() {
  return (
    <TreasuryGate>
      <AccountsBody />
    </TreasuryGate>
  );
}

function AccountsBody() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const [params, setParams] = useSearchParams();
  const cur = (['XAF', 'USDT', 'CNY'].includes(params.get('cur') ?? '') ? params.get('cur') : 'XAF') as TreasuryCurrency;
  const balances = useTreasuryAccountBalances();
  const more = useSheet();
  const [pick, setPick] = useState<'adjust' | 'inventory' | null>(null);

  const rows = (balances.data ?? []).filter((b) => b.currency === cur && b.is_active !== false);
  const total = rows.reduce((s, b) => s + Number(b.balance ?? 0), 0);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Comptes" backTo={tp.root} right={<MoreButton onClick={more.show} />} />
      <div className="space-y-3 px-5 pt-4">
        <BoxSegmented
          ariaLabel="Devise"
          value={cur}
          onChange={(c) => setParams(c === 'XAF' ? {} : { cur: c }, { replace: true })}
          options={[
            { value: 'XAF', label: 'XAF' },
            { value: 'USDT', label: 'USDT' },
            { value: 'CNY', label: 'CNY' },
          ]}
        />
        <HeroCard
          label={`Total ${cur} · ${plural(rows.length, 'compte')}`}
          value={balances.isLoading ? '—' : cur === 'CNY' ? `¥ ${fmtCur(total, 'CNY')}` : fmtCur(total, cur)}
          unit={cur === 'CNY' ? undefined : cur}
        />
      </div>
      {balances.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void balances.refetch() }}>Les comptes n’ont pas pu être chargés.</EmptyLine>
      ) : !balances.isLoading && rows.length === 0 ? (
        <EmptyLine>Aucun compte {cur}.</EmptyLine>
      ) : (
        <ItemList className="pt-2">
          {rows.map((b) => {
            const v = Number(b.balance ?? 0);
            return (
              <ItemRow
                key={b.id ?? b.code}
                leading={<AccountLogo kind={b.kind} label={b.label} currency={b.currency} />}
                title={b.label}
                subtitle={b.last_entry_at ? whenShort(b.last_entry_at) : 'Aucun mouvement'}
                right={<AmountStack main={fmtCur(v, cur)} sub={v < 0 ? 'Négatif' : cur} tone={v < 0 ? 'danger' : undefined} />}
                onClick={() => b.id && navigate(tp.account(b.id))}
              />
            );
          })}
        </ItemList>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Ajuster un solde', icon: SlidersHorizontal, onClick: () => setPick('adjust'), hidden: !canManage },
          { label: 'Faire un inventaire', hint: 'Caisse, Alipay, WeChat', icon: ClipboardCheck, onClick: () => setPick('inventory'), hidden: !canManage },
          { label: 'Grand livre', icon: BookOpen, onClick: () => navigate(tp.ledgerOf(null, cur)) },
        ]}
      />
      <AccountPickSheet open={pick !== null} mode={pick ?? 'adjust'} onClose={() => setPick(null)} onPick={(id) => navigate(pick === 'inventory' ? tp.count(id) : tp.adjust(id))} />
    </div>
  );
}
