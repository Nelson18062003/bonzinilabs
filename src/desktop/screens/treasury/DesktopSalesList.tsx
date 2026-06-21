/**
 * Desktop admin — Treasury sales (USDT → CNY) list.
 *
 * Same data, filters and treasury primitives as MobileSalesList
 * (useTreasuryOperations, buyers, CNY accounts, period/buyer/account/sort
 * filters, void dialog, OperationListItem rows) — laid out for a wide screen.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X, Plus, Loader2, ArrowUpFromLine } from 'lucide-react';
import { DateField } from '@/components/form';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { Segmented } from '@/components/treasury/Segmented';
import { SelectField } from '@/components/treasury/SelectField';
import { VoidOperationDialog } from '@/components/treasury/VoidOperationDialog';
import { INSET, Pill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryAccounts, useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { PRIMARY_PILL, Holder } from '@/mobile/designKit';
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

export function DesktopSalesList() {
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
    return <Navigate to="/m" replace />;
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
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Ventes USDT</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{live.length} vente{live.length > 1 ? 's' : ''} sur la période</p>
        </div>
        <button
          onClick={() => navigate('/m/more/treasury/sale')}
          className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
        >
          <Plus className="h-4 w-4" /> Nouvelle vente
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-md">
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
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Pill active={activeFilterCount > 0 || showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Pill>
          <Pill active={showVoided} onClick={() => setShowVoided((v) => !v)}>
            Supprimées
          </Pill>
        </div>
      </div>

      {preset === 'custom' && (
        <div className={cn(INSET, 'grid max-w-md grid-cols-2 gap-2 p-3')}>
          <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {showFilters && (
        <div className={cn(SOFT_CARD, 'grid grid-cols-1 gap-3 p-4 md:grid-cols-3')}>
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
          <SelectField label="Trier par" value={sortBy} onChange={(v) => setSortBy(v as SortKey)} options={SORT_OPTIONS} />
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

      {/* Summary */}
      <div className={cn(SOFT_CARD, 'flex items-baseline justify-between gap-2 p-4')}>
        <span className="text-[12px] text-muted-foreground">Total · {live.length} vente{live.length > 1 ? 's' : ''}</span>
        <span className="text-right text-[14px] font-bold tabular-nums text-foreground">
          {fmt(totalUsdt, 2)} <span className="font-normal text-muted-foreground">USDT</span>
          <span className="mx-1 font-normal text-muted-foreground">→</span>
          {fmt(totalCny, 2)} <span className="font-normal text-muted-foreground">CNY</span>
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Holder icon={ArrowUpFromLine} size="lg" />
          <p className="mt-4 text-[14px] font-medium text-muted-foreground">Aucune vente avec ces critères.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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

      {confirmDelete && <VoidOperationDialog op={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </div>
  );
}
