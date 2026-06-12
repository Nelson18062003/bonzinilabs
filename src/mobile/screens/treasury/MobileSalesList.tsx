import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { DateField } from '@/components/form';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { Segmented } from '@/components/treasury/Segmented';
import { SelectField } from '@/components/treasury/SelectField';
import { VoidOperationDialog } from '@/components/treasury/VoidOperationDialog';
import { INSET, Pill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryAccounts, useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const NO_ACCOUNT = 'none';

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date (plus récent)' },
  { value: 'date_asc', label: 'Date (plus ancien)' },
  { value: 'amount_desc', label: 'Montant USDT (plus grand)' },
  { value: 'amount_asc', label: 'Montant USDT (plus petit)' },
];

function getRange(preset: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'custom') {
    return {
      from: customFrom ? new Date(customFrom + 'T00:00:00') : new Date(to.getFullYear(), to.getMonth(), 1),
      to: customTo ? new Date(customTo + 'T23:59:59') : to,
    };
  }
  if (preset === 'all') {
    from.setFullYear(2020, 0, 1);
  } else {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    from.setDate(to.getDate() - days);
  }
  return { from, to };
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function MobileSalesList() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [confirmDelete, setConfirmDelete] = useState<OperationRow | null>(null);
  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data, isLoading } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());
  const { data: buyers } = useCounterparties('cny_buyer', true);
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const activeFilterCount = (buyerId ? 1 : 0) + (cnyAccountId ? 1 : 0) + (sortBy !== 'date_desc' ? 1 : 0);
  const resetFilters = () => {
    setBuyerId('');
    setCnyAccountId('');
    setSortBy('date_desc');
  };

  let sales = (data ?? []).filter((op): op is Extract<OperationRow, { kind: 'sale' }> => {
    if (op.kind !== 'sale') return false;
    if (!showVoided && op.voided_at) return false;
    if (buyerId && op.buyer_id !== buyerId) return false;
    if (cnyAccountId) {
      if (cnyAccountId === NO_ACCOUNT && op.cny_account_id) return false;
      if (cnyAccountId !== NO_ACCOUNT && op.cny_account_id !== cnyAccountId) return false;
    }
    return true;
  });

  sales = [...sales].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return (a.occurred_at ?? '').localeCompare(b.occurred_at ?? '');
      case 'amount_desc':
        return Number(b.usdt_amount) - Number(a.usdt_amount);
      case 'amount_asc':
        return Number(a.usdt_amount) - Number(b.usdt_amount);
      default:
        return (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '');
    }
  });

  const live = sales.filter((s) => !s.voided_at);
  const totalUsdt = live.reduce((sum, s) => sum + Number(s.usdt_amount ?? 0), 0);
  const totalCny = live.reduce((sum, s) => sum + Number(s.cny_amount ?? 0), 0);

  const accountOptions = [
    { value: NO_ACCOUNT, label: 'Aucun compte Bonzini' },
    ...(cnyAccounts ?? []).map((a) => ({ value: a.id, label: a.label })),
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Mes ventes USDT" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-4 space-y-3">
        <Segmented
          value={preset}
          onChange={setPreset}
          options={[
            { value: '7d', label: '7 j' },
            { value: '30d', label: '30 j' },
            { value: '90d', label: '90 j' },
            { value: 'all', label: 'Tout' },
            { value: 'custom', label: 'Perso' },
          ]}
        />

        {preset === 'custom' && (
          <div className={cn(INSET, 'grid grid-cols-2 gap-2 p-3')}>
            <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Pill active={activeFilterCount > 0 || showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Pill>
          <Pill active={showVoided} onClick={() => setShowVoided((v) => !v)}>
            Supprimées
          </Pill>
        </div>

        {showFilters && (
          <div className={cn(SOFT_CARD, 'space-y-3 p-4')}>
            <SelectField
              label="Acheteur"
              placeholder="Tous les acheteurs"
              value={buyerId}
              onChange={setBuyerId}
              options={(buyers ?? []).map((b) => ({ value: b.id, label: `${b.short_id} · ${b.display_name}` }))}
            />
            <SelectField
              label="Compte CNY crédité"
              placeholder="Tous"
              value={cnyAccountId}
              onChange={setCnyAccountId}
              options={accountOptions}
            />
            <SelectField
              label="Trier par"
              value={sortBy}
              onChange={(v) => setSortBy(v as SortKey)}
              options={SORT_OPTIONS}
            />

            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        <div className={cn(SOFT_CARD, 'flex items-baseline justify-between gap-2 p-4')}>
          <span className="text-[12px] text-muted-foreground">Total · {live.length} vente{live.length > 1 ? 's' : ''}</span>
          <span className="text-right text-[13px] font-bold tabular-nums text-foreground">
            {fmt(totalUsdt, 2)} <span className="font-normal text-muted-foreground">USDT</span>
            <span className="mx-1 font-normal text-muted-foreground">→</span>
            {fmt(totalCny, 2)} <span className="font-normal text-muted-foreground">CNY</span>
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">Aucune vente avec ces critères.</div>
        ) : (
          <div className="space-y-2.5">
            {sales.map((op) => (
              <OperationListItem
                key={op.id}
                op={op}
                canDelete={isSuperAdmin}
                onDelete={() => setConfirmDelete(op)}
                onClick={() => navigate(`/m/more/treasury/sales/${op.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {confirmDelete && <VoidOperationDialog op={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </div>
  );
}
