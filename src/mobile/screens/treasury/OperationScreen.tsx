/**
 * Une opération — son reçu, prêt à partir (maquettes 05-tresorerie-taux/06
 * et 07, 07-tresorerie/14 et 15).
 *
 * Le reçu au centre (copier l'image, télécharger), puis les comptes touchés
 * avec leur solde après — chacun ouvre sa fiche. Le « … » mène à la
 * contrepartie, au compte, et (super admin seul) à l'annulation : une
 * feuille montre la contre-passation, avant → après, et exige un motif de
 * 10 caractères au moins (`void_treasury_operation`). Une opération annulée
 * reste visible : bandeau rouge, montant barré, écritures de contre-passation.
 */
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Undo2, User, Wallet } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties, useOperationEntries, usePurchase, useSale, useTreasuryAccountBalances, useUsdtStock, useVoidTreasuryOperation,
  type LedgerEntry, type OperationRow,
} from '@/hooks/useTreasury';
import { receiptFromOperation } from '@/desktop/screens/treasury/receiptData';
import { sourceTableOf } from '@/desktop/screens/treasury/treasuryLabels';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import type { OperationKind } from '@/desktop/screens/treasury/treasuryNav';
import {
  ActionSheet, ConfirmSheet, Dock, EmptyLine, KVBox, MoreButton, ScreenTop, Tag, useSheet, type KV,
} from '@/mobile/designKit';
import { CapsLabel, ReasonField, ReceiptButtons, ReceiptCard, TouchedRow, TreasuryGate } from './parts';
import { REASON_MIN, fmtCur, hm, tp, useReceiptActions, useStaffName, whenFull, withCur } from './treasuryMobile';

export function OperationScreen({ kind: forced }: { kind?: OperationKind }) {
  return (
    <TreasuryGate>
      <OperationBody forced={forced} />
    </TreasuryGate>
  );
}

/** Les anciennes adresses mobiles (`/purchases/:id`, `/sales/:id`). */
export function PurchaseScreen() {
  return <OperationScreen kind="purchase" />;
}
export function SaleScreen() {
  return <OperationScreen kind="sale" />;
}

function OperationBody({ forced }: { forced?: OperationKind }) {
  const params = useParams<{ kind?: string; operationId?: string }>();
  const kind: OperationKind = forced ?? (params.kind === 'sale' ? 'sale' : 'purchase');
  const id = params.operationId;
  const purchase = usePurchase(kind === 'purchase' ? id : undefined);
  const sale = useSale(kind === 'sale' ? id : undefined);
  const q = kind === 'purchase' ? purchase : sale;
  // La contrepartie vient de la jointure ; à défaut, de la liste (même source).
  const cps = useCounterparties(undefined, true);
  const raw = q.data ? ({ ...q.data, kind } as OperationRow) : null;
  const cpOf = (id: string | null | undefined) => (cps.data ?? []).find((c) => c.id === id) ?? null;
  const op: OperationRow | null = !raw
    ? null
    : raw.kind === 'purchase'
      ? { ...raw, supplier: raw.supplier ?? cpOf(raw.supplier_id) }
      : { ...raw, buyer: raw.buyer ?? cpOf(raw.buyer_id) };

  if (!op) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Opération" backTo={tp.operations()} />
        {q.isLoading ? (
          <EmptyLine>Chargement…</EmptyLine>
        ) : q.isError ? (
          <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>L’opération n’a pas pu être chargée.</EmptyLine>
        ) : (
          <EmptyLine>Opération introuvable.</EmptyLine>
        )}
      </div>
    );
  }
  return <Loaded op={op} />;
}

