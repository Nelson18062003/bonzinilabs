/**
 * Trésorerie — vue « Comptes » (docs/admin-redesign/07 §3.4).
 *
 * Fusionne deux écrans qui agissaient sur LE MÊME objet : « Comptes & soldes »
 * (ajuster) et « Inventaire des comptes » (réconcilier). Un compte a deux
 * gestes possibles, ils vivent maintenant sur sa ligne.
 *
 * Une table par devise, avec le total du groupe dans l'en-tête — le total est
 * ce qu'on vient vérifier en premier.
 *
 * Deux garde-fous du métier sont conservés à l'identique :
 *   · Ajuster : le motif est obligatoire (il part au journal d'audit) ;
 *   · Inventorier : le motif devient obligatoire DÈS QU'IL Y A UN ÉCART entre
 *     le solde réel constaté et le solde théorique (10 caractères minimum).
 * Seuls les comptes cash / Alipay / WeChat s'inventorient : les comptes
 * bancaires se réconcilient par relevé.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ClipboardCheck, Image as ImageIcon, Plus, Minus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Th,
  Td,
  Holder,
  ScreenLoader,
  CenterDialog,
  PrimaryPill,
  SoftPill,
  SOFT_PILL,
  FormField,
  TextInput,
} from '@/desktop/designKit';
import {
  useAdjustAccount,
  useRecordInventorySnapshot,
  useTreasuryAccountBalances,
  type TreasuryAccountBalance,
} from '@/hooks/useTreasury';
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

type Dialog =
  | { mode: 'adjust'; account: TreasuryAccountBalance }
  | { mode: 'inventory'; account: TreasuryAccountBalance }
  | null;

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
    setDialog({ mode, account } as Dialog);
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

  if (isLoading) return <ScreenLoader />;

  const accounts = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/m/more/treasury/balance-dashboard')}
          className={cn('inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-semibold', SOFT_PILL)}
        >
          <ImageIcon className="h-4 w-4" /> Visuel des soldes (PNG / PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        {GROUPS.map((g) => {
          const rows = accounts.filter((a) => a.currency === g.currency);
          if (rows.length === 0) return null;
          const total = rows.reduce((s, a) => s + Number(a.balance ?? 0), 0);
          return (
            <Card key={g.currency} className="overflow-hidden p-0">
              <CardHeader title={g.label} meta={`${fmtAmount(total, g.currency)} ${g.currency}`} />
              <table className="w-full text-left">
                <thead className={SURFACE.inset}>
                  <tr>
                    <Th first>Compte</Th>
                    <Th align="right">Solde</Th>
                    <Th last className="w-[92px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const canInventory = !!a.kind && INVENTORY_KINDS.includes(a.kind);
                    return (
                      <tr key={a.id} className="group">
                        <Td first>
                          <div className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{a.label}</div>
                          {a.kind && <div className={cn('text-[11px]', TEXT.muted)}>{accountKindLabel(a.kind)}</div>}
                        </Td>
                        <Td align="right" className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>
                          {fmtAmount(Number(a.balance ?? 0), g.currency)}
                        </Td>
                        <Td last align="right">
                          {/* Ces deux gestes SONT la raison d'être de la vue :
                              ils restent visibles (atténués) au lieu d'être
                              cachés au survol comme une action secondaire. */}
                          {canManage ? (
                            <span className="inline-flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => open('adjust', a)}
                                title="Ajuster le solde"
                                aria-label={`Ajuster ${a.label}`}
                                className={cn('flex h-7 w-7 items-center justify-center rounded-full', SURFACE.holder)}
                              >
                                <Wallet className="h-3.5 w-3.5" />
                              </button>
                              {canInventory && (
                                <button
                                  type="button"
                                  onClick={() => open('inventory', a)}
                                  title="Inventorier"
                                  aria-label={`Inventorier ${a.label}`}
                                  className={cn('flex h-7 w-7 items-center justify-center rounded-full', SURFACE.holder)}
                                >
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </span>
                          ) : (
                            <span aria-hidden />
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Holder icon={Wallet} size="lg" />
          <p className={cn('mt-3 text-[13px]', TEXT.muted)}>Aucun compte de trésorerie.</p>
        </div>
      )}

      {/* ── Ajuster un solde ── */}
      <CenterDialog
        open={dialog?.mode === 'adjust'}
        onClose={close}
        onConfirm={submitAdjust}
        title={`Ajuster — ${dialog?.account.label ?? ''}`}
        width={460}
        footer={
          <>
            <PrimaryPill onClick={submitAdjust} disabled={!adjustValid} loading={adjust.isPending} className="flex-1">
              {direction === 'credit' ? 'Approvisionner' : 'Débiter'}
            </PrimaryPill>
            <SoftPill onClick={close} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <div className={cn('flex items-center justify-between rounded-[10px] px-3 py-2.5', SURFACE.inset)}>
            <span className={cn('text-[12px]', TEXT.muted)}>Solde actuel</span>
            <span className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>
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
                  'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-colors',
                  direction === d
                    ? d === 'credit'
                      ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
                      : 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]'
                    : SOFT_PILL,
                )}
              >
                {d === 'credit' ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {d === 'credit' ? 'Approvisionner' : 'Débiter'}
              </button>
            ))}
          </div>

          <FormField label="Montant" htmlFor="adjust-amount">
            <TreasuryMoneyInput id="adjust-amount" currency={currency} value={amount} onValueChange={setAmount} decimals={decimals} autoFocus />
          </FormField>

          {amount !== null && amount > 0 && (
            <div className={cn('flex items-center justify-between rounded-[10px] px-3 py-2.5', SURFACE.inset)}>
              <span className={cn('text-[12px]', TEXT.muted)}>Solde après</span>
              <span className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>
                {fmtAmount(direction === 'credit' ? theoretical + amount : theoretical - amount, currency)} {currency}
              </span>
            </div>
          )}

          <FormField
            label="Motif"
            hint={`Obligatoire, ${REASON_MIN} caractères minimum — enregistré au journal d'audit.`}
            error={reason.length > 0 && !reasonValid ? `Encore ${REASON_MIN - reason.trim().length} caractère(s).` : undefined}
          >
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. apport de caisse du 12/08" />
          </FormField>
        </div>
      </CenterDialog>

      {/* ── Inventorier un compte ── */}
      <CenterDialog
        open={dialog?.mode === 'inventory'}
        onClose={close}
        onConfirm={submitInventory}
        title={`Inventaire — ${dialog?.account.label ?? ''}`}
        width={460}
        footer={
          <>
            <PrimaryPill onClick={submitInventory} disabled={!inventoryValid} loading={inventory.isPending} className="flex-1">
              Enregistrer l'inventaire
            </PrimaryPill>
            <SoftPill onClick={close} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <p className={cn('text-[13px]', TEXT.body)}>
            Comptez ce qu'il y a réellement sur le compte, puis saisissez-le. L'écart avec le solde théorique est calculé
            automatiquement.
          </p>

          <FormField label="Solde réel constaté" htmlFor="inv-amount">
            <TreasuryMoneyInput id="inv-amount" currency={currency} value={amount} onValueChange={setAmount} decimals={decimals} autoFocus />
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <div className={cn('rounded-[10px] px-3 py-2.5', SURFACE.inset)}>
              <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Théorique</div>
              <div className={cn('mt-0.5 text-[14px] font-bold tabular-nums', TEXT.strong)}>{fmtAmount(theoretical, currency)}</div>
            </div>
            <div
              className={cn(
                'rounded-[10px] px-3 py-2.5',
                amount === null
                  ? SURFACE.inset
                  : variance === 0
                    ? 'bg-[#DEEFE5] dark:bg-[#1E3A2C]'
                    : 'bg-[#FBE7E7] dark:bg-[#3A2526]',
              )}
            >
              <div
                className={cn(
                  'text-[11px] font-bold uppercase tracking-wider',
                  amount === null ? TEXT.muted : variance === 0 ? 'text-[#2E7D52] dark:text-[#7FCBA0]' : 'text-[#C0504D] dark:text-[#E79A9A]',
                )}
              >
                Écart
              </div>
              <div
                className={cn(
                  'mt-0.5 text-[14px] font-bold tabular-nums',
                  amount === null ? TEXT.strong : variance === 0 ? 'text-[#2E7D52] dark:text-[#7FCBA0]' : 'text-[#C0504D] dark:text-[#E79A9A]',
                )}
              >
                {amount === null ? '—' : `${variance > 0 ? '+' : ''}${fmtNum(variance, decimals)}`}
              </div>
            </div>
          </div>

          {variance !== 0 && amount !== null && (
            <FormField
              label="Motif de l'écart"
              hint={`Obligatoire dès qu'il y a un écart, ${REASON_MIN} caractères minimum.`}
              error={reason.length > 0 && !reasonValid ? `Encore ${REASON_MIN - reason.trim().length} caractère(s).` : undefined}
            >
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. billet manquant, erreur de rendu" />
            </FormField>
          )}
        </div>
      </CenterDialog>
    </div>
  );
}
