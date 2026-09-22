// ============================================================
// ENTREPÔT — Remettre, étape 2 sur 3 : « Quels colis emporte-t-il ? » Le
// client en tête, ses colis prêts cochés d'office, ce qui n'est pas encore là
// replié. En bas, UNE phrase et UN bouton : « Remettre n colis » — ou, si un
// devis n'est pas soldé, « Encaisser d'abord », qui mène à l'écran de caisse.
// Rien ne sort sans être payé : la base le garantit, l'écran l'explique.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banknote, FileSignature, PackageCheck } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { UnknownCodeError, useClientAtWarehouse } from '@/hooks/useWarehouse';
import { nParcels, quoteWord, releaseBlockers, releaseWord, warehouseStage } from '@/lib/warehouse';
import { formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Fold, Line, PrimaryPill, ScreenError, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { BottomBar, ClientHead, ParcelLine, TickBox, WhStep } from '@/mobile/components/warehouse/bits';
import { WarehouseReceipts } from '@/mobile/components/warehouse/WarehouseReceipts';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehousePickupClient() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const viewer = useParcelViewer();

  const ready = useMemo(() => data?.ready ?? [], [data]);
  // Tout est coché d'office ; un brouillon (retour depuis l'étape 3) garde son choix.
  useEffect(() => {
    if (!data || picked !== null) return;
    const draft = readReleaseDraft(code);
    const keep = draft ? ready.filter((p) => draft.ids.includes(p.id)) : ready;
    setPicked(new Set(keep.map((p) => p.id)));
  }, [data, ready, picked, code]);

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error instanceof UnknownCodeError) return <ScreenError title="Client inconnu" description={`Aucun client ne porte le code ${error.code || code}.`} onRetry={() => navigate('/w/remise')} retryLabel="Scanner à nouveau" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Client introuvable'} onRetry={() => void refetch()} />;

  const client = data.client;
  const chosen = ready.filter((p) => picked?.has(p.id));
  const blockers = releaseBlockers(chosen, data.quotes);
  const canRelease = hasPermission('canReleaseParcels');
  const canCollect = hasPermission('canCollectParcelPayments');
  const word = releaseWord(chosen.length, blockers);
  const due = blockers.reduce((s, q) => s + q.balance_xaf, 0);
  const unpriced = blockers.some((q) => q.total_xaf <= 0);
  const kg = chosen.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s ?? []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const next = () => { writeReleaseDraft({ code: client.customer_code, ids: chosen.map((p) => p.id), who: readReleaseDraft(code)?.who, phone: readReleaseDraft(code)?.phone }); navigate(`/w/remise/${code}/qui`); };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Remettre" showBack backTo="/w/remise" />
      <div className="space-y-5 px-4 pb-44 pt-4">
        <WhStep step={2} total={3} title={ready.length > 0 ? 'Quels colis emporte-t-il ?' : 'Rien à remettre'} help={ready.length > 0 ? 'Tout est coché. Décochez ce qui reste à l\'entrepôt.' : 'Aucun colis pointé pour ce client. Ce qui est en route apparaît ci-dessous.'} />
        <Card><ClientHead client={client} sub={`${client.customer_code}${client.phone ? ` · ${client.phone}` : ''}${data.releases.length > 0 ? ` · ${data.releases.length} retrait${data.releases.length > 1 ? 's' : ''} déjà fait${data.releases.length > 1 ? 's' : ''}` : ''}`} /></Card>

        {ready.length > 0 && (
          <Card className="py-0">
            {ready.map((p) => {
              const on = !!picked?.has(p.id);
              const qw = quoteWord(p);
              return <ParcelLine key={p.id} parcel={p} onTap={() => toggle(p.id)} lead={<TickBox on={on} />} badge={<StatusPill tone={qw.ok ? 'success' : 'pending'} label={qw.text} />} withTransport onPhoto={() => viewer.open(ready.indexOf(p))} />;
            })}
          </Card>
        )}

        {data.not_ready.length > 0 && (
          <Fold title={`${nParcels(data.not_ready.length)} pas encore là`} open={laterOpen || ready.length === 0} onToggle={() => setLaterOpen((o) => !o)}>
            {data.not_ready.map((p) => { const st = warehouseStage(p); return <ParcelLine key={p.id} parcel={p} withTransport badge={<StatusPill tone={st.tone} label={st.label} />} />; })}
          </Fold>
        )}

        {/* Ce qu'il a déjà payé, reçu par reçu ; et ses bons de retrait passés, à réimprimer. */}
        {data.quotes.length > 0 && (
          <Fold title={`Paiements et reçus (${data.quotes.length} devis)`} open={moneyOpen} onToggle={() => setMoneyOpen((o) => !o)}>
            <div className="pt-2"><WarehouseReceipts quotes={data.quotes} /></div>
          </Fold>
        )}
        {data.releases.length > 0 && (
          <Card className="py-0">
            <div className={cn('py-3', TYPE.smallStrong, TEXT.muted)}>Bons de retrait déjà faits</div>
            {data.releases.map((r) => (
              <button key={r.id} type="button" onClick={() => navigate(`/w/bon/${r.id}`)} className={cn('flex w-full items-center gap-3 border-t py-3 text-left active:opacity-70', SURFACE.divider)}>
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><FileSignature className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{r.release_no} · {nParcels(r.parcel_count)}</span>
                  <span className={cn('block', TYPE.small, TEXT.muted)}>{r.picked_by_name} · {formatDateTime(r.released_at)} · réimprimer</span>
                </span>
              </button>
            ))}
          </Card>
        )}
      </div>

      <ParcelPhotoViewer parcels={ready.map((p) => ({ ...p, note: warehouseStage(p).label }))} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={client.customer_code} />

      {ready.length > 0 && (
        <BottomBar>
          <div className={cn('flex items-center justify-between gap-3', TYPE.body)}>
            <Line tone={word.tone} className="min-w-0 flex-1 !text-[15px]">{word.text}</Line>
            <span className={cn('shrink-0 tabular-nums', TYPE.small, TEXT.muted)}>{chosen.length} · {formatKg(kg)}</span>
          </div>
          {due > 0 && !unpriced ? (
            canCollect ? <PrimaryPill onClick={() => navigate(`/w/remise/${code}/encaisser`)} className="h-14 w-full text-[17px]"><Banknote /> Encaisser d'abord</PrimaryPill>
            : <p className={cn(TYPE.small, TEXT.muted)}>Seules les opérations peuvent encaisser. Appelez-les avant de remettre.</p>
          ) : (
            canRelease && <PrimaryPill onClick={next} disabled={chosen.length === 0 || blockers.length > 0} className="h-14 w-full text-[17px]"><PackageCheck /> Remettre {nParcels(chosen.length)}</PrimaryPill>
          )}
        </BottomBar>
      )}
    </div>
  );
}