function Loaded({ op }: { op: OperationRow }) {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const canVoid = currentUser?.role === 'super_admin';
  const entries = useOperationEntries(op.id);
  const voidedBy = useStaffName(op.voided_by);
  const more = useSheet();
  const voidSheet = useSheet();
  const receiptRef = useRef<HTMLDivElement>(null);
  const data = receiptFromOperation(op, entries.data);
  const actions = useReceiptActions(receiptRef, data);
  const purchase = op.kind === 'purchase';
  const voided = !!op.voided_at;
  const cp = purchase ? op.supplier : op.buyer;
  const cpId = cp?.id ?? (purchase ? op.supplier_id : op.buyer_id);
  const all = entries.data ?? [];
  const touched = all.filter((e) => (voided ? e.entry_kind === 'void' : e.entry_kind !== 'void'));
  const firstMoney = all.find((e) => e.entry_kind !== 'void' && e.currency !== 'USDT' && e.account);

  const internal: KV[] = [];
  if (op.notes) internal.push({ label: 'Note', value: op.notes });
  if (!purchase && op.kind === 'sale') {
    internal.push({ label: 'Coût moyen à la vente', value: `${fmtNum(Number(op.wac_at_sale), 2)} XAF/USDT` });
    internal.push({ label: 'Coût de sortie', value: `${fmtNum(Number(op.usdt_amount) * Number(op.wac_at_sale), 0)} XAF` });
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Opération" right={<MoreButton onClick={more.show} />} />
      <div className="space-y-5 px-5 pt-4">
        {voided && (
          <div className="flex gap-3 rounded-lg bg-[#FDD3D0] px-4 py-3.5 text-[#900B09]">
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.25} />
            <div className="min-w-0 text-[16px]">
              <div className="font-semibold">
                Annulée · {whenFull(op.voided_at)}
                {voidedBy.data ? ` · ${voidedBy.data}` : ''}
              </div>
              {op.void_reason && <div className="mt-0.5">{op.void_reason}</div>}
            </div>
          </div>
        )}

        <ReceiptCard ref={receiptRef} data={data} />

        <div>
          <CapsLabel>{voided ? 'Contre-passation' : 'Comptes touchés'}</CapsLabel>
          {entries.isError ? (
            <EmptyLine action={{ label: 'Réessayer', onClick: () => void entries.refetch() }}>Les écritures n’ont pas pu être chargées.</EmptyLine>
          ) : (
            <div className="mt-1">
              {touched.map((e) => <TouchedRow key={e.id} e={e} />)}
            </div>
          )}
        </div>

        {internal.length > 0 && (
          <div>
            <CapsLabel className="mb-2">Détails internes</CapsLabel>
            <KVBox rows={internal} />
          </div>
        )}
      </div>

      <Dock>
        <ReceiptButtons actions={actions} />
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          {
            label: `Voir ${cp?.display_name ?? (purchase ? 'le fournisseur' : 'l’acheteur')}`,
            hint: `${purchase ? 'Fournisseur USDT' : 'Acheteur CNY'}${cp?.short_id ? ` · ${cp.short_id}` : ''}`,
            icon: User,
            onClick: () => cpId && navigate(tp.counterparty(cpId)),
            hidden: !cpId,
          },
          {
            label: `Voir le compte ${firstMoney?.account?.label ?? ''}`.trim(),
            icon: Wallet,
            onClick: () => firstMoney?.account && navigate(tp.account(firstMoney.account.id)),
            hidden: !firstMoney,
          },
          {
            label: 'Annuler l’opération',
            hint: 'Contre-passée, reste visible',
            icon: Undo2,
            danger: true,
            onClick: voidSheet.show,
            hidden: !canVoid || voided,
          },
        ]}
      />
      {canVoid && !voided && <VoidSheet open={voidSheet.open} onClose={voidSheet.hide} op={op} entries={all} />}
    </div>
  );
}

/** La feuille d'annulation : contre-passation avant → après, motif ≥ 10, bouton rouge. */
function VoidSheet({ open, onClose, op, entries }: { open: boolean; onClose: () => void; op: OperationRow; entries: LedgerEntry[] }) {
  const voidOp = useVoidTreasuryOperation();
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const [reason, setReason] = useState('');
  const purchase = op.kind === 'purchase';
  const usdt = Number(op.usdt_amount);
  const cpName = purchase ? op.supplier?.display_name : op.buyer?.display_name;
  const rows: KV[] = entries
    .filter((e) => e.entry_kind !== 'void' && e.currency !== 'USDT' && e.account_id)
    .map((e): KV => {
      const now = Number((balances.data ?? []).find((b) => b.id === e.account_id)?.balance ?? 0);
      const after = now - Number(e.amount);
      return { label: e.account?.label ?? '—', before: fmtCur(now, e.currency), value: fmtCur(after, e.currency), tone: after < 0 ? 'danger' : undefined };
    });
  if (stock.data !== undefined) {
    const after = purchase ? stock.data - usdt : stock.data + usdt;
    rows.push({ label: 'Stock USDT', before: fmtNum(stock.data, 2), value: fmtNum(after, 2), tone: after < 0 ? 'danger' : undefined });
  }
  const ok = reason.trim().length >= REASON_MIN;
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-start justify-between gap-3">
          <span>{purchase ? 'Annuler cet achat ?' : 'Annuler cette vente ?'}</span>
          <Tag tone="neutral" className="mt-1">Super admin</Tag>
        </span>
      }
      subtitle={`${cpName ?? '—'} · ${withCur(usdt, 'USDT')} · ${hm(op.occurred_at)}`}
      rows={rows}
      danger
      disabled={!ok}
      loading={voidOp.isPending}
      confirmLabel="Annuler l’opération"
      cancelLabel="Retour"
      onConfirm={() => {
        if (!ok || voidOp.isPending) return;
        voidOp.mutate({ source_table: sourceTableOf(op.kind), source_id: op.id, void_reason: reason.trim() }, { onSuccess: onClose });
      }}
    >
      <ReasonField id="void-reason" value={reason} onChange={setReason} placeholder="Ex. saisie en double de TR-AC-…" />
    </ConfirmSheet>
  );
}
