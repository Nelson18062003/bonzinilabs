import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { DateField } from '@/components/form';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { Segmented } from '@/components/treasury/Segmented';
import { SelectField } from '@/components/treasury/SelectField';
import { VoidOperationDialog } from '@/components/treasury/VoidOperationDialog';
import { FieldLabel, INSET, Pill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const CHANNEL_LABELS: Record<string, string> = {
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  cash: 'Cash',
  other: 'Autre',
};

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date (plus récent)' },
  { value: 'date_asc', label: 'Date (plus ancien)' },
  { value: 'amount_desc', label: 'Montant XAF (plus grand)' },
  { value: 'amount_asc', label: 'Montant XAF (plus petit)' },
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

export function MobilePurchasesList() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [channel, setChannel] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [confirmDelete, setConfirmDelete] = useState<OperationRow | null>(null);
  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data, isLoading } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());
  const { data: suppliers } = useCounterparties('usdt_supplier', true);

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const activeFilterCount = (supplierId ? 1 : 0) + (channel ? 1 : 0) + (sortBy !== 'date_desc' ? 1 : 0);

  const resetFilters = () => {
    setSupplierId('');
    setChannel('');
    setSortBy('date_desc');
  };

  let purchases = (data ?? []).filter((op): op is Extract<OperationRow, { kind: 'purchase' }> => {
    if (op.kind !== 'purchase') return false;
    if (!showVoided && op.voided_at) return false;
    if (supplierId && op.supplier_id !== supplierId) return false;
    if (channel && op.channel !== channel) return false;
    return true;
  });

  purchases = [...purchases].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return (a.occurred_at ?? '').localeCompare(b.occurred_at ?? '');
      case 'amount_desc':
        return Number(b.xaf_amount) - Number(a.xaf_amount);
      case 'amount_asc':
        return Number(a.xaf_amount) - Number(b.xaf_amount);
      default:
        return (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '');
    }
  });

  const live = purchases.filter((p) => !p.voided_at);
  const totalUsdt = live.reduce((s, p) => s + Number(p.usdt_amount ?? 0), 0);
  const totalXaf = live.reduce((s, p) => s + Number(p.xaf_amount ?? 0), 0);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Mes achats USDT" showBack backTo="/m/more/treasury" />

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

        {/* Filters toggle + voided */}
        <div className="flex items-center justify-between">
          <Pill active={activeFilterCount > 0 || showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Pill>
          <Pill active={showVoided} onClick={() => setShowVoided((v) => !v)}>
            Supprimées
          </Pill>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className={cn(SOFT_CARD, 'space-y-3 p-4')}>
            <SelectField
              label="Fournisseur"
              placeholder="Tous les fournisseurs"
              value={supplierId}
              onChange={setSupplierId}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: `${s.short_id} · ${s.display_name}` }))}
            />

            <div>
              <FieldLabel>Canal</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {['', 'bank_transfer', 'mobile_money', 'cash', 'other'].map((c) => (
                  <Pill key={c || 'all'} active={channel === c} onClick={() => setChannel(c)}>
                    {c === '' ? 'Tous' : CHANNEL_LABELS[c]}
                  </Pill>
                ))}
              </div>
            </div>

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

        {/* Summary */}
        <div className={cn(SOFT_CARD, 'flex items-baseline justify-between gap-2 p-4')}>
          <span className="text-[12px] text-muted-foreground">Total · {live.length} achat{live.length > 1 ? 's' : ''}</span>
          <span className="text-right text-[13px] font-bold tabular-nums text-foreground">
            {fmt(totalUsdt, 2)} <span className="font-normal text-muted-foreground">USDT</span>
            <span className="mx-1 font-normal text-muted-foreground">·</span>
            {fmt(totalXaf, 0)} <span className="font-normal text-muted-foreground">XAF</span>
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">Aucun achat avec ces critères.</div>
        ) : (
          <div className="space-y-2.5">
            {purchases.map((op) => (
              <OperationListItem
                key={op.id}
                op={op}
                canDelete={isSuperAdmin}
                onDelete={() => setConfirmDelete(op)}
                onClick={() => navigate(`/m/more/treasury/purchases/${op.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {confirmDelete && <VoidOperationDialog op={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </div>
  );
}
