import { useState, createElement } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Package, AlertTriangle, Share2, Pencil } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useMissionReport } from '@/hooks/useProcurement';
import type { ByCurrency } from '@/integrations/supabase/procurement';
import { IconChip, INSET, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { ProcProofs } from '@/mobile/components/procurement/ProcProofs';
import { ReportPoCard } from '@/mobile/components/procurement/ReportPoCard';
import { formatByCurrency as money } from './shared';
import { cn } from '@/lib/utils';

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
      const [{ sharePDF }, { MissionReportPDF }] = await Promise.all([
        import('@/lib/pdf/sharePDF'),
        import('@/lib/pdf/templates/MissionReportPDF'),
      ]);
      await sharePDF(createElement(MissionReportPDF, { report: data }), `${data.mission.reference}.pdf`);
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
          <button onClick={handlePdf} disabled={pdfLoading} aria-label="Partager le rapport PDF"
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted disabled:opacity-50">
            <Share2 className="h-5 w-5" />
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
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{m.reference}</div>
                {canManage && (
                  <button onClick={() => navigate(`/m/more/procurement/missions/${m.id}/edit`)} aria-label="Modifier la mission"
                    className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
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
                        <ReportPoCard
                          key={po.purchase_order_id}
                          po={po}
                          onOpen={() => navigate(`/m/more/procurement/po/${po.purchase_order_id}`)}
                        />
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
