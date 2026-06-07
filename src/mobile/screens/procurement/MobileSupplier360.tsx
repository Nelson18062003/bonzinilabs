import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Pencil, AlertTriangle, Package } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSupplier360 } from '@/hooks/useProcurement';
import { IconChip, INSET, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { SUPPLIER_KIND_LABEL as KIND_LABEL, VERIF_LABEL, formatByCurrency as money } from './shared';
import { cn } from '@/lib/utils';

export function MobileSupplier360() {
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, isError } = useSupplier360(supplierId);

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const s = data?.supplier;
  const canManage = hasPermission('canManageProcurement');

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader
        title={s?.display_name ?? 'Fournisseur'}
        showBack backTo="/m/more/procurement/suppliers"
        rightElement={canManage && s ? (
          <button
            onClick={() => navigate(`/m/more/procurement/suppliers/${s.id}/edit`)}
            aria-label="Modifier"
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Pencil className="h-5 w-5" />
          </button>
        ) : undefined}
      />

      <div className="px-5 py-6 space-y-6">
        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
        ) : isError || !data || !s ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IconChip icon={AlertTriangle} tone="danger" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Fournisseur introuvable</div>
          </div>
        ) : (
          <>
            <section className={cn(SOFT_CARD, 'p-4')}>
              <div className="text-[18px] font-extrabold leading-tight text-foreground">{s.display_name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-bonzini-violet/10 px-2 py-0.5 text-[10px] font-semibold text-bonzini-violet">{KIND_LABEL[s.supplier_kind]}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{VERIF_LABEL[s.verification_status]}</span>
                {(s.category ?? []).map((c) => (
                  <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{c}</span>
                ))}
              </div>
              <div className="mt-3 space-y-0.5 text-[12px] text-muted-foreground">
                {s.legal_name && <div>{s.legal_name}</div>}
                {(s.city || s.province) && <div>{[s.city, s.province].filter(Boolean).join(', ')}</div>}
                {s.wechat_id && <div>WeChat : {s.wechat_id}</div>}
                {s.phone && <div>Tél : {s.phone}</div>}
                {s.email && <div>{s.email}</div>}
                {s.verification_notes && <div className={cn(INSET, 'mt-2 p-3 text-foreground')}>{s.verification_notes}</div>}
              </div>
            </section>

            <section>
              <SectionTitle>Activité</SectionTitle>
              <div className={cn(SOFT_CARD, 'grid grid-cols-2 divide-x divide-border')}>
                <div className="p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commandes</div>
                  <div className="mt-1 text-[18px] font-extrabold tabular-nums text-foreground">{data.totals.purchase_order_count}</div>
                </div>
                <div className="p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reste à payer</div>
                  <div className="mt-1 text-[14px] font-extrabold tabular-nums text-bonzini-orange">{money(data.totals.outstanding_by_currency)}</div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>Commandes</SectionTitle>
              {data.purchase_orders.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-muted-foreground">Aucune commande.</div>
              ) : (
                <div className="space-y-2.5">
                  {data.purchase_orders.map((po) => (
                    <button
                      key={po.purchase_order_id}
                      onClick={() => navigate(`/m/more/procurement/po/${po.purchase_order_id}`)}
                      className={cn(SOFT_CARD, 'flex w-full items-center gap-3.5 p-4 text-left active:scale-[0.99]')}
                    >
                      <IconChip icon={Package} tone="neutral" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold text-foreground">{po.reference}</div>
                        <div className="truncate text-[12px] text-muted-foreground">{po.mission_label}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[13px] font-bold tabular-nums text-foreground">{po.total_amount.toLocaleString('fr-FR')} {po.currency}</div>
                        {(po.outstanding_amount ?? 0) > 0 && (
                          <div className="text-[11px] text-bonzini-orange">reste {(po.outstanding_amount ?? 0).toLocaleString('fr-FR')}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
