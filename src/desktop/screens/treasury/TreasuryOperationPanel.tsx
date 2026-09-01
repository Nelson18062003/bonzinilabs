/**
 * Trésorerie — panneau de détail d'une opération (archétype B), habillage
 * « salle des marchés ».
 *
 * Remplace la navigation vers un écran téléphone : la liste reste vivante à
 * gauche. Deux choses n'étaient visibles nulle part sur desktop et le sont
 * ici : la VENTILATION par compte d'un achat multi-comptes
 * (`usePurchaseSplits`) et le motif d'annulation d'une opération annulée.
 *
 * « Annuler » vit dans l'en-tête épinglé, avec confirmation et motif
 * obligatoire — l'annulation écrit une contre-écriture, elle n'efface jamais.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePurchaseSplits, useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { M, T, NUM, LABEL, TONE, TONE_BG, MCard, MButton, MSection, MTag, MDialog, MField, MInput } from './marketKit';
import { fmtAmount, fmtNum, RATE_DECIMALS } from './treasuryFormat';

const VOID_REASON_MIN = 10;

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={cn(LABEL, T.muted)}>{k}</div>
      <div className={cn('mt-0.5 truncate text-[12.5px] font-medium', T.ink)}>{v}</div>
    </div>
  );
}

export function TreasuryOperationPanel({
  op,
  canManage,
  onClose,
}: {
  op: OperationRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const isPurchase = op.kind === 'purchase';
  const voided = !!op.voided_at;
  const voidOp = useVoidTreasuryOperation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');

  // La ventilation n'existe que pour un achat (un achat peut débiter plusieurs
  // comptes XAF ; une vente crédite au plus un compte CNY).
  const { data: splits } = usePurchaseSplits(isPurchase ? op.id : undefined);

  const reasonValid = reason.trim().length >= VOID_REASON_MIN;

  const confirmVoid = () => {
    if (!reasonValid || voidOp.isPending) return;
    voidOp.mutate(
      { source_table: isPurchase ? 'usdt_purchase' : 'usdt_sale', source_id: op.id, void_reason: reason.trim() },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setReason('');
          onClose();
        },
      },
    );
  };

  const counterparty = isPurchase ? op.supplier : op.buyer;

  return (
    <MCard className="flex min-h-0 flex-col overflow-hidden">
      {/* En-tête épinglé — actions toujours atteignables */}
      <header className={cn('flex items-center gap-3 border-b px-4 py-2.5', M.border)}>
        <span
          className={cn(
            'border-l-2 pl-2 text-[10px] font-bold uppercase tracking-[0.06em]',
            isPurchase ? cn(TONE.purchase, TONE.purchaseBar) : cn(TONE.sale, TONE.saleBar),
          )}
        >
          {isPurchase ? 'Achat USDT' : 'Vente USDT'}
        </span>
        <span className={cn('text-[11.5px]', T.muted)}>
          {op.occurred_at ? format(parseISO(op.occurred_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr }) : '—'}
        </span>
        {voided && <MTag tone="danger">Annulée</MTag>}
        <div className="ml-auto flex items-center gap-1.5">
          {canManage && !voided && (
            <MButton variant="secondary" onClick={() => setConfirmOpen(true)} className={TONE.negative}>
              <Ban className="h-3.5 w-3.5" /> Annuler
            </MButton>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail"
            className={cn('flex h-8 w-8 items-center justify-center rounded-[6px] border', M.border, T.body)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3.5">
        {/* Les deux montants échangés et le taux obtenu */}
        <div className={cn('rounded-[6px] border p-3.5', M.border, M.inset)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={cn(LABEL, T.muted)}>{isPurchase ? 'Payé' : 'Reçu'}</div>
              <div className={cn('mt-1 text-[19px] font-bold leading-none', NUM, T.ink)}>
                {isPurchase ? fmtAmount(Number(op.xaf_amount), 'XAF') : fmtAmount(Number(op.cny_amount), 'CNY')}
                <span className={cn('ml-1 text-[11px] font-semibold', T.faint)}>{isPurchase ? 'XAF' : 'CNY'}</span>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className={cn(LABEL, T.muted)}>{isPurchase ? 'Reçu' : 'Vendu'}</div>
              <div className={cn('mt-1 text-[19px] font-bold leading-none', NUM, T.ink)}>
                {fmtAmount(Number(op.usdt_amount), 'USDT')}
                <span className={cn('ml-1 text-[11px] font-semibold', T.faint)}>USDT</span>
              </div>
            </div>
          </div>
          <div className={cn('mt-3 flex items-center justify-between border-t pt-2.5', M.border)}>
            <span className={cn('text-[11.5px]', T.muted)}>Taux effectif</span>
            <span className={cn('text-[13px] font-bold', NUM, T.ink)}>
              {fmtNum(Number(op.implicit_rate), isPurchase ? RATE_DECIMALS.xafPerUsdt : RATE_DECIMALS.cnyPerUsdt)}
              <span className={cn('ml-1 text-[10.5px] font-medium', T.faint)}>{isPurchase ? 'XAF/USDT' : 'CNY/USDT'}</span>
            </span>
          </div>
        </div>

        {/* Ventilation multi-comptes */}
        {isPurchase && splits && splits.length > 0 && (
          <section className={cn('mt-3.5 border-t pt-3', M.border)}>
            <MSection right={<span className={cn('text-[11px]', NUM, T.muted)}>{splits.length} compte{splits.length > 1 ? 's' : ''}</span>}>
              Comptes débités
            </MSection>
            <div className="mt-2 space-y-1">
              {splits.map((s) => (
                <div key={s.id} className={cn('flex items-center justify-between rounded-[4px] px-2.5 py-1.5', M.inset)}>
                  <span className={cn('truncate text-[12.5px]', T.body)}>{s.account?.label ?? '—'}</span>
                  <span className={cn('shrink-0 text-[12.5px] font-semibold', NUM, T.ink)}>
                    {fmtAmount(Math.abs(Number(s.amount)), 'XAF')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={cn('mt-3.5 border-t pt-3', M.border)}>
          <MSection>Détail</MSection>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact k={isPurchase ? 'Fournisseur' : 'Acheteur'} v={counterparty?.display_name ?? '—'} />
            <Fact
              k={isPurchase ? 'Compte débité' : 'Compte crédité'}
              v={isPurchase ? (op.xaf_account?.label ?? (splits && splits.length > 1 ? 'Plusieurs comptes' : '—')) : (op.cny_account?.label ?? 'Aucun compte Bonzini')}
            />
            {!isPurchase && <Fact k="WAC à la vente" v={<span className={NUM}>{fmtNum(Number(op.wac_at_sale), RATE_DECIMALS.xafPerUsdt)} XAF/USDT</span>} />}
            {counterparty?.wechat_id && <Fact k="WeChat" v={counterparty.wechat_id} />}
            {counterparty?.phone && <Fact k="Téléphone" v={<span className={NUM}>{counterparty.phone}</span>} />}
            {op.external_ref && <Fact k="Référence externe" v={<span className={NUM}>{op.external_ref}</span>} />}
          </div>
          {op.notes && <div className={cn('mt-3 rounded-[4px] p-2.5 text-[12.5px]', M.inset, T.body)}>{op.notes}</div>}
        </section>

        {voided && (
          <section className={cn('mt-3.5 border-t pt-3', M.border)}>
            <MSection>Annulation</MSection>
            <div className={cn('mt-2 rounded-md p-2.5', TONE_BG.negative)}>
              <div className={cn('text-[11px] font-bold', NUM, TONE.negative)}>
                {op.voided_at ? format(parseISO(op.voided_at), "dd MMM yyyy 'à' HH:mm", { locale: fr }) : ''}
              </div>
              <div className={cn('mt-1 text-[12.5px]', TONE.negative)}>{op.void_reason ?? 'Sans motif'}</div>
            </div>
          </section>
        )}
      </div>

      <MDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmVoid}
        title="Annuler l'opération"
        footer={
          <>
            <MButton variant="danger" onClick={confirmVoid} disabled={!reasonValid} loading={voidOp.isPending} className="flex-1">
              Annuler l'opération
            </MButton>
            <MButton onClick={() => setConfirmOpen(false)} className="flex-1">Retour</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className={cn('text-[12.5px] leading-relaxed', T.body)}>
            Une contre-écriture est enregistrée : les soldes et le stock USDT reviennent à leur état d'avant. L'opération reste
            visible dans l'historique, marquée annulée — rien n'est effacé.
          </p>
          <MField
            label="Motif de l'annulation"
            hint={`Obligatoire, ${VOID_REASON_MIN} caractères minimum — il apparaît dans l'historique.`}
            error={reason.length > 0 && !reasonValid ? `Encore ${VOID_REASON_MIN - reason.trim().length} caractère(s).` : undefined}
          >
            <MInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. saisie en double du 12/08" />
          </MField>
        </div>
      </MDialog>
    </MCard>
  );
}
