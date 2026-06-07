import { useState, createElement } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Package, AlertTriangle, Download } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useMissionReport } from '@/hooks/useProcurement';
import type { ByCurrency, ProcCurrency, ProcPoStatus } from '@/integrations/supabase/procurement';
import { IconChip, INSET, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { ProcProofs } from '@/mobile/components/procurement/ProcProofs';
import { cn } from '@/lib/utils';

const PO_STATUS_LABEL: Record<ProcPoStatus, string> = { open: 'Ouverte', closed: 'Soldée', cancelled: 'Annulée' };

function money(by: ByCurrency): string {
  const entries = (Object.entries(by) as [ProcCurrency, number][]).filter(([, v]) => Math.abs(v) > 0.000001);
  if (entries.length === 0) return '—';
  return entries.map(([c, v]) => `${v.toLocaleString('fr-FR')} ${c}`).join(' · ');
}

function TotalRow({ label, by, accent }: { label: string; by: ByCurrency; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn('text-[13px] font-bold tabular-nums', accent ? 'text-bonzini-orange' : 'text-foreground')}>{money(by)}</span>
    </div>
  );
}

export function MobileMissionDetail() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageProcurement');
  const { data, isLoading, isError } = useMissionReport(missionId);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdf = async () => {
    if (!data || pdfLoading) return;
    setPdfLoading(true);
    try {
      const [{ downloadPDF }, { MissionReportPDF }] = await Promise.all([
        import('@/lib/pdf/downloadPDF'),
        import('@/lib/pdf/templates/MissionReportPDF'),
      ]);
      await downloadPDF(createElement(MissionReportPDF, { report: data }), `${data.mission.reference}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const m = data?.mission;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title={m?.label ?? 'Mission'} showBack backTo="/m/more/procurement/missions"
        rightElement={data ? (
          <button onClick={handlePdf} disabled={pdfLoading} aria-label="Télécharger le rapport PDF"
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted disabled:opacity-50">
            <Download className="h-5 w-5" />
          </button>
        ) : undefined} />

      <div className="px-5 py-6 space-y-6">
        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
        ) : isError || !data || !m ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IconChip icon={AlertTriangle} tone="danger" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Mission introuvable</div>
          </div>
        ) : (
          <>
            {/* Entête */}
            <section className={cn(SOFT_CARD, 'p-4')}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{m.reference}</div>
              <div className="mt-1 text-[18px] font-extrabold leading-tight text-foreground">{m.label}</div>
              <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                <div>{m.client.company_name || `${m.client.first_name ?? ''} ${m.client.last_name ?? ''}`.trim() || 'Client ?'}{m.client.phone ? ` · ${m.client.phone}` : ''}</div>
                {m.location && <div>{m.location}</div>}
                {(m.started_on || m.ended_on) && <div>{m.started_on ?? '?'} → {m.ended_on ?? '…'}</div>}
              </div>
              {m.summary_note && <div className={cn(INSET, 'mt-3 p-3 text-[12px] text-foreground')}>{m.summary_note}</div>}
            </section>

            {/* Totaux */}
            <section>
              <SectionTitle>Totaux</SectionTitle>
              <div className={cn(SOFT_CARD, 'divide-y divide-border px-4')}>
                <TotalRow label="Commandé" by={data.totals.ordered_by_currency} />
                <TotalRow label="Payé" by={data.totals.paid_by_currency} />
                <TotalRow label="Reste à payer" by={data.totals.outstanding_by_currency} accent />
                <TotalRow label="Commission" by={data.totals.commission_by_currency} />
                <TotalRow label="Frais" by={data.totals.expenses_by_currency} />
              </div>
            </section>

            {/* Fournisseurs → commandes */}
            <section>
              <SectionTitle action={canManage ? { label: '+ Commande', onClick: () => navigate(`/m/more/procurement/missions/${m.id}/po/new`) } : undefined}>Fournisseurs & commandes</SectionTitle>
              {data.suppliers.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-muted-foreground">Aucune commande enregistrée.</div>
              ) : (
                <div className="space-y-4">
                  {data.suppliers.map((s) => (
                    <div key={s.supplier_id} className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <Package className="h-4 w-4 text-bonzini-violet" />
                        <span className="text-[14px] font-bold text-foreground">{s.display_name}</span>
                        <span className="text-[11px] text-muted-foreground">{s.city ?? ''}</span>
                      </div>
                      {s.purchase_orders.map((po) => (
                        <button key={po.purchase_order_id} onClick={() => navigate(`/m/more/procurement/po/${po.purchase_order_id}`)} className={cn(SOFT_CARD, 'block w-full p-4 text-left active:scale-[0.99]')}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-foreground">{po.reference}</span>
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold',
                              po.status === 'open' ? 'bg-bonzini-amber/15 text-bonzini-amber'
                                : po.status === 'cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-muted text-muted-foreground',
                            )}>{PO_STATUS_LABEL[po.status]}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[12px]">
                            <span className="text-muted-foreground">
                              {po.incoterm ? `${po.incoterm} · ` : ''}{po.production_status ?? 'production ?'}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {po.total_amount.toLocaleString('fr-FR')} {po.currency}
                            </span>
                          </div>

                          {/* Lignes */}
                          {po.order_lines.length > 0 && (
                            <div className={cn(INSET, 'mt-3 divide-y divide-border/60')}>
                              {po.order_lines.map((l) => (
                                <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                  <span className="min-w-0 truncate text-[12px] text-foreground">{l.description}</span>
                                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                    {l.quantity.toLocaleString('fr-FR')}{l.unit ? ` ${l.unit}` : ''} × {l.unit_price.toLocaleString('fr-FR')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Paiements */}
                          <div className="mt-3 flex items-center justify-between text-[12px]">
                            <span className="text-muted-foreground">Payé {po.paid_amount.toLocaleString('fr-FR')} {po.currency}</span>
                            <span className={cn('font-bold tabular-nums', po.outstanding_amount > 0 ? 'text-bonzini-orange' : 'text-emerald-600 dark:text-emerald-400')}>
                              reste {po.outstanding_amount.toLocaleString('fr-FR')} {po.currency}
                            </span>
                          </div>
                          {po.payments.map((p) => (
                            <div key={p.id} className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{p.leg} · {p.method} · {new Date(p.occurred_at).toLocaleDateString('fr-FR')}</span>
                              <span className="tabular-nums">{p.amount.toLocaleString('fr-FR')} {p.currency}</span>
                            </div>
                          ))}

                          {/* QC + commission */}
                          {(po.qc.length > 0 || po.commission) && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {po.qc.map((q) => (
                                <span key={q.id} className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  q.result === 'pass' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : q.result === 'fail' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : 'bg-bonzini-amber/15 text-bonzini-amber',
                                )}>QC {q.inspection_type}: {q.result}</span>
                              ))}
                              {po.commission && (
                                <span className="rounded-full bg-bonzini-violet/10 px-2 py-0.5 text-[10px] font-semibold text-bonzini-violet">
                                  Comm. {po.commission.computed_amount?.toLocaleString('fr-FR') ?? '—'} {po.commission.currency}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Commissions mission + frais */}
            <section className="space-y-3">
              <SectionTitle action={canManage ? { label: '+ Frais', onClick: () => navigate(`/m/more/procurement/missions/${m.id}/expense/new`) } : undefined}>
                Commission & frais (mission)
              </SectionTitle>
              {(data.mission_commissions.length > 0 || data.expenses.length > 0) ? (
                <div className={cn(SOFT_CARD, 'divide-y divide-border px-4')}>
                  {data.mission_commissions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 text-[12px]">
                      <span className="text-muted-foreground">Commission ({c.input_mode === 'percentage' ? `${c.input_value}%` : 'fixe'})</span>
                      <span className="font-bold tabular-nums text-foreground">{c.computed_amount?.toLocaleString('fr-FR') ?? '—'} {c.currency}</span>
                    </div>
                  ))}
                  {data.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 text-[12px]">
                      <span className="text-muted-foreground">{e.category}{e.billable_to_client ? ' (refacturable)' : ''}</span>
                      <span className="font-bold tabular-nums text-foreground">{e.amount.toLocaleString('fr-FR')} {e.currency}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-center text-[12px] text-muted-foreground">Aucun frais ni commission.</div>
              )}
              {canManage && (
                <button onClick={() => navigate(`/m/more/procurement/missions/${m.id}/commission/new`)}
                  className="w-full rounded-xl bg-muted/60 py-2.5 text-[12px] font-semibold text-foreground active:scale-95">
                  + Commission (mission)
                </button>
              )}
            </section>

            <ProcProofs entityType="mission" entityId={m.id} />

            <div className="pt-2 text-center text-[10px] text-muted-foreground">
              Rapport généré le {new Date(data.generated_at).toLocaleString('fr-FR')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
