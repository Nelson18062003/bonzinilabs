/**
 * Trésorerie — comptes & soldes.
 *
 * Rebuilt onto the console's dimensional contract (`@/desktop/ui/tokens`). What
 * changed beyond the measurements:
 *
 *   · the mobile `AccountRow` / `AdjustForm` are no longer imported. They are a
 *     52px pill language on a 22px-radius card, and stretching them across a
 *     1440px column was the reason this screen read as a phone screenshot. The
 *     adjustment *logic* is not reimplemented — it still goes through
 *     `useAdjustAccount` (the SECURITY DEFINER RPC) and the amount is still
 *     parsed by the shared `parseAmount`, so nothing financial moved.
 *   · each currency total has exactly one home: the panel head. It used to be
 *     printed above the card in a second type size.
 *   · the direction toggle is a `Segment` — one track, two mutually exclusive
 *     options — instead of two 44px tinted buttons. The semantic colour moved to
 *     the submit button (`primary` to credit, `danger` to debit), which is the
 *     control that actually moves money.
 *
 * Guarded on `canViewTreasury`; adjustments additionally need
 * `canManageTreasury`. Admin context → `supabaseAdmin` (inside the hooks).
 */
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { parseAmount } from '@/components/form/AmountField';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdjustAccount, useTreasuryAccountBalances, type TreasuryAccountBalance } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS } from '@/desktop/ui/tokens';
import {
  Button,
  EmptyState,
  Field,
  Figure,
  Input,
  Panel,
  PanelHead,
  Segment,
  Skeleton,
} from '@/desktop/ui/primitives';
import { MenuButton } from '@/desktop/ui/Popover';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

type Currency = 'XAF' | 'USDT' | 'CNY';

const CURRENCY_GROUPS: { currency: Currency; label: string }[] = [
  { currency: 'XAF', label: 'Comptes XAF' },
  { currency: 'USDT', label: 'Pool USDT' },
  { currency: 'CNY', label: 'Comptes CNY' },
];

const KIND_LABEL: Record<string, string> = {
  bank: 'Banque',
  mobile_money: 'Mobile money',
  crypto_pool: 'Portefeuille crypto',
  cash: 'Caisse',
  alipay: 'Alipay',
  wechat: 'WeChat',
  other: 'Autre',
};

/** Decimals a currency is quoted with — the same rule everywhere in Trésorerie. */
function decimalsFor(currency: string) {
  return currency === 'USDT' ? 4 : currency === 'CNY' ? 2 : 0;
}

function formatBalance(n: number, currency: string) {
  const d = decimalsFor(currency);
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Money entry on the console ladder.
 *
 * Geometry comes from `Input` (so it is the same 32px as every other page-step
 * control); the parsing is the shared `parseAmount` used by every amount field
 * in the app, so the accepted grammar for a number does not fork per surface.
 */
function MoneyInput({
  label,
  currency,
  decimals,
  value,
  onValueChange,
  placeholder = '0',
}: {
  label: string;
  currency: string;
  decimals: number;
  value: number | null;
  onValueChange: (v: number | null) => void;
  placeholder?: string;
}) {
  const formatter = React.useMemo(
    () => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals, useGrouping: true }),
    [decimals],
  );
  const format = React.useCallback(
    (n: number | null) => (n == null || Number.isNaN(n) ? '' : formatter.format(n)),
    [formatter],
  );
  const [display, setDisplay] = React.useState(() => format(value));
  const [focused, setFocused] = React.useState(false);

  /* While focused the operator owns the string — reformatting mid-keystroke
     would move the caret. Re-sync only once focus leaves. */
  React.useEffect(() => {
    if (!focused) setDisplay(format(value));
  }, [value, focused, format]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          value={display}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseAmount(display, decimals > 0);
            setDisplay(parsed == null ? '' : format(parsed));
          }}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.,\s-]/g, '');
            setDisplay(cleaned);
            onValueChange(parseAmount(cleaned, decimals > 0));
          }}
          className="text-right tabular-nums"
        />
        <span className={cn(DT.label, DFG.muted, 'shrink-0')}>{currency}</span>
      </div>
    </Field>
  );
}

