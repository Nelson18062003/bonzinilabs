import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { TextField } from '@/components/form';
import { MoneyField } from '@/components/treasury/MoneyField';
import { INSET, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useRecordInventorySnapshot,
  useTreasuryAccountBalances,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

// Only physical / digital "wallet" CNY accounts need inventory; bank accounts are auto-reconciled.
const INVENTORY_KINDS = ['cash', 'alipay', 'wechat'];

export function MobileInventoryScreen() {
  const { hasPermission } = useAdminAuth();
  const { data } = useTreasuryAccountBalances();
  const submit = useRecordInventorySnapshot();
  const canManage = hasPermission('canManageTreasury');

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const accounts = (data ?? []).filter((a) => a.kind && INVENTORY_KINDS.includes(a.kind));
  const active = accounts.find((a) => a.id === activeAccountId);
  const theoretical = Number(active?.balance ?? 0);
  const variance = activeAccountId && actual !== null ? actual - theoretical : 0;
  const reasonRequired = variance !== 0;
  const reasonValid = reason.trim().length >= 10;
  const valid = !!activeAccountId && actual !== null && (!reasonRequired || reasonValid);

  const handleSubmit = async () => {
    if (!valid || !activeAccountId || actual === null) return;
    const result = await submit.mutateAsync({
      account_id: activeAccountId,
      actual_balance: actual,
      variance_reason: reasonRequired ? reason.trim() : undefined,
    });
    if (result.success) {
      setActiveAccountId(null);
      setActual(null);
      setReason('');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Inventaire" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-5 space-y-3">
        <p className="px-1 text-[12px] leading-snug text-muted-foreground">
          Réconcilie le solde théorique (calculé depuis le ledger) avec le solde réellement constaté.
          Tout écart doit être justifié.
        </p>

        {accounts.map((a) => {
          const isActive = a.id === activeAccountId;
          const balance = Number(a.balance ?? 0);
          return (
            <div key={a.id} className={cn(SOFT_CARD, 'overflow-hidden', isActive && 'ring-2 ring-bonzini-violet/40')}>
              <button
                type="button"
                onClick={() => {
                  if (!canManage) return;
                  if (isActive) {
                    setActiveAccountId(null);
                  } else {
                    setActiveAccountId(a.id ?? null);
                    setActual(null);
                    setReason('');
                  }
                }}
                className="flex w-full items-center justify-between p-4 active:bg-muted/30"
              >
                <div className="min-w-0 text-left">
                  <div className="truncate font-semibold text-foreground">{a.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Solde théorique : {balance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {a.currency}
                  </div>
                </div>
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', isActive ? 'bg-violet-500/10 text-bonzini-violet' : 'bg-muted text-muted-foreground')}>
                  <ClipboardCheck className="h-4 w-4" />
                </div>
              </button>

              {isActive && canManage && a.currency && (
                <div className="space-y-3 border-t border-border bg-muted/30 px-4 pb-4 pt-3.5">
                  <MoneyField
                    label="Solde réel constaté"
                    currency={a.currency}
                    value={actual}
                    onValueChange={setActual}
                    allowDecimal
                    decimals={a.currency === 'USDT' ? 4 : a.currency === 'CNY' ? 2 : 0}
                    max={null}
                  />

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className={cn(INSET, 'p-2.5')}>
                      <div className="text-muted-foreground">Théorique</div>
                      <div className="font-bold tabular-nums text-foreground">{theoretical.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className={cn('rounded-2xl p-2.5', variance === 0 ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                      <div className={cn(variance === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>Écart</div>
                      <div className={cn('font-bold tabular-nums', variance === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                        {variance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {reasonRequired && (
                    <div>
                      <TextField label="Motif de l’écart (10 caractères min)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      {!reasonValid && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Motif obligatoire et au moins 10 caractères.
                        </div>
                      )}
                    </div>
                  )}

                  <PrimaryPill onClick={handleSubmit} disabled={!valid} loading={submit.isPending}>
                    Enregistrer l’inventaire
                  </PrimaryPill>
                </div>
              )}
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            Aucun compte cash / Alipay / WeChat à inventorier.
          </div>
        )}
      </div>
    </div>
  );
}
