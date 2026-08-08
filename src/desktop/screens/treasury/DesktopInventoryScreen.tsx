/**
 * Trésorerie — inventaire des comptes (caisse / Alipay / WeChat).
 *
 * Rebuilt onto the console's dimensional contract (`@/desktop/ui/tokens`).
 * Beyond the measurements, two things changed shape:
 *
 *   · **the account cards are `Metric` tiles.** Selecting an account is exactly
 *     what `Metric`'s `onClick` / `active` / `aria-pressed` triple exists for,
 *     and the number on the tile — the theoretical balance — is the number the
 *     operator is about to contradict. The previous version painted its own
 *     `ring-2` selection and a 36px circle to say the same thing, without ever
 *     exposing the pressed state to assistive tech.
 *   · **the reconciliation form left the card.** It used to expand inside
 *     whichever tile was tapped, so a two-column grid re-flowed under the
 *     operator's cursor mid-entry. It is now one panel below the grid, which
 *     also lets the theoretical balance keep a single home (the tile) instead of
 *     being reprinted inside the form.
 *
 * Same data, same validation, same `record_inventory_snapshot` RPC as the mobile
 * screen. Guarded on `canViewTreasury`; writing needs `canManageTreasury`.
 */
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { parseAmount } from '@/components/form/AmountField';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRecordInventorySnapshot, useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DT, DFG } from '@/desktop/ui/tokens';
import {
  Badge,
  Button,
  DataRow,
  EmptyState,
  Field,
  Figure,
  Input,
  Metric,
  Panel,
  PanelHead,
  Skeleton,
} from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

/** Only physical / digital "wallet" accounts need a count; banks auto-reconcile. */
const INVENTORY_KINDS = ['cash', 'alipay', 'wechat'];

const KIND_LABEL: Record<string, string> = {
  cash: 'Caisse',
  alipay: 'Alipay',
  wechat: 'WeChat',
};

function decimalsFor(currency: string) {
  return currency === 'USDT' ? 4 : currency === 'CNY' ? 2 : 0;
}

function fmt(n: number, currency: string) {
  const d = decimalsFor(currency);
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Money entry on the console ladder — geometry from `Input`, grammar from the
 * shared `parseAmount`, so the accepted number format does not fork per surface.
 */
function MoneyInput({
  label,
  currency,
  decimals,
  value,
  onValueChange,
}: {
  label: string;
  currency: string;
  decimals: number;
  value: number | null;
  onValueChange: (v: number | null) => void;
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

  React.useEffect(() => {
    if (!focused) setDisplay(format(value));
  }, [value, focused, format]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          value={display}
          placeholder="0"
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

export function DesktopInventoryScreen() {
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useTreasuryAccountBalances();
  const submit = useRecordInventorySnapshot();

  const [activeAccountId, setActiveAccountId] = React.useState<string | null>(null);
  const [actual, setActual] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState('');

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;

  const canManage = hasPermission('canManageTreasury');
  const accounts = (data ?? []).filter((a) => a.kind && INVENTORY_KINDS.includes(a.kind));
  const active = accounts.find((a) => a.id === activeAccountId);
  const currency = active?.currency ?? 'XAF';

  const theoretical = Number(active?.balance ?? 0);
  const variance = activeAccountId && actual !== null ? actual - theoretical : 0;
  const reasonRequired = variance !== 0;
  const reasonValid = reason.trim().length >= 10;
  const valid = !!activeAccountId && actual !== null && (!reasonRequired || reasonValid);

  const select = (id: string | null) => {
    setActiveAccountId(id);
    setActual(null);
    setReason('');
  };

  const handleSubmit = async () => {
    if (!valid || !activeAccountId || actual === null) return;
    const result = await submit.mutateAsync({
      account_id: activeAccountId,
      actual_balance: actual,
      variance_reason: reasonRequired ? reason.trim() : undefined,
    });
    if (result.success) select(null);
  };

  return (
    <Workspace
      head={
        <ScreenHead
          title="Inventaire des comptes"
          subtitle="Réconcilie le solde théorique (calculé depuis le ledger) avec le solde réellement constaté. Tout écart doit être justifié."
        />
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun compte à inventorier"
            hint="Seuls les comptes caisse, Alipay et WeChat se comptent à la main — les comptes bancaires sont réconciliés automatiquement."
          />
        </Panel>
      ) : (
        <>
          {/* The tiles ARE the selector: the number on each one is the balance the
              operator is about to confirm or contradict. */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const isActive = a.id === activeAccountId;
              return (
                <Metric
                  key={a.id}
                  icon={ClipboardCheck}
                  label={a.label ?? '—'}
                  value={fmt(Number(a.balance ?? 0), a.currency ?? 'XAF')}
                  unit={a.currency ?? undefined}
                  hint={`${KIND_LABEL[a.kind ?? ''] ?? a.kind} · solde théorique`}
                  active={isActive}
                  onClick={canManage ? () => select(isActive ? null : (a.id ?? null)) : undefined}
                />
              );
            })}
          </section>

          {!canManage ? (
            <p className={cn(DT.label, DFG.muted, 'mt-4')}>
              <Badge tone="info">Lecture seule</Badge> Enregistrer un inventaire demande la permission
              « gestion trésorerie ».
            </p>
          ) : null}

          {canManage && active ? (
            <Panel className="mt-4 max-w-xl">
              <PanelHead title={`Inventaire — ${active.label}`} hint="Comptez, saisissez, justifiez l'écart." />
              <div className="space-y-4 p-4">
                <MoneyInput
                  label="Solde réel constaté"
                  currency={currency}
                  decimals={decimalsFor(currency)}
                  value={actual}
                  onValueChange={setActual}
                />

                {/* Le solde théorique n'est PAS réimprimé ici : il est sur la
                    tuile sélectionnée, quatre centimètres plus haut. */}
                <DataRow
                  label="Écart"
                  value={
                    actual === null ? (
                      <span className={DFG.faint}>—</span>
                    ) : (
                      <Figure
                        value={`${variance > 0 ? '+' : ''}${fmt(variance, currency)}`}
                        unit={currency}
                        size="md"
                        tone={variance === 0 ? 'positive' : 'negative'}
                      />
                    )
                  }
                />

                {reasonRequired ? (
                  <div>
                    <Field label="Motif de l'écart (10 caractères min)">
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-invalid={reason.length > 0 && !reasonValid}
                        placeholder="ex : billet manquant constaté à la fermeture"
                      />
                    </Field>
                    {!reasonValid ? (
                      <p className={cn(DT.label, 'mt-1 flex items-center gap-2 text-[#C0504D] dark:text-[#E79A9A]')}>
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                        Motif obligatoire et d'au moins 10 caractères.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => select(null)}>
                    Annuler
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    disabled={!valid}
                    loading={submit.isPending}
                    onClick={handleSubmit}
                  >
                    Enregistrer l'inventaire
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </Workspace>
  );
}
