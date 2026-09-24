// ============================================================
// Desktop admin — les colis d'un client, en dialogue centré : ses dépôts,
// dépôt par dépôt, avec l'état des colis et le devis ; un clic sur un dépôt
// ouvre sa fiche (DepositQuickView), sans jamais quitter la page Réception.
// ============================================================
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClientDeposits } from '@/hooks/useReception';
import { clientFullName, depositStage, formatCbm, formatKg, initials } from '@/lib/reception';
import { quoteStatusMeta, xaf } from '@/lib/cargoQuote';
import { Band, Empty, Fact, Facts } from '@/components/cargo/dossier/kit';
import { LocationMark, formatDateTime } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, CenterDialog, Holder, ScreenLoader, StatusPill, Th, Td } from '@/desktop/designKit';

export function ClientParcelsQuickView({ clientId, onClose, onOpenDeposit }: { clientId: string | null; onClose: () => void; onOpenDeposit: (depositId: string) => void }) {
  const navigate = useNavigate();
  const { data: deposits, isLoading } = useClientDeposits(clientId ?? undefined);
  const client = deposits?.find((d) => d.client)?.client ?? null;
  const name = client ? clientFullName(client) : 'Client';
  const parcels = deposits?.flatMap((d) => d.parcels) ?? [];
  const waiting = parcels.filter((p) => !p.shipment_id && !p.air_shipment_id);
  const kg = parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = parcels.reduce((s, p) => s + Number(p.cbm ?? 0), 0);

  return (
    <CenterDialog
      open={!!clientId}
      onClose={onClose}
      width={760}
      title={
        <span className="flex items-center gap-3">
          <Holder size="md">{client ? initials(name) : '?'}</Holder>
          <span className="min-w-0">
            <span className={cn('block text-[15px] font-bold', TEXT.strong)}>{name}</span>
            <span className={cn('block text-[12px] tabular-nums', TEXT.muted)}>{[client?.customer_code, client?.phone, client?.account_name ? `compte ${client.account_name}` : null].filter(Boolean).join(' · ') || 'Ses colis reçus'}</span>
          </span>
        </span>
      }
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={client ? (
        <button type="button" onClick={() => { onClose(); navigate(`/m/clients/${client.user_id}`); }} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}>
          Fiche client <ArrowRight className="h-4 w-4" />
        </button>
      ) : undefined}
    >
      {isLoading || !deposits ? (
        <ScreenLoader />
      ) : (
        <>
          <Band first>
            <Facts cols={3}>
              <Fact label="Colis reçus" value={String(parcels.length)} hint={waiting.length > 0 ? `${waiting.length} à l'entrepôt, pas encore chargés` : 'tout est parti ou remis'} />
              <Fact label="Poids" value={formatKg(kg)} />
              <Fact label="Volume" value={formatCbm(cbm)} />
            </Facts>
          </Band>
          <Band title="Ses dépôts" meta={`${deposits.length} dépôt${deposits.length > 1 ? 's' : ''}`}>
            {deposits.length === 0 ? (
              <Empty title="Aucun colis reçu pour ce client" />
            ) : (
              <div className="-mx-5 max-h-[420px] overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <Th first>N°</Th>
                      <Th>Reçu le</Th>
                      <Th align="right">Colis</Th>
                      <Th align="right">Poids</Th>
                      <Th align="right">m³</Th>
                      <Th>État</Th>
                      <Th last>Devis</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => {
                      const st = depositStage(d.parcels);
                      const q = quoteStatusMeta(d.quote_status);
                      return (
                        <tr key={d.id} onClick={() => onOpenDeposit(d.id)} className="cursor-pointer transition-colors hover:bg-muted/40">
                          <Td first><span className="inline-flex items-center gap-2"><LocationMark location={d.location} size={18} /><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{d.deposit_no}</span></span></Td>
                          <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDateTime(d.closed_at ?? d.opened_at)}</span>{d.received_by_name && <span className={cn('block text-[11.5px]', TEXT.muted)}>par {d.received_by_name}</span>}</Td>
                          <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{d.parcels.length}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(d.total_weight_kg)}</span></Td>
                          <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(d.total_cbm)}</span></Td>
                          <Td><StatusPill tone={st.tone} label={st.label} /></Td>
                          <Td last>
                            <span className="inline-flex flex-col items-start gap-0.5">
                              <StatusPill tone={q.tone} label={q.short} />
                              {d.quote_total_xaf != null && <span className={cn('text-[11.5px] tabular-nums', TEXT.muted)}>{d.quote_paid_xaf && d.quote_paid_xaf > 0 && d.quote_paid_xaf < d.quote_total_xaf ? `reste ${xaf(d.quote_total_xaf - d.quote_paid_xaf)}` : xaf(d.quote_total_xaf)}</span>}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Band>
        </>
      )}
    </CenterDialog>
  );
}
