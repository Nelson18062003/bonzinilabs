import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowUpFromLine, Trash2, Ban, ChevronRight, AlertTriangle } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryOperations, useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Preset = '7d' | '30d' | '90d' | 'all';

function getRange(preset: Preset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
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

export function MobileSalesList() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [preset, setPreset] = useState<Preset>('30d');
  const [showVoided, setShowVoided] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OperationRow | null>(null);
  const range = useMemo(() => getRange(preset), [preset]);
  const { data, isLoading } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const sales = (data ?? []).filter((op) => {
    if (op.kind !== 'sale') return false;
    if (!showVoided && op.voided_at) return false;
    return true;
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

        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
          Afficher les opérations supprimées
        </label>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px]">
          <span className="text-muted-foreground">Total ventes actives : </span>
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
              sales.filter((s) => !s.voided_at).reduce((sum, s) => sum + Number((s as { cny_amount: number }).cny_amount ?? 0), 0),
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
            Aucune vente sur cette période.
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((op) => (
              <SaleCard
                key={op.id}
                op={op as Extract<OperationRow, { kind: 'sale' }>}
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

function SaleCard({
  op,
  canDelete,
  onDelete,
  onClick,
}: {
  op: Extract<OperationRow, { kind: 'sale' }>;
  canDelete: boolean;
  onDelete: () => void;
  onClick: () => void;
}) {
  const voided = !!op.voided_at;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border p-3.5 flex items-center gap-3',
        voided ? 'border-border opacity-60' : 'border-amber-200',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0',
          voided ? 'bg-slate-400' : 'bg-amber-500',
        )}
      >
        {voided ? <Ban className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
      </div>

      <button onClick={onClick} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[14px] truncate">{op.buyer?.display_name ?? '—'}</span>
          {voided && (
            <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              Supprimée
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {fmtDate(op.occurred_at)}
          {op.cny_account?.label ? ` · ${op.cny_account.label}` : ''}
        </div>
        <div className="text-[12px] mt-0.5 tabular-nums">
          <span className="font-bold">{fmt(Number(op.usdt_amount), 4)} USDT</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-bold">{fmt(Number(op.cny_amount), 2)} CNY</span>
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
