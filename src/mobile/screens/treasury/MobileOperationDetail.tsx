import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Ban, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { TextField } from '@/components/form';
import { IconChip, SOFT_CARD } from '@/components/treasury/ui';
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
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn('text-right text-[14px] font-semibold text-foreground', mono && 'tabular-nums')}>{value}</span>
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
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <MobileHeader title="Opération" showBack />
        <div className="py-8 text-center text-muted-foreground">Opération introuvable.</div>
      </div>
    );
  }

  const isPurchase = kind === 'purchase';
  const voided = !!op.voided_at;
  const reasonValid = reason.trim().length >= 10;

  const handleVoid = async () => {
    if (!reasonValid || !operationId) return;
    const result = await voidOp.mutateAsync({
      source_table: isPurchase ? 'usdt_purchase' : 'usdt_sale',
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
      <MobileHeader title={isPurchase ? 'Achat USDT' : 'Vente USDT'} showBack backTo="/m/more/treasury/operations" />

      <div className="px-5 py-5 space-y-4">
        {voided && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-muted p-4">
            <IconChip icon={Ban} tone="neutral" size="sm" />
            <div className="min-w-0 text-[12px] text-muted-foreground">
              <strong className="text-foreground">Opération supprimée</strong> le{' '}
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
        <div className={cn(SOFT_CARD, 'p-4')}>
          <div className="mb-3 flex items-center gap-2.5">
            <IconChip icon={isPurchase ? ArrowDownToLine : ArrowUpFromLine} tone={isPurchase ? 'violet' : 'amber'} size="sm" />
            <span className="text-[13px] font-bold text-foreground">
              {isPurchase ? "Achat d'USDT en XAF" : "Vente d'USDT contre CNY"}
            </span>
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-foreground">
            {isPurchase ? (
              <>
                {fmt(Number((op as { xaf_amount: number }).xaf_amount), 0)} <span className="text-sm text-muted-foreground">XAF</span>
                <span className="mx-1.5 text-muted-foreground">→</span>
                {fmt(Number(op.usdt_amount), 2)} <span className="text-sm text-muted-foreground">USDT</span>
              </>
            ) : (
              <>
                {fmt(Number(op.usdt_amount), 2)} <span className="text-sm text-muted-foreground">USDT</span>
                <span className="mx-1.5 text-muted-foreground">→</span>
                {fmt(Number((op as { cny_amount: number }).cny_amount), 2)} <span className="text-sm text-muted-foreground">CNY</span>
              </>
            )}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Taux implicite : {fmt(Number(op.implicit_rate), 4)} {isPurchase ? 'XAF/USDT' : 'CNY/USDT'}
          </div>
        </div>

        {/* Details */}
        <div className={cn(SOFT_CARD, 'p-4')}>
          <Row label="Date" value={new Date(op.occurred_at).toLocaleString('fr-FR')} />
          {isPurchase ? (
            <>
              <Row label="Fournisseur" value={(op as { supplier?: { display_name: string } }).supplier?.display_name ?? '—'} />
              {(splits.data?.length ?? 0) > 1 ? (
                <div className="border-b border-border/60 py-2.5">
                  <div className="mb-1.5 text-[12px] text-muted-foreground">Comptes XAF débités</div>
                  <div className="space-y-1">
                    {(splits.data ?? []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[13px]">
                        <span className="text-foreground">{s.account?.label ?? '—'}</span>
                        <span className="font-semibold tabular-nums text-foreground">{fmt(Math.abs(Number(s.amount)), 0)} XAF</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Row
                  label="Compte XAF débité"
                  value={(op as { xaf_account?: { label: string } }).xaf_account?.label ?? splits.data?.[0]?.account?.label ?? '—'}
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
          showVoidForm ? (
            <div className="space-y-3 rounded-2xl bg-red-500/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-[13px] font-bold text-red-700 dark:text-red-300">Supprimer cette opération</span>
              </div>
              <p className="text-[12px] leading-snug text-red-700 dark:text-red-300">
                L’opération disparaîtra des stats et des soldes. Pour l’audit, une contre-écriture est
                enregistrée dans le ledger (action tracée, irréversible).
              </p>
              <TextField label="Motif (10 caractères min)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowVoidForm(false)}
                  className="h-12 flex-1 rounded-2xl bg-muted text-[14px] font-bold text-foreground transition active:scale-[0.99]"
                >
                  Garder
                </button>
                <button
                  onClick={handleVoid}
                  disabled={!reasonValid || voidOp.isPending}
                  className={cn(
                    'flex h-12 flex-1 items-center justify-center rounded-2xl text-[14px] font-bold transition active:scale-[0.99]',
                    reasonValid && !voidOp.isPending ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {voidOp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowVoidForm(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-[14px] font-bold text-red-600 transition active:scale-[0.99] dark:text-red-400"
            >
              <Ban className="h-4 w-4" />
              Supprimer cette opération (super admin)
            </button>
          )
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
