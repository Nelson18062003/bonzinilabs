/**
 * L'historique d'un client — chaque écriture en une phrase.
 *
 * « +850 000 XAF » en couleur, puis « Dépôt validé, il y a 8 jours. », la
 * description telle qu'elle est (jamais coupée), « Solde après : 1 840 000
 * XAF. » et, si un admin l'a faite, « Par Nom. ». Les filtres sont des
 * Tag Toggle à 40 px. Rien sous 16 px.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClient, useClientLedgerPaged } from '@/hooks/useClientManagement';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatXAF } from '@/lib/formatters';
import { whenSentence } from '@/lib/plainTime';
import { cn } from '@/lib/utils';
import type { LedgerEntryType } from '@/types/admin';
import { ENTRY_TYPE_CONFIG } from '@/lib/ledgerDisplay';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { SURFACE, TEXT, Chip, Holder, Line } from '@/mobile/designKit';

const FILTER_OPTIONS: { value: LedgerEntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'DEPOSIT_VALIDATED', label: 'Dépôts' },
  { value: 'PAYMENT_RESERVED', label: 'Paiements' },
  { value: 'ADMIN_CREDIT', label: 'Ajouts' },
  { value: 'ADMIN_DEBIT', label: 'Retraits' },
];

/** Le montant en couleur foncée : vert = entrée, ambre = réservé, rouge = sortie, encre = informatif. */
const AMOUNT_COLOR: Record<string, string> = {
  success: 'text-[#009951] dark:text-[#14AE5C]',
  pending: 'text-[#975102] dark:text-[#E8B931]',
  danger: 'text-[#C00F0C] dark:text-[#EC221F]',
};
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function MobileClientLedger({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const { clientId } = useParams();
  const [filter, setFilter] = useState<LedgerEntryType | 'all'>('all');

  const { data: client, isLoading: clientLoading, refetch: refetchClient } = useClient(clientId || '');
  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries, hasNextPage, fetchNextPage, isFetchingNextPage } = useClientLedgerPaged(
    clientId || '',
    { entryType: filter !== 'all' ? filter : undefined },
  );
  const isLoading = clientLoading || entriesLoading;
  const handleRefresh = async () => { await Promise.all([refetchClient(), refetchEntries()]); };

  return (
    <div className={desktop ? '' : 'flex min-h-screen flex-col'}>
      {desktop ? (
        <header className="mb-5">
          <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>{t('history', { defaultValue: 'Historique' })}</h2>
        </header>
      ) : (
        <MobileHeader title="Historique" showBack backTo={`/m/clients/${clientId}`} />
      )}

      <PullToRefresh onRefresh={handleRefresh} className={desktop ? 'space-y-4' : cn('flex flex-1 flex-col gap-4 px-5 pb-8 pt-4', SURFACE.canvas)}>
        {client && (
          <Line>
            <b className={TEXT.strong}>{client.firstName} {client.lastName}</b>, solde aujourd'hui :{' '}
            <b className={cn('tabular-nums', TEXT.strong)}>{formatXAF(client.walletBalance || 0)} XAF</b>.
          </Line>
        )}

        <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} active={filter === opt.value} onClick={() => setFilter(opt.value)} />
          ))}
        </div>

        {isLoading && !entries ? (
          <SkeletonListScreen count={5} />
        ) : entries && entries.length > 0 ? (
          <ul className={cn('divide-y', SURFACE.divider)}>
            {entries.map((entry) => {
              const config = ENTRY_TYPE_CONFIG[entry.entryType];
              const color = config.isInformational ? TEXT.strong : (AMOUNT_COLOR[config.tone] ?? TEXT.strong);
              return (
                <li key={entry.id} className="flex gap-3 py-4">
                  <Holder icon={config.icon} tone={config.isInformational ? 'neutral' : config.tone} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn('text-[20px] font-semibold leading-tight tabular-nums', color)}>
                      {config.prefix}{formatXAF(Math.abs(entry.amountXAF))} XAF
                    </p>
                    <Line>
                      {config.label}, {whenSentence(entry.createdAt)}.
                      {config.isInformational && ' Pour information : le solde ne bouge pas.'}
                    </Line>
                    {entry.description && <Line className={cn('break-words', TEXT.muted)}>{cap(entry.description)}</Line>}
                    {!config.isInformational && (
                      <Line className={TEXT.muted}>Solde après : <span className="tabular-nums">{formatXAF(entry.balanceAfter)} XAF</span>.</Line>
                    )}
                    {entry.createdByAdminName && <Line className={TEXT.muted}>Par {entry.createdByAdminName}.</Line>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Line className={TEXT.muted}>
            {filter === 'all' ? "Aucun mouvement pour l'instant." : 'Aucun mouvement de ce genre.'}
          </Line>
        )}
        {/* Page suivante à l'approche du bas : plus de plafond à 1 000 écritures. */}
        <InfiniteScrollTrigger onLoadMore={() => { void fetchNextPage(); }} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
      </PullToRefresh>
    </div>
  );
}