/** Credit / debit an account. Same RPC and same validation as the mobile form. */
function AdjustForm({
  accountId,
  currency,
  onClose,
}: {
  accountId: string;
  currency: Currency;
  onClose: () => void;
}) {
  const [direction, setDirection] = React.useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState('');
  const adjust = useAdjustAccount();

  const reasonValid = reason.trim().length >= 10;
  const amountValid = amount !== null && amount > 0;
  const valid = amountValid && reasonValid;

  const handleSubmit = async () => {
    if (!valid || amount === null) return;
    const result = await adjust.mutateAsync({
      account_id: accountId,
      delta_amount: direction === 'credit' ? amount : -amount,
      reason: reason.trim(),
    });
    if (result.success) {
      setAmount(null);
      setReason('');
      onClose();
    }
  };

  return (
    <div className={cn('space-y-3 border-t px-4 pb-4 pt-3', DS.line, DS.well)}>
      <Segment
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'credit', label: 'Approvisionner' },
          { value: 'debit', label: 'Débiter' },
        ]}
      />

      <MoneyInput
        label={direction === 'credit' ? 'Montant à créditer' : 'Montant à débiter'}
        currency={currency}
        decimals={decimalsFor(currency)}
        value={amount}
        onValueChange={setAmount}
      />

      <Field label="Motif (10 caractères min)">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reason.length > 0 && !reasonValid}
          placeholder={direction === 'credit' ? 'ex : virement client reçu UBA' : 'ex : paiement loyer bureau'}
        />
      </Field>
      {reason.length > 0 && !reasonValid ? (
        <p className={cn(DT.label, 'flex items-center gap-2 text-[#C0504D] dark:text-[#E79A9A]')}>
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          Motif obligatoire et d'au moins 10 caractères.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button
          variant={direction === 'credit' ? 'primary' : 'danger'}
          className="flex-1"
          disabled={!valid}
          loading={adjust.isPending}
          onClick={handleSubmit}
        >
          {direction === 'credit' ? 'Approvisionner' : 'Débiter'}
        </Button>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  currency,
  canManage,
  isLast,
}: {
  account: TreasuryAccountBalance;
  currency: Currency;
  canManage: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const balance = Number(account.balance ?? 0);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className={cn(!isLast && 'border-b', DS.line)}>
      {/* A list row, not a control: its geometry comes from the density ladder
          (44px min, 4px grid), not from CONTROL. */}
      <button
        type="button"
        disabled={!canManage}
        aria-expanded={canManage ? open : undefined}
        onClick={() => setOpen((v) => !v)}
        title={canManage ? `Ajuster le solde de « ${account.label} »` : undefined}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors',
          canManage ? cn('cursor-pointer', DS.hover) : 'cursor-default',
          DFOCUS,
          // The panel clips, so an outset ring would be invisible.
          'focus-visible:ring-inset',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>{account.label}</span>
          <span className={cn('block truncate', DT.label, DFG.faint)}>
            {KIND_LABEL[account.kind ?? 'other'] ?? account.kind} ·{' '}
            {account.last_entry_at
              ? `dernière écriture ${new Date(account.last_entry_at).toLocaleDateString('fr-FR')}`
              : 'aucune écriture'}
          </span>
        </span>
        <Figure
          value={formatBalance(balance, currency)}
          size="md"
          tone={balance < 0 ? 'negative' : undefined}
        />
        {canManage ? <Chevron className={cn('h-4 w-4 shrink-0', DFG.faint)} aria-hidden /> : null}
      </button>

      {open && canManage && account.id ? (
        <AdjustForm accountId={account.id} currency={currency} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

export function DesktopAccountsScreen() {
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, isError, isFetching, refetch } = useTreasuryAccountBalances();

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;

  const canManage = hasPermission('canManageTreasury');
  const rows = data ?? [];

  return (
    <Workspace
      head={
        <ScreenHead
          title="Comptes & soldes"
          subtitle={
            canManage
              ? 'Soldes par compte · ouvrez un compte pour l’approvisionner ou le débiter'
              : 'Soldes par compte (lecture seule)'
          }
          actions={
            <MenuButton
              items={[
                {
                  label: 'Actualiser',
                  icon: RefreshCw,
                  onSelect: () => { void refetch(); },
                  disabled: isFetching,
                  hint: 'Actualisation en cours…',
                },
              ]}
            />
          }
        />
      }
    >
      {isError ? (
        <Panel>
          <EmptyState
            icon={AlertTriangle}
            title="Soldes des comptes indisponibles"
            hint="La requête a échoué — aucun compte n'est à zéro, les soldes n'ont simplement pas pu être lus."
            action={
              <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                Réessayer
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {CURRENCY_GROUPS.map((group) => {
            const accounts = rows.filter((a) => a.currency === group.currency);
            const total = accounts.reduce((sum, a) => sum + Number(a.balance ?? 0), 0);
            return (
              <Panel key={group.currency} className="overflow-hidden">
                {/* The currency total lives here and nowhere else on this screen. */}
                <PanelHead
                  title={group.label}
                  actions={
                    isLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <Figure value={formatBalance(total, group.currency)} unit={group.currency} size="md" />
                    )
                  }
                />
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <EmptyState title="Aucun compte" hint={`Aucun compte ${group.currency} actif.`} />
                ) : (
                  accounts.map((a, idx) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      currency={group.currency}
                      canManage={canManage}
                      isLast={idx === accounts.length - 1}
                    />
                  ))
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </Workspace>
  );
}
