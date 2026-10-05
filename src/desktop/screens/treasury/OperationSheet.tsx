/**
 * Trésorerie — la fiche d'une opération : son reçu, prêt à partir.
 *
 * Ce qu'on vient chercher en ouvrant un achat ou une vente, c'est le plus
 * souvent la preuve à envoyer : le reçu est donc au centre, en grand, avec
 * « Copier l'image » juste dessous. Le reste (note interne, écritures du
 * grand livre, liens vers la contrepartie et les comptes, annulation) est
 * replié en bas — présent, pas encombrant.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOperationEntries, usePurchase, useSale, type OperationRow } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { Empty, ErrorState, Loading, Modal, Money, TextLink } from './tkit';
import { useTreasuryActions } from './treasuryActions';
import { treasuryPaths, type OperationKind } from './treasuryNav';
import { fmtNum, type TreasuryCurrency } from './treasuryFormat';
import { entryKindLabel } from './treasuryLabels';
import { receiptFromOperation } from './receiptData';
import { OperationReceipt, ReceiptActions } from './OperationReceipt';

export function OperationSheet({ open, loaded, onClose }: { open: { kind: OperationKind; id: string }; loaded: OperationRow | null; onClose: () => void }) {
  // Ouverte par un lien vers une opération HORS de la période affichée : on
  // la lit seule plutôt que de dire « introuvable ».
  const purchase = usePurchase(!loaded && open.kind === 'purchase' ? open.id : undefined);
  const sale = useSale(!loaded && open.kind === 'sale' ? open.id : undefined);
  const entries = useOperationEntries(open.id);
  const fetched = open.kind === 'purchase' ? purchase : sale;
  const op: OperationRow | null = loaded ?? (fetched.data ? ({ ...fetched.data, kind: open.kind } as OperationRow) : null);
  const title = open.kind === 'purchase' ? 'Achat d’USDT' : 'Vente d’USDT';

  if (!op) {
    return (
      <Modal open onClose={onClose} title={title} width={520}>
        {fetched.isLoading ? (
          <Loading rows={5} className="p-0" />
        ) : fetched.isError ? (
          <ErrorState onRetry={() => void fetched.refetch()} />
        ) : (
          <Empty title="Opération introuvable">Elle a peut-être été supprimée, ou le lien est incomplet.</Empty>
        )}
      </Modal>
    );
  }
  return <SheetBody op={op} entries={entries} title={title} onClose={onClose} />;
}

function SheetBody({
  op,
  entries,
  title,
  onClose,
}: {
  op: OperationRow;
  entries: ReturnType<typeof useOperationEntries>;
  title: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const data = receiptFromOperation(op, entries.data);
  const cpId = op.kind === 'purchase' ? op.supplier?.id ?? op.supplier_id : op.buyer?.id ?? op.buyer_id;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description="Le reçu à envoyer comme preuve. Copiez-le en image et collez-le dans WhatsApp ou WeChat."
      width={540}
      scrollable
      bodyClassName="pb-6"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-muted/60 px-4 py-6">
        <OperationReceipt ref={receiptRef} data={data} />
        <ReceiptActions target={receiptRef} data={data} className="w-[420px]" />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className={cn('flex w-full items-center justify-between rounded-xl px-1 py-2 text-[14px] font-semibold', TK.focus)}
        >
          Détails internes
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', more && 'rotate-180')} />
        </button>
        {more && (
          <div className="mt-2 space-y-5">
            {op.notes && (
              <div>
                <div className={cn(TK.label, 'mb-1')}>Note</div>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{op.notes}</p>
              </div>
            )}
            <div>
              <div className={cn(TK.label, 'mb-2')}>Écritures au grand livre</div>
              {entries.isLoading ? (
                <Loading rows={2} className="p-0" />
              ) : entries.isError ? (
                <ErrorState onRetry={() => void entries.refetch()} className="py-4" />
              ) : (
                <ul className="divide-y divide-border/60 rounded-xl ring-1 ring-black/[0.06]">
                  {(entries.data ?? []).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                      <button
                        type="button"
                        onClick={() => e.account && navigate(treasuryPaths.account(e.account.id))}
                        className="min-w-0 text-left hover:underline"
                      >
                        <div className="truncate font-medium">{e.account?.label ?? '—'}</div>
                        <div className="text-[12.5px] text-muted-foreground">{entryKindLabel(e.entry_kind)}</div>
                      </button>
                      <Money value={Number(e.amount)} cur={e.currency as TreasuryCurrency} size="sm" sign tone />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {cpId ? (
                <TextLink onClick={() => navigate(treasuryPaths.counterparty(cpId))}>
                  Voir la fiche {op.kind === 'purchase' ? 'du fournisseur' : 'de l’acheteur'} ›
                </TextLink>
              ) : (
                <span />
              )}
              {actions.canVoid && !op.voided_at && (
                <button
                  type="button"
                  className={BTN.danger}
                  onClick={() =>
                    actions.voidOperation({
                      kind: op.kind,
                      id: op.id,
                      label: `${op.kind === 'purchase' ? 'Achat' : 'Vente'} de ${fmtNum(Number(op.usdt_amount), 2)} USDT · ${data.counterparty?.name ?? ''}`,
                    })
                  }
                >
                  <Ban className="h-4 w-4" /> Annuler l’opération
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
