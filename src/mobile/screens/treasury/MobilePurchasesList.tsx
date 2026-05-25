import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowDownToLine, Trash2, Ban, ChevronRight, AlertTriangle, SlidersHorizontal, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { DateField, TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryOperations, useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const CHANNEL_LABELS: Record<string, string> = {
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  cash: 'Cash',
  other: 'Autre',
};

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Mes achats USDT" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-3 space-y-3">
        {/* Period chips */}
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
                preset === p.value ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 bg-violet-50 border border-violet-200 rounded-xl p-3">
            <DateField label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <DateField label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}

        {/* Filters toggle + voided */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold border-2 transition-colors',
              activeFilterCount > 0
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-border bg-white text-muted-foreground',
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

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border border-border rounded-2xl p-3 space-y-3">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Fournisseur</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-white text-[14px]"
              >
                <option value="">Tous les fournisseurs</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.short_id} · {s.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Canal</label>
              <div className="flex flex-wrap gap-1.5">
                {['', 'bank_transfer', 'mobile_money', 'cash', 'other'].map((c) => (
                  <button
                    key={c || 'all'}
                    onClick={() => setChannel(c)}
                    className={cn(
                      'h-8 px-3 rounded-full text-[12px] font-semibold border-2 transition-colors',
                      channel === c
                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-border bg-white text-muted-foreground',
                    )}
                  >
                    {c === '' ? 'Tous' : CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5">Trier par</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-white text-[14px]"
              >
                <option value="date_desc">Date (plus récent)</option>
                <option value="date_asc">Date (plus ancien)</option>
                <option value="amount_desc">Montant XAF (plus grand)</option>
                <option value="amount_asc">Montant XAF (plus petit)</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-600"
              >
                <X className="w-3.5 h-3.5" />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-[12px]">
          <span className="text-muted-foreground">Total ({purchases.filter((p) => !p.voided_at).length} achats) : </span>
          <span className="font-bold">
            {fmt(
              purchases.filter((p) => !p.voided_at).reduce((s, p) => s + Number(p.usdt_amount ?? 0), 0),
              2,
            )}{' '}
            USDT
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold">
            {fmt(
              purchases.filter((p) => !p.voided_at).reduce((s, p) => s + Number(p.xaf_amount ?? 0), 0),
              0,
            )}{' '}
            XAF
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            Aucun achat avec ces critères.
          </div>
        ) : (
          <div className="space-y-2">
            {purchases.map((op) => (
              <PurchaseCard
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

      {confirmDelete && (
        <DeleteDialog
          op={confirmDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function PurchaseCard({
  op,
  canDelete,
  onDelete,
  onClick,
}: {
  op: Extract<OperationRow, { kind: 'purchase' }>;
  canDelete: boolean;
  onDelete: () => void;
  onClick: () => void;
}) {
  const voided = !!op.voided_at;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border p-3.5 flex items-center gap-3',
        voided ? 'border-border opacity-60' : 'border-violet-200',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0',
          voided ? 'bg-slate-400' : 'bg-violet-600',
        )}
      >
        {voided ? <Ban className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
      </div>

      <button onClick={onClick} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[14px] truncate">
            {op.supplier?.display_name ?? '—'}
          </span>
          {voided && (
            <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              Supprimée
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{fmtDate(op.occurred_at)}</div>
        <div className="text-[12px] mt-0.5 tabular-nums">
          <span className="font-bold">{fmt(Number(op.xaf_amount), 0)} XAF</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-bold">{fmt(Number(op.usdt_amount), 4)} USDT</span>
          <span className="text-muted-foreground ml-1">@ {fmt(Number(op.implicit_rate), 4)}</span>
        </div>
      </button>

      {canDelete && !voided ? (
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-50 flex-shrink-0"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      )}
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
      <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-foreground">Supprimer cet achat ?</h2>
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
          <Button variant="outline" onClick={onClose} className="flex-1">
            Garder
          </Button>
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
