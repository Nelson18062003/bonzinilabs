import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClient, useClientLedger } from '@/hooks/useClientManagement';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  XCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Clock,
} from 'lucide-react';
import type { LedgerEntryType } from '@/types/admin';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';

const FILTER_OPTIONS: { value: LedgerEntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'DEPOSIT_VALIDATED', label: 'Dépôts' },
  { value: 'PAYMENT_RESERVED', label: 'Paiements' },
  { value: 'ADMIN_CREDIT', label: 'Crédits' },
  { value: 'ADMIN_DEBIT', label: 'Débits' },
];

const ENTRY_TYPE_CONFIG: Record<LedgerEntryType, {
  icon: typeof ArrowDownCircle;
  bgColor: string;
  iconColor: string;
  amountColor: string;
  prefix: string;
  label: string;
  isInformational?: boolean;
}> = {
  DEPOSIT_VALIDATED: {
    icon: ArrowDownCircle,
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-600 dark:text-green-400',
    amountColor: 'text-green-600 dark:text-green-400',
    prefix: '+',
    label: 'Dépôt validé',
  },
  DEPOSIT_REFUSED: {
    icon: XCircle,
    bgColor: 'bg-gray-500/10',
    iconColor: 'text-gray-500 dark:text-gray-400',
    amountColor: 'text-gray-500 dark:text-gray-400',
    prefix: '',
    label: 'Dépôt refusé',
    isInformational: true,
  },
  PAYMENT_RESERVED: {
    icon: Clock,
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    amountColor: 'text-amber-600 dark:text-amber-400',
    prefix: '-',
    label: 'Paiement réservé',
  },
  PAYMENT_EXECUTED: {
    icon: ArrowUpCircle,
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    amountColor: 'text-red-600 dark:text-red-400',
    prefix: '-',
    label: 'Paiement exécuté',
    isInformational: true,
  },
  PAYMENT_CANCELLED_REFUNDED: {
    icon: RefreshCw,
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-600 dark:text-green-400',
    amountColor: 'text-green-600 dark:text-green-400',
    prefix: '+',
    label: 'Paiement remboursé',
  },
  ADMIN_CREDIT: {
    icon: PlusCircle,
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-600 dark:text-green-400',
    amountColor: 'text-green-600 dark:text-green-400',
    prefix: '+',
    label: 'Crédit admin',
  },
  ADMIN_DEBIT: {
    icon: MinusCircle,
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    amountColor: 'text-red-600 dark:text-red-400',
    prefix: '-',
    label: 'Débit admin',
  },
};

export function MobileClientLedger() {
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
    <div className="flex flex-col min-h-screen">
      <MobileHeader
        title={t('history', { defaultValue: 'Historique' })}
        showBack
        backTo={`/m/clients/${clientId}`}
      />

      <PullToRefresh onRefresh={handleRefresh} className="flex-1 px-4 py-4 space-y-4">
        {/* Client Info */}
        {client && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {client.firstName} {client.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('currentBalance', { defaultValue: 'Solde actuel' })}: {formatCurrency(client.walletBalance || 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Chips */}
        <MobileFilterChips
          filters={FILTER_OPTIONS}
          activeKey={filter}
          onChange={setFilter}
        />

        {/* Ledger Entries */}
        {isLoading && !entries ? (
          <SkeletonListScreen count={5} />
        ) : entries && entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => {
              const config = ENTRY_TYPE_CONFIG[entry.entryType];
              const Icon = config.icon;

              return (
                <div
                  key={entry.id}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      config.bgColor
                    )}>
                      <Icon className={cn('w-5 h-5', config.iconColor)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{config.label}</p>
                          {config.isInformational && (
                            <p className="text-[11px] italic text-muted-foreground/70">
                              (informatif — aucun impact sur le solde)
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {entry.description}
                          </p>
                        </div>
                        <p className={cn('font-semibold whitespace-nowrap', config.amountColor)}>
                          {config.prefix}{formatCurrency(entry.amountXAF)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(entry.createdAt)}</span>
                        <span>{t('balance', { defaultValue: 'Solde' })}: {formatCurrency(entry.balanceAfter)}</span>
                      </div>

                      {entry.createdByAdminName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Par: {entry.createdByAdminName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <MobileEmptyState
            icon={Clock}
            title={filter === 'all' ? t('noMovementsRecorded', { defaultValue: 'Aucun mouvement enregistré' }) : t('noMovementsOfType', { defaultValue: 'Aucun mouvement de ce type' })}
          />
        )}
      </PullToRefresh>
    </div>
  );
}
