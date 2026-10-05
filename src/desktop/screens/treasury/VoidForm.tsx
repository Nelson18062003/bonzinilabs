/**
 * Annuler une opération (super admin) : contre-passe ses écritures au grand
 * livre. L'opération reste visible, barrée, avec son motif. Le motif est
 * obligatoire (10 caractères au moins) — l'annulation ne se défait pas.
 */
import { useState } from 'react';
import { useVoidTreasuryOperation } from '@/hooks/useTreasury';
import { BTN, REASON_MIN, reasonError } from './tstyle';
import { Field, Modal, Notice, TextArea } from './tkit';
import type { OperationKind } from './treasuryNav';
import { sourceTableOf } from './treasuryLabels';
import { Loader2 } from 'lucide-react';

export function VoidForm({ operation, onClose }: { operation: { kind: OperationKind; id: string; label: string } | null; onClose: () => void }) {
  if (!operation) return null;
  return <VoidBody key={operation.id} operation={operation} onClose={onClose} />;
}

function VoidBody({ operation, onClose }: { operation: { kind: OperationKind; id: string; label: string }; onClose: () => void }) {
  const voidOp = useVoidTreasuryOperation();
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const n = reason.trim().length;
  const err = reasonError(reason, tried);

  const confirm = () => {
    setTried(true);
    if (n < REASON_MIN || voidOp.isPending) return;
    voidOp.mutate(
      { source_table: sourceTableOf(operation.kind), source_id: operation.id, void_reason: reason.trim() },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={operation.kind === 'purchase' ? 'Annuler cet achat ?' : 'Annuler cette vente ?'}
      description={operation.label}
      width={500}
      footer={
        <>
          <button type="button" className={BTN.soft} onClick={onClose}>
            Retour
          </button>
          <button type="button" className={BTN.dangerSolid} onClick={confirm} disabled={voidOp.isPending}>
            {voidOp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Annuler l’opération
          </button>
        </>
      }
    >
      <Notice tone="danger">
        Toutes ses écritures seront contre-passées : les soldes des comptes et le stock d’USDT reviennent comme avant. Cela ne se défait pas.
      </Notice>
      <Field label="Motif de l’annulation" htmlFor="void-reason" error={err} hint={`${REASON_MIN} caractères au moins. Il restera affiché sur l’opération.`}>
        <TextArea id="void-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. saisie en double du 12/08" />
      </Field>
    </Modal>
  );
}
