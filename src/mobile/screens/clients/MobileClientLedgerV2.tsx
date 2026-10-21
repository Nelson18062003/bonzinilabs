/**
 * Fiche client › Relevé (maquette 03/06) : Tout · Dépôts · Paiements ·
 * Autres, les écritures par mois (montant signé, solde après, auteur), le
 * total des dépôts ou des paiements en tête de leur filtre, et le relevé PDF
 * (période + langue) dans l'icône du haut. Défilement infini, comme avant.
 */
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useClient, useClientLedgerPaged } from '@/hooks/useClientManagement';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { StatementPeriodSheet } from '@/components/statement/StatementPeriodSheet';
import { cn } from '@/lib/utils';
import { Chip, EmptyLine, ItemList, KVBox, RoundButton, ScreenTop, TEXT } from '@/mobile/designKit';
import type { LedgerEntry, LedgerEntryType } from '@/types/admin';
import { LedgerItem } from './ledgerRows';
import { ChipRow, xaf } from './parts';
import { useClientStatement } from './useClientStatement';

type Filter = 'all' | 'DEPOSIT_VALIDATED' | 'PAYMENT_RESERVED' | 'other';
const MAIN: LedgerEntryType[] = ['DEPOSIT_VALIDATED', 'PAYMENT_RESERVED'];
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const thisYear = new Date().getFullYear();

function monthKey(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}`;
}
function monthName(d: Date | string) {
  const x = new Date(d);
  const s = x.getFullYear() === thisYear ? x.toLocaleDateString('fr-FR', { month: 'long' }) : monthFmt.format(x);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MobileClientLedgerV2() {
  const { clientId = '' } = useParams();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: client } = useClient(clientId);
  const statement = useClientStatement(client);
  const { data: entries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useClientLedgerPaged(clientId, {
    entryType: filter === 'DEPOSIT_VALIDATED' || filter === 'PAYMENT_RESERVED' ? filter : undefined,
  });

  const list = useMemo(() => {
    const l = (entries ?? []) as LedgerEntry[];
    return filter === 'other' ? l.filter((e) => !MAIN.includes(e.entryType)) : l;
  }, [entries, filter]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: LedgerEntry[] }[] = [];
    for (const e of list) {
      const k = monthKey(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === k) last.rows.push(e);
      else out.push({ key: k, label: monthName(e.createdAt), rows: [e] });
    }
    return out;
  }, [list]);

  const first = client?.firstName || 'Client';

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop
        title={`Relevé · ${first}`}
        backTo={`/m/clients/${clientId}`}
        right={<RoundButton icon={Download} ariaLabel="Relevé PDF" onClick={statement.show} className="border-0" />}
      />
      <ChipRow className="mt-4">
        <Chip label="Tout" active={filter === 'all'} onClick={() => setFilter('all')} />
        <Chip label="Dépôts" active={filter === 'DEPOSIT_VALIDATED'} onClick={() => setFilter('DEPOSIT_VALIDATED')} />
        <Chip label="Paiements" active={filter === 'PAYMENT_RESERVED'} onClick={() => setFilter('PAYMENT_RESERVED')} />
        <Chip label="Autres" active={filter === 'other'} onClick={() => setFilter('other')} />
      </ChipRow>

      {client && (filter === 'DEPOSIT_VALIDATED' || filter === 'PAYMENT_RESERVED') && (
        <div className="px-5 pt-3">
          <KVBox
            rows={[
              filter === 'DEPOSIT_VALIDATED'
                ? { label: 'Total des dépôts', value: `${xaf(client.totalDeposits || 0)} XAF` }
                : { label: 'Total des paiements', value: `${xaf(client.totalPayments || 0)} XAF` },
            ]}
          />
        </div>
      )}

      {isLoading && !entries ? (
        <ItemList className="mt-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}
        </ItemList>
      ) : groups.length === 0 ? (
        <EmptyLine>{filter === 'all' ? "Aucune opération pour l'instant." : 'Aucune opération de ce genre.'}</EmptyLine>
      ) : (
        groups.map((g, i) => (
          <section key={g.key}>
            <div className="flex items-baseline justify-between px-5 pt-[18px]">
              <span className={cn('text-[16px] font-semibold', TEXT.muted)}>{g.label}</span>
              {i === 0 && <span className={cn('text-[16px] font-semibold', TEXT.muted)}>Solde après</span>}
            </div>
            <ItemList>
              {g.rows.map((e) => <LedgerItem key={e.id} entry={e} showBalance />)}
            </ItemList>
          </section>
        ))
      )}
      <InfiniteScrollTrigger onLoadMore={() => void fetchNextPage()} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
      <StatementPeriodSheet open={statement.open} onClose={statement.hide} onGenerate={statement.generate} isGenerating={statement.generating} />
    </div>
  );
}
