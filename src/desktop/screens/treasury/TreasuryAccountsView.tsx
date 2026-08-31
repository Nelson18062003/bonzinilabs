/**
 * Trésorerie — vue « Comptes » (docs/admin-redesign/07 §3.4), habillage
 * « salle des marchés ».
 *
 * Fusionne deux écrans qui agissaient sur LE MÊME objet : « Comptes & soldes »
 * (ajuster) et « Inventaire des comptes » (réconcilier). Un compte a deux
 * gestes possibles, ils vivent sur sa ligne et restent VISIBLES : ce sont eux
 * la raison d'être de la vue.
 *
 * Deux garde-fous du métier conservés à l'identique :
 *   · Ajuster : motif obligatoire (il part au journal d'audit) ;
 *   · Inventorier : motif obligatoire DÈS QU'IL Y A UN ÉCART (10 car. min).
 * Seuls les comptes cash / Alipay / WeChat s'inventorient : les comptes
 * bancaires se réconcilient par relevé.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Image as ImageIcon, Minus, Plus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAdjustAccount,
  useRecordInventorySnapshot,
  useTreasuryAccountBalances,
  type TreasuryAccountBalance,
} from '@/hooks/useTreasury';
import {
  M,
  T,
  NUM,
  LABEL,
  TONE,
  MCard,
  MCardHeader,
  MButton,
  MIconButton,
  MTh,
  MTd,
  MDialog,
  MField,
  MInput,
  MEmpty,
  MLoading,
} from './marketKit';
import { fmtAmount, fmtNum, accountKindLabel, CURRENCY_DECIMALS, type TreasuryCurrency } from './treasuryFormat';
import { TreasuryMoneyInput } from './TreasuryMoneyInput';

const GROUPS: ReadonlyArray<{ currency: TreasuryCurrency; label: string }> = [
  { currency: 'XAF', label: 'Comptes XAF' },
  { currency: 'USDT', label: 'Pool USDT' },
  { currency: 'CNY', label: 'Comptes CNY' },
];

/** Seuls ces comptes se comptent à la main ; une banque se lit sur son relevé. */
const INVENTORY_KINDS = ['cash', 'alipay', 'wechat'];
const REASON_MIN = 10;

type Dialog = { mode: 'adjust' | 'inventory'; account: TreasuryAccountBalance } | null;

