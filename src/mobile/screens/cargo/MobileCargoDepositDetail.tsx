// ============================================================
// Mobile admin — Cargo › un dépôt de colis, tel que le réceptionnaire l'a
// enregistré : le client, qui l'a apporté, qui l'a reçu, chaque colis avec
// sa photo (en grand, d'un toucher), son poids, son volume, et où il en est.
// Puis l'argent du dépôt — devis, encaissements et reçus, reste à payer,
// facture —, les bons de retrait, et l'histoire complète du dépôt. C'est LA
// fiche : tout ce qui concerne ces colis part d'ici. Un dépôt orphelin
// s'attribue d'ici.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Search, Tag, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAssignDeposit, useReceptionDeposit, useReceptionSearch } from '@/hooks/useReception';
import { clientFullName, depositSupplier, formatCbm, formatKg, initials, parcelStage, supplierLine } from '@/lib/reception';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { paidSentence, quoteStatusMeta, xaf } from '@/lib/cargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { depositTimeline } from '@/lib/parcelDepositTimeline';
import { QuotePayments } from './QuotePayments';
import { DepositReleases } from '@/mobile/components/cargo/DepositReleases';
import { DepositTimeline } from '@/mobile/components/cargo/DepositTimeline';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, Card, Holder, Row, ScreenError, ScreenLoader, StatusPill, TextInput } from '@/mobile/designKit';
import { LocationMark, ParcelRow, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

export function MobileCargoDepositDetail() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const [assignOpen, setAssignOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const search = useReceptionSearch(assignOpen ? debounced : '');
  const assign = useAssignDeposit();
  const { data: quote } = useCargoQuote(depositId);
  const { data: settings } = useAdminShippingSettings();
  const viewer = useParcelViewer();
  const [labelsOpen, setLabelsOpen] = useState(false);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !deposit) return <ScreenError description={(error as Error | null)?.message ?? 'Dépôt introuvable'} onRetry={() => void refetch()} />;

  const name = deposit.client ? clientFullName(deposit.client) : 'Client à attribuer';
  const st = labels.status(deposit);
  const loaded = deposit.parcels.filter((p) => p.shipment_id);
  const waiting = deposit.parcels.length - loaded.length;
  const supplier = depositSupplier(deposit);
  const photos = deposit.parcels.filter((p) => p.photo_path).length;
  const viewerParcels = deposit.parcels.map((p) => ({ ...p, note: parcelStage(p).label }));
  const events = depositTimeline(deposit, quote);

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={deposit.deposit_no} subtitle={labels.location(deposit.location)} showBack backTo="/m/cargo/reception" />

      <div className="space-y-6 px-4 pb-10 pt-4">
        <Card className="space-y-4">
          <button type="button" disabled={!deposit.client} onClick={() => deposit.client && navigate(`/m/clients/${deposit.client.user_id}`)} className="flex w-full items-center gap-4 text-left">
            <Holder size="lg" tone={deposit.client ? 'neutral' : 'pending'}>{deposit.client ? initials(name) : '?'}</Holder>
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
              <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>
                {deposit.client ? [deposit.client.customer_code, deposit.client.phone, deposit.client.city].filter(Boolean).join(' · ') : "Personne ne sait encore à qui il est"}
              </span>
            </span>
            <StatusPill tone={st.tone} label={st.label} />
          </button>
          <div className={cn('border-t', SURFACE.divider)}>
            <Row label="Apporté par" value={<>{labels.broughtBy(deposit.brought_by)}{deposit.representative_name && <span className={cn('block font-normal', TYPE.small, TEXT.muted)}>{deposit.representative_name}{deposit.representative_phone ? ` · ${deposit.representative_phone}` : ''}</span>}</>} />
            <Row label="Mode" value={<span className="inline-flex items-center gap-2"><LocationMark location={deposit.location} size={24} />{labels.location(deposit.location)}</span>} />
            <Row label="Reçu le" value={formatDateTime(deposit.closed_at ?? deposit.opened_at)} />
            <Row label="Par" value={deposit.received_by_name ?? '—'} />
            <Row label="Total" value={`${deposit.parcels.length} colis · ${formatKg(deposit.total_weight_kg)} · ${formatCbm(deposit.total_cbm)}`} />
            <Row label="Fournisseur" value={supplier ? <>{supplierLine(supplier)}{(supplier.email || supplier.wechat) && <span className={cn('block font-normal', TYPE.small, TEXT.muted)}>{[supplier.email, supplier.wechat ? `WeChat ${supplier.wechat}` : null].filter(Boolean).join(' · ')}</span>}</> : <span className={TEXT.muted}>Non renseigné</span>} />
          </div>
          {!deposit.client && hasPermission('canReceiveParcels') && (
            <Button variant="primary" className="h-12 w-full" onClick={() => setAssignOpen(true)}><UserSearch /> Attribuer à un client</Button>
          )}
          {deposit.client && deposit.parcels.length > 0 && (
            <Button variant="neutral" className="h-12 w-full" onClick={() => setLabelsOpen(true)}><Tag /> Étiquettes des cartons ({deposit.parcels.length})</Button>
          )}
        </Card>

        {/* Le prix et le devis : posés ici, côté admin — jamais par le réceptionnaire. */}
        {(() => { const qs = quoteStatusMeta(quote?.status); return (
          <button type="button" onClick={() => navigate(`/m/cargo/reception/${deposit.id}/devis`)} className={cn('flex w-full items-center gap-4 rounded-lg p-4 text-left', SURFACE.card, SURFACE.shadow, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><FileText className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn(TYPE.bodyStrong, TEXT.strong)}>Prix et devis</span>
                <StatusPill tone={qs.tone} label={qs.label} />
              </span>
              <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>{quote ? `${quote.quote_no} · ${quote.amount_paid_xaf > 0 ? paidSentence(quote.total_xaf, quote.amount_paid_xaf) : xaf(quote.total_xaf)}` : hasPermission('canPriceParcels') ? 'Aucun prix posé : touchez pour chiffrer' : 'Aucun prix posé'}</span>
            </span>
            <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
          </button>
        ); })()}

        {/* Les colis : toucher la vignette ou la ligne ouvre la photo en grand, avec tout ce qu'on sait du colis. */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>Colis</h2>
            <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>
              {photos > 0 ? `${photos} photo${photos > 1 ? 's' : ''}` : 'Sans photo'}{waiting > 0 && ` · ${waiting} à l'entrepôt`}{loaded.length > 0 && ` · ${loaded.length} chargés`}
            </span>
          </div>
          <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
            {deposit.parcels.map((p, i) => (
              <div key={p.id}>
                <ParcelRow parcel={p} onClick={() => viewer.open(i)} onPhoto={() => viewer.open(i)} />
                {(p.shipment_id || p.checked_in_at || p.delivered_at) && (
                  <button type="button" onClick={() => p.shipment_id && navigate(`/m/cargo/${p.shipment_id}/dedans`)} className="-mt-2 mb-3 inline-flex">
                    <StatusPill tone={parcelStage(p).tone} label={parcelStage(p).label} className="h-7 text-[14px]" />
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>

        {/* L'argent du dépôt : le reste à payer, encaisser (avec preuve et reçu), la liste des encaissements, la facture. */}
        {quote && quote.total_xaf > 0 && <QuotePayments quote={quote} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}

        {/* Les bons de retrait, signés à Douala. */}
        <DepositReleases parcels={deposit.parcels} />

        {/* L'histoire du dépôt, du premier scan à la remise. */}
        <section>
          <h2 className={cn('mb-3', TYPE.lead, TEXT.strong)}>Historique</h2>
          <DepositTimeline events={events} />
        </section>
      </div>

      <ParcelPhotoViewer parcels={viewerParcels} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={deposit.deposit_no} />
      {deposit.client && <InternalLabelSheet open={labelsOpen} onClose={() => setLabelsOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}

      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} title="Attribuer à un client">
        <div className="space-y-4">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone, BZ-…" className="h-12 pl-12" autoFocus />
          </div>
          {(search.data ?? []).map((c) => {
            const n = clientFullName(c);
            return (
              <button
                key={c.user_id}
                type="button"
                onClick={async () => {
                  await assign.mutateAsync({ depositId: deposit.id, clientUserId: c.user_id });
                  toast.success('Dépôt attribué', { description: n });
                  setAssignOpen(false);
                }}
                className={cn('flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left', SURFACE.inset)}
              >
                <Holder>{initials(n)}</Holder>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{n} <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>{c.customer_code}</span></span>
                  <span className={cn('block truncate', TYPE.small, TEXT.muted)}>{[c.phone, c.city].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
