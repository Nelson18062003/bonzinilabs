import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, SlidersHorizontal, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { DateField, TextField } from '@/components/form';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryAccounts, useTreasuryOperations, useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

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
      if (cnyAccountId === 'none' && op.cny_account_id) return false;
      if (cnyAccountId !== 'none' && op.cny_account_id !== cnyAccountId) return false;
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

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Mes ventes USDT" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-3 space-y-3">
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { value: '7d' as const, label: '7 j' },
            { value: '30d' as const, label: '30 j' },
            { value: '90d' as const, label: '90 j' },
            { value: 'all' as const, label: 'Tout' },
            { value: 'custom' as const, label: 'Perso' },
          ]).map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                'flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors',
                preset === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
            <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold border-2 transition-colors',
              activeFilterCount > 0
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
            Supprimées
          </label>
        </div>

        {showFilters && (
          <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Acheteur</label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-card text-[14px]"
              >
                <option value="">Tous les acheteurs</option>
                {(buyers ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.short_id} · {b.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Compte CNY crédité</label>
              <select
                value={cnyAccountId}
                onChange={(e) => setCnyAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-card text-[14px]"
              >
                <option value="">Tous</option>
                <option value="none">Aucun compte Bonzini</option>
                {(cnyAccounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Trier par</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-card text-[14px]"
              >
                <option value="date_desc">Date (plus récent)</option>
                <option value="date_asc">Date (plus ancien)</option>
                <option value="amount_desc">Montant USDT (plus grand)</option>
                <option value="amount_asc">Montant USDT (plus petit)</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400"
              >
                <X className="w-3.5 h-3.5" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-[12px]">
          <span className="text-muted-foreground">Total ({sales.filter((s) => !s.voided_at).length} ventes) : </span>
          <span className="font-bold">
            {fmt(
              sales.filter((s) => !s.voided_at).reduce((sum, s) => sum + Number(s.usdt_amount ?? 0), 0),
              2,
            )}{' '}
            USDT
          </span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-bold">
            {fmt(
              sales.filter((s) => !s.voided_at).reduce((sum, s) => sum + Number(s.cny_amount ?? 0), 0),
              2,
            )}{' '}
            CNY
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            Aucune vente avec ces critères.
          </div>
        ) : (
          <div className="space-y-2">
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

      {confirmDelete && <DeleteDialog op={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </div>
  );
}

function DeleteDialog({ op, onClose }: { op: OperationRow; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const voidOp = useVoidTreasuryOperation();
  const valid = reason.trim().length >= 10;

  const handleConfirm = async () => {
    if (!valid) return;
    const result = await voidOp.mutateAsync({
      source_table: op.kind === 'purchase' ? 'usdt_purchase' : 'usdt_sale',
      source_id: op.id,
      void_reason: reason.trim(),
    });
    if (result.success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-foreground">Supprimer cette vente ?</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              L’opération disparaîtra des stats et des soldes. Pour des raisons d’audit fintech, une
              contre-écriture est enregistrée dans le ledger (l’action est tracée, irréversible).
            </p>
          </div>
        </div>
        <TextField
          label="Motif * (10 caractères min)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Garder</Button>
          <Button
            onClick={handleConfirm}
            disabled={!valid || voidOp.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {voidOp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer la suppression'}
          </Button>
        </div>
      </div>
    </div>
  );
}