export function TreasuryAccountsView({ canManage }: { canManage: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = useTreasuryAccountBalances();
  const adjust = useAdjustAccount();
  const inventory = useRecordInventorySnapshot();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');

  const open = (mode: 'adjust' | 'inventory', account: TreasuryAccountBalance) => {
    setDialog({ mode, account });
    setAmount(null);
    setDirection('credit');
    setReason('');
  };
  const close = () => setDialog(null);

  const currency = (dialog?.account.currency ?? 'XAF') as TreasuryCurrency;
  const decimals = CURRENCY_DECIMALS[currency];
  const theoretical = Number(dialog?.account.balance ?? 0);
  const variance = dialog?.mode === 'inventory' && amount !== null ? amount - theoretical : 0;

  const reasonValid = reason.trim().length >= REASON_MIN;
  const adjustValid = amount !== null && amount > 0 && reasonValid;
  const inventoryValid = amount !== null && (variance === 0 || reasonValid);

  const submitAdjust = () => {
    if (!dialog || !adjustValid || adjust.isPending || amount === null) return;
    adjust.mutate(
      {
        account_id: dialog.account.id!,
        // Le signe porte la direction : le RPC journalise credit/debit d'après lui.
        delta_amount: direction === 'credit' ? amount : -amount,
        reason: reason.trim(),
      },
      { onSuccess: close },
    );
  };

  const submitInventory = () => {
    if (!dialog || !inventoryValid || inventory.isPending || amount === null) return;
    inventory.mutate(
      {
        account_id: dialog.account.id!,
        actual_balance: amount,
        variance_reason: variance !== 0 ? reason.trim() : undefined,
      },
      { onSuccess: close },
    );
  };

  if (isLoading) return <MLoading />;
  const accounts = data ?? [];
  if (accounts.length === 0) return <MEmpty icon={Wallet}>Aucun compte de trésorerie.</MEmpty>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <MButton onClick={() => navigate('/m/more/treasury/balance-dashboard')}>
          <ImageIcon className="h-3.5 w-3.5" /> Visuel des soldes (PNG / PDF)
        </MButton>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
        {GROUPS.map((g) => {
          const rows = accounts.filter((a) => a.currency === g.currency);
          if (rows.length === 0) return null;
          const total = rows.reduce((s, a) => s + Number(a.balance ?? 0), 0);
          return (
            <MCard key={g.currency} className="overflow-hidden">
              <MCardHeader title={g.label} meta={`${fmtAmount(total, g.currency)} ${g.currency}`} />
              <table className="w-full text-left">
                <thead className={cn('border-b', M.inset, M.border)}>
                  <tr>
                    <MTh>Compte</MTh>
                    <MTh align="right">Solde</MTh>
                    <MTh className="w-[80px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const canInventory = !!a.kind && INVENTORY_KINDS.includes(a.kind);
                    return (
                      <tr key={a.id}>
                        <MTd>
                          <div className={cn('truncate text-[12.5px] font-semibold', T.ink)}>{a.label}</div>
                          {a.kind && <div className={cn('text-[10.5px]', T.faint)}>{accountKindLabel(a.kind)}</div>}
                        </MTd>
                        <MTd align="right" className={cn('text-[12.5px] font-bold', NUM, T.ink)}>
                          {fmtAmount(Number(a.balance ?? 0), g.currency)}
                        </MTd>
                        <MTd align="right">
                          {canManage ? (
                            <span className="inline-flex items-center gap-1">
                              <MIconButton icon={Wallet} onClick={() => open('adjust', a)} label={`Ajuster ${a.label}`} />
                              {canInventory && (
                                <MIconButton icon={ClipboardCheck} onClick={() => open('inventory', a)} label={`Inventorier ${a.label}`} />
                              )}
                            </span>
                          ) : (
                            <span aria-hidden />
                          )}
                        </MTd>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </MCard>
          );
        })}
      </div>

      {/* ── Ajuster ── */}
      <MDialog
        open={dialog?.mode === 'adjust'}
        onClose={close}
        onConfirm={submitAdjust}
        title={`Ajuster — ${dialog?.account.label ?? ''}`}
        footer={
          <>
            <MButton variant="primary" onClick={submitAdjust} disabled={!adjustValid} loading={adjust.isPending} className="flex-1">
              {direction === 'credit' ? 'Approvisionner' : 'Débiter'}
            </MButton>
            <MButton onClick={close} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className={cn('flex items-center justify-between rounded-[4px] px-2.5 py-2', M.inset)}>
            <span className={cn('text-[11.5px]', T.muted)}>Solde actuel</span>
            <span className={cn('text-[12.5px] font-bold', NUM, T.ink)}>
              {fmtAmount(theoretical, currency)} {currency}
            </span>
          </div>

          <div className="flex gap-2">
            {(['credit', 'debit'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn(
                  'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] border text-[12.5px] font-semibold transition-colors',
                  M.border,
                  direction === d ? (d === 'credit' ? cn('bg-[#F0FDF4] dark:bg-[#14301F]', TONE.positive) : cn('bg-[#FEF2F2] dark:bg-[#3F1D1D]', TONE.negative)) : cn('bg-white dark:bg-[#18181B]', T.body),
                )}
              >
                {d === 'credit' ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {d === 'credit' ? 'Approvisionner' : 'Débiter'}
              </button>
            ))}
          </div>

          <MField label="Montant" htmlFor="adjust-amount">
            <TreasuryMoneyInput id="adjust-amount" currency={currency} value={amount} onValueChange={setAmount} decimals={decimals} autoFocus />
          </MField>

          {amount !== null && amount > 0 && (
            <div className={cn('flex items-center justify-between rounded-[4px] px-2.5 py-2', M.inset)}>
              <span className={cn('text-[11.5px]', T.muted)}>Solde après</span>
              <span className={cn('text-[12.5px] font-bold', NUM, T.ink)}>
                {fmtAmount(direction === 'credit' ? theoretical + amount : theoretical - amount, currency)} {currency}
              </span>
            </div>
          )}

          <MField
            label="Motif"
            hint={`Obligatoire, ${REASON_MIN} caractères minimum — enregistré au journal d'audit.`}
            error={reason.length > 0 && !reasonValid ? `Encore ${REASON_MIN - reason.trim().length} caractère(s).` : undefined}
          >
            <MInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. apport de caisse du 12/08" />
          </MField>
        </div>
      </MDialog>

      {/* ── Inventorier ── */}
      <MDialog
        open={dialog?.mode === 'inventory'}
        onClose={close}
        onConfirm={submitInventory}
        title={`Inventaire — ${dialog?.account.label ?? ''}`}
        footer={
          <>
            <MButton variant="primary" onClick={submitInventory} disabled={!inventoryValid} loading={inventory.isPending} className="flex-1">
              Enregistrer l'inventaire
            </MButton>
            <MButton onClick={close} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className={cn('text-[12.5px] leading-relaxed', T.body)}>
            Comptez ce qu'il y a réellement sur le compte, puis saisissez-le. L'écart avec le solde théorique est calculé
            automatiquement.
          </p>

          <MField label="Solde réel constaté" htmlFor="inv-amount">
            <TreasuryMoneyInput id="inv-amount" currency={currency} value={amount} onValueChange={setAmount} decimals={decimals} autoFocus />
          </MField>

          <div className="grid grid-cols-2 gap-2">
            <div className={cn('rounded-[4px] px-2.5 py-2', M.inset)}>
              <div className={cn(LABEL, T.muted)}>Théorique</div>
              <div className={cn('mt-0.5 text-[13px] font-bold', NUM, T.ink)}>{fmtAmount(theoretical, currency)}</div>
            </div>
            <div
              className={cn(
                'rounded-[4px] px-2.5 py-2',
                amount === null ? M.inset : variance === 0 ? 'bg-[#F0FDF4] dark:bg-[#14301F]' : 'bg-[#FEF2F2] dark:bg-[#3F1D1D]',
              )}
            >
              <div className={cn(LABEL, amount === null ? T.muted : variance === 0 ? TONE.positive : TONE.negative)}>Écart</div>
              <div className={cn('mt-0.5 text-[13px] font-bold', NUM, amount === null ? T.ink : variance === 0 ? TONE.positive : TONE.negative)}>
                {amount === null ? '—' : `${variance > 0 ? '+' : ''}${fmtNum(variance, decimals)}`}
              </div>
            </div>
          </div>

          {variance !== 0 && amount !== null && (
            <MField
              label="Motif de l'écart"
              hint={`Obligatoire dès qu'il y a un écart, ${REASON_MIN} caractères minimum.`}
              error={reason.length > 0 && !reasonValid ? `Encore ${REASON_MIN - reason.trim().length} caractère(s).` : undefined}
            >
              <MInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. billet manquant, erreur de rendu" />
            </MField>
          )}
        </div>
      </MDialog>
    </div>
  );
}
