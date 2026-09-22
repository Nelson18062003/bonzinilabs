// ============================================================
// Desktop admin — un dépôt de colis en dialogue centré (le pendant de
// CargoQuickView pour la réception) : le client, qui l'a apporté, qui l'a
// reçu, puis la table des colis avec leur état — à l'entrepôt, ou chargé
// dans telle boîte. Un dépôt orphelin s'attribue d'ici.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAssignDeposit, useReceptionDeposit, useReceptionSearch } from '@/hooks/useReception';
import { clientFullName, depositSupplier, formatCbm, formatDims, formatKg, initials, parcelStage, supplierLine } from '@/lib/reception';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { depositTimeline } from '@/lib/parcelDepositTimeline';
import { DepositReleases, releaseIds } from '@/mobile/components/cargo/DepositReleases';
import { DepositTimeline } from '@/mobile/components/cargo/DepositTimeline';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { Band, Fact, Facts } from '@/components/cargo/dossier/kit';
import { LocationMark, ParcelThumb, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { QuoteSection } from './QuoteSection';
import { QuotePaymentsSection } from './QuotePaymentsSection';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, Holder, ScreenLoader, StatusPill, Th, Td } from '@/desktop/designKit';

export function DepositQuickView({ depositId, onClose }: { depositId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: d } = useReceptionDeposit(depositId ?? undefined);
  const [assigning, setAssigning] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const search = useReceptionSearch(assigning ? debounced : '');
  const assign = useAssignDeposit();
  const { data: quote } = useCargoQuote(depositId ?? undefined);
  const viewer = useParcelViewer();
  useEffect(() => { if (!depositId) { setAssigning(false); setQuery(''); viewer.close(); } }, [depositId]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = d?.client ? clientFullName(d.client) : 'Client à attribuer';
  const st = d ? labels.status(d) : null;
  const loaded = d?.parcels.filter((p) => parcelStage(p).inBox) ?? [];
  const supplier = d ? depositSupplier(d) : null;
  const photos = d?.parcels.filter((p) => p.photo_path).length ?? 0;
  const events = d ? depositTimeline(d, quote) : [];

  return (
    <CenterDialog
      open={!!depositId}
      onClose={onClose}
      width={760}
      title={
        d ? (
          <span className="flex items-center gap-3">
            <LocationMark location={d.location} size={30} />
            <span className="min-w-0">
              <span className={cn('block text-[15px] font-bold tabular-nums', TEXT.strong)}>{d.deposit_no} · {name}</span>
              <span className={cn('block text-[12px]', TEXT.muted)}>{labels.location(d.location)} · {formatDateTime(d.closed_at ?? d.opened_at)}</span>
            </span>
            {st && <StatusPill tone={st.tone} label={st.label} className="ml-auto" />}
          </span>
        ) : 'Dépôt'
      }
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={
        d ? (
          <>
            {d.client && (
              <button type="button" onClick={() => { onClose(); navigate(`/m/clients/${d.client!.user_id}`); }} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}>
                Fiche client <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {!d.client && hasPermission('canReceiveParcels') && (
              <button type="button" onClick={() => setAssigning((v) => !v)} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}>
                <UserSearch className="h-4 w-4" /> Attribuer à un client
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {!d ? (
        <ScreenLoader />
      ) : (
        <>
          <Band first>
            <div className="flex items-center gap-3">
              <Holder size="lg" tone={d.client ? 'neutral' : 'pending'}>{d.client ? initials(name) : '?'}</Holder>
              <div className="min-w-0 flex-1">
                <div className={cn('text-[14px] font-bold', TEXT.strong)}>{name}</div>
                <div className={cn('text-[12px]', TEXT.muted)}>
                  {d.client ? [d.client.customer_code, d.client.phone, d.client.company_name, d.client.city].filter(Boolean).join(' · ') : 'Personne ne sait encore à qui il est. Rappelez, ou attendez que le client se manifeste.'}
                </div>
              </div>
            </div>
            {assigning && (
              <div className="mt-4 space-y-2">
                <div className="relative">
                  <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone, BZ-…" autoFocus className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                {(search.data ?? []).map((c) => {
                  const n = clientFullName(c);
                  return (
                    <button
                      key={c.user_id}
                      type="button"
                      onClick={async () => {
                        await assign.mutateAsync({ depositId: d.id, clientUserId: c.user_id });
                        toast.success('Dépôt attribué', { description: n });
                        setAssigning(false);
                      }}
                      className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent')}
                    >
                      <Holder size="sm">{initials(n)}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', TEXT.strong)}>{n} <span className={cn('font-mono text-[12px]', TEXT.muted)}>{c.customer_code}</span></span>
                        <span className={cn('block truncate text-[12px]', TEXT.muted)}>{[c.phone, c.city].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Band>
          <Band title="La réception">
            <Facts cols={4}>
              <Fact label="Apporté par" value={labels.broughtBy(d.brought_by)} hint={d.representative_name ? `${d.representative_name}${d.representative_phone ? ` · ${d.representative_phone}` : ''}` : undefined} />
              <Fact label="Reçu par" value={d.received_by_name ?? '—'} />
              <Fact label="Reçu le" value={formatDateTime(d.closed_at ?? d.opened_at)} />
              <Fact label="Total" value={`${d.parcels.length} colis`} hint={`${formatKg(d.total_weight_kg)} · ${formatCbm(d.total_cbm)}`} />
            </Facts>
            <div className="mt-4"><Facts cols={2}>
              <Fact label="Fournisseur" value={supplier ? supplierLine(supplier) : '—'} hint={supplier ? [supplier.email, supplier.wechat ? `WeChat ${supplier.wechat}` : null].filter(Boolean).join(' · ') || undefined : 'Non renseigné à la réception'} />
              <Fact label="Adresse du fournisseur" value={supplier?.address || '—'} />
            </Facts></div>
          </Band>
          <QuoteSection deposit={d} />
          <QuotePaymentsSection depositId={d.id} />
          <Band title="Les colis" meta={`${photos > 0 ? `${photos} photo${photos > 1 ? 's' : ''} · ` : ''}${loaded.length > 0 ? `${d.parcels.length - loaded.length} à l'entrepôt · ${loaded.length} dans une boîte` : `${d.parcels.length} à l'entrepôt`}`}>
            <div className="-mx-5 max-h-[360px] overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th first>Photo</Th>
                    <Th>N°</Th>
                    <Th>Ce qu'il y a dedans</Th>
                    <Th align="right">Poids</Th>
                    <Th align="right">Dimensions</Th>
                    <Th align="right">m³</Th>
                    <Th last>État</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.parcels.map((p, i) => (
                    <tr key={p.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => viewer.open(i)}>
                      <Td first><ParcelThumb path={p.photo_path} onOpen={() => viewer.open(i)} size="h-12 w-12" /></Td>
                      <Td><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{String(p.seq).padStart(2, '0')}</span></Td>
                      <Td>
                        <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{p.description || labels.kind(p.kind)}</div>
                        {p.courier_waybill && <div className={cn('font-mono text-[11.5px]', TEXT.muted)}>{p.courier_waybill}</div>}
                      </Td>
                      <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(p.weight_kg)}</span></Td>
                      <Td align="right"><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDims(p)}</span></Td>
                      <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(p.cbm)}</span></Td>
                      <Td last>
                        {(() => {
                          const st = parcelStage(p);
                          return st.inBox && p.shipment_id ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); navigate(`/m/cargo/${p.shipment_id}/chargement`); }}>
                              <StatusPill tone={st.tone} label={st.label} />
                            </button>
                          ) : <StatusPill tone={st.tone} label={st.label} />;
                        })()}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Band>
          {releaseIds(d.parcels).length > 0 && (
            <Band title="Les bons de retrait"><DepositReleases parcels={d.parcels} /></Band>
          )}
          <Band title="L'historique"><DepositTimeline events={events} flat /></Band>
          <ParcelPhotoViewer parcels={d.parcels.map((p) => ({ ...p, note: parcelStage(p).label }))} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={d.deposit_no} />
        </>
      )}
    </CenterDialog>
  );
}
