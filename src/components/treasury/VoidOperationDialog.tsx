import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { TextField } from '@/components/form';
import { IconChip } from '@/components/treasury/ui';
import { useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

/**
 * Shared confirmation sheet for voiding a treasury operation (purchase OR sale).
 * Replaces the verbatim-duplicated dialog that lived in both list screens.
 * Bottom-sheet on mobile, centered on larger screens; soft rounded surface,
 * danger icon chip, two rounded-full pills (keep / delete).
 */
export function VoidOperationDialog({ op, onClose }: { op: OperationRow; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const voidOp = useVoidTreasuryOperation();
  const valid = reason.trim().length >= 10;
  const isPurchase = op.kind === 'purchase';

  const handleConfirm = async () => {
    if (!valid) return;
    const result = await voidOp.mutateAsync({
      source_table: isPurchase ? 'usdt_purchase' : 'usdt_sale',
      source_id: op.id,
      void_reason: reason.trim(),
    });
    if (result.success) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-card p-5 pb-7 sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <IconChip icon={AlertTriangle} tone="danger" />
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-foreground">
              Supprimer {isPurchase ? 'cet achat' : 'cette vente'} ?
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              L’opération disparaîtra des stats et des soldes. Pour l’audit, une contre-écriture est
              enregistrée dans le ledger (action tracée, irréversible).
            </p>
          </div>
        </div>

        <TextField label="Motif (10 caractères min)" value={reason} onChange={(e) => setReason(e.target.value)} />

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="h-[52px] flex-1 rounded-full bg-muted text-[15px] font-bold text-foreground transition active:scale-[0.99]"
          >
            Garder
          </button>
          <button
            onClick={handleConfirm}
            disabled={!valid || voidOp.isPending}
            className={cn(
              'flex h-[52px] flex-1 items-center justify-center rounded-full text-[15px] font-bold transition active:scale-[0.99]',
              valid && !voidOp.isPending ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-muted text-muted-foreground',
            )}
          >
            {voidOp.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}
