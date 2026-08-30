import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Check, CheckCheck, Loader2, Pencil, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MoneyField } from '@/components/treasury/MoneyField';
import { SelectField } from '@/components/treasury/SelectField';
import { FieldLabel, INSET, Pill, PrimaryPill, SOFT_CARD, SectionTitle } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useSetSettlementRate,
  useSettlePayments,
  useUnsettledPayments,
  useUsdtStock,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

const METHOD_LABEL: Record<string, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat',
  bank_transfer: 'Virement',
  cash: 'Cash',
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Règlements Chine — le nouveau flux opérationnel : chaque paiement client
 * complété est payé immédiatement par le partenaire en Chine au taux
 * USDT/CNY du moment. Cet écran transforme ces paiements en ventes USDT
 * traçables (une ligne usdt_sales liée par paiement), en lot, au taux
 * courant du partenaire — plus de double saisie, et les totaux mensuels
 * (USDT vendu, taux moyen) tombent tout seuls.
 */
export function MobileSettlements({ desktop = false }: { desktop?: boolean } = {}) {
  const { hasPermission } = useAdminAuth();
  const { data: buyers } = useCounterparties('cny_buyer');
  const { data: unsettled, isLoading } = useUnsettledPayments();
  const { data: stock } = useUsdtStock();
  const setRate = useSetSettlementRate();
  const settle = useSettlePayments();

  const [buyerId, setBuyerId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingRate, setEditingRate] = useState(false);
  const [rateDraft, setRateDraft] = useState<number | null>(null);

  // Pré-sélectionne l'acheteur unique (le cas normal : un seul partenaire).
  useEffect(() => {
    if (!buyerId && buyers && buyers.length > 0) setBuyerId(buyers[0].id);
  }, [buyers, buyerId]);

  const buyer = useMemo(() => (buyers ?? []).find((b) => b.id === buyerId), [buyers, buyerId]);
  const rate = buyer?.settlement_rate ? Number(buyer.settlement_rate) : null;

  const payments = unsettled?.payments ?? [];
  const selectedPayments = payments.filter((p) => selected.has(p.id));
  const totalCny = selectedPayments.reduce((s, p) => s + Number(p.amount_rmb), 0);
  const totalUsdt = rate ? totalCny / rate : null;
  const stockAfter = stock !== undefined && totalUsdt !== null ? Number(stock) - totalUsdt : null;
  const willGoNegative = stockAfter !== null && stockAfter < 0;

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = payments.length > 0 && selected.size === payments.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(payments.map((p) => p.id)));
  };

  const handleSaveRate = async () => {
    if (!buyerId || !rateDraft || rateDraft <= 0) return;
    const result = await setRate.mutateAsync({ counterparty_id: buyerId, rate: rateDraft });
    if (result.success) {
      setEditingRate(false);
      setRateDraft(null);
    }
  };

  const handleSettle = async () => {
    if (!buyerId || !rate || selected.size === 0) return;
    const result = await settle.mutateAsync({
      payment_ids: [...selected],
      buyer_id: buyerId,
    });
    if (result.success) setSelected(new Set());
  };

  const canSettle = !!buyerId && !!rate && selected.size > 0 && !settle.isPending;

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className="text-[24px] font-extrabold tracking-tight text-foreground">Règlements Chine</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            Paiements clients payés par le partenaire → ventes USDT au taux du moment
          </p>
        </header>
      ) : (
        <MobileHeader title="Règlements Chine" showBack backTo="/m/more/treasury" />
      )}

      <div className={desktop ? 'space-y-6' : 'px-5 py-5 space-y-6'}>
        {/* Partenaire + taux courant */}
        <section>
          <SectionTitle>Partenaire &amp; taux du moment</SectionTitle>
          {(buyers ?? []).length > 1 && (
            <div className="mb-3">
              <FieldLabel>Acheteur CNY</FieldLabel>
              <SelectField
                value={buyerId}
                onChange={(v) => { setBuyerId(v); setEditingRate(false); setRateDraft(null); }}
                options={(buyers ?? []).map((b) => ({
                  value: b.id,
                  label: `${b.short_id} · ${b.display_name}`,
                }))}
              />
            </div>
          )}

          <div className={cn(SOFT_CARD, 'p-4')}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Taux de règlement{buyer ? ` · ${buyer.display_name}` : ''}
                </div>
                <div className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight tabular-nums text-foreground">
                  {rate ? fmt(rate, 4) : '—'}{' '}
                  <span className="text-sm font-semibold text-muted-foreground">CNY/USDT</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {buyer?.settlement_rate_updated_at
                    ? `Mis à jour ${formatDistanceToNow(new Date(buyer.settlement_rate_updated_at), { addSuffix: true, locale: fr })}`
                    : 'Aucun taux défini — saisis le taux annoncé par le partenaire'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRate((v) => !v);
                  setRateDraft(rate);
                }}
                aria-label="Modifier le taux"
                className={cn(INSET, 'flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition active:scale-95')}
              >
                {editingRate ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </button>
            </div>

            {editingRate && (
              <div className="mt-3 flex items-end gap-2">
                <MoneyField
                  className="flex-1"
                  label="Nouveau taux (CNY pour 1 USDT)"
                  currency="CNY/USDT"
                  value={rateDraft}
                  onValueChange={setRateDraft}
                  allowDecimal
                  decimals={4}
                  max={null}
                />
                <button
                  type="button"
                  onClick={handleSaveRate}
                  disabled={!rateDraft || rateDraft <= 0 || setRate.isPending}
                  className={cn(
                    'flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl transition active:scale-95',
                    rateDraft && rateDraft > 0 ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                  )}
                  aria-label="Enregistrer le taux"
                >
                  {setRate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Paiements à régler */}
        <section>
          <SectionTitle>À régler · {payments.length} paiement{payments.length > 1 ? 's' : ''}</SectionTitle>

          {payments.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <Pill active={allSelected} onClick={toggleAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Pill>
              <span className="text-[12px] text-muted-foreground">
                {selected.size > 0 ? `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}` : ''}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className={cn(SOFT_CARD, 'p-6 text-center')}>
              <div className="text-[14px] font-semibold text-foreground">Tout est réglé</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Aucun paiement complété en attente de règlement USDT.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {payments.map((p) => {
                const isSelected = selected.has(p.id);
                const usdt = rate ? Number(p.amount_rmb) / rate : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      SOFT_CARD,
                      'flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]',
                      isSelected && 'ring-2 ring-inset ring-bonzini-violet',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        isSelected
                          ? 'border-bonzini-violet bg-bonzini-violet text-white'
                          : 'border-muted-foreground/30 text-transparent',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-foreground">
                        {p.client_name || p.company_name || 'Client'}
                        <span className="ml-1.5 font-normal text-muted-foreground">{p.reference}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {METHOD_LABEL[p.method] ?? p.method} ·{' '}
                        {new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-bold tabular-nums text-foreground">
                        {fmt(Number(p.amount_rmb))} <span className="font-normal text-muted-foreground">CNY</span>
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        {usdt !== null ? `≈ ${fmt(usdt, 4)} USDT` : 'taux requis'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Récap + action */}
        {selected.size > 0 && (
          <section className="space-y-3">
            <div className={cn(SOFT_CARD, 'space-y-2 p-4')}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">CNY payés par le partenaire</span>
                <span className="font-bold tabular-nums text-foreground">{fmt(totalCny)} CNY</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">USDT dus au taux {rate ? fmt(rate, 4) : '—'}</span>
                <span className="font-bold tabular-nums text-foreground">
                  {totalUsdt !== null ? `${fmt(totalUsdt, 4)} USDT` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
                <span className="text-muted-foreground">Stock USDT après</span>
                <span className={cn('font-bold tabular-nums', willGoNegative ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                  {stockAfter !== null ? fmt(stockAfter, 4) : '—'}
                </span>
              </div>
            </div>

            {willGoNegative && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="text-[12px] text-red-700 dark:text-red-300">
                  Ce règlement fera passer le stock USDT en négatif (à régulariser par un achat manquant).
                </span>
              </div>
            )}

            {!rate && (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-[12px] text-amber-700 dark:text-amber-300">
                  Définis d’abord le taux de règlement du partenaire (crayon ci-dessus).
                </span>
              </div>
            )}

            <PrimaryPill onClick={handleSettle} disabled={!canSettle} loading={settle.isPending}>
              Régler {selected.size} paiement{selected.size > 1 ? 's' : ''}
              {totalUsdt !== null ? ` · ${fmt(totalUsdt, 2)} USDT` : ''}
            </PrimaryPill>
          </section>
        )}
      </div>
    </div>
  );
}
