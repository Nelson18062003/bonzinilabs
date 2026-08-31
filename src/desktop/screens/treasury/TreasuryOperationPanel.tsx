/**
 * Trésorerie — panneau de détail d'une opération (archétype B).
 *
 * Remplace la navigation vers un écran téléphone : la liste reste vivante à
 * gauche. Deux choses n'étaient visibles nulle part sur desktop et le sont
 * ici : la VENTILATION par compte d'un achat multi-comptes
 * (`usePurchaseSplits`) et le motif d'annulation d'une opération annulée.
 *
 * « Annuler l'opération » vit dans l'en-tête épinglé, avec confirmation
 * centrée et motif obligatoire — l'annulation écrit une contre-écriture, elle
 * n'efface jamais la ligne.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Ban, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  KV,
  SecLabel,
  StatusPill,
  CenterDialog,
  PrimaryPill,
  SoftPill,
  FormField,
  TextInput,
} from '@/desktop/designKit';
import { usePurchaseSplits, useVoidTreasuryOperation, type OperationRow } from '@/hooks/useTreasury';
import { fmtAmount, fmtNum, RATE_DECIMALS } from './treasuryFormat';

const VOID_REASON_MIN = 10;

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
      {
        source_table: isPurchase ? 'usdt_purchase' : 'usdt_sale',
        source_id: op.id,
        void_reason: reason.trim(),
      },
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
  const Icon = isPurchase ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <aside className={cn('flex min-h-0 flex-col overflow-hidden rounded-[14px]', SURFACE.card, SURFACE.shadow)}>
      {/* En-tête épinglé — actions toujours atteignables */}
      <header className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isPurchase
              ? 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]'
              : 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[14px] font-bold', TEXT.strong)}>
            {isPurchase ? 'Achat USDT' : 'Vente USDT'}
          </div>
          <div className={cn('truncate text-[12px]', TEXT.muted)}>
            {op.occurred_at ? format(parseISO(op.occurred_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr }) : '—'}
          </div>
        </div>
        {voided && <StatusPill tone="danger" label="Annulée" />}
        {canManage && !voided && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FBE7E7] px-3 text-[12px] font-bold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]"
          >
            <Ban className="h-3.5 w-3.5" /> Annuler
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le détail"
          className={cn('flex h-8 w-8 items-center justify-center rounded-full', SURFACE.holder)}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {/* Zone « verdict » : les deux montants échangés et le taux obtenu */}
        <div className={cn('rounded-[10px] p-4', SURFACE.inset)}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                {isPurchase ? 'Payé' : 'Reçu'}
              </div>
              <div className={cn('mt-0.5 text-[20px] font-extrabold tabular-nums', TEXT.strong)}>
                {isPurchase
                  ? `${fmtAmount(Number(op.xaf_amount), 'XAF')} XAF`
                  : `${fmtAmount(Number(op.cny_amount), 'CNY')} CNY`}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                {isPurchase ? 'Reçu' : 'Vendu'}
              </div>
              <div className={cn('mt-0.5 text-[20px] font-extrabold tabular-nums', TEXT.strong)}>
                {fmtAmount(Number(op.usdt_amount), 'USDT')} USDT
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className={cn('text-[12px]', TEXT.muted)}>Taux effectif de l'opération</span>
              <span className={cn('text-[14px] font-bold tabular-nums', TEXT.strong)}>
                {fmtNum(Number(op.implicit_rate), isPurchase ? RATE_DECIMALS.xafPerUsdt : RATE_DECIMALS.cnyPerUsdt)}{' '}
                <span className={cn('text-[11px] font-semibold', TEXT.muted)}>
                  {isPurchase ? 'XAF/USDT' : 'CNY/USDT'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Ventilation multi-comptes — invisible sur desktop jusqu'ici */}
        {isPurchase && splits && splits.length > 0 && (
          <section className="mt-4 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <SecLabel right={<span className={cn('text-[11px] tabular-nums', TEXT.muted)}>{splits.length} compte{splits.length > 1 ? 's' : ''}</span>}>
              Comptes débités
            </SecLabel>
            <div className="mt-2 space-y-1.5">
              {splits.map((s) => (
                <div key={s.id} className={cn('flex items-center justify-between rounded-[10px] px-3 py-2', SURFACE.inset)}>
                  <span className={cn('truncate text-[13px] font-medium', TEXT.body)}>{s.account?.label ?? '—'}</span>
                  <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', TEXT.strong)}>
                    {fmtAmount(Math.abs(Number(s.amount)), 'XAF')} XAF
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Faits */}
        <section className="mt-4 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
          <SecLabel>Détail</SecLabel>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            <KV k={isPurchase ? 'Fournisseur' : 'Acheteur'} v={counterparty?.display_name ?? '—'} />
            <KV
              k={isPurchase ? 'Compte débité' : 'Compte crédité'}
              v={isPurchase ? (op.xaf_account?.label ?? (splits && splits.length > 1 ? 'Plusieurs comptes' : '—')) : (op.cny_account?.label ?? 'Aucun compte Bonzini')}
            />
            {!isPurchase && <KV k="WAC à la vente" v={`${fmtNum(Number(op.wac_at_sale), RATE_DECIMALS.xafPerUsdt)} XAF/USDT`} />}
            {counterparty?.wechat_id && <KV k="WeChat" v={counterparty.wechat_id} />}
            {counterparty?.phone && <KV k="Téléphone" v={counterparty.phone} />}
            {op.external_ref && <KV k="Référence externe" v={op.external_ref} />}
          </div>
          {op.notes && (
            <div className={cn('mt-3 rounded-[10px] p-3 text-[13px]', SURFACE.inset, TEXT.body)}>{op.notes}</div>
          )}
        </section>

        {/* Motif d'annulation — l'information la plus utile sur une ligne annulée */}
        {voided && (
          <section className="mt-4 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            <SecLabel>Annulation</SecLabel>
            <div className="mt-2 rounded-[10px] bg-[#FBE7E7] p-3 dark:bg-[#3A2526]">
              <div className="text-[12px] font-bold text-[#C0504D] dark:text-[#E79A9A]">
                {op.voided_at ? format(parseISO(op.voided_at), "dd MMM yyyy 'à' HH:mm", { locale: fr }) : ''}
              </div>
              <div className="mt-1 text-[13px] text-[#C0504D] dark:text-[#E79A9A]">{op.void_reason ?? 'Sans motif'}</div>
            </div>
          </section>
        )}
      </div>

      <CenterDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmVoid}
        title="Annuler l'opération"
        width={460}
        footer={
          <>
            <PrimaryPill danger onClick={confirmVoid} disabled={!reasonValid} loading={voidOp.isPending} className="flex-1">
              Annuler l'opération
            </PrimaryPill>
            <SoftPill onClick={() => setConfirmOpen(false)} className="flex-1">
              Retour
            </SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <p className={cn('text-[13px]', TEXT.body)}>
            Une contre-écriture est enregistrée : les soldes et le stock USDT reviennent à leur état d'avant.
            L'opération reste visible dans l'historique, marquée annulée — rien n'est effacé.
          </p>
          <FormField
            label="Motif de l'annulation"
            hint={`Obligatoire, ${VOID_REASON_MIN} caractères minimum — il apparaît dans l'historique.`}
            error={reason.length > 0 && !reasonValid ? `Encore ${VOID_REASON_MIN - reason.trim().length} caractère(s).` : undefined}
          >
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. saisie en double du 12/08" />
          </FormField>
        </div>
      </CenterDialog>
    </aside>
  );
}
