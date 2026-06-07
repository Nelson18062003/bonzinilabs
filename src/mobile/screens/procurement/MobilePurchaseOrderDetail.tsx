import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Receipt, AlertTriangle, Pencil } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { usePurchaseOrder, useVoidRecord } from '@/hooks/useProcurement';
import { IconChip, INSET, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { ProcProofs } from '@/mobile/components/procurement/ProcProofs';
import { PO_STATUS_LABEL, PROD_STATUS_LABEL, PROC_INPUT } from './shared';
import { cn } from '@/lib/utils';

export function MobilePurchaseOrderDetail() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { hasPermission, currentUser } = useAdminAuth();
  const { data, isLoading, isError } = usePurchaseOrder(poId);
  const voidRecord = useVoidRecord();
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const po = data?.purchase_order;
  const canManage = hasPermission('canManageProcurement');
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const cur = po?.currency ?? '';

  const confirmVoid = async () => {
    if (!voidId || voidReason.trim().length < 10) return;
    try {
      await voidRecord.mutateAsync({ p_record_kind: 'supplier_payment', p_id: voidId, p_reason: voidReason.trim() });
      setVoidId(null);
      setVoidReason('');
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title={po?.reference ?? 'Commande'} showBack
        backTo={po ? `/m/more/procurement/missions/${po.mission.id}` : '/m/more/procurement'}
        rightElement={canManage && po ? (
          <button onClick={() => navigate(`/m/more/procurement/po/${po.id}/edit`)} aria-label="Modifier la commande"
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted">
            <Pencil className="h-5 w-5" />
          </button>
        ) : undefined} />

      <div className="px-5 py-6 space-y-6">
        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
        ) : isError || !data || !po ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IconChip icon={AlertTriangle} tone="danger" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Commande introuvable</div>
          </div>
        ) : (
          <>
            {/* Entête */}
            <section className={cn(SOFT_CARD, 'p-4')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[16px] font-extrabold text-foreground">{po.supplier.display_name}</span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  po.status === 'open' ? 'bg-bonzini-amber/15 text-bonzini-amber'
                    : po.status === 'cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-muted text-muted-foreground')}>{PO_STATUS_LABEL[po.status]}</span>
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{po.reference} · {po.mission.label}</div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className={cn(INSET, 'p-3')}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-foreground">{po.total_amount.toLocaleString('fr-FR')} {cur}</div>
                </div>
                <div className={cn(INSET, 'p-3')}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reste à payer</div>
                  <div className={cn('mt-0.5 text-[15px] font-extrabold tabular-nums', po.outstanding_amount > 0 ? 'text-bonzini-orange' : 'text-emerald-600 dark:text-emerald-400')}>
                    {po.outstanding_amount.toLocaleString('fr-FR')} {cur}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                Acompte {po.deposit_pct}%{po.incoterm ? ` · ${po.incoterm}` : ''}
                {po.production_status ? ` · ${PROD_STATUS_LABEL[po.production_status]}` : ''}
                {po.expected_ready_date ? ` · prête le ${po.expected_ready_date}` : ''}
              </div>
              {po.notes && <div className={cn(INSET, 'mt-2 p-3 text-[12px] text-foreground')}>{po.notes}</div>}
            </section>

            {/* Lignes */}
            <section>
              <SectionTitle action={canManage ? { label: '+ Ligne', onClick: () => navigate(`/m/more/procurement/po/${po.id}/line/new`) } : undefined}>
                Lignes ({data.order_lines.length})
              </SectionTitle>
              {data.order_lines.length === 0 ? (
                <div className="py-4 text-center text-[12px] text-muted-foreground">Aucune ligne.</div>
              ) : (
                <div className={cn(SOFT_CARD, 'divide-y divide-border')}>
                  {data.order_lines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 p-3.5">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-foreground">{l.description}</div>
                        <div className="text-[11px] text-muted-foreground">{l.quantity.toLocaleString('fr-FR')}{l.unit ? ` ${l.unit}` : ''} × {l.unit_price.toLocaleString('fr-FR')}{l.hs_code ? ` · HS ${l.hs_code}` : ''}</div>
                      </div>
                      <div className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">{l.line_total.toLocaleString('fr-FR')} {cur}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Paiements */}
            <section>
              <SectionTitle action={canManage ? { label: '+ Paiement', onClick: () => navigate(`/m/more/procurement/po/${po.id}/payment/new`) } : undefined}>
                Paiements ({data.payments.length})
              </SectionTitle>
              {data.payments.length === 0 ? (
                <div className="py-4 text-center text-[12px] text-muted-foreground">Aucun paiement.</div>
              ) : (
                <div className={cn(SOFT_CARD, 'divide-y divide-border')}>
                  {data.payments.map((p) => (
                    <div key={p.id} className="p-3.5">
                      {voidId === p.id ? (
                        <div className="space-y-2">
                          <div className="text-[12px] font-semibold text-foreground">Annuler {p.amount.toLocaleString('fr-FR')} {p.currency} ({p.leg}) ?</div>
                          <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={2}
                            placeholder="Motif de l'annulation (10 caractères min)" className={cn(PROC_INPUT, 'h-auto py-2.5 leading-relaxed')} />
                          <div className="flex gap-2">
                            <button onClick={confirmVoid} disabled={voidReason.trim().length < 10 || voidRecord.isPending}
                              className="flex-1 rounded-xl bg-red-600 py-2.5 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50">
                              Confirmer l'annulation
                            </button>
                            <button onClick={() => { setVoidId(null); setVoidReason(''); }}
                              className="rounded-xl bg-muted/60 px-4 py-2.5 text-[12px] font-semibold text-foreground active:scale-95">
                              Retour
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <IconChip icon={Receipt} tone="neutral" size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-foreground">{p.leg} · {p.method}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(p.occurred_at).toLocaleDateString('fr-FR')} · {p.settlement_mode === 'rail' ? 'rail' : 'attestation'}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[13px] font-bold tabular-nums text-foreground">{p.amount.toLocaleString('fr-FR')} {p.currency}</div>
                            {isSuperAdmin && (
                              <button onClick={() => { setVoidId(p.id); setVoidReason(''); }}
                                className="text-[11px] font-semibold text-red-600 active:opacity-70 dark:text-red-400">Annuler</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Qualité, production & commission */}
            <section className="space-y-3">
              <SectionTitle>Qualité, production & commission</SectionTitle>
              {(data.qc.length > 0 || data.commission || po.production_status) && (
                <div className="flex flex-wrap gap-1.5">
                  {po.production_status && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{PROD_STATUS_LABEL[po.production_status]}</span>
                  )}
                  {data.qc.map((q) => (
                    <span key={q.id} className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      q.result === 'pass' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : q.result === 'fail' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-bonzini-amber/15 text-bonzini-amber')}>
                      QC {q.inspection_type} · {q.result}
                    </span>
                  ))}
                  {data.commission && (
                    <span className="rounded-full bg-bonzini-violet/10 px-2.5 py-1 text-[11px] font-semibold text-bonzini-violet">
                      Commission {data.commission.computed_amount?.toLocaleString('fr-FR') ?? '—'} {data.commission.currency}
                    </span>
                  )}
                </div>
              )}
              {canManage && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => navigate(`/m/more/procurement/po/${po.id}/qc/new`)} className="rounded-xl bg-muted/60 py-2.5 text-[12px] font-semibold text-foreground active:scale-95">+ QC</button>
                  <button onClick={() => navigate(`/m/more/procurement/po/${po.id}/production/new`)} className="rounded-xl bg-muted/60 py-2.5 text-[12px] font-semibold text-foreground active:scale-95">+ Production</button>
                  <button onClick={() => navigate(`/m/more/procurement/po/${po.id}/commission/new`)} className="rounded-xl bg-muted/60 py-2.5 text-[12px] font-semibold text-foreground active:scale-95">+ Commission</button>
                </div>
              )}
            </section>

            {/* Preuves jointes */}
            <ProcProofs entityType="purchase_order" entityId={po.id} />
          </>
        )}
      </div>
    </div>
  );
}
