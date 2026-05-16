import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
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
  const [actual, setActual] = useState('');
  const [reason, setReason] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const accounts = (data ?? []).filter((a) => a.kind && INVENTORY_KINDS.includes(a.kind));
  const active = accounts.find((a) => a.id === activeAccountId);
  const actualNum = parseFloat(actual.replace(/\s/g, '')) || 0;
  const theoretical = Number(active?.balance ?? 0);
  const variance = activeAccountId ? actualNum - theoretical : 0;
  const reasonRequired = variance !== 0;
  const reasonValid = reason.trim().length >= 10;
  const valid = !!activeAccountId && actual !== '' && (!reasonRequired || reasonValid);

  const handleSubmit = async () => {
    if (!valid || !activeAccountId) return;
    const result = await submit.mutateAsync({
      account_id: activeAccountId,
      actual_balance: actualNum,
      variance_reason: reasonRequired ? reason.trim() : undefined,
    });
    if (result.success) {
      setActiveAccountId(null);
      setActual('');
      setReason('');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Inventaire" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Réconcilie le solde théorique (calculé depuis le ledger) avec le solde réellement constaté.
          Tout écart doit être justifié.
        </p>

        {accounts.map((a) => {
          const isActive = a.id === activeAccountId;
          const balance = Number(a.balance ?? 0);
          return (
            <div
              key={a.id}
              className={cn(
                'rounded-2xl border bg-white overflow-hidden',
                isActive ? 'border-violet-400 shadow-sm' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (!canManage) return;
                  if (isActive) {
                    setActiveAccountId(null);
                  } else {
                    setActiveAccountId(a.id ?? null);
                    setActual('');
                    setReason('');
                  }
                }}
                className="w-full p-3.5 flex items-center justify-between active:bg-muted/40"
              >
                <div className="text-left">
                  <div className="font-semibold text-foreground">{a.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Solde théorique : {balance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {a.currency}
                  </div>
                </div>
                <ClipboardCheck className={cn('w-5 h-5', isActive ? 'text-violet-600' : 'text-muted-foreground')} />
              </button>

              {isActive && canManage && (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-border bg-muted/20">
                  <TextField
                    label={`Solde réel constaté (${a.currency})`}
                    variant="decimal"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="bg-white rounded-lg p-2 border border-border">
                      <div className="text-muted-foreground">Théorique</div>
                      <div className="font-bold">{theoretical.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className={cn(
                      'rounded-lg p-2 border',
                      variance === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
                    )}>
                      <div className={cn(variance === 0 ? 'text-emerald-700' : 'text-red-700')}>Écart</div>
                      <div className={cn('font-bold', variance === 0 ? 'text-emerald-700' : 'text-red-700')}>
                        {variance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {reasonRequired && (
                    <div>
                      <TextField
                        label="Motif de l’écart * (10 caractères min)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      {!reasonValid && (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-600 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          Motif obligatoire et au moins 10 caractères.
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={!valid || submit.isPending}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                  >
                    {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer l’inventaire'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            Aucun compte cash / Alipay / WeChat à inventorier.
          </div>
        )}
      </div>
    </div>
  );
}
