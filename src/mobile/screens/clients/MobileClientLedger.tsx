import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClient, useClientLedger } from '@/hooks/useClientManagement';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import type { LedgerEntryType } from '@/types/admin';
import { ENTRY_TYPE_CONFIG, AMOUNT_TONE } from '@/lib/ledgerDisplay';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  Card,
  Holder,
} from '@/mobile/designKit';

const FILTER_OPTIONS: { value: LedgerEntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'DEPOSIT_VALIDATED', label: 'Dépôts' },
  { value: 'PAYMENT_RESERVED', label: 'Paiements' },
  { value: 'ADMIN_CREDIT', label: 'Crédits' },
  { value: 'ADMIN_DEBIT', label: 'Débits' },
];

export function MobileClientLedger({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const { clientId } = useParams();
  const [filter, setFilter] = useState<LedgerEntryType | 'all'>('all');

  const { data: client, isLoading: clientLoading, refetch: refetchClient } = useClient(clientId || '');
  const { data: entries, isLoading: entriesLoading, refetch: refetchEntries } = useClientLedger(
    clientId || '',
    { entryType: filter !== 'all' ? filter : undefined }
  );

  const isLoading = clientLoading || entriesLoading;

  const handleRefresh = async () => {
    await Promise.all([refetchClient(), refetchEntries()]);
  };

  return (
    <div className={desktop ? '' : 'flex min-h-screen flex-col'}>
      {desktop ? (
        <header className="mb-5">
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>{t('history', { defaultValue: 'Historique' })}</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>{t('clientLedgerSubtitle', { defaultValue: 'Grand livre du client' })}</p>
        </header>
      ) : (
        <MobileHeader
          title={t('history', { defaultValue: 'Historique' })}
          showBack
          backTo={`/m/clients/${clientId}`}
        />
      )}

      <PullToRefresh onRefresh={handleRefresh} className={desktop ? 'space-y-4' : cn('flex-1 space-y-4 px-4 py-5', SURFACE.canvas)}>
        {/* Client Info */}
        {client && (
          <Card>
            <p className={cn('text-[15px] font-bold', TEXT.strong)}>
              {client.firstName} {client.lastName}
            </p>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>
              {t('currentBalance', { defaultValue: 'Solde actuel' })}: {formatCurrency(client.walletBalance || 0)}
            </p>
          </Card>
        )}

        {/* Filter Chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                filter === opt.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Ledger Entries */}
        {isLoading && !entries ? (
          <SkeletonListScreen count={5} />
        ) : entries && entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => {
              const config = ENTRY_TYPE_CONFIG[entry.entryType];
              const Icon = config.icon;

              return (
                <Card key={entry.id}>
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <Holder icon={Icon} tone={config.tone} />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{config.label}</p>
                          {config.isInformational && (
                            <p className={cn('text-[11px] italic', TEXT.muted)}>
                              (informatif — aucun impact sur le solde)
                            </p>
                          )}
                          <p className={cn('line-clamp-2 text-[12px]', TEXT.muted)}>
                            {entry.description}
                          </p>
                        </div>
                        <p className={cn('whitespace-nowrap text-[14px] font-bold tabular-nums', AMOUNT_TONE[config.tone])}>
                          {config.prefix}{formatCurrency(entry.amountXAF)}
                        </p>
                      </div>

                      <div className={cn('mt-2 flex items-center justify-between text-[12px]', TEXT.muted)}>
                        <span>{formatDate(entry.createdAt)}</span>
                        <span>{t('balance', { defaultValue: 'Solde' })}: {formatCurrency(entry.balanceAfter)}</span>
                      </div>

                      {entry.createdByAdminName && (
                        <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                          Par: {entry.createdByAdminName}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Holder icon={Clock} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
              {filter === 'all' ? t('noMovementsRecorded', { defaultValue: 'Aucun mouvement enregistré' }) : t('noMovementsOfType', { defaultValue: 'Aucun mouvement de ce type' })}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
