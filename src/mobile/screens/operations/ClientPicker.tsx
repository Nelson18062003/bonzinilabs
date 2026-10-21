/**
 * « Quel client ? » (maquette index.html écran 2) : la recherche, les
 * clients récents en ronds, puis tous les clients avec leur solde. Sert au
 * nouveau paiement, au nouveau dépôt et au paiement groupé.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminPayments } from '@/hooks/usePaginatedPayments';
import { matchesClientSearch } from '@/lib/clientSearch';
import { EmptyLine, Initials, ItemList, ItemRow, SearchBox, TEXT, FOCUS_RING } from '@/mobile/designKit';
import { FieldLabel } from './parts';
import { n0 } from './opsLabels';

export type PickedClient = NonNullable<ReturnType<typeof useAllClients>['data']>[number];

const nameOf = (c: { first_name?: string | null; last_name?: string | null }) => `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client';

export function ClientPicker({ onPick, balances, selectedId }: {
  onPick: (c: PickedClient) => void;
  balances?: Map<string, { balance: number; overdraft: number }>;
  selectedId?: string | null;
}) {
  const { data: clients, isLoading } = useAllClients();
  const { data: recentPays } = usePaginatedAdminPayments(undefined);
  const [q, setQ] = useState('');

  const recents = useMemo(() => {
    if (!clients) return [];
    const ids: string[] = [];
    for (const p of recentPays?.pages.flatMap((pg) => pg.data) ?? []) {
      if (!ids.includes(p.user_id)) ids.push(p.user_id);
      if (ids.length >= 8) break;
    }
    return ids.map((id) => clients.find((c) => c.user_id === id)).filter((c): c is PickedClient => !!c);
  }, [clients, recentPays]);

  const list = useMemo(() => {
    const all = clients ?? [];
    if (!q.trim()) return all.slice(0, 40);
    return all
      .filter((c) => matchesClientSearch({ firstName: c.first_name ?? '', lastName: c.last_name ?? '', phone: c.phone ?? '', companyName: c.company_name ?? '', customerCode: (c as { customer_code?: string | null }).customer_code ?? '' }, q))
      .slice(0, 40);
  }, [clients, q]);

  return (
    <div className="pb-6">
      <div className="px-5 pt-4">
        <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone" />
      </div>
      {!q.trim() && recents.length > 0 && (
        <>
          <FieldLabel className="px-5">Récents</FieldLabel>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto px-5 pb-1">
            {recents.map((c) => (
              <button key={c.user_id} type="button" onClick={() => onPick(c)} className={cn('flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-lg py-1', FOCUS_RING)}>
                <Initials name={nameOf(c)} size={64} className={selectedId === c.user_id ? 'ring-2 ring-[#2C2C2C]' : undefined} />
                <span className={cn('max-w-full truncate text-[15px] font-medium', TEXT.strong)}>{(c.first_name ?? '').trim() || nameOf(c)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <FieldLabel className="px-5">{q.trim() ? 'Résultats' : 'Tous les clients'}</FieldLabel>
      {isLoading ? (
        <EmptyLine>Chargement…</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine>Aucun client trouvé.</EmptyLine>
      ) : (
        <ItemList>
          {list.map((c) => {
            const bal = balances?.get(c.user_id)?.balance;
            return (
              <ItemRow
                key={c.user_id}
                leading={<Initials name={nameOf(c)} />}
                title={nameOf(c)}
                subtitle={c.phone ?? c.company_name ?? '—'}
                right={bal != null ? (
                  <span className="shrink-0 text-right">
                    <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{n0(bal)}</span>
                    <span className={cn('block text-[15px]', TEXT.muted)}>XAF</span>
                  </span>
                ) : undefined}
                onClick={() => onPick(c)}
              />
            );
          })}
        </ItemList>
      )}
    </div>
  );
}
