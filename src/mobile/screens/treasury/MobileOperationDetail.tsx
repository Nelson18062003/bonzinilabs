import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Ban, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePurchase, usePurchaseSplits, useSale, useVoidTreasuryOperation } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

interface Props {
  kind: 'purchase' | 'sale';
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn('text-[14px] font-semibold text-right', mono && 'tabular-nums')}>{value}</span>
    </div>
  );
}

export function MobileOperationDetail({ kind }: Props) {
  const { operationId } = useParams<{ operationId: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const purchase = usePurchase(kind === 'purchase' ? operationId : undefined);
  const sale = useSale(kind === 'sale' ? operationId : undefined);
  const splits = usePurchaseSplits(kind === 'purchase' ? operationId : undefined);
  const op = kind === 'purchase' ? purchase.data : sale.data;
  const isLoading = kind === 'purchase' ? purchase.isLoading : sale.isLoading;
  const voidOp = useVoidTreasuryOperation();

  const [showVoidForm, setShowVoidForm] = useState(false);
  const [reason, setReason] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <MobileHeader title="Opération" showBack />
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <MobileHeader title="Opération" showBack />
        <div className="text-center text-muted-foreground py-8">Opération introuvable.</div>
      </div>
    );
  }

  const voided = !!op.voided_at;
  const reasonValid = reason.trim().length >= 10;

  const handleVoid = async () => {
    if (!reasonValid || !operationId) return;
    const result = await voidOp.mutateAsync({
      source_table: kind === 'purchase' ? 'usdt_purchase' : 'usdt_sale',
      source_id: operationId,
      void_reason: reason.trim(),
    });
    if (result.success) {
      setShowVoidForm(false);
      setReason('');
      navigate('/m/more/treasury/operations');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader
        title={kind === 'purchase' ? 'Achat USDT' : 'Vente USDT'}
        showBack
        backTo="/m/more/treasury/operations"
      />

      <div className="px-4 py-4 space-y-4">
        {voided && (
          <div className="rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-3 py-2.5 flex items-start gap-2">
            <Ban className="w-4 h-4 text-slate-700 dark:text-slate-200 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-slate-700 dark:text-slate-200">
              <strong>Opération supprimée</strong> le{' '}
              {new Date(op.voided_at!).toLocaleString('fr-FR')}
              {op.void_reason && (
                <>
                  <br />
                  Motif : <em>{op.void_reason}</em>
                </>
              )}
            </div>
          </div>
        )}

        {/* Headline */}
        <div className={cn(
          'rounded-2xl border-2 p-4',
          kind === 'purchase' ? 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10' : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10',
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center text-white',
              kind === 'purchase' ? 'bg-violet-600' : 'bg-amber-500',
            )}>
              {kind === 'purchase' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
            </div>
            <span className="text-[13px] font-bold text-foreground">
              {kind === 'purchase' ? "Achat d'USDT en XAF" : "Vente d'USDT contre CNY"}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums">
            {kind === 'purchase' ? (
              <>
                {fmt(Number((op as { xaf_amount: number }).xaf_amount), 0)}{' '}
                <span className="text-sm text-muted-foreground">XAF</span>
                <span className="text-muted-foreground mx-1.5">→</span>
                {fmt(Number(op.usdt_amount), 2)}{' '}
                <span className="text-sm text-muted-foreground">USDT</span>
              </>
            ) : (
              <>
                {fmt(Number(op.usdt_amount), 2)}{' '}
                <span className="text-sm text-muted-foreground">USDT</span>
                <span className="text-muted-foreground mx-1.5">→</span>
                {fmt(Number((op as { cny_amount: number }).cny_amount), 2)}{' '}
                <span className="text-sm text-muted-foreground">CNY</span>
              </>
            )}
          </div>
          <div className="text-[12px] text-muted-foreground mt-1">
            Taux implicite : {fmt(Number(op.implicit_rate), 4)}{' '}
            {kind === 'purchase' ? 'XAF/USDT' : 'CNY/USDT'}
          </div>
        </div>

        {/* Details */}
        <div className="bg-card rounded-2xl border border-border p-3.5">
          <Row label="Date" value={new Date(op.occurred_at).toLocaleString('fr-FR')} />
          {kind === 'purchase' ? (
            <>
              <Row
                label="Fournisseur"
                value={
                  (op as { supplier?: { display_name: string; phone?: string | null } }).supplier?.display_name ?? '—'
                }
              />
              {(splits.data?.length ?? 0) > 1 ? (
                <div className="py-2 border-b border-border/60">
                  <div className="text-[12px] text-muted-foreground mb-1.5">Comptes XAF débités</div>
                  <div className="space-y-1">
                    {(splits.data ?? []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[13px]">
                        <span>{s.account?.label ?? '—'}</span>
                        <span className="font-semibold tabular-nums">{fmt(Math.abs(Number(s.amount)), 0)} XAF</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Row
                  label="Compte XAF débité"
                  value={
                    (op as { xaf_account?: { label: string } }).xaf_account?.label
                    ?? splits.data?.[0]?.account?.label
                    ?? '—'
                  }
                />
              )}
            </>
          ) : (
            <>
              <Row label="Acheteur" value={(op as { buyer?: { display_name: string } }).buyer?.display_name ?? '—'} />
              <Row label="Compte CNY crédité" value={(op as { cny_account?: { label: string } }).cny_account?.label ?? '—'} />
              <Row label="WAC au moment vente" value={`${fmt(Number((op as { wac_at_sale: number }).wac_at_sale), 4)} XAF/USDT`} mono />
              <Row
                label="Coût XAF sortie"
                value={`${fmt(Number(op.usdt_amount) * Number((op as { wac_at_sale: number }).wac_at_sale), 0)} XAF`}
                mono
              />
            </>
          )}
          {op.external_ref && <Row label="Référence externe" value={op.external_ref} />}
          {op.notes && <Row label="Notes" value={op.notes} />}
        </div>

        {/* Void section */}
        {!voided && isSuperAdmin && (
          <section className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-3.5">
            {showVoidForm ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-300" />
                  <span className="text-[13px] font-bold text-red-700 dark:text-red-300">Supprimer cette opération</span>
                </div>
                <p className="text-[12px] text-red-700 dark:text-red-300 mb-3">
                  L’opération disparaîtra des stats et des soldes. Pour des raisons d’audit fintech, une
                  contre-écriture est enregistrée dans le ledger (l’action est tracée, irréversible).
                </p>
                <TextField
                  label="Motif * (10 caractères min)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setShowVoidForm(false)} className="flex-1">
                    Garder
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleVoid}
                    disabled={!reasonValid || voidOp.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {voidOp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer la suppression'}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowVoidForm(true)}
                className="w-full border-red-300 dark:border-red-600/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:bg-red-500/20"
              >
                <Ban className="w-4 h-4 mr-2" />
                Supprimer cette opération (super admin)
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function MobilePurchaseDetail() {
  return <MobileOperationDetail kind="purchase" />;
}

export function MobileSaleDetail() {
  return <MobileOperationDetail kind="sale" />;
}
